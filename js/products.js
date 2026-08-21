/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * js/products.js
 *
 * VERSION: Curated Catalog Compatible
 *
 * ARCHITECTURE
 * ============================================================================
 *
 * Cloudflare Worker
 *        |
 *        v
 * /api/products
 *        |
 *        v
 * catalog_snapshot_v6
 *        |
 *        v
 * products.js
 *        |
 *        +--> local search
 *        +--> local category filtering
 *        +--> local sorting
 *        +--> product details
 *        +--> cart integration
 *
 *
 * IMPORTANT
 * ============================================================================
 *
 * 1. products.js does NOT call CJ directly.
 * 2. products.js does NOT call /api/categories for storefront filtering.
 * 3. The Worker provides the curated catalog.
 * 4. Worker products may contain:
 *
 *      storeCategories: [
 *          "solar-lights",
 *          "smart-home"
 *      ]
 *
 * 5. Category filtering is local and therefore does not consume KV.
 * 6. Search is local.
 * 7. Sorting is local.
 * 8. No artificial 5,000-product limit.
 * 9. The code works even when storeCategories is missing by using robust
 *    fallback text/category matching.
 *
 * SUPPORTED CATEGORIES
 * ============================================================================
 *
 * All Products
 * Solar Lights
 * Battery
 * Chargers
 * Power Bank
 * Cables
 * Earphones
 * Headphones
 * Modem
 * Routers
 * Laptops
 * Power Tools
 * Camera
 * Smart Home
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

        REQUEST_TIMEOUT:
            45000,

        /*
         * The Worker controls catalog size.
         * Do not truncate it here.
         */
        MAX_PRODUCTS:
            Number.POSITIVE_INFINITY,

        /*
         * Progressive rendering keeps the browser responsive.
         */
        RENDER_BATCH_SIZE:
            50,

        DEFAULT_CATEGORY:
            "General",

        DEFAULT_SORT:
            "featured",

        MAX_SEARCH_TERMS:
            12

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
       3. STORE CATEGORY DEFINITIONS
       ========================================================================= */

    const CATEGORY_MAP = [

        {
            label:
                "All Products",

            query:
                "",

            icon:
                "apps",

            terms:
                []
        },

        {
            label:
                "Solar Lights",

            query:
                "solar-lights",

            icon:
                "solar",

            terms:
                [
                    "solar",
                    "solar light",
                    "solar lights",
                    "solar lamp",
                    "solar lighting",
                    "solar led",
                    "solar led light",
                    "solar outdoor",
                    "solar garden",
                    "solar street",
                    "solar wall",
                    "solar flood",
                    "solar floodlight",
                    "solar spotlight",
                    "solar pathway",
                    "solar lawn",
                    "solar motion",
                    "solar powered",
                    "solar powered light"
                ]
        },

        {
            label:
                "Battery",

            query:
                "battery",

            icon:
                "battery",

            terms:
                [
                    "battery",
                    "batteries",
                    "rechargeable battery",
                    "lithium battery",
                    "lithium ion",
                    "li ion",
                    "li-ion",
                    "battery pack",
                    "battery bank",
                    "power battery",
                    "aa battery",
                    "aaa battery",
                    "18650",
                    "21700",
                    "lifepo4",
                    "rechargeable cell"
                ]
        },

        {
            label:
                "Chargers",

            query:
                "chargers",

            icon:
                "charger",

            terms:
                [
                    "charger",
                    "chargers",
                    "charging",
                    "charging adapter",
                    "charging station",
                    "fast charger",
                    "fast charging",
                    "quick charger",
                    "quick charge",
                    "wall charger",
                    "usb charger",
                    "type c charger",
                    "type-c charger",
                    "phone charger",
                    "mobile charger",
                    "wireless charger",
                    "car charger",
                    "travel charger",
                    "power adapter",
                    "ac adapter"
                ]
        },

        {
            label:
                "Power Bank",

            query:
                "power-bank",

            icon:
                "powerbank",

            terms:
                [
                    "power bank",
                    "powerbank",
                    "portable power bank",
                    "portable charger",
                    "portable battery",
                    "mobile power",
                    "emergency power bank",
                    "power bank charger",
                    "portable power station"
                ]
        },

        {
            label:
                "Cables",

            query:
                "cables",

            icon:
                "cable",

            terms:
                [
                    "cable",
                    "cables",
                    "usb cable",
                    "charging cable",
                    "data cable",
                    "type c cable",
                    "type-c cable",
                    "usb-c cable",
                    "usbc cable",
                    "lightning cable",
                    "micro usb cable",
                    "micro-usb cable",
                    "hdmi cable",
                    "ethernet cable",
                    "network cable",
                    "lan cable",
                    "audio cable",
                    "aux cable",
                    "display cable",
                    "displayport cable",
                    "power cable"
                ]
        },

        {
            label:
                "Earphones",

            query:
                "earphones",

            icon:
                "earphone",

            terms:
                [
                    "earphone",
                    "earphones",
                    "earbud",
                    "earbuds",
                    "tws",
                    "true wireless",
                    "wireless earbud",
                    "wireless earbuds",
                    "bluetooth earphone",
                    "bluetooth earbuds",
                    "in-ear",
                    "in ear",
                    "sports earphones"
                ]
        },

        {
            label:
                "Headphones",

            query:
                "headphones",

            icon:
                "headphone",

            terms:
                [
                    "headphone",
                    "headphones",
                    "headset",
                    "gaming headset",
                    "gaming headphones",
                    "bluetooth headset",
                    "wireless headset",
                    "wireless headphones",
                    "over-ear",
                    "over ear",
                    "on-ear",
                    "on ear",
                    "stereo headset"
                ]
        },

        {
            label:
                "Modem",

            query:
                "modem",

            icon:
                "modem",

            terms:
                [
                    "modem",
                    "4g modem",
                    "5g modem",
                    "lte modem",
                    "usb modem",
                    "mobile modem",
                    "wireless modem",
                    "cellular modem",
                    "mobile broadband"
                ]
        },

        {
            label:
                "Routers",

            query:
                "routers",

            icon:
                "router",

            terms:
                [
                    "router",
                    "routers",
                    "wifi router",
                    "wi-fi router",
                    "wireless router",
                    "4g router",
                    "5g router",
                    "lte router",
                    "mesh router",
                    "wifi mesh",
                    "network gateway"
                ]
        },

        {
            label:
                "Laptops",

            query:
                "laptops",

            icon:
                "laptop",

            terms:
                [
                    "laptop",
                    "laptops",
                    "notebook",
                    "notebooks",
                    "ultrabook",
                    "chromebook",
                    "gaming laptop",
                    "gaming notebook",
                    "portable computer",
                    "netbook",
                    "macbook"
                ]
        },

        {
            label:
                "Power Tools",

            query:
                "power-tools",

            icon:
                "tool",

            terms:
                [
                    "power tool",
                    "power tools",
                    "drill",
                    "cordless drill",
                    "electric drill",
                    "impact driver",
                    "impact wrench",
                    "grinder",
                    "angle grinder",
                    "screwdriver",
                    "electric screwdriver",
                    "cordless screwdriver",
                    "saw",
                    "circular saw",
                    "jigsaw",
                    "reciprocating saw",
                    "sander",
                    "rotary tool",
                    "heat gun",
                    "polisher",
                    "cutting tool",
                    "hammer drill"
                ]
        },

        {
            label:
                "Camera",

            query:
                "camera",

            icon:
                "camera",

            terms:
                [
                    "camera",
                    "cameras",
                    "digital camera",
                    "security camera",
                    "cctv",
                    "ip camera",
                    "wireless camera",
                    "wifi camera",
                    "wi-fi camera",
                    "action camera",
                    "webcam",
                    "web camera",
                    "dash camera",
                    "dash cam",
                    "surveillance camera",
                    "outdoor camera",
                    "indoor camera",
                    "baby camera",
                    "doorbell camera"
                ]
        },

        {
            label:
                "Smart Home",

            query:
                "smart-home",

            icon:
                "home",

            terms:
                [
                    "smart home",
                    "smart device",
                    "smart devices",
                    "smart switch",
                    "smart plug",
                    "smart socket",
                    "smart sensor",
                    "smart lock",
                    "smart bulb",
                    "smart light",
                    "smart lighting",
                    "smart thermostat",
                    "smart security",
                    "smart doorbell",
                    "smart camera",
                    "wifi smart",
                    "wi-fi smart",
                    "home automation",
                    "smart relay",
                    "smart controller"
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

        renderToken:
            0,

        catalogLoadedAt:
            0

    };


    /* =========================================================================
       5. DOM
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


        window.setTimeout(
            loadCatalog,
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
            elements.sortSelect &&
            elements.sortSelect.value
        ) {

            state.sortBy =
                elements.sortSelect.value;

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
                    <path d="M20 15h-3v5h2a1 1 0 0 1 1-1z"></path>
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
                                    category.icon,
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
            cleanString(
                button.dataset.query
            );


        state.searchQuery =
            "";


        if (
            elements.searchInput
        ) {

            elements.searchInput.value =
                "";

        }


        updateClearSearchButton();

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
                        cleanString(
                            button.dataset.query
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
                category =>
                    category.query ===
                    state.activeCategory
            ) ||
            CATEGORY_MAP[0]
        );

    }


    /* =========================================================================
       11. LOAD CATALOG
       ========================================================================= */

    async function loadCatalog() {

        if (
            state.loading
        ) {

            return;

        }


        if (
            !elements.productList
        ) {

            return;

        }


        state.loading =
            true;


        renderLoadingState();


        const controller =
            new AbortController();


        const timeout =
            window.setTimeout(
                () => {

                    controller.abort();

                },
                CONFIG.REQUEST_TIMEOUT
            );


        try {

            const endpoint =
                `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;


            console.info(
                "[PRASUN SHOP] Loading curated catalog:",
                endpoint
            );


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
                            "no-store",

                        signal:
                            controller.signal

                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `Product service returned HTTP ${response.status}.`
                );

            }


            const data =
                await response.json();


            if (
                data?.success ===
                false
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "Product service returned an error."
                );

            }


            const rawProducts =
                extractProducts(
                    data
                );


            console.info(
                "[PRASUN SHOP] Worker returned:",
                rawProducts.length,
                "products"
            );


            const normalized =
                deduplicateProducts(
                    rawProducts
                )
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    );


            state.products =
                normalized;


            state.catalogLoadedAt =
                Date.now();


            console.info(
                "[PRASUN SHOP] Usable catalog:",
                state.products.length,
                "products"
            );


            if (
                !state.products.length
            ) {

                const message =
                    data?.message ||
                    "The curated catalog is empty. Run /api/sync-cj?all=1 and then /api/build-snapshot in the Worker.";


                renderErrorState(
                    message
                );


                return;

            }


            applyFiltersAndRender();


        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Catalog load failed:",
                error
            );


            if (
                error?.name ===
                "AbortError"
            ) {

                renderErrorState(
                    "The catalog request timed out. Please try again."
                );

            } else {

                renderErrorState(
                    error?.message ||
                    "Unable to load products."
                );

            }

        } finally {

            window.clearTimeout(
                timeout
            );


            state.loading =
                false;

        }

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


        if (
            Array.isArray(
                data?.items
            )
        ) {

            return data.items;

        }


        if (
            Array.isArray(
                data?.results
            )
        ) {

            return data.results;

        }


        return [];

    }


    /* =========================================================================
       12. DEDUPLICATION
       ========================================================================= */

    function deduplicateProducts(
        products
    ) {

        const map =
            new Map();


        for (
            const product
            of products
        ) {

            if (
                !product ||
                typeof product !==
                    "object"
            ) {

                continue;

            }


            const key =
                cleanString(
                    product?.pid ||
                    product?.id ||
                    product?.productId ||
                    product?.cj_id ||
                    product?.sku
                )
                    .toLowerCase();


            if (
                !key
            ) {

                continue;

            }


            const existing =
                map.get(
                    key
                );


            if (
                !existing
            ) {

                map.set(
                    key,
                    product
                );

            } else {

                map.set(
                    key,
                    mergeProductRecords(
                        existing,
                        product
                    )
                );

            }

        }


        return [
            ...map.values()
        ];

    }


    function mergeProductRecords(
        first,
        second
    ) {

        const result =
            {
                ...first,
                ...second
            };


        const preferredTextFields = [

            "title",
            "name",
            "description",
            "category",
            "oneCategoryName",
            "twoCategoryName",
            "threeCategoryName",
            "categoryPath",
            "sku",
            "image",
            "originalImage"

        ];


        for (
            const field
            of preferredTextFields
        ) {

            if (
                !cleanString(
                    result?.[field]
                )
            ) {

                result[field] =
                    first?.[field] ||
                    second?.[field] ||
                    "";

            }

        }


        const preferredArrays = [

            "images",
            "originalImages",
            "variants",
            "storeCategories"

        ];


        for (
            const field
            of preferredArrays
        ) {

            const firstArray =
                Array.isArray(
                    first?.[field]
                )
                    ? first[field]
                    : [];


            const secondArray =
                Array.isArray(
                    second?.[field]
                )
                    ? second[field]
                    : [];


            if (
                firstArray.length ||
                secondArray.length
            ) {

                result[field] =
                    [
                        ...new Set(
                            [
                                ...firstArray,
                                ...secondArray
                            ]
                        )
                    ];

            }

        }


        return result;

    }


    /* =========================================================================
       13. SEARCH
       ========================================================================= */

    function handleSearch(
        event
    ) {

        state.searchQuery =
            normalizeSearchText(
                event.target?.value ||
                ""
            );


        if (
            state.searchQuery
        ) {

            /*
             * Search always works across All Products.
             */
            state.activeCategory =
                "";

            highlightCategory();

        }


        updateClearSearchButton();

        applyFiltersAndRender();

    }


    function clearSearch() {

        state.searchQuery =
            "";


        if (
            elements.searchInput
        ) {

            elements.searchInput.value =
                "";

        }


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
            !state.searchQuery;

    }


    /* =========================================================================
       14. FILTERING
       ========================================================================= */

    function applyFiltersAndRender() {

        let products =
            [
                ...state.products
            ];


        /* ---------------------------------------------------------------------
           SEARCH
           --------------------------------------------------------------------- */

        if (
            state.searchQuery
        ) {

            const terms =
                normalizeSearchText(
                    state.searchQuery
                )
                    .split(
                        /\s+/
                    )
                    .filter(
                        Boolean
                    )
                    .slice(
                        0,
                        CONFIG.MAX_SEARCH_TERMS
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


        /* ---------------------------------------------------------------------
           CATEGORY
           --------------------------------------------------------------------- */

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


        /* ---------------------------------------------------------------------
           SORT
           --------------------------------------------------------------------- */

        products.sort(
            compareProducts
        );


        state.filteredProducts =
            products;


        updatePageHeading();

        updateResultsCount();


        if (
            !products.length
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


    /* =========================================================================
       15. SEARCH TEXT
       ========================================================================= */

    function buildSearchText(
        product
    ) {

        const values = [

            product?.title,

            product?.name,

            product?.description,

            product?.category,

            product?.categoryName,

            product?.oneCategoryName,

            product?.twoCategoryName,

            product?.threeCategoryName,

            product?.categoryPath,

            product?.sku,

            product?.pid,

            product?.id,

            product?.productId,

            product?.productType,

            product?.cj?.productType,

            product?.cj?.supplierName,

            product?.cj?.sku

        ];


        if (
            Array.isArray(
                product?.storeCategories
            )
        ) {

            values.push(
                ...product.storeCategories
            );

        }


        if (
            Array.isArray(
                product?.tags
            )
        ) {

            values.push(
                ...product.tags
            );

        }


        return normalizeSearchText(
            values
                .map(
                    stripHtml
                )
                .join(
                    " "
                )
        );

    }


    /* =========================================================================
       16. CATEGORY MATCHING
       ========================================================================= */

    function matchesCategory(
        product,
        category
    ) {

        if (
            !category ||
            !category.query
        ) {

            return true;

        }


        /*
         * BEST METHOD:
         *
         * The Worker already classified the product.
         */
        const storeCategories =
            getStoreCategories(
                product
            );


        if (
            storeCategories.includes(
                category.query
            )
        ) {

            return true;

        }


        /*
         * FALLBACK:
         *
         * Product might have been saved by an older Worker
         * without storeCategories.
         */
        const searchable =
            buildSearchText(
                product
            );


        for (
            const term
            of category.terms
        ) {

            const normalized =
                normalizeSearchText(
                    term
                );


            if (
                normalized &&
                searchable.includes(
                    normalized
                )
            ) {

                return true;

            }

        }


        /*
         * Additional category-specific fallback logic.
         */

        return categorySpecificFallback(
            product,
            category,
            searchable
        );

    }


    function getStoreCategories(
        product
    ) {

        const source =
            product?.storeCategories;


        if (
            Array.isArray(
                source
            )
        ) {

            return source
                .map(
                    value =>
                        cleanString(
                            value
                        )
                            .toLowerCase()
                )
                .filter(
                    Boolean
                );

        }


        if (
            typeof source ===
            "string"
        ) {

            return source
                .split(
                    ","
                )
                .map(
                    value =>
                        cleanString(
                            value
                        )
                            .toLowerCase()
                )
                .filter(
                    Boolean
                );

        }


        return [];

    }


    function categorySpecificFallback(
        product,
        category,
        searchable
    ) {

        const title =
            normalizeSearchText(
                [
                    product?.title,
                    product?.name
                ]
                    .join(
                        " "
                    )
            );


        switch (
            category.query
        ) {

            case "solar-lights":

                return (
                    /\bsolar\b/.test(
                        title
                    ) &&
                    /\b(light|lamp|led|lighting|flood|street|garden|wall|outdoor|spotlight|pathway|motion)\b/.test(
                        title
                    )
                );


            case "battery":

                return (
                    /\b(battery|batteries)\b/.test(
                        searchable
                    ) ||
                    /\b(18650|21700|lifepo4)\b/.test(
                        searchable
                    )
                );


            case "chargers":

                return (
                    /\b(charger|charging|adapter)\b/.test(
                        title
                    ) &&
                    !/\b(power bank|powerbank)\b/.test(
                        title
                    )
                );


            case "power-bank":

                return (
                    /\b(power bank|powerbank)\b/.test(
                        searchable
                    ) ||
                    /\bportable power bank\b/.test(
                        searchable
                    )
                );


            case "cables":

                return /\b(cable|usb[- ]?c|type[- ]?c|hdmi|ethernet|lightning cable)\b/.test(
                    searchable
                );


            case "earphones":

                return /\b(earphone|earphones|earbud|earbuds|tws|true wireless|in[- ]?ear)\b/.test(
                    searchable
                );


            case "headphones":

                return /\b(headphone|headphones|headset|over[- ]ear|on[- ]ear)\b/.test(
                    searchable
                );


            case "modem":

                return /\b(modem|4g modem|5g modem|lte modem)\b/.test(
                    searchable
                );


            case "routers":

                return /\b(router|wifi router|wi[- ]fi router|mesh router|4g router|5g router)\b/.test(
                    searchable
                );


            case "laptops":

                return /\b(laptop|notebook|ultrabook|chromebook|macbook)\b/.test(
                    searchable
                );


            case "power-tools":

                return /\b(drill|impact wrench|impact driver|grinder|screwdriver|saw|jigsaw|sander|rotary tool|heat gun|polisher)\b/.test(
                    searchable
                );


            case "camera":

                return /\b(camera|cctv|webcam|dash cam|surveillance)\b/.test(
                    searchable
                );


            case "smart-home":

                return (
                    /\bsmart\b/.test(
                        searchable
                    ) ||
                    /\bhome automation\b/.test(
                        searchable
                    )
                );


            default:

                return false;

        }

    }


    /* =========================================================================
       17. SORTING
       ========================================================================= */

    function compareProducts(
        a,
        b
    ) {

        const sort =
            normalizeSortValue(
                state.sortBy
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
            cleanString(
                a?.name ||
                a?.title
            );


        const nameB =
            cleanString(
                b?.name ||
                b?.title
            );


        if (
            sort ===
            "priceasc"
        ) {

            return priceA -
                priceB;

        }


        if (
            sort ===
            "pricedesc"
        ) {

            return priceB -
                priceA;

        }


        if (
            sort ===
            "nameaz"
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
            sort ===
            "nameza"
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
         * Featured
         *
         * 1. In stock
         * 2. Higher inventory
         * 3. Higher listed count
         * 4. Better price
         * 5. Name
         */

        const stockA =
            Number(
                a?.quantity
            ) || 0;


        const stockB =
            Number(
                b?.quantity
            ) || 0;


        if (
            (stockA > 0) !==
            (stockB > 0)
        ) {

            return stockA > 0
                ? -1
                : 1;

        }


        if (
            stockA !==
            stockB
        ) {

            return stockB -
                stockA;

        }


        const listedA =
            Number(
                a?.listedNum ||
                a?.cj?.listedNum ||
                0
            );


        const listedB =
            Number(
                b?.listedNum ||
                b?.cj?.listedNum ||
                0
            );


        if (
            listedA !==
            listedB
        ) {

            return listedB -
                listedA;

        }


        if (
            priceA !==
            priceB
        ) {

            return priceA -
                priceB;

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


    function normalizeSortValue(
        value
    ) {

        const normalized =
            cleanString(
                value
            )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );


        if (
            normalized.includes(
                "lowtohigh"
            ) ||
            normalized.includes(
                "priceasc"
            ) ||
            normalized ===
            "ascending"
        ) {

            return "priceasc";

        }


        if (
            normalized.includes(
                "hightolow"
            ) ||
            normalized.includes(
                "pricedesc"
            ) ||
            normalized ===
            "descending"
        ) {

            return "pricedesc";

        }


        if (
            normalized.includes(
                "atoz"
            ) ||
            normalized.includes(
                "nameaz"
            )
        ) {

            return "nameaz";

        }


        if (
            normalized.includes(
                "ztoa"
            ) ||
            normalized.includes(
                "nameza"
            )
        ) {

            return "nameza";

        }


        return "featured";

    }


    /* =========================================================================
       18. NORMALIZATION
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


        const id =
            cleanString(
                raw?.id ||
                raw?.pid ||
                raw?.productId ||
                raw?.cj_id ||
                raw?.sku
            );


        const pid =
            cleanString(
                raw?.pid ||
                raw?.id ||
                raw?.productId ||
                raw?.cj_id
            );


        const name =
            cleanString(
                raw?.title ||
                raw?.name ||
                raw?.productNameEn ||
                raw?.productName ||
                raw?.nameEn ||
                "CJ Product"
            );


        if (
            !id ||
            !name
        ) {

            return null;

        }


        const price =
            normalizePrice(
                raw
            );


        const quantity =
            normalizeQuantity(
                raw
            );


        const rating =
            normalizeRating(
                raw?.rating
            );


        const images =
            getGalleryImages(
                raw
            );


        const image =
            images[0] ||
            PLACEHOLDER_IMAGE;


        const originalImages =
            collectProductImageUrls(
                raw
            );


        const storeCategories =
            normalizeStoreCategories(
                raw?.storeCategories
            );


        return {

            ...raw,

            id,

            pid,

            cj_id:
                cleanString(
                    raw?.cj_id ||
                    raw?.cjId ||
                    pid
                ),

            sku:
                cleanString(
                    raw?.sku ||
                    raw?.productSku ||
                    raw?.cj?.sku
                ),

            title:
                name,

            name,

            description:
                String(
                    raw?.description ||
                    ""
                ),

            category:
                cleanString(
                    raw?.category ||
                    raw?.categoryName ||
                    raw?.threeCategoryName ||
                    raw?.twoCategoryName ||
                    raw?.oneCategoryName ||
                    raw?.cj?.categoryName ||
                    CONFIG.DEFAULT_CATEGORY
                ),

            oneCategoryName:
                cleanString(
                    raw?.oneCategoryName ||
                    raw?.cj?.oneCategoryName
                ),

            twoCategoryName:
                cleanString(
                    raw?.twoCategoryName ||
                    raw?.cj?.twoCategoryName
                ),

            threeCategoryName:
                cleanString(
                    raw?.threeCategoryName ||
                    raw?.cj?.threeCategoryName
                ),

            categoryPath:
                cleanString(
                    raw?.categoryPath
                ),

            categoryId:
                cleanString(
                    raw?.categoryId ||
                    raw?.cj?.categoryId
                ),

            price,

            quantity,

            rating,

            image,

            images,

            originalImage:
                originalImages[0] ||
                "",

            originalImages,

            variants:
                normalizeVariants(
                    raw?.variants
                ),

            listedNum:
                Number(
                    raw?.listedNum ||
                    raw?.cj?.listedNum ||
                    0
                ),

            storeCategories,

            source:
                raw?.source ||
                "CJ Dropshipping"

        };

    }


    function normalizeStoreCategories(
        categories
    ) {

        if (
            Array.isArray(
                categories
            )
        ) {

            return [
                ...new Set(
                    categories
                        .map(
                            value =>
                                cleanString(
                                    value
                                )
                                    .toLowerCase()
                        )
                        .filter(
                            Boolean
                        )
                )
            ];

        }


        if (
            typeof categories ===
            "string"
        ) {

            return [
                ...new Set(
                    categories
                        .split(
                            ","
                        )
                        .map(
                            value =>
                                cleanString(
                                    value
                                )
                                    .toLowerCase()
                        )
                        .filter(
                            Boolean
                        )
                )
            ];

        }


        return [];

    }


    function normalizePrice(
        raw
    ) {

        let value =
            raw?.price ??
            raw?.sellPrice ??
            raw?.unitPrice ??
            raw?.nowPrice ??
            raw?.discountPrice ??
            0;


        if (
            value &&
            typeof value ===
                "object"
        ) {

            value =
                value.amount ??
                value.value ??
                value.price ??
                value.raw ??
                0;

        }


        const parsed =
            parseFloat(
                String(
                    value
                )
                    .replace(
                        /[^0-9.]/g,
                        ""
                    )
            );


        return Number.isFinite(
            parsed
        )
            ? Number(
                parsed.toFixed(
                    2
                )
            )
            : 0;

    }


    function normalizeQuantity(
        raw
    ) {

        const directCandidates = [

            raw?.quantity,

            raw?.inventory,

            raw?.totalInventory,

            raw?.warehouseInventoryNum,

            raw?.totalVerifiedInventory,

            raw?.availableQuantity,

            raw?.cj?.totalInventory,

            raw?.cj?.warehouseInventoryNum

        ];


        for (
            const value
            of directCandidates
        ) {

            const number =
                Number(
                    value
                );


            if (
                Number.isFinite(
                    number
                )
            ) {

                return Math.max(
                    0,
                    Math.floor(
                        number
                    )
                );

            }

        }


        if (
            Array.isArray(
                raw?.variants
            )
        ) {

            return raw.variants.reduce(
                (
                    total,
                    variant
                ) => {

                    const number =
                        Number(
                            variant?.inventory ??
                            variant?.quantity ??
                            variant?.totalInventory ??
                            0
                        );


                    return total +
                        (
                            Number.isFinite(
                                number
                            )
                                ? Math.max(
                                    0,
                                    Math.floor(
                                        number
                                    )
                                )
                                : 0
                        );

                },
                0
            );

        }


        return 0;

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

                    const inventory =
                        Number(
                            variant?.inventory ??
                            variant?.quantity ??
                            variant?.totalInventory ??
                            0
                        );


                    const price =
                        Number(
                            variant?.price ??
                            variant?.sellPrice ??
                            0
                        );


                    const costPrice =
                        Number(
                            variant?.costPrice ??
                            0
                        );


                    return {

                        ...variant,

                        vid:
                            cleanString(
                                variant?.vid ||
                                variant?.id
                            ),

                        pid:
                            cleanString(
                                variant?.pid ||
                                variant?.productId
                            ),

                        sku:
                            cleanString(
                                variant?.sku ||
                                variant?.variantSku
                            ),

                        name:
                            cleanString(
                                variant?.name ||
                                variant?.variantNameEn ||
                                variant?.variantName ||
                                variant?.variantKey ||
                                "Default"
                            ),

                        price:
                            Number.isFinite(
                                price
                            )
                                ? Number(
                                    price.toFixed(
                                        2
                                    )
                                )
                                : 0,

                        costPrice:
                            Number.isFinite(
                                costPrice
                            )
                                ? Number(
                                    costPrice.toFixed(
                                        2
                                    )
                                )
                                : 0,

                        inventory:
                            Number.isFinite(
                                inventory
                            )
                                ? Math.max(
                                    0,
                                    Math.floor(
                                        inventory
                                    )
                                )
                                : 0

                    };

                }
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


    /* =========================================================================
       19. IMAGE HANDLING
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
        value
    ) {

        return (
            typeof value ===
                "string" &&
            value.includes(
                CONFIG.IMAGE_PROXY_ENDPOINT
            )
        );

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
                    .split(
                        ","
                    )
            );

        }


        if (
            Array.isArray(
                product?.variantImages
            )
        ) {

            candidates.push(
                ...product.variantImages
            );

        }


        if (
            Array.isArray(
                product?.variants
            )
        ) {

            for (
                const variant
                of product.variants
            ) {

                candidates.push(
                    variant?.image
                );

                candidates.push(
                    variant?.variantImage
                );

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


    function getGalleryImages(
        product
    ) {

        return [
            ...new Set(
                collectProductImageUrls(
                    product
                )
                    .map(
                        buildProxyUrl
                    )
                    .filter(
                        Boolean
                    )
            )
        ];

    }


    /* =========================================================================
       20. GRID RENDERING
       ========================================================================= */

    function renderProductGrid() {

        if (
            !elements.productList
        ) {

            return;

        }


        const token =
            ++state.renderToken;


        elements.productList.innerHTML =
            "";


        setLoadingState(
            true
        );


        const products =
            state.filteredProducts;


        let index =
            0;


        const renderBatch =
            () => {

                if (
                    token !==
                    state.renderToken
                ) {

                    return;

                }


                const fragment =
                    document.createDocumentFragment();


                const end =
                    Math.min(
                        index +
                        CONFIG.RENDER_BATCH_SIZE,
                        products.length
                    );


                for (
                    ;
                    index < end;
                    index++
                ) {

                    const card =
                        createProductCardElement(
                            products[index]
                        );


                    if (
                        card
                    ) {

                        fragment.appendChild(
                            card
                        );

                    }

                }


                elements.productList.appendChild(
                    fragment
                );


                if (
                    index <
                    products.length
                ) {

                    window.requestAnimationFrame(
                        renderBatch
                    );

                } else {

                    setLoadingState(
                        false
                    );

                    attachProductImageFallbacks();

                }

            };


        renderBatch();

    }


    function createProductCardElement(
        product
    ) {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.innerHTML =
            renderProductCard(
                product
            );


        return wrapper.firstElementChild ||
            null;

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
                getDisplayCategory(
                    product
                )
            );


        const image =
            escapeHTML(
                product.image ||
                PLACEHOLDER_IMAGE
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
            110

                ? (
                    description.slice(
                        0,
                        110
                    ) +
                    "..."
                )

                : (
                    description ||
                    "Product information available."
                );


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
                        data-original-image="${escapeHTML(
                            product.originalImage ||
                            ""
                        )}"
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
                            aria-label="View details for ${title}"
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
                        Number(
                            product.rating
                        ) > 0

                            ? `
                                <div
                                    class="product-rating"
                                    aria-label="Rating ${Number(
                                        product.rating
                                    ).toFixed(
                                        1
                                    )} out of 5"
                                >

                                    ${svgIcon(
                                        "star",
                                        "ui-icon ui-icon-sm"
                                    )}

                                    <span>
                                        ${Number(
                                            product.rating
                                        ).toFixed(
                                            1
                                        )}
                                    </span>

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
                                aria-label="${
                                    available
                                        ? `Add ${title} to cart`
                                        : `${title} is out of stock`
                                }"
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


    function getDisplayCategory(
        product
    ) {

        const categories =
            getStoreCategories(
                product
            );


        if (
            categories.length
        ) {

            const first =
                CATEGORY_MAP.find(
                    category =>
                        category.query ===
                        categories[0]
                );


            if (
                first
            ) {

                return first.label;

            }

        }


        return (
            product?.category ||
            CONFIG.DEFAULT_CATEGORY
        );

    }


    /* =========================================================================
       21. GRID EVENTS / CART
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


        const product =
            findProductById(
                cartButton.dataset.productId
            );


        if (
            !product
        ) {

            return;

        }


        if (
            Number(
                product.quantity
            ) <=
            0
        ) {

            announce(
                `${product.name} is currently out of stock.`
            );


            return;

        }


        const added =
            addProductToCart(
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


    function addProductToCart(
        product
    ) {

        if (
            typeof window.addToCart ===
            "function"
        ) {

            try {

                return Boolean(
                    window.addToCart(
                        product
                    )
                );

            } catch (
                error
            ) {

                console.error(
                    "[PRASUN SHOP] addToCart failed:",
                    error
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
                "[PRASUN SHOP] cart:add failed:",
                error
            );


            return false;

        }

    }


    function findProductById(
        id
    ) {

        const desired =
            String(
                id ??
                ""
            );


        return (
            state.products.find(
                product =>
                    String(
                        product.id
                    ) ===
                    desired
            ) ||
            state.products.find(
                product =>
                    String(
                        product.pid
                    ) ===
                    desired
            ) ||
            null
        );

    }


    /* =========================================================================
       22. IMAGE FALLBACK
       ========================================================================= */

    function attachProductImageFallbacks() {

        elements.productList
            ?.querySelectorAll(
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


        if (
            original &&
            !image.dataset.originalAttempted
        ) {

            image.dataset.originalAttempted =
                "true";


            const proxy =
                buildProxyUrl(
                    original
                );


            if (
                proxy &&
                proxy !==
                image.src
            ) {

                image.src =
                    proxy;


                return;

            }

        }


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
       23. PRODUCT MODAL
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


        const doc =
            parser.parseFromString(
                String(
                    html
                ),
                "text/html"
            );


        [

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
            "source"

        ]
            .forEach(
                tag => {

                    doc
                        .querySelectorAll(
                            tag
                        )
                        .forEach(
                            node =>
                                node.remove()
                        );

                }
            );


        doc
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


                                if (
                                    (
                                        name ===
                                        "href" ||
                                        name ===
                                        "src"
                                    ) &&
                                    /^javascript:/i.test(
                                        value
                                    )
                                ) {

                                    element.removeAttribute(
                                        attribute.name
                                    );

                                }

                            }
                        );

                }
            );


        doc
            .querySelectorAll(
                "img"
            )
            .forEach(
                image => {

                    const src =
                        image.getAttribute(
                            "src"
                        );


                    if (
                        src
                    ) {

                        const normalized =
                            normalizeImageUrl(
                                src
                            );


                        if (
                            normalized
                        ) {

                            image.setAttribute(
                                "src",
                                buildProxyUrl(
                                    normalized
                                )
                            );

                        }

                    }


                    image.setAttribute(
                        "loading",
                        "lazy"
                    );


                    image.setAttribute(
                        "decoding",
                        "async"
                    );

                }
            );


        return doc.body.innerHTML;

    }


    function openProductModal(
        productId
    ) {

        if (
            !elements.productModal ||
            !elements.modalBody
        ) {

            return;

        }


        const product =
            findProductById(
                productId
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
                getDisplayCategory(
                    product
                )
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
                                            index ===
                                            0
                                                ? "is-active"
                                                : ""
                                        }"
                                        data-gallery-image="${escapeHTML(
                                            image
                                        )}"
                                        aria-label="View product image ${
                                            index +
                                            1
                                        }"
                                    >

                                        <img
                                            src="${escapeHTML(
                                                image
                                            )}"
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                        >

                                    </button>
                                `
                            )
                            .join(
                                ""
                            )}

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

                    mainImage.src =
                        PLACEHOLDER_IMAGE;

                },
                {
                    once:
                        true
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

                            }


                            elements.modalBody
                                .querySelectorAll(
                                    ".modal-gallery-thumb"
                                )
                                .forEach(
                                    thumbnail =>
                                        thumbnail.classList.remove(
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
                        addProductToCart(
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


        document.body.classList.add(
            "modal-open"
        );


        window.setTimeout(
            () =>
                elements.modalClose?.focus(),
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
       24. UI STATES
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

                    <p>
                        Loading the curated product catalog...
                    </p>

                </div>
            `;


        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "Loading...";

        }

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


        elements.resultsCount.textContent =
            `${count} ${
                count ===
                1
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
       25. HELPERS
       ========================================================================= */

    function cleanString(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function normalizeSearchText(
        value
    ) {

        return String(
            value ||
            ""
        )
            .toLowerCase()
            .replace(
                /&/g,
                " and "
            )
            .replace(
                /[_\-\/]+/g,
                " "
            )
            .replace(
                /[^a-z0-9\s]+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    function stripHtml(
        value
    ) {

        if (
            value ===
                null ||
            value ===
                undefined
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
       26. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload:
            () =>
                loadCatalog(),

        search:
            query => {

                state.searchQuery =
                    normalizeSearchText(
                        query
                    );


                state.activeCategory =
                    "";


                if (
                    elements.searchInput
                ) {

                    elements.searchInput.value =
                        query ||
                        "";

                }


                updateClearSearchButton();

                highlightCategory();

                applyFiltersAndRender();

            },

        filterCategory:
            query => {

                state.activeCategory =
                    cleanString(
                        query
                    );


                state.searchQuery =
                    "";


                if (
                    elements.searchInput
                ) {

                    elements.searchInput.value =
                        "";

                }


                updateClearSearchButton();

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
                findProductById(
                    id
                ),

        getCategoryMap:
            () =>
                CATEGORY_MAP.map(
                    category => ({

                        label:
                            category.label,

                        query:
                            category.query

                    })
                ),

        getState:
            () => ({

                productCount:
                    state.products.length,

                filteredCount:
                    state.filteredProducts.length,

                activeCategory:
                    state.activeCategory,

                searchQuery:
                    state.searchQuery,

                sortBy:
                    state.sortBy,

                catalogLoadedAt:
                    state.catalogLoadedAt

            })

    };

})();

