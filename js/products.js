/**
 * ============================================================================
 * PRASUN SHOP — PHYSICAL PRODUCTS
 * ============================================================================
 *
 * Frontend product catalog.
 *
 * IMPORTANT:
 * This file must NOT contain CJdropshipping API credentials.
 *
 * The browser loads normalized product data from:
 *
 *     /api/products.json
 *
 * A secure backend / Cloudflare Worker will later obtain the product
 * information from CJdropshipping and expose only the required public
 * product data to this frontend.
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

    const CONFIG = {

        API_ENDPOINT: "/api/products.json",

        CART_KEY: "prasun_cart",

        STORAGE_KEYS: [
            "physical_products",
            "prasun_products"
        ],

        CACHE_TTL_MS:
            1000 * 60 * 30,

        FETCH_TIMEOUT_MS:
            10000,

        DEBOUNCE_MS:
            150,

        ITEMS_PER_PAGE:
            24,

        FALLBACK_IMAGE:
            `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="800"
                    height="800"
                    viewBox="0 0 800 800">

                    <rect
                        width="800"
                        height="800"
                        fill="#f4f4f5"/>

                    <text
                        x="400"
                        y="400"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="#a1a1aa"
                        font-family="system-ui, sans-serif"
                        font-size="26">

                        Image unavailable

                    </text>

                </svg>
            `)}`
    };


    /* =========================================================================
       CURRENCY
       ========================================================================= */

    const currencyFormatter =
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });


    function formatPrice(value) {

        const price = Number(value);

        return Number.isFinite(price)
            ? currencyFormatter.format(price)
            : "$0.00";
    }


    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {

        allProducts: [],

        filteredProducts: [],

        currentCategory: "",

        currentKeyword: "",

        currentSort: "featured",

        currentPage: 1,

        searchTimer: null,

        renderFrame: null,

        fetchAbortController: null
    };


    /* =========================================================================
       DOM CACHE
       ========================================================================= */

    const DOM = {

        productList: null,

        searchInput: null,

        searchClearBtn: null,

        sortSelect: null,

        resultsCount: null,

        heading: null,

        liveRegion: null,

        cartBadge: null,

        categoryContainer: null,

        categoryPills: []
    };


    /* =========================================================================
       HELPERS
       ========================================================================= */

    const $ = (
        selector,
        parent = document
    ) => parent.querySelector(selector);


    const $$ = (
        selector,
        parent = document
    ) => Array.from(
        parent.querySelectorAll(selector)
    );


    function escapeHTML(value) {

        if (value == null) {
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


    function safeNumber(value, fallback = 0) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }


    /* =========================================================================
       PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(item, index) {

        if (
            !item ||
            typeof item !== "object"
        ) {
            return null;
        }


        const id =
            item.id ??
            item.productId ??
            item.cjProductId ??
            `product-${index + 1}`;


        const cjProductId =
            item.cjProductId ??
            item.productId ??
            "";


        const sku =
            item.sku ??
            item.SKU ??
            "";


        const name =
            String(
                item.name ??
                item.title ??
                item.productName ??
                "Unnamed Product"
            ).trim();


        const price =
            safeNumber(
                item.price ??
                item.salePrice ??
                item.sellingPrice,
                0
            );


        const compareAtPrice =
            safeNumber(
                item.compareAtPrice ??
                item.originalPrice ??
                item.listPrice,
                0
            );


        const rating =
            safeNumber(
                item.rating ??
                item.score,
                0
            );


        const category =
            String(
                item.category ??
                item.categoryName ??
                ""
            ).trim();


        const description =
            String(
                item.description ??
                item.productDescription ??
                ""
            ).trim();


        const image =
            String(
                item.image ??
                item.imageUrl ??
                item.thumbnail ??
                item.mainImage ??
                ""
            ).trim();


        const images =
            Array.isArray(item.images)
                ? item.images
                    .map(value => String(value).trim())
                    .filter(Boolean)
                : image
                    ? [image]
                    : [];


        const productUrl =
            String(
                item.productUrl ??
                item.url ??
                ""
            ).trim();


        const stock =
            safeNumber(
                item.stock ??
                item.inventory ??
                item.quantity,
                0
            );


        const available =
            item.available !== undefined
                ? Boolean(item.available)
                : stock > 0;


        const source =
            String(
                item.source ??
                "CJdropshipping"
            ).trim();


        const variants =
            Array.isArray(item.variants)
                ? item.variants
                : [];


        const shipping =
            item.shipping &&
            typeof item.shipping === "object"
                ? item.shipping
                : {};


        const normalizedCategory =
            normalize(category);


        const searchIndex = [

            name,

            description,

            category,

            sku,

            cjProductId

        ]
            .map(normalize)
            .filter(Boolean)
            .join(" ");


        return {

            id:
                String(id),

            cjProductId:
                String(cjProductId),

            sku:
                String(sku),

            name:
                name || "Unnamed Product",

            price,

            compareAtPrice,

            image,

            images,

            category,

            description,

            rating,

            stock,

            available,

            productUrl,

            source,

            variants,

            shipping,

            _normalizedCategory:
                normalizedCategory,

            _searchIndex:
                searchIndex
        };
    }


    /* =========================================================================
       LOCAL CACHE
       ========================================================================= */

    function getCachedProducts() {

        for (
            const key of CONFIG.STORAGE_KEYS
        ) {

            try {

                const stored =
                    localStorage.getItem(key);


                if (!stored) {
                    continue;
                }


                const parsed =
                    JSON.parse(stored);


                if (
                    parsed &&
                    parsed.timestamp &&
                    Date.now() -
                    parsed.timestamp >
                    CONFIG.CACHE_TTL_MS
                ) {

                    localStorage.removeItem(key);

                    continue;
                }


                const data =
                    Array.isArray(parsed)
                        ? parsed
                        : parsed?.data;


                if (
                    Array.isArray(data) &&
                    data.length
                ) {

                    return data
                        .map(normalizeProduct)
                        .filter(Boolean);
                }

            } catch (error) {

                console.warn(
                    "[Prasun Shop] Cache parse warning:",
                    error
                );
            }
        }


        return null;
    }


    /* =========================================================================
       FETCH PRODUCTS
       ========================================================================= */

    async function fetchProductsFromAPI() {

        if (
            state.fetchAbortController
        ) {

            state.fetchAbortController.abort();
        }


        const controller =
            new AbortController();


        state.fetchAbortController =
            controller;


        const timeoutId =
            setTimeout(
                () => controller.abort(),
                CONFIG.FETCH_TIMEOUT_MS
            );


        try {

            const response =
                await fetch(
                    CONFIG.API_ENDPOINT,
                    {
                        method: "GET",

                        signal:
                            controller.signal,

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache:
                            "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const json =
                await response.json();


            const rawProducts =
                Array.isArray(json)
                    ? json
                    : Array.isArray(json?.products)
                        ? json.products
                        : [];


            const normalized =
                rawProducts
                    .map(normalizeProduct)
                    .filter(Boolean);


            if (normalized.length) {

                try {

                    localStorage.setItem(
                        CONFIG.STORAGE_KEYS[0],

                        JSON.stringify({
                            timestamp:
                                Date.now(),

                            data:
                                rawProducts
                        })
                    );

                } catch (error) {

                    console.warn(
                        "[Prasun Shop] Unable to save product cache:",
                        error
                    );
                }
            }


            return normalized;

        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(
                    "[Prasun Shop] Product API failed:",
                    error
                );

                throw error;
            }


            return [];

        } finally {

            clearTimeout(timeoutId);
        }
    }


    /* =========================================================================
       LOAD PRODUCTS
       ========================================================================= */

    async function loadProducts() {

        if (!DOM.productList) {
            return;
        }


        DOM.productList.setAttribute(
            "aria-busy",
            "true"
        );


        const cached =
            getCachedProducts();


        if (cached) {

            state.allProducts =
                cached;

            buildCategories();

            readStateFromURL();

            applyFilters();

            DOM.productList.setAttribute(
                "aria-busy",
                "false"
            );

            return;
        }


        try {

            state.allProducts =
                await fetchProductsFromAPI();


            buildCategories();


            if (
                !state.allProducts.length
            ) {

                renderEmptyState();

                updateResultsCount(0);

                return;
            }


            readStateFromURL();

            applyFilters();

        } catch (error) {

            renderErrorState();

        } finally {

            DOM.productList.setAttribute(
                "aria-busy",
                "false"
            );
        }
    }


    /* =========================================================================
       CATEGORY GENERATION
       ========================================================================= */

    function buildCategories() {

        if (!DOM.categoryContainer) {
            return;
        }


        const categories =
            [
                ...new Set(
                    state.allProducts
                        .map(product => product.category)
                        .filter(Boolean)
                )
            ]
            .sort(
                (a, b) =>
                    a.localeCompare(b)
            );


        DOM.categoryContainer.innerHTML = `

            <button
                type="button"
                class="category-pill active"
                data-category="all"
                aria-pressed="true">

                All

            </button>

            ${categories.map(category => `

                <button
                    type="button"
                    class="category-pill"
                    data-category="${escapeHTML(category)}"
                    aria-pressed="false">

                    ${escapeHTML(category)}

                </button>

            `).join("")}

        `;


        DOM.categoryPills =
            $$(".category-pill");
    }


    /* =========================================================================
       URL STATE
       ========================================================================= */

    function readStateFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        state.currentCategory =
            params.get("category")?.trim() ||
            "";


        state.currentKeyword =
            params.get("q")?.trim() ||
            "";


        state.currentSort =
            params.get("sort")?.trim() ||
            "featured";


        if (DOM.searchInput) {

            DOM.searchInput.value =
                state.currentKeyword;

            toggleClearButtonVisibility(
                Boolean(
                    state.currentKeyword
                )
            );
        }


        if (DOM.sortSelect) {

            DOM.sortSelect.value =
                state.currentSort;
        }


        updateCategoryNavigation();

        updatePageHeading();
    }


    function syncStateToURL() {

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

            url.searchParams.delete("q");
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

            url.searchParams.delete("sort");
        }


        window.history.pushState(
            {},
            "",
            url
        );
    }


    /* =========================================================================
       CATEGORY NAVIGATION
       ========================================================================= */

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


                const active =
                    (
                        selected === "" &&
                        pillCategory === "all"
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
            state.currentCategory ||
            "All Products";
    }


    /* =========================================================================
       FILTER + SORT
       ========================================================================= */

    function applyFilters() {

        let filtered =
            state.allProducts;


        if (
            state.currentCategory
        ) {

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


        if (
            state.currentKeyword
        ) {

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


        if (
            state.currentSort !==
            "featured"
        ) {

            filtered =
                [...filtered];


            switch (
                state.currentSort
            ) {

                case "price-low":

                case "price-asc":

                    filtered.sort(
                        (a, b) =>
                            a.price -
                            b.price
                    );

                    break;


                case "price-high":

                case "price-desc":

                    filtered.sort(
                        (a, b) =>
                            b.price -
                            a.price
                    );

                    break;


                case "rating":

                    filtered.sort(
                        (a, b) =>
                            b.rating -
                            a.rating
                    );

                    break;


                case "name":

                case "name-asc":

                    filtered.sort(
                        (a, b) =>
                            a.name.localeCompare(
                                b.name
                            )
                    );

                    break;
            }
        }


        state.filteredProducts =
            filtered;


        state.currentPage =
            1;


        if (
            state.renderFrame
        ) {

            cancelAnimationFrame(
                state.renderFrame
            );
        }


        state.renderFrame =
            requestAnimationFrame(
                () => {

                    renderProducts(
                        state.filteredProducts
                    );
                }
            );
    }


    /* =========================================================================
       RENDER PRODUCTS
       ========================================================================= */

    function renderProducts(products) {

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


        const hasMore =
            products.length >
            visibleCount;


        let html =
            visibleProducts
                .map(
                    renderProductCardHTML
                )
                .join("");


        if (hasMore) {

            html += `

                <div
                    class="products-pagination-container">

                    <button
                        type="button"
                        class="btn-load-more"
                        id="load-more-products">

                        Load More
                        (${products.length - visibleCount}
                        remaining)

                    </button>

                </div>

            `;
        }


        DOM.productList.innerHTML =
            html;


        const loadMoreButton =
            $("#load-more-products");


        if (loadMoreButton) {

            loadMoreButton.addEventListener(
                "click",
                () => {

                    state.currentPage++;

                    renderProducts(
                        state.filteredProducts
                    );
                }
            );
        }


        DOM.productList.setAttribute(
            "aria-busy",
            "false"
        );
    }


    /* =========================================================================
       PRODUCT CARD
       ========================================================================= */

    function renderProductCardHTML(
        product
    ) {

        const safeId =
            escapeHTML(
                product.id
            );


        const urlSafeId =
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
                        ${escapeHTML(
                            product.category
                        )}
                    </span>
                `
                : "";


        const ratingHTML =
            product.rating > 0
                ? `
                    <span
                        class="product-rating"
                        aria-label="Rating ${product.rating.toFixed(1)} out of 5">

                        ★
                        ${product.rating.toFixed(1)}

                    </span>
                `
                : "";


        const comparePriceHTML =
            product.compareAtPrice >
            product.price
                ? `
                    <span
                        style="
                            color:#94a3b8;
                            text-decoration:line-through;
                            font-size:13px;
                            margin-left:6px;
                        ">

                        ${formatPrice(
                            product.compareAtPrice
                        )}

                    </span>
                `
                : "";


        const availabilityText =
            product.available
                ? ""
                : "Currently unavailable";


        const cartButtonHTML =
            product.available
                ? `
                    <button
                        type="button"
                        class="btn-add-to-cart"
                        data-action="add-cart"
                        data-id="${safeId}">

                        Add to Cart

                    </button>
                `
                : `
                    <button
                        type="button"
                        class="btn-add-to-cart"
                        disabled
                        style="
                            opacity:.55;
                            cursor:not-allowed;
                        ">

                        Out of Stock

                    </button>
                `;


        return `

            <article
                class="product-card"
                data-id="${safeId}">

                <div
                    class="product-card-inner">

                    <a
                        class="product-card-link"
                        href="product.html?id=${urlSafeId}"
                        aria-label="View ${escapeHTML(
                            product.name
                        )}">

                        <div
                            class="product-card-image">

                            <img
                                src="${escapeHTML(
                                    image
                                )}"
                                alt="${escapeHTML(
                                    product.name
                                )}"
                                loading="lazy"
                                decoding="async"
                            />

                            ${categoryHTML}

                        </div>


                        <div
                            class="product-card-body">

                            ${
                                ratingHTML
                                    ? `
                                        <div
                                            class="product-meta">

                                            ${ratingHTML}

                                        </div>
                                    `
                                    : ""
                            }


                            <h2
                                class="product-title">

                                ${escapeHTML(
                                    product.name
                                )}

                            </h2>


                            ${
                                product.description
                                    ? `
                                        <p
                                            class="product-description">

                                            ${escapeHTML(
                                                product.description
                                            )}

                                        </p>
                                    `
                                    : ""
                            }


                            <p
                                class="product-price">

                                ${formatPrice(
                                    product.price
                                )}

                                ${comparePriceHTML}

                            </p>


                            ${
                                availabilityText
                                    ? `
                                        <p
                                            style="
                                                color:#b91c1c;
                                                font-size:12px;
                                                margin-top:5px;
                                            ">

                                            ${availabilityText}

                                        </p>
                                    `
                                    : ""
                            }

                        </div>

                    </a>


                    <div
                        class="product-card-actions">

                        ${cartButtonHTML}

                    </div>

                </div>

            </article>

        `;
    }


    /* =========================================================================
       CART
       ========================================================================= */

    function getCart() {

        try {

            const raw =
                localStorage.getItem(
                    CONFIG.CART_KEY
                );


            const cart =
                raw
                    ? JSON.parse(raw)
                    : [];


            return Array.isArray(cart)
                ? cart
                : [];

        } catch {

            return [];
        }
    }


    function updateCartBadge() {

        if (!DOM.cartBadge) {
            return;
        }


        const cart =
            getCart();


        const total =
            cart.reduce(
                (
                    count,
                    item
                ) =>
                    count +
                    Number(
                        item.quantity || 1
                    ),
                0
            );


        DOM.cartBadge.textContent =
            String(total);


        DOM.cartBadge.hidden =
            total === 0;
    }


    function addToCart(productId) {

        const product =
            state.allProducts.find(
                item =>
                    item.id ===
                    productId
            );


        if (!product) {
            return;
        }


        if (!product.available) {
            return;
        }


        try {

            const cart =
                getCart();


            const existingIndex =
                cart.findIndex(
                    item =>
                        item.id ===
                        productId
                );


            if (
                existingIndex !== -1
            ) {

                cart[
                    existingIndex
                ].quantity =
                    Number(
                        cart[
                            existingIndex
                        ].quantity || 1
                    ) + 1;

            } else {

                cart.push({

                    id:
                        product.id,

                    cjProductId:
                        product.cjProductId,

                    sku:
                        product.sku,

                    name:
                        product.name,

                    price:
                        product.price,

                    image:
                        product.image,

                    quantity:
                        1

                });
            }


            localStorage.setItem(
                CONFIG.CART_KEY,
                JSON.stringify(cart)
            );


            updateCartBadge();


            if (
                DOM.liveRegion
            ) {

                DOM.liveRegion.textContent =
                    `${product.name} added to cart.`;
            }


        } catch (error) {

            console.error(
                "[Prasun Shop] Cart error:",
                error
            );
        }
    }


    /* =========================================================================
       SEARCH
       ========================================================================= */

    function toggleClearButtonVisibility(
        show
    ) {

        if (!DOM.searchClearBtn) {
            return;
        }


        DOM.searchClearBtn.hidden =
            !show;


        DOM.searchClearBtn.setAttribute(
            "aria-hidden",
            show
                ? "false"
                : "true"
        );
    }


    /* =========================================================================
       RESULT COUNT
       ========================================================================= */

    function updateResultsCount(
        count
    ) {

        const text =
            count === 0
                ? "No products found"
                : `${count} ${
                    count === 1
                        ? "product"
                        : "products"
                } available`;


        if (
            DOM.resultsCount
        ) {

            DOM.resultsCount.textContent =
                text;
        }


        if (
            DOM.liveRegion
        ) {

            DOM.liveRegion.textContent =
                text;
        }
    }


    /* =========================================================================
       EMPTY STATE
       ========================================================================= */

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
                role="status">

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
                            ? "Try adjusting your search or category filter."
                            : "Products will appear here when available."
                    }

                </p>


                ${
                    hasFilters
                        ? `
                            <button
                                type="button"
                                class="products-empty-button"
                                id="clear-product-filters">

                                Clear Filters

                            </button>
                        `
                        : ""
                }

            </div>

        `;


        $("#clear-product-filters")
            ?.addEventListener(
                "click",
                clearFilters
            );
    }


    /* =========================================================================
       ERROR STATE
       ========================================================================= */

    function renderErrorState() {

        if (!DOM.productList) {
            return;
        }


        DOM.productList.innerHTML = `

            <div
                class="products-error"
                role="alert">

                <h2>
                    Unable to load products
                </h2>


                <p>
                    Please try again in a moment.
                </p>


                <button
                    type="button"
                    class="products-empty-button"
                    id="retry-products">

                    Try Again

                </button>

            </div>

        `;


        $("#retry-products")
            ?.addEventListener(
                "click",
                loadProducts
            );
    }


    /* =========================================================================
       CLEAR FILTERS
       ========================================================================= */

    function clearFilters() {

        state.currentCategory =
            "";

        state.currentKeyword =
            "";

        state.currentSort =
            "featured";


        if (
            DOM.searchInput
        ) {

            DOM.searchInput.value =
                "";
        }


        if (
            DOM.sortSelect
        ) {

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


    /* =========================================================================
       EVENT HANDLERS
       ========================================================================= */

    function initializeControls() {

        /* Search */

        if (
            DOM.searchInput
        ) {

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
                        setTimeout(
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


        /* Clear search */

        if (
            DOM.searchClearBtn
        ) {

            DOM.searchClearBtn.addEventListener(
                "click",
                () => {

                    if (
                        DOM.searchInput
                    ) {

                        DOM.searchInput.value =
                            "";

                        DOM.searchInput.focus();
                    }


                    toggleClearButtonVisibility(
                        false
                    );


                    state.currentKeyword =
                        "";


                    syncStateToURL();

                    applyFilters();
                }
            );
        }


        /* Sorting */

        if (
            DOM.sortSelect
        ) {

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


        /* Categories */

        if (
            DOM.categoryContainer
        ) {

            DOM.categoryContainer.addEventListener(
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


                    state.currentCategory =
                        category || "";


                    syncStateToURL();

                    updateCategoryNavigation();

                    updatePageHeading();

                    applyFilters();
                }
            );
        }


        /* Product actions */

        if (
            DOM.productList
        ) {

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


                    addToCart(
                        button.dataset.id
                    );
                }
            );


            DOM.productList.addEventListener(
                "error",
                event => {

                    if (
                        event.target &&
                        event.target.tagName ===
                        "IMG"
                    ) {

                        const image =
                            event.target;


                        if (
                            image.dataset.fallbackApplied
                        ) {
                            return;
                        }


                        image.dataset.fallbackApplied =
                            "true";


                        image.src =
                            CONFIG.FALLBACK_IMAGE;
                    }

                },
                true
            );
        }


        /* Keyboard shortcut */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    (
                        event.ctrlKey ||
                        event.metaKey
                    ) &&
                    event.key.toLowerCase() ===
                    "k"
                ) {

                    if (
                        DOM.searchInput
                    ) {

                        event.preventDefault();

                        DOM.searchInput.focus();

                        DOM.searchInput.select();
                    }
                }
            }
        );


        /* Browser history */

        window.addEventListener(
            "popstate",
            () => {

                readStateFromURL();

                applyFilters();
            }
        );


        /* Cart synchronization */

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
    }


    /* =========================================================================
       DOM CACHE
       ========================================================================= */

    function cacheDOM() {

        DOM.productList =
            $("#product-list");


        DOM.searchInput =
            $("#product-search");


        DOM.searchClearBtn =
            $("#search-clear");


        DOM.sortSelect =
            $("#product-sort");


        DOM.resultsCount =
            $("#products-count");


        DOM.heading =
            $("#products-heading");


        DOM.categoryContainer =
            $(".products-categories");


        DOM.categoryPills =
            $$(".category-pill");


        DOM.cartBadge =
            $("#cart-count");


        let liveRegion =
            $("#a11y-status-region");


        if (!liveRegion) {

            liveRegion =
                document.createElement(
                    "div"
                );


            liveRegion.id =
                "a11y-status-region";


            liveRegion.className =
                "visually-hidden";


            liveRegion.setAttribute(
                "aria-live",
                "polite"
            );


            liveRegion.setAttribute(
                "aria-atomic",
                "true"
            );


            document.body.appendChild(
                liveRegion
            );
        }


        DOM.liveRegion =
            liveRegion;
    }


    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    function initialize() {

        cacheDOM();

        updateCartBadge();

        initializeControls();

        loadProducts();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();
