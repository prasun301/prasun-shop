/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER (FULL UPDATED CODE)
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

    // Default fallback image if an item has no image or a broken link
    PLACEHOLDER_IMAGE:
      "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&auto=format&fit=crop",

    REQUEST_TIMEOUT:
      15000,

    DEBOUNCE_DELAY:
      300
  };

  const CATEGORY_MAP = [
    { label: "All Items", query: "" },
    { label: "Solar Lights", query: "solar light" },
    { label: "Consumer Electronics", query: "consumer electronics" },
    { label: "Wireless Chargers", query: "wireless charger" },
    { label: "Smart Home", query: "smart home led" }
  ];


  /* ==========================================================================
     2. STATE & REQUEST CONTROLLER
     ========================================================================== */

  const state = {
    products: [],
    filteredProducts: [],
    activeCategoryQuery: "",
    searchQuery: "",
    sortBy: "featured",
    loading: false
  };

  let activeFetchController = null;
  let searchDebounceTimer = null;


  /* ==========================================================================
     3. DOM ELEMENTS
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


  /* ==========================================================================
     4. INITIALIZATION (SAFE DOMREADY CHECK)
     ========================================================================== */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    cacheDOMElements();

    // Sync initial sort state from select input if present
    const currentSelect = getSortSelectElement();
    if (currentSelect && currentSelect.value) {
      state.sortBy = currentSelect.value;
    }

    bindEvents();
    renderCategoryPills();
    updateClearSearchButton();
    loadProducts();
  }


  /* ==========================================================================
     5. CACHE DOM ELEMENTS & GETTERS
     ========================================================================== */

  function cacheDOMElements() {
    elements.productList = document.getElementById("product-list");
    elements.resultsCount = document.getElementById("results-count");
    elements.searchInput = document.getElementById("product-search");
    elements.clearSearchBtn = document.getElementById("clear-search");
    elements.sortSelect = getSortSelectElement();
    elements.categoriesNav = document.getElementById("products-categories");
    elements.pageHeading = document.getElementById("page-heading");
    elements.liveRegion = document.getElementById("aria-live-region");
  }

  function getSortSelectElement() {
    return document.getElementById("product-sort") || 
           document.querySelector("select.product-sort") || 
           document.querySelector("select[name='sort']");
  }


  /* ==========================================================================
     6. EVENTS & DELEGATION
     ========================================================================== */

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", handleSearchInput);
      elements.searchInput.addEventListener("keydown", handleSearchKeydown);
    }

    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.addEventListener("click", clearSearch);
    }

    const sortEl = getSortSelectElement();
    if (sortEl) {
      sortEl.addEventListener("change", handleSortChange);
    }

    // Delegation fallback for dynamically added/updated select controls
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
    const searchInput = elements.searchInput || document.getElementById("product-search");
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    state.searchQuery = "";
    updateClearSearchButton();
    loadProducts(state.activeCategoryQuery || "");
  }

  function updateClearSearchButton() {
    const clearBtn = elements.clearSearchBtn || document.getElementById("clear-search");
    if (!clearBtn) return;
    clearBtn.hidden = state.searchQuery.length === 0;
  }


  /* ==========================================================================
     8. FETCH PRODUCTS WITH RACE-CONDITION CANCELLATION
     ========================================================================== */

  async function loadProducts(query = state.searchQuery || state.activeCategoryQuery) {
    // Abort previous pending fetch request to prevent stale overwrites
    if (activeFetchController) {
      activeFetchController.abort();
    }

    activeFetchController = new AbortController();
    const currentController = activeFetchController;

    state.loading = true;
    setLoadingState(true);
    showLoadingState();

    let apiUrl = `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;
    if (query && query.trim().length > 0) {
      apiUrl += `?q=${encodeURIComponent(query.trim())}`;
    }

    const timeout = window.setTimeout(() => {
      currentController.abort();
    }, CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
        signal: currentController.signal
      });

      window.clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const data = await response.json();
      const rawProducts = extractProducts(data);

      state.products = rawProducts
        .map(normalizeProduct)
        .filter(product => product !== null && product.id);

      updatePageHeading(query);
      applyFiltersAndRender();

    } catch (error) {
      window.clearTimeout(timeout);

      // Silently ignore manual aborts triggered by new user input
      if (error?.name === "AbortError") {
        return;
      }

      console.error("[PRASUN SHOP] Product load error:", error);
      const message = error?.message || "Unable to load products. Please try again.";
      renderErrorState(message);

    } finally {
      if (activeFetchController === currentController) {
        state.loading = false;
        setLoadingState(false);
        activeFetchController = null;
      }
    }
  }


  /* ==========================================================================
     9. EXTRACT & NORMALIZE PRODUCT PAYLOAD (CJ-COMPATIBLE)
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

    let rawPrice = product.price ?? product.sellPrice ?? product.unitPrice ?? product.cost ?? 0;
    if (typeof rawPrice === "object" && rawPrice !== null) {
      rawPrice = rawPrice.amount ?? rawPrice.value ?? rawPrice.raw ?? 0;
    }

    let price = parseFloat(
      String(rawPrice).replace(/[^0-9.]/g, "")
    );
    if (isNaN(price)) price = 0;

    if (!id || !name) return null;

    const category = String(product.category || "General");

    // Extract image with support for standard keys & CJ Dropshipping keys
    let rawImage = 
      product.image || 
      product.productImage || 
      product.productImg || 
      product.bigImage || 
      CONFIG.PLACEHOLDER_IMAGE;

    if (typeof rawImage !== "string" || !rawImage.trim()) {
      rawImage = CONFIG.PLACEHOLDER_IMAGE;
    }

    let image = rawImage.trim();

    // Protocol normalization for CJ image CDN paths
    if (image.startsWith("//")) {
      image = `https:${image}`;
    } else if (image.startsWith("http://")) {
      image = image.replace("http://", "https://");
    }

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
    const categoriesNav = elements.categoriesNav || document.getElementById("products-categories");
    if (!categoriesNav) return;

    categoriesNav.innerHTML = CATEGORY_MAP.map(item => {
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

    const searchInput = elements.searchInput || document.getElementById("product-search");
    if (searchInput) {
      searchInput.value = "";
      state.searchQuery = "";
      updateClearSearchButton();
    }

    highlightActiveCategoryPill(query);
    loadProducts(query);
  }

  function highlightActiveCategoryPill(activeQuery) {
    const categoriesNav = elements.categoriesNav || document.getElementById("products-categories");
    if (!categoriesNav) return;

    categoriesNav
      .querySelectorAll(".category-pill")
      .forEach(pill => {
        const isMatch = pill.dataset.query === activeQuery;
        pill.classList.toggle("active", isMatch);
        pill.setAttribute("aria-pressed", isMatch ? "true" : "false");
      });
  }


  /* ==========================================================================
     11. FILTERING, SORTING & PAGE HEADING
     ========================================================================== */

  function updatePageHeading(query) {
    const pageHeading = elements.pageHeading || document.getElementById("page-heading");
    if (!pageHeading) return;

    if (!query) {
      pageHeading.textContent = "Featured Products";
      return;
    }

    const matchedCategory = CATEGORY_MAP.find(cat => cat.query === query);
    if (matchedCategory && matchedCategory.label !== "All Items") {
      pageHeading.textContent = matchedCategory.label;
    } else {
      pageHeading.textContent = `Search: "${query}"`;
    }
  }

  function applyFiltersAndRender() {
    let result = [...state.products];

    // Client-side query filter fallback
    const activeQuery = (state.searchQuery || state.activeCategoryQuery || "").toLowerCase().trim();
    if (activeQuery) {
      result = result.filter(item => {
        const name = String(item.name || "").toLowerCase();
        const category = String(item.category || "").toLowerCase();
        return name.includes(activeQuery) || category.includes(activeQuery);
      });
    }

    result.sort(sortProducts);
    state.filteredProducts = result;

    if (state.filteredProducts.length === 0) {
      const q = state.searchQuery || state.activeCategoryQuery;
      renderEmptyState(
        q
          ? `No available items found matching "${escapeHtml(q)}".`
          : "No active products available at the moment."
      );
      return;
    }

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
     12. RENDER GRID & CARDS
     ========================================================================== */

  function renderProductGrid() {
    const productList = elements.productList || document.getElementById("product-list");
    if (!productList) return;

    productList.innerHTML = state.filteredProducts
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
      const cartEvent = new CustomEvent("cart:add", { detail: product });
      document.dispatchEvent(cartEvent);
      window.dispatchEvent(cartEvent);
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
    const productList = elements.productList || document.getElementById("product-list");
    if (!productList) return;

    productList.innerHTML = `
      <div class="product-status-card products-empty" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <h3>Fetching available products...</h3>
        <p>Connecting to catalog...</p>
      </div>
    `;
    const resultsCount = elements.resultsCount || document.getElementById("results-count");
    if (resultsCount) resultsCount.textContent = "Loading...";
  }

  function setLoadingState(isLoading) {
    const productList = elements.productList || document.getElementById("product-list");
    if (!productList) return;
    productList.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function renderEmptyState(message) {
    const productList = elements.productList || document.getElementById("product-list");
    if (!productList) return;

    productList.innerHTML = `
      <div class="product-status-card products-empty" role="status">
        <h3>No Products Found</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    const resultsCount = elements.resultsCount || document.getElementById("results-count");
    if (resultsCount) resultsCount.textContent = "0 products found";
    setLoadingState(false);
  }

  function renderErrorState(message) {
    const productList = elements.productList || document.getElementById("product-list");
    if (!productList) return;

    productList.innerHTML = `
      <div class="product-status-card products-error" role="alert">
        <h3>Unable to Load Products</h3>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="button" data-action="retry-products">Try Again</button>
      </div>
    `;
    const resultsCount = elements.resultsCount || document.getElementById("results-count");
    if (resultsCount) resultsCount.textContent = "Error loading products";
    setLoadingState(false);

    const retryBtn = productList.querySelector('[data-action="retry-products"]');
    if (retryBtn) {
      retryBtn.addEventListener("click", () => loadProducts(), { once: true });
    }
  }

  function updateResultsCount() {
    const resultsCount = elements.resultsCount || document.getElementById("results-count");
    if (!resultsCount) return;
    const count = state.filteredProducts.length;
    resultsCount.textContent = `${count} ${count === 1 ? "product" : "products"} available`;
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
    const liveRegion = elements.liveRegion || document.getElementById("aria-live-region");
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = String(message || "");
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

})();
