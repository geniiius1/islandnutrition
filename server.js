const express = require('express');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { createDatabase } = require('./db');
const { seedInitialData } = require('./seed');
const fs = require('fs');
const sharp = require('sharp');
const compression = require('compression');

// ============================================================
// SERVER SETUP
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip/deflate compression for all text, json, html, css, js responses
app.use(compression());

// Database handle (initialized in startServer)
let db;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: 'island-nutrition-secret-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// In-Memory Fast API Cache (reduces repeated SQLite queries to 0ms)
const apiCache = new Map();
function getApiCache(key, ttlMs = 120000) {
  const item = apiCache.get(key);
  if (item && Date.now() - item.ts < ttlMs) {
    return item.data;
  }
  return null;
}
function setApiCache(key, data) {
  apiCache.set(key, { ts: Date.now(), data });
}
function invalidateApiCache() {
  apiCache.clear();
}

// Invalidate API cache on any admin mutations
app.use('/api/admin', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    invalidateApiCache();
  }
  next();
});

// HTTP Cache headers: Fast, light, aggressive static caching with conditional revalidation
app.use((req, res, next) => {
  // HTML: Always validate for instant updates with 304 fallback
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache');
  } 
  // Versioned assets or images: 7 days cache with 1 day stale-while-revalidate
  else if (req.query.v || req.path.startsWith('/uploads/') || req.path.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  } 
  // CSS & JS: 1 day cache with conditional revalidation
  else if (req.path.endsWith('.css') || req.path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// ============================================================
// FILE UPLOAD (Multer + Sharp)
// ============================================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image/.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Process and save uploaded image (high quality for premium product photos)
async function processAndSaveImage(buffer, originalName) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = uniqueSuffix + '.webp';
  const filepath = path.join(uploadsDir, filename);

  try {
    // Automatically trim transparent border whitespace so product subject fills image canvas
    await sharp(buffer)
      .trim()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, effort: 6 })
      .toFile(filepath);
  } catch (e) {
    // Fallback: save original
    const fallbackName = uniqueSuffix + path.extname(originalName);
    const fallbackPath = path.join(uploadsDir, fallbackName);
    fs.writeFileSync(fallbackPath, buffer);
    return '/uploads/' + fallbackName;
  }

  return '/uploads/' + filename;
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ============================================================
// HELPER: Slugify
// ============================================================
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.adminId = user.id;
  req.session.adminUsername = user.username;
  res.json({ success: true, username: user.username });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.adminId),
    username: req.session?.adminUsername || null
  });
});

app.put('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.adminId);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hash, req.session.adminId);
  res.json({ success: true });
});

// ============================================================
// CATEGORY ROUTES - PUBLIC
// ============================================================
app.get('/api/categories', (req, res) => {
  const cacheKey = 'categories_all';
  const cached = getApiCache(cacheKey);
  if (cached) return res.json(cached);

  const categories = db.prepare(`
    SELECT c.*,
      (SELECT pi.image_path FROM products p2
       LEFT JOIN product_images pi ON p2.id = pi.product_id AND pi.is_primary = 1
       WHERE p2.category_id = c.id
       ORDER BY p2.sort_order LIMIT 1) as preview_image
    FROM categories c
    ORDER BY c.sort_order, c.name
  `).all();

  // Dynamically calculate accurate item count (all flavors + standalone products)
  for (const cat of categories) {
    const prods = db.prepare('SELECT id FROM products WHERE category_id = ?').all(cat.id);
    let count = 0;
    for (const p of prods) {
      const flvCount = db.prepare('SELECT COUNT(*) as cnt FROM product_flavors WHERE product_id = ?').get(p.id).cnt;
      count += flvCount > 1 ? flvCount : 1;
    }
    cat.product_count = prods.length > 0 ? count : 0;
  }

  setApiCache(cacheKey, categories);
  res.json(categories);
});

