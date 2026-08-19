/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS
 * ============================================================================
 *
 * Single API:
 *
 *     /api/products
 *
 * Single cart:
 *
 *     prasun_cart
 *
 * Product schema:
 *
 * {
 *   id,
 *   sku,
 *   name,
 *   category,
 *   price,
 *   rating,
 *   image,
 *   description
 * }
 * ============================================================================
 */

"use strict";

(() => {

  /* ==========================================================================
     CONFIG
     ========================================================================== */

  const API_ENDPOINT = "/api/products";

  const CART_KEY = "prasun_cart";

  const MAX_QUANTITY = 10;


  /* ==========================================================================
     DOM
     ========================================================================== */

  const container =
    document.getElementById(
      "products-container"
    );

  if (!container) {
    return;
  }


  const searchInput =
    document.getElementById(
      "products-search"
    );

  const sortSelect =
    document.getElementById(
      "products-sort"
    );

  const categoryContainer =
    document.getElementById(
      "products-categories"
    );

  const resultCount =
    document.getElementById(
      "products-result-count"
    );

  const cartCount =
    document.getElementById(
      "cart-count"
    );


  /* ==========================================================================
     STATE
     ========================================================================== */

  let allProducts = [];

  let filteredProducts = [];

  let activeCategory = "All";

  let searchTimer = null;


  /* ==========================================================================
     CURRENCY
     ========================================================================== */

  const currencyFormatter =
    new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );


  function formatPrice(value) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? currencyFormatter.format(number)
      : "$0.00";
  }


  /* ==========================================================================
     HTML ESCAPE
     ========================================================================== */

  function escapeHTML(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* ==========================================================================
     IMAGE FALLBACK
     ========================================================================== */

  const FALLBACK_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="500"
        height="500"
        viewBox="0 0 500 500"
      >
        <rect
          width="500"
          height="500"
          fill="#f1f5f9"
        />

        <text
          x="250"
          y="250"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#94a3b8"
          font-family="Arial, sans-serif"
          font-size="18"
        >
          Image unavailable
        </text>
      </svg>
    `);


  /* ==========================================================================
     NORMALIZE PRODUCT
     ========================================================================== */

  function normalizeProduct(item) {

    if (!item) {
      return null;
    }

    const id =
      item.id ??
      item.pid ??
      item.productSku;

    if (
      id === undefined ||
      id === null
    ) {
      return null;
    }

    const price =
      Number(
        item.price ??
        item.sellPrice ??
        0
      );

    const rating =
      Number(item.rating);

    return {

      id:
        String(id),

      sku:
        String(
          item.sku ||
          item.productSku ||
          item.pid ||
          id
        ),

      name:
        String(
          item.name ||
          item.productNameEn ||
          item.productName ||
          item.title ||
          "Untitled Product"
        ),

      category:
        String(
          item.category ||
          item.categoryName ||
          "General"
        ),

      price:
        Number.isFinite(price)
          ? price
          : 0,

      rating:
        Number.isFinite(rating)
          ? rating
          : 5,

      image:
        String(
          item.image ||
          item.productImage ||
          ""
        ),

      description:
        String(
          item.description ||
          item.productDescription ||
          "No product description available."
        )
    };
  }


  /* ==========================================================================
     CART
     ========================================================================== */

  function getCart() {

    try {

      const stored =
        localStorage.getItem(
          CART_KEY
        );

      if (!stored) {
        return [];
      }

      const parsed =
        JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (error) {

      console.error(
        "[PRASUN SHOP] Cart read error:",
        error
      );

      return [];
    }
  }


  function saveCart(cart) {

    try {

      localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
      );

      window.dispatchEvent(
        new CustomEvent(
          "prasunCartUpdated",
          {
            detail: {
              cart: [...cart]
            }
          }
        )
      );

      return true;

    } catch (error) {

      console.error(
        "[PRASUN SHOP] Cart save error:",
        error
      );

      return false;
    }
  }


  function updateCartCount() {

    if (!cartCount) {
      return;
    }

    const cart =
      getCart();

    const total =
      cart.reduce(
        (sum, item) =>
          sum +
          (
            Number(item.quantity) > 0
              ? Number(item.quantity)
              : 1
          ),
        0
      );

    cartCount.textContent =
      String(total);

    cartCount.hidden =
      total === 0;
  }


  function addToCart(product) {

    const cart =
      getCart();

    const productId =
      String(product.id);

    const existing =
      cart.find(
        item =>
          String(item.id) ===
          productId
      );

    if (existing) {

      existing.quantity =
        Math.min(
          MAX_QUANTITY,
          (
            Number(existing.quantity) ||
            1
          ) + 1
        );

    } else {

      cart.push({

        id:
          product.id,

        name:
          product.name,

        price:
          product.price,

        image:
          product.image,

        category:
          product.category,

        description:
          product.description,

        rating:
          product.rating,

        quantity:
          1
      });
    }

    if (
      saveCart(cart)
    ) {

      updateCartCount();

      return true;
    }

    return false;
  }


  /* ==========================================================================
     LOADING STATE
     ========================================================================== */

  function renderLoading() {

    container.innerHTML = `

      <div class="products-loading">

        <div class="loading-spinner"></div>

        <p>
          Loading products...
        </p>

      </div>

    `;

    if (resultCount) {
      resultCount.textContent =
        "Loading products...";
    }
  }


  /* ==========================================================================
     ERROR STATE
     ========================================================================== */

  function renderError(message) {

    container.innerHTML = `

      <div class="products-error">

        <h2>
          Unable to load products
        </h2>

        <p>
          ${escapeHTML(message)}
        </p>

        <button
          type="button"
          id="retry-products"
          class="products-retry-button"
        >
          Try Again
        </button>

      </div>

    `;

    if (resultCount) {
      resultCount.textContent =
        "Products unavailable";
    }

    const retry =
      document.getElementById(
        "retry-products"
      );

    if (retry) {

      retry.addEventListener(
        "click",
        loadProducts
      );
    }
  }


  /* ==========================================================================
     LOAD PRODUCTS
     ========================================================================== */

  async function loadProducts() {

    renderLoading();

    try {

      const response =
        await fetch(
          API_ENDPOINT,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept:
                "application/json"
            }
          }
        );

      if (!response.ok) {

        throw new Error(
          `Server returned HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      /*
       * IMPORTANT:
       * Worker now returns:
       *
       * {
       *   success: true,
       *   products: [...]
       * }
       */

      const rawProducts =
        Array.isArray(data.products)
          ? data.products
          : [];

      allProducts =
        rawProducts
          .map(normalizeProduct)
          .filter(Boolean);

      if (!allProducts.length) {

        renderEmptyProducts();

        return;
      }

      buildCategories();

      applyFilters();

    } catch (error) {

      console.error(
        "[PRASUN SHOP] Product API error:",
        error
      );

      renderError(
        "The product service could not be reached. Please try again."
      );
    }
  }


  /* ==========================================================================
     EMPTY PRODUCTS
     ========================================================================== */

  function renderEmptyProducts() {

    container.innerHTML = `

      <div class="products-empty">

        <h2>
          No products found
        </h2>

        <p>
          There are currently no products to display.
        </p>

      </div>

    `;

    if (resultCount) {
      resultCount.textContent =
        "0 products";
    }
  }


  /* ==========================================================================
     CATEGORIES
     ========================================================================== */

  function buildCategories() {

    if (!categoryContainer) {
      return;
    }

    const categories =
      [
        ...new Set(
          allProducts
            .map(
              product =>
                product.category
            )
            .filter(Boolean)
        )
      ]
      .sort(
        (a, b) =>
          a.localeCompare(b)
      );

    categoryContainer.innerHTML = `

      <button
        type="button"
        class="category-pill active"
        data-category="All"
      >
        All
      </button>

      ${
        categories
          .map(
            category => `

              <button
                type="button"
                class="category-pill"
                data-category="${escapeHTML(category)}"
              >
                ${escapeHTML(category)}
              </button>

            `
          )
          .join("")
      }

    `;
  }


  /* ==========================================================================
     FILTER + SORT
     ========================================================================== */

  function applyFilters() {

    const searchTerm =
      (
        searchInput?.value ||
        ""
      )
      .trim()
      .toLowerCase();

    filteredProducts =
      allProducts.filter(
        product => {

          const matchesSearch =
            !searchTerm ||

            product.name
              .toLowerCase()
              .includes(searchTerm) ||

            product.category
              .toLowerCase()
              .includes(searchTerm) ||

            product.sku
              .toLowerCase()
              .includes(searchTerm);

          const matchesCategory =
            activeCategory === "All" ||
            product.category ===
              activeCategory;

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );

    const sort =
      sortSelect?.value ||
      "default";

    if (sort === "price-low") {

      filteredProducts.sort(
        (a, b) =>
          a.price - b.price
      );

    } else if (
      sort === "price-high"
    ) {

      filteredProducts.sort(
        (a, b) =>
          b.price - a.price
      );

    } else if (
      sort === "name"
    ) {

      filteredProducts.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );
    }

    renderProducts();
  }


  /* ==========================================================================
     PRODUCT CARD
     ========================================================================== */

  function renderProducts() {

    if (!filteredProducts.length) {

      container.innerHTML = `

        <div class="products-empty">

          <h2>
            No matching products
          </h2>

          <p>
            Try a different search term or category.
          </p>

        </div>

      `;

      if (resultCount) {

        resultCount.textContent =
          "0 products";
      }

      return;
    }


    if (resultCount) {

      resultCount.textContent =
        `${filteredProducts.length} ${
          filteredProducts.length === 1
            ? "product"
            : "products"
        }`;
    }


    container.innerHTML =
      filteredProducts
        .map(
          product =>
            createProductCard(
              product
            )
        )
        .join("");


    attachImageFallbacks();
  }


  /* ==========================================================================
     CREATE CARD
     ========================================================================== */

  function createProductCard(product) {

    const id =
      encodeURIComponent(
        product.id
      );

    const name =
      escapeHTML(
        product.name
      );

    const category =
      escapeHTML(
        product.category
      );

    const image =
      escapeHTML(
        product.image ||
        FALLBACK_IMAGE
      );

    const description =
      escapeHTML(
        product.description
      );

    const rating =
      Number(product.rating)
        .toFixed(1);

    return `

      <article
        class="product-card"
        data-product-id="${escapeHTML(product.id)}"
      >

        <div class="product-card-inner">

          <a
            href="product.html?id=${id}"
            class="product-card-link"
            aria-label="View ${name}"
          >

            <div class="product-card-image">

              ${
                category
                  ? `
                    <span class="product-category">
                      ${category}
                    </span>
                  `
                  : ""
              }

              <img
                src="${image}"
                alt="${name}"
                loading="lazy"
                decoding="async"
              >

            </div>


            <div class="product-card-body">

              <span class="product-rating">
                ★ ${rating}
              </span>


              <h2 class="product-title">
                ${name}
              </h2>


              <p class="product-description">
                ${description}
              </p>


              <div class="product-bottom">

                <span class="product-price">
                  ${formatPrice(product.price)}
                </span>

                <span class="product-view-button">
                  View →
                </span>

              </div>

            </div>

          </a>


          <div class="product-card-actions">

            <button
              type="button"
              class="btn-add-to-cart"
              data-product-id="${escapeHTML(product.id)}"
            >
              Add to Cart
            </button>

          </div>

        </div>

      </article>

    `;
  }


  /* ==========================================================================
     IMAGE FALLBACKS
     ========================================================================== */

  function attachImageFallbacks() {

    const images =
      container.querySelectorAll(
        "img"
      );

    images.forEach(
      image => {

        image.addEventListener(
          "error",
          () => {

            if (
              image.dataset.fallbackApplied
            ) {
              return;
            }

            image.dataset.fallbackApplied =
              "true";

            image.src =
              FALLBACK_IMAGE;
          },
          {
            once: true
          }
        );

      }
    );
  }


  /* ==========================================================================
     EVENTS
     ========================================================================== */

  container.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".btn-add-to-cart"
        );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const id =
        String(
          button.dataset.productId
        );

      const product =
        allProducts.find(
          item =>
            String(item.id) === id
        );

      if (!product) {
        return;
      }

      if (
        addToCart(product)
      ) {

        const originalText =
          button.textContent;

        button.textContent =
          "Added ✓";

        button.disabled =
          true;

        setTimeout(
          () => {

            button.textContent =
              originalText;

            button.disabled =
              false;

          },
          1000
        );
      }
    }
  );


  if (categoryContainer) {

    categoryContainer.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-category]"
          );

        if (!button) {
          return;
        }

        activeCategory =
          button.dataset.category ||
          "All";

        categoryContainer
          .querySelectorAll(
            ".category-pill"
          )
          .forEach(
            pill => {

              pill.classList.toggle(
                "active",
                pill === button
              );
            }
          );

        applyFilters();
      }
    );
  }


  if (searchInput) {

    searchInput.addEventListener(
      "input",
      () => {

        clearTimeout(
          searchTimer
        );

        searchTimer =
          setTimeout(
            applyFilters,
            150
          );
      }
    );
  }


  if (sortSelect) {

    sortSelect.addEventListener(
      "change",
      applyFilters
    );
  }


  /* ==========================================================================
     CART SYNCHRONIZATION
     ========================================================================== */

  window.addEventListener(
    "storage",
    event => {

      if (
        event.key === CART_KEY
      ) {

        updateCartCount();
      }
    }
  );


  window.addEventListener(
    "prasunCartUpdated",
    updateCartCount
  );


  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */

  updateCartCount();

  loadProducts();

})();
