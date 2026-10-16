/* ============================================================
   ISLAND NUTRITION - FRONTEND JAVASCRIPT
   ============================================================ */

// ===== THEME CONTROLLER =====
const THEME_STORAGE_KEY = 'in_theme';

function getCurrentTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
  }

  // Update theme toggle buttons and icons
  const isDark = theme === 'dark';
  const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.setAttribute('aria-label', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    btn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    const icon = btn.querySelector('.theme-toggle-icon');
    if (icon) {
      icon.innerHTML = isDark ? sunIcon : moonIcon;
    }
  });

  // Update dynamic theme logos
  const logoBlack = '/assets/images/island-logo-black.png';
  const logoWhite = '/assets/images/island-logo-white.png';

  document.querySelectorAll('.theme-logo').forEach(img => {
    if (img.classList.contains('logo-dark-variant')) {
      img.src = logoBlack;
    } else if (img.classList.contains('logo-white-variant')) {
      img.src = logoWhite;
    } else {
      img.src = isDark ? logoWhite : logoBlack;
    }
  });

  // Update mobile browser chrome status bar color
  try {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = isDark ? '#070709' : '#ffffff';
  } catch (e) {}
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

function initTheme() {
  const current = getCurrentTheme();
  applyTheme(current, false);

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.removeEventListener('click', toggleTheme);
    btn.addEventListener('click', toggleTheme);
  });
}

// Immediate initial run to prevent flash
try {
  applyTheme(getCurrentTheme(), false);
} catch (e) {}

// ===== NAVBAR =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initNavSearch();
  initScrollAnimations();
  initBackToTop();
});

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  // Scroll effect (throttled with rAF for 60fps scrolling)
  if (navbar) {
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        scrollTicking = true;
        window.requestAnimationFrame(() => {
          if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }
          scrollTicking = false;
        });
      }
    }, { passive: true });
    if (window.scrollY > 50) navbar.classList.add('scrolled');
  }

  // Mobile toggle
  if (navToggle && navLinks) {
    const toggleMenu = (open) => {
      const isOpen = open !== undefined ? open : !navLinks.classList.contains('open');
      navToggle.classList.toggle('active', isOpen);
      navLinks.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggleMenu(false);
      });
    });

    // Close on backdrop click (clicking empty space in fullscreen mobile nav)
    navLinks.addEventListener('click', (e) => {
      if (e.target === navLinks) {
        toggleMenu(false);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        toggleMenu(false);
      }
    });

    // Reset when resizing back to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992 && navLinks.classList.contains('open')) {
        toggleMenu(false);
      }
    });
  }

  // Active link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    }
  });
}

// ===== GLOBAL NAV SEARCH & MODAL =====
// ===== GLOBAL NAV SEARCH & SPOTLIGHT (ULTRA-CLEAN & LIGHTNING FAST) =====
let searchCatalog = [];
let searchCatalogLoaded = false;

async function preloadSearchCatalog() {
  if (searchCatalogLoaded) return;
  try {
    const data = await api('/api/products');
    if (Array.isArray(data)) {
      searchCatalog = data;
      searchCatalogLoaded = true;
    }
  } catch (e) {}
}