app.get('/api/categories/:idOrSlug', (req, res) => {
  const param = req.params.idOrSlug;
  const cacheKey = `category_${param}`;
  const cached = getApiCache(cacheKey);
  if (cached) return res.json(cached);

  const category = db.prepare(
    'SELECT * FROM categories WHERE id = ? OR slug = ?'
  ).get(param, param);

  if (!category) return res.status(404).json({ error: 'Category not found' });

  const products = db.prepare(`
    SELECT p.*,
      (SELECT pi.image_path FROM product_images pi
       WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as primary_image,
      (SELECT GROUP_CONCAT(pf.flavor_name, ', ') FROM product_flavors pf
       WHERE pf.product_id = p.id) as flavor_list
    FROM products p
    WHERE p.category_id = ?
    ORDER BY p.sort_order, p.name
  `).all(category.id);

  const consolidatedProducts = [];
  for (const product of products) {
    const images = db.prepare(
      'SELECT id, image_path, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id'
    ).all(product.id);
    const flavors = db.prepare(
      'SELECT id, flavor_name, color_code FROM product_flavors WHERE product_id = ? ORDER BY rowid'
    ).all(product.id);

    flavors.forEach((f, idx) => {
      f.image_path = images[idx] ? images[idx].image_path : product.primary_image;
    });

    consolidatedProducts.push({
      ...product,
      images: images,
      display_name: product.name,
      flavor_name: flavors[0] ? flavors[0].flavor_name : null,
      flavor_color: flavors[0] ? flavors[0].color_code : null,
      flavor_count: flavors.length,
      flavors: flavors
    });
  }

  const result = { ...category, product_count: consolidatedProducts.length, products: consolidatedProducts };
  setApiCache(cacheKey, result);
  res.json(result);
});

