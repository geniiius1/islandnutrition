/* ============================================================
   ISLAND NUTRITION - ADMIN PANEL JAVASCRIPT
   ============================================================ */

// ===== STATE =====
let currentPage = 'dashboard';
let categories = [];
let products = [];
let editingItem = null;

// ===== HELPER: Check if currently on the login page =====
function isLoginPage() {
  return Boolean(
    document.querySelector('.login-page') ||
    document.getElementById('login-username') ||
    window.location.pathname.endsWith('login.html') ||
    window.location.pathname.endsWith('/admin/login')
  );
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  if (isLoginPage()) {
    checkLoginAuth();
  } else {
    checkAuth();
    initSidebar();
  }
});

// ===== AUTH =====
// Check auth on admin dashboard: redirect to login if not authenticated
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/admin/login.html';
      return;
    }
    const usernameEl = document.getElementById('admin-username');
    if (usernameEl) usernameEl.textContent = data.username;
    navigateTo('dashboard');
  } catch {
    window.location.href = '/admin/login.html';
  }
}

// Check auth on login page: if already logged in, redirect to dashboard; otherwise stay on page!
async function checkLoginAuth() {
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (data.authenticated) {
      window.location.href = '/admin/index.html';
    }
  } catch {
    // If not authenticated or error, stay on login page
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  const submitBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('.btn-login');
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
    }
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    window.location.href = '/admin/index.html';
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Dashboard';
    }
  }
}

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
}

// ===== SIDEBAR =====
function initSidebar() {
  const toggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}

// ===== NAVIGATION =====
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Auto-close mobile sidebar if open
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');

  const headerTitle = document.getElementById('header-title');
  const content = document.getElementById('admin-content');

  switch (page) {
    case 'dashboard':
      if (headerTitle) headerTitle.textContent = 'Dashboard';
      loadDashboard(content);
      break;
    case 'categories':
      if (headerTitle) headerTitle.textContent = 'Categories';
      loadCategoriesPage(content);
      break;
    case 'products':
      if (headerTitle) headerTitle.textContent = 'Products';
      loadProductsPage(content);
      break;
    case 'settings':
      if (headerTitle) headerTitle.textContent = 'Settings';
      loadSettingsPage(content);
      break;
  }
}