function initNavSearch() {
  // Preload products in background for 0ms instant search
  preloadSearchCatalog();

  let backdrop = document.querySelector('.search-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'search-modal-backdrop';
    backdrop.id = 'search-modal-backdrop';
    backdrop.innerHTML = `
      <div class="search-modal" role="dialog" aria-modal="true" aria-label="Search Supplements">
        <div class="search-modal-header">
          <i class="fa-solid fa-magnifying-glass search-modal-icon"></i>
          <input type="text" class="search-modal-input" id="nav-search-input" placeholder="Search supplements, categories, flavors..." autocomplete="off" spellcheck="false">
          <button type="button" class="search-modal-clear" id="nav-search-clear" aria-label="Clear query" style="display:none;"><i class="fa-solid fa-xmark"></i></button>
          <kbd class="search-kbd" id="nav-search-close" title="Close">ESC</kbd>
        </div>
        <div class="search-modal-body" id="nav-search-results"></div>
        <div class="search-modal-footer">
          <div class="search-footer-hints">
            <span><kbd class="search-kbd">↑</kbd><kbd class="search-kbd">↓</kbd> navigate</span>
            <span><kbd class="search-kbd">↵</kbd> select</span>
            <span><kbd class="search-kbd">esc</kbd> close</span>
          </div>
          <a href="/products.html" class="search-footer-link" id="nav-search-view-all">All Products &rarr;</a>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
  }

  const input = document.getElementById('nav-search-input');
  const clearBtn = document.getElementById('nav-search-clear');
  const closeBtn = document.getElementById('nav-search-close');
  const resultsContainer = document.getElementById('nav-search-results');
  const viewAllLink = document.getElementById('nav-search-view-all');

  let selectedIndex = -1;

  function renderDefaultView() {
    selectedIndex = -1;
    const popularTags = ['Pre-Workout', 'Protein', 'Creatine', 'Mass Gainer', 'Vitamins'];
    const suggested = searchCatalog.slice(0, 4);

    let html = `
      <div class="search-section-header">Categories</div>
      <div class="search-tags-row">
        ${popularTags.map(t => `<button type="button" class="search-tag" data-search="${t}">${t}</button>`).join('')}
      </div>
    `;

    if (suggested.length > 0) {
      html += `<div class="search-section-header">Popular Products</div>`;
      html += suggested.map(p => renderProductRow(p)).join('');
    }

    resultsContainer.innerHTML = html;
  }

  function renderProductRow(p) {
    const img = p.primary_image ? `${p.primary_image}?v=4.0` : '/assets/images/island-logo-white.png';
    const spec = p.weight || (p.flavors && p.flavors[0] ? p.flavors[0].name : '');
    return `
      <a href="/product.html?id=${p.id}" class="search-result-row" data-id="${p.id}">
        <div class="search-row-thumb">
          <img src="${img}" alt="${p.name}" loading="lazy">
        </div>
        <div class="search-row-info">
          <div class="search-row-title">${p.name}</div>
          <div class="search-row-meta">
            <span class="search-row-badge">${p.category_name || 'Supplement'}</span>
            ${spec ? `<span>${spec}</span>` : ''}
          </div>
        </div>
        <i class="fa-solid fa-arrow-right search-row-arrow"></i>
      </a>
    `;
  }

  function openSearch(initialQuery = '') {
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    preloadSearchCatalog().then(() => {
      if (initialQuery) {
        input.value = initialQuery;
        if (clearBtn) clearBtn.style.display = 'flex';
        executeSearch(initialQuery);
      } else {
        input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        renderDefaultView();
      }
    });
    setTimeout(() => input.focus(), 30);
  }

  function closeSearch() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  function openSearchBtnHandler(e) {
    e.preventDefault();
    openSearch();
  }

  // Attach search triggers
  document.querySelectorAll('.nav-search-btn').forEach(btn => {
    btn.removeEventListener('click', openSearchBtnHandler);
    btn.addEventListener('click', openSearchBtnHandler);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSearch();
  });

  // Hotkeys (Cmd+K / Ctrl+K, Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop.classList.contains('open')) closeSearch();
      else openSearch();
    } else if (e.key === 'Escape' && backdrop.classList.contains('open')) {
      closeSearch();
    }
  });

  // Clear query
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
      renderDefaultView();
    });
  }

  // Delegated click for tags
  resultsContainer.addEventListener('click', (e) => {
    const tag = e.target.closest('.search-tag');
    if (tag) {
      const q = tag.getAttribute('data-search');
      input.value = q;
      if (clearBtn) clearBtn.style.display = 'flex';
      input.focus();
      executeSearch(q);
    }
  });

  // Instant 0ms In-Memory Search
  function executeSearch(query) {
    selectedIndex = -1;
    const q = query.trim().toLowerCase();
    if (!q) {
      renderDefaultView();
      if (viewAllLink) viewAllLink.href = '/products.html';
      return;
    }

    if (viewAllLink) viewAllLink.href = `/products.html?search=${encodeURIComponent(query.trim())}`;

    // 0ms Filter
    const matches = searchCatalog.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category_name || '').toLowerCase();
      const flv = (p.flavor_names || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || flv.includes(q) || desc.includes(q);
    });

    if (matches.length === 0) {
      const safeQuery = query.replace(/[&<>"']/g, '');
      resultsContainer.innerHTML = `
        <div class="search-empty-state">
          No products found for "<strong>${safeQuery}</strong>"
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="search-section-header">${matches.length} Results</div>
      ${matches.slice(0, 7).map(p => renderProductRow(p)).join('')}
    `;
  }

  // Keystroke listener — 0ms INSTANT filtering as user types
  input.addEventListener('input', (e) => {
    const q = e.target.value;
    if (clearBtn) clearBtn.style.display = q.length > 0 ? 'flex' : 'none';
    executeSearch(q);
  });

  // Keyboard navigation (Up, Down, Enter)
  input.addEventListener('keydown', (e) => {
    const rows = resultsContainer.querySelectorAll('.search-result-row');
    if (!rows.length) {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        window.location.href = q ? `/products.html?search=${encodeURIComponent(q)}` : '/products.html';
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % rows.length;
      updateRowHighlight(rows);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + rows.length) % rows.length;
      updateRowHighlight(rows);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && rows[selectedIndex]) {
        rows[selectedIndex].click();
      } else {
        const q = input.value.trim();
        window.location.href = q ? `/products.html?search=${encodeURIComponent(q)}` : '/products.html';
      }
    }
  });

  function updateRowHighlight(rows) {
    rows.forEach((row, idx) => {
      if (idx === selectedIndex) {
        row.classList.add('selected');
        row.scrollIntoView({ block: 'nearest' });
      } else {
        row.classList.remove('selected');
      }
    });
  }
}

// ===== SCROLL ANIMATIONS (High Performance Singleton Observer) =====
let scrollObserver = null;
function initScrollAnimations() {
  if (!scrollObserver) {
    scrollObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          obs.unobserve(entry.target); // Unobserve once animated - saves CPU and battery on mobile
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  }

  document.querySelectorAll('.animate-on-scroll:not(.animated)').forEach(el => {
    if (el.closest('.carousel-track') || el.closest('.carousel-viewport')) {
      el.classList.add('animated');
      return;
    }
    scrollObserver.observe(el);
  });
}

// ===== BACK TO TOP =====
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  let bttTicking = false;
  window.addEventListener('scroll', () => {
    if (!bttTicking) {
      bttTicking = true;
      window.requestAnimationFrame(() => {
        if (window.scrollY > 500) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        bttTicking = false;
      });
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== SERVINGS / COUNT FORMATTER =====
function formatServings(servings) {
  if (!servings) return '';
  const s = String(servings).trim();
  if (/capsule|tablet|softgel|serving/i.test(s)) {
    return s;
  }
  return `${s} Servings`;
}

// ===== API HELPER (High-Performance In-Memory + SessionStorage Cache) =====
const _apiCache = new Map();
const SESSION_CACHE_PREFIX = 'in_cache_';
const SESSION_CACHE_TTL = 120000; // 2 minutes

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    // 1. Check in-memory Map
    if (_apiCache.has(url)) {
      return _apiCache.get(url);
    }
    // 2. Check sessionStorage (cross-page navigation)
    try {
      const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + url);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.ts < SESSION_CACHE_TTL) {
          _apiCache.set(url, parsed.data);
          return parsed.data;
        }
      }
    } catch (e) {}
  }

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (method === 'GET') {
      _apiCache.set(url, data);
      try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + url, JSON.stringify({ ts: Date.now(), data }));
      } catch (e) {}
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Helper: Detect heavy mass gainers / high-capacity buckets (4000g, 4kg, >=3000g, Mass Gainers)
function isHeavyProduct(product) {
  if (!product) return false;
  // If it's capsules/tablets/softgels, it's not a heavy mass gainer
  if (/capsule|tablet|softgel|caps|pill/i.test(product.weight || '')) return false;
  const weightStr = String(product.weight || '').toLowerCase();
  const weightMatch = weightStr.match(/(\d+(?:\.\d+)?)\s*(g|kg)?/);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const unit = weightMatch[2] || 'g';
    const grams = unit === 'kg' ? val * 1000 : (unit === 'g' ? val : 0);
    if (grams >= 3000) return true;
  }
  const nameStr = String(product.name || '').toLowerCase();
  const catStr = String(product.category_name || '').toLowerCase();
  if (nameStr.includes('gainer') || catStr.includes('mass') || catStr.includes('gainer')) {
    return true;
  }
  return false;
}

// ===== UNIFIED PRODUCT CARD GENERATOR (Dual-Sided Badges, Dynamic Popover, Max Image Size) =====
function renderProductCardHtml(product, i = 0, options = {}) {
  // Extract flavors array
  const flavorsList = Array.isArray(product.flavors) && product.flavors.length > 0
    ? product.flavors
    : (product.flavor_name ? [{ flavor_name: product.flavor_name, color_code: product.flavor_color || '#ffffff' }] : []);

  const flavorCount = flavorsList.length || product.flavor_count || 0;

  // Check if explicitly unflavoured product
  const isUnflavored = /unflavour/i.test(product.name) ||
    (flavorsList.length === 1 && /unflavour/i.test(flavorsList[0].flavor_name));

  // 1. TOP-RIGHT BADGE: Identical to Flavor Badge, Customizable Color & Optional Text
  let topRightBadgeHtml = '';
  const isNew = Boolean(product.is_new === 1 || product.is_new === true || product.is_new === '1');
  const customBadgeText = product.badge_text ? product.badge_text.trim() : '';
  const badgeText = customBadgeText || (isNew ? 'NEW' : (product.is_featured ? 'Featured' : ''));

  if (badgeText) {
    const badgeDotColor = product.badge_color || (isNew ? '#10b981' : '#ffffff');
    const customStyle = product.badge_color ? `style="border-color:${product.badge_color}55; box-shadow:0 4px 14px ${product.badge_color}33;"` : '';

    topRightBadgeHtml = `
      <span class="product-custom-badge" ${customStyle}>
        <span class="badge-dot" style="background:${badgeDotColor};"></span>
        ${badgeText}
      </span>
    `;
  }

  // 2. TOP-LEFT BADGE: Clean Flavor Badge (Static Pill, No Dropdown)
  // ONLY render when the product genuinely has flavors
  let flavorBadgeHtml = '';
  if (flavorCount > 0) {
    let badgeLabel = '';
    let primaryDotColor = '#ffffff';

    if (isUnflavored) {
      badgeLabel = 'Unflavoured';
      primaryDotColor = (flavorsList[0] && flavorsList[0].color_code) ? flavorsList[0].color_code : '#94a3b8';
    } else if (flavorCount === 1) {
      badgeLabel = '1 Flavor';
      primaryDotColor = (flavorsList[0] && flavorsList[0].color_code) ? flavorsList[0].color_code : '#10b981';
    } else {
      badgeLabel = `${flavorCount} Flavors`;
      primaryDotColor = (flavorsList[0] && flavorsList[0].color_code) ? flavorsList[0].color_code : '#06d6a0';
    }

    flavorBadgeHtml = `
      <span class="product-flavor-badge">
        <span class="flavor-dot" style="background:${primaryDotColor};"></span>
        ${badgeLabel}
      </span>
    `;
  }

  // 3. Flavor Chips Below Description
  const flavorChipsHtml = flavorsList.length > 0 ? `
    <div class="product-card-flavors">
      ${flavorsList.slice(0, 4).map(f => `
        <span class="flavor-chip" title="${f.flavor_name}">
          <span class="flavor-dot" style="background:${f.color_code || '#ffffff'}"></span>
          <span class="flavor-chip-text">${f.flavor_name}</span>
        </span>
      `).join('')}
      ${flavorsList.length > 4 ? `<span class="flavor-chip-more">+${flavorsList.length - 4}</span>` : ''}
    </div>
  ` : '';

  const isHeavy = isHeavyProduct(product);
  const giantCardClass = isHeavy ? ' product-card--giant' : '';
  const giantImgClass = isHeavy ? ' product-img--giant' : '';
  const cardName = product.display_name || product.name;
  const flavorParam = product.flavor_index !== undefined ? `&flavor=${product.flavor_index}` : '';
  const animClass = `animate-on-scroll stagger-${(i % 12) + 1}`;

  return `
    <a href="/product.html?id=${product.id}${flavorParam}" class="product-card ${animClass}${giantCardClass}">
      ${topRightBadgeHtml}
      ${flavorBadgeHtml}
      <div class="product-card-image">
        ${product.primary_image
          ? `<img src="${product.primary_image}?v=4.0" alt="${cardName}" class="${giantImgClass}" loading="lazy">`
          : `<div class="no-image"><i class="fa-solid fa-box"></i></div>`
        }
      </div>
      <div class="product-card-info">
        ${product.category_name ? `<div class="product-card-category">${product.category_name}</div>` : ''}
        <div class="product-card-name">${cardName}</div>
        ${product.short_description ? `<div class="product-card-desc">${product.short_description}</div>` : ''}
        ${flavorChipsHtml}
        <div class="product-card-meta">
          ${product.weight ? `<span class="product-card-tag">${product.weight}</span>` : ''}
          ${product.servings ? `<span class="product-card-tag">${formatServings(product.servings)}</span>` : ''}
        </div>
      </div>
    </a>
  `;
}

// ===== ALL PRODUCTS PAGE (Consolidated Multi-Flavor Products & Category Filter Pills) =====
async function loadProductsPage() {
  const grid = document.getElementById('products-grid');
  const filtersContainer = document.getElementById('category-filters');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (!grid) return;

  try {
    grid.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"><div class="spinner"></div></div>';
    
    // Fetch products and categories in parallel
    const [products, categories] = await Promise.all([
      api('/api/products'),
      api('/api/categories')
    ]);

    // Initial state from URL parameters
    const params = new URLSearchParams(window.location.search);
    const initialCategory = params.get('category') || params.get('cat') || 'all';
    const initialSearch = params.get('search') || '';

    let activeCategory = initialCategory;
    let searchQuery = initialSearch;

    if (searchInput && initialSearch) {
      searchInput.value = initialSearch;
      if (searchClearBtn) searchClearBtn.style.display = 'flex';
    }

    // Render Category Filter Pills
    if (filtersContainer) {
      const pillsHtml = [
        `<button type="button" class="filter-pill ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
          All Products
        </button>`
      ];

      categories.forEach(cat => {
        const catProducts = products.filter(p => p.category_id === cat.id || p.category_slug === cat.slug);
        if (catProducts.length > 0) {
          const isActive = (activeCategory == cat.id || activeCategory === cat.slug);
          pillsHtml.push(`
            <button type="button" class="filter-pill ${isActive ? 'active' : ''}" data-category="${cat.id}" data-slug="${cat.slug || ''}">
              ${cat.name}
            </button>
          `);
        }
      });

      filtersContainer.innerHTML = pillsHtml.join('');

      // Add click handlers for filter pills
      filtersContainer.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeCategory = pill.getAttribute('data-category');
          filtersContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          renderFilteredGrid();
        });
      });
    }

    // Search bar listener with debounce
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          searchQuery = e.target.value.trim();
          if (searchClearBtn) {
            searchClearBtn.style.display = searchQuery.length > 0 ? 'flex' : 'none';
          }
          renderFilteredGrid();
        }, 150);
      });
    }

    if (searchClearBtn && searchInput) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        renderFilteredGrid();
      });
    }

    // Render Grid Function
    function renderFilteredGrid() {
      let filtered = products;

      // 1. Filter by Category
      if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category_id == activeCategory || p.category_slug === activeCategory);
      }

      // 2. Filter by Search Query
      if (searchQuery.length > 0) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => {
          const nameMatch = p.name && p.name.toLowerCase().includes(q);
          const catMatch = p.category_name && p.category_name.toLowerCase().includes(q);
          const descMatch = (p.short_description && p.short_description.toLowerCase().includes(q)) ||
                            (p.description && p.description.toLowerCase().includes(q));
          const flavorMatch = p.flavor_names && p.flavor_names.toLowerCase().includes(q);
          return nameMatch || catMatch || descMatch || flavorMatch;
        });
      }

      // 3. Update Title
      if (titleEl) {
        if (searchQuery.length > 0) {
          titleEl.textContent = 'SEARCH RESULTS';
        } else if (activeCategory === 'all') {
          titleEl.textContent = 'ALL PRODUCTS';
        } else {
          const selectedCat = categories.find(c => c.id == activeCategory || c.slug === activeCategory);
          titleEl.textContent = (selectedCat ? selectedCat.name : 'PRODUCTS').toUpperCase();
        }
      }

      if (subtitleEl) {
        if (searchQuery.length > 0) {
          subtitleEl.textContent = `Showing products matching "${searchQuery}"`;
        } else if (activeCategory !== 'all') {
          const selectedCat = categories.find(c => c.id == activeCategory || c.slug === activeCategory);
          subtitleEl.textContent = selectedCat?.description || `Explore our quality ${selectedCat?.name || ''} collection`;
        } else {
          subtitleEl.textContent = 'Explore our complete range of quality supplements';
        }
      }

      // 4. Empty State
      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1">
            <div class="empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3>No Products Found</h3>
            <p>No products match your current selection ${searchQuery ? `for "${searchQuery}"` : ''}.</p>
            <button type="button" class="btn btn-secondary mt-6" id="reset-catalog-btn">
              <i class="fa-solid fa-rotate-left" style="margin-right:6px;"></i> Show All Products
            </button>
          </div>
        `;
        document.getElementById('reset-catalog-btn')?.addEventListener('click', () => {
          activeCategory = 'all';
          searchQuery = '';
          if (searchInput) searchInput.value = '';
          if (searchClearBtn) searchClearBtn.style.display = 'none';
          if (filtersContainer) {
            filtersContainer.querySelectorAll('.filter-pill').forEach(p => {
              p.classList.toggle('active', p.getAttribute('data-category') === 'all');
            });
          }
          renderFilteredGrid();
        });
        return;
      }

      // 5. Render Unified Product Cards
      grid.innerHTML = filtered.map((product, i) => renderProductCardHtml(product, i)).join('');

      initScrollAnimations();
    }

    // Initial render
    renderFilteredGrid();

  } catch (err) {
    console.error('Error loading products page:', err);
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Failed to load products. Please try refreshing.</p></div>';
  }
}