// ============================================================
// CATEGORY ROUTES - ADMIN
// ============================================================
app.post('/api/admin/categories', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    const slug = slugify(name);
    let image = null;

    if (req.file) {
      image = await processAndSaveImage(req.file.buffer, req.file.originalname);
    }

    const result = db.prepare(
      'INSERT INTO categories (name, slug, image, description, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(name, slug, image, description || '', sort_order || 0);

    res.json({ id: result.lastInsertRowid, slug, success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/categories/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    const slug = slugify(name);

    if (req.file) {
      const image = await processAndSaveImage(req.file.buffer, req.file.originalname);
      db.prepare(
        'UPDATE categories SET name=?, slug=?, image=?, description=?, sort_order=? WHERE id=?'
      ).run(name, slug, image, description || '', sort_order || 0, req.params.id);
    } else {
      db.prepare(
        'UPDATE categories SET name=?, slug=?, description=?, sort_order=? WHERE id=?'
      ).run(name, slug, description || '', sort_order || 0, req.params.id);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/categories/:id', requireAuth, (req, res) => {
  try {
    // Delete product images from disk
    const images = db.prepare(`
      SELECT pi.image_path FROM product_images pi
      INNER JOIN products p ON pi.product_id = p.id
      WHERE p.category_id = ?
    `).all(req.params.id);

    images.forEach(img => {
      const filePath = path.join(__dirname, img.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // Delete category image
    const cat = db.prepare('SELECT image FROM categories WHERE id = ?').get(req.params.id);
    if (cat && cat.image) {
      const catPath = path.join(__dirname, cat.image);
      if (fs.existsSync(catPath)) fs.unlinkSync(catPath);
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// PRODUCT ROUTES - PUBLIC
// ============================================================
app.get('/api/products', (req, res) => {
  const cacheKey = `products_${JSON.stringify(req.query)}`;
  const cached = getApiCache(cacheKey);
  if (cached) return res.json(cached);

  const { category_id, featured, search, limit } = req.query;
  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug,
      (SELECT pi.image_path FROM product_images pi
       WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as primary_image,
      (SELECT GROUP_CONCAT(pf.flavor_name, ', ') FROM product_flavors pf
       WHERE pf.product_id = p.id) as flavor_names,
      (SELECT COUNT(*) FROM product_flavors pf
       WHERE pf.product_id = p.id) as flavor_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
  if (featured === 'true') { query += ' AND (p.is_featured = 1 OR p.is_new = 1 OR UPPER(COALESCE(p.badge_text, "")) = "NEW")'; }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (featured === 'true') {
    query += ' ORDER BY (CASE WHEN (p.is_new = 1 OR UPPER(COALESCE(p.badge_text, "")) = "NEW") THEN 0 ELSE 1 END), p.sort_order, p.name';
  } else {
    query += ' ORDER BY p.sort_order, p.name';
  }
  if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

  const products = db.prepare(query).all(...params);
  for (const p of products) {
    p.images = db.prepare('SELECT id, image_path, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(p.id);
    p.flavors = db.prepare('SELECT id, flavor_name, color_code FROM product_flavors WHERE product_id = ? ORDER BY rowid').all(p.id);
    p.flavors.forEach((f, idx) => {
      f.image_path = p.images[idx] ? p.images[idx].image_path : p.primary_image;
    });
  }

  setApiCache(cacheKey, products);
  res.json(products);
});

app.get('/api/products/:idOrSlug', (req, res) => {
  const param = req.params.idOrSlug;
  const cacheKey = `product_${param}`;
  const cached = getApiCache(cacheKey);
  if (cached) return res.json(cached);

  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ? OR p.slug = ?
  `).get(param, param);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  product.images = db.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id'
  ).all(product.id);

  product.specs = db.prepare(
    'SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort_order'
  ).all(product.id);

  product.flavors = db.prepare(
    'SELECT * FROM product_flavors WHERE product_id = ? ORDER BY rowid'
  ).all(product.id);

  // Related products (same category, excluding current)
  product.related = db.prepare(`
    SELECT p.*,
      (SELECT pi.image_path FROM product_images pi
       WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as primary_image
    FROM products p
    WHERE p.category_id = ? AND p.id != ?
    ORDER BY RANDOM() LIMIT 4
  `).all(product.category_id, product.id);

  for (const rel of product.related) {
    rel.images = db.prepare('SELECT id, image_path, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(rel.id);
    rel.flavors = db.prepare('SELECT id, flavor_name, color_code FROM product_flavors WHERE product_id = ? ORDER BY rowid').all(rel.id);
    rel.flavors.forEach((f, idx) => {
      f.image_path = rel.images[idx] ? rel.images[idx].image_path : rel.primary_image;
    });
  }

  setApiCache(cacheKey, product);
  res.json(product);
});

// ============================================================
// PRODUCT ROUTES - ADMIN
// ============================================================
app.post('/api/admin/products', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const {
      name, category_id, description, short_description,
      weight, servings, ingredients, usage_instructions,
      sort_order, is_featured, is_new, badge_text, badge_color, specs, flavors
    } = req.body;

    const slug = slugify(name);

    const result = db.prepare(`
      INSERT INTO products (name, slug, category_id, description, short_description,
        weight, servings, ingredients, usage_instructions, sort_order, is_featured, is_new, badge_text, badge_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, slug, category_id, description || '', short_description || '',
      weight || '', servings || '', ingredients || '', usage_instructions || '',
      sort_order || 0, is_featured ? 1 : 0, (is_new === '1' || is_new === 1 || is_new === true || is_new === 'true') ? 1 : 0,
      badge_text || null, badge_color || null
    );

    const productId = result.lastInsertRowid;

    // Process and save images
    if (req.files && req.files.length > 0) {
      const insertImage = db.prepare(
        'INSERT INTO product_images (product_id, image_path, is_primary, sort_order) VALUES (?, ?, ?, ?)'
      );
      for (let i = 0; i < req.files.length; i++) {
        const imagePath = await processAndSaveImage(req.files[i].buffer, req.files[i].originalname);
        insertImage.run(productId, imagePath, i === 0 ? 1 : 0, i);
      }
    }

    // Specs
    if (specs) {
      const specsArr = JSON.parse(specs);
      const insertSpec = db.prepare(
        'INSERT INTO product_specs (product_id, spec_name, spec_value, sort_order) VALUES (?, ?, ?, ?)'
      );
      specsArr.forEach((spec, i) => {
        if (spec.name && spec.value) insertSpec.run(productId, spec.name, spec.value, i);
      });
    }

    // Flavors
    if (flavors) {
      const flavorsArr = JSON.parse(flavors);
      const insertFlavor = db.prepare(
        'INSERT INTO product_flavors (product_id, flavor_name, color_code) VALUES (?, ?, ?)'
      );
      flavorsArr.forEach(flavor => {
        if (flavor.name) insertFlavor.run(productId, flavor.name, flavor.color || '#10b981');
      });
    }

    res.json({ id: productId, slug, success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/products/:id', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const {
      name, category_id, description, short_description,
      weight, servings, ingredients, usage_instructions,
      sort_order, is_featured, is_new, badge_text, badge_color, specs, flavors, keep_images
    } = req.body;

    const slug = slugify(name);

    db.prepare(`
      UPDATE products SET name=?, slug=?, category_id=?, description=?, short_description=?,
        weight=?, servings=?, ingredients=?, usage_instructions=?, sort_order=?, is_featured=?,
        is_new=?, badge_text=?, badge_color=?
      WHERE id=?
    `).run(
      name, slug, category_id, description || '', short_description || '',
      weight || '', servings || '', ingredients || '', usage_instructions || '',
      sort_order || 0, is_featured ? 1 : 0, (is_new === '1' || is_new === 1 || is_new === true || is_new === 'true') ? 1 : 0,
      badge_text || null, badge_color || null, req.params.id
    );

    // Handle images
    if (keep_images !== undefined) {
      const keepIds = JSON.parse(keep_images || '[]');
      // Get images to delete
      let imagesToDelete;
      if (keepIds.length > 0) {
        imagesToDelete = db.prepare(
          `SELECT image_path FROM product_images WHERE product_id = ? AND id NOT IN (${keepIds.map(() => '?').join(',')})`
        ).all(req.params.id, ...keepIds);
        db.prepare(
          `DELETE FROM product_images WHERE product_id = ? AND id NOT IN (${keepIds.map(() => '?').join(',')})`
        ).run(req.params.id, ...keepIds);
      } else {
        imagesToDelete = db.prepare('SELECT image_path FROM product_images WHERE product_id = ?').all(req.params.id);
        db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
      }
      // Delete files
      imagesToDelete.forEach(img => {
        const filePath = path.join(__dirname, img.image_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const existingCount = db.prepare(
        'SELECT COUNT(*) as count FROM product_images WHERE product_id = ?'
      ).get(req.params.id).count;

      const insertImage = db.prepare(
        'INSERT INTO product_images (product_id, image_path, is_primary, sort_order) VALUES (?, ?, ?, ?)'
      );
      for (let i = 0; i < req.files.length; i++) {
        const imagePath = await processAndSaveImage(req.files[i].buffer, req.files[i].originalname);
        insertImage.run(req.params.id, imagePath, existingCount === 0 && i === 0 ? 1 : 0, existingCount + i);
      }
    }

    // Update specs
    if (specs !== undefined) {
      db.prepare('DELETE FROM product_specs WHERE product_id = ?').run(req.params.id);
      if (specs) {
        const specsArr = JSON.parse(specs);
        const insertSpec = db.prepare(
          'INSERT INTO product_specs (product_id, spec_name, spec_value, sort_order) VALUES (?, ?, ?, ?)'
        );
        specsArr.forEach((spec, i) => {
          if (spec.name && spec.value) insertSpec.run(req.params.id, spec.name, spec.value, i);
        });
      }
    }

    // Update flavors
    if (flavors !== undefined) {
      db.prepare('DELETE FROM product_flavors WHERE product_id = ?').run(req.params.id);
      if (flavors) {
        const flavorsArr = JSON.parse(flavors);
        const insertFlavor = db.prepare(
          'INSERT INTO product_flavors (product_id, flavor_name, color_code) VALUES (?, ?, ?)'
        );
        flavorsArr.forEach(flavor => {
          if (flavor.name) insertFlavor.run(req.params.id, flavor.name, flavor.color || '#10b981');
        });
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/products/:id/primary-image/:imageId', requireAuth, (req, res) => {
  db.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').run(req.params.id);
  db.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?')
    .run(req.params.imageId, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  try {
    const images = db.prepare('SELECT image_path FROM product_images WHERE product_id = ?').all(req.params.id);
    images.forEach(img => {
      const filePath = path.join(__dirname, img.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// ADMIN STATS
// ============================================================
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get()?.count || 0;
  const products = db.prepare('SELECT COUNT(*) as count FROM products').get()?.count || 0;
  const flavors = db.prepare('SELECT COUNT(*) as count FROM product_flavors').get()?.count || 0;
  const images = db.prepare('SELECT COUNT(*) as count FROM product_images').get()?.count || 0;
  const inquiries = db.prepare('SELECT COUNT(*) as count FROM inquiries').get()?.count || 0;
  const unreadInquiries = db.prepare("SELECT COUNT(*) as count FROM inquiries WHERE status = 'unread'").get()?.count || 0;

  const recentProducts = db.prepare(`
    SELECT p.name, p.created_at, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC LIMIT 5
  `).all();

  const recentInquiries = db.prepare(`
    SELECT id, name, email, company, created_at, status
    FROM inquiries
    ORDER BY created_at DESC LIMIT 5
  `).all();

  res.json({ categories, products, flavors, images, inquiries, unreadInquiries, recentProducts, recentInquiries });
});

// ============================================================
// INQUIRIES & MESSAGES
// ============================================================
app.post('/api/inquiries', (req, res) => {
  try {
    const { name, phone, email, company, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO inquiries (name, phone, email, company, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name.trim(), phone?.trim() || null, email.trim(), company?.trim() || null, message.trim());
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Error saving inquiry:', err);
    res.status(500).json({ error: 'Failed to save inquiry' });
  }
});

app.get('/api/admin/inquiries', requireAuth, (req, res) => {
  const inquiries = db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all();
  res.json(inquiries);
});

app.put('/api/admin/inquiries/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['unread', 'read', 'replied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/inquiries/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// SITE SETTINGS
// ============================================================
app.get('/api/settings', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM site_settings').all().forEach(row => {
    settings[row.key] = row.value;
  });
  res.json(settings);
});

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction((settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      upsert.run(key, value);
    });
  });
  transaction(req.body);
  res.json({ success: true });
});

// ============================================================
// PAGE ROUTES (Serve HTML pages)
// ============================================================
const pages = ['products', 'category', 'product', 'about', 'contact'];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// Catch all - serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================
async function startServer() {
  db = await createDatabase();
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      image TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      description TEXT,
      short_description TEXT,
      weight TEXT,
      servings TEXT,
      ingredients TEXT,
      usage_instructions TEXT,
      sort_order INTEGER DEFAULT 0,
      is_featured BOOLEAN DEFAULT 0,
      is_new BOOLEAN DEFAULT 0,
      badge_text TEXT,
      badge_color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- Ensure badge columns exist on existing databases
    BEGIN;
    COMMIT;

    CREATE TABLE IF NOT EXISTS product_specs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      spec_name TEXT NOT NULL,
      spec_value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_flavors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      flavor_name TEXT NOT NULL,
      color_code TEXT DEFAULT '#10b981',
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      is_primary BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure new columns exist on existing databases
  try { db.exec('ALTER TABLE products ADD COLUMN is_new BOOLEAN DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN badge_text TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN badge_color TEXT;'); } catch (e) {}

  // High performance SQLite indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
    CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
    CREATE INDEX IF NOT EXISTS idx_product_flavors_product ON product_flavors(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_specs_product ON product_specs(product_id);
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
    CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);
  `);

  // Create default admin user
  const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run('admin', hash);
    console.log('✅ Default admin created: admin / admin123');
  }

  // Default site settings
  const defaultSettings = {
    site_name: 'Island Nutrition',
    site_tagline: 'Fuel Your Paradise',
    site_description: 'Quality supplements crafted for peak performance. Fuel your paradise with the finest quality ingredients.',
    contact_email: 'info@islandnutrition.com',
    contact_phone: '+1 (555) 123-4567',
    instagram: '#',
    facebook: '#',
    twitter: '#'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  Object.entries(defaultSettings).forEach(([key, value]) => {
    insertSetting.run(key, value);
  });

  // Seed sample products & categories if empty
  await seedInitialData(db);

  app.listen(PORT, () => {
    console.log('');
    console.log('  🌴 ══════════════════════════════════════════ 🌴');
    console.log('  ║                                              ║');
    console.log(`  ║   Island Nutrition Server                     ║`);
    console.log(`  ║   Running on http://localhost:${PORT}             ║`);
    console.log('  ║                                              ║');
    console.log('  🌴 ══════════════════════════════════════════ 🌴');
    console.log('');
    console.log(`  🌐 Website:     http://localhost:${PORT}`);
    console.log(`  🔐 Admin Panel: http://localhost:${PORT}/admin/login.html`);
    console.log('  📋 Default login: admin / admin123');
    console.log('');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
