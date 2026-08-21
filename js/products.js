/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER (UPDATED & FIXED)
 * js/products.js
 * ============================================================================
 */

"use strict";

(() => {

  /* ==========================================================================
     1. CONFIGURATION
     ========================================================================== */

  const CONFIG = {
    API_BASE:
      "https://prasun-shop-api.prasun301.workers.dev",

    PRODUCTS_ENDPOINT:
      "/api/products",

    PRODUCT_PAGE:
      "/product.html",

    PLACEHOLDER_IMAGE:
      "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&auto=format&fit=crop",

    REQUEST_TIMEOUT:
      15000,

    DEBOUNCE_DELAY:
      400
  };

  const CATEGORY_MAP = [
    { label: "All Items", query: "" },
    { label: "Solar Lights", query: "solar light" },
    { label: "Consumer Electronics", query: "consumer electronics" },
    { label: "Wireless Chargers", query: "wireless charger" },
    { label: "Smart Home", query: "smart home led" }
  ];


  /* ==========================================================================
     2. STATE
     ========================================================================== */

  const state = {
    products: [],
    filteredProducts: [],
    activeCategoryQuery: "",
    searchQuery: "",
    sortBy: "featured",
    loading: false
  };


  /* ==========================================================================
     3. DOM ELEMENTS & TIMERS
     ========================================================================== */

  const elements = {
    productList: null,
    resultsCount: null,
    searchInput: null,
    clearSearchBtn: null,
    sortSelect: null,
    categoriesNav: null,
    pageHeading: null,
    liveRegion: null
  };

  let searchDebounceTimer = null;


  /* ==========================================================================
     4. INITIALIZATION
     ========================================================================== */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDOMElements();

    // Read initial HTML select state if present
    const currentSelect = elements.sortSelect || document.getElementById("product-sort") || document.querySelector("select[name='sort']");
    if (currentSelect && currentSelect.value) {
      state.sortBy = currentSelect.value;
      console.log("[PRASUN SHOP] Initialized sort state from DOM:", state.sortBy);
    }

    bindEvents();
    renderCategoryPills();
    updateClearSearchButton();
    loadProducts();
  }


  /* ==========================================================================
     5. CACHE DOM
     ========================================================================== */

  function cacheDOMElements() {
    elements.productList = document.getElementById("product-list");
    elements.resultsCount = document.getElementById("results-count");
    elements.searchInput = document.getElementById("product-search");
    elements.clearSearchBtn = document.getElementById("clear-search");
    elements.sortSelect = document.getElementById("product-sort") || document.querySelector("select.product-sort");
    elements.categoriesNav = document.getElementById("products-categories");
    elements.pageHeading = document.getElementById("page-heading");
    elements.liveRegion = document.getElementById("aria-live-region");
  }


  /* ==========================================================================
     6. EVENTS (INCLUDES GLOBAL DELEGATION FALLBACK)
     ========================================================================== */

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", handleSearchInput);
      elements.searchInput.addEventListener("keydown", handleSearchKeydown);
    }

    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.addEventListener("click", clearSearch);
    }

    // Direct listener
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener("change", handleSortChange);
    }

    // Global Document Delegation fallback for dynamically inserted/re-rendered select inputs
    document.addEventListener("change", (e) => {
      if (e.target && (e.target.id === "product-sort" || e.target.classList.contains("product-sort") || e.target.name === "sort")) {
        handleSortChange(e);
      }
    });

    if (elements.categoriesNav) {
      elements.categoriesNav.addEventListener("click", handleCategoryClick);
    }

    if (elements.productList) {
      elements.productList.addEventListener("click", handleProductGridClick);
    }
  }

  function handleSortChange(e) {
    const val = e.target.value || "featured";
    state.sortBy = val;
    console.log("[PRASUN SHOP] Sort changed to:", state.sortBy);
    applyFiltersAndRender();
  }


  /* ==========================================================================
     7. LIVE SEARCH & DEBOUNCE
     ========================================================================== */

  function handleSearchInput(event) {
    state.searchQuery = event.target.value.trim();
    updateClearSearchButton();

    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      state.activeCategoryQuery = "";
      highlightActiveCategoryPill("");
      loadProducts(state.searchQuery);
    }, CONFIG.DEBOUNCE_DELAY);
  }

  function handleSearchKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      window.clearTimeout(searchDebounceTimer);
      state.activeCategoryQuery = "";
      highlightActiveCategoryPill("");
      loadProducts(state.searchQuery);
    }
  }

  function clearSearch() {
    if (elements.searchInput) {
      elements.searchInput.value = "";
      elements.searchInput.focus();
    }
    state.searchQuery = "";
    updateClearSearchButton();
    loadProducts(state.activeCategoryQuery || "");
  }

  function updateClearSearchButton() {
    if (!elements.clearSearchBtn) return;
    elements.clearSearchBtn.hidden = state.searchQuery.length === 0;
  }


  /* ==========================================================================
     8. FETCH PRODUCTS FROM CLOUDFLARE WORKER
     ========================================================================== */

  async function loadProducts(query = state.searchQuery || state.activeCategoryQuery) {
    state.loading = true;
    setLoadingState(true);
    showLoadingState();

    let apiUrl = `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;
    if (query && query.trim().length > 0) {
      apiUrl += `?q=${encodeURIComponent(query.trim())}`;
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        CONFIG.REQUEST_TIMEOUT
      );

      let response;
      try {
        response = await fetch(apiUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cache: "no-store",
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const data = await response.json();
      const rawProducts = extractProducts(data);

      state.products = rawProducts
        .map(normalizeProduct)
        .filter(product => product !== null && product.id);

      if (state.products.length === 0) {
        renderEmptyState(
          query
            ? `No available items found matching "${escapeHtml(query)}".`
            : "No active products available at the moment."
        );
        return;
      }

      updatePageHeading(query);
      applyFiltersAndRender();

    } catch (error) {
      console.error("[PRASUN SHOP] Product load error:", error);

      let message = error?.message || "Unable to load products. Please try again.";
      if (error?.name === "AbortError") {
        message = "The product request timed out. Please try again.";
      }

      renderErrorState(message);
    } finally {
      state.loading = false;
      setLoadingState(false);
    }
  }


  /* ==========================================================================
     9. EXTRACT & NORMALIZE PRODUCT PAYLOAD (ROBUST PRICE PARSING)
     ========================================================================== */

  function extractProducts(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.products)) return data.products;
    if (data.data && Array.isArray(data.data.list)) return data.data.list;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizeProduct(product) {
    if (!product || typeof product !== "object") return null;

    const id = String(
      product.id ??
      product.pid ??
      product.sku ??
      product._id ??
      ""
    ).trim();

    const name = String(
      product.name ??
      product.title ??
      product.productNameEn ??
      "Unnamed Product"
    ).trim();

    // Deep object check for nested price values like { price: { amount: 19.99 } }
    let rawPrice = product.price ?? product.sellPrice ?? product.unitPrice ?? product.cost ?? 0;
    if (typeof rawPrice === "object" && rawPrice !== null) {
      rawPrice = rawPrice.amount ?? rawPrice.value ?? rawPrice.raw ?? 0;
    }

    // Convert string currencies like "$19.99" to float 19.99
    let price = parseFloat(
      String(rawPrice).replace(/[^0-9.]/g, "")
    );
    if (isNaN(price)) price = 0;

    if (!id || !name) return null;

    const category = String(product.category || "General");
    const image = product.image || product.productImage || CONFIG.PLACEHOLDER_IMAGE;
    const rating = parseFloat(product.rating) || 4.8;

    return {
      ...product,
      id,
      pid: id,
      sku: String(product.sku || id),
      name,
      title: name,
      price: Number(price.toFixed(2)),
      category,
      image,
      rating: Number(Math.max(0, Math.min(5, rating)).toFixed(1))
    };
  }


  /* ==========================================================================
     10. CATEGORY PILLS RENDER & HANDLING
     ========================================================================== */

  function renderCategoryPills() {
    if (!elements.categoriesNav) return;

    elements.categoriesNav.innerHTML = CATEGORY_MAP.map(item => {
      const isActive = item.query === state.activeCategoryQuery;
      return `
        <button
          type="button"
          class="category-pill${isActive ? " active" : ""}"
          data-query="${escapeHtml(item.query)}"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          ${escapeHtml(item.label)}
        </button>
      `;
    }).join("");
  }

  function handleCategoryClick(event) {
    const button = event.target.closest(".category-pill");
    if (!button) return;

    const query = button.dataset.query ?? "";
    state.activeCategoryQuery = query;

    if (elements.searchInput) {
      elements.searchInput.value = "";
      state.searchQuery = "";
      updateClearSearchButton();
    }

    highlightActiveCategoryPill(query);
    loadProducts(query);
  }

  function highlightActiveCategoryPill(activeQuery) {
    if (!elements.categoriesNav) return;

    elements.categoriesNav
      .querySelectorAll(".category-pill")
      .forEach(pill => {
        const isMatch = pill.dataset.query === activeQuery;
        pill.classList.toggle("active", isMatch);
        pill.setAttribute("aria-pressed", isMatch ? "true" : "false");
      });
  }


  /* ==========================================================================
     11. PAGE HEADING & COMPREHENSIVE SORT COMPARISON
     ========================================================================== */

  function updatePageHeading(query) {
    if (!elements.pageHeading) return;

    if (!query) {
      elements.pageHeading.textContent = "Featured Products";
      return;
    }

    const matchedCategory = CATEGORY_MAP.find(cat => cat.query === query);
    if (matchedCategory && matchedCategory.label !== "All Items") {
      elements.pageHeading.textContent = matchedCategory.label;
    } else {
      elements.pageHeading.textContent = `Search: "${query}"`;
    }
  }

  function applyFiltersAndRender() {
    let result = [...state.products];

    result.sort(sortProducts);
    state.filteredProducts = result;

    renderProductGrid();
    updateResultsCount();
  }

  function sortProducts(a, b) {
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    const nameA = String(a.name || a.title || "");
    const nameB = String(b.name || b.title || "");
    const ratingA = Number(a.rating) || 0;
    const ratingB = Number(b.rating) || 0;

    // Normalize state key into lowercase alphanumeric string
    const key = String(state.sortBy || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    // 1. Low to High Price
    if (
      key.includes("lowtohigh") ||
      key.includes("pricelow") ||
      key.includes("lowhigh") ||
      key.includes("priceasc") ||
      key === "low" ||
      key === "asc" ||
      key === "lh" ||
      key === "1"
    ) {
      return priceA - priceB;
    }

    // 2. High to Low Price
    if (
      key.includes("hightolow") ||
      key.includes("pricehigh") ||
      key.includes("highlow") ||
      key.includes("pricedesc") ||
      key === "high" ||
      key === "desc" ||
      key === "hl" ||
      key === "2"
    ) {
      return priceB - priceA;
    }

    // 3. Alphabetical A to Z
    if (
      key.includes("atoz") ||
      key.includes("az") ||
      key.includes("nameaz") ||
      key.includes("titleasc") ||
      key === "nameasc"
    ) {
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    }

    // 4. Alphabetical Z to A
    if (
      key.includes("ztoa") ||
      key.includes("za") ||
      key.includes("nameza") ||
      key.includes("titledesc") ||
      key === "namedesc"
    ) {
      return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });
    }

    // 5. Rating High to Low
    if (key.includes("rating") || key.includes("toprated")) {
      return ratingB - ratingA;
    }

    // Default / Featured
    return 0;
  }


  /* ==========================================================================
     12. RENDER PRODUCT GRID & CARDS
     ========================================================================== */

  function renderProductGrid() {
    if (!elements.productList) return;

    if (state.filteredProducts.length === 0) {
      renderEmptyState("No products match your current criteria.");
      return;
    }

    elements.productList.innerHTML = state.filteredProducts
      .map(renderProductCard)
      .join("");

    setLoadingState(false);
  }

  function renderProductCard(product) {
    const safeId = escapeHtml(String(product.id));
    const title = escapeHtml(product.name || "Product");
    const category = escapeHtml(product.category || "General");
    const image = escapeHtml(product.image || CONFIG.PLACEHOLDER_IMAGE);
    const price = formatPrice(product.price);
    const rating = Number(product.rating) || 4.8;

    const localProductUrl = `${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(safeId)}`;

    return `
      <article class="product-card" data-product-id="${safeId}">

        <a class="product-card-image-wrap" href="${escapeHtml(localProductUrl)}">
          <span class="product-badge">${category}</span>
          <img
            src="${image}"
            alt="${title}"
            class="product-image"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${CONFIG.PLACEHOLDER_IMAGE}'"
          >
        </a>

        <div class="product-card-body">

          <h3 class="product-title">
            <a href="${escapeHtml(localProductUrl)}">${title}</a>
          </h3>

          <div class="product-rating" aria-label="Rating ${rating.toFixed(1)} out of 5">
            <span aria-hidden="true">★</span> ${rating.toFixed(1)}
          </div>

          <div class="product-card-footer">
            <div class="price-container">
              <span class="product-price">${escapeHtml(price)}</span>
            </div>

            <div class="product-actions-group">
              <a href="${escapeHtml(localProductUrl)}" class="btn-card btn-secondary">
                View Details
              </a>

              <button
                type="button"
                class="btn-card btn-primary btn-add-to-cart add-to-cart-btn"
                data-product-id="${safeId}"
                aria-label="Add ${title} to cart"
              >
                Add to Cart
              </button>
            </div>
          </div>

        </div>

      </article>
    `;
  }


  /* ==========================================================================
     13. ADD TO CART HANDLER
     ========================================================================== */

  function handleProductGridClick(event) {
    const button = event.target.closest(".add-to-cart-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const productId = button.dataset.productId;
    if (!productId) return;

    const product = state.products.find(item => String(item.id) === String(productId));
    if (!product) return;

    if (typeof window.addToCart === "function") {
      window.addToCart(product);
    } else {
      document.dispatchEvent(new CustomEvent("cart:add", { detail: product }));
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Added!";

    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = originalText;
    }, 1000);

    announceToScreenReader(`${product.name} added to cart.`);
  }


  /* ==========================================================================
     14. UI STATES & HELPERS
     ========================================================================== */

  function showLoadingState() {
    if (!elements.productList) return;
    elements.productList.innerHTML = `
      <div class="product-status-card products-empty" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <h3>Fetching available products...</h3>
        <p>Connecting to catalog...</p>
      </div>
    `;
    if (elements.resultsCount) elements.resultsCount.textContent = "Loading...";
  }

  function setLoadingState(isLoading) {
    if (!elements.productList) return;
    elements.productList.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function renderEmptyState(message) {
    if (!elements.productList) return;
    elements.productList.innerHTML = `
      <div class="product-status-card products-empty" role="status">
        <h3>No Products Found</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    if (elements.resultsCount) elements.resultsCount.textContent = "0 products found";
    setLoadingState(false);
  }

  function renderErrorState(message) {
    if (!elements.productList) return;
    elements.productList.innerHTML = `
      <div class="product-status-card products-error" role="alert">
        <h3>Unable to Load Products</h3>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="button" data-action="retry-products">Try Again</button>
      </div>
    `;
    if (elements.resultsCount) elements.resultsCount.textContent = "Error loading products";
    setLoadingState(false);

    const retryBtn = elements.productList.querySelector('[data-action="retry-products"]');
    if (retryBtn) {
      retryBtn.addEventListener("click", () => loadProducts(), { once: true });
    }
  }

  function updateResultsCount() {
    if (!elements.resultsCount) return;
    const count = state.filteredProducts.length;
    elements.resultsCount.textContent = `${count} ${count === 1 ? "product" : "products"} available`;
  }

  function formatPrice(amount) {
    const val = Number(amount);
    if (!Number.isFinite(val)) return "$0.00";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function announceToScreenReader(message) {
    if (!elements.liveRegion) return;
    elements.liveRegion.textContent = "";
    window.setTimeout(() => {
      elements.liveRegion.textContent = String(message || "");
    }, 30);
  }


  /* ==========================================================================
     15. EXPOSE GLOBAL API
     ========================================================================== */

  window.PrasunProducts = {
    reload: loadProducts,
    sort: (sortValue) => {
      state.sortBy = sortValue;
      applyFiltersAndRender();
    },
    getProducts: () => [...state.products],
    getFilteredProducts: () => [...state.filteredProducts],
    getProductById: id => state.products.find(p => String(p.id) === String(id)) || null
  };

})();/**
 * PRASUN SHOP Frontend - products.js
 * Architecture: Curated Snapshot Consumer
 */