// ===== CATEGORIES PAGE =====
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    const categories = await api('/api/categories');

    if (categories.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1">
          <div class="empty-state-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
          <h3>No Categories Yet</h3>
          <p>Check back soon for our product lineup!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = categories.map((cat, i) => `
      <a href="/category.html?id=${cat.id}" class="category-card animate-on-scroll stagger-${(i % 10) + 1}">
        <div class="category-card-image">
          ${cat.preview_image || cat.image
            ? `<img src="${cat.preview_image || cat.image}?v=2.1" alt="${cat.name}" loading="lazy">`
            : `<div class="no-image"><i class="fa-solid fa-box"></i></div>`
          }
        </div>
        <div class="category-card-info">
          <div class="category-card-name">${cat.name}</div>
        </div>
      </a>
    `).join('');

    initScrollAnimations();
  } catch (err) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Failed to load categories</p></div>';
  }
}

// ===== CATEGORY PAGE (Products in category) =====
async function loadCategoryProducts() {
  const grid = document.getElementById('products-grid');
  const titleEl = document.getElementById('category-title');
  const breadcrumbName = document.getElementById('breadcrumb-category');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const categoryId = params.get('id');
  if (!categoryId) {
    window.location.href = '/products.html';
    return;
  }

  try {
    grid.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"><div class="spinner"></div></div>';
    const data = await api(`/api/categories/${categoryId}`);

    if (titleEl) titleEl.textContent = data.name;
    if (breadcrumbName) breadcrumbName.textContent = data.name;

    // Update page title
    document.title = `${data.name} - Island Nutrition`;

    if (!data.products || data.products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
          <h3>No Products Yet</h3>
          <p>Products in this category will appear here soon.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = data.products.map((product, i) => renderProductCardHtml(product, i)).join('');

    initScrollAnimations();
  } catch (err) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Failed to load products</p></div>';
  }
}

