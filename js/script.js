/**
 * ============================================================================
 * PRASUN SHOP — Product Catalog
 * js/script.js
 * ============================================================================
 *
 * Responsibilities:
 * - Load products from Cloudflare Worker
 * - Server-side CJ search
 * - Category filtering
 * - Sorting
 * - Product rendering
 * - Image fallback
 * - Clear search
 * - Accessible loading states
 *
 * Expected backend:
 *
 * GET /api/products
 * GET /api/products?size=20
 * GET /api/products?keyword=lamp&size=20
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIG
       ========================================================================= */

    const CONFIG = {

        API_ENDPOINT: "/api/products",

        DEFAULT_SIZE: 20,

        SEARCH_SIZE: 20,

        SEARCH_DELAY: 400,

        FALLBACK_IMAGE:
            "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f5f5f7'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2386868b' font-family='Arial,sans-serif' font-size='24'%3ENo Image Available%3C/text%3E%3C/svg%3E"
    };


    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {

        products: [],

        category: "all",

        search: "",

        sort: "featured",

        searchTimer: null,

        requestController: null

    };


    /* =========================================================================
       DOM
       ========================================================================= */

    const DOM = {

        grid: null,

        searchInput: null,

        clearButton: null,

        sortSelect: null,

        resultCount: null,

        heading: null,

        liveRegion: null,

        categoryButtons: []

    };


    /* =========================================================================
       DOM CACHE
       ========================================================================= */

    function cacheDOM() {

        DOM.grid =
            document.getElementById("product-list");

        DOM.searchInput =
            document.getElementById("product-search");

        DOM.clearButton =
            document.getElementById("search-clear");

        DOM.sortSelect =
            document.getElementById("product-sort");

        DOM.resultCount =
            document.getElementById("results-count");

        DOM.heading =
            document.getElementById("page-heading");

        DOM.liveRegion =
            document.getElementById("a11y-status-region");

        DOM.categoryButtons =
            Array.from(
                document.querySelectorAll(".category-pill")
            );
    }


    /* =========================================================================
       HTML ESCAPING
       ========================================================================= */

    const ESCAPE_MAP = {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

    };

    const ESCAPE_REGEX = /[&<>"']/g;


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).replace(
            ESCAPE_REGEX,
            character => ESCAPE_MAP[character]
        );
    }


    /* =========================================================================
       NORMALIZE API RESPONSE
       ========================================================================= */

    function extractProductArray(data) {

        if (Array.isArray(data)) {

            return data;
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
            data.data &&
            Array.isArray(data.data)
        ) {

            return data.data;
        }

        if (
            data &&
            Array.isArray(data.list)
        ) {

            return data.list;
        }

        return [];
    }


    /* =========================================================================
       NORMALIZE PRODUCT
       ========================================================================= */

    function normalizeProduct(raw) {

        if (!raw || typeof raw !== "object") {
            return null;
        }

        const id =
            raw.pid ??
            raw.id ??
            raw.productId ??
            raw.sku ??
            "";

        if (!id) {
            return null;
        }

        const name = String(
            raw.productNameEn ??
            raw.productName ??
            raw.name ??
            raw.title ??
            "Untitled Product"
        ).trim();

        const priceValue = Number(
            raw.sellPrice ??
            raw.price ??
            raw.salePrice ??
            0
        );

        const image = String(
            raw.productImage ??
            raw.image ??
            raw.productImageUrl ??
            raw.imageUrl ??
            ""
        ).trim();

        const category = String(
            raw.categoryName ??
            raw.category ??
            raw.productCategory ??
            "General"
        ).trim();

        const description = String(
            raw.description ??
            raw.productDescription ??
            raw.productDesc ??
            ""
        ).trim();

        const ratingValue = Number(
            raw.rating ??
            raw.score ??
            5
        );

        const sku = String(
            raw.sku ??
            raw.productSku ??
            id
        );

        return {

            id: String(id),

            sku,

            name,

            price:
                Number.isFinite(priceValue)
                    ? priceValue
                    : 0,

            image,

            category,

            description,

            rating:
                Number.isFinite(ratingValue)
                    ? ratingValue
                    : 5

        };
    }


    /* =========================================================================
       NORMALIZE PRODUCT LIST
       ========================================================================= */

    function normalizeProducts(rawProducts) {

        return rawProducts
            .map(normalizeProduct)
            .filter(Boolean);
    }


    /* =========================================================================
       BUILD API URL
       ========================================================================= */

    function buildProductsURL(keyword = "") {

        const params = new URLSearchParams();

        params.set(
            "size",
            keyword
                ? CONFIG.SEARCH_SIZE
                : CONFIG.DEFAULT_SIZE
        );

        if (keyword) {

            params.set(
                "keyword",
                keyword
            );
        }

        return `${CONFIG.API_ENDPOINT}?${params.toString()}`;
    }


    /* =========================================================================
       FETCH PRODUCTS
       ========================================================================= */

    async function fetchProducts(keyword = "") {

        if (!DOM.grid) {
            return;
        }

        const normalizedKeyword =
            String(keyword || "").trim();

        state.search = normalizedKeyword;

        if (state.requestController) {

            state.requestController.abort();
        }

        state.requestController =
            new AbortController();

        setLoading(true);

        updateResultText(
            normalizedKeyword
                ? `Searching for "${normalizedKeyword}"...`
                : "Loading live products..."
        );

        try {

            const response = await fetch(
                buildProductsURL(normalizedKeyword),
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    signal:
                        state.requestController.signal,
                    cache: "no-store"
                }
            );

            if (!response.ok) {

                throw new Error(
                    `API request failed with HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            const rawProducts =
                extractProductArray(data);

            state.products =
                normalizeProducts(rawProducts);

            filterAndRender();

        } catch (error) {

            if (error.name === "AbortError") {
                return;
            }

            console.error(
                "PRASUN SHOP product API error:",
                error
            );

            state.products = [];

            renderError();

        } finally {

            setLoading(false);
        }
    }


    /* =========================================================================
       FILTER PRODUCTS
       ========================================================================= */

    function filterProducts() {

        const query =
            state.search.toLowerCase().trim();

        const selectedCategory =
            state.category.toLowerCase();

        let filtered =
            [...state.products];


        /* Search */

        if (query) {

            filtered =
                filtered.filter(product => {

                    const searchableText = [

                        product.name,

                        product.description,

                        product.category,

                        product.sku

                    ]
                        .join(" ")
                        .toLowerCase();

                    return searchableText.includes(
                        query
                    );
                });
        }


        /* Category */

        if (selectedCategory !== "all") {

            filtered =
                filtered.filter(product =>
                    product.category
                        .toLowerCase()
                        .trim() === selectedCategory
                );
        }


        /* Sort */

        filtered.sort((a, b) => {

            switch (state.sort) {

                case "price-low":

                    return a.price - b.price;


                case "price-high":

                    return b.price - a.price;


                case "name":

                    return a.name.localeCompare(
                        b.name
                    );


                case "rating":

                    return b.rating - a.rating;


                case "featured":

                default:

                    return 0;
            }
        });


        return filtered;
    }


    /* =========================================================================
       FILTER + RENDER
       ========================================================================= */

    function filterAndRender() {

        const filtered =
            filterProducts();

        renderProducts(filtered);

        updateResultText(
            `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`
        );
    }


    /* =========================================================================
       RENDER PRODUCTS
       ========================================================================= */

    function renderProducts(products) {

        if (!DOM.grid) {
            return;
        }

        if (!products.length) {

            DOM.grid.innerHTML = `

                <div
                    class="products-empty"
                    role="status"
                >

                    <h2>
                        No products found
                    </h2>

                    <p>
                        Try a different search term
                        or category.
                    </p>

                </div>

            `;

            return;
        }


        DOM.grid.innerHTML =
            products.map(renderProductCard).join("");
    }


    /* =========================================================================
       PRODUCT CARD
       ========================================================================= */

    function renderProductCard(product) {

        const id =
            encodeURIComponent(product.id);

        const name =
            escapeHTML(product.name);

        const image =
            escapeHTML(
                product.image ||
                CONFIG.FALLBACK_IMAGE
            );

        const category =
            escapeHTML(
                product.category || "General"
            );

        const description =
            escapeHTML(
                product.description || ""
            );

        const sku =
            encodeURIComponent(
                product.sku || product.id
            );

        const price =
            Number.isFinite(product.price)
                ? product.price.toFixed(2)
                : "0.00";

        const rating =
            Number.isFinite(product.rating)
                ? product.rating.toFixed(1)
                : "5.0";


        return `

            <article
                class="product-card"
                data-product-id="${id}"
            >

                <a
                    href="product.html?id=${id}"
                    class="product-link"
                    aria-label="View ${name}"
                >

                    <div class="product-card-img-wrap">

                        <span class="product-category">
                            ${category}
                        </span>

                        <img
                            src="${image}"
                            alt="${name}"
                            loading="lazy"
                            decoding="async"
                            onerror="this.onerror=null;this.src='${CONFIG.FALLBACK_IMAGE}'"
                        >

                    </div>


                    <div class="product-card-info">

                        <span class="product-rating">
                            ★ ${rating}
                        </span>

                        <h2 class="product-card-title">
                            ${name}
                        </h2>

                        ${
                            description
                                ? `
                                    <p class="product-description">
                                        ${description}
                                    </p>
                                  `
                                : ""
                        }


                        <div class="product-card-footer">

                            <span class="product-card-price">
                                $${price}
                            </span>

                            <span class="product-view-btn">
                                View Details →
                            </span>

                        </div>

                    </div>

                </a>

            </article>

        `;
    }


    /* =========================================================================
       ERROR STATE
       ========================================================================= */

    function renderError() {

        if (!DOM.grid) {
            return;
        }

        DOM.grid.innerHTML = `

            <div
                class="products-empty"
                role="alert"
            >

                <h2>
                    Products temporarily unavailable
                </h2>

                <p>
                    We couldn't connect to the live product
                    catalog. Please refresh the page and try again.
                </p>

                <button
                    type="button"
                    id="retry-products"
                    class="btn-add-to-cart"
                >
                    Try Again
                </button>

            </div>

        `;

        const retry =
            document.getElementById(
                "retry-products"
            );

        if (retry) {

            retry.addEventListener(
                "click",
                () => fetchProducts(state.search)
            );
        }

        updateResultText(
            "Unable to load products"
        );
    }


    /* =========================================================================
       LOADING STATE
       ========================================================================= */

    function setLoading(isLoading) {

        if (!DOM.grid) {
            return;
        }

        DOM.grid.setAttribute(
            "aria-busy",
            isLoading
                ? "true"
                : "false"
        );

        if (isLoading) {

            DOM.grid.innerHTML = `

                <div
                    class="products-loading"
                    role="status"
                >

                    <p>
                        Loading live products...
                    </p>

                </div>

            `;
        }
    }


    /* =========================================================================
       RESULT COUNT / ACCESSIBILITY
       ========================================================================= */

    function updateResultText(text) {

        if (DOM.resultCount) {

            DOM.resultCount.textContent =
                text;
        }

        if (DOM.liveRegion) {

            DOM.liveRegion.textContent =
                text;
        }
    }


    /* =========================================================================
       CATEGORY BUTTONS
       ========================================================================= */

    function setupCategoryButtons() {

        DOM.categoryButtons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    DOM.categoryButtons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                            item.setAttribute(
                                "aria-pressed",
                                "false"
                            );
                        }
                    );


                    button.classList.add(
                        "active"
                    );

                    button.setAttribute(
                        "aria-pressed",
                        "true"
                    );


                    state.category =
                        button.dataset.category ||
                        "all";


                    if (DOM.heading) {

                        DOM.heading.textContent =
                            state.category === "all"
                                ? "Shop Physical Products"
                                : state.category;
                    }


                    filterAndRender();
                }
            );
        });
    }


    /* =========================================================================
       SEARCH
       ========================================================================= */

    function setupSearch() {

        if (!DOM.searchInput) {
            return;
        }


        DOM.searchInput.addEventListener(
            "input",
            () => {

                const value =
                    DOM.searchInput.value.trim();


                state.search = value;


                if (DOM.clearButton) {

                    DOM.clearButton.hidden =
                        value.length === 0;
                }


                clearTimeout(
                    state.searchTimer
                );


                state.searchTimer =
                    setTimeout(
                        () => {

                            /*
                             * IMPORTANT:
                             * Search is sent to the backend/CJ API.
                             * This allows searching products that are
                             * not already present in the current page.
                             */

                            if (value.length >= 2) {

                                fetchProducts(value);

                            } else if (
                                value.length === 0
                            ) {

                                fetchProducts("");
                            }

                        },
                        CONFIG.SEARCH_DELAY
                    );
            }
        );
    }


    /* =========================================================================
       CLEAR SEARCH
       ========================================================================= */

    function setupClearButton() {

        if (
            !DOM.clearButton ||
            !DOM.searchInput
        ) {
            return;
        }


        DOM.clearButton.addEventListener(
            "click",
            () => {

                DOM.searchInput.value = "";

                state.search = "";

                DOM.clearButton.hidden = true;

                fetchProducts("");
            }
        );
    }


    /* =========================================================================
       SORT
       ========================================================================= */

    function setupSort() {

        if (!DOM.sortSelect) {
            return;
        }


        DOM.sortSelect.addEventListener(
            "change",
            () => {

                state.sort =
                    DOM.sortSelect.value ||
                    "featured";

                filterAndRender();
            }
        );
    }


    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    async function init() {

        cacheDOM();

        if (!DOM.grid) {

            console.warn(
                "PRASUN SHOP: #product-list was not found."
            );

            return;
        }


        setupSearch();

        setupClearButton();

        setupSort();

        setupCategoryButtons();


        if (
            window.PrasunShopCart &&
            typeof window.PrasunShopCart.updateCartBadge === "function"
        ) {

            window.PrasunShopCart.updateCartBadge();
        }


        await fetchProducts("");
    }


    /* =========================================================================
       START
       ========================================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

})();
