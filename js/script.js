/**
 * ============================================================================
 * PRASUN SHOP — STOREFRONT SCRIPT
 * ============================================================================
 *
 * Loads products from:
 *
 * https://shop.prasunbarua.com/api/products
 *
 * Supports:
 *
 * - Product loading
 * - Search
 * - Category filtering
 * - Sorting
 * - Product details
 * - Cart count
 * - Retry
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIG
       ========================================================================= */

    const CONFIG = {

        API_BASE:
            "https://shop.prasunbarua.com",

        PRODUCTS_ENDPOINT:
            "/api/products",

        REQUEST_TIMEOUT:
            15000

    };


    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {

        products: [],

        filteredProducts: [],

        categories: [],

        activeCategory: "all",

        search: "",

        sort: "featured",

        loading: false

    };


    /* =========================================================================
       DOM
       ========================================================================= */

    const elements = {

        productList:
            document.getElementById(
                "product-list"
            ),

        searchInput:
            document.getElementById(
                "product-search"
            ),

        clearSearch:
            document.getElementById(
                "clear-search"
            ),

        sort:
            document.getElementById(
                "product-sort"
            ),

        categories:
            document.getElementById(
                "products-categories"
            ),

        resultsCount:
            document.getElementById(
                "results-count"
            ),

        productsHeading:
            document.getElementById(
                "products-heading"
            ),

        cartCount:
            document.getElementById(
                "cart-count"
            ),

        liveRegion:
            document.getElementById(
                "aria-live-region"
            )

    };


    /* =========================================================================
       HELPERS
       ========================================================================= */

    function announce(message) {

        if (
            elements.liveRegion
        ) {

            elements.liveRegion.textContent =
                message;

        }

    }


    function escapeHtml(value) {

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


    function formatPrice(value) {

        const price =
            Number(
                value
            );


        if (
            !Number.isFinite(
                price
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
                    "USD",

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2

            }
        ).format(
            price
        );

    }


    function getImage(product) {

        const image =
            String(
                product?.image || ""
            ).trim();


        if (
            image &&
            !image.startsWith(
                "PASTE_IMAGE_ADDRESS"
            )
        ) {

            return image;

        }


        return "";

    }


    /* =========================================================================
       FETCH
       ========================================================================= */

    async function fetchWithTimeout(
        url,
        options = {},
        timeout = CONFIG.REQUEST_TIMEOUT
    ) {

        const controller =
            new AbortController();


        const timer =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );


        try {

            return await fetch(
                url,
                {

                    ...options,

                    signal:
                        controller.signal

                }
            );

        } finally {

            clearTimeout(
                timer
            );

        }

    }


    /* =========================================================================
       LOAD PRODUCTS
       ========================================================================= */

    async function loadProducts() {

        setLoading(
            true
        );


        try {

            const url =
                new URL(
                    CONFIG.PRODUCTS_ENDPOINT,
                    CONFIG.API_BASE
                );


            const response =
                await fetchWithTimeout(
                    url.toString(),
                    {

                        method:
                            "GET",

                        headers: {

                            "Accept":
                                "application/json"

                        },

                        cache:
                            "no-store"

                    }
                );


            /*
             * IMPORTANT:
             *
             * Read text first.
             *
             * This prevents:
             *
             * JSON.parse:
             * unexpected character at line 1 column 1
             *
             * from hiding the real server response.
             */

            const responseText =
                await response.text();


            console.log(
                "[PRASUN SHOP] API status:",
                response.status
            );


            console.log(
                "[PRASUN SHOP] API response:",
                responseText.slice(
                    0,
                    1000
                )
            );


            if (
                !response.ok
            ) {

                throw new Error(

                    `API returned HTTP ${response.status}: ${responseText.slice(0, 300)}`

                );

            }


            let data;


            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch (parseError) {

                console.error(
                    "[PRASUN SHOP] Invalid API JSON:",
                    parseError
                );


                throw new Error(

                    "The product API returned invalid JSON. Check the Worker response in the browser Network/Console tab."

                );

            }


            if (
                !data ||
                data.success !== true ||
                !Array.isArray(
                    data.products
                )
            ) {

                console.error(
                    "[PRASUN SHOP] Invalid product API structure:",
                    data
                );


                throw new Error(
                    "Invalid product API response."
                );

            }


            state.products =
                data.products;


            state.filteredProducts =
                [...state.products];


            buildCategories();


            applyFilters();


            announce(

                `${state.products.length} products loaded.`

            );


        } catch (error) {

            console.error(

                "[PRASUN SHOP] Product loading error:",

                error

            );


            renderError(

                error?.message ||
                "Unable to load products."

            );


            announce(
                "Unable to load products."
            );


        } finally {

            setLoading(
                false
            );

        }

    }


    /* =========================================================================
       LOADING
       ========================================================================= */

    function setLoading(
        loading
    ) {

        state.loading =
            loading;


        if (
            elements.productList
        ) {

            elements.productList.setAttribute(
                "aria-busy",
                loading
                    ? "true"
                    : "false"
            );

        }

    }


    /* =========================================================================
       CATEGORIES
       ========================================================================= */

    function buildCategories() {

        if (
            !elements.categories
        ) {

            return;

        }


        const categorySet =
            new Set();


        state.products.forEach(
            product => {

                const category =
                    String(
                        product.category ||
                        ""
                    ).trim();


                if (
                    category
                ) {

                    categorySet.add(
                        category
                    );

                }

            }
        );


        state.categories =
            Array.from(
                categorySet
            ).sort(
                (a, b) =>
                    a.localeCompare(
                        b
                    )
            );


        elements.categories.innerHTML =
            "";


        const allButton =
            document.createElement(
                "button"
            );


        allButton.type =
            "button";


        allButton.className =
            "category-pill active";


        allButton.dataset.category =
            "all";


        allButton.setAttribute(
            "aria-pressed",
            "true"
        );


        allButton.textContent =
            "All";


        elements.categories.appendChild(
            allButton
        );


        state.categories.forEach(
            category => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "category-pill";


                button.dataset.category =
                    category;


                button.setAttribute(
                    "aria-pressed",
                    "false"
                );


                button.textContent =
                    category;


                elements.categories.appendChild(
                    button
                );

            }
        );

    }


    /* =========================================================================
       FILTER
       ========================================================================= */

    function applyFilters() {

        let products =
            [...state.products];


        const search =
            state.search
                .trim()
                .toLowerCase();


        if (
            search
        ) {

            products =
                products.filter(
                    product => {

                        const text = [

                            product.id,

                            product.sku,

                            product.aliexpress_id,

                            product.name,

                            product.category,

                            product.description,

                            ...(product.features || [])

                        ]

                            .join(" ")

                            .toLowerCase();


                        return text.includes(
                            search
                        );

                    }
                );

        }


        if (
            state.activeCategory !==
            "all"
        ) {

            products =
                products.filter(
                    product =>

                        String(
                            product.category ||
                            ""
                        )
                            .toLowerCase() ===
                        state.activeCategory
                            .toLowerCase()
                );

        }


        sortProducts(
            products
        );


        state.filteredProducts =
            products;


        renderProducts();


        updateResultBar();

    }


    /* =========================================================================
       SORT
       ========================================================================= */

    function sortProducts(
        products
    ) {

        switch (
            state.sort
        ) {

            case "price-low":

                products.sort(
                    (a, b) =>
                        Number(a.price) -
                        Number(b.price)
                );

                break;


            case "price-high":

                products.sort(
                    (a, b) =>
                        Number(b.price) -
                        Number(a.price)
                );

                break;


            case "name-az":

                products.sort(
                    (a, b) =>
                        String(
                            a.name || ""
                        ).localeCompare(
                            String(
                                b.name || ""
                            )
                        )
                );

                break;


            case "rating":

                products.sort(
                    (a, b) =>
                        Number(
                            b.rating || 0
                        ) -
                        Number(
                            a.rating || 0
                        )
                );

                break;


            case "featured":

            default:

                break;

        }

    }


    /* =========================================================================
       RESULT BAR
       ========================================================================= */

    function updateResultBar() {

        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =

                `${state.filteredProducts.length} product${
                    state.filteredProducts.length === 1
                        ? ""
                        : "s"
                }`;

        }


        if (
            elements.productsHeading
        ) {

            if (
                state.activeCategory !==
                "all"
            ) {

                elements.productsHeading.textContent =
                    state.activeCategory;

            } else if (
                state.search
            ) {

                elements.productsHeading.textContent =
                    "Search Results";

            } else {

                elements.productsHeading.textContent =
                    "All Products";

            }

        }

    }


    /* =========================================================================
       PRODUCT CARD
       ========================================================================= */

    function createProductCard(
        product
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "product-card";


        article.dataset.productId =
            product.id;


        const image =
            getImage(
                product
            );


        const rating =
            Number(
                product.rating || 0
            );


        const roundedRating =
            Math.min(
                5,
                Math.max(
                    0,
                    Math.round(
                        rating
                    )
                )
            );


        const ratingStars =
            roundedRating > 0
                ? "★".repeat(
                    roundedRating
                )
                : "";


        article.innerHTML = `

            <div class="product-image-wrapper">

                ${
                    image

                        ? `

                            <img
                                class="product-image"
                                src="${escapeHtml(image)}"
                                alt="${escapeHtml(product.name)}"
                                loading="lazy"
                                decoding="async"
                            >

                        `

                        : `

                            <div
                                class="product-image product-image-placeholder"
                                aria-label="Product image unavailable"
                            >
                                <span>
                                    No Image
                                </span>
                            </div>

                        `
                }

            </div>


            <div class="product-card-body">

                <div class="product-category">

                    ${escapeHtml(
                        product.category ||
                        "General"
                    )}

                </div>


                <h2 class="product-title">

                    ${escapeHtml(
                        product.name
                    )}

                </h2>


                ${
                    rating > 0

                        ? `

                            <div
                                class="product-rating"
                                aria-label="${rating} out of 5 stars"
                            >

                                <span>
                                    ${ratingStars}
                                </span>

                                <span>
                                    ${rating.toFixed(1)}
                                </span>

                            </div>

                        `

                        : ""
                }


                <p class="product-description">

                    ${escapeHtml(
                        product.description ||
                        ""
                    )}

                </p>


                <div class="product-card-footer">

                    <strong class="product-price">

                        ${formatPrice(
                            product.price
                        )}

                    </strong>


                    <button
                        type="button"
                        class="product-view-btn"
                        data-product-id="${escapeHtml(product.id)}"
                    >
                        View Product
                    </button>

                </div>

            </div>

        `;


        return article;

    }


    /* =========================================================================
       RENDER PRODUCTS
       ========================================================================= */

    function renderProducts() {

        if (
            !elements.productList
        ) {

            return;

        }


        if (
            !state.filteredProducts.length
        ) {

            elements.productList.innerHTML = `

                <div class="products-empty">

                    <h2>
                        No products found
                    </h2>

                    <p>
                        Try another search or category.
                    </p>

                </div>

            `;

            return;

        }


        const fragment =
            document.createDocumentFragment();


        state.filteredProducts.forEach(
            product => {

                fragment.appendChild(
                    createProductCard(
                        product
                    )
                );

            }
        );


        elements.productList.innerHTML =
            "";


        elements.productList.appendChild(
            fragment
        );

    }


    /* =========================================================================
       ERROR
       ========================================================================= */

    function renderError(
        message
    ) {

        if (
            !elements.productList
        ) {

            return;

        }


        elements.productList.innerHTML = `

            <div class="products-error">

                <h2>
                    Unable to load products
                </h2>

                <p>
                    ${escapeHtml(
                        message
                    )}
                </p>

                <button
                    type="button"
                    id="retry-products"
                >
                    Try Again
                </button>

            </div>

        `;

    }


    /* =========================================================================
       CART
       ========================================================================= */

    function getCart() {

        try {

            const raw =
                localStorage.getItem(
                    "prasun_shop_cart"
                );


            if (!raw) {

                return [];

            }


            const cart =
                JSON.parse(
                    raw
                );


            return Array.isArray(
                cart
            )
                ? cart
                : [];

        } catch {

            return [];

        }

    }


    function updateCartCount() {

        if (
            !elements.cartCount
        ) {

            return;

        }


        const cart =
            getCart();


        const count =
            cart.reduce(
                (
                    total,
                    item
                ) =>

                    total +
                    Number(
                        item.quantity ||
                        0
                    ),

                0
            );


        elements.cartCount.textContent =
            String(
                count
            );


        elements.cartCount.hidden =
            count <= 0;

    }


    /* =========================================================================
       PRODUCT DETAIL
       ========================================================================= */

    async function openProduct(
        productId
    ) {

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


        const features =
            Array.isArray(
                product.features
            )

                ? product.features
                    .map(
                        item =>
                            `• ${item}`
                    )
                    .join("\n")

                : "";


        const specifications =

            product.specifications &&
            typeof product.specifications === "object"

                ? Object.entries(
                    product.specifications
                )
                    .map(
                        ([key, value]) =>
                            `${key}: ${value}`
                    )
                    .join("\n")

                : "";


        const message = [

            product.name,

            "",

            `Price: ${formatPrice(
                product.price
            )}`,

            product.category
                ? `Category: ${product.category}`
                : "",

            "",

            product.description ||
                "",

            features
                ? `\nFeatures:\n${features}`
                : "",

            specifications
                ? `\nSpecifications:\n${specifications}`
                : ""

        ]

            .filter(Boolean)

            .join("\n");


        window.alert(
            message
        );

    }


    /* =========================================================================
       EVENTS
       ========================================================================= */

    function bindEvents() {

        /*
         * SEARCH
         */

        if (
            elements.searchInput
        ) {

            elements.searchInput.addEventListener(
                "input",
                event => {

                    state.search =
                        event.target.value;


                    if (
                        elements.clearSearch
                    ) {

                        elements.clearSearch.hidden =
                            !state.search;

                    }


                    applyFilters();

                }
            );

        }


        /*
         * CLEAR SEARCH
         */

        if (
            elements.clearSearch
        ) {

            elements.clearSearch.addEventListener(
                "click",
                () => {

                    if (
                        elements.searchInput
                    ) {

                        elements.searchInput.value =
                            "";

                    }


                    state.search =
                        "";


                    elements.clearSearch.hidden =
                        true;


                    applyFilters();

                }
            );

        }


        /*
         * SORT
         */

        if (
            elements.sort
        ) {

            elements.sort.addEventListener(
                "change",
                event => {

                    state.sort =
                        event.target.value;


                    applyFilters();

                }
            );

        }


        /*
         * CATEGORY
         */

        if (
            elements.categories
        ) {

            elements.categories.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-category]"
                        );


                    if (!button) {

                        return;

                    }


                    state.activeCategory =
                        button.dataset.category ||
                        "all";


                    elements.categories
                        .querySelectorAll(
                            ".category-pill"
                        )
                        .forEach(
                            item => {

                                const active =
                                    item ===
                                    button;


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


                    applyFilters();

                }
            );

        }


        /*
         * PRODUCT BUTTON
         */

        if (
            elements.productList
        ) {

            elements.productList.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-product-id]"
                        );


                    if (!button) {

                        return;

                    }


                    openProduct(
                        button.dataset.productId
                    );

                }
            );

        }


        /*
         * RETRY
         */

        document.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "retry-products"
                ) {

                    loadProducts();

                }

            }
        );

    }


    /* =========================================================================
       INIT
       ========================================================================= */

    function init() {

        updateCartCount();

        bindEvents();

        loadProducts();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();
