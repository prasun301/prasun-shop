/**
 * ============================================================================
 * PRASUN SHOP — MAIN PRODUCT CATALOG
 * ============================================================================
 *
 * Responsibilities:
 * - Fetch physical products from /api/products
 * - Search
 * - Category filtering
 * - Sorting
 * - URL state synchronization
 * - Product pagination
 * - Add to cart
 * - Cart badge synchronization
 * - Accessible loading/error/empty states
 * - Image fallback handling
 *
 * Cart storage:
 *     prasun_cart
 *
 * Product source:
 *     /api/products
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CONFIG = {
        API_ENDPOINT: "/api/products",
        CART_KEY: "prasun_cart",
        ITEMS_PER_PAGE: 24,
        DEBOUNCE_MS: 180,

        FALLBACK_IMAGE:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="800"
                    height="600"
                    viewBox="0 0 800 600">

                    <rect
                        width="800"
                        height="600"
                        fill="#f4f4f5"/>

                    <text
                        x="400"
                        y="300"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="#a1a1aa"
                        font-family="system-ui, sans-serif"
                        font-size="24">
                        Image unavailable
                    </text>

                </svg>
            `)
    };


    /* ========================================================================
       CURRENCY
       ======================================================================== */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


    function formatPrice(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }


    /* ========================================================================
       STATE
       ======================================================================== */

    const state = {
        allProducts: [],
        filteredProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        currentPage: 1,
        searchTimer: null,
        isLoading: false,
        fetchError: null
    };


    /* ========================================================================
       DOM CACHE
       ======================================================================== */

    const DOM = {
        productList: null,
        searchInput: null,
        searchClearBtn: null,
        sortSelect: null,
        resultsCount: null,
        heading: null,
        liveRegion: null,
        cartBadge: null,
        categoryPills: []
    };


    /* ========================================================================
       HELPERS
       ======================================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();
    }


    function firstDefined(...values) {

        for (const value of values) {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return value;
            }
        }

        return "";
    }


    /* ========================================================================
       PRODUCT NORMALIZATION
       ======================================================================== */

    function normalizeProduct(product) {

        if (!product || typeof product !== "object") {
            return null;
        }

        const id = firstDefined(
            product.id,
            product.pid,
            product.productId,
            product.sku,
            product.productSku
        );

        const name = firstDefined(
            product.name,
            product.productName,
            product.productNameEn,
            product.title,
            "Product"
        );

        const price = Number(
            firstDefined(
                product.price,
                product.sellPrice,
                product.salePrice,
                product.sellingPrice,
                0
            )
        );


        const image = firstDefined(
            product.image,
            product.productImage,
            product.imageUrl,
            product.productImageUrl,
            product.mainImage,
            ""
        );


        const category = firstDefined(
            product.category,
            product.categoryName,
            product.productCategory,
            ""
        );


        const description = firstDefined(
            product.description,
            product.productDescription,
            product.desc,
            ""
        );


        const ratingValue = Number(
            firstDefined(
                product.rating,
                product.averageRating,
                product.starRating,
                4.5
            )
        );


        if (!String(id).trim()) {
            return null;
        }


        const normalized = {

            id: String(id).trim(),

            name: String(name).trim(),

            price:
                Number.isFinite(price) && price >= 0
                    ? price
                    : 0,

            image:
                typeof image === "string"
                    ? image.trim()
                    : "",

            category:
                String(category).trim(),

            description:
                String(description).trim(),

            rating:
                Number.isFinite(ratingValue) && ratingValue > 0
                    ? Math.min(ratingValue, 5)
                    : 4.5
        };


        normalized._normalizedCategory =
            normalize(normalized.category);


        normalized._searchIndex = [
            normalized.name,
            normalized.category,
            normalized.description
        ]
            .map(normalize)
            .join(" ");


        return normalized;
    }


    /* ========================================================================
       API RESPONSE NORMALIZATION
       ======================================================================== */

    function extractProductsFromResponse(data) {

        if (Array.isArray(data)) {
            return data;
        }


        if (!data || typeof data !== "object") {
            return [];
        }


        if (Array.isArray(data.products)) {
            return data.products;
        }


        if (Array.isArray(data.data)) {
            return data.data;
        }


        if (
            data.data &&
            typeof data.data === "object" &&
            Array.isArray(data.data.products)
        ) {
            return data.data.products;
        }


        if (Array.isArray(data.items)) {
            return data.items;
        }


        if (
            data.result &&
            Array.isArray(data.result)
        ) {
            return data.result;
        }


        return [];
    }


    /* ========================================================================
       FETCH PRODUCTS
       ======================================================================== */

    async function fetchProducts() {

        if (!DOM.productList) {
            return;
        }


        state.isLoading = true;
        state.fetchError = null;


        renderLoadingState();


        try {

            const response = await fetch(
                CONFIG.API_ENDPOINT,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json"
                    },
                    cache: "no-store"
                }
            );


            if (!response.ok) {

                throw new Error(
                    `Server returned HTTP ${response.status}.`
                );
            }


            const data = await response.json();

            const rawProducts =
                extractProductsFromResponse(data);


            state.allProducts =
                rawProducts
                    .map(normalizeProduct)
                    .filter(Boolean);


            state.isLoading = false;


            applyFilters();


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Product API error:",
                error
            );


            state.isLoading = false;
            state.fetchError =
                error?.message ||
                "Unable to load products.";


            renderErrorState(
                state.fetchError
            );
        }
    }


    /* ========================================================================
       CART
       ======================================================================== */

    function getCart() {

        try {

            const raw =
                localStorage.getItem(CONFIG.CART_KEY);


            if (!raw) {
                return [];
            }


            const parsed =
                JSON.parse(raw);


            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] Cart read failed:",
                error
            );

            return [];
        }
    }


    function saveCart(cart) {

        try {

            localStorage.setItem(
                CONFIG.CART_KEY,
                JSON.stringify(cart)
            );


            window.dispatchEvent(
                new CustomEvent(
                    "prasunCartUpdated",
                    {
                        detail: {
                            cart
                        }
                    }
                )
            );


            updateCartBadge();


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save failed:",
                error
            );
        }
    }


    function updateCartBadge() {

        if (!DOM.cartBadge) {
            return;
        }


        const cart = getCart();


        const totalCount =
            cart.reduce(
                (total, item) => {

                    const quantity =
                        Number(item?.quantity);


                    return total +
                        (
                            Number.isFinite(quantity) &&
                            quantity > 0
                        )
                            ? Math.floor(quantity)
                            : 0;
                },
                0
            );


        DOM.cartBadge.textContent =
            String(totalCount);


        DOM.cartBadge.hidden =
            totalCount === 0;


        DOM.cartBadge.setAttribute(
            "aria-label",
            `${totalCount} ${totalCount === 1 ? "item" : "items"} in cart`
        );


        const cartLink =
            DOM.cartBadge.closest("a");


        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",
                totalCount > 0
                    ? `View Shopping Cart, ${totalCount} ${totalCount === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    function addToCart(productId) {

        const product =
            state.allProducts.find(
                item => item.id === productId
            );


        if (!product) {
            return;
        }


        try {

            const cart = getCart();


            const existing =
                cart.find(
                    item => String(item.id) === productId
                );


            if (existing) {

                const currentQuantity =
                    Number(existing.quantity);


                existing.quantity =
                    Number.isFinite(currentQuantity) &&
                    currentQuantity > 0
                        ? Math.floor(currentQuantity) + 1
                        : 1;

            } else {

                cart.push({

                    id: product.id,

                    name: product.name,

                    price: product.price,

                    image: product.image,

                    category: product.category,

                    description: product.description,

                    rating: product.rating,

                    quantity: 1
                });
            }


            saveCart(cart);


            if (DOM.liveRegion) {

                DOM.liveRegion.textContent =
                    `${product.name} added to cart.`;
            }


            const button =
                DOM.productList.querySelector(
                    `[data-action="add-cart"][data-id="${CSS.escape(encodeURIComponent(productId))}"]`
                );


            if (button) {

                const original =
                    button.textContent;


                button.textContent =
                    "Added ✓";


                button.classList.add(
                    "is-added"
                );


                button.disabled = true;


                window.setTimeout(
                    () => {

                        button.textContent =
                            original;

                        button.classList.remove(
                            "is-added"
                        );

                        button.disabled =
                            false;

                    },
                    1200
                );
            }


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Add to cart failed:",
                error
            );
        }
    }


    /* ========================================================================
       URL STATE
       ======================================================================== */

    function readStateFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        state.currentCategory =
            params.get("category")?.trim() || "";


        state.currentKeyword =
            params.get("q")?.trim() || "";


        state.currentSort =
            params.get("sort")?.trim() ||
            "featured";


        const validSorts = [
            "featured",
            "price-low",
            "price-high",
            "rating",
            "name"
        ];


        if (
            !validSorts.includes(
                state.currentSort
            )
        ) {

            state.currentSort =
                "featured";
        }


        if (DOM.searchInput) {

            DOM.searchInput.value =
                state.currentKeyword;
        }


        if (DOM.sortSelect) {

            DOM.sortSelect.value =
                state.currentSort;
        }


        toggleClearButtonVisibility(
            Boolean(state.currentKeyword)
        );


        updateCategoryNavigation();
        updatePageHeading();
    }


    function syncStateToURL(
        usePushState = true
    ) {

        const url =
            new URL(
                window.location.href
            );


        if (state.currentCategory) {

            url.searchParams.set(
                "category",
                state.currentCategory
            );

        } else {

            url.searchParams.delete(
                "category"
            );
        }


        if (state.currentKeyword) {

            url.searchParams.set(
                "q",
                state.currentKeyword
            );

        } else {

            url.searchParams.delete(
                "q"
            );
        }


        if (
            state.currentSort &&
            state.currentSort !== "featured"
        ) {

            url.searchParams.set(
                "sort",
                state.currentSort
            );

        } else {

            url.searchParams.delete(
                "sort"
            );
        }


        if (usePushState) {

            window.history.pushState(
                {},
                "",
                url
            );

        } else {

            window.history.replaceState(
                {},
                "",
                url
            );
        }
    }


    /* ========================================================================
       CATEGORY NAVIGATION
       ======================================================================== */

    function updateCategoryNavigation() {

        const selected =
            normalize(
                state.currentCategory
            );


        DOM.categoryPills.forEach(
            pill => {

                const pillCategory =
                    normalize(
                        pill.dataset.category ||
                        ""
                    );


                const isAll =
                    pillCategory === "all";


                const active =
                    (
                        selected === "" &&
                        isAll
                    ) ||
                    (
                        selected !== "" &&
                        pillCategory === selected
                    );


                pill.classList.toggle(
                    "active",
                    active
                );


                pill.setAttribute(
                    "aria-pressed",
                    active
                        ? "true"
                        : "false"
                );
            }
        );
    }


    function updatePageHeading() {

        if (!DOM.heading) {
            return;
        }


        DOM.heading.textContent =
            state.currentCategory
                ? state.currentCategory
                : "Shop Physical Products";
    }


    /* ========================================================================
       FILTER & SORT
       ======================================================================== */

    function applyFilters() {

        if (state.isLoading) {
            return;
        }


        let filtered =
            [...state.allProducts];


        if (state.currentCategory) {

            const category =
                normalize(
                    state.currentCategory
                );


            filtered =
                filtered.filter(
                    product =>
                        product._normalizedCategory ===
                        category
                );
        }


        if (state.currentKeyword) {

            const tokens =
                normalize(
                    state.currentKeyword
                )
                    .split(/\s+/)
                    .filter(Boolean);


            filtered =
                filtered.filter(
                    product =>
                        tokens.every(
                            token =>
                                product._searchIndex
                                    .includes(token)
                        )
                );
        }


        switch (state.currentSort) {

            case "price-low":

                filtered.sort(
                    (a, b) =>
                        a.price - b.price
                );

                break;


            case "price-high":

                filtered.sort(
                    (a, b) =>
                        b.price - a.price
                );

                break;


            case "rating":

                filtered.sort(
                    (a, b) =>
                        b.rating - a.rating
                );

                break;


            case "name":

                filtered.sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );

                break;


            case "featured":

            default:

                break;
        }


        state.filteredProducts =
            filtered;


        state.currentPage =
            1;


        renderProducts(
            state.filteredProducts
        );
    }


    /* ========================================================================
       LOADING STATE
       ======================================================================== */

    function renderLoadingState() {

        if (!DOM.productList) {
            return;
        }


        DOM.productList.setAttribute(
            "aria-busy",
            "true"
        );


        if (DOM.resultsCount) {

            DOM.resultsCount.textContent =
                "Loading products...";
        }


        DOM.productList.innerHTML = `

            <div
                class="products-loading"
                role="status"
            >

                <div
                    class="products-spinner"
                    aria-hidden="true"
                ></div>

                <p>
                    Loading products...
                </p>

            </div>
        `;
    }


    /* ========================================================================
       ERROR STATE
       ======================================================================== */

    function renderErrorState(
        errorMessage
    ) {

        if (!DOM.productList) {
            return;
        }


        DOM.productList.setAttribute(
            "aria-busy",
            "false"
        );


        if (DOM.resultsCount) {

            DOM.resultsCount.textContent =
                "Unable to load products";
        }


        DOM.productList.innerHTML = `

            <div
                class="products-error"
                role="alert"
            >

                <div
                    class="products-state-icon"
                    aria-hidden="true"
                >
                    !
                </div>

                <h2>
                    Unable to load products
                </h2>

                <p>
                    ${escapeHTML(errorMessage)}
                </p>

                <button
                    type="button"
                    id="retry-fetch-btn"
                    class="products-state-button"
                >
                    Retry Connection
                </button>

            </div>
        `;


        const retryButton =
            $("#retry-fetch-btn");


        if (retryButton) {

            retryButton.addEventListener(
                "click",
                fetchProducts
            );
        }
    }


    /* ========================================================================
       PRODUCT RENDERING
       ======================================================================== */

    function renderProducts(
        products
    ) {

        if (!DOM.productList) {
            return;
        }


        updateResultsCount(
            products.length
        );


        if (!products.length) {

            renderEmptyState();

            return;
        }


        const visibleCount =
            state.currentPage *
            CONFIG.ITEMS_PER_PAGE;


        const visibleProducts =
            products.slice(
                0,
                visibleCount
            );


        const fragment =
            document.createDocumentFragment();


        visibleProducts.forEach(
            product => {

                const template =
                    document.createElement(
                        "template"
                    );


                template.innerHTML =
                    renderProductCardHTML(
                        product
                    );


                fragment.appendChild(
                    template.content
                );
            }
        );


        if (
            products.length >
            visibleCount
        ) {

            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "products-pagination-container";


            wrapper.style.gridColumn =
                "1 / -1";


            const remaining =
                products.length -
                visibleCount;


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "btn-load-more";


            button.textContent =
                `Load More (${remaining} remaining)`;


            button.addEventListener(
                "click",
                () => {

                    state.currentPage++;

                    renderProducts(
                        state.filteredProducts
                    );
                }
            );


            wrapper.appendChild(
                button
            );


            fragment.appendChild(
                wrapper
            );
        }


        DOM.productList.replaceChildren(
            fragment
        );


        DOM.productList.setAttribute(
            "aria-busy",
            "false"
        );
    }


    function renderProductCardHTML(
        product
    ) {

        const encodedId =
            encodeURIComponent(
                product.id
            );


        const image =
            product.image ||
            CONFIG.FALLBACK_IMAGE;


        const categoryHTML =
            product.category
                ? `
                    <span class="product-category">
                        ${escapeHTML(product.category)}
                    </span>
                `
                : "";


        const ratingHTML =
            Number.isFinite(product.rating) &&
            product.rating > 0
                ? `
                    <div
                        class="product-meta"
                        aria-label="Rating ${product.rating.toFixed(1)} out of 5"
                    >
                        <span class="product-rating">
                            ★ ${product.rating.toFixed(1)}
                        </span>
                    </div>
                `
                : "";


        return `

            <article
                class="product-card"
                data-id="${escapeHTML(product.id)}"
            >

                <div class="product-card-inner">

                    <a
                        class="product-card-link"
                        href="product.html?id=${encodedId}"
                        aria-label="View ${escapeHTML(product.name)}"
                    >

                        <div class="product-card-image">

                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(product.name)}"
                                class="product-image"
                                loading="lazy"
                                decoding="async"
                                width="600"
                                height="600"
                            >

                            ${categoryHTML}

                        </div>


                        <div class="product-card-body">

                            ${ratingHTML}

                            <h2 class="product-title">
                                ${escapeHTML(product.name)}
                            </h2>


                            ${
                                product.description
                                    ? `
                                        <p class="product-description">
                                            ${escapeHTML(product.description)}
                                        </p>
                                    `
                                    : ""
                            }


                            <div class="product-bottom">

                                <span class="product-price">
                                    ${formatPrice(product.price)}
                                </span>

                                <span class="product-view-button">
                                    View Details
                                </span>

                            </div>

                        </div>

                    </a>


                    <div class="product-card-actions">

                        <button
                            type="button"
                            class="btn-add-to-cart"
                            data-action="add-cart"
                            data-id="${encodedId}"
                        >
                            Add to Cart
                        </button>

                    </div>

                </div>

            </article>
        `;
    }


    /* ========================================================================
       EMPTY STATE
       ======================================================================== */

    function renderEmptyState() {

        if (!DOM.productList) {
            return;
        }


        const hasFilters =
            Boolean(
                state.currentCategory ||
                state.currentKeyword
            );


        DOM.productList.innerHTML = `

            <div
                class="products-empty"
                role="status"
            >

                <div
                    class="products-empty-icon"
                    aria-hidden="true"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                        ></circle>

                        <path
                            d="m20 20-4-4"
                        ></path>

                    </svg>

                </div>


                <h2>
                    ${
                        hasFilters
                            ? "No products found"
                            : "No products available"
                    }
                </h2>


                <p>
                    ${
                        hasFilters
                            ? "Try adjusting your search query or category filter."
                            : "Products will appear here when available."
                    }
                </p>


                ${
                    hasFilters
                        ? `
                            <button
                                type="button"
                                class="products-state-button"
                                id="clear-product-filters"
                            >
                                Clear Filters
                            </button>
                        `
                        : ""
                }

            </div>
        `;


        const clearButton =
            $("#clear-product-filters");


        if (clearButton) {

            clearButton.addEventListener(
                "click",
                clearFilters
            );
        }


        DOM.productList.setAttribute(
            "aria-busy",
            "false"
        );
    }


    /* ========================================================================
       RESULTS COUNTER
       ======================================================================== */

    function updateResultsCount(
        count
    ) {

        const text =
            count === 0
                ? "No products found"
                : `${count} ${count === 1 ? "product" : "products"} available`;


        if (DOM.resultsCount) {

            DOM.resultsCount.textContent =
                text;
        }
    }


    /* ========================================================================
       SEARCH CLEAR
       ======================================================================== */

    function toggleClearButtonVisibility(
        show
    ) {

        if (!DOM.searchClearBtn) {
            return;
        }


        DOM.searchClearBtn.hidden =
            !show;
    }


    /* ========================================================================
       CLEAR FILTERS
       ======================================================================== */

    function clearFilters() {

        state.currentCategory = "";
        state.currentKeyword = "";
        state.currentSort = "featured";


        if (DOM.searchInput) {

            DOM.searchInput.value = "";
        }


        if (DOM.sortSelect) {

            DOM.sortSelect.value =
                "featured";
        }


        toggleClearButtonVisibility(
            false
        );


        syncStateToURL();


        updateCategoryNavigation();
        updatePageHeading();


        applyFilters();
    }


    /* ========================================================================
       PRODUCT LIST EVENTS
       ======================================================================== */

    function setupProductListDelegation() {

        if (!DOM.productList) {
            return;
        }


        DOM.productList.addEventListener(
            "error",
            event => {

                const target =
                    event.target;


                if (
                    target &&
                    target.tagName === "IMG"
                ) {

                    if (
                        target.dataset.fallbackApplied
                    ) {
                        return;
                    }


                    target.dataset.fallbackApplied =
                        "true";


                    target.src =
                        CONFIG.FALLBACK_IMAGE;


                    target.classList.add(
                        "is-fallback"
                    );
                }

            },
            true
        );


        DOM.productList.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        '[data-action="add-cart"]'
                    );


                if (!button) {
                    return;
                }


                event.preventDefault();
                event.stopPropagation();


                const productId =
                    decodeURIComponent(
                        button.dataset.id ||
                        ""
                    );


                addToCart(
                    productId
                );
            }
        );
    }


    /* ========================================================================
       SEARCH & CONTROLS
       ======================================================================== */

    function initializeControls() {

        if (DOM.searchInput) {

            DOM.searchInput.addEventListener(
                "input",
                () => {

                    const value =
                        DOM.searchInput.value.trim();


                    toggleClearButtonVisibility(
                        Boolean(value)
                    );


                    clearTimeout(
                        state.searchTimer
                    );


                    state.searchTimer =
                        window.setTimeout(
                            () => {

                                state.currentKeyword =
                                    value;


                                syncStateToURL();


                                applyFilters();

                            },
                            CONFIG.DEBOUNCE_MS
                        );
                }
            );
        }


        if (DOM.searchClearBtn) {

            DOM.searchClearBtn.addEventListener(
                "click",
                () => {

                    if (DOM.searchInput) {

                        DOM.searchInput.value = "";
                        DOM.searchInput.focus();
                    }


                    state.currentKeyword =
                        "";


                    toggleClearButtonVisibility(
                        false
                    );


                    syncStateToURL();


                    applyFilters();
                }
            );
        }


        if (DOM.sortSelect) {

            DOM.sortSelect.addEventListener(
                "change",
                () => {

                    state.currentSort =
                        DOM.sortSelect.value;


                    syncStateToURL();


                    applyFilters();
                }
            );
        }


        const categoryContainer =
            $(".products-categories");


        if (categoryContainer) {

            categoryContainer.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            ".category-pill"
                        );


                    if (!button) {
                        return;
                    }


                    const category =
                        button.dataset.category ===
                        "all"
                            ? ""
                            : button.dataset.category;


                    if (
                        category ===
                        state.currentCategory
                    ) {
                        return;
                    }


                    state.currentCategory =
                        category;


                    syncStateToURL();


                    updateCategoryNavigation();
                    updatePageHeading();


                    applyFilters();
                }
            );
        }
    }


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    function populateDOMCache() {

        DOM.productList =
            $("#product-list") ||
            $("#products-grid") ||
            $(".products-grid");


        DOM.searchInput =
            $("#product-search");


        DOM.searchClearBtn =
            $("#search-clear");


        DOM.sortSelect =
            $("#product-sort");


        DOM.resultsCount =
            $("#results-count");


        DOM.heading =
            $("#page-heading");


        DOM.liveRegion =
            $("#a11y-status-region");


        DOM.cartBadge =
            $("#cart-count");


        DOM.categoryPills =
            $$(".category-pill");
    }


    function init() {

        populateDOMCache();


        /*
         * Do not run the product API on unrelated pages.
         */
        if (!DOM.productList) {

            updateCartBadge();

            return;
        }


        readStateFromURL();


        updateCartBadge();


        setupProductListDelegation();


        initializeControls();


        fetchProducts();


        window.addEventListener(
            "popstate",
            () => {

                readStateFromURL();


                if (!state.isLoading) {

                    applyFilters();
                }
            }
        );


        window.addEventListener(
            "storage",
            event => {

                if (
                    event.key ===
                    CONFIG.CART_KEY
                ) {

                    updateCartBadge();
                }
            }
        );


        window.addEventListener(
            "prasunCartUpdated",
            updateCartBadge
        );
    }


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

})();
