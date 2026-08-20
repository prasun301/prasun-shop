/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * js/products.js
 * ============================================================================
 *
 * Sourced Storefront Product Manager with Live Worker Search API.
 *
 * Features:
 * - Live backend integration with Cloudflare Worker API (/api/products?q=...)
 * - Pre-configured targeted categories (Solar Lights, Consumer Electronics, etc.)
 * - Strict local store routing to prevent external CJ redirects (/product.html?id=...)
 * - Debounced input handling for smooth search queries (400ms)
 * - Sorting options (Price, Rating, Name)
 * - Fallback image handling and accessible screen reader notifications
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

  /* Preset category mapping for high-demand, active CJ niches */
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
    elements.sortSelect = document.getElementById("product-sort");
    elements.categoriesNav = document.getElementById("products-categories");
    elements.pageHeading = document.getElementById("page-heading");
    elements.liveRegion = document.getElementById("aria-live-region");
  }


  /* ==========================================================================
     6. EVENTS
     ========================================================================== */

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", handleSearchInput);
      elements.searchInput.addEventListener("keydown", handleSearchKeydown);
    }

    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.addEventListener("click", clearSearch);
    }

    if (elements.sortSelect) {
      elements.sortSelect.addEventListener("change", () => {
        state.sortBy = elements.sortSelect.value || "featured";
        applyFiltersAndRender();
      });
    }

    if (elements.categoriesNav) {
      elements.categoriesNav.addEventListener("click", handleCategoryClick);
    }

    if (elements.productList) {
      elements.productList.addEventListener("click", handleProductGridClick);
    }
  }


  /* ==========================================================================
     7. LIVE SEARCH & DEBOUNCE
     ========================================================================== */

  function handleSearchInput(event) {
    state.searchQuery = event.target.value.trim();
    updateClearSearchButton();

    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      // Direct text search overrides category pill selection
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

      /* Normalize & sanitize active products */
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
     9. EXTRACT & NORMALIZE PRODUCT PAYLOAD
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
      ""
    ).trim();

    const name = String(
      product.name ??
      product.title ??
      product.productNameEn ??
      ""
    ).trim();

    let price = Number.parseFloat(
      String(product.price ?? product.sellPrice ?? 0).replace(/[^0-9.-]/g, "")
    ) || 0;

    // Filter out invalid or missing data
    if (!id || !name || price <= 0) return null;

    const category = String(product.category || "General");
    const image = product.image || product.productImage || CONFIG.PLACEHOLDER_IMAGE;
    const rating = Number.parseFloat(product.rating) || 4.8;

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

    /* Clear standard text search input when picking a category pill */
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
     11. PAGE HEADING & SORTING
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
    switch (state.sortBy) {
      case "price-low":
        return Number(a.price) - Number(b.price);
      case "price-high":
        return Number(b.price) - Number(a.price);
      case "rating":
        return Number(b.rating) - Number(a.rating);
      case "name-az":
        return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
      case "featured":
      default:
        return 0;
    }
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

    /* Always route directly to local internal product page */
    const localProductUrl = `${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(safeId)}`;

    return `
      <article class="product-card" data-product-id="${safeId}">

        <a class="product-card-image" href="${escapeHtml(localProductUrl)}">
          <img
            src="${image}"
            alt="${title}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${CONFIG.PLACEHOLDER_IMAGE}'"
          >
        </a>

        <div class="product-card-body">

          <span class="product-category">${category}</span>

          <h3 class="product-title">
            <a href="${escapeHtml(localProductUrl)}">${title}</a>
          </h3>

          <div class="product-rating" aria-label="Rating ${rating.toFixed(1)} out of 5">
            <span aria-hidden="true">★</span> ${rating.toFixed(1)}
          </div>

          <div class="product-card-footer">
            <span class="product-price">${escapeHtml(price)}</span>

            <button
              type="button"
              class="button button-primary add-to-cart-btn"
              data-product-id="${safeId}"
              aria-label="Add ${title} to cart"
            >
              Add to Cart
            </button>
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
    getProducts: () => [...state.products],
    getFilteredProducts: () => [...state.filteredProducts],
    getProductById: id => state.products.find(p => String(p.id) === String(id)) || null
  };

})();
