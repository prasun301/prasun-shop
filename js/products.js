/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * js/products.js
 * ============================================================================
 *
 * Standalone storefront product manager.
 *
 * DOES NOT REQUIRE script.js
 *
 * Features:
 * - Cloudflare Worker API
 * - Product loading
 * - Product normalization
 * - Search
 * - Category filtering
 * - Sorting
 * - Product rendering
 * - Product images
 * - Add-to-cart integration
 * - Accessibility
 * - Loading / empty / error states
 * - API diagnostics
 * - Retry support
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
      20000
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
     3. DOM
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

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


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
     6. EVENTS
     ========================================================================== */

  function bindEvents() {

    if (elements.searchInput) {

      elements.searchInput.addEventListener(
        "input",
        handleSearch
      );
    }


    if (elements.clearSearchBtn) {

      elements.clearSearchBtn.addEventListener(
        "click",
        clearSearch
      );
    }


    if (elements.sortSelect) {

      elements.sortSelect.addEventListener(
        "change",
        () => {

          state.sortBy =
            elements.sortSelect.value ||
            "featured";

          applyFiltersAndRender();
        }
      );
    }


    if (elements.categoriesNav) {

      elements.categoriesNav.addEventListener(
        "click",
        handleCategoryClick
      );
    }


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

  function handleSearch(event) {

    state.searchQuery =
      normalizeText(
        event.target.value
      );

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

    const apiUrl =
      `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;

    console.log(
      "[PRASUN SHOP] Loading products from:",
      apiUrl
    );

    try {

      const controller =
        new AbortController();

      const timeout =
        window.setTimeout(
          () => controller.abort(),
          CONFIG.REQUEST_TIMEOUT
        );


      let response;

      try {

        response =
          await fetch(
            apiUrl,
            {
              method: "GET",

              headers: {
                "Accept":
                  "application/json"
              },

              cache: "no-store",

              signal:
                controller.signal
            }
          );

      } finally {

        window.clearTimeout(
          timeout
        );
      }


      const responseText =
        await response.text();


      console.log(
        "[PRASUN SHOP] API HTTP status:",
        response.status
      );


      if (!response.ok) {

        let errorData = null;

        try {

          errorData =
            JSON.parse(
              responseText
            );

        } catch {

          errorData =
            responseText;
        }


        console.error(
          "[PRASUN SHOP] API error response:",
          errorData
        );


        throw new Error(
          getApiErrorMessage(
            response.status,
            errorData
          )
        );
      }


      let data;

      try {

        data =
          JSON.parse(
            responseText
          );

      } catch (jsonError) {

        console.error(
          "[PRASUN SHOP] Invalid JSON:",
          responseText
        );

        throw new Error(
          "The product server returned invalid JSON."
        );
      }


      console.log(
        "[PRASUN SHOP] API response:",
        data
      );


      const rawProducts =
        extractProducts(
          data
        );


      state.products =
        rawProducts
          .map(normalizeProduct)
          .filter(
            product =>
              product &&
              product.id
          );


      console.log(
        "[PRASUN SHOP] Products loaded:",
        state.products.length
      );


      if (
        state.products.length === 0
      ) {

        renderEmptyState(
          "No products are currently available."
        );

        return;
      }


      renderCategoryPills();

      updatePageHeading();

      applyFiltersAndRender();


    } catch (error) {

      console.error(
        "[PRASUN SHOP] Product loading failed:",
        error
      );


      let message =
        error?.message ||
        "Unable to load products. Please try again.";


      if (
        error?.name ===
        "AbortError"
      ) {

        message =
          "The product request timed out. Please try again.";
      }


      renderErrorState(
        message
      );


    } finally {

      state.loading = false;

      setLoadingState(false);
    }
  }


  /* ==========================================================================
     9. EXTRACT PRODUCTS
     ========================================================================== */

  function extractProducts(data) {

    if (!data) {
      return [];
    }


    /* Direct array */

    if (Array.isArray(data)) {
      return data;
    }


    /* Normal Worker response */

    if (
      Array.isArray(
        data.products
      )
    ) {

      return data.products;
    }


    /* data.products */

    if (
      data.data &&
      Array.isArray(
        data.data.products
      )
    ) {

      return data.data.products;
    }


    /* data.data */

    if (
      data.data &&
      Array.isArray(
        data.data
      )
    ) {

      return data.data;
    }


    /* result.products */

    if (
      data.result &&
      Array.isArray(
        data.result.products
      )
    ) {

      return data.result.products;
    }


    /* AliExpress raw response */

    const aliResponse =
      data.aliexpress_ds_recommend_feed_get_response;


    if (
      aliResponse &&
      aliResponse.result &&
      aliResponse.result.products
    ) {

      const products =
        aliResponse.result.products;


      if (
        Array.isArray(
          products.integer
        )
      ) {

        return products.integer;
      }


      if (
        Array.isArray(
          products.product
        )
      ) {

        return products.product;
      }


      if (
        Array.isArray(
          products
        )
      ) {

        return products;
      }
    }


    return [];
  }


  /* ==========================================================================
     10. API ERROR MESSAGE
     ========================================================================== */

  function getApiErrorMessage(
    status,
    data
  ) {

    if (
      data &&
      typeof data === "object"
    ) {

      if (data.message) {
        return String(data.message);
      }

      if (data.error) {
        return String(data.error);
      }

      if (
        data.details &&
        typeof data.details === "string"
      ) {

        return String(
          data.details
        );
      }
    }


    if (status === 404) {

      return "Products API endpoint was not found.";
    }


    if (status === 502) {

      return "The product server returned a 502 error.";
    }


    if (status === 503) {

      return "The product server is temporarily unavailable.";
    }


    return `Product server error (HTTP ${status}).`;
  }


  /* ==========================================================================
     11. NORMALIZE PRODUCT
     ========================================================================== */

  function normalizeProduct(
    product
  ) {

    if (
      !product ||
      typeof product !== "object"
    ) {

      return null;
    }


    const id =
      product.id ??
      product.pid ??
      product.productId ??
      product.product_id ??
      product.sku ??
      "";


    if (!id) {
      return null;
    }


    const name =
      product.name ??
      product.title ??
      product.productName ??
      product.product_name ??
      product.product_title ??
      "Product";


    const sku =
      product.sku ??
      product.SKU ??
      id;


    let price =
      product.price ??
      product.salePrice ??
      product.sale_price ??
      product.sellPrice ??
      product.sell_price ??
      product.target_sale_price ??
      product.target_original_price ??
      product.original_price ??
      0;


    if (
      typeof price === "object" &&
      price !== null
    ) {

      price =
        price.value ??
        price.amount ??
        price.price ??
        0;
    }


    price =
      Number.parseFloat(
        String(price)
          .replace(
            /[^0-9.-]/g,
            ""
          )
      ) || 0;


    const category =
      product.category ??
      product.categoryName ??
      product.category_name ??
      product.first_level_category_name ??
      product.second_level_category_name ??
      "General";


    const description =
      product.description ??
      product.desc ??
      product.productDescription ??
      product.product_description ??
      "";


    const rating =
      getProductRating(
        product
      );


    const image =
      getProductImage(
        product
      );


    const stock =
      product.stock ??
      product.inventory ??
      product.quantity ??
      null;


    return {

      ...product,

      id:
        String(id),

      pid:
        String(
          product.pid ??
          id
        ),

      sku:
        String(sku),

      name:
        String(name),

      title:
        String(name),

      price:
        Number(
          price.toFixed(2)
        ),

      category:
        String(category),

      description:
        String(description),

      image,

      rating,

      stock
    };
  }


  /* ==========================================================================
     12. IMAGE
     ========================================================================== */

  function getProductImage(
    product
  ) {

    const directImages = [

      product.image,

      product.imageUrl,

      product.image_url,

      product.productImage,

      product.product_image,

      product.product_main_image_url,

      product.mainImage,

      product.main_image,

      product.main_image_url,

      product.image_url_1,

      product.img,

      product.thumbnail
    ];


    for (
      const image of directImages
    ) {

      if (
        typeof image === "string" &&
        image.trim()
      ) {

        return image.trim();
      }
    }


    const arrays = [

      product.images,

      product.imageList,

      product.image_list,

      product.productImages,

      product.product_images
    ];


    for (
      const array of arrays
    ) {

      if (
        !Array.isArray(array)
      ) {

        continue;
      }


      for (
        const item of array
      ) {

        if (
          typeof item === "string" &&
          item.trim()
        ) {

          return item.trim();
        }


        if (
          item &&
          typeof item === "object"
        ) {

          const image =
            item.url ??
            item.image ??
            item.imageUrl ??
            item.image_url;


          if (
            typeof image === "string" &&
            image.trim()
          ) {

            return image.trim();
          }
        }
      }
    }


    return CONFIG.PLACEHOLDER_IMAGE;
  }


  /* ==========================================================================
     13. RATING
     ========================================================================== */

  function getProductRating(
    product
  ) {

    let rating =
      product.rating ??
      product.rate ??
      product.averageRating ??
      product.average_rating ??
      product.evaluate_rate ??
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
      Number.parseFloat(
        String(rating)
          .replace("%", "")
      ) || 0;


    /*
     * AliExpress evaluate_rate may be percentage-like.
     * Example: 80 -> 4.0
     */

    if (
      rating > 5
    ) {

      rating =
        rating / 20;
    }


    return Number(
      Math.max(
        0,
        Math.min(
          5,
          rating
        )
      ).toFixed(1)
    );
  }


  /* ==========================================================================
     14. CATEGORY PILLS
     ========================================================================== */

  function renderCategoryPills() {

    if (
      !elements.categoriesNav
    ) {

      return;
    }


    const categories =
      new Map();


    categories.set(
      "all",
      "All"
    );


    state.products.forEach(
      product => {

        const label =
          String(
            product.category ||
            "General"
          ).trim();


        if (!label) {
          return;
        }


        const key =
          normalizeCategory(
            label
          );


        if (
          !categories.has(key)
        ) {

          categories.set(
            key,
            label
          );
        }
      }
    );


    elements.categoriesNav.innerHTML =
      Array.from(
        categories.entries()
      )
      .map(
        ([key, label]) => {

          const active =
            key ===
            state.activeCategory;


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
        }
      )
      .join("");
  }


  /* ==========================================================================
     15. CATEGORY CLICK
     ========================================================================== */

  function handleCategoryClick(
    event
  ) {

    const button =
      event.target.closest(
        ".category-pill"
      );


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


    if (
      elements.categoriesNav
    ) {

      elements.categoriesNav
        .querySelectorAll(
          ".category-pill"
        )
        .forEach(
          item => {

            const active =
              item.dataset.category ===
              state.activeCategory;


            item.classList.toggle(
              "active",
              active
            );


            item.setAttribute(
              "aria-pressed",
              active
                ? "true"
                : "false"
            );
          }
        );
    }


    updatePageHeading();

    applyFiltersAndRender();
  }


  /* ==========================================================================
     16. PAGE HEADING
     ========================================================================== */

  function updatePageHeading() {

    if (
      !elements.pageHeading
    ) {

      return;
    }


    if (
      state.activeCategory ===
      "all"
    ) {

      elements.pageHeading.textContent =
        "All Products";

      return;
    }


    const product =
      state.products.find(
        item =>
          normalizeCategory(
            item.category
          ) ===
          state.activeCategory
      );


    elements.pageHeading.textContent =
      product
        ? product.category
        : capitalize(
            state.activeCategory
          );
  }


  /* ==========================================================================
     17. FILTER + SORT
     ========================================================================== */

  function applyFiltersAndRender() {

    let result =
      [...state.products];


    if (
      state.activeCategory !==
      "all"
    ) {

      result =
        result.filter(
          product =>
            normalizeCategory(
              product.category
            ) ===
            state.activeCategory
        );
    }


    if (
      state.searchQuery
    ) {

      const query =
        state.searchQuery;


      result =
        result.filter(
          product => {

            const text = [

              product.name,

              product.title,

              product.sku,

              product.category,

              product.description

            ]
            .map(
              normalizeText
            )
            .join(" ");


            return text.includes(
              query
            );
          }
        );
    }


    result.sort(
      sortProducts
    );


    state.filteredProducts =
      result;


    renderProductGrid();

    updateResultsCount();
  }


  /* ==========================================================================
     18. SORT
     ========================================================================== */

  function sortProducts(
    a,
    b
  ) {

    switch (
      state.sortBy
    ) {

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

        return String(
          a.name
        ).localeCompare(
          String(b.name),
          undefined,
          {
            sensitivity:
              "base"
          }
        );


      case "featured":

      default:

        return 0;
    }
  }


  /* ==========================================================================
     19. PRODUCT GRID
     ========================================================================== */

  function renderProductGrid() {

    if (
      !elements.productList
    ) {

      return;
    }


    if (
      state.filteredProducts.length ===
      0
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
        .map(
          renderProductCard
        )
        .join("");


    setLoadingState(false);
  }


  /* ==========================================================================
     20. PRODUCT CARD
     ========================================================================== */

  function renderProductCard(
    product
  ) {

    const id =
      String(product.id);


    const safeId =
      escapeHtml(id);


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
      formatPrice(
        product.price
      );


    const rating =
      Number(
        product.rating
      ) || 0;


    const productUrl =
      `${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(id)}`;


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
        data-product-id="${safeId}"
      >

        <a
          class="product-card-image"
          href="${escapeHtml(productUrl)}"
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
              href="${escapeHtml(productUrl)}"
            >
              ${title}
            </a>

          </h3>


          ${ratingHTML}


          <div class="product-card-footer">

            <span
              class="product-price"
              aria-label="Price ${escapeHtml(price)}"
            >
              ${escapeHtml(price)}
            </span>


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
     21. GRID CLICK
     ========================================================================== */

  function handleProductGridClick(
    event
  ) {

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
     22. ADD TO CART
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


    if (
      typeof window.addToCart ===
      "function"
    ) {

      window.addToCart(
        product
      );

    } else {

      document.dispatchEvent(
        new CustomEvent(
          "cart:add",
          {
            detail:
              product
          }
        )
      );
    }


    if (button) {

      const originalText =
        button.textContent;


      button.disabled =
        true;

      button.textContent =
        "Added";


      window.setTimeout(
        () => {

          button.disabled =
            false;

          button.textContent =
            originalText;

        },
        900
      );
    }


    announceToScreenReader(
      `${product.name} added to cart.`
    );
  }


  /* ==========================================================================
     23. LOADING
     ========================================================================== */

  function showLoadingState() {

    if (
      !elements.productList
    ) {

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


    if (
      elements.resultsCount
    ) {

      elements.resultsCount.textContent =
        "Loading products...";
    }
  }


  function setLoadingState(
    isLoading
  ) {

    if (
      !elements.productList
    ) {

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
     24. EMPTY
     ========================================================================== */

  function renderEmptyState(
    message
  ) {

    if (
      !elements.productList
    ) {

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


    if (
      elements.resultsCount
    ) {

      elements.resultsCount.textContent =
        "0 products";
    }


    setLoadingState(false);

    announceToScreenReader(
      message
    );
  }


  /* ==========================================================================
     25. ERROR
     ========================================================================== */

  function renderErrorState(
    message
  ) {

    if (
      !elements.productList
    ) {

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


    if (
      elements.resultsCount
    ) {

      elements.resultsCount.textContent =
        "Unable to load products";
    }


    setLoadingState(false);


    announceToScreenReader(
      "Unable to load products."
    );


    const retry =
      elements.productList.querySelector(
        '[data-action="retry-products"]'
      );


    if (retry) {

      retry.addEventListener(
        "click",
        loadProducts,
        {
          once: true
        }
      );
    }
  }


  /* ==========================================================================
     26. RESULTS COUNT
     ========================================================================== */

  function updateResultsCount() {

    if (
      !elements.resultsCount
    ) {

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


    announceToScreenReader(
      text
    );
  }


  /* ==========================================================================
     27. PRICE
     ========================================================================== */

  function formatPrice(
    amount
  ) {

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
        style:
          "currency",

        currency:
          "USD"
      }
    ).format(value);
  }


  /* ==========================================================================
     28. TEXT
     ========================================================================== */

  function normalizeText(
    value
  ) {

    return String(
      value ?? ""
    )
      .trim()
      .toLowerCase();
  }


  function normalizeCategory(
    value
  ) {

    return normalizeText(
      value
    )
      .replace(
        /\s+/g,
        " "
      );
  }


  function capitalize(
    value
  ) {

    const text =
      String(
        value || ""
      ).trim();


    if (!text) {
      return "";
    }


    return (
      text.charAt(0)
        .toUpperCase() +
      text.slice(1)
    );
  }


  /* ==========================================================================
     29. ESCAPE
     ========================================================================== */

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  /* ==========================================================================
     30. ACCESSIBILITY
     ========================================================================== */

  function announceToScreenReader(
    message
  ) {

    if (
      !elements.liveRegion
    ) {

      return;
    }


    elements.liveRegion.textContent =
      "";


    window.setTimeout(
      () => {

        elements.liveRegion.textContent =
          String(
            message || ""
          );

      },
      30
    );
  }


  /* ==========================================================================
     31. PUBLIC API
     ========================================================================== */

  window.PrasunProducts = {

    reload:
      loadProducts,

    getProducts:
      () =>
        [...state.products],

    getFilteredProducts:
      () =>
        [...state.filteredProducts],

    getProductById:
      id =>
        state.products.find(
          product =>
            String(product.id) ===
            String(id)
        ) || null,

    getApiBase:
      () =>
        CONFIG.API_BASE
  };


})();
