/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * js/products.js
 * ============================================================================
 *
 * Handles:
 *
 * - Cloudflare Worker API
 * - Product loading
 * - Product normalization
 * - Search
 * - Category filtering
 * - Sorting
 * - Product rendering
 * - Product images
 * - Add to Cart integration
 * - Accessibility
 * - Error / retry handling
 *
 * IMPORTANT:
 * This file is designed to work WITHOUT script.js.
 * ============================================================================
 */

"use strict";

(() => {

  /* ==========================================================================
     1. CONFIGURATION
     ========================================================================== */

  const CONFIG = {
    API_BASE:
      "https://prasun-shop-api.prasunbarua-dev.workers.dev",

    PRODUCTS_ENDPOINT:
      "/api/products",

    PLACEHOLDER_IMAGE:
      "/images/placeholder.webp",

    PRODUCT_PAGE:
      "/product.html",

    REQUEST_TIMEOUT:
      15000
  };


  /* ==========================================================================
     2. APPLICATION STATE
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
     4. INITIALIZATION
     ========================================================================== */

  document.addEventListener("DOMContentLoaded", init);


  function init() {

    cacheDOMElements();

    bindEvents();

    loadProducts();
  }


  /* ==========================================================================
     5. CACHE DOM
     ========================================================================== */

  function cacheDOMElements() {

    elements.productList =
      document.getElementById("product-list");

    elements.resultsCount =
      document.getElementById("results-count");

    elements.searchInput =
      document.getElementById("product-search");

    elements.clearSearchBtn =
      document.getElementById("clear-search");

    elements.sortSelect =
      document.getElementById("product-sort");

    elements.categoriesNav =
      document.getElementById("products-categories");

    elements.pageHeading =
      document.getElementById("page-heading");

    elements.liveRegion =
      document.getElementById("aria-live-region");
  }


  /* ==========================================================================
     6. EVENT LISTENERS
     ========================================================================== */

  function bindEvents() {

    /* ------------------------------------------------------------------------
       Search
       ------------------------------------------------------------------------ */

    if (elements.searchInput) {

      elements.searchInput.addEventListener(
        "input",
        handleSearchInput
      );
    }


    /* ------------------------------------------------------------------------
       Clear Search
       ------------------------------------------------------------------------ */

    if (elements.clearSearchBtn) {

      elements.clearSearchBtn.addEventListener(
        "click",
        clearSearch
      );
    }


    /* ------------------------------------------------------------------------
       Sort
       ------------------------------------------------------------------------ */

    if (elements.sortSelect) {

      elements.sortSelect.addEventListener(
        "change",
        () => {

          state.sortBy =
            elements.sortSelect.value || "featured";

          applyFiltersAndRender();
        }
      );
    }


    /* ------------------------------------------------------------------------
       Category Delegation
       ------------------------------------------------------------------------ */

    if (elements.categoriesNav) {

      elements.categoriesNav.addEventListener(
        "click",
        handleCategoryClick
      );
    }


    /* ------------------------------------------------------------------------
       Product Grid Delegation
       ------------------------------------------------------------------------ */

    if (elements.productList) {

      elements.productList.addEventListener(
        "click",
        handleProductGridClick
      );
    }
  }


  /* ==========================================================================
     7. SEARCH
     ========================================================================== */

  function handleSearchInput(event) {

    state.searchQuery =
      normalizeText(event.target.value);

    updateClearSearchButton();

    applyFiltersAndRender();
  }


  function clearSearch() {

    if (elements.searchInput) {

      elements.searchInput.value = "";

      elements.searchInput.focus();
    }

    state.searchQuery = "";

    updateClearSearchButton();

    applyFiltersAndRender();
  }


  function updateClearSearchButton() {

    if (!elements.clearSearchBtn) {
      return;
    }

    elements.clearSearchBtn.hidden =
      state.searchQuery.length === 0;
  }


  /* ==========================================================================
     8. LOAD PRODUCTS
     ========================================================================== */

  async function loadProducts() {

    if (state.loading) {
      return;
    }

    state.loading = true;

    setLoadingState(true);

    showLoadingState();

    try {

      const url =
        `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          CONFIG.REQUEST_TIMEOUT
        );

      let response;

      try {

        response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          cache: "no-store",
          signal: controller.signal
        });

      } finally {

        clearTimeout(timeout);
      }


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      /* ----------------------------------------------------------------------
         Accept multiple Worker response formats
         ---------------------------------------------------------------------- */

      let rawProducts = [];

      if (Array.isArray(data)) {

        rawProducts = data;

      } else if (
        data &&
        Array.isArray(data.products)
      ) {

        rawProducts = data.products;

      } else if (
        data &&
        Array.isArray(data.data)
      ) {

        rawProducts = data.data;

      } else if (
        data &&
        data.data &&
        Array.isArray(data.data.products)
      ) {

        rawProducts = data.data.products;
      }


      /* ----------------------------------------------------------------------
         Normalize products
         ---------------------------------------------------------------------- */

      state.products =
        rawProducts
          .map(normalizeProduct)
          .filter(product => product.id);


      /* ----------------------------------------------------------------------
         Empty catalog
         ---------------------------------------------------------------------- */

      if (state.products.length === 0) {

        renderEmptyState(
          "No products are currently available."
        );

        return;
      }


      /* ----------------------------------------------------------------------
         Render
         ---------------------------------------------------------------------- */

      renderCategoryPills();

      updatePageHeading();

      applyFiltersAndRender();


    } catch (error) {

      console.error(
        "[PRASUN SHOP] Product loading failed:",
        error
      );


      let message =
        "Unable to load products. Please try again.";

      if (error.name === "AbortError") {

        message =
          "The product request took too long. Please try again.";
      }

      renderErrorState(message);


    } finally {

      state.loading = false;

      setLoadingState(false);
    }
  }


  /* ==========================================================================
     9. NORMALIZE PRODUCT
     ========================================================================== */

  function normalizeProduct(product) {

    if (!product || typeof product !== "object") {

      return {
        id: "",
        sku: "",
        name: "Product",
        title: "Product",
        price: 0,
        image: CONFIG.PLACEHOLDER_IMAGE,
        category: "General",
        description: "",
        rating: 0,
        stock: null
      };
    }


    /* ------------------------------------------------------------------------
       ID
       ------------------------------------------------------------------------ */

    const id =
      product.id ??
      product.pid ??
      product.productId ??
      product.product_id ??
      product.sku ??
      "";


    /* ------------------------------------------------------------------------
       Name / title
       ------------------------------------------------------------------------ */

    const name =
      product.name ??
      product.title ??
      product.productName ??
      product.product_name ??
      "Product";


    /* ------------------------------------------------------------------------
       SKU
       ------------------------------------------------------------------------ */

    const sku =
      product.sku ??
      product.SKU ??
      "";


    /* ------------------------------------------------------------------------
       Price
       ------------------------------------------------------------------------ */

    let price =
      product.price ??
      product.salePrice ??
      product.sale_price ??
      product.sellPrice ??
      product.sell_price ??
      0;


    if (typeof price === "object" && price !== null) {

      price =
        price.value ??
        price.amount ??
        price.price ??
        0;
    }


    price =
      parseFloat(
        String(price).replace(/[^0-9.-]/g, "")
      ) || 0;


    /* ------------------------------------------------------------------------
       Category
       ------------------------------------------------------------------------ */

    const category =
      product.category ??
      product.categoryName ??
      product.category_name ??
      "General";


    /* ------------------------------------------------------------------------
       Description
       ------------------------------------------------------------------------ */

    const description =
      product.description ??
      product.desc ??
      product.productDescription ??
      product.product_description ??
      "";


    /* ------------------------------------------------------------------------
       Image
       ------------------------------------------------------------------------ */

    const image =
      getProductImage(product);


    /* ------------------------------------------------------------------------
       Rating
       ------------------------------------------------------------------------ */

    const rating =
      getProductRating(product);


    /* ------------------------------------------------------------------------
       Stock
       ------------------------------------------------------------------------ */

    const stock =
      product.stock ??
      product.inventory ??
      product.quantity ??
      null;


    return {

      ...product,

      id: String(id),

      sku: String(sku),

      name: String(name),

      title: String(name),

      price,

      category: String(category),

      description: String(description),

      image,

      rating,

      stock
    };
  }


  /* ==========================================================================
     10. PRODUCT IMAGE NORMALIZATION
     ========================================================================== */

  function getProductImage(product) {

    const possibleImages = [

      product.image,

      product.imageUrl,

      product.image_url,

      product.productImage,

      product.product_image,

      product.mainImage,

      product.main_image,

      product.img,

      product.thumbnail
    ];


    for (const image of possibleImages) {

      if (typeof image === "string" && image.trim()) {

        return image.trim();
      }
    }


    /* ------------------------------------------------------------------------
       Image arrays
       ------------------------------------------------------------------------ */

    const arrays = [

      product.images,

      product.imageList,

      product.image_list,

      product.productImages,

      product.product_images
    ];


    for (const array of arrays) {

      if (!Array.isArray(array)) {
        continue;
      }


      for (const item of array) {

        if (typeof item === "string" && item.trim()) {

          return item.trim();
        }


        if (
          item &&
          typeof item === "object"
        ) {

          const url =
            item.url ??
            item.image ??
            item.imageUrl ??
            item.image_url;


          if (
            typeof url === "string" &&
            url.trim()
          ) {

            return url.trim();
          }
        }
      }
    }


    return CONFIG.PLACEHOLDER_IMAGE;
  }


  /* ==========================================================================
     11. RATING NORMALIZATION
     ========================================================================== */

  function getProductRating(product) {

    let rating =
      product.rating ??
      product.rate ??
      product.averageRating ??
      product.average_rating ??
      0;


    if (
      typeof rating === "object" &&
      rating !== null
    ) {

      rating =
        rating.rate ??
        rating.value ??
        rating.average ??
        0;
    }


    rating =
      parseFloat(rating) || 0;


    return Math.max(
      0,
      Math.min(5, rating)
    );
  }


  /* ==========================================================================
     12. CATEGORY PILLS
     ========================================================================== */

  function renderCategoryPills() {

    if (!elements.categoriesNav) {
      return;
    }


    const categoryMap =
      new Map();


    categoryMap.set(
      "all",
      "All"
    );


    state.products.forEach(product => {

      const raw =
        String(product.category || "General").trim();

      if (!raw) {
        return;
      }


      const key =
        normalizeCategory(raw);


      if (!categoryMap.has(key)) {

        categoryMap.set(
          key,
          raw
        );
      }
    });


    elements.categoriesNav.innerHTML =
      Array.from(categoryMap.entries())
        .map(([key, label]) => {

          const active =
            key === state.activeCategory;


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
     13. CATEGORY CLICK
     ========================================================================== */

  function handleCategoryClick(event) {

    const button =
      event.target.closest(".category-pill");


    if (!button) {
      return;
    }


    const category =
      button.dataset.category;


    if (!category) {
      return;
    }


    state.activeCategory =
      category;


    elements.categoriesNav
      ?.querySelectorAll(".category-pill")
      .forEach(item => {

        const active =
          item.dataset.category ===
          state.activeCategory;


        item.classList.toggle(
          "active",
          active
        );


        item.setAttribute(
          "aria-pressed",
          active ? "true" : "false"
        );
      });


    updatePageHeading();

    applyFiltersAndRender();
  }


  /* ==========================================================================
     14. PAGE HEADING
     ========================================================================== */

  function updatePageHeading() {

    if (!elements.pageHeading) {
      return;
    }


    if (state.activeCategory === "all") {

      elements.pageHeading.textContent =
        "All Products";

      return;
    }


    const product =
      state.products.find(
        item =>
          normalizeCategory(item.category) ===
          state.activeCategory
      );


    elements.pageHeading.textContent =
      product
        ? product.category
        : capitalize(state.activeCategory);
  }


  /* ==========================================================================
     15. FILTER + SORT
     ========================================================================== */

  function applyFiltersAndRender() {

    let result =
      [...state.products];


    /* ------------------------------------------------------------------------
       Category
       ------------------------------------------------------------------------ */

    if (
      state.activeCategory !== "all"
    ) {

      result =
        result.filter(product =>
          normalizeCategory(product.category) ===
          state.activeCategory
        );
    }


    /* ------------------------------------------------------------------------
       Search
       ------------------------------------------------------------------------ */

    if (state.searchQuery) {

      const query =
        state.searchQuery;


      result =
        result.filter(product => {

          const searchableText = [

            product.name,

            product.title,

            product.sku,

            product.category,

            product.description

          ]
            .map(value =>
              normalizeText(value)
            )
            .join(" ");


          return searchableText.includes(query);
        });
    }


    /* ------------------------------------------------------------------------
       Sorting
       ------------------------------------------------------------------------ */

    result.sort(
      (a, b) =>
        sortProducts(a, b)
    );


    state.filteredProducts =
      result;


    renderProductGrid();

    updateResultsCount();
  }


  /* ==========================================================================
     16. SORT PRODUCTS
     ========================================================================== */

  function sortProducts(a, b) {

    switch (state.sortBy) {

      case "price-low":

        return (
          Number(a.price) -
          Number(b.price)
        );


      case "price-high":

        return (
          Number(b.price) -
          Number(a.price)
        );


      case "rating":

        return (
          Number(b.rating) -
          Number(a.rating)
        );


      case "name-az":

        return String(a.name)
          .localeCompare(
            String(b.name),
            undefined,
            {
              sensitivity: "base"
            }
          );


      case "featured":

      default:

        return 0;
    }
  }


  /* ==========================================================================
     17. RENDER PRODUCT GRID
     ========================================================================== */

  function renderProductGrid() {

    if (!elements.productList) {
      return;
    }


    if (
      state.filteredProducts.length === 0
    ) {

      renderEmptyState(
        state.searchQuery
          ? "No products match your search."
          : "No products match the selected category."
      );

      return;
    }


    elements.productList.innerHTML =
      state.filteredProducts
        .map(product =>
          renderProductCard(product)
        )
        .join("");


    elements.productList.setAttribute(
      "aria-busy",
      "false"
    );
  }


  /* ==========================================================================
     18. PRODUCT CARD
     ========================================================================== */

  function renderProductCard(product) {

    const id =
      escapeHtml(String(product.id));


    const title =
      escapeHtml(
        product.name ||
        "Product"
      );


    const category =
      escapeHtml(
        product.category ||
        "General"
      );


    const image =
      escapeHtml(
        product.image ||
        CONFIG.PLACEHOLDER_IMAGE
      );


    const price =
      formatPrice(product.price);


    const rating =
      Number(product.rating) || 0;


    const ratingHTML =
      rating > 0
        ? `
          <div
            class="product-rating"
            aria-label="Rating ${rating.toFixed(1)} out of 5"
          >
            <span aria-hidden="true">★</span>
            ${rating.toFixed(1)}
          </div>
        `
        : "";


    return `
      <article
        class="product-card"
        data-product-id="${id}"
      >

        <a
          class="product-card-image"
          href="${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(product.id)}"
          aria-label="View ${title}"
        >

          <img
            src="${image}"
            alt="${title}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${CONFIG.PLACEHOLDER_IMAGE}'"
          >

        </a>


        <div class="product-card-body">

          <span class="product-category">
            ${category}
          </span>


          <h3 class="product-title">

            <a
              href="${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(product.id)}"
            >
              ${title}
            </a>

          </h3>


          ${ratingHTML}


          <div class="product-card-footer">

            <span
              class="product-price"
              aria-label="Price ${price}"
            >
              ${price}
            </span>


            <button
              type="button"
              class="button button-primary add-to-cart-btn"
              data-product-id="${id}"
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
     19. PRODUCT GRID CLICK HANDLER
     ========================================================================== */

  function handleProductGridClick(event) {

    const button =
      event.target.closest(
        ".add-to-cart-btn"
      );


    if (!button) {
      return;
    }


    event.preventDefault();

    event.stopPropagation();


    const productId =
      button.dataset.productId;


    if (!productId) {
      return;
    }


    addProductToCart(
      productId,
      button
    );
  }


  /* ==========================================================================
     20. ADD TO CART
     ========================================================================== */

  function addProductToCart(
    productId,
    button
  ) {

    const product =
      state.products.find(
        item =>
          String(item.id) ===
          String(productId)
      );


    if (!product) {

      console.error(
        "[PRASUN SHOP] Product not found:",
        productId
      );

      return;
    }


    /* ------------------------------------------------------------------------
       Preferred cart.js API
       ------------------------------------------------------------------------ */

    if (
      typeof window.addToCart ===
      "function"
    ) {

      window.addToCart(product);

    } else {

      /* ----------------------------------------------------------------------
         Fallback custom event
         ---------------------------------------------------------------------- */

      document.dispatchEvent(
        new CustomEvent(
          "cart:add",
          {
            detail: product
          }
        )
      );
    }


    /* ------------------------------------------------------------------------
       Button feedback
       ------------------------------------------------------------------------ */

    if (button) {

      const originalText =
        button.textContent;


      button.disabled = true;

      button.textContent =
        "Added";


      setTimeout(() => {

        button.disabled = false;

        button.textContent =
          originalText;

      }, 900);
    }


    announceToScreenReader(
      `${product.name} added to cart.`
    );
  }


  /* ==========================================================================
     21. LOADING STATE
     ========================================================================== */

  function showLoadingState() {

    if (!elements.productList) {
      return;
    }


    elements.productList.innerHTML = `
      <div
        class="product-status-card products-empty"
        role="status"
      >

        <div
          class="spinner"
          aria-hidden="true"
        ></div>

        <h3>
          Loading products...
        </h3>

        <p>
          Please wait while products are loaded.
        </p>

      </div>
    `;


    if (elements.resultsCount) {

      elements.resultsCount.textContent =
        "Loading products...";
    }
  }


  function setLoadingState(isLoading) {

    if (!elements.productList) {
      return;
    }


    elements.productList.setAttribute(
      "aria-busy",
      isLoading
        ? "true"
        : "false"
    );
  }


  /* ==========================================================================
     22. EMPTY STATE
     ========================================================================== */

  function renderEmptyState(message) {

    if (!elements.productList) {
      return;
    }


    elements.productList.innerHTML = `
      <div
        class="product-status-card products-empty"
        role="status"
      >

        <h3>
          No Products Found
        </h3>

        <p>
          ${escapeHtml(message)}
        </p>

      </div>
    `;


    if (elements.resultsCount) {

      elements.resultsCount.textContent =
        "0 products";
    }


    setLoadingState(false);

    announceToScreenReader(message);
  }


  /* ==========================================================================
     23. ERROR STATE
     ========================================================================== */

  function renderErrorState(message) {

    if (!elements.productList) {
      return;
    }


    elements.productList.innerHTML = `
      <div
        class="product-status-card products-error"
        role="alert"
      >

        <h3>
          Unable to Load Products
        </h3>

        <p>
          ${escapeHtml(message)}
        </p>

        <button
          type="button"
          class="button"
          data-action="retry-products"
        >
          Try Again
        </button>

      </div>
    `;


    if (elements.resultsCount) {

      elements.resultsCount.textContent =
        "Unable to load products";
    }


    setLoadingState(false);

    announceToScreenReader(
      "Unable to load products."
    );


    const retryButton =
      elements.productList.querySelector(
        '[data-action="retry-products"]'
      );


    if (retryButton) {

      retryButton.addEventListener(
        "click",
        loadProducts,
        {
          once: true
        }
      );
    }
  }


  /* ==========================================================================
     24. RESULTS COUNT
     ========================================================================== */

  function updateResultsCount() {

    if (!elements.resultsCount) {
      return;
    }


    const count =
      state.filteredProducts.length;


    const text =
      `${count} ${
        count === 1
          ? "product"
          : "products"
      } found`;


    elements.resultsCount.textContent =
      text;


    announceToScreenReader(text);
  }


  /* ==========================================================================
     25. PRICE FORMAT
     ========================================================================== */

  function formatPrice(amount) {

    const value =
      Number(amount);


    if (
      !Number.isFinite(value)
    ) {

      return "$0.00";
    }


    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "USD"
      }
    ).format(value);
  }


  /* ==========================================================================
     26. TEXT NORMALIZATION
     ========================================================================== */

  function normalizeText(value) {

    return String(value ?? "")
      .trim()
      .toLowerCase();
  }


  function normalizeCategory(value) {

    return normalizeText(value)
      .replace(/\s+/g, " ");
  }


  /* ==========================================================================
     27. CAPITALIZE
     ========================================================================== */

  function capitalize(value) {

    const text =
      String(value || "").trim();


    if (!text) {
      return "";
    }


    return text
      .charAt(0)
      .toUpperCase() +
      text.slice(1);
  }


  /* ==========================================================================
     28. HTML ESCAPE
     ========================================================================== */

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* ==========================================================================
     29. SCREEN READER ANNOUNCEMENT
     ========================================================================== */

  function announceToScreenReader(message) {

    if (!elements.liveRegion) {
      return;
    }


    elements.liveRegion.textContent = "";


    window.setTimeout(() => {

      elements.liveRegion.textContent =
        String(message || "");

    }, 30);
  }


  /* ==========================================================================
     30. PUBLIC API
     ========================================================================== */

  /*
   * Expose only what other storefront components may need.
   */

  window.PrasunProducts = {

    reload: loadProducts,

    getProducts: () =>
      [...state.products],

    getFilteredProducts: () =>
      [...state.filteredProducts],

    getProductById: id =>
      state.products.find(
        product =>
          String(product.id) ===
          String(id)
      ) || null
  };


})();
