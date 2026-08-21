/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * js/products.js
 *
 * CJ Dropshipping compatible frontend product manager.
 *
 * Image strategy:
 *
 *   CJ original image
 *          ↓
 *   Cloudflare Worker
 *          ↓
 *   image / images / originalImage / originalImages
 *          ↓
 *   products.js
 *          ↓
 *   product card
 *
 * IMPORTANT:
 * - No Unsplash fallback.
 * - No hard-coded product images.
 * - Images are taken from the Worker/CJ response.
 * - CJ images are routed through the Worker image proxy when needed.
 *
 * ============================================================================*
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

    IMAGE_PROXY_ENDPOINT:
      "/api/image-proxy",

    /*
     * Empty image fallback.
     *
     * This is intentionally NOT an external image.
     * If CJ provides no image, the product card displays a neutral
     * "Image Unavailable" SVG generated locally by the browser.
     */

    PLACEHOLDER_IMAGE:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="600"
             height="600"
             viewBox="0 0 600 600">

          <rect width="600"
                height="600"
                fill="#f1f5f9"/>

          <path
            d="M120 430
               L225 290
               L305 360
               L430 215
               L520 430
               Z"
            fill="#cbd5e1"/>

          <circle
            cx="205"
            cy="205"
            r="45"
            fill="#cbd5e1"/>

          <text
            x="300"
            y="510"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            font-size="24"
            fill="#64748b">
            Image Unavailable
          </text>

        </svg>
      `),

    REQUEST_TIMEOUT:
      15000,

    DEBOUNCE_DELAY:
      300
  };


  /* ==========================================================================
     2. CATEGORY MAP
     ========================================================================== */

  const CATEGORY_MAP = [

    {
      label: "All Items",
      query: ""
    },

    {
      label: "Solar Lights",
      query: "solar light"
    },

    {
      label: "Consumer Electronics",
      query: "consumer electronics"
    },

    {
      label: "Wireless Chargers",
      query: "wireless charger"
    },

    {
      label: "Smart Home",
      query: "smart home led"
    }

  ];


  /* ==========================================================================
     3. STATE
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
     4. DOM ELEMENTS
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
     5. INITIALIZATION
     ========================================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }


  function init() {

    cacheDOMElements();

    const currentSelect =
      getSortSelectElement();

    if (
      currentSelect &&
      currentSelect.value
    ) {

      state.sortBy =
        currentSelect.value;

    }

    bindEvents();

    renderCategoryPills();

    updateClearSearchButton();

    loadProducts();

  }


  /* ==========================================================================
     6. DOM CACHE
     ========================================================================== */

  function cacheDOMElements() {

    elements.productList =
      document.getElementById(
        "product-list"
      );

    elements.resultsCount =
      document.getElementById(
        "results-count"
      );

    elements.searchInput =
      document.getElementById(
        "product-search"
      );

    elements.clearSearchBtn =
      document.getElementById(
        "clear-search"
      );

    elements.sortSelect =
      getSortSelectElement();

    elements.categoriesNav =
      document.getElementById(
        "products-categories"
      );

    elements.pageHeading =
      document.getElementById(
        "page-heading"
      );

    elements.liveRegion =
      document.getElementById(
        "aria-live-region"
      );

  }


  function getSortSelectElement() {

    return (
      document.getElementById(
        "product-sort"
      ) ||

      document.querySelector(
        "select.product-sort"
      ) ||

      document.querySelector(
        "select[name='sort']"
      )
    );

  }


  /* ==========================================================================
     7. EVENT BINDINGS
     ========================================================================== */

  function bindEvents() {

    if (
      elements.searchInput
    ) {

      elements.searchInput.addEventListener(
        "input",
        handleSearchInput
      );

      elements.searchInput.addEventListener(
        "keydown",
        handleSearchKeydown
      );

    }


    if (
      elements.clearSearchBtn
    ) {

      elements.clearSearchBtn.addEventListener(
        "click",
        clearSearch
      );

    }


    const sortEl =
      getSortSelectElement();

    if (sortEl) {

      sortEl.addEventListener(
        "change",
        handleSortChange
      );

    }


    /*
     * Delegation fallback for dynamically created sort controls.
     */

    document.addEventListener(
      "change",
      event => {

        if (
          event.target &&
          (
            event.target.id ===
              "product-sort" ||

            event.target.classList.contains(
              "product-sort"
            ) ||

            event.target.name ===
              "sort"
          )
        ) {

          handleSortChange(
            event
          );

        }

      }
    );


    if (
      elements.categoriesNav
    ) {

      elements.categoriesNav.addEventListener(
        "click",
        handleCategoryClick
      );

    }


    if (
      elements.productList
    ) {

      elements.productList.addEventListener(
        "click",
        handleProductGridClick
      );

    }

  }


  function handleSortChange(
    event
  ) {

    const value =
      event.target?.value ||
      "featured";

    state.sortBy =
      value;

    applyFiltersAndRender();

  }


  /* ==========================================================================
     8. SEARCH
     ========================================================================== */

  function handleSearchInput(
    event
  ) {

    state.searchQuery =
      String(
        event.target.value ||
        ""
      ).trim();

    updateClearSearchButton();

    window.clearTimeout(
      searchDebounceTimer
    );

    searchDebounceTimer =
      window.setTimeout(
        () => {

          state.activeCategoryQuery =
            "";

          highlightActiveCategoryPill(
            ""
          );

          loadProducts(
            state.searchQuery
          );

        },
        CONFIG.DEBOUNCE_DELAY
      );

  }


  function handleSearchKeydown(
    event
  ) {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      window.clearTimeout(
        searchDebounceTimer
      );

      state.activeCategoryQuery =
        "";

      highlightActiveCategoryPill(
        ""
      );

      loadProducts(
        state.searchQuery
      );

    }

  }


  function clearSearch() {

    const searchInput =
      elements.searchInput ||
      document.getElementById(
        "product-search"
      );

    if (searchInput) {

      searchInput.value =
        "";

      searchInput.focus();

    }

    state.searchQuery =
      "";

    updateClearSearchButton();

    loadProducts(
      state.activeCategoryQuery ||
      ""
    );

  }


  function updateClearSearchButton() {

    const clearButton =
      elements.clearSearchBtn ||
      document.getElementById(
        "clear-search"
      );

    if (!clearButton) {
      return;
    }

    clearButton.hidden =
      state.searchQuery.length === 0;

  }


  /* ==========================================================================
     9. LOAD PRODUCTS FROM CLOUDFLARE WORKER
     ========================================================================== */

  async function loadProducts(
    query =
      state.searchQuery ||
      state.activeCategoryQuery
  ) {

    /*
     * Abort previous request to avoid stale product responses.
     */

    if (
      activeFetchController
    ) {

      activeFetchController.abort();

    }

    activeFetchController =
      new AbortController();

    const currentController =
      activeFetchController;

    state.loading =
      true;

    setLoadingState(
      true
    );

    showLoadingState();


    let apiUrl =
      `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;


    const cleanQuery =
      String(
        query || ""
      ).trim();


    if (cleanQuery) {

      apiUrl +=
        `?q=${encodeURIComponent(
          cleanQuery
        )}`;

    }


    const timeout =
      window.setTimeout(
        () => {

          currentController.abort();

        },
        CONFIG.REQUEST_TIMEOUT
      );


    try {

      const response =
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
              currentController.signal
          }
        );


      window.clearTimeout(
        timeout
      );


      if (!response.ok) {

        throw new Error(
          `Server returned HTTP status ${response.status}`
        );

      }


      const data =
        await response.json();


      const rawProducts =
        extractProducts(
          data
        );


      state.products =
        rawProducts
          .map(
            normalizeProduct
          )
          .filter(
            product =>
              product !== null &&
              product.id
          );


      updatePageHeading(
        cleanQuery
      );

      applyFiltersAndRender();


    } catch (error) {

      window.clearTimeout(
        timeout
      );


      /*
       * Ignore manual aborts caused by a newer request.
       */

      if (
        error?.name ===
        "AbortError"
      ) {

        return;

      }


      console.error(
        "[PRASUN SHOP] Product load error:",
        error
      );


      const message =
        error?.message ||
        "Unable to load products. Please try again.";


      renderErrorState(
        message
      );


    } finally {

      if (
        activeFetchController ===
        currentController
      ) {

        state.loading =
          false;

        setLoadingState(
          false
        );

        activeFetchController =
          null;

      }

    }

  }


  /* ==========================================================================
     10. EXTRACT PRODUCTS FROM WORKER RESPONSE
     ========================================================================== */

  function extractProducts(
    data
  ) {

    if (!data) {
      return [];
    }


    if (
      Array.isArray(data)
    ) {

      return data;

    }


    if (
      Array.isArray(
        data.products
      )
    ) {

      return data.products;

    }


    if (
      data.data &&
      Array.isArray(
        data.data.list
      )
    ) {

      return data.data.list;

    }


    if (
      data.data &&
      Array.isArray(
        data.data
      )
    ) {

      return data.data;

    }


    return [];

  }


  /* ==========================================================================
     11. IMAGE HELPERS
     ==========================================================================
     
     This is the important CJ image section.
     
     Supported Worker fields:
     
       image
       images[]
       originalImage
       originalImages[]
       bigImage
       productImage
       productImg
       productImageSet[]
     
     No external stock-photo URL is ever used.
     ========================================================================== */

  function normalizeImageUrl(
    rawUrl
  ) {

    if (
      !rawUrl ||
      typeof rawUrl !==
        "string"
    ) {

      return "";

    }


    let image =
      rawUrl.trim();


    if (!image) {
      return "";
    }


    /*
     * Already a local/data image.
     */

    if (
      image.startsWith(
        "data:image/"
      )
    ) {

      return image;

    }


    /*
     * Protocol-relative CJ image.
     */

    if (
      image.startsWith(
        "//"
      )
    ) {

      image =
        `https:${image}`;

    }


    /*
     * Upgrade HTTP → HTTPS.
     */

    if (
      image.startsWith(
        "http://"
      )
    ) {

      image =
        image.replace(
          /^http:\/\//i,
          "https://"
        );

    }


    return image;

  }


  function getWorkerProxyUrl(
    imageUrl
  ) {

    const normalized =
      normalizeImageUrl(
        imageUrl
      );

    if (!normalized) {
      return "";
    }


    /*
     * Already proxied by our Cloudflare Worker.
     */

    if (
      normalized.includes(
        "/api/image-proxy"
      )
    ) {

      return normalized;

    }


    /*
     * Cloudflare Worker image proxy.
     */

    return (
      `${CONFIG.API_BASE}${CONFIG.IMAGE_PROXY_ENDPOINT}` +
      `?url=${encodeURIComponent(
        normalized
      )}`
    );

  }


  function collectImageUrls(
    product
  ) {

    const candidates =
      [];


    /*
     * Worker primary image.
     */

    if (
      product?.image
    ) {

      candidates.push(
        product.image
      );

    }


    /*
     * Worker gallery.
     */

    if (
      Array.isArray(
        product?.images
      )
    ) {

      candidates.push(
        ...product.images
      );

    }


    /*
     * Original CJ image.
     */

    if (
      product?.originalImage
    ) {

      candidates.push(
        product.originalImage
      );

    }


    /*
     * Original CJ gallery.
     */

    if (
      Array.isArray(
        product?.originalImages
      )
    ) {

      candidates.push(
        ...product.originalImages
      );

    }


    /*
     * Raw CJ compatibility fields.
     */

    if (
      product?.bigImage
    ) {

      candidates.push(
        product.bigImage
      );

    }


    if (
      product?.productImage
    ) {

      candidates.push(
        product.productImage
      );

    }


    if (
      product?.productImg
    ) {

      candidates.push(
        product.productImg
      );

    }


    /*
     * Raw CJ gallery.
     */

    if (
      Array.isArray(
        product?.productImageSet
      )
    ) {

      candidates.push(
        ...product.productImageSet
      );

    }


    /*
     * Some APIs return a comma-separated image string.
     */

    if (
      typeof product?.productImageSet ===
        "string"
    ) {

      candidates.push(
        ...product.productImageSet
          .split(",")
          .map(
            image =>
              image.trim()
          )
      );

    }


    const normalized =
      candidates
        .map(
          normalizeImageUrl
        )
        .filter(Boolean);


    /*
     * Remove duplicates while keeping original order.
     */

    return [
      ...new Set(
        normalized
      )
    ];

  }


  function getProductImage(
    product
  ) {

    const imageUrls =
      collectImageUrls(
        product
      );


    /*
     * Prefer an already proxied Worker URL.
     */

    const existingProxy =
      imageUrls.find(
        image =>
          image.includes(
            "/api/image-proxy"
          )
      );


    if (existingProxy) {

      return existingProxy;

    }


    /*
     * Otherwise proxy the first CJ image.
     */

    if (
      imageUrls.length > 0
    ) {

      return getWorkerProxyUrl(
        imageUrls[0]
      );

    }


    /*
     * No CJ image available.
     * Use the local SVG placeholder only.
     */

    return CONFIG.PLACEHOLDER_IMAGE;

  }


  function getProductImages(
    product
  ) {

    const imageUrls =
      collectImageUrls(
        product
      );


    return imageUrls.map(
      image =>
        getWorkerProxyUrl(
          image
        )
    );

  }


  /* ==========================================================================
     12. NORMALIZE PRODUCT
     ========================================================================== */

  function normalizeProduct(
    product
  ) {

    if (
      !product ||
      typeof product !==
        "object"
    ) {

      return null;

    }


    const id =
      String(
        product.id ??
        product.pid ??
        product.sku ??
        product._id ??
        ""
      ).trim();


    const name =
      String(
        product.title ??
        product.name ??
        product.productNameEn ??
        product.productName ??
        "Unnamed Product"
      ).trim();


    if (
      !id ||
      !name
    ) {

      return null;

    }


    /*
     * Price handling.
     */

    let rawPrice =
      product.price ??
      product.sellPrice ??
      product.unitPrice ??
      product.cost ??
      0;


    if (
      typeof rawPrice ===
        "object" &&
      rawPrice !== null
    ) {

      rawPrice =
        rawPrice.amount ??
        rawPrice.value ??
        rawPrice.raw ??
        0;

    }


    let price =
      parseFloat(
        String(
          rawPrice
        ).replace(
          /[^0-9.]/g,
          ""
        )
      );


    if (
      Number.isNaN(price)
    ) {

      price = 0;

    }


    /*
     * CJ image processing.
     */

    const image =
      getProductImage(
        product
      );


    const images =
      getProductImages(
        product
      );


    /*
     * Description.
     *
     * Keep the original CJ description.
     * This may be HTML and can be rendered by product-detail UI.
     */

    const description =
      String(
        product.description ||
        ""
      );


    /*
     * Stock quantity.
     */

    const quantity =
      Number(
        product.quantity ??
        product.inventory ??
        product.totalInventory ??
        product.warehouseInventoryNum ??
        0
      );


    /*
     * Rating.
     *
     * CJ may not provide customer ratings,
     * so this only uses the value when actually present.
     */

    const parsedRating =
      parseFloat(
        product.rating
      );


    const rating =
      Number.isFinite(
        parsedRating
      )
        ? Number(
            Math.max(
              0,
              Math.min(
                5,
                parsedRating
              )
            ).toFixed(1)
          )
        : 0;


    return {

      ...product,

      id,

      pid:
        String(
          product.pid ??
          id
        ),

      sku:
        String(
          product.sku ??
          id
        ),

      name,

      title:
        name,

      description,

      category:
        String(
          product.category ||
          "Home Improvement / Solar"
        ),

      price:
        Number(
          price.toFixed(2)
        ),

      quantity:

        Number.isFinite(
          quantity
        )
          ? quantity
          : 0,

      /*
       * Primary image used by the storefront.
       */

      image,

      /*
       * Full proxied CJ gallery.
       */

      images,

      /*
       * Keep the original CJ image information too.
       */

      originalImage:
        normalizeImageUrl(
          product.originalImage ||
          product.bigImage ||
          product.productImage ||
          ""
        ),

      originalImages:
        Array.isArray(
          product.originalImages
        )
          ? product.originalImages
              .map(
                normalizeImageUrl
              )
              .filter(Boolean)
          : [],

      rating

    };

  }


  /* ==========================================================================
     13. CATEGORY PILLS
     ========================================================================== */

  function renderCategoryPills() {

    const categoriesNav =
      elements.categoriesNav ||
      document.getElementById(
        "products-categories"
      );

    if (
      !categoriesNav
    ) {

      return;

    }


    categoriesNav.innerHTML =
      CATEGORY_MAP
        .map(
          item => {

            const isActive =
              item.query ===
              state.activeCategoryQuery;


            return `
              <button
                type="button"
                class="category-pill${
                  isActive
                    ? " active"
                    : ""
                }"
                data-query="${escapeHtml(
                  item.query
                )}"
                aria-pressed="${
                  isActive
                    ? "true"
                    : "false"
                }"
              >
                ${escapeHtml(
                  item.label
                )}
              </button>
            `;

          }
        )
        .join("");

  }


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


    const query =
      button.dataset.query ??
      "";


    state.activeCategoryQuery =
      query;


    const searchInput =
      elements.searchInput ||
      document.getElementById(
        "product-search"
      );


    if (searchInput) {

      searchInput.value =
        "";

      state.searchQuery =
        "";

      updateClearSearchButton();

    }


    highlightActiveCategoryPill(
      query
    );


    loadProducts(
      query
    );

  }


  function highlightActiveCategoryPill(
    activeQuery
  ) {

    const categoriesNav =
      elements.categoriesNav ||
      document.getElementById(
        "products-categories"
      );


    if (
      !categoriesNav
    ) {

      return;

    }


    categoriesNav
      .querySelectorAll(
        ".category-pill"
      )
      .forEach(
        pill => {

          const isMatch =
            pill.dataset.query ===
            activeQuery;

          pill.classList.toggle(
            "active",
            isMatch
          );

          pill.setAttribute(
            "aria-pressed",
            isMatch
              ? "true"
              : "false"
          );

        }
      );

  }


  /* ==========================================================================
     14. PAGE HEADING
     ========================================================================== */

  function updatePageHeading(
    query
  ) {

    const pageHeading =
      elements.pageHeading ||
      document.getElementById(
        "page-heading"
      );


    if (
      !pageHeading
    ) {

      return;

    }


    if (!query) {

      pageHeading.textContent =
        "Featured Products";

      return;

    }


    const matchedCategory =
      CATEGORY_MAP.find(
        category =>
          category.query ===
          query
      );


    if (
      matchedCategory &&
      matchedCategory.label !==
        "All Items"
    ) {

      pageHeading.textContent =
        matchedCategory.label;

    } else {

      pageHeading.textContent =
        `Search: "${query}"`;

    }

  }


  /* ==========================================================================
     15. FILTERING & SORTING
     ========================================================================== */

  function applyFiltersAndRender() {

    let result =
      [
        ...state.products
      ];


    const activeQuery =
      (
        state.searchQuery ||
        state.activeCategoryQuery ||
        ""
      )
        .toLowerCase()
        .trim();


    /*
     * Search fallback.
     *
     * The Worker already searches title,
     * description, category and SKU.
     * This local filter provides extra compatibility.
     */

    if (activeQuery) {

      result =
        result.filter(
          item => {

            const name =
              String(
                item.name || ""
              ).toLowerCase();

            const title =
              String(
                item.title || ""
              ).toLowerCase();

            const category =
              String(
                item.category || ""
              ).toLowerCase();

            const description =
              String(
                item.description || ""
              ).toLowerCase();

            const sku =
              String(
                item.sku || ""
              ).toLowerCase();


            return (
              name.includes(
                activeQuery
              ) ||

              title.includes(
                activeQuery
              ) ||

              category.includes(
                activeQuery
              ) ||

              description.includes(
                activeQuery
              ) ||

              sku.includes(
                activeQuery
              )
            );

          }
        );

    }


    result.sort(
      sortProducts
    );


    state.filteredProducts =
      result;


    if (
      state.filteredProducts
        .length === 0
    ) {

      const query =
        state.searchQuery ||
        state.activeCategoryQuery;


      renderEmptyState(
        query
          ? `No available items found matching "${escapeHtml(
              query
            )}".`
          : "No active products available at the moment."
      );


      return;

    }


    renderProductGrid();

    updateResultsCount();

  }


  function sortProducts(
    a,
    b
  ) {

    const priceA =
      Number(
        a.price
      ) || 0;

    const priceB =
      Number(
        b.price
      ) || 0;


    const nameA =
      String(
        a.name ||
        a.title ||
        ""
      );

    const nameB =
      String(
        b.name ||
        b.title ||
        ""
      );


    const ratingA =
      Number(
        a.rating
      ) || 0;

    const ratingB =
      Number(
        b.rating
      ) || 0;


    const key =
      String(
        state.sortBy ||
        ""
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );


    /*
     * Low → High.
     */

    if (
      key.includes(
        "lowtohigh"
      ) ||
      key.includes(
        "pricelow"
      ) ||
      key.includes(
        "lowhigh"
      ) ||
      key.includes(
        "priceasc"
      ) ||
      key === "low" ||
      key === "asc" ||
      key === "lh" ||
      key === "1"
    ) {

      return (
        priceA -
        priceB
      );

    }


    /*
     * High → Low.
     */

    if (
      key.includes(
        "hightolow"
      ) ||
      key.includes(
        "pricehigh"
      ) ||
      key.includes(
        "highlow"
      ) ||
      key.includes(
        "pricedesc"
      ) ||
      key === "high" ||
      key === "desc" ||
      key === "hl" ||
      key === "2"
    ) {

      return (
        priceB -
        priceA
      );

    }


    /*
     * A → Z.
     */

    if (
      key.includes(
        "atoz"
      ) ||
      key.includes(
        "az"
      ) ||
      key.includes(
        "nameaz"
      ) ||
      key.includes(
        "titleasc"
      ) ||
      key ===
        "nameasc"
    ) {

      return nameA.localeCompare(
        nameB,
        undefined,
        {
          sensitivity:
            "base"
        }
      );

    }


    /*
     * Z → A.
     */

    if (
      key.includes(
        "ztoa"
      ) ||
      key.includes(
        "za"
      ) ||
      key.includes(
        "nameza"
      ) ||
      key.includes(
        "titledesc"
      ) ||
      key ===
        "namedesc"
    ) {

      return nameB.localeCompare(
        nameA,
        undefined,
        {
          sensitivity:
            "base"
        }
      );

    }


    /*
     * Rating.
     */

    if (
      key.includes(
        "rating"
      ) ||
      key.includes(
        "toprated"
      )
    ) {

      return (
        ratingB -
        ratingA
      );

    }


    /*
     * Featured.
     */

    return 0;

  }


  /* ==========================================================================
     16. PRODUCT GRID
     ========================================================================== */

  function renderProductGrid() {

    const productList =
      elements.productList ||
      document.getElementById(
        "product-list"
      );


    if (
      !productList
    ) {

      return;

    }


    productList.innerHTML =
      state.filteredProducts
        .map(
          renderProductCard
        )
        .join("");


    setLoadingState(
      false
    );


    attachProductImageFallbacks();

  }


  /* ==========================================================================
     17. PRODUCT CARD
     ========================================================================== */

  function renderProductCard(
    product
  ) {

    const safeId =
      escapeHtml(
        String(
          product.id
        )
      );


    const title =
      escapeHtml(
        product.name ||
        "Product"
      );


    const category =
      escapeHtml(
        product.category ||
        "Home Improvement / Solar"
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


    const localProductUrl =
      `${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(
        String(
          product.id
        )
      )}`;


    return `

      <article
        class="product-card"
        data-product-id="${safeId}"
      >

        <a
          class="product-card-image-wrap"
          href="${escapeHtml(
            localProductUrl
          )}"
        >

          <span class="product-badge">
            ${category}
          </span>

          <img
            src="${image}"
            alt="${title}"
            class="product-image"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            data-original-image="${escapeHtml(
              product.originalImage ||
              ""
            )}"
          >

        </a>


        <div class="product-card-body">

          <h3 class="product-title">

            <a
              href="${escapeHtml(
                localProductUrl
              )}"
            >
              ${title}
            </a>

          </h3>


          ${
            rating > 0
              ? `
                <div
                  class="product-rating"
                  aria-label="Rating ${rating.toFixed(
                    1
                  )} out of 5"
                >
                  <span aria-hidden="true">
                    ★
                  </span>

                  ${rating.toFixed(1)}
                </div>
              `
              : ""
          }


          <div class="product-card-footer">

            <div class="price-container">

              <span class="product-price">
                ${escapeHtml(
                  price
                )}
              </span>

            </div>


            <div class="product-actions-group">

              <a
                href="${escapeHtml(
                  localProductUrl
                )}"
                class="btn-card btn-secondary"
              >
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
     18. IMAGE FALLBACKS
     ========================================================================== */

  function attachProductImageFallbacks() {

    const images =
      document.querySelectorAll(
        ".product-image"
      );


    images.forEach(
      image => {

        image.addEventListener(
          "error",
          function handleImageError() {

            /*
             * First attempt:
             * original CJ image through Cloudflare proxy.
             */

            const original =
              this.dataset.originalImage;


            if (
              original &&
              !this.dataset.originalAttempted
            ) {

              this.dataset.originalAttempted =
                "true";


              const proxied =
                getWorkerProxyUrl(
                  original
                );


              if (
                proxied &&
                proxied !==
                  this.src
              ) {

                this.src =
                  proxied;

                return;

              }

            }


            /*
             * Final fallback:
             * local inline SVG only.
             *
             * No Unsplash.
             * No external stock-image provider.
             */

            if (
              !this.dataset.placeholderUsed
            ) {

              this.dataset.placeholderUsed =
                "true";

              this.src =
                CONFIG.PLACEHOLDER_IMAGE;

            }

          }
        );

      }
    );

  }


  /* ==========================================================================
     19. CART
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


    const product =
      state.products.find(
        item =>
          String(
            item.id
          ) ===
          String(
            productId
          )
      );


    if (!product) {
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

      const cartEvent =
        new CustomEvent(
          "cart:add",
          {
            detail:
              product
          }
        );


      document.dispatchEvent(
        cartEvent
      );


      window.dispatchEvent(
        cartEvent
      );

    }


    const originalText =
      button.textContent;


    button.disabled =
      true;


    button.textContent =
      "Added!";


    window.setTimeout(
      () => {

        button.disabled =
          false;

        button.textContent =
          originalText;

      },
      1000
    );


    announceToScreenReader(
      `${product.name} added to cart.`
    );

  }


  /* ==========================================================================
     20. UI STATES
     ========================================================================== */

  function showLoadingState() {

    const productList =
      elements.productList ||
      document.getElementById(
        "product-list"
      );


    if (
      !productList
    ) {

      return;

    }


    productList.innerHTML = `

      <div
        class="product-status-card products-empty"
        role="status"
      >

        <div
          class="spinner"
          aria-hidden="true"
        ></div>

        <h3>
          Fetching available products...
        </h3>

        <p>
          Connecting to CJ-powered catalog...
        </p>

      </div>

    `;


    const resultsCount =
      elements.resultsCount ||
      document.getElementById(
        "results-count"
      );


    if (
      resultsCount
    ) {

      resultsCount.textContent =
        "Loading...";

    }

  }


  function setLoadingState(
    isLoading
  ) {

    const productList =
      elements.productList ||
      document.getElementById(
        "product-list"
      );


    if (
      !productList
    ) {

      return;

    }


    productList.setAttribute(
      "aria-busy",
      isLoading
        ? "true"
        : "false"
    );

  }


  function renderEmptyState(
    message
  ) {

    const productList =
      elements.productList ||
      document.getElementById(
        "product-list"
      );


    if (
      !productList
    ) {

      return;

    }


    productList.innerHTML = `

      <div
        class="product-status-card products-empty"
        role="status"
      >

        <h3>
          No Products Found
        </h3>

        <p>
          ${escapeHtml(
            message
          )}
        </p>

      </div>

    `;


    const resultsCount =
      elements.resultsCount ||
      document.getElementById(
        "results-count"
      );


    if (
      resultsCount
    ) {

      resultsCount.textContent =
        "0 products found";

    }


    setLoadingState(
      false
    );

  }


  function renderErrorState(
    message
  ) {

    const productList =
      elements.productList ||
      document.getElementById(
        "product-list"
      );


    if (
      !productList
    ) {

      return;

    }


    productList.innerHTML = `

      <div
        class="product-status-card products-error"
        role="alert"
      >

        <h3>
          Unable to Load Products
        </h3>

        <p>
          ${escapeHtml(
            message
          )}
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


    const resultsCount =
      elements.resultsCount ||
      document.getElementById(
        "results-count"
      );


    if (
      resultsCount
    ) {

      resultsCount.textContent =
        "Error loading products";

    }


    setLoadingState(
      false
    );


    const retryButton =
      productList.querySelector(
        '[data-action="retry-products"]'
      );


    if (
      retryButton
    ) {

      retryButton.addEventListener(
        "click",
        () =>
          loadProducts(),
        {
          once: true
        }
      );

    }

  }


  function updateResultsCount() {

    const resultsCount =
      elements.resultsCount ||
      document.getElementById(
        "results-count"
      );


    if (
      !resultsCount
    ) {

      return;

    }


    const count =
      state.filteredProducts.length;


    resultsCount.textContent =
      `${count} ${
        count === 1
          ? "product"
          : "products"
      } available`;

  }


  function formatPrice(
    amount
  ) {

    const value =
      Number(amount);


    if (
      !Number.isFinite(
        value
      )
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
    ).format(
      value
    );

  }


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


  function announceToScreenReader(
    message
  ) {

    const liveRegion =
      elements.liveRegion ||
      document.getElementById(
        "aria-live-region"
      );


    if (
      !liveRegion
    ) {

      return;

    }


    liveRegion.textContent =
      "";


    window.setTimeout(
      () => {

        liveRegion.textContent =
          String(
            message || ""
          );

      },
      30
    );

  }


  /* ==========================================================================
     21. PUBLIC API
     ========================================================================== */

  window.PrasunProducts = {

    reload:
      loadProducts,

    sort:
      sortValue => {

        state.sortBy =
          sortValue;

        applyFiltersAndRender();

      },

    getProducts:
      () =>
        [
          ...state.products
        ],

    getFilteredProducts:
      () =>
        [
          ...state.filteredProducts
        ],

    getProductById:
      id =>
        state.products.find(
          product =>
            String(
              product.id
            ) ===
            String(id)
        ) || null

  };

})();
