/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * js/products.js
 * ============================================================================
 *
 * Standalone storefront product manager with Live CJ API Search.
 *
 * Features:
 * - Direct Cloudflare Worker API search (?q=keyword)
 * - Strict Active-Only Product Filtering (excludes delisted/removed supplier items)
 * - Internal Storefront Routing (routes directly to /product.html?id=...)
 * - Input debouncing (400ms)
 * - Fallback image handling & dynamic category pills
 * - Client-side sorting (Price, Rating, Name)
 * - Accessible live region updates & add-to-cart integration
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

    PLACEHOLDER_IMAGE:
      "/images/placeholder.webp",

    PRODUCT_PAGE:
      "/product.html",

    REQUEST_TIMEOUT:
      20000,

    DEBOUNCE_DELAY:
      400
  };


  /* ==========================================================================
     2. STATE
     ========================================================================== */

  const state = {
    products: [],
    filteredProducts: [],
    activeCategory: "all",
    searchQuery: "",
    sortBy: "featured",
    loading: false
  };


  /* ==========================================================================
     3. DOM & TIMERS
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
     7. LIVE SEARCH (DEBOUNCED API CALL)
     ========================================================================== */

  function handleSearchInput(event) {
    state.searchQuery = event.target.value.trim();
    updateClearSearchButton();

    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      loadProducts(state.searchQuery);
    }, CONFIG.DEBOUNCE_DELAY);
  }

  function handleSearchKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      window.clearTimeout(searchDebounceTimer);
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
    loadProducts("");
  }

  function updateClearSearchButton() {
    if (!elements.clearSearchBtn) return;
    elements.clearSearchBtn.hidden = state.searchQuery.length === 0;
  }


  /* ==========================================================================
     8. LOAD PRODUCTS (SERVER-SIDE API SEARCH)
     ========================================================================== */

  async function loadProducts(query = state.searchQuery) {
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

      const responseText = await response.text();

      if (!response.ok) {
        let errorData = null;
        try { errorData = JSON.parse(responseText); } catch { errorData = responseText; }
        throw new Error(getApiErrorMessage(response.status, errorData));
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error("The product server returned invalid JSON.");
      }

      const rawProducts = extractProducts(data);

      /* Normalizes & strictly filters for active, sellable products */
      state.products = rawProducts
        .map(normalizeProduct)
        .filter(product => product !== null && product.id);

      state.activeCategory = "all";

      if (state.products.length === 0) {
        renderEmptyState(
          query
            ? `No available products found matching "${escapeHtml(query)}".`
            : "No active products are currently available."
        );
        return;
      }

      renderCategoryPills();
      updatePageHeading();
      applyFiltersAndRender();

    } catch (error) {
      console.error("[PRASUN SHOP] Product loading failed:", error);

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
     9. EXTRACT PRODUCTS
     ========================================================================== */

  function extractProducts(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.products)) return data.products;
    if (data.data && Array.isArray(data.data.products)) return data.data.products;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }


  /* ==========================================================================
     10. API ERROR MESSAGE
     ========================================================================== */

  function getApiErrorMessage(status, data) {
    if (data && typeof data === "object") {
      if (data.message) return String(data.message);
      if (data.error) return String(data.error);
    }
    if (status === 404) return "Products API endpoint was not found.";
    if (status === 502) return "The product server returned a 502 error.";
    if (status === 503) return "The product server is temporarily unavailable.";
    return `Product server error (HTTP ${status}).`;
  }


  /* ==========================================================================
     11. NORMALIZE & FILTER ACTIVE PRODUCTS
     ========================================================================== */

  function normalizeProduct(product) {
    if (!product || typeof product !== "object") {
      return null;
    }

    /* 1. FILTER INACTIVE / DELISTED SUPPLIER STATUS */
    const status = String(
      product.productStatus ??
      product.status ??
      product.entryStatus ??
      product.listingStatus ??
      ""
    ).toLowerCase();

    if (
      status.includes("remove") ||
      status.includes("delist") ||
      status.includes("disable") ||
      status.includes("delete") ||
      status.includes("off") ||
      status === "0"
    ) {
      return null;
    }

    /* 2. VALIDATE PRODUCT ID */
    const id = String(
      product.id ??
      product.pid ??
      product.sku ??
      ""
    ).trim();

    if (!id) return null;

    /* 3. VALIDATE NAME */
    const name = String(
      product.name ??
      product.title ??
      product.productNameEn ??
      ""
    ).trim();

    if (!name) return null;

    /* 4. VALIDATE PRICE (> 0) */
    let price = Number.parseFloat(
      String(product.price ?? product.sellPrice ?? 0).replace(/[^0-9.-]/g, "")
    ) || 0;

    if (price <= 0) return null;

    const category = String(
      product.category ??
      product.categoryName ??
      "General"
    );

    const image = getProductImage(product);
    const rating = getProductRating(product);

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
      rating
    };
  }


  /* ==========================================================================
     12. IMAGE EXTRACTOR
     ========================================================================== */

  function getProductImage(product) {
    const candidates = [
      product.image,
      product.productImage,
      product.imageUrl,
      product.mainImage
    ];

    for (const img of candidates) {
      if (typeof img === "string" && img.trim()) {
        return img.trim();
      }
    }

    if (Array.isArray(product.images) && product.images[0]) {
      return String(product.images[0]);
    }

    return CONFIG.PLACEHOLDER_IMAGE;
  }


  /* ==========================================================================
     13. RATING EXTRACTOR
     ========================================================================== */

  function getProductRating(product) {
    let rating = Number.parseFloat(product.rating) || 4.8;
    return Number(Math.max(0, Math.min(5, rating)).toFixed(1));
  }


  /* ==========================================================================
     14. CATEGORY PILLS
     ========================================================================== */

  function renderCategoryPills() {
    if (!elements.categoriesNav) return;

    const categories = new Map();
    categories.set("all", "All");

    state.products.forEach(product => {
      const label = String(product.category || "General").trim();
      if (!label) return;

      const key = normalizeCategory(label);
      if (!categories.has(key)) {
        categories.set(key, label);
      }
    });

    elements.categoriesNav.innerHTML = Array.from(categories.entries())
      .map(([key, label]) => {
        const active = key === state.activeCategory;
        return `
          <button
            type="button"
            class="category-pill${active ? " active" : ""}"
            data-category="${escapeHtml(key)}"
            aria-pressed="${active ? "true" : "false"}"
          >
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join("");
  }


  /* ==========================================================================
     15. CATEGORY CLICK
     ========================================================================== */

  function handleCategoryClick(event) {
    const button = event.target.closest(".category-pill");
    if (!button) return;

    const category = button.dataset.category;
    if (!category) return;

    state.activeCategory = category;

    if (elements.categoriesNav) {
      elements.categoriesNav
        .querySelectorAll(".category-pill")
        .forEach(item => {
          const active = item.dataset.category === state.activeCategory;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    updatePageHeading();
    applyFiltersAndRender();
  }


  /* ==========================================================================
     16. PAGE HEADING
     ========================================================================== */

  function updatePageHeading() {
    if (!elements.pageHeading) return;

    if (state.searchQuery) {
      elements.pageHeading.textContent = `Search: "${state.searchQuery}"`;
      return;
    }

    if (state.activeCategory === "all") {
      elements.pageHeading.textContent = "All Products";
      return;
    }

    const product = state.products.find(
      item => normalizeCategory(item.category) === state.activeCategory
    );

    elements.pageHeading.textContent = product ? product.category : capitalize(state.activeCategory);
  }


  /* ==========================================================================
     17. FILTER & SORT
     ========================================================================== */

  function applyFiltersAndRender() {
    let result = [...state.products];

    if (state.activeCategory !== "all") {
      result = result.filter(
        product => normalizeCategory(product.category) === state.activeCategory
      );
    }

    result.sort(sortProducts);
    state.filteredProducts = result;

    renderProductGrid();
    updateResultsCount();
  }


  /* ==========================================================================
     18. SORTING LOGIC
     ========================================================================== */

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
     19. PRODUCT GRID RENDER
     ========================================================================== */

  function renderProductGrid() {
    if (!elements.productList) return;

    if (state.filteredProducts.length === 0) {
      renderEmptyState("No products match the selected category.");
      return;
    }

    elements.productList.innerHTML = state.filteredProducts
      .map(renderProductCard)
      .join("");

    setLoadingState(false);
  }


  /* ==========================================================================
     20. PRODUCT CARD TEMPLATE (INTERNAL STORE ROUTING ONLY)
     ========================================================================== */

  function renderProductCard(product) {
    const safeId = escapeHtml(String(product.id));
    const title = escapeHtml(product.name || "Product");
    const category = escapeHtml(product.category || "General");
    const image = escapeHtml(product.image || CONFIG.PLACEHOLDER_IMAGE);
    const price = formatPrice(product.price);
    const rating = Number(product.rating) || 0;

    /* Force internal product page routing to prevent external dead links */
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
     21. GRID CLICK & ADD TO CART
     ========================================================================== */

  function handleProductGridClick(event) {
    const button = event.target.closest(".add-to-cart-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const productId = button.dataset.productId;
    if (!productId) return;

    addProductToCart(productId, button);
  }

  function addProductToCart(productId, button) {
    const product = state.products.find(
      item => String(item.id) === String(productId)
    );

    if (!product) return;

    if (typeof window.addToCart === "function") {
      window.addToCart(product);
    } else {
      document.dispatchEvent(
        new CustomEvent("cart:add", { detail: product })
      );
    }

    if (button) {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Added";

      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 900);
    }

    announceToScreenReader(`${product.name} added to cart.`);
  }


  /* ==========================================================================
     22. UI STATES (LOADING, EMPTY, ERROR)
     ========================================================================== */

  function showLoadingState() {
    if (!elements.productList) return;

    elements.productList.innerHTML = `
      <div class="product-status-card products-empty" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <h3>Loading products...</h3>
        <p>Please wait while available products are retrieved.</p>
      </div>
    `;

    if (elements.resultsCount) {
      elements.resultsCount.textContent = "Searching catalog...";
    }
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

    if (elements.resultsCount) {
      elements.resultsCount.textContent = "0 products found";
    }

    setLoadingState(false);
    announceToScreenReader(message);
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

    if (elements.resultsCount) {
      elements.resultsCount.textContent = "Unable to load products";
    }

    setLoadingState(false);

    const retry = elements.productList.querySelector('[data-action="retry-products"]');
    if (retry) {
      retry.addEventListener("click", () => loadProducts(), { once: true });
    }
  }

  function updateResultsCount() {
    if (!elements.resultsCount) return;

    const count = state.filteredProducts.length;
    const text = `${count} ${count === 1 ? "product" : "products"} found`;

    elements.resultsCount.textContent = text;
    announceToScreenReader(text);
  }


  /* ==========================================================================
     23. UTILITIES
     ========================================================================== */

  function formatPrice(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return "$0.00";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  }

  function normalizeCategory(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function capitalize(value) {
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
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
     24. PUBLIC API
     ========================================================================== */

  window.PrasunProducts = {
    reload: loadProducts,
    getProducts: () => [...state.products],
    getFilteredProducts: () => [...state.filteredProducts],
    getProductById: id => state.products.find(product => String(product.id) === String(id)) || null,
    getApiBase: () => CONFIG.API_BASE
  };

})();