// ===== PRODUCT DETAIL PAGE =====
async function loadProductDetail() {
  const container = document.getElementById('product-detail');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id') || params.get('slug');
  if (!productId) {
    window.location.href = '/products.html';
    return;
  }

  try {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    const product = await api(`/api/products/${productId}`);

    document.title = `${product.name} - Island Nutrition`;

    const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];

    // Store image paths for flavor switcher (index-matched with flavors)
    window.__productImages = (product.images || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(img => `${img.image_path}?v=4.0`);

    container.innerHTML = `
      <div class="product-detail-grid">
        <!-- Gallery with Slideshow -->
        <div class="product-gallery">
          <div class="product-gallery-main">
            ${product.images && product.images.length > 1 ? `
              <button class="gallery-arrow gallery-arrow-left" onclick="galleryPrev()" aria-label="Previous image">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
            ` : ''}
            <img id="main-product-image"
              src="${primaryImage ? `${primaryImage.image_path}?v=4.0` : '/assets/images/island-logo-white.png'}"
              alt="${product.name}">
            ${product.images && product.images.length > 1 ? `
              <button class="gallery-arrow gallery-arrow-right" onclick="galleryNext()" aria-label="Next image">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
              <div class="gallery-counter">
                <span id="gallery-current">1</span> / <span id="gallery-total">${product.images.length}</span>
              </div>
            ` : ''}
          </div>
          ${product.images && product.images.length > 1 ? `
            <div class="product-gallery-thumbs">
              ${product.images.map((img, i) => `
                <div class="product-gallery-thumb ${i === 0 ? 'active' : ''}"
                     onclick="galleryGoTo(${i})">
                  <img src="${img.image_path}?v=4.0" alt="View ${i + 1}">
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Info -->
        <div class="product-info">
          <div class="product-breadcrumb">
            <a href="/">Home</a>
            <span class="separator">/</span>
            <a href="/products.html">Products</a>
            <span class="separator">/</span>
            <a href="/category.html?id=${product.category_id}">${product.category_name}</a>
            <span class="separator">/</span>
            <span>${product.name}</span>
          </div>

          <a href="/category.html?id=${product.category_id}" class="product-category-link">
            ${product.category_name}
          </a>

          <h1>${product.name}</h1>

          ${product.description ? `
            <p class="product-description">${product.description}</p>
          ` : ''}

          ${product.weight || product.servings ? `
            <div class="product-meta-grid">
              ${product.weight ? `
                <div class="product-meta-item">
                  <div class="product-meta-label">${/capsule|tablet|softgel|caps|pill/i.test(product.weight) ? 'Quantity / Form' : 'Net Weight'}</div>
                  <div class="product-meta-value">${product.weight}</div>
                </div>
              ` : ''}
              ${product.servings ? `
                <div class="product-meta-item">
                  <div class="product-meta-label">Servings</div>
                  <div class="product-meta-value">${formatServings(product.servings)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${product.flavors && product.flavors.length > 0 ? `
            <div class="product-flavors">
              <h3>${product.flavors.length === 1 ? 'Flavor' : 'Available Flavors'}</h3>
              <div class="flavor-tags">
                ${product.flavors.map((f, idx) => `
                  <span class="flavor-tag ${idx === 0 ? 'active' : ''}" onclick="switchFlavor(${idx}, this)"
                        style="cursor:pointer;" data-flavor-index="${idx}">
                    <span class="flavor-dot" style="background:${f.color_code || '#ffffff'}"></span>
                    ${f.flavor_name}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Tabs -->
          <div class="product-tabs">
            <div class="tab-header">
              ${product.specs && product.specs.length > 0 ? '<button class="tab-btn active" onclick="switchTab(\'specs\', this)">Specifications</button>' : ''}
              ${product.ingredients ? '<button class="tab-btn ${!product.specs || product.specs.length === 0 ? "active" : ""}" onclick="switchTab(\'ingredients\', this)">Ingredients</button>' : ''}
              ${product.usage_instructions ? '<button class="tab-btn" onclick="switchTab(\'usage\', this)">How to Use</button>' : ''}
            </div>

            ${product.specs && product.specs.length > 0 ? `
              <div class="tab-content active" id="tab-specs">
                <table class="specs-table">
                  ${product.specs.map(spec => `
                    <tr>
                      <td>${spec.spec_name}</td>
                      <td>${spec.spec_value}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}

            ${product.ingredients ? `
              <div class="tab-content ${!product.specs || product.specs.length === 0 ? 'active' : ''}" id="tab-ingredients">
                <div class="tab-text">${product.ingredients}</div>
              </div>
            ` : ''}

            ${product.usage_instructions ? `
              <div class="tab-content" id="tab-usage">
                <div class="tab-text">${product.usage_instructions}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${product.related && product.related.length > 0 ? `
        <div class="related-section">
          <div class="section-header">
            <span class="section-label">More Products</span>
            <h2 class="section-title">You May Also Like</h2>
          </div>
          <div class="products-grid">
            ${product.related.map((p, i) => renderProductCardHtml(p, i)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    initScrollAnimations();

    // If a flavor index or flavor name was passed, activate that exact flavor
    const flavorParam = params.get('flavor');
    if (flavorParam !== null && flavorParam !== undefined) {
      let targetIdx = parseInt(flavorParam, 10);
      if (isNaN(targetIdx) && product.flavors) {
        targetIdx = product.flavors.findIndex(f => f.flavor_name && f.flavor_name.toLowerCase() === flavorParam.toLowerCase().trim());
      }
      if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < (product.images || []).length) {
        if (targetIdx !== 0) {
          galleryGoTo(targetIdx);
          setTimeout(() => galleryGoTo(targetIdx), 150);
        } else {
          const thumbs = document.querySelectorAll('.product-gallery-thumb');
          thumbs.forEach((t, i) => t.classList.toggle('active', i === 0));
          const flavorTags = document.querySelectorAll('.flavor-tag');
          flavorTags.forEach((t, i) => t.classList.toggle('active', i === 0));
        }
      }
    }
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Product not found</p><a href="/products.html" class="btn btn-primary mt-8">Browse Products</a></div>';
  }
}

// ===== PRODUCT GALLERY SLIDESHOW =====
window.__galleryIndex = 0;

function galleryGoTo(index) {
  if (!window.__productImages || window.__productImages.length === 0) return;
  const total = window.__productImages.length;
  // Wrap around
  if (index < 0) index = total - 1;
  if (index >= total) index = 0;
  window.__galleryIndex = index;

  // Switch main image with smooth fade
  const mainImg = document.getElementById('main-product-image');
  if (mainImg) {
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = window.__productImages[index];
      mainImg.style.opacity = '1';
    }, 200);
  }

  // Update active thumbnail
  const thumbs = document.querySelectorAll('.product-gallery-thumb');
  thumbs.forEach((t, i) => t.classList.toggle('active', i === index));

  // Update counter
  const counterEl = document.getElementById('gallery-current');
  if (counterEl) counterEl.textContent = index + 1;

  // Sync active flavor tag
  const flavorTags = document.querySelectorAll('.flavor-tag');
  flavorTags.forEach((t, i) => t.classList.toggle('active', i === index));
}

function galleryPrev() {
  galleryGoTo(window.__galleryIndex - 1);
}

function galleryNext() {
  galleryGoTo(window.__galleryIndex + 1);
}

// Legacy image switcher (for direct calls)
function switchImage(src, thumb) {
  const idx = window.__productImages ? window.__productImages.indexOf(src) : -1;
  if (idx >= 0) {
    galleryGoTo(idx);
  } else {
    const mainImg = document.getElementById('main-product-image');
    if (mainImg) {
      mainImg.style.opacity = '0';
      setTimeout(() => { mainImg.src = src; mainImg.style.opacity = '1'; }, 200);
    }
  }
}

// Flavor switcher — links flavor[index] to image[index]
function switchFlavor(index, flavorEl) {
  galleryGoTo(index);
}

// Tab switcher
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ===== FEATURED CAROUSEL SLIDERS (Home Page) =====
function setupCarousel(viewportId, trackId, prevBtnId, nextBtnId, dotsId, autoInterval = 4000) {
  const viewport = document.getElementById(viewportId);
  const track = document.getElementById(trackId);
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);
  const dotsContainer = document.getElementById(dotsId);

  if (!viewport || !track) return;

  const items = track.children;
  if (!items || items.length <= 1) return;

  function getStep() {
    const firstItem = items[0];
    if (firstItem) {
      const style = window.getComputedStyle(track);
      const gap = parseFloat(style.gap) || 0;
      return (firstItem.offsetWidth + gap);
    }
    return viewport.clientWidth;
  }

  function scrollNext() {
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (viewport.scrollLeft >= maxScroll - 15) {
      viewport.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      viewport.scrollBy({ left: getStep(), behavior: 'smooth' });
    }
  }

  function scrollPrev() {
    if (viewport.scrollLeft <= 15) {
      viewport.scrollTo({ left: viewport.scrollWidth - viewport.clientWidth, behavior: 'smooth' });
    } else {
      viewport.scrollBy({ left: -getStep(), behavior: 'smooth' });
    }
  }

  if (nextBtn) nextBtn.addEventListener('click', scrollNext);
  if (prevBtn) prevBtn.addEventListener('click', scrollPrev);

  // Dynamic Pagination Dots
  function updateDots() {
    if (!dotsContainer) return;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (maxScroll <= 0) {
      dotsContainer.innerHTML = '';
      return;
    }
    const isSingleCard = window.innerWidth <= 768;
    const step = Math.max(1, getStep());
    const pageCount = isSingleCard 
      ? Math.min(items.length, 8) 
      : Math.max(2, Math.ceil(viewport.scrollWidth / (viewport.clientWidth * 0.8)));

    if (dotsContainer.children.length !== pageCount) {
      dotsContainer.innerHTML = Array.from({ length: pageCount }, (_, i) => 
        `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-page="${i}" aria-label="Page ${i + 1}"></button>`
      ).join('');

      dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const page = parseInt(dot.getAttribute('data-page'), 10);
          const target = isSingleCard ? (step * page) : ((maxScroll / (pageCount - 1)) * page);
          viewport.scrollTo({ left: target, behavior: 'smooth' });
        });
      });
    }

    const activeIndex = isSingleCard
      ? Math.min(pageCount - 1, Math.max(0, Math.round(viewport.scrollLeft / step)))
      : Math.min(pageCount - 1, Math.max(0, Math.round((viewport.scrollLeft / maxScroll) * (pageCount - 1))));

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === activeIndex);
    });
  }

  let dotsTicking = false;
  viewport.addEventListener('scroll', () => {
    if (!dotsTicking) {
      dotsTicking = true;
      window.requestAnimationFrame(() => {
        updateDots();
        dotsTicking = false;
      });
    }
  }, { passive: true });

  setTimeout(updateDots, 350);
  window.addEventListener('resize', updateDots);

  // Mouse Drag Support
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let hasMoved = false;

  viewport.addEventListener('mousedown', (e) => {
    isDown = true;
    hasMoved = false;
    startX = e.pageX - viewport.offsetLeft;
    scrollLeft = viewport.scrollLeft;
  });

  viewport.addEventListener('mouseleave', () => { isDown = false; });
  viewport.addEventListener('mouseup', () => { isDown = false; });

  viewport.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - viewport.offsetLeft;
    const walk = (x - startX) * 1.4;
    if (Math.abs(walk) > 6) hasMoved = true;
    viewport.scrollLeft = scrollLeft - walk;
  });

  // Prevent accidental link click when dragging
  track.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Autoplay with Hover Pause (Desktop only - disabled on mobile to prevent scroll hijacking)
  let timer = null;
  function startAutoplay() {
    if (autoInterval <= 0 || window.innerWidth <= 768) return;
    stopAutoplay();
    timer = setInterval(scrollNext, autoInterval);
  }

  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  viewport.addEventListener('mouseenter', stopAutoplay);
  viewport.addEventListener('mouseleave', startAutoplay);
  viewport.addEventListener('touchstart', stopAutoplay, { passive: true });
  viewport.addEventListener('touchend', startAutoplay, { passive: true });

  startAutoplay();
}

async function loadFeaturedCategories() {
  const track = document.getElementById('featured-categories');
  if (!track) return;

  try {
    const categories = await api('/api/categories');
    if (!categories || categories.length === 0) return;

    track.innerHTML = categories.map((cat, i) => `
      <a href="/category.html?id=${cat.id}" class="category-card" style="opacity:1 !important; transform:none !important; visibility:visible !important;">
        <div class="category-card-image">
          ${cat.preview_image || cat.image
            ? `<img src="${cat.preview_image || cat.image}?v=2.3" alt="${cat.name}" loading="lazy">`
            : `<div class="no-image"><i class="fa-solid fa-box"></i></div>`
          }
        </div>
        <div class="category-card-info">
          <div class="category-card-name">${cat.name}</div>
        </div>
      </a>
    `).join('');

    setupCarousel('categories-viewport', 'featured-categories', 'cat-prev-btn', 'cat-next-btn', 'cat-carousel-dots', 3600);
  } catch (err) {
    console.error('Failed to load featured categories:', err);
  }
}

async function loadFeaturedProducts() {
  const track = document.getElementById('featured-products');
  if (!track) return;

  try {
    let products = await api('/api/products?featured=true');
    if (!products || products.length === 0) {
      products = await api('/api/products?limit=8');
    }
    if (!products || products.length === 0) return;

    // Place products with the NEW badge at the very front of featured products
    products.sort((a, b) => {
      const aIsNew = (a.is_new == 1 || a.is_new === true || a.is_new === '1' || (a.badge_text && a.badge_text.trim().toUpperCase() === 'NEW')) ? 1 : 0;
      const bIsNew = (b.is_new == 1 || b.is_new === true || b.is_new === '1' || (b.badge_text && b.badge_text.trim().toUpperCase() === 'NEW')) ? 1 : 0;
      if (aIsNew !== bIsNew) return bIsNew - aIsNew; // NEW products first!
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    renderProductCards(track, products);
    setupCarousel('products-viewport', 'featured-products', 'prod-prev-btn', 'prod-next-btn', 'prod-carousel-dots', 4200);
  } catch (err) {
    console.error('Failed to load featured products:', err);
  }
}

function renderProductCards(container, products) {
  container.innerHTML = products.map((product, i) => renderProductCardHtml(product, i)).join('');

  if (container.classList.contains('carousel-track') || container.closest('.carousel-viewport')) {
    container.querySelectorAll('.product-card').forEach(c => {
      c.classList.remove('animate-on-scroll');
      c.style.opacity = '1';
      c.style.transform = 'none';
      c.style.visibility = 'visible';
    });
  } else {
    initScrollAnimations();
  }
}

// ===== SEARCH =====
function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let timeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        searchProducts(query);
      } else if (query.length === 0) {
        loadCategories();
      }
    }, 300);
  });
}

async function searchProducts(query) {
  const grid = document.getElementById('categories-grid') || document.getElementById('products-grid');
  if (!grid) return;

  try {
    const products = await api(`/api/products?search=${encodeURIComponent(query)}`);

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <h3>No Results</h3>
          <p>No products found for "${query}"</p>
        </div>
      `;
      return;
    }

    // Switch grid to products layout
    grid.className = 'products-grid';
    renderProductCards(grid, products);
  } catch (err) {
    console.error('Search failed:', err);
  }
}

// ===== CONTACT & INQUIRY FORMS =====
function handleInquirySubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.inquiry-submit-btn') || form.querySelector('button[type="submit"]');
  const originalHtml = submitBtn ? submitBtn.innerHTML : '<span>SUBMIT</span>';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> SENDING...';
  }

  setTimeout(() => {
    showToast('Thank you! Your inquiry has been received. Our team will contact you shortly.', 'success');
    form.reset();
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:8px;"></i> SENT!';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }, 2200);
    }
  }, 500);
}

window.handleInquirySubmit = handleInquirySubmit;
window.handleContactSubmit = handleInquirySubmit;

function initContactForm() {
  const form = document.getElementById('contact-form') || document.getElementById('home-inquiry-form');
  if (!form) return;
  form.addEventListener('submit', handleInquirySubmit);
}

// ===== HELPER: Hex to RGBA =====
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(6, 214, 160, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(6, 214, 160, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ===== FLAGSHIP SHOWCASE HERO SLIDER =====
async function initHeroSlider() {
  const hero = document.getElementById('hero');
  const stage = document.getElementById('hero-stage');
  const productNameEl = document.getElementById('hero-product-name');
  if (!hero || !stage || !productNameEl) return;

  let products = [];
  try {
    const featured = await api('/api/products?featured=true');
    if (featured && featured.length > 0) {
      products = featured;
    } else {
      products = await api('/api/products?limit=6');
    }
  } catch (err) {
    console.error('Failed to load hero slider products:', err);
    return;
  }

  if (!products || products.length === 0) return;

  let currentIndex = 0;
  const slideDuration = 5500; // 5.5 seconds per slide
  let isPaused = false;
  let progressAnimationId = null;
  let startTime = Date.now();

  // Elements
  const titlePrefixEl = document.getElementById('hero-title-prefix');
  const badgeTextEl = document.getElementById('hero-badge-text');
  const badgeDotEl = document.getElementById('hero-badge-dot');
  const badgeEl = document.getElementById('hero-badge');
  const descEl = document.getElementById('hero-product-desc');
  const specsRowEl = document.getElementById('hero-specs-row');
  const primaryCta = document.getElementById('hero-primary-cta');
  const productImg = document.getElementById('hero-product-img');
  const productLink = document.getElementById('hero-product-link');
  const auraGlow = document.getElementById('hero-aura-glow');
  const backdropGlow = document.getElementById('hero-backdrop-glow');
  const chipTopText = document.getElementById('hero-chip-top-text');
  const chipBottomText = document.getElementById('hero-chip-bottom-text');
  const dotsContainer = document.getElementById('hero-slider-dots');
  const currSlideEl = document.getElementById('hero-curr-slide');
  const totalSlidesEl = document.getElementById('hero-total-slides');
  const progressBar = document.getElementById('hero-progress-bar');
  const prevBtn = document.getElementById('hero-prev-btn');
  const nextBtn = document.getElementById('hero-next-btn');

  if (totalSlidesEl) totalSlidesEl.textContent = String(products.length).padStart(2, '0');

  // Explore All Button Navigation
  const exploreBtn = document.getElementById('hero-explore-all-btn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/products.html';
    });
  }

  // Render Dots
  if (dotsContainer) {
    dotsContainer.innerHTML = products.map((_, i) => 
      `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`
    ).join('');

    const dots = dotsContainer.querySelectorAll('.hero-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.getAttribute('data-index'), 10);
        if (idx !== currentIndex) {
          goToSlide(idx);
        }
      });
    });
  }

  function getProductColor(p) {
    if (p.flavors && p.flavors.length > 0 && p.flavors[0].color_code) {
      const c = p.flavors[0].color_code;
      if (c === '#000000' || c === '#ffffff' || c === '#451a03' || c === '#78350f' || c === '#e2e8f0') return '#06d6a0';
      return c;
    }
    const catSlug = (p.category_slug || '').toLowerCase();
    if (catSlug.includes('pre-workout')) return '#84cc16';
    if (catSlug.includes('whey') || catSlug.includes('protein')) return '#06d6a0';
    if (catSlug.includes('mass') || catSlug.includes('gainer')) return '#f59e0b';
    if (catSlug.includes('creatine')) return '#f97316';
    if (catSlug.includes('amino')) return '#eab308';
    return '#06d6a0';
  }

  function renderSlide(index, isInitial = false) {
    const p = products[index];
    if (!p) return;

    const accentColor = getProductColor(p);

    function applySlideData() {
      // 1. Text & Category
      if (titlePrefixEl) titlePrefixEl.textContent = p.category_name ? p.category_name.toUpperCase() : 'QUALITY SUPPLEMENT';
      if (productNameEl) {
        productNameEl.textContent = p.name;
        const is2Line = (p.name && p.name.length > 22) || (p.name && p.name.includes('\n'));
        if (is2Line) {
          productNameEl.classList.add('hero-title-2line');
        } else {
          productNameEl.classList.remove('hero-title-2line');
        }
      }
      if (badgeTextEl) badgeTextEl.textContent = `${p.category_name || 'Flagship'} • ${p.badge_text || (p.is_new ? 'NEW RELEASE' : 'TOP RATED')}`;
      
      const cleanDesc = p.short_description || p.description || '';
      if (descEl) descEl.textContent = cleanDesc.length > 220 ? cleanDesc.substring(0, 217) + '...' : cleanDesc;

      // 2. Links - Target exact product and active flavor
      const activeFlavor = (p.flavors && p.flavors.length > 0) ? p.flavors[0].flavor_name : null;
      const flavorQuery = activeFlavor ? `&flavor=${encodeURIComponent(activeFlavor)}` : '';
      const targetUrl = `/product.html?id=${p.id}${flavorQuery}`;
      if (primaryCta) primaryCta.href = targetUrl;
      if (productLink) productLink.href = targetUrl;

      const chipTopEl = document.getElementById('hero-chip-top');
      const chipBottomEl = document.getElementById('hero-chip-bottom');
      if (chipTopEl) {
        chipTopEl.style.cursor = 'pointer';
        chipTopEl.onclick = () => { window.location.href = targetUrl; };
      }
      if (chipBottomEl) {
        chipBottomEl.style.cursor = 'pointer';
        chipBottomEl.onclick = () => { window.location.href = targetUrl; };
      }

      // 3. Product Image
      if (productImg && p.primary_image) {
        productImg.src = `${p.primary_image}?v=4.0`;
        productImg.alt = p.name;
        if (isHeavyProduct(p)) {
          productImg.classList.add('hero-img--giant');
        } else {
          productImg.classList.remove('hero-img--giant');
        }
      }

      // 4. Quick Specs
      if (specsRowEl) {
        const specItems = [];
        if (p.servings) {
          specItems.push(`<div class="hero-spec-pill"><i class="fa-solid fa-fire-flame-curved"></i> <span>${formatServings(p.servings)}</span></div>`);
        }
        if (p.weight) {
          const isPill = /capsule|tablet|softgel|caps|pill/i.test(p.weight);
          specItems.push(`<div class="hero-spec-pill"><i class="fa-solid ${isPill ? 'fa-pills' : 'fa-weight-scale'}"></i> <span>${p.weight}</span></div>`);
        }
        if (p.flavors && p.flavors.length > 0) {
          const flv = p.flavors[0];
          specItems.push(`
            <div class="hero-spec-pill flavor-spec">
              <span class="flavor-dot" style="background:${flv.color_code || accentColor};"></span>
              <span>${p.flavors.length > 1 ? p.flavors.length + ' Flavors' : flv.flavor_name}</span>
            </div>
          `);
        } else {
          specItems.push(`<div class="hero-spec-pill"><i class="fa-solid fa-award"></i> <span>Halal Suitable</span></div>`);
        }
        specsRowEl.innerHTML = specItems.join('');
      }

      // 5. Floating Chips
      if (chipTopText) {
        chipTopText.textContent = p.badge_text ? `${p.badge_text} Formula` : 'Swedish Quality';
      }
      if (chipBottomText) {
        if (p.flavors && p.flavors.length > 0) {
          chipBottomText.textContent = `${p.flavors[0].flavor_name}`;
        } else {
          chipBottomText.textContent = '100% Pure Potency';
        }
      }

      // 6. Dynamic Ambient Colors
      if (auraGlow) {
        auraGlow.style.background = `radial-gradient(circle, ${hexToRgba(accentColor, 0.35)} 0%, ${hexToRgba(accentColor, 0.08)} 55%, transparent 70%)`;
      }
      if (backdropGlow) {
        backdropGlow.style.background = `radial-gradient(circle, ${hexToRgba(accentColor, 0.22)} 0%, transparent 70%)`;
      }
      if (badgeEl) {
        badgeEl.style.borderColor = hexToRgba(accentColor, 0.45);
        badgeEl.style.boxShadow = `0 4px 16px ${hexToRgba(accentColor, 0.18)}`;
      }
      if (badgeDotEl) {
        badgeDotEl.style.background = accentColor;
        badgeDotEl.style.boxShadow = `0 0 10px ${accentColor}`;
      }

      // 7. Counter & Dots
      if (currSlideEl) currSlideEl.textContent = String(index + 1).padStart(2, '0');
      const dots = dotsContainer ? dotsContainer.querySelectorAll('.hero-dot') : [];
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === index);
      });
    }

    if (isInitial) {
      applySlideData();
      return;
    }

    // Animate Exit
    const animElements = [productNameEl, titlePrefixEl, descEl, specsRowEl, productImg];
    animElements.forEach(el => {
      if (el) el.classList.add('slide-exit');
    });

    setTimeout(() => {
      applySlideData();

      // Animate Enter
      animElements.forEach(el => {
        if (el) {
          el.classList.remove('slide-exit');
          el.classList.add('slide-enter');
        }
      });
    }, 180);
  }

  // High Performance CSS Transition Progress Bar (Zero CPU overhead on mobile)
  let slideTimer = null;
  function startProgressBar() {
    if (slideTimer) clearTimeout(slideTimer);
    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      // Force repaint to reset transition cleanly
      void progressBar.offsetWidth;
      if (!isPaused) {
        progressBar.style.transition = `width ${slideDuration}ms linear`;
        progressBar.style.width = '100%';
      }
    }
    if (!isPaused) {
      slideTimer = setTimeout(() => {
        nextSlide();
      }, slideDuration);
    }
  }

  // Preload next product image in background for instant transition
  function preloadNextSlide(idx) {
    const nextProd = products[(idx + 1) % products.length];
    if (nextProd && nextProd.primary_image) {
      const img = new Image();
      img.src = `${nextProd.primary_image}?v=4.0`;
    }
  }

  function goToSlide(index) {
    currentIndex = (index + products.length) % products.length;
    renderSlide(currentIndex);
    preloadNextSlide(currentIndex);
    startProgressBar();
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  if (nextBtn) nextBtn.addEventListener('click', nextSlide);
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);

  // Pause on hover
  hero.addEventListener('mouseenter', () => {
    isPaused = true;
    if (slideTimer) clearTimeout(slideTimer);
    if (progressBar) {
      const computed = window.getComputedStyle(progressBar);
      progressBar.style.transition = 'none';
      progressBar.style.width = computed.width;
    }
  });

  hero.addEventListener('mouseleave', () => {
    if (isPaused) {
      isPaused = false;
      startProgressBar();
    }
  });


  // Touch Swipe for Mobile
  let touchStartX = 0;
  let touchEndX = 0;
  hero.addEventListener('touchstart', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
      touchStartX = e.changedTouches[0].screenX;
    }
  }, { passive: true });

  hero.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40) {
        if (diff < 0) nextSlide();
        else prevSlide();
      }
    }
  }, { passive: true });

  // Initial Slide Render (instant without exit/enter animation flicker)
  renderSlide(0, true);
  preloadNextSlide(0);
  startProgressBar();
}