// ===== DASHBOARD =====
async function loadDashboard(container) {
  try {
    const stats = await fetchAPI('/api/admin/stats');

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon"><i class="fa-solid fa-folder-open"></i></div>
          </div>
          <div class="stat-card-value">${stats.categories}</div>
          <div class="stat-card-label">Categories</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
          </div>
          <div class="stat-card-value">${stats.products}</div>
          <div class="stat-card-label">Products</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon"><i class="fa-solid fa-palette"></i></div>
          </div>
          <div class="stat-card-value">${stats.flavors}</div>
          <div class="stat-card-label">Flavors</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon"><i class="fa-solid fa-images"></i></div>
          </div>
          <div class="stat-card-value">${stats.images}</div>
          <div class="stat-card-label">Images</div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Recent Products</h3>
          <button class="btn-admin btn-admin-primary" onclick="navigateTo('products')">View All</button>
        </div>
        ${stats.recentProducts && stats.recentProducts.length > 0 ? `
          <ul class="activity-list">
            ${stats.recentProducts.map(p => `
              <li class="activity-item">
                <span class="activity-dot"></span>
                <span class="activity-text"><strong>${p.name}</strong> added to ${p.category_name || 'Unknown'}</span>
                <span class="activity-time">${formatDate(p.created_at)}</span>
              </li>
            `).join('')}
          </ul>
        ` : `
          <div style="padding: 40px; text-align: center; color: var(--admin-text-muted);">
            <p>No products yet. Start by adding categories and products!</p>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p>Failed to load dashboard</p>';
  }
}

// ===== CATEGORIES PAGE =====
async function loadCategoriesPage(container) {
  try {
    categories = await fetchAPI('/api/categories');

    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">All Categories (${categories.length})</h3>
          <button class="btn-admin btn-admin-primary" onclick="showCategoryModal()"><i class="fa-solid fa-plus" style="margin-right:6px;"></i> Add Category</button>
        </div>
        ${categories.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width:70px;">Image</th>
                  <th>Name</th>
                  <th>Products</th>
                  <th>Order</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${categories.map(cat => `
                  <tr>
                    <td>
                      ${cat.image || cat.preview_image
                        ? `<img class="table-image" src="${cat.image || cat.preview_image}" alt="${escHTML(cat.name)}">`
                        : '<div class="table-image" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--admin-text-muted);"><i class="fa-solid fa-folder"></i></div>'
                      }
                    </td>
                    <td><strong>${escHTML(cat.name)}</strong></td>
                    <td><span class="admin-count-pill">${cat.product_count || 0}</span></td>
                    <td>${cat.sort_order || 0}</td>
                    <td style="text-align:right;">
                      <div class="table-actions" style="justify-content:flex-end;">
                        <button class="btn-table btn-table-edit" onclick="showCategoryModal(${cat.id})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button class="btn-table btn-table-delete" onclick="deleteCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash-can"></i></button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="padding: 60px 20px; text-align: center; color: var(--admin-text-muted);">
            <p style="font-size: 2rem; margin-bottom: 8px;"><i class="fa-solid fa-folder-open"></i></p>
            <p>No categories yet. Click "Add Category" to get started.</p>
          </div>
        `}
      </div>

      <!-- Category Modal -->
      <div class="modal-overlay" id="category-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="category-modal-title">Add Category</h3>
            <button class="modal-close" onclick="closeCategoryModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="category-form" onsubmit="saveCategory(event)">
            <div class="modal-body">
              <input type="hidden" id="category-id">
              <div class="form-group">
                <label for="category-name">Category Name *</label>
                <input type="text" id="category-name" required placeholder="e.g., Whey Protein">
              </div>
              <div class="form-group">
                <label for="category-description">Description</label>
                <textarea id="category-description" placeholder="Brief description of this category..."></textarea>
              </div>
              <div class="form-group">
                <label>Category Image</label>
                <div class="image-upload-area" id="category-image-upload">
                  <div class="image-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                  <div class="image-upload-text">Click or drag to upload</div>
                  <div class="image-upload-hint">JPG, PNG, WebP (max 10MB)</div>
                  <input type="file" id="category-image" accept="image/*">
                </div>
                <div class="image-preview-grid" id="category-image-preview"></div>
              </div>
              <div class="form-group">
                <label for="category-order">Sort Order</label>
                <input type="number" id="category-order" value="0" min="0">
                <div class="form-hint">Lower numbers appear first</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-admin btn-admin-secondary" onclick="closeCategoryModal()">Cancel</button>
              <button type="submit" class="btn-admin btn-admin-primary" id="category-submit-btn">Save Category</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Setup image upload
    setupImageUpload('category-image', 'category-image-upload', 'category-image-preview');
  } catch (err) {
    container.innerHTML = '<p>Failed to load categories</p>';
  }
}

function showCategoryModal(id = null) {
  const modal = document.getElementById('category-modal');
  const title = document.getElementById('category-modal-title');
  const form = document.getElementById('category-form');
  const preview = document.getElementById('category-image-preview');
  const fileInput = document.getElementById('category-image');

  if (preview) preview.innerHTML = '';
  if (fileInput) fileInput.value = '';

  if (id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    title.textContent = 'Edit Category';
    document.getElementById('category-id').value = id;
    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-description').value = cat.description || '';
    document.getElementById('category-order').value = cat.sort_order || 0;
    // Show existing image
    if (cat.image || cat.preview_image) {
      preview.innerHTML = `<div class="image-preview-item"><img src="${cat.image || cat.preview_image}" alt="Current"></div>`;
    }
  } else {
    title.textContent = 'Add Category';
    form.reset();
    document.getElementById('category-id').value = '';
  }

  modal.classList.add('open');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('open');
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('category-id').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('category-name').value);
  formData.append('description', document.getElementById('category-description').value);
  formData.append('sort_order', document.getElementById('category-order').value);

  const fileInput = document.getElementById('category-image');
  if (fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showAdminToast(id ? 'Category updated!' : 'Category created!', 'success');
    closeCategoryModal();
    loadCategoriesPage(document.getElementById('admin-content'));
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all products in this category.`)) return;

  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    showAdminToast('Category deleted', 'success');
    loadCategoriesPage(document.getElementById('admin-content'));
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ===== PRODUCTS PAGE =====
async function loadProductsPage(container) {
  try {
    [products, categories] = await Promise.all([
      fetchAPI('/api/products'),
      fetchAPI('/api/categories')
    ]);

    container.innerHTML = `
      <div class="admin-card" style="margin-bottom: 24px;">
        <div class="admin-card-header">
          <div style="display:flex; align-items:center; gap:12px;">
            <h3 class="admin-card-title">Products</h3>
            <span class="admin-count-pill" id="admin-product-count-badge">${products.length}</span>
          </div>
          <button class="btn-admin btn-admin-primary" onclick="showProductForm()"><i class="fa-solid fa-plus" style="margin-right:6px;"></i> Add Product</button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="admin-filter-bar">
          <div class="admin-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="admin-product-search" class="admin-search-input" placeholder="Search by name, category, weight, flavor..." oninput="filterAdminProducts()">
          </div>

          <div class="admin-filter-controls">
            <select id="admin-category-filter" class="admin-filter-select" onchange="filterAdminProducts()">
              <option value="">All Categories (${categories.length})</option>
              ${categories.map(c => `
                <option value="${c.id}">${escHTML(c.name)}</option>
              `).join('')}
            </select>

            <select id="admin-status-filter" class="admin-filter-select" onchange="filterAdminProducts()">
              <option value="">All Statuses</option>
              <option value="featured">Featured Only</option>
              <option value="badge">Badged / NEW Only</option>
              <option value="flavors">With Flavors</option>
            </select>

            <button type="button" class="btn-admin btn-admin-secondary btn-clear-filters" id="btn-clear-filters" onclick="clearProductFilters()" style="display:none; padding:8px 12px; font-size:0.8rem;">
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>

          <div class="admin-filter-stats" id="admin-filter-stats">
            Showing <strong id="admin-shown-count">${products.length}</strong> of ${products.length}
          </div>
        </div>

        ${products.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table" id="admin-products-table">
              <thead>
                <tr>
                  <th style="width:70px;">Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Badges</th>
                  <th>Flavors & Dots</th>
                  <th>Size & Servings</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="admin-products-tbody">
                ${renderProductRows(products)}
              </tbody>
            </table>
          </div>
          <div id="admin-no-results" style="display:none; padding: 50px 20px; text-align: center; color: var(--admin-text-muted);">
            <p style="font-size: 2rem; margin-bottom: 8px;"><i class="fa-solid fa-filter-circle-xmark"></i></p>
            <p style="font-size: 1rem; color:var(--admin-text); font-weight:600; margin-bottom:4px;">No matching products</p>
            <p style="font-size: 0.85rem; margin-bottom: 16px;">Try adjusting your search query or filters.</p>
            <button class="btn-admin btn-admin-secondary" onclick="clearProductFilters()">Clear All Filters</button>
          </div>
        ` : `
          <div style="padding: 60px 20px; text-align: center; color: var(--admin-text-muted);">
            <p style="font-size: 2rem; margin-bottom: 8px;"><i class="fa-solid fa-boxes-stacked"></i></p>
            <p>No products yet. ${categories.length === 0 ? 'Create a category first, then add products.' : 'Click "Add Product" to get started.'}</p>
          </div>
        `}
      </div>

      <div id="product-form-container" style="display:none;"></div>
    `;
  } catch (err) {
    container.innerHTML = '<p>Failed to load products</p>';
  }
}

function renderProductRows(list) {
  return list.map(p => `
    <tr class="admin-product-row" data-id="${p.id}" data-category-id="${p.category_id || ''}" data-featured="${p.is_featured ? '1' : '0'}" data-badge="${p.is_new || p.badge_text ? '1' : '0'}" data-flavor-count="${p.flavor_count || 0}" data-search="${escHTML((p.name + ' ' + (p.category_name || '') + ' ' + (p.flavor_names || '') + ' ' + (p.weight || '') + ' ' + (p.servings || '')).toLowerCase())}">
      <td>
        ${p.primary_image
          ? `<img class="table-image" src="${p.primary_image}" alt="${escHTML(p.name)}" loading="lazy">`
          : '<div class="table-image" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--admin-text-muted);"><i class="fa-solid fa-box"></i></div>'
        }
      </td>
      <td>
        <div style="font-weight:700; color:#ffffff; font-size:0.95rem;">${escHTML(p.name)}</div>
        ${p.short_description ? `<div style="font-size:0.75rem; color:var(--admin-text-muted); margin-top:2px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHTML(p.short_description)}</div>` : ''}
      </td>
      <td>
        <span class="admin-category-tag">${escHTML(p.category_name || '-')}</span>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          ${p.is_new || p.badge_text ? `
            <span class="product-custom-badge" style="position:static; display:inline-flex; border-color:${p.badge_color ? p.badge_color + '55' : 'rgba(255,255,255,0.22)'}; box-shadow:0 2px 8px ${p.badge_color ? p.badge_color + '33' : 'rgba(0,0,0,0.25)'};">
              <span class="badge-dot" style="background:${p.badge_color || '#10b981'};"></span>
              ${escHTML(p.badge_text || 'NEW')}
            </span>
          ` : ''}
          ${p.is_featured ? `
            <span style="display:inline-flex; align-items:center; gap:3px; padding:3px 7px; border-radius:9999px; font-size:0.68rem; font-weight:700; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2);">
              <i class="fa-solid fa-star" style="font-size:0.58rem; color:#f59e0b;"></i> Featured
            </span>
          ` : ''}
          ${!p.is_new && !p.badge_text && !p.is_featured ? '<span style="color:var(--admin-text-muted);font-size:0.8rem;">—</span>' : ''}
        </div>
      </td>
      <td>
        ${p.flavor_count > 0 ? `
          <div style="display:flex; align-items:center; gap:8px;" title="${escHTML(p.flavor_names || '')}">
            <span style="font-size:0.8rem; font-weight:700; background:rgba(255,255,255,0.08); padding:2px 7px; border-radius:10px;">${p.flavor_count}</span>
            <div style="display:inline-flex; gap:3px; align-items:center;">
              ${(p.flavors || []).map(f => `<span style="width:8px; height:8px; border-radius:50%; background:${f.color_code || '#fff'}; display:inline-block; box-shadow:0 0 3px rgba(0,0,0,0.5);" title="${escHTML(f.flavor_name)}"></span>`).join('')}
            </div>
          </div>
        ` : '<span style="color:var(--admin-text-muted);font-size:0.8rem;">—</span>'}
      </td>
      <td>
        <div style="font-weight:600;">${escHTML(p.weight || '—')}</div>
        ${p.servings ? `<div style="font-size:0.75rem; color:var(--admin-accent); font-weight:600; margin-top:2px;">${p.servings.toLowerCase().includes('serving') ? escHTML(p.servings) : escHTML(p.servings) + ' Servings'}</div>` : ''}
      </td>
      <td style="text-align:right;">
        <div class="table-actions" style="justify-content:flex-end;">
          <a href="/product.html?id=${p.id}" target="_blank" class="btn-table btn-table-view" title="View in Showroom">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Showroom
          </a>
          <button type="button" class="btn-table btn-table-edit" onclick="showProductForm(${p.id})">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button type="button" class="btn-table btn-table-delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Delete Product">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterAdminProducts() {
  const query = (document.getElementById('admin-product-search')?.value || '').trim().toLowerCase();
  const categoryId = document.getElementById('admin-category-filter')?.value || '';
  const status = document.getElementById('admin-status-filter')?.value || '';

  const rows = document.querySelectorAll('#admin-products-tbody .admin-product-row');
  let visibleCount = 0;

  rows.forEach(row => {
    const rowSearch = row.dataset.search || '';
    const rowCat = row.dataset.categoryId || '';
    const isFeatured = row.dataset.featured === '1';
    const isBadged = row.dataset.badge === '1';
    const flavorCount = parseInt(row.dataset.flavorCount || '0', 10);

    const matchesQuery = !query || rowSearch.includes(query);
    const matchesCat = !categoryId || rowCat === categoryId;
    let matchesStatus = true;
    if (status === 'featured') matchesStatus = isFeatured;
    else if (status === 'badge') matchesStatus = isBadged;
    else if (status === 'flavors') matchesStatus = flavorCount > 0;

    if (matchesQuery && matchesCat && matchesStatus) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  const shownCountEl = document.getElementById('admin-shown-count');
  if (shownCountEl) shownCountEl.textContent = visibleCount;

  const noResultsEl = document.getElementById('admin-no-results');
  const tableEl = document.getElementById('admin-products-table');
  if (noResultsEl && tableEl) {
    if (visibleCount === 0 && rows.length > 0) {
      noResultsEl.style.display = 'block';
      tableEl.style.display = 'none';
    } else {
      noResultsEl.style.display = 'none';
      tableEl.style.display = '';
    }
  }

  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.style.display = (query || categoryId || status) ? 'inline-flex' : 'none';
  }
}

function clearProductFilters() {
  const searchInput = document.getElementById('admin-product-search');
  const catFilter = document.getElementById('admin-category-filter');
  const statusFilter = document.getElementById('admin-status-filter');
  if (searchInput) searchInput.value = '';
  if (catFilter) catFilter.value = '';
  if (statusFilter) statusFilter.value = '';
  filterAdminProducts();
}

let newProductFiles = [];

async function showProductForm(id = null) {
  const container = document.getElementById('product-form-container');
  if (!container) return;

  newProductFiles = [];

  let product = null;
  if (id) {
    try {
      product = await fetchAPI(`/api/products/${id}`);
    } catch {
      showAdminToast('Failed to load product', 'error');
      return;
    }
  }

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <h3 class="admin-card-title">${product ? 'Edit Product' : 'Add New Product'}</h3>
          ${product ? `<span class="admin-id-badge">ID: #${product.id}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${product ? `<a href="/product.html?id=${product.id}" target="_blank" class="btn-admin btn-admin-secondary" style="font-size:0.8rem; padding:6px 12px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Showroom</a>` : ''}
          <button class="btn-admin btn-admin-secondary" onclick="hideProductForm()">Cancel</button>
        </div>
      </div>
      <div style="padding: 24px;">
        <form id="product-form" class="admin-form" onsubmit="saveProduct(event)">
          <input type="hidden" id="product-id" value="${product ? product.id : ''}">

          <div class="form-row">
            <div class="form-group">
              <label for="product-name">Product Name *</label>
              <input type="text" id="product-name" required value="${product ? escHTML(product.name) : ''}" placeholder="e.g., Premium Whey Protein">
            </div>
            <div class="form-group">
              <label for="product-category">Category *</label>
              <select id="product-category" required>
                <option value="">Select Category</option>
                ${categories.map(c => `
                  <option value="${c.id}" ${product && product.category_id === c.id ? 'selected' : ''}>${escHTML(c.name)}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="product-short-desc">Short Description</label>
            <input type="text" id="product-short-desc" value="${product ? escHTML(product.short_description || '') : ''}" placeholder="Brief one-liner about the product">
          </div>

          <div class="form-group">
            <label for="product-description">Full Description</label>
            <textarea id="product-description" placeholder="Detailed product description...">${product ? escHTML(product.description || '') : ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="product-weight">Weight / Size / Count</label>
              <input type="text" id="product-weight" value="${product ? escHTML(product.weight || '') : ''}" placeholder="e.g., 2000g, 60 Capsules, 90 Tablets">
              <div class="form-hint">For powders enter weight (e.g., 2000g), for capsules/tablets enter count (e.g., 60 Capsules). Products with 4000g mass gainers render with heroic scale.</div>
            </div>
            <div class="form-group">
              <label for="product-servings">Servings</label>
              <input type="text" id="product-servings" value="${product ? escHTML(product.servings || '') : ''}" placeholder="e.g., 67, 30, 45, 90">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="product-order">Sort Order</label>
              <input type="number" id="product-order" value="${product ? product.sort_order || 0 : 0}" min="0">
            </div>
            <div class="form-group" style="display:flex; align-items:flex-end; padding-bottom:8px;">
              <div class="form-check">
                <input type="checkbox" id="product-featured" ${product && product.is_featured ? 'checked' : ''}>
                <label for="product-featured">Featured Product</label>
              </div>
            </div>
          </div>

          <!-- Product Badges & Visibility Highlights -->
          <div class="form-group">
            <label style="font-size:0.95rem; font-weight:700; color:var(--admin-text); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-certificate" style="color:var(--admin-accent);"></i> Card Badges & Highlights (Top-Right)
            </label>
            <div class="admin-badge-box">
              <div class="form-row">
                <div class="form-group" style="margin-bottom:0;">
                  <div class="form-check" style="margin-top:6px;">
                    <input type="checkbox" id="product-new" ${product && (product.is_new === 1 || product.is_new === true || product.is_new === '1') ? 'checked' : ''} onchange="updateLiveBadgePreview()">
                    <label for="product-new" style="font-weight:600;">Mark as "NEW" Product</label>
                  </div>
                  <div class="form-hint">Displays high-visibility glowing badge on the Top-Right corner (opposite side of flavors).</div>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label for="product-badge-text">Custom Badge Text (Optional)</label>
                  <input type="text" id="product-badge-text" value="${product ? escHTML(product.badge_text || '') : ''}" placeholder="e.g. NEW, LIMITED, HOT, SALE" oninput="updateLiveBadgePreview()">
                  <div class="form-hint">Defaults to "NEW" when checked. Type custom text anytime.</div>
                </div>
              </div>

              <div style="margin-top:14px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--admin-text-secondary); margin-bottom:6px; display:block;">Custom Badge Color & Glow</label>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                  <div class="flavor-color-picker-wrap">
                    <input type="color" id="product-badge-color" value="${(product && product.badge_color) || '#10b981'}" oninput="syncBadgeColor(this.value)">
                    <input type="text" id="product-badge-color-hex" class="flavor-hex-input" maxlength="7" value="${(product && product.badge_color) || '#10b981'}" oninput="syncBadgeColor(this.value)">
                  </div>
                  
                  <div class="admin-color-presets">
                    <span class="admin-preset-chip" onclick="setBadgePreset('#10b981', 'NEW')">
                      <span class="preset-dot" style="background:#10b981;"></span> Emerald NEW
                    </span>
                    <span class="admin-preset-chip" onclick="setBadgePreset('#f59e0b', 'HOT')">
                      <span class="preset-dot" style="background:#f59e0b;"></span> Amber HOT
                    </span>
                    <span class="admin-preset-chip" onclick="setBadgePreset('#ef4444', 'SALE')">
                      <span class="preset-dot" style="background:#ef4444;"></span> Crimson SALE
                    </span>
                    <span class="admin-preset-chip" onclick="setBadgePreset('#06b6d4', 'FRESH')">
                      <span class="preset-dot" style="background:#06b6d4;"></span> Cyan FRESH
                    </span>
                    <span class="admin-preset-chip" onclick="setBadgePreset('#8b5cf6', 'LIMITED')">
                      <span class="preset-dot" style="background:#8b5cf6;"></span> Purple LIMITED
                    </span>
                    <span class="admin-preset-chip" onclick="setBadgePreset('#ffffff', 'STEALTH')">
                      <span class="preset-dot" style="background:#ffffff;"></span> Titanium WHITE
                    </span>
                  </div>
                </div>
              </div>

              <!-- Live Card Corner Simulation -->
              <div class="admin-badge-preview-wrap">
                <div>
                  <div class="admin-badge-preview-label"><i class="fa-solid fa-eye"></i> Live Card Header Simulation</div>
                  <div style="font-size:0.75rem; color:var(--admin-text-muted); margin-top:2px;">Top-Left (Flavor Badge) vs Top-Right (Custom Badge — Identical Shape)</div>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <span class="product-flavor-badge" style="position:static; pointer-events:none;">
                    <span class="flavor-dot" style="background:#06d6a0;"></span>
                    <span>1 Flavor</span>
                  </span>

                  <span id="admin-live-badge-preview" class="product-custom-badge" style="position:static; pointer-events:none; border-color:${(product && product.badge_color) ? product.badge_color + '55' : 'rgba(255,255,255,0.22)'}; box-shadow:0 4px 14px ${(product && product.badge_color) ? product.badge_color + '33' : 'rgba(0,0,0,0.35)'};">
                    <span id="admin-live-badge-dot" class="badge-dot" style="background:${(product && product.badge_color) || '#10b981'};"></span>
                    <span id="admin-live-badge-text">${(product && product.badge_text) || (product && product.is_new ? 'NEW' : 'NEW')}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Images -->
          <div class="form-group">
            <label style="display:flex; align-items:center; justify-content:space-between;">
              <span>Product Images</span>
              <span style="font-size:0.75rem; color:var(--admin-text-muted); text-transform:none; font-weight:normal;">Images match flavors 1-to-1 in order</span>
            </label>
            <div class="image-upload-area" id="product-image-upload">
              <div class="image-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <div class="image-upload-text">Click or drag & drop to upload images</div>
              <div class="image-upload-hint">Upload high-res JPG, PNG, or WebP. 1st image = 1st flavor, 2nd image = 2nd flavor.</div>
              <input type="file" id="product-images" accept="image/*" multiple>
            </div>
            <div class="image-preview-grid" id="product-image-preview">
              ${product && product.images ? product.images.map((img, idx) => `
                <div class="image-preview-item ${img.is_primary ? 'primary' : ''}" data-id="${img.id}">
                  <img src="${img.image_path}" alt="Product image">
                  <span class="image-order-badge">#${idx + 1}</span>
                  ${img.is_primary
                    ? `<span class="primary-badge-btn is-primary"><i class="fa-solid fa-star"></i> Primary</span>`
                    : `<button type="button" class="primary-badge-btn set-primary" onclick="setPrimaryImage(${product.id}, ${img.id}, this)"><i class="fa-regular fa-star"></i> Primary</button>`
                  }
                  <button type="button" class="image-preview-remove" onclick="removeExistingImage(this, ${img.id})" title="Remove Image"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('') : ''}
            </div>
          </div>

          <!-- Specifications -->
          <div class="form-group">
            <label>Specifications</label>
            <div class="dynamic-rows" id="specs-rows">
              ${product && product.specs ? product.specs.map(s => `
                <div class="dynamic-row">
                  <input type="text" placeholder="Spec name (e.g., Protein per serving)" value="${escHTML(s.spec_name)}">
                  <input type="text" placeholder="Value (e.g., 22g)" value="${escHTML(s.spec_value)}">
                  <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove spec"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('') : ''}
            </div>
            <button type="button" class="btn-add-row" onclick="addSpecRow()"><i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add Specification</button>
          </div>

          <!-- Flavors -->
          <div class="form-group">
            <label style="font-size:0.95rem; font-weight:700; color:var(--admin-text); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-palette" style="color:var(--admin-accent);"></i> Available Flavors & Color Dot Studio
            </label>
            <div style="font-size:0.8rem;color:var(--admin-text-muted);margin-bottom:10px;">
              Images uploaded above match these flavors 1-to-1 in order. Choose any custom color for each flavor dot or click a preset:
            </div>
            <div class="dynamic-rows" id="flavors-rows">
              <!-- Rendered dynamically by addFlavorRow() -->
            </div>
            <button type="button" class="btn-add-row" onclick="addFlavorRow()"><i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add New Flavor</button>
          </div>

          <!-- Ingredients -->
          <div class="form-group">
            <label for="product-ingredients">Ingredients</label>
            <textarea id="product-ingredients" placeholder="List of ingredients...">${product ? escHTML(product.ingredients || '') : ''}</textarea>
          </div>

          <!-- Usage -->
          <div class="form-group">
            <label for="product-usage">Usage Instructions</label>
            <textarea id="product-usage" placeholder="How to use this product...">${product ? escHTML(product.usage_instructions || '') : ''}</textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--admin-border);">
            <button type="button" class="btn-admin btn-admin-secondary" onclick="hideProductForm()">Cancel</button>
            <button type="submit" class="btn-admin btn-admin-primary">${product ? 'Update Product' : 'Create Product'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Setup multi-image upload
  setupMultiImageUpload('product-images', 'product-image-upload', 'product-image-preview');

  // Populate flavors
  if (product && product.flavors && product.flavors.length > 0) {
    product.flavors.forEach(f => addFlavorRow(f.flavor_name, f.color_code));
  } else if (!product) {
    addFlavorRow('', '#10b981');
  }

  // Update live badge simulation preview
  updateLiveBadgePreview();

  // Focus product name
  requestAnimationFrame(() => {
    document.getElementById('product-name')?.focus();
  });
}

function hideProductForm() {
  const container = document.getElementById('product-form-container');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
  newProductFiles = [];
  const card = document.querySelector('.admin-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addSpecRow() {
  const container = document.getElementById('specs-rows');
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `
    <input type="text" placeholder="Spec name (e.g., Protein per serving)">
    <input type="text" placeholder="Value (e.g., 22g)">
    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(row);
}

// ===== PRO FLAVOR COLOR SUITE =====
const FLAVOR_COLOR_PRESETS = [
  { name: 'Lime', color: '#84cc16' },
  { name: 'Lemon', color: '#eab308' },
  { name: 'Mango', color: '#f97316' },
  { name: 'Watermelon', color: '#ef4444' },
  { name: 'Strawberry', color: '#ec4899' },
  { name: 'Berry Grape', color: '#a855f7' },
  { name: 'Blue Razz', color: '#06b6d4' },
  { name: 'Mint Ice', color: '#14b8a6' },
  { name: 'Chocolate', color: '#78350f' },
  { name: 'Vanilla Cream', color: '#fef08a' },
  { name: 'Unflavoured', color: '#94a3b8' },
  { name: 'Pure White', color: '#ffffff' }
];

function addFlavorRow(flavorName = '', colorCode = '#ffffff') {
  const container = document.getElementById('flavors-rows');
  if (!container) return;
  const count = container.querySelectorAll('.flavor-edit-row').length + 1;
  const row = document.createElement('div');
  row.className = 'flavor-edit-row';

  const presetsHtml = FLAVOR_COLOR_PRESETS.map(p => `
    <button type="button" class="palette-dot-btn" style="background:${p.color};" title="${p.name} (${p.color})"
            onclick="setFlavorRowColor(this, '${p.color}')"></button>
  `).join('');

  row.innerHTML = `
    <div class="flavor-row-main">
      <span class="flavor-row-index">#${count}</span>
      <input type="text" class="flavor-name-input" placeholder="Flavor name (e.g. Ice Tea Lime, Pineapple)" value="${escHTML(flavorName)}" oninput="updateFlavorPreview(this)">
      
      <div class="flavor-color-picker-wrap">
        <input type="color" class="flavor-color-picker" value="${colorCode || '#ffffff'}" title="Pick custom color wheel" oninput="syncFlavorColor(this, 'picker')">
        <input type="text" class="flavor-hex-input" maxlength="7" value="${colorCode || '#ffffff'}" placeholder="#FFFFFF" oninput="syncFlavorColor(this, 'hex')">
      </div>

      <div class="flavor-preview-pill">
        <span class="flavor-pill-dot" style="background:${colorCode || '#ffffff'};"></span>
        <span class="flavor-pill-text">${escHTML(flavorName) || 'Flavor'}</span>
      </div>

      <button type="button" class="btn-remove-row" onclick="removeFlavorRow(this)" title="Remove Flavor"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="flavor-quick-palette">
      <span class="flavor-quick-label">Color Presets:</span>
      ${presetsHtml}
    </div>
  `;
  container.appendChild(row);
  reindexFlavorRows();
}

function removeFlavorRow(btn) {
  btn.closest('.flavor-edit-row').remove();
  reindexFlavorRows();
}

function reindexFlavorRows() {
  const container = document.getElementById('flavors-rows');
  if (!container) return;
  container.querySelectorAll('.flavor-edit-row').forEach((row, i) => {
    let badge = row.querySelector('.flavor-row-index');
    if (badge) badge.textContent = `#${i + 1}`;
  });
}

function setFlavorRowColor(btn, color) {
  const row = btn.closest('.flavor-edit-row');
  const picker = row.querySelector('.flavor-color-picker');
  const hex = row.querySelector('.flavor-hex-input');
  const dot = row.querySelector('.flavor-pill-dot');
  if (picker) picker.value = color;
  if (hex) hex.value = color.toUpperCase();
  if (dot) dot.style.background = color;
}

function syncFlavorColor(el, source) {
  const row = el.closest('.flavor-edit-row');
  const picker = row.querySelector('.flavor-color-picker');
  const hex = row.querySelector('.flavor-hex-input');
  const dot = row.querySelector('.flavor-pill-dot');
  let val = el.value.trim();

  if (source === 'picker') {
    if (hex) hex.value = val.toUpperCase();
    if (dot) dot.style.background = val;
  } else if (source === 'hex') {
    if (!val.startsWith('#') && val.length > 0) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      if (picker) picker.value = val;
      if (dot) dot.style.background = val;
    }
  }
}

function updateFlavorPreview(input) {
  const row = input.closest('.flavor-edit-row');
  const textEl = row.querySelector('.flavor-pill-text');
  if (textEl) {
    textEl.textContent = input.value.trim() || 'Flavor';
  }
}

// ===== BADGE CONTROLS & LIVE SIMULATION =====
function syncBadgeColor(val) {
  if (!val.startsWith('#') && val.length > 0) val = '#' + val;
  const picker = document.getElementById('product-badge-color');
  const hex = document.getElementById('product-badge-color-hex');
  const dot = document.getElementById('admin-live-badge-dot');
  const preview = document.getElementById('admin-live-badge-preview');

  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    if (picker) picker.value = val;
    if (hex) hex.value = val.toUpperCase();
    if (dot) dot.style.background = val;
    if (preview) {
      preview.style.borderColor = `${val}55`;
      preview.style.boxShadow = `0 4px 14px ${val}33`;
    }
  }
}

function setBadgePreset(color, defaultText) {
  const picker = document.getElementById('product-badge-color');
  const hex = document.getElementById('product-badge-color-hex');
  const textInput = document.getElementById('product-badge-text');
  const isNewCheck = document.getElementById('product-new');
  if (picker) picker.value = color;
  if (hex) hex.value = color.toUpperCase();
  if (isNewCheck) isNewCheck.checked = true;
  if (textInput && (!textInput.value || ['NEW', 'HOT', 'SALE', 'FRESH', 'LIMITED', 'STEALTH'].includes(textInput.value))) {
    textInput.value = defaultText;
  }
  updateLiveBadgePreview();
}

function updateLiveBadgePreview() {
  const isNew = document.getElementById('product-new')?.checked;
  const customText = document.getElementById('product-badge-text')?.value.trim();
  const color = document.getElementById('product-badge-color')?.value || '#10b981';
  const preview = document.getElementById('admin-live-badge-preview');
  const dot = document.getElementById('admin-live-badge-dot');
  const textEl = document.getElementById('admin-live-badge-text');

  const displayText = customText || (isNew ? 'NEW' : '');

  if (preview && textEl) {
    if (displayText) {
      preview.style.display = 'inline-flex';
      if (dot) dot.style.background = color;
      preview.style.borderColor = `${color}55`;
      preview.style.boxShadow = `0 4px 14px ${color}33`;
      textEl.textContent = displayText;
    } else {
      preview.style.display = 'none';
    }
  }
}

function reindexAllImageBadges() {
  const container = document.getElementById('product-image-preview');
  if (!container) return;
  container.querySelectorAll('.image-preview-item').forEach((item, i) => {
    let badge = item.querySelector('.image-order-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'image-order-badge';
      item.appendChild(badge);
    }
    badge.textContent = `#${i + 1}`;
  });
}

function removeExistingImage(btn, imgId) {
  const item = btn.closest('.image-preview-item');
  const wasPrimary = item && item.classList.contains('primary');
  item.remove();
  reindexAllImageBadges();

  if (wasPrimary) {
    const firstRemaining = document.querySelector('#product-image-preview .image-preview-item');
    if (firstRemaining) {
      firstRemaining.classList.add('primary');
      const badge = firstRemaining.querySelector('.primary-badge-btn');
      if (badge) {
        badge.outerHTML = `<span class="primary-badge-btn is-primary"><i class="fa-solid fa-star"></i> Primary</span>`;
      }
    }
  }
}

async function setPrimaryImage(productId, imageId, btn) {
  try {
    const res = await fetch(`/api/admin/products/${productId}/primary-image/${imageId}`, {
      method: 'PUT'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update primary image');

    const preview = document.getElementById('product-image-preview');
    if (preview) {
      preview.querySelectorAll('.image-preview-item').forEach(item => {
        item.classList.remove('primary');
        const oldBadge = item.querySelector('.primary-badge-btn');
        const thisId = item.dataset.id;
        if (oldBadge && thisId) {
          oldBadge.outerHTML = `<button type="button" class="primary-badge-btn set-primary" onclick="setPrimaryImage(${productId}, ${thisId}, this)"><i class="fa-regular fa-star"></i> Primary</button>`;
        }
      });
      const currentItem = btn.closest('.image-preview-item');
      if (currentItem) {
        currentItem.classList.add('primary');
        btn.outerHTML = `<span class="primary-badge-btn is-primary"><i class="fa-solid fa-star"></i> Primary</span>`;
      }
    }
    showAdminToast('Primary image updated!', 'success');
  } catch (err) {
    showAdminToast(err.message || 'Failed to update primary image', 'error');
  }
}

function removeNewProductImage(fileId, btn) {
  newProductFiles = newProductFiles.filter(item => item.id !== fileId);
  btn.closest('.image-preview-item').remove();
  reindexAllImageBadges();
}

async function saveProduct(e) {
  e.preventDefault();

  const id = document.getElementById('product-id').value;
  const formData = new FormData();

  formData.append('name', document.getElementById('product-name').value);
  formData.append('category_id', document.getElementById('product-category').value);
  formData.append('short_description', document.getElementById('product-short-desc').value);
  formData.append('description', document.getElementById('product-description').value);
  formData.append('weight', document.getElementById('product-weight').value);
  formData.append('servings', document.getElementById('product-servings').value);
  formData.append('sort_order', document.getElementById('product-order').value);
  formData.append('is_featured', document.getElementById('product-featured').checked ? '1' : '');
  formData.append('is_new', document.getElementById('product-new')?.checked ? '1' : '0');
  formData.append('badge_text', document.getElementById('product-badge-text')?.value.trim() || '');
  formData.append('badge_color', document.getElementById('product-badge-color')?.value.trim() || '');
  formData.append('ingredients', document.getElementById('product-ingredients').value);
  formData.append('usage_instructions', document.getElementById('product-usage').value);

  // Collect specs
  const specs = [];
  document.querySelectorAll('#specs-rows .dynamic-row').forEach(row => {
    const inputs = row.querySelectorAll('input[type="text"]');
    if (inputs[0].value && inputs[1].value) {
      specs.push({ name: inputs[0].value, value: inputs[1].value });
    }
  });
  formData.append('specs', JSON.stringify(specs));

  // Collect flavors in exact ordered sequence with custom colors
  const flavors = [];
  document.querySelectorAll('#flavors-rows .flavor-edit-row').forEach(row => {
    const nameInput = row.querySelector('.flavor-name-input');
    const hexInput = row.querySelector('.flavor-hex-input');
    const colorPicker = row.querySelector('.flavor-color-picker');
    const colorVal = (hexInput && hexInput.value.trim()) || (colorPicker && colorPicker.value) || '#ffffff';
    if (nameInput && nameInput.value.trim()) {
      flavors.push({ name: nameInput.value.trim(), color: colorVal });
    }
  });
  formData.append('flavors', JSON.stringify(flavors));

  // Collect new images in exact order
  if (newProductFiles.length > 0) {
    for (const item of newProductFiles) {
      if (item && item.file) {
        formData.append('images', item.file);
      }
    }
  } else {
    // Fallback to direct input files if any
    const fileInput = document.getElementById('product-images');
    if (fileInput && fileInput.files.length > 0) {
      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('images', fileInput.files[i]);
      }
    }
  }

  // Keep existing images
  if (id) {
    const keepIds = [];
    document.querySelectorAll('#product-image-preview .image-preview-item[data-id]').forEach(item => {
      keepIds.push(parseInt(item.dataset.id));
    });
    formData.append('keep_images', JSON.stringify(keepIds));
  }

  try {
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showAdminToast(id ? 'Product updated successfully!' : 'Product created successfully!', 'success');
    newProductFiles = [];
    hideProductForm();
    loadProductsPage(document.getElementById('admin-content'));
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    showAdminToast('Product deleted', 'success');
    loadProductsPage(document.getElementById('admin-content'));
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ===== SETTINGS PAGE =====
async function loadSettingsPage(container) {
  try {
    const settings = await fetchAPI('/api/settings');
    const authData = await fetchAPI('/api/admin/check');

    container.innerHTML = `
      <div class="admin-card" style="margin-bottom: 24px;">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Site Settings</h3>
        </div>
        <div style="padding: 24px;">
          <form id="settings-form" class="admin-form" onsubmit="saveSettings(event)">
            <div class="form-row">
              <div class="form-group">
                <label>Site Name</label>
                <input type="text" id="setting-site_name" value="${escHTML(settings.site_name || '')}">
              </div>
              <div class="form-group">
                <label>Tagline</label>
                <input type="text" id="setting-site_tagline" value="${escHTML(settings.site_tagline || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>Site Description</label>
              <textarea id="setting-site_description">${escHTML(settings.site_description || '')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Contact Email</label>
                <input type="email" id="setting-contact_email" value="${escHTML(settings.contact_email || '')}">
              </div>
              <div class="form-group">
                <label>Contact Phone</label>
                <input type="text" id="setting-contact_phone" value="${escHTML(settings.contact_phone || '')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Instagram URL</label>
                <input type="text" id="setting-instagram" value="${escHTML(settings.instagram || '')}">
              </div>
              <div class="form-group">
                <label>Facebook URL</label>
                <input type="text" id="setting-facebook" value="${escHTML(settings.facebook || '')}">
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--admin-border);">
              <button type="submit" class="btn-admin btn-admin-primary">Save Settings</button>
            </div>
          </form>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Change Password</h3>
        </div>
        <div style="padding: 24px;">
          <form id="password-form" class="admin-form" onsubmit="changePassword(event)">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" id="current-password" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" id="new-password" required minlength="4">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="confirm-password" required minlength="4">
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--admin-border);">
              <button type="submit" class="btn-admin btn-admin-primary">Change Password</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p>Failed to load settings</p>';
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const settings = {};
  document.querySelectorAll('[id^="setting-"]').forEach(input => {
    const key = input.id.replace('setting-', '');
    settings[key] = input.value;
  });

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to save');
    showAdminToast('Settings saved!', 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function changePassword(e) {
  e.preventDefault();
  const current = document.getElementById('current-password').value;
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  if (newPass !== confirm) {
    showAdminToast('Passwords do not match', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showAdminToast('Password changed!', 'success');
    document.getElementById('password-form').reset();
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ===== IMAGE UPLOAD HELPERS =====
function setupImageUpload(inputId, areaId, previewId) {
  const input = document.getElementById(inputId);
  const area = document.getElementById(areaId);
  const preview = document.getElementById(previewId);
  if (!input || !area) return;

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      input.files = e.dataTransfer.files;
      showImagePreviews(input.files, preview, false);
    }
  });

  input.addEventListener('change', () => {
    showImagePreviews(input.files, preview, false);
  });
}

function setupMultiImageUpload(inputId, areaId, previewId) {
  const input = document.getElementById(inputId);
  const area = document.getElementById(areaId);
  const preview = document.getElementById(previewId);
  if (!input || !area) return;

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleNewMultiFiles(e.dataTransfer.files, preview);
    }
  });

  input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) {
      handleNewMultiFiles(input.files, preview);
      input.value = ''; // Reset so user can click and select more images without restriction
    }
  });
}

function handleNewMultiFiles(files, preview) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const fileId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    newProductFiles.push({ id: fileId, file: file });

    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'image-preview-item';
      div.dataset.fileId = fileId;
      div.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <span class="image-order-badge"></span>
        <button type="button" class="image-preview-remove" onclick="removeNewProductImage('${fileId}', this)"><i class="fa-solid fa-xmark"></i></button>
      `;
      preview.appendChild(div);
      reindexAllImageBadges();
    };
    reader.readAsDataURL(file);
  });
}

function showImagePreviews(files, container, append = false) {
  if (!append) container.innerHTML = '';
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'image-preview-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="image-preview-remove" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
      `;
      container.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// ===== UTILITY FUNCTIONS =====
async function fetchAPI(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) {
      if (!isLoginPage()) {
        window.location.href = '/admin/login.html';
      }
      return;
    }
    throw new Error('Request failed');
  }
  return res.json();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showAdminToast(message, type = 'success') {
  let toast = document.querySelector('.admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `admin-toast ${type}`;
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