const API_BASE = "https://prasun-shop-api.prasun301.workers.dev";
let allLoadedProducts = [];

// DOM Elements
const productGrid = document.getElementById("product-grid");
const categoryLinks = document.querySelectorAll(".category-link");
const searchInput = document.getElementById("search-input");
const loadingIndicator = document.getElementById("loading-indicator");

document.addEventListener("DOMContentLoaded", () => {
  initCatalog();
});

async function initCatalog() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/api/products`);
    const data = await response.json();

    if (!data.success) {
      if (data.code === "CATALOG_EMPTY") {
        renderError(`Store catalog is currently empty. Backend diagnostic: ${data.message}`);
      } else {
        renderError("Failed to load products from server.");
      }
      return;
    }

    allLoadedProducts = data.products || [];
    
    // Initial render - All Products
    renderProducts(allLoadedProducts, "All Products");
    setupEventListeners();

  } catch (error) {
    console.error("Catalog initialization error:", error);
    renderError("A network error occurred while loading the catalog.");
  } finally {
    showLoading(false);
  }
}

function setupEventListeners() {
  // Category clicks
  categoryLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Update active state
      categoryLinks.forEach(l => l.classList.remove("active"));
      e.target.classList.add("active");
      
      const selectedCategory = e.target.dataset.category; // e.g., "solar-lights", "all"
      const categoryName = e.target.innerText;
      
      filterByCategory(selectedCategory, categoryName);
    });
  });

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = allLoadedProducts.filter(p => 
        (p.productName || "").toLowerCase().includes(query) ||
        (p.categoryName || "").toLowerCase().includes(query)
      );
      renderProducts(filtered, query ? `Search results for "${query}"` : "All Products");
    });
  }
}

function filterByCategory(categoryId, categoryName) {
  if (categoryId === "all" || !categoryId) {
    renderProducts(allLoadedProducts, "All Products");
    return;
  }

  // The backend already categorized the products into p.storeCategories array
  const filtered = allLoadedProducts.filter(p => 
    p.storeCategories && p.storeCategories.includes(categoryId)
  );

  renderProducts(filtered, categoryName);
}

function renderProducts(productsArray, contextText = "") {
  if (!productGrid) return;

  productGrid.innerHTML = "";

  if (productsArray.length === 0) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <h3>No products found for ${contextText}</h3>
        <p>Please try a different category or search term.</p>
      </div>`;
    return;
  }

  productsArray.forEach(product => {
    const id = product.pid || product.id;
    const title = product.productName || "Unknown Product";
    const price = parseFloat(product.sellPrice || product.price || 0).toFixed(2);
    
    // Route image through our Worker proxy
    const rawImg = product.productImage || "";
    const imgUrl = rawImg ? `${API_BASE}/api/image-proxy?url=${encodeURIComponent(rawImg)}` : "/placeholder.png";

    const card = document.createElement("div");
    card.className = "product-card";
    
    // Sanitize title for HTML insertion
    const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${imgUrl}" alt="${safeTitle}" loading="lazy" />
      </div>
      <div class="product-info">
        <h4 class="product-title" title="${safeTitle}">${safeTitle}</h4>
        <div class="product-price">$${price}</div>
        <button class="btn-add-cart" onclick="addToCart('${id}')">View Details</button>
      </div>
    `;
    
    productGrid.appendChild(card);
  });
}

function showLoading(isVisible) {
  if (loadingIndicator) {
    loadingIndicator.style.display = isVisible ? "block" : "none";
  }
}

function renderError(message) {
  if (productGrid) {
    productGrid.innerHTML = `<div class="error-state"><h3>Error</h3><p>${message}</p></div>`;
  }
}

// Keeping addToCart stub for existing integration
window.addToCart = window.addToCart || function(productId) {
  console.log("Existing addToCart logic triggered for:", productId);
  // Modal / order logic continues here
};
