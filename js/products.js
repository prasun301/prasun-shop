/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * File:
 *     js/products.js
 *
 * JavaScript only.
 *
 * Compatible with the production PRASUN SHOP Cloudflare Worker:
 *
 *     GET /api/products?limit=100&page=1
 *     GET /api/products?limit=100&page=2
 *     GET /api/products?q=...
 *     GET /api/products?pid=...
 *     GET /api/products?sku=...
 *
 * IMPORTANT
 * ============================================================================
 *
 * The Worker is now PAGINATED.
 *
 * The old products.js made one request:
 *
 *     /api/products
 *
 * which only returned the first page of the new Worker catalog.
 *
 * This version automatically follows:
 *
 *     page=1
 *     page=2
 *     page=3
 *     ...
 *
 * until the Worker reports:
 *
 *     hasMore === false
 *
 * The browser keeps the complete loaded catalog in memory and performs:
 *
 *     search
 *     category filtering
 *     sorting
 *
 * locally.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const CONFIG = {

        API_BASE:
            "https://prasun-shop-api.prasun301.workers.dev",

        PRODUCTS_ENDPOINT:
            "/api/products",

        IMAGE_PROXY_ENDPOINT:
            "/api/image-proxy",

        PRODUCT_PAGE:
            "/product.html",

        REQUEST_TIMEOUT:
            20000,

        PAGE_SIZE:
            100,

        MAX_PRODUCTS:
            5000,

        MAX_VISIBLE_PRODUCTS:
            5000,

        DEFAULT_CATEGORY:
            "General",

        DEFAULT_SORT:
            "featured",

        CACHE_MODE:
            "default",

        IMAGE_LOAD_TIMEOUT:
            15000

    };


    /* =========================================================================
       2. PLACEHOLDER IMAGE
       ========================================================================= */

    const PLACEHOLDER_IMAGE =
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
                    fill="#f8fafc"
                />

                <rect
                    x="155"
                    y="150"
                    width="290"
                    height="220"
                    rx="18"
                    fill="#e2e8f0"
                />

                <circle
                    cx="240"
                    cy="225"
                    r="34"
                    fill="#cbd5e1"
                />

                <path
                    d="
                        M180 335
                        L265 255
                        L325 315
                        L385 270
                        L430 335
                        Z
                    "
                    fill="#cbd5e1"
                />

                <text
                    x="300"
                    y="430"
                    text-anchor="middle"
                    font-family="Arial, sans-serif"
                    font-size="24"
                    fill="#64748b"
                >
                    Image Unavailable
                </text>

            </svg>
        `);


    /* =========================================================================
       3. CATEGORY DEFINITIONS
       ========================================================================= */

    const CATEGORY_MAP = [

        {
            label:
                "All Products",

            query:
                "",

            terms:
                []
        },

        {
            label:
                "Solar Lights",

            query:
                "solar-lights",

            terms:
                [
                    "solar light",
                    "solar lamp",
                    "solar spotlight",
                    "solar floodlight",
                    "solar street light",
                    "solar wall light",
                    "solar garden light",
                    "solar outdoor light"
                ]
        },

        {
            label:
                "Battery",

            query:
                "battery",

            terms:
                [
                    "battery",
                    "rechargeable battery",
                    "lithium battery",
                    "battery pack",
                    "aa battery",
                    "aaa battery",
                    "power battery"
                ]
        },

        {
            label:
                "Chargers",

            query:
                "chargers",

            terms:
                [
                    "charger",
                    "charging",
                    "fast charger",
                    "wall charger",
                    "usb charger",
                    "wireless charger",
                    "car charger",
                    "phone charger",
                    "power adapter"
                ]
        },

        {
            label:
                "Power Bank",

            query:
                "power-bank",

            terms:
                [
                    "power bank",
                    "powerbank",
                    "portable power bank",
                    "portable charger"
                ]
        },

        {
            label:
                "Cables",

            query:
                "cables",

            terms:
                [
                    "cable",
                    "usb cable",
                    "charging cable",
                    "data cable",
                    "type c cable",
                    "type-c cable",
                    "usb-c cable",
                    "lightning cable",
                    "hdmi cable",
                    "network cable",
                    "ethernet cable"
                ]
        },

        {
            label:
                "Earphones",

            query:
                "earphones",

            terms:
                [
                    "earphone",
                    "earphones",
                    "earbud",
                    "earbuds",
                    "tws",
                    "wireless earbud",
                    "bluetooth earphone"
                ]
        },

        {
            label:
                "Headphones",

            query:
                "headphones",

            terms:
                [
                    "headphone",
                    "headphones",
                    "gaming headset",
                    "bluetooth headset",
                    "wireless headset",
                    "headset"
                ]
        },

        {
            label:
                "Modem",

            query:
                "modem",

            terms:
                [
                    "modem",
                    "4g modem",
                    "5g modem",
                    "lte modem",
                    "usb modem"
                ]
        },

        {
            label:
                "Routers",

            query:
                "routers",

            terms:
                [
                    "router",
                    "wifi router",
                    "wi-fi router",
                    "wireless router",
                    "4g router",
                    "5g router",
                    "network router"
                ]
        },

        {
            label:
                "Laptops",

            query:
                "laptops",

            terms:
                [
                    "laptop",
                    "notebook",
                    "ultrabook",
                    "computer notebook"
                ]
        },

        {
            label:
                "Power Tools",

            query:
                "power-tools",

            terms:
                [
                    "power tool",
                    "power tools",
                    "drill",
                    "impact driver",
                    "grinder",
                    "electric screwdriver",
                    "saw",
                    "sander",
                    "rotary tool",
                    "heat gun"
                ]
        },

        {
            label:
                "Camera",

            query:
                "camera",

            terms:
                [
                    "camera",
                    "security camera",
                    "cctv",
                    "ip camera",
                    "action camera",
                    "digital camera",
                    "webcam",
                    "dash camera"
                ]
        },

        {
            label:
                "Smart Home",

            query:
                "smart-home",

            terms:
                [
                    "smart home",
                    "smart device",
                    "smart switch",
                    "smart plug",
                    "smart sensor",
                    "smart lock",
                    "smart bulb",
                    "wifi smart",
                    "wi-fi smart",
                    "smart socket"
                ]
        }

    ];


    /* =========================================================================
       4. STATE
       ========================================================================= */

    const state = {

        products:
            [],

        filteredProducts:
            [],

        activeCategory:
            "",

        searchQuery:
            "",

        sortBy:
            CONFIG.DEFAULT_SORT,

        loading:
            false,

        initialized:
            false,

        loadController:
            null,

        loadSequence:
            0,

        totalServerProducts:
            0,

        loadedPages:
            0,

        hasMoreServerProducts:
            false

    };


    /* =========================================================================
       5. DOM REFERENCES
       ========================================================================= */

    const elements = {

        productList:
            null,

        resultsCount:
            null,

        searchInput:
            null,

        clearSearchButton:
            null,

        sortSelect:
            null,

        categoriesNav:
            null,

        pageHeading:
            null,

        liveRegion:
            null,

        productModal:
            null,

        modalBody:
            null,

        modalClose:
            null

    };


    /* =========================================================================
       6. INITIALIZATION
       ========================================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();

    }


    function initialize() {

        if (
            state.initialized
        ) {

            return;

        }

        state.initialized =
            true;

        cacheDOM();

        loadInitialSort();

        renderCategoryPills();

        bindEvents();

        updateClearSearchButton();

        updatePageHeading();

        renderLoadingState();

        /*
         * Start after initial paint.
         */
        window.setTimeout(
            () => {
                loadCatalog();
            },
            0
        );

    }


    /* =========================================================================
       7. DOM CACHE
       ========================================================================= */

    function cacheDOM() {

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

        elements.clearSearchButton =
            document.getElementById(
                "clear-search"
            );

        elements.sortSelect =
            document.getElementById(
                "product-sort"
            );

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

        elements.productModal =
            document.getElementById(
                "product-modal"
            );

        elements.modalBody =
            document.getElementById(
                "modal-body"
            );

        elements.modalClose =
            document.getElementById(
                "modal-close"
            );

    }


    function loadInitialSort() {

        if (
            elements.sortSelect?.value
        ) {

            state.sortBy =
                elements.sortSelect.value;

        } else {

            state.sortBy =
                CONFIG.DEFAULT_SORT;

        }

    }


    /* =========================================================================
       8. SVG ICONS
       ========================================================================= */

    function svgIcon(
        name,
        className = "ui-icon"
    ) {

        const safeClass =
            escapeHTML(
                className
            );

        const icons = {

            apps:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>
                `,

            solar:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m4.9 4.9 1.4 1.4"></path>
                    <path d="m17.7 17.7 1.4 1.4"></path>
                    <path d="m19.1 4.9-1.4 1.4"></path>
                    <path d="m6.3 17.7-1.4 1.4"></path>
                </svg>
                `,

            battery:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="3" y="7" width="17" height="10" rx="2"></rect>
                    <path d="M21 10v4"></path>
                    <path d="M8 12h7"></path>
                </svg>
                `,

            charger:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M9 2v6"></path>
                    <path d="M15 2v6"></path>
                    <path d="M7 8h10"></path>
                    <path d="M12 8v14"></path>
                </svg>
                `,

            powerbank:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <path d="M8 12h8"></path>
                    <path d="M12 8v8"></path>
                </svg>
                `,

            cable:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M7 3v5"></path>
                    <path d="M17 16v5"></path>
                    <path d="M7 8c0 5 10 3 10 8"></path>
                    <path d="M5 3h4"></path>
                    <path d="M15 21h4"></path>
                </svg>
                `,

            earphone:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M7 13a4 4 0 1 1 4-4v7"></path>
                    <path d="M17 13a4 4 0 1 0-4-4v7"></path>
                </svg>
                `,

            headphone:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M4 15v-3a8 8 0 0 1 16 0v3"></path>
                    <path d="M4 15h3v5H5a1 1 0 0 1-1-1z"></path>
                    <path d="M20 15h-3v5h2a1 1 0 0 0 1-1z"></path>
                </svg>
                `,

            modem:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="4" y="9" width="16" height="9" rx="2"></rect>
                    <path d="M8 13h.01"></path>
                    <path d="M12 13h.01"></path>
                    <path d="M16 13h.01"></path>
                    <path d="M9 6h6"></path>
                </svg>
                `,

            router:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="3" y="10" width="18" height="8" rx="2"></rect>
                    <path d="M8 10V7"></path>
                    <path d="M16 10V7"></path>
                    <path d="M6 14h.01"></path>
                    <path d="M10 14h.01"></path>
                    <path d="M14 14h.01"></path>
                </svg>
                `,

            laptop:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="5" y="4" width="14" height="11" rx="1.5"></rect>
                    <path d="M3 19h18"></path>
                    <path d="M8 19l1-3h6l1 3"></path>
                </svg>
                `,

            tool:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M14 6a5 5 0 0 0-7 7l-4 4 4 4 4-4a5 5 0 0 0 7-7"></path>
                    <path d="m13 11 4 4"></path>
                </svg>
                `,

            camera:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M4 7h4l2-2h4l2 2h4v12H4z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                </svg>
                `,

            home:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M3 11 12 4l9 7"></path>
                    <path d="M5 10v10h14V10"></path>
                    <path d="M9 20v-5h6v5"></path>
                </svg>
                `,

            category:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>
                `,

            eye:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
                    <circle cx="12" cy="12" r="2.5"></circle>
                </svg>
                `,

            cart:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"></path>
                    <path d="M16 4v5"></path>
                    <path d="M13.5 6.5h5"></path>
                </svg>
                `,

            check:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="m5 12 4 4L19 6"></path>
                </svg>
                `,

            inventory:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M4 7h16v13H4z"></path>
                    <path d="M8 7V4h8v3"></path>
                    <path d="M8 11h8"></path>
                </svg>
                `,

            refresh:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
                `,

            error:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
                `,

            star:
                `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"></path>
                </svg>
                `

        };

        return (
            icons[name] ||
            icons.category
        );

    }


    function categoryIcon(
        category
    ) {

        const text =
            String(
                category?.label ||
                ""
            )
                .toLowerCase();

        if (
            text.includes("solar")
        ) {
            return "solar";
        }

        if (
            text.includes("battery")
        ) {
            return "battery";
        }

        if (
            text.includes("charger")
        ) {
            return "charger";
        }

        if (
            text.includes("power bank")
        ) {
            return "powerbank";
        }

        if (
            text.includes("cable")
        ) {
            return "cable";
        }

        if (
            text.includes("earphone")
        ) {
            return "earphone";
        }

        if (
            text.includes("headphone")
        ) {
            return "headphone";
        }

        if (
            text.includes("modem")
        ) {
            return "modem";
        }

        if (
            text.includes("router")
        ) {
            return "router";
        }

        if (
            text.includes("laptop")
        ) {
            return "laptop";
        }

        if (
            text.includes("power tool")
        ) {
            return "tool";
        }

        if (
            text.includes("camera")
        ) {
            return "camera";
        }

        if (
            text.includes("smart")
        ) {
            return "home";
        }

        return "category";

    }


    /* =========================================================================
       9. EVENTS
       ========================================================================= */

    function bindEvents() {

        elements.searchInput?.addEventListener(
            "input",
            handleSearch
        );

        elements.searchInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {
                    clearSearch();
                }

                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();
                }

            }
        );

        elements.clearSearchButton?.addEventListener(
            "click",
            clearSearch
        );

        elements.sortSelect?.addEventListener(
            "change",
            event => {

                state.sortBy =
                    event.target?.value ||
                    CONFIG.DEFAULT_SORT;

                applyFiltersAndRender();

            }
        );

        elements.categoriesNav?.addEventListener(
            "click",
            handleCategoryClick
        );

        elements.productList?.addEventListener(
            "click",
            handleProductGridClick
        );

        elements.modalClose?.addEventListener(
            "click",
            closeProductModal
        );

        elements.productModal?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    elements.productModal
                ) {
                    closeProductModal();
                }

            }
        );

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape" &&
                    elements.productModal?.classList.contains(
                        "is-open"
                    )
                ) {
                    closeProductModal();
                }

            }
        );

    }


    /* =========================================================================
       10. CATEGORY UI
       ========================================================================= */

    function renderCategoryPills() {

        if (
            !elements.categoriesNav
        ) {

            console.warn(
                "[PRASUN SHOP] #products-categories not found."
            );

            return;

        }

        elements.categoriesNav.innerHTML =
            CATEGORY_MAP
                .map(
                    category => {

                        const active =
                            category.query ===
                            state.activeCategory;

                        return `
                            <button
                                type="button"
                                class="category-pill${
                                    active
                                        ? " active"
                                        : ""
                                }"
                                data-query="${escapeHTML(
                                    category.query
                                )}"
                                aria-pressed="${
                                    active
                                        ? "true"
                                        : "false"
                                }"
                            >

                                ${svgIcon(
                                    categoryIcon(
                                        category
                                    ),
                                    "ui-icon ui-icon-sm"
                                )}

                                <span>
                                    ${escapeHTML(
                                        category.label
                                    )}
                                </span>

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

        if (
            !button
        ) {
            return;
        }

        state.activeCategory =
            String(
                button.dataset.query ||
                ""
            );

        highlightCategory();

        applyFiltersAndRender();

    }


    function highlightCategory() {

        elements.categoriesNav
            ?.querySelectorAll(
                ".category-pill"
            )
            .forEach(
                button => {

                    const active =
                        String(
                            button.dataset.query ||
                            ""
                        ) ===
                        state.activeCategory;

                    button.classList.toggle(
                        "active",
                        active
                    );

                    button.setAttribute(
                        "aria-pressed",
                        active
                            ? "true"
                            : "false"
                    );

                }
            );

    }


    function getActiveCategory() {

        return (
            CATEGORY_MAP.find(
                item =>
                    item.query ===
                    state.activeCategory
            ) ||
            CATEGORY_MAP[0]
        );

    }


    /* =========================================================================
       11. CATALOG LOAD
       ========================================================================= */

    async function loadCatalog() {

        /*
         * Prevent overlapping requests.
         *
         * A manual retry cancels the previous load first.
         */
        cancelCurrentLoad();

        state.loading =
            true;

        const controller =
            new AbortController();

        state.loadController =
            controller;

        const loadId =
            ++state.loadSequence;

        renderLoadingState();

        try {

            const result =
                await fetchAllCatalogPages(
                    controller.signal,
                    loadId
                );

            if (
                loadId !==
                state.loadSequence
            ) {
                return;
            }

            state.products =
                deduplicateProducts(
                    result.products
                )
                    .slice(
                        0,
                        CONFIG.MAX_PRODUCTS
                    );

            state.totalServerProducts =
                result.totalProducts;

            state.loadedPages =
                result.pagesLoaded;

            state.hasMoreServerProducts =
                result.hasMore;

            console.info(
                "[PRASUN SHOP] Catalog loaded.",
                {
                    products:
                        state.products.length,
                    serverTotal:
                        result.totalProducts,
                    pages:
                        result.pagesLoaded,
                    hasMore:
                        result.hasMore
                }
            );

            /*
             * Normalize before rendering.
             *
             * fetchAllCatalogPages() already returns raw products.
             */
            state.products =
                state.products
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    );

            applyFiltersAndRender();

            if (
                state.hasMoreServerProducts
            ) {

                console.warn(
                    `[PRASUN SHOP] Catalog reached MAX_PRODUCTS (${CONFIG.MAX_PRODUCTS}). More products exist on the server.`
                );

            }

        } catch (
            error
        ) {

            if (
                loadId !==
                state.loadSequence
            ) {
                return;
            }

            console.error(
                "[PRASUN SHOP] Catalog loading failed:",
                error
            );

            if (
                error?.name ===
                "AbortError"
            ) {

                renderErrorState(
                    "The catalog request was cancelled or timed out."
                );

            } else {

                renderErrorState(
                    error?.message ||
                    "Unable to load products."
                );

            }

        } finally {

            if (
                loadId ===
                state.loadSequence
            ) {

                state.loading =
                    false;

                state.loadController =
                    null;

            }

        }

    }


    function cancelCurrentLoad() {

        if (
            state.loadController
        ) {

            try {
                state.loadController.abort();
            } catch {
                /* Ignore abort errors. */
            }

        }

        state.loadController =
            null;

    }


    async function fetchAllCatalogPages(
        signal,
        loadId
    ) {

        const collected =
            [];

        const seenPids =
            new Set();

        let page =
            1;

        let pagesLoaded =
            0;

        let totalProducts =
            0;

        let hasMore =
            true;

        while (
            hasMore &&
            collected.length <
                CONFIG.MAX_PRODUCTS
        ) {

            if (
                loadId !==
                state.loadSequence
            ) {

                throw new DOMException(
                    "Stale catalog load.",
                    "AbortError"
                );

            }

            const endpoint =
                buildProductsPageUrl(
                    page
                );

            const data =
                await fetchProductsPage(
                    endpoint,
                    signal
                );

            const pageProducts =
                extractProducts(
                    data
                );

            const normalizedServerCount =
                Number(
                    data?.totalMatches ??
                    data?.count ??
                    0
                );

            if (
                Number.isFinite(
                    normalizedServerCount
                ) &&
                normalizedServerCount >
                    totalProducts
            ) {

                totalProducts =
                    normalizedServerCount;

            }

            pagesLoaded++;

            for (
                const product
                of pageProducts
            ) {

                const pid =
                    getProductIdentity(
                        product
                    );

                if (
                    !pid ||
                    seenPids.has(
                        pid
                    )
                ) {
                    continue;
                }

                seenPids.add(
                    pid
                );

                collected.push(
                    product
                );

                if (
                    collected.length >=
                    CONFIG.MAX_PRODUCTS
                ) {
                    break;
                }

            }

            /*
             * Worker returns:
             *
             * hasMore
             * nextCursor
             *
             * We use the explicit hasMore value when available.
             */
            if (
                typeof data?.hasMore ===
                "boolean"
            ) {

                hasMore =
                    data.hasMore;

            } else {

                /*
                 * Compatibility fallback for older Worker responses.
                 */
                hasMore =
                    pageProducts.length >=
                    CONFIG.PAGE_SIZE;

            }

            if (
                !pageProducts.length
            ) {

                hasMore =
                    false;

            }

            if (
                hasMore
            ) {

                page++;

            }

            /*
             * Safety guard against a malformed Worker response that keeps
             * returning identical pages forever.
             */
            if (
                pagesLoaded >
                Math.ceil(
                    CONFIG.MAX_PRODUCTS /
                        CONFIG.PAGE_SIZE
                ) +
                5
            ) {

                console.warn(
                    "[PRASUN SHOP] Catalog pagination safety limit reached."
                );

                hasMore =
                    false;

            }

            /*
             * Let the browser update between pages.
             */
            await yieldToBrowser();

        }

        return {
            products:
                collected,

            totalProducts:
                Math.max(
                    totalProducts,
                    collected.length
                ),

            pagesLoaded,

            hasMore:
                hasMore &&
                collected.length >=
                    CONFIG.MAX_PRODUCTS

        };

    }


    function buildProductsPageUrl(
        page
    ) {

        const url =
            new URL(
                `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`
            );

        url.searchParams.set(
            "limit",
            String(
                CONFIG.PAGE_SIZE
            )
        );

        url.searchParams.set(
            "page",
            String(
                page
            )
        );

        return url.toString();

    }


    async function fetchProductsPage(
        endpoint,
        signal
    ) {

        const response =
            await fetch(
                endpoint,
                {
                    method:
                        "GET",

                    headers:
                        {
                            Accept:
                                "application/json"
                        },

                    cache:
                        CONFIG.CACHE_MODE,

                    signal

                }
            );

        if (
            !response.ok
        ) {

            throw new Error(
                `Product service returned HTTP ${response.status}.`
            );

        }

        let data;

        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "Product service returned invalid JSON."
            );

        }

        if (
            data?.success ===
            false
        ) {

            throw new Error(
                data?.error ||
                "Product service returned an error."
            );

        }

        return data;

    }


    function extractProducts(
        data
    ) {

        if (
            Array.isArray(
                data
            )
        ) {

            return data;

        }

        if (
            Array.isArray(
                data?.products
            )
        ) {

            return data.products;

        }

        if (
            Array.isArray(
                data?.data?.products
            )
        ) {

            return data.data.products;

        }

        if (
            Array.isArray(
                data?.data?.list
            )
        ) {

            return data.data.list;

        }

        if (
            Array.isArray(
                data?.data
            )
        ) {

            return data.data;

        }

        return [];

    }


    function getProductIdentity(
        product
    ) {

        const value =
            product?.pid ??
            product?.cj_id ??
            product?.id ??
            product?.productId ??
            product?.sku ??
            "";

        return String(
            value
        )
            .trim();

    }


    function deduplicateProducts(
        products
    ) {

        const map =
            new Map();

        for (
            const product
            of products
        ) {

            const id =
                getProductIdentity(
                    product
                );

            if (
                !id
            ) {
                continue;
            }

            map.set(
                id,
                product
            );

        }

        return [
            ...map.values()
        ];

    }


    function yieldToBrowser() {

        return new Promise(
            resolve => {

                if (
                    typeof window.requestAnimationFrame ===
                    "function"
                ) {

                    window.requestAnimationFrame(
                        () =>
                            resolve()
                    );

                } else {

                    window.setTimeout(
                        resolve,
                        0
                    );

                }

            }
        );

    }


    /* =========================================================================
       12. SEARCH
       ========================================================================= */

    function handleSearch(
        event
    ) {

        state.searchQuery =
            normalizeSearchQuery(
                event.target?.value ||
                ""
            );

        updateClearSearchButton();

        applyFiltersAndRender();

    }


    function clearSearch() {

        if (
            elements.searchInput
        ) {

            elements.searchInput.value =
                "";

        }

        state.searchQuery =
            "";

        updateClearSearchButton();

        applyFiltersAndRender();

        elements.searchInput?.focus();

    }


    function updateClearSearchButton() {

        if (
            !elements.clearSearchButton
        ) {
            return;
        }

        elements.clearSearchButton.hidden =
            state.searchQuery.length ===
            0;

    }


    function normalizeSearchQuery(
        value
    ) {

        return String(
            value ||
            ""
        )
            .toLowerCase()
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    /* =========================================================================
       13. LOCAL FILTERING
       ========================================================================= */

    function applyFiltersAndRender() {

        let products =
            [
                ...state.products
            ];

        /*
         * ---------------------------------------------------------------
         * SEARCH
         * ---------------------------------------------------------------
         */

        if (
            state.searchQuery
        ) {

            const terms =
                state.searchQuery
                    .split(
                        /\s+/
                    )
                    .filter(
                        Boolean
                    );

            products =
                products.filter(
                    product => {

                        const text =
                            buildSearchText(
                                product
                            );

                        return terms.every(
                            term =>
                                text.includes(
                                    term
                                )
                        );

                    }
                );

        }

        /*
         * ---------------------------------------------------------------
         * CATEGORY
         * ---------------------------------------------------------------
         */

        if (
            state.activeCategory
        ) {

            const category =
                getActiveCategory();

            products =
                products.filter(
                    product =>
                        matchesCategory(
                            product,
                            category
                        )
                );

        }

        /*
         * ---------------------------------------------------------------
         * SORT
         * ---------------------------------------------------------------
         */

        products.sort(
            compareProducts
        );

        state.filteredProducts =
            products.slice(
                0,
                CONFIG.MAX_VISIBLE_PRODUCTS
            );

        updatePageHeading();

        updateResultsCount();

        if (
            state.filteredProducts.length ===
            0
        ) {

            let message =
                "No products are currently available.";

            if (
                state.searchQuery
            ) {

                message =
                    `No products found for "${state.searchQuery}".`;

            } else if (
                state.activeCategory
            ) {

                message =
                    `No products found in "${getActiveCategory().label}".`;

            }

            renderEmptyState(
                message
            );

            return;

        }

        renderProductGrid();

    }


    function buildSearchText(
        product
    ) {

        return [

            product?.title,

            product?.name,

            product?.category,

            product?.oneCategoryName,

            product?.twoCategoryName,

            product?.threeCategoryName,

            product?.sku,

            product?.pid,

            product?.cj_id,

            product?.variantSku,

            product?.variantOptions,

            stripHtml(
                product?.description
            )

        ]
            .map(
                value =>
                    String(
                        value ||
                        ""
                    )
                        .toLowerCase()
            )
            .join(
                " "
            );

    }


    function matchesCategory(
        product,
        category
    ) {

        if (
            !category ||
            !category.terms ||
            !category.terms.length
        ) {

            return true;

        }

        const searchable =
            buildSearchText(
                product
            );

        return category.terms.some(
            term =>
                searchable.includes(
                    String(
                        term
                    )
                        .toLowerCase()
                )
        );

    }


    /* =========================================================================
       14. SORT
       ========================================================================= */

    function compareProducts(
        a,
        b
    ) {

        const sort =
            String(
                state.sortBy ||
                CONFIG.DEFAULT_SORT
            )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );

        const priceA =
            Number(
                a?.price
            ) || 0;

        const priceB =
            Number(
                b?.price
            ) || 0;

        const nameA =
            String(
                a?.name ||
                a?.title ||
                ""
            );

        const nameB =
            String(
                b?.name ||
                b?.title ||
                ""
            );

        if (
            sort.includes(
                "lowtohigh"
            ) ||
            sort.includes(
                "priceasc"
            )
        ) {

            return (
                priceA -
                priceB
            );

        }

        if (
            sort.includes(
                "hightolow"
            ) ||
            sort.includes(
                "pricedesc"
            )
        ) {

            return (
                priceB -
                priceA
            );

        }

        if (
            sort.includes(
                "atoz"
            ) ||
            sort.includes(
                "nameaz"
            )
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

        if (
            sort.includes(
                "ztoa"
            ) ||
            sort.includes(
                "nameza"
            )
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
         * FEATURED
         *
         * In-stock products first, then alphabetical order.
         */

        const stockA =
            Number(
                a?.quantity
            ) > 0;

        const stockB =
            Number(
                b?.quantity
            ) > 0;

        if (
            stockA &&
            !stockB
        ) {

            return -1;

        }

        if (
            !stockA &&
            stockB
        ) {

            return 1;

        }

        return nameA.localeCompare(
            nameB,
            undefined,
            {
                sensitivity:
                    "base"
            }
        );

    }


    /* =========================================================================
       15. PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(
        raw
    ) {

        if (
            !raw ||
            typeof raw !==
                "object"
        ) {

            return null;

        }

        const pid =
            String(
                raw.pid ??
                raw.productId ??
                raw.id ??
                ""
            )
                .trim();

        const id =
            String(
                raw.id ??
                raw.pid ??
                raw.productId ??
                raw.sku ??
                ""
            )
                .trim();

        const name =
            String(
                raw.title ??
                raw.name ??
                raw.productNameEn ??
                raw.productName ??
                "CJ Product"
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (
            !id ||
            !name
        ) {

            return null;

        }

        /*
         * Worker already returns the final storefront selling price.
         */
        const price =
            normalizePrice(
                raw.price ??
                raw.salePrice ??
                raw.sellPrice ??
                raw.unitPrice ??
                0
            );

        const quantity =
            normalizeInventory(
                firstDefined(
                    raw.quantity,
                    raw.inventory,
                    raw.totalInventory,
                    raw.warehouseInventoryNum,
                    raw.totalVerifiedInventory,
                    raw.totalUnVerifiedInventory,
                    0
                )
            );

        const rating =
            normalizeRating(
                raw.rating
            );

        const images =
            getGalleryImages(
                raw
            );

        const image =
            normalizeImageUrl(
                raw.image
            ) ||
            images[0] ||
            PLACEHOLDER_IMAGE;

        const originalImage =
            normalizeImageUrl(
                raw.originalImage
            ) ||
            normalizeImageUrl(
                raw.bigImage
            ) ||
            normalizeImageUrl(
                raw.productImage
            );

        const originalImages =
            normalizeOriginalImages(
                raw
            );

        const variants =
            normalizeVariants(
                raw.variants
            );

        return {

            ...raw,

            id,

            pid,

            cj_id:
                String(
                    raw.cj_id ||
                    raw.cjId ||
                    pid
                )
                    .trim(),

            sku:
                String(
                    raw.sku ||
                    raw.productSku ||
                    ""
                )
                    .trim(),

            title:
                name,

            name,

            description:
                String(
                    raw.description ||
                    ""
                ),

            category:
                String(
                    raw.category ||
                    raw.categoryName ||
                    raw.threeCategoryName ||
                    raw.twoCategoryName ||
                    raw.oneCategoryName ||
                    CONFIG.DEFAULT_CATEGORY
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim(),

            oneCategoryName:
                String(
                    raw.oneCategoryName ||
                    ""
                )
                    .trim(),

            twoCategoryName:
                String(
                    raw.twoCategoryName ||
                    ""
                )
                    .trim(),

            threeCategoryName:
                String(
                    raw.threeCategoryName ||
                    ""
                )
                    .trim(),

            price,

            quantity,

            rating,

            image,

            images,

            originalImage,

            originalImages,

            variants,

            source:
                "CJ Dropshipping"

        };

    }


    function normalizeVariants(
        variants
    ) {

        if (
            !Array.isArray(
                variants
            )
        ) {

            return [];

        }

        return variants
            .map(
                variant => {

                    if (
                        !variant ||
                        typeof variant !==
                            "object"
                    ) {

                        return null;

                    }

                    return {

                        ...variant,

                        vid:
                            String(
                                variant?.vid ||
                                variant?.variantId ||
                                ""
                            )
                                .trim(),

                        pid:
                            String(
                                variant?.pid ||
                                ""
                            )
                                .trim(),

                        sku:
                            String(
                                variant?.sku ||
                                variant?.variantSku ||
                                ""
                            )
                                .trim(),

                        name:
                            String(
                                variant?.name ||
                                variant?.variantNameEn ||
                                variant?.variantName ||
                                "Default"
                            )
                                .trim(),

                        variantKey:
                            String(
                                variant?.variantKey ||
                                ""
                            )
                                .trim(),

                        price:
                            normalizePrice(
                                variant?.price
                            ),

                        costPrice:
                            normalizePrice(
                                variant?.costPrice
                            ),

                        inventory:
                            normalizeInventory(
                                variant?.inventory
                            )

                    };

                }
            )
            .filter(
                Boolean
            );

    }


    function normalizeInventory(
        value
    ) {

        /*
         * Already-number values.
         */
        if (
            typeof value ===
            "number"
        ) {

            return Number.isFinite(
                value
            )
                ? Math.max(
                    0,
                    Math.floor(
                        value
                    )
                )
                : 0;

        }

        /*
         * Strings such as:
         *
         * "1,250"
         * "1250 pcs"
         */
        const number =
            Number(
                String(
                    value ??
                    ""
                )
                    .replace(
                        /,/g,
                        ""
                    )
                    .replace(
                        /[^0-9.-]/g,
                        ""
                    )
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return 0;

        }

        return Math.max(
            0,
            Math.floor(
                number
            )
        );

    }


    function normalizeRating(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return 0;

        }

        return Number(
            Math.min(
                5,
                Math.max(
                    0,
                    number
                )
            )
                .toFixed(
                    1
                )
        );

    }


    function normalizePrice(
        value
    ) {

        if (
            typeof value ===
            "object" &&
            value !== null
        ) {

            value =
                value.amount ??
                value.value ??
                value.price ??
                0;

        }

        const number =
            Number(
                String(
                    value ??
                    0
                )
                    .replace(
                        /,/g,
                        ""
                    )
                    .replace(
                        /[^0-9.-]/g,
                        ""
                    )
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return 0;

        }

        return Number(
            number.toFixed(
                2
            )
        );

    }


    /* =========================================================================
       16. IMAGE HANDLING
       ========================================================================= */

    function normalizeImageUrl(
        value
    ) {

        if (
            !value ||
            typeof value !==
                "string"
        ) {

            return "";

        }

        let url =
            value.trim();

        if (
            !url
        ) {

            return "";

        }

        if (
            url.startsWith(
                "data:image/"
            )
        ) {

            return url;

        }

        if (
            url.startsWith(
                "//"
            )
        ) {

            url =
                `https:${url}`;

        }

        if (
            /^http:\/\//i.test(
                url
            )
        ) {

            url =
                url.replace(
                    /^http:\/\//i,
                    "https://"
                );

        }

        /*
         * Only allow absolute HTTPS URLs.
         *
         * Relative paths are intentionally ignored because the Worker
         * normalizes CJ images into absolute HTTPS URLs.
         */
        if (
            !/^https:\/\//i.test(
                url
            )
        ) {

            return "";

        }

        return url;

    }


    function isProxyUrl(
        url
    ) {

        if (
            typeof url !==
                "string"
        ) {

            return false;

        }

        try {

            const parsed =
                new URL(
                    url
                );

            return (
                parsed.pathname ===
                    CONFIG.IMAGE_PROXY_ENDPOINT ||
                parsed.pathname ===
                    "/image-proxy"
            );

        } catch {

            return false;

        }

    }


    function buildProxyUrl(
        value
    ) {

        const normalized =
            normalizeImageUrl(
                value
            );

        if (
            !normalized
        ) {

            return "";

        }

        if (
            normalized.startsWith(
                "data:image/"
            )
        ) {

            return normalized;

        }

        if (
            isProxyUrl(
                normalized
            )
        ) {

            return normalized;

        }

        return (
            `${CONFIG.API_BASE}` +
            `${CONFIG.IMAGE_PROXY_ENDPOINT}` +
            `?url=` +
            encodeURIComponent(
                normalized
            )
        );

    }


    function collectProductImageUrls(
        product
    ) {

        const candidates =
            [];

        /*
         * The Worker already provides:
         *
         *     image
         *     images
         *     originalImage
         *     originalImages
         *
         * Keep the older CJ fields as compatibility fallbacks.
         */

        candidates.push(
            product?.image
        );

        if (
            Array.isArray(
                product?.images
            )
        ) {

            candidates.push(
                ...product.images
            );

        }

        candidates.push(
            product?.originalImage
        );

        if (
            Array.isArray(
                product?.originalImages
            )
        ) {

            candidates.push(
                ...product.originalImages
            );

        }

        candidates.push(
            product?.bigImage
        );

        candidates.push(
            product?.productImage
        );

        candidates.push(
            product?.productImg
        );

        candidates.push(
            product?.mainImage
        );

        if (
            Array.isArray(
                product?.productImageSet
            )
        ) {

            candidates.push(
                ...product.productImageSet
            );

        }

        if (
            typeof product?.productImageSet ===
            "string"
        ) {

            candidates.push(
                ...product.productImageSet
                    .split(",")
            );

        }

        if (
            Array.isArray(
                product?.imageList
            )
        ) {

            for (
                const item
                of product.imageList
            ) {

                if (
                    typeof item ===
                    "string"
                ) {

                    candidates.push(
                        item
                    );

                } else if (
                    item &&
                    typeof item ===
                        "object"
                ) {

                    candidates.push(
                        item.url,
                        item.imageUrl,
                        item.bigImage,
                        item.productImage
                    );

                }

            }

        }

        return [
            ...new Set(
                candidates
                    .map(
                        normalizeImageUrl
                    )
                    .filter(
                        Boolean
                    )
            )
        ];

    }


    function normalizeOriginalImages(
        product
    ) {

        const candidates =
            [];

        candidates.push(
            product?.originalImage
        );

        if (
            Array.isArray(
                product?.originalImages
            )
        ) {

            candidates.push(
                ...product.originalImages
            );

        }

        candidates.push(
            product?.bigImage
        );

        candidates.push(
            product?.productImage
        );

        candidates.push(
            product?.productImg
        );

        return [
            ...new Set(
                candidates
                    .map(
                        normalizeImageUrl
                    )
                    .filter(
                        Boolean
                    )
            )
        ];

    }


    function getGalleryImages(
        product
    ) {

        const rawImages =
            collectProductImageUrls(
                product
            );

        const result =
            [];

        for (
            const image
            of rawImages
        ) {

            const proxied =
                buildProxyUrl(
                    image
                );

            if (
                proxied &&
                !result.includes(
                    proxied
                )
            ) {

                result.push(
                    proxied
                );

            }

        }

        return result;

    }


    /* =========================================================================
       17. PRODUCT GRID
       ========================================================================= */

    function renderProductGrid() {

        if (
            !elements.productList
        ) {

            return;

        }

        elements.productList.innerHTML =
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


    function renderProductCard(
        product
    ) {

        const productId =
            escapeHTML(
                product.id
            );

        const title =
            escapeHTML(
                product.name ||
                "CJ Product"
            );

        const category =
            escapeHTML(
                product.category ||
                CONFIG.DEFAULT_CATEGORY
            );

        const image =
            escapeHTML(
                product.image ||
                PLACEHOLDER_IMAGE
            );

        const originalImage =
            escapeHTML(
                product.originalImage ||
                ""
            );

        const price =
            formatPrice(
                product.price
            );

        const quantity =
            Number(
                product.quantity
            ) || 0;

        const available =
            quantity >
            0;

        const description =
            stripHtml(
                product.description
            );

        const shortDescription =
            description.length >
                105
                ? (
                    description.slice(
                        0,
                        105
                    ) +
                    "..."
                )
                : (
                    description ||
                    "Product information available."
                );

        const variantCount =
            Array.isArray(
                product.variants
            )
                ? product.variants.length
                : 0;

        return `

            <article
                class="product-card"
                data-product-id="${productId}"
            >

                <button
                    type="button"
                    class="product-card-image-wrap"
                    data-action="view-details"
                    data-product-id="${productId}"
                    aria-label="View ${title}"
                >

                    <span
                        class="product-badge"
                    >

                        ${svgIcon(
                            "category",
                            "ui-icon ui-icon-sm"
                        )}

                        <span>
                            ${category}
                        </span>

                    </span>


                    <img
                        src="${image}"
                        alt="${title}"
                        class="product-image"
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        data-original-image="${originalImage}"
                    >

                </button>


                <div
                    class="product-card-body"
                >

                    <h3
                        class="product-title"
                    >

                        <button
                            type="button"
                            class="product-title-button"
                            data-action="view-details"
                            data-product-id="${productId}"
                        >
                            ${title}
                        </button>

                    </h3>


                    <p
                        class="product-card-description"
                    >
                        ${escapeHTML(
                            shortDescription
                        )}
                    </p>


                    ${
                        product.rating > 0
                            ? `
                                <div
                                    class="product-rating"
                                    aria-label="Rating ${product.rating.toFixed(
                                        1
                                    )} out of 5"
                                >

                                    ${svgIcon(
                                        "star",
                                        "ui-icon ui-icon-sm"
                                    )}

                                    <span>
                                        ${product.rating.toFixed(
                                            1
                                        )}
                                    </span>

                                </div>
                            `
                            : ""
                    }


                    ${
                        variantCount > 0
                            ? `
                                <div
                                    class="product-variant-count"
                                    aria-label="${variantCount} variants available"
                                >
                                    ${variantCount}
                                    ${
                                        variantCount === 1
                                            ? "variant"
                                            : "variants"
                                    }
                                </div>
                            `
                            : ""
                    }


                    <div
                        class="product-card-footer"
                    >

                        <div
                            class="price-container"
                        >

                            <span
                                class="product-price"
                            >
                                ${escapeHTML(
                                    price
                                )}
                            </span>

                        </div>


                        <div
                            class="product-actions-group"
                        >

                            <button
                                type="button"
                                class="btn-card btn-secondary view-details-btn"
                                data-action="view-details"
                                data-product-id="${productId}"
                            >

                                ${svgIcon(
                                    "eye",
                                    "ui-icon ui-icon-sm"
                                )}

                                <span>
                                    View Details
                                </span>

                            </button>


                            <button
                                type="button"
                                class="btn-card btn-primary btn-add-to-cart add-to-cart-btn"
                                data-action="add-cart"
                                data-product-id="${productId}"
                                ${
                                    available
                                        ? ""
                                        : "disabled"
                                }
                            >

                                ${svgIcon(
                                    available
                                        ? "cart"
                                        : "inventory",
                                    "ui-icon ui-icon-sm"
                                )}

                                <span>
                                    ${
                                        available
                                            ? "Add to Cart"
                                            : "Out of Stock"
                                    }
                                </span>

                            </button>

                        </div>

                    </div>

                </div>

            </article>

        `;

    }


    /* =========================================================================
       18. GRID EVENTS
       ========================================================================= */

    function handleProductGridClick(
        event
    ) {

        const detailsButton =
            event.target.closest(
                '[data-action="view-details"]'
            );

        if (
            detailsButton
        ) {

            event.preventDefault();

            openProductModal(
                detailsButton.dataset.productId
            );

            return;

        }

        const cartButton =
            event.target.closest(
                '[data-action="add-cart"]'
            );

        if (
            !cartButton
        ) {

            return;

        }

        event.preventDefault();

        if (
            cartButton.disabled
        ) {

            return;

        }

        const product =
            state.products.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        cartButton.dataset.productId
                    )
            );

        if (
            !product
        ) {

            return;

        }

        if (
            Number(
                product.quantity
            ) <= 0
        ) {

            announce(
                `${product.name} is currently out of stock.`
            );

            return;

        }

        const added =
            invokeAddToCart(
                product
            );

        if (
            !added
        ) {

            return;

        }

        cartButton.disabled =
            true;

        cartButton.classList.add(
            "added"
        );

        cartButton.innerHTML =
            `
                ${svgIcon(
                    "check",
                    "ui-icon ui-icon-sm"
                )}

                <span>
                    Added
                </span>
            `;

        announce(
            `${product.name} added to cart.`
        );

        window.setTimeout(
            () => {

                /*
                 * The button may have been removed from the DOM by another
                 * render between click and timeout.
                 */
                if (
                    !cartButton.isConnected
                ) {
                    return;
                }

                cartButton.disabled =
                    false;

                cartButton.classList.remove(
                    "added"
                );

                cartButton.innerHTML =
                    `
                        ${svgIcon(
                            "cart",
                            "ui-icon ui-icon-sm"
                        )}

                        <span>
                            Add to Cart
                        </span>
                    `;

            },
            1200
        );

    }


    function invokeAddToCart(
        product
    ) {

        if (
            typeof window.addToCart ===
            "function"
        ) {

            try {

                const result =
                    window.addToCart(
                        product
                    );

                /*
                 * Many cart implementations return nothing on success.
                 *
                 * Only an explicit false means failure.
                 */
                return result !== false;

            } catch (
                error
            ) {

                console.error(
                    "[PRASUN SHOP] addToCart() failed:",
                    error
                );

                announce(
                    "Unable to add this product to the cart."
                );

                return false;

            }

        }

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "cart:add",
                    {
                        detail:
                            product
                    }
                )
            );

            return true;

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Cart event failed:",
                error
            );

            announce(
                "Unable to add this product to the cart."
            );

            return false;

        }

    }


    /* =========================================================================
       19. IMAGE FALLBACK
       ========================================================================= */

    function attachProductImageFallbacks() {

        document
            .querySelectorAll(
                ".product-image"
            )
            .forEach(
                image => {

                    if (
                        image.dataset.fallbackBound ===
                        "true"
                    ) {
                        return;
                    }

                    image.dataset.fallbackBound =
                        "true";

                    image.addEventListener(
                        "error",
                        handleImageError
                    );

                }
            );

    }


    function handleImageError(
        event
    ) {

        const image =
            event.currentTarget;

        if (
            !image
        ) {
            return;
        }

        const original =
            image.dataset.originalImage;

        /*
         * First fallback:
         *
         * current proxied URL failed
         * -> try original CJ HTTPS URL
         */
        if (
            original &&
            !image.dataset.originalAttempted
        ) {

            image.dataset.originalAttempted =
                "true";

            const normalizedOriginal =
                normalizeImageUrl(
                    original
                );

            if (
                normalizedOriginal &&
                normalizedOriginal !==
                    image.src
            ) {

                image.src =
                    normalizedOriginal;

                return;

            }

        }

        /*
         * Final fallback:
         * local placeholder.
         */
        if (
            !image.dataset.placeholderUsed
        ) {

            image.dataset.placeholderUsed =
                "true";

            image.src =
                PLACEHOLDER_IMAGE;

        }

    }


    /* =========================================================================
       20. MODAL
       ========================================================================= */

    function sanitizeDescription(
        html
    ) {

        if (
            !html
        ) {

            return "";

        }

        const parser =
            new DOMParser();

        const parsed =
            parser.parseFromString(
                String(
                    html
                ),
                "text/html"
            );

        const forbiddenTags = [
            "script",
            "style",
            "iframe",
            "object",
            "embed",
            "form",
            "input",
            "button",
            "textarea",
            "select",
            "option",
            "video",
            "audio",
            "source",
            "link",
            "meta",
            "base"
        ];

        forbiddenTags.forEach(
            tag => {

                parsed
                    .querySelectorAll(
                        tag
                    )
                    .forEach(
                        node =>
                            node.remove()
                    );

            }
        );

        parsed
            .querySelectorAll(
                "*"
            )
            .forEach(
                element => {

                    [
                        ...element.attributes
                    ]
                        .forEach(
                            attribute => {

                                const name =
                                    attribute.name
                                        .toLowerCase();

                                const value =
                                    attribute.value
                                        .trim();

                                /*
                                 * Remove all event handlers.
                                 */
                                if (
                                    name.startsWith(
                                        "on"
                                    )
                                ) {

                                    element.removeAttribute(
                                        attribute.name
                                    );

                                    return;

                                }

                                /*
                                 * Remove style attributes.
                                 *
                                 * This prevents CJ HTML from overriding
                                 * storefront styles.
                                 */
                                if (
                                    name ===
                                    "style"
                                ) {

                                    element.removeAttribute(
                                        attribute.name
                                    );

                                    return;

                                }

                                /*
                                 * Validate links.
                                 */
                                if (
                                    name ===
                                    "href"
                                ) {

                                    if (
                                        !isSafeHref(
                                            value
                                        )
                                    ) {

                                        element.removeAttribute(
                                            "href"
                                        );

                                    } else {

                                        element.setAttribute(
                                            "target",
                                            "_blank"
                                        );

                                        element.setAttribute(
                                            "rel",
                                            "noopener noreferrer nofollow"
                                        );

                                    }

                                }

                                /*
                                 * Images are normalized and routed through
                                 * the Worker proxy.
                                 */
                                if (
                                    name ===
                                    "src"
                                ) {

                                    const normalized =
                                        normalizeImageUrl(
                                            value
                                        );

                                    if (
                                        normalized
                                    ) {

                                        element.setAttribute(
                                            "src",
                                            buildProxyUrl(
                                                normalized
                                            )
                                        );

                                    } else {

                                        element.removeAttribute(
                                            "src"
                                        );

                                    }

                                }

                            }
                        );

                }
            );

        parsed
            .querySelectorAll(
                "img"
            )
            .forEach(
                image => {

                    image.setAttribute(
                        "loading",
                        "lazy"
                    );

                    image.setAttribute(
                        "decoding",
                        "async"
                    );

                    image.setAttribute(
                        "referrerpolicy",
                        "no-referrer"
                    );

                }
            );

        return parsed
            .body
            .innerHTML;

    }


    function isSafeHref(
        value
    ) {

        if (
            !value
        ) {
            return false;
        }

        if (
            value.startsWith(
                "#"
            )
        ) {
            return true;
        }

        try {

            const parsed =
                new URL(
                    value,
                    window.location.href
                );

            return (
                parsed.protocol ===
                    "https:" ||
                parsed.protocol ===
                    "http:"
            );

        } catch {

            return false;

        }

    }


    function openProductModal(
        productId
    ) {

        if (
            !elements.productModal ||
            !elements.modalBody
        ) {

            console.error(
                "[PRASUN SHOP] Product modal is missing from index.html."
            );

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

        if (
            !product
        ) {

            return;

        }

        const images =
            getGalleryImages(
                product
            );

        const primaryImage =
            product.image ||
            images[0] ||
            PLACEHOLDER_IMAGE;

        const title =
            escapeHTML(
                product.name ||
                "CJ Product"
            );

        const category =
            escapeHTML(
                product.category ||
                CONFIG.DEFAULT_CATEGORY
            );

        const quantity =
            Number(
                product.quantity
            ) || 0;

        const description =
            sanitizeDescription(
                product.description
            ) ||
            `
                <p>
                    Product description is currently unavailable.
                </p>
            `;

        const variants =
            Array.isArray(
                product.variants
            )
                ? product.variants
                : [];

        const galleryHtml =
            images.length > 1
                ? `
                    <div
                        class="modal-gallery"
                    >

                        ${images
                            .map(
                                (
                                    image,
                                    index
                                ) => `

                                    <button
                                        type="button"
                                        class="modal-gallery-thumb ${
                                            index === 0
                                                ? "is-active"
                                                : ""
                                        }"
                                        data-gallery-image="${escapeHTML(
                                            image
                                        )}"
                                        aria-label="View product image ${
                                            index + 1
                                        }"
                                    >

                                        <img
                                            src="${escapeHTML(
                                                image
                                            )}"
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            referrerpolicy="no-referrer"
                                        >

                                    </button>

                                `
                            )
                            .join("")}

                    </div>
                `
                : "";

        const variantsHtml =
            variants.length > 1
                ? `
                    <div
                        class="product-variants-info"
                    >

                        <strong>
                            Variants:
                        </strong>

                        <span>
                            ${variants.length}
                            available
                        </span>

                    </div>
                `
                : "";

        elements.modalBody.innerHTML =
            `

                <div
                    class="modal-image-column"
                >

                    <img
                        id="main-modal-img"
                        src="${escapeHTML(
                            primaryImage
                        )}"
                        alt="${title}"
                        class="modal-product-img"
                        loading="eager"
                        decoding="async"
                        referrerpolicy="no-referrer"
                    >

                    ${galleryHtml}

                </div>


                <div
                    class="modal-details"
                >

                    <span
                        class="product-category-tag"
                    >
                        ${category}
                    </span>


                    <h2
                        id="modal-title"
                        class="modal-product-title"
                    >
                        ${title}
                    </h2>


                    <div
                        class="modal-product-price-row"
                    >

                        <strong
                            class="modal-product-price"
                        >
                            ${formatPrice(
                                product.price
                            )}
                        </strong>


                        <span
                            class="modal-product-stock"
                        >
                            ${
                                quantity > 0
                                    ? `In Stock: ${quantity}`
                                    : "Out of Stock"
                            }
                        </span>

                    </div>


                    ${variantsHtml}


                    <div
                        class="modal-description-box"
                    >

                        <strong
                            class="modal-description-title"
                        >
                            Product Description
                        </strong>


                        <div
                            class="cj-description-container"
                        >
                            ${description}
                        </div>

                    </div>


                    <button
                        type="button"
                        id="modal-add-cart-btn"
                        class="btn-primary modal-add-cart-button"
                        ${
                            quantity <= 0
                                ? "disabled"
                                : ""
                        }
                    >

                        ${svgIcon(
                            quantity > 0
                                ? "cart"
                                : "inventory",
                            "ui-icon ui-icon-sm"
                        )}

                        <span>
                            ${
                                quantity > 0
                                    ? "Add to Cart"
                                    : "Out of Stock"
                            }
                        </span>

                    </button>

                </div>

            `;

        const mainImage =
            document.getElementById(
                "main-modal-img"
            );

        if (
            mainImage
        ) {

            mainImage.addEventListener(
                "error",
                () => {

                    if (
                        !mainImage.dataset.placeholderUsed
                    ) {

                        mainImage.dataset.placeholderUsed =
                            "true";

                        mainImage.src =
                            PLACEHOLDER_IMAGE;

                    }

                }
            );

        }

        elements.modalBody
            .querySelectorAll(
                ".modal-gallery-thumb"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const image =
                                button.dataset.galleryImage;

                            if (
                                mainImage &&
                                image
                            ) {

                                mainImage.src =
                                    image;

                                mainImage.dataset.placeholderUsed =
                                    "";

                            }

                            elements.modalBody
                                .querySelectorAll(
                                    ".modal-gallery-thumb"
                                )
                                .forEach(
                                    thumb =>
                                        thumb.classList.remove(
                                            "is-active"
                                        )
                                );

                            button.classList.add(
                                "is-active"
                            );

                        }
                    );

                }
            );

        const modalCartButton =
            document.getElementById(
                "modal-add-cart-btn"
            );

        if (
            modalCartButton &&
            quantity > 0
        ) {

            modalCartButton.addEventListener(
                "click",
                () => {

                    const added =
                        invokeAddToCart(
                            product
                        );

                    if (
                        !added
                    ) {

                        return;

                    }

                    modalCartButton.disabled =
                        true;

                    modalCartButton.classList.add(
                        "added"
                    );

                    modalCartButton.innerHTML =
                        `
                            ${svgIcon(
                                "check",
                                "ui-icon ui-icon-sm"
                            )}

                            <span>
                                Added to Cart
                            </span>
                        `;

                    announce(
                        `${product.name} added to cart.`
                    );

                }
            );

        }

        elements.productModal.classList.add(
            "is-open"
        );

        elements.productModal.setAttribute(
            "aria-hidden",
            "false"
        );

        /*
         * Accessibility:
         * indicate dialog role if the HTML doesn't already define it.
         */
        elements.productModal.setAttribute(
            "role",
            "dialog"
        );

        elements.productModal.setAttribute(
            "aria-modal",
            "true"
        );

        document.body.classList.add(
            "modal-open"
        );

        window.setTimeout(
            () => {

                elements.modalClose?.focus();

            },
            50
        );

    }


    function closeProductModal() {

        if (
            !elements.productModal
        ) {

            return;

        }

        elements.productModal.classList.remove(
            "is-open"
        );

        elements.productModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "modal-open"
        );

        if (
            elements.modalBody
        ) {

            elements.modalBody.innerHTML =
                "";

        }

    }


    /* =========================================================================
       21. UI STATES
       ========================================================================= */

    function renderLoadingState() {

        if (
            !elements.productList
        ) {

            return;

        }

        elements.productList.innerHTML =
            `
                <div
                    class="product-status-card"
                    role="status"
                    aria-live="polite"
                >

                    <div
                        class="spinner"
                        aria-hidden="true"
                    ></div>

                    <h3>
                        Loading Products
                    </h3>

                    <p
                        id="catalog-loading-message"
                    >
                        Loading the latest catalog...
                    </p>

                </div>
            `;

        updateResultsCountLoading();

    }


    function updateResultsCountLoading() {

        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "Loading...";

        }

    }


    function updateCatalogLoadingProgress(
        page
    ) {

        const loadingMessage =
            document.getElementById(
                "catalog-loading-message"
            );

        if (
            !loadingMessage
        ) {

            return;

        }

        loadingMessage.textContent =
            `Loading catalog page ${page}...`;

    }


    function renderEmptyState(
        message
    ) {

        if (
            !elements.productList
        ) {

            return;

        }

        elements.productList.innerHTML =
            `
                <div
                    class="product-status-card"
                    role="status"
                >

                    ${svgIcon(
                        "inventory",
                        "ui-icon ui-icon-xl"
                    )}

                    <h3>
                        No Products Found
                    </h3>

                    <p>
                        ${escapeHTML(
                            message
                        )}
                    </p>

                </div>
            `;

        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "0 products found";

        }

        setLoadingState(
            false
        );

    }


    function renderErrorState(
        message
    ) {

        if (
            !elements.productList
        ) {

            return;

        }

        elements.productList.innerHTML =
            `
                <div
                    class="product-status-card"
                    role="alert"
                >

                    ${svgIcon(
                        "error",
                        "ui-icon ui-icon-xl"
                    )}

                    <h3>
                        Unable to Load Products
                    </h3>

                    <p>
                        ${escapeHTML(
                            message
                        )}
                    </p>

                    <button
                        type="button"
                        class="btn-primary"
                        data-action="retry"
                    >

                        ${svgIcon(
                            "refresh",
                            "ui-icon ui-icon-sm"
                        )}

                        <span>
                            Try Again
                        </span>

                    </button>

                </div>
            `;

        elements.productList
            .querySelector(
                '[data-action="retry"]'
            )
            ?.addEventListener(
                "click",
                () => {
                    loadCatalog();
                },
                {
                    once:
                        true
                }
            );

        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "Unable to load products";

        }

        setLoadingState(
            false
        );

    }


    function updateResultsCount() {

        if (
            !elements.resultsCount
        ) {

            return;

        }

        const count =
            state.filteredProducts.length;

        /*
         * If the client has hit MAX_VISIBLE_PRODUCTS, make that clear.
         */
        const suffix =
            state.filteredProducts.length >=
                CONFIG.MAX_VISIBLE_PRODUCTS
                ? "+"
                : "";

        elements.resultsCount.textContent =
            `${count}${suffix} ${
                count === 1
                    ? "product"
                    : "products"
            } available`;

    }


    function updatePageHeading() {

        if (
            !elements.pageHeading
        ) {

            return;

        }

        if (
            state.activeCategory
        ) {

            elements.pageHeading.textContent =
                getActiveCategory().label;

            return;

        }

        if (
            state.searchQuery
        ) {

            elements.pageHeading.textContent =
                `Search: ${state.searchQuery}`;

            return;

        }

        elements.pageHeading.textContent =
            "All Products";

    }


    function setLoadingState(
        loading
    ) {

        elements.productList?.setAttribute(
            "aria-busy",
            loading
                ? "true"
                : "false"
        );

    }


    /* =========================================================================
       22. HELPERS
       ========================================================================= */

    function stripHtml(
        value
    ) {

        if (
            !value
        ) {

            return "";

        }

        const div =
            document.createElement(
                "div"
            );

        div.innerHTML =
            String(
                value
            );

        return (
            div.textContent ||
            div.innerText ||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function formatPrice(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return "$0.00";

        }

        try {

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
            )
                .format(
                    number
                );

        } catch {

            return `$${number.toFixed(2)}`;

        }

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ??
            ""
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


    function firstDefined(
        ...values
    ) {

        for (
            const value
            of values
        ) {

            if (
                value !==
                    undefined &&
                value !==
                    null &&
                value !==
                    ""
            ) {

                return value;

            }

        }

        return undefined;

    }


    function announce(
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
                        message ||
                        ""
                    );

            },
            20
        );

    }


    /* =========================================================================
       23. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload:
            () =>
                loadCatalog(),

        search:
            query => {

                state.searchQuery =
                    normalizeSearchQuery(
                        query
                    );

                if (
                    elements.searchInput
                ) {

                    elements.searchInput.value =
                        state.searchQuery;

                }

                updateClearSearchButton();

                applyFiltersAndRender();

            },

        filterCategory:
            query => {

                state.activeCategory =
                    String(
                        query ||
                        ""
                    );

                highlightCategory();

                applyFiltersAndRender();

            },

        sort:
            value => {

                state.sortBy =
                    value ||
                    CONFIG.DEFAULT_SORT;

                if (
                    elements.sortSelect
                ) {

                    elements.sortSelect.value =
                        state.sortBy;

                }

                applyFiltersAndRender();

            },

        openDetails:
            id =>
                openProductModal(
                    id
                ),

        closeDetails:
            () =>
                closeProductModal(),

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
                        String(
                            id
                        )
                ) ||
                null,

        getState:
            () => ({
                loading:
                    state.loading,

                productCount:
                    state.products.length,

                filteredCount:
                    state.filteredProducts.length,

                totalServerProducts:
                    state.totalServerProducts,

                loadedPages:
                    state.loadedPages,

                hasMoreServerProducts:
                    state.hasMoreServerProducts,

                activeCategory:
                    state.activeCategory,

                searchQuery:
                    state.searchQuery,

                sortBy:
                    state.sortBy
            })

    };


})();
