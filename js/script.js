/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & SITE INTERACTIVITY
 * ============================================================================
 *
 * Frontend product catalog.
 *
 * IMPORTANT:
 * - CJ credentials are NEVER used here.
 * - Product data comes from the Cloudflare Worker.
 * - Worker endpoint: /api/products
 * - Search: /api/products?keyword=...
 * - Cart key: prasun_cart
 * - Product detail URL: product.html?id=<product-id>
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
    ======================================================================== */

    const API_ENDPOINT = "/api/products";

    const CART_KEY = "prasun_cart";

    const PRODUCT_DETAIL_PAGE = "product.html";


    /* ========================================================================
       DOM
    ======================================================================== */

    const productGrid =
        document.getElementById("product-grid");

    const searchForm =
        document.getElementById("product-search-form");

    const searchInput =
        document.getElementById("product-search");

    const resultsCount =
        document.getElementById("results-count");

    const clearSearchButton =
        document.getElementById("clear-search");

    const cartCount =
        document.getElementById("cart-count");


    /*
     * This script is also allowed to exist on other pages.
     * If the product grid does not exist, only initialize the cart badge.
     */

    if (!productGrid) {
        updateCartCount();
        return;
    }


    /* ========================================================================
       STATE
    ======================================================================== */

    let currentProducts = [];

    let currentKeyword = "";

    let requestController = null;

    let searchTimer = null;


    /* ========================================================================
       CURRENCY FORMATTER
    ======================================================================== */

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


    /* ========================================================================
       HTML ESCAPING
    ======================================================================== */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    const ESCAPE_REGEX =
        /[&<>"']/g;


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).replace(
            ESCAPE_REGEX,
            match => ESCAPE_MAP[match]
        );
    }


    /* ========================================================================
       URL ESCAPING
    ======================================================================== */

    function productURL(id) {

        return (
            PRODUCT_DETAIL_PAGE +
            "?id=" +
            encodeURIComponent(String(id))
        );
    }


    /* ========================================================================
       FALLBACK IMAGE
    ======================================================================== */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="600"
                height="600"
                viewBox="0 0 600 600"
            >
                <rect
                    width="600"
                    height="600"
                    fill="#f4f4f5"
                />

                <text
                    x="300"
                    y="300"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#a1a1aa"
                    font-family="Arial, sans-serif"
                    font-size="24"
                >
                    Image unavailable
                </text>
            </svg>
        `);


    /* ========================================================================
       NORMALIZE PRODUCT
    ======================================================================== */

    function normalizeProduct(raw) {

        if (
            !raw ||
            (
                raw.id === undefined &&
                raw.pid === undefined
            )
        ) {
            return null;
        }


        const id =
            raw.id ??
            raw.pid;


        const price =
            Number(
                raw.price ??
                raw.sellPrice ??
                raw.startSellPrice ??
                0
            );


        const ratingValue =
            Number(
                raw.rating
            );


        const image =
            raw.image ||
            raw.productImage ||
            "";


        return {

            id: String(id),

            sku: String(
                raw.sku ||
                raw.productSku ||
                id ||
                "N/A"
            ),

            name: String(
                raw.name ||
                raw.productNameEn ||
                raw.productName ||
                raw.title ||
                "Untitled Product"
            ),

            category: String(
                raw.category ||
                raw.categoryName ||
                "General"
            ),

            price:
                Number.isFinite(price) && price >= 0
                    ? price
                    : 0,

            rating:
                Number.isFinite(ratingValue)
                    ? ratingValue
                    : 5,

            image: String(image),

            description: String(
                raw.description ||
                raw.productDescription ||
                "No product description available."
            )
        };
    }


    /* ========================================================================
       API RESPONSE NORMALIZATION
    ======================================================================== */

    function extractProductList(data) {

        if (Array.isArray(data)) {
            return data;
        }


        if (
            data &&
            Array.isArray(data.data)
        ) {
            return data.data;
        }


        if (
            data &&
            data.data &&
            Array.isArray(data.data.list)
        ) {
            return data.data.list;
        }


        if (
            data &&
            Array.isArray(data.list)
        ) {
            return data.list;
        }


        if (
            data &&
            data.data &&
            Array.isArray(data.data.products)
        ) {
            return data.data.products;
        }


        if (
            data &&
            Array.isArray(data.products)
        ) {
            return data.products;
        }


        return [];
    }


    /* ========================================================================
       CART
    ======================================================================== */

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


            if (!Array.isArray(parsed)) {
                return [];
            }


            return parsed;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
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
                (sum, item) => {

                    const quantity =
                        Number(
                            item?.quantity
                        );


                    return sum +
                        (
                            Number.isFinite(quantity) &&
                            quantity > 0
                                ? Math.floor(quantity)
                                : 1
                        );

                },
                0
            );


        cartCount.textContent =
            String(total);


        cartCount.hidden =
            total === 0;


        const cartLink =
            cartCount.closest("a");


        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    /* ========================================================================
       PRODUCT CARD
    ======================================================================== */

    function renderProductCard(product) {

        const id =
            escapeHTML(product.id);


        const name =
            escapeHTML(product.name);


        const category =
            escapeHTML(product.category);


        const description =
            escapeHTML(product.description);


        const sku =
            escapeHTML(product.sku);


        const image =
            escapeHTML(
                product.image ||
                FALLBACK_IMAGE
            );


        const url =
            productURL(product.id);


        const rating =
            Number.isFinite(
                Number(product.rating)
            )
                ? Number(product.rating).toFixed(1)
                : "5.0";


        return `

            <article
                class="product-card"
                data-product-id="${id}"
            >

                <a
                    href="${url}"
                    class="product-image-link"
                    aria-label="View ${name}"
                >

                    <img
                        class="product-image"
                        src="${image}"
                        alt="${name}"
                        loading="lazy"
                        decoding="async"
                        data-fallback-applied="false"
                    >

                </a>


                <div class="product-card-body">

                    <div class="product-category">
                        ${category}
                    </div>


                    <h2 class="product-name">

                        <a href="${url}">
                            ${name}
                        </a>

                    </h2>


                    <p class="product-description">
                        ${description}
                    </p>


                    <div class="product-bottom">

                        <div>

                            <div class="product-price">
                                ${formatPrice(product.price)}
                            </div>

                            <div class="product-rating">
                                ★ ${rating}
                            </div>

                        </div>


                        <a
                            href="${url}"
                            class="product-action"
                            aria-label="View ${name}"
                        >
                            View Product
                        </a>

                    </div>

                </div>

            </article>

        `;
    }


    /* ========================================================================
       RENDER PRODUCT GRID
    ======================================================================== */

    function renderProducts(products) {

        if (!Array.isArray(products)) {
            products = [];
        }


        currentProducts =
            products
                .map(normalizeProduct)
                .filter(Boolean);


        productGrid.setAttribute(
            "aria-busy",
            "false"
        );


        if (!currentProducts.length) {

            productGrid.innerHTML = `

                <div class="products-state">

                    <h2>
                        ${
                            currentKeyword
                                ? "No products found"
                                : "No products available"
                        }
                    </h2>

                    <p>
                        ${
                            currentKeyword
                                ? `No products matched "${escapeHTML(currentKeyword)}".`
                                : "There are currently no products to display."
                        }
                    </p>

                    ${
                        currentKeyword
                            ? `
                                <button
                                    type="button"
                                    class="retry-button"
                                    id="empty-clear-search"
                                >
                                    Clear Search
                                </button>
                            `
                            : ""
                    }

                </div>
            `;


            updateResultsCount(0);

            return;
        }


        productGrid.innerHTML =
            currentProducts
                .map(renderProductCard)
                .join("");


        updateResultsCount(
            currentProducts.length
        );


        repairProductImages();
    }


    /* ========================================================================
       RESULT COUNT
    ======================================================================== */

    function updateResultsCount(count) {

        if (!resultsCount) {
            return;
        }


        if (currentKeyword) {

            resultsCount.textContent =
                `${count} ${count === 1 ? "product" : "products"} found for "${currentKeyword}"`;

        } else {

            resultsCount.textContent =
                `${count} ${count === 1 ? "product" : "products"}`;
        }


        if (clearSearchButton) {

            clearSearchButton.hidden =
                !currentKeyword;
        }
    }


    /* ========================================================================
       LOADING STATE
    ======================================================================== */

    function showLoadingState() {

        productGrid.setAttribute(
            "aria-busy",
            "true"
        );


        productGrid.innerHTML = `

            <div class="products-state">

                <div
                    class="spinner"
                    aria-hidden="true"
                ></div>

                <h2>
                    Loading products
                </h2>

                <p>
                    Fetching the latest product catalog...
                </p>

            </div>
        `;


        if (resultsCount) {

            resultsCount.textContent =
                "Loading products...";
        }
    }


    /* ========================================================================
       ERROR STATE
    ======================================================================== */

    function showErrorState(message) {

        productGrid.setAttribute(
            "aria-busy",
            "false"
        );


        productGrid.innerHTML = `

            <div class="products-state">

                <h2>
                    Unable to load products
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    class="retry-button"
                    id="retry-products"
                >
                    Try Again
                </button>

            </div>
        `;


        if (resultsCount) {

            resultsCount.textContent =
                "Unable to load products";
        }
    }


    /* ========================================================================
       IMAGE FALLBACK
    ======================================================================== */

    function repairProductImages() {

        const images =
            productGrid.querySelectorAll(
                "img.product-image"
            );


        images.forEach(image => {

            image.addEventListener(
                "error",
                () => {

                    if (
                        image.dataset.fallbackApplied ===
                        "true"
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

        });
    }


    /* ========================================================================
       FETCH PRODUCTS
    ======================================================================== */

    async function fetchProducts(
        keyword = ""
    ) {

        currentKeyword =
            String(keyword || "").trim();


        if (requestController) {

            requestController.abort();
        }


        requestController =
            new AbortController();


        showLoadingState();


        try {

            const url =
                new URL(
                    API_ENDPOINT,
                    window.location.origin
                );


            if (currentKeyword) {

                url.searchParams.set(
                    "keyword",
                    currentKeyword
                );
            }


            const response =
                await fetch(
                    url.toString(),
                    {
                        method: "GET",
                        headers: {
                            "Accept":
                                "application/json"
                        },
                        signal:
                            requestController.signal,
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Server returned HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            const rawProducts =
                extractProductList(data);


            /*
             * Worker currently returns an array directly.
             *
             * This code also accepts common wrapped
             * response formats so the frontend remains
             * tolerant of harmless API response changes.
             */

            renderProducts(
                rawProducts
            );


        } catch (error) {

            if (
                error &&
                error.name === "AbortError"
            ) {
                return;
            }


            console.error(
                "[PRASUN SHOP] Product API error:",
                error
            );


            showErrorState(
                "The product service could not be reached. Please try again."
            );

        } finally {

            requestController =
                null;
        }
    }


    /* ========================================================================
       SEARCH SUBMIT
    ======================================================================== */

    if (searchForm) {

        searchForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                const keyword =
                    searchInput
                        ? searchInput.value.trim()
                        : "";


                fetchProducts(
                    keyword
                );
            }
        );
    }


    /* ========================================================================
       LIVE SEARCH
       ======================================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimer
                );


                searchTimer =
                    setTimeout(
                        () => {

                            const keyword =
                                searchInput.value.trim();


                            /*
                             * Avoid unnecessary API calls
                             * for the same keyword.
                             */

                            if (
                                keyword ===
                                currentKeyword
                            ) {
                                return;
                            }


                            fetchProducts(
                                keyword
                            );

                        },
                        450
                    );
            }
        );
    }


    /* ========================================================================
       CLEAR SEARCH
    ======================================================================== */

    function clearSearch() {

        if (searchInput) {

            searchInput.value =
                "";
        }


        fetchProducts(
            ""
        );
    }


    if (clearSearchButton) {

        clearSearchButton.addEventListener(
            "click",
            clearSearch
        );
    }


    /* ========================================================================
       GRID ACTIONS
    ======================================================================== */

    productGrid.addEventListener(
        "click",
        event => {

            const retryButton =
                event.target.closest(
                    "#retry-products"
                );


            if (retryButton) {

                fetchProducts(
                    currentKeyword
                );

                return;
            }


            const emptyClearButton =
                event.target.closest(
                    "#empty-clear-search"
                );


            if (emptyClearButton) {

                clearSearch();

                return;
            }
        }
    );


    /* ========================================================================
       CART SYNCHRONIZATION
    ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                CART_KEY
            ) {

                updateCartCount();
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        () => {

            updateCartCount();
        }
    );


    /* ========================================================================
       INITIALIZATION
    ======================================================================== */

    updateCartCount();

    fetchProducts("");

})();
