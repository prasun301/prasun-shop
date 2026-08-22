/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * File:
 *     js/products.js
 *
 * Production storefront catalog manager.
 *
 * API:
 *     https://prasun-shop-api.prasun301.workers.dev
 *
 * Main architecture:
 *
 *     PRASUN SHOP FRONTEND
 *              |
 *              +-----------------------------+
 *              |                             |
 *              v                             v
 *       /api/products                  /api/products?q=...
 *              |                             |
 *              v                             v
 *       KV / general catalog              CJ search
 *              |                             |
 *              +-------------+---------------+
 *                            |
 *                            v
 *                     normalize products
 *                            |
 *                 +----------+----------+
 *                 |                     |
 *                 v                     v
 *             category               search
 *                 |                     |
 *                 +----------+----------+
 *                            |
 *                            v
 *                         render
 *
 * IMPORTANT:
 *
 * 1. The initial "All Products" catalog comes from the Worker/KV snapshot.
 *
 * 2. Product search is LIVE through the Worker:
 *
 *        /api/products?q=wireless mouse
 *
 * 3. Store categories use live Worker/CJ searches using multiple keywords.
 *
 * 4. The frontend does not assume that Worker storeCategories must exactly
 *    match the visual category IDs.
 *
 * 5. Product normalization supports both legacy CJ-style fields and
 *    generic/AliExpress-style product identifiers.
 *
 * 6. Cart integration remains compatible with:
 *
 *        window.addToCart(product)
 *
 *    and:
 *
 *        document.dispatchEvent(new CustomEvent("cart:add", ...))
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
            30000,

        /*
         * Maximum products maintained in the general storefront catalog.
         */
        MAX_PRODUCTS:
            300,

        /*
         * Maximum products displayed on one view.
         */
        MAX_VISIBLE_PRODUCTS:
            300,

        /*
         * General catalog page size.
         */
        GENERAL_PAGE_SIZE:
            100,

        /*
         * Maximum general catalog pages.
         */
        GENERAL_MAX_PAGES:
            3,

        /*
         * Target number of products for each category.
         */
        CATEGORY_TARGET:
            20,

        /*
         * Maximum number of live category queries.
         *
         * Keeping this moderate prevents excessive Worker/CJ traffic.
         */
        CATEGORY_MAX_QUERIES:
            4,

        /*
         * Products requested from Worker for each live category query.
         */
        CATEGORY_QUERY_LIMIT:
            30,

        /*
         * Search query page size.
         */
        SEARCH_LIMIT:
            40,

        /*
         * How many products can be returned by one arbitrary search.
         */
        SEARCH_MAX_PRODUCTS:
            100,

        RENDER_BATCH_SIZE:
            40,

        REQUEST_TIMEOUT_CATEGORY:
            35000,

        REQUEST_TIMEOUT_SEARCH:
            30000,

        DEFAULT_CATEGORY:
            "General",

        DEFAULT_SORT:
            "featured",

        MAX_SEARCH_TERMS:
            12,

        CACHE_MODE:
            "default",

        INITIAL_LOAD_DELAY:
            0,

        /*
         * Browser-side result cache duration.
         */
        RESULT_CACHE_MS:
            5 * 60 * 1000,

        /*
         * If fewer than this number of local search matches exist,
         * perform a live Worker search.
         */
        LOCAL_SEARCH_MIN_RESULTS:
            6

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
       3. STORE CATEGORIES
       =========================================================================
       The IDs below are kept compatible with your existing storefront.
       Live search uses the keyword arrays, not the internal Worker category ID.
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
                [],

            searchTerms:
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
                    "solar light",
                    "solar lamp",
                    "solar led",
                    "solar lighting",
                    "solar floodlight",
                    "solar flood light",
                    "solar spotlight",
                    "solar street light",
                    "solar street lamp",
                    "solar garden light",
                    "solar garden lamp",
                    "solar wall light",
                    "solar outdoor light",
                    "solar pathway light",
                    "solar lawn light",
                    "solar motion light",
                    "solar powered light",
                    "solar powered lamp"
                ],

            searchTerms:
                [
                    "solar light",
                    "solar lamp",
                    "solar led",
                    "solar floodlight"
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
                    "lithium ion battery",
                    "li-ion battery",
                    "battery pack",
                    "battery bank",
                    "power battery",
                    "18650",
                    "21700",
                    "lifepo4",
                    "lithium cell",
                    "rechargeable cell"
                ],

            searchTerms:
                [
                    "battery",
                    "rechargeable battery",
                    "lithium battery",
                    "18650 battery"
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
                    "charging station",
                    "charging adapter",
                    "fast charger",
                    "fast charging",
                    "quick charger",
                    "quick charging",
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
                    "usb power adapter",
                    "ac adapter"
                ],

            searchTerms:
                [
                    "charger",
                    "fast charger",
                    "usb charger",
                    "wireless charger"
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
                    "power bank charger",
                    "portable power bank",
                    "portable charger",
                    "portable battery",
                    "mobile power",
                    "emergency power bank",
                    "power station",
                    "portable power station"
                ],

            searchTerms:
                [
                    "power bank",
                    "powerbank",
                    "portable charger",
                    "portable power bank"
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
                    "display cable",
                    "displayport cable",
                    "dp cable",
                    "network cable",
                    "ethernet cable",
                    "lan cable",
                    "audio cable",
                    "aux cable",
                    "power cable"
                ],

            searchTerms:
                [
                    "usb cable",
                    "charging cable",
                    "type c cable",
                    "hdmi cable"
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
                ],

            searchTerms:
                [
                    "earphones",
                    "earbuds",
                    "tws earbuds",
                    "wireless earbuds"
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
                    "stereo headset",
                    "computer headset",
                    "pc headset"
                ],

            searchTerms:
                [
                    "headphones",
                    "bluetooth headphones",
                    "wireless headphones",
                    "gaming headset"
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
                    "4g usb modem",
                    "5g usb modem",
                    "mobile broadband"
                ],

            searchTerms:
                [
                    "modem",
                    "4g modem",
                    "5g modem",
                    "lte modem"
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
                    "network router",
                    "mesh router",
                    "wifi mesh",
                    "wi-fi mesh",
                    "network gateway",
                    "wireless network"
                ],

            searchTerms:
                [
                    "wifi router",
                    "wireless router",
                    "4g router",
                    "5g router"
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
                    "computer notebook",
                    "portable computer",
                    "netbook",
                    "windows laptop",
                    "macbook"
                ],

            searchTerms:
                [
                    "laptop",
                    "notebook",
                    "gaming laptop",
                    "ultrabook"
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
                    "hammer drill",
                    "power cutter",
                    "electric tool"
                ],

            searchTerms:
                [
                    "power tools",
                    "cordless drill",
                    "impact wrench",
                    "angle grinder"
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
                    "home camera",
                    "baby camera",
                    "doorbell camera",
                    "camcorder"
                ],

            searchTerms:
                [
                    "security camera",
                    "ip camera",
                    "wifi camera",
                    "webcam"
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
                    "smart automation",
                    "smart relay",
                    "smart remote",
                    "smart controller"
                ],

            searchTerms:
                [
                    "smart home",
                    "smart plug",
                    "smart switch",
                    "smart sensor"
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

        renderSequence:
            0,

        mode:
            "all",

        categoryLoading:
            false,

        searchLoading:
            false,

        liveSearchCache:
            new Map(),

        categoryCache:
            new Map(),

        productDetailCache:
            new Map()

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

        window.setTimeout(
            () => {
                loadGeneralCatalog();
            },
            CONFIG.INITIAL_LOAD_DELAY
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

        state.sortBy =
            elements.sortSelect?.value ||
            CONFIG.DEFAULT_SORT;
    }


    /* =========================================================================
       8. ICONS
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
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>
                `,

            solar:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
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
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="7" width="17" height="10" rx="2"></rect>
                    <path d="M21 10v4"></path>
                    <path d="M8 12h7"></path>
                </svg>
                `,

            charger:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 2v6"></path>
                    <path d="M15 2v6"></path>
                    <path d="M7 8h10"></path>
                    <path d="M12 8v14"></path>
                </svg>
                `,

            powerbank:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <path d="M8 12h8"></path>
                    <path d="M12 8v8"></path>
                </svg>
                `,

            cable:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3v5"></path>
                    <path d="M17 16v5"></path>
                    <path d="M7 8c0 5 10 3 10 8"></path>
                    <path d="M5 3h4"></path>
                    <path d="M15 21h4"></path>
                </svg>
                `,

            earphone:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 13a4 4 0 1 1 4-4v7"></path>
                    <path d="M17 13a4 4 0 1 0-4-4v7"></path>
                </svg>
                `,

            headphone:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 15v-3a8 8 0 0 1 16 0v3"></path>
                    <path d="M4 15h3v5H5a1 1 0 0 1-1-1z"></path>
                    <path d="M20 15h-3v5h2a1 1 0 0 1-1-1z"></path>
                </svg>
                `,

            modem:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="9" width="16" height="9" rx="2"></rect>
                    <path d="M8 13h.01"></path>
                    <path d="M12 13h.01"></path>
                    <path d="M16 13h.01"></path>
                    <path d="M9 6h6"></path>
                </svg>
                `,

            router:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
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
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="4" width="14" height="11" rx="1.5"></rect>
                    <path d="M3 19h18"></path>
                    <path d="M8 19l1-3h6l1 3"></path>
                </svg>
                `,

            tool:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 6a5 5 0 0 0-7 7l-4 4 4 4 4-4a5 5 0 0 0 7-7"></path>
                    <path d="m13 11 4 4"></path>
                </svg>
                `,

            camera:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h4l2-2h4l2 2h4v12H4z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                </svg>
                `,

            home:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 11 12 4l9 7"></path>
                    <path d="M5 10v10h14V10"></path>
                    <path d="M9 20v-5h6v5"></path>
                </svg>
                `,

            eye:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
                    <circle cx="12" cy="12" r="2.5"></circle>
                </svg>
                `,

            cart:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"></path>
                    <path d="M16 4v5"></path>
                    <path d="M13.5 6.5h5"></path>
                </svg>
                `,

            check:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 4 4L19 6"></path>
                </svg>
                `,

            inventory:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16v13H4z"></path>
                    <path d="M8 7V4h8v3"></path>
                    <path d="M8 11h8"></path>
                </svg>
                `,

            refresh:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
                `,

            error:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
                `,

            star:
                `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"></path>
                </svg>
                `

        };

        return (
            icons[name] ||
            icons.apps
        );
    }


    /* =========================================================================
       9. EVENTS
       ========================================================================= */

    function bindEvents() {

        elements.searchInput?.addEventListener(
            "input",
            debounce(
                handleSearch,
                350
            )
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

                    performLiveSearch(
                        state.searchQuery
                    );
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
                                class="category-pill${active ? " active" : ""}"
                                data-query="${escapeHTML(category.query)}"
                                aria-pressed="${active ? "true" : "false"}"
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


    async function handleCategoryClick(
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

        const query =
            String(
                button.dataset.query ||
                ""
            )
                .trim();

        state.activeCategory =
            query;

        state.searchQuery =
            "";

        state.mode =
            query
                ? "category"
                : "all";

        if (
            elements.searchInput
        ) {
            elements.searchInput.value =
                "";
        }

        updateClearSearchButton();

        highlightCategory();

        if (
            !query
        ) {

            if (
                !state.products.length
            ) {
                await loadGeneralCatalog();
            } else {
                applyFiltersAndRender();
            }

            return;
        }

        await loadCategoryProducts(
            getActiveCategory()
        );
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
                category =>
                    category.query ===
                    state.activeCategory
            ) ||
            CATEGORY_MAP[0]
        );
    }


    /* =========================================================================
       11. GENERAL CATALOG
       ========================================================================= */

    async function loadGeneralCatalog() {

        cancelCurrentLoad();

        const loadId =
            ++state.loadSequence;

        const controller =
            new AbortController();

        state.loadController =
            controller;

        state.loading =
            true;

        state.mode =
            "all";

        renderLoadingState();

        try {

            const products =
                await fetchGeneralCatalog(
                    controller.signal
                );

            if (
                loadId !==
                state.loadSequence
            ) {
                return;
            }

            state.products =
                deduplicateProducts(
                    products
                )
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    )
                    .slice(
                        0,
                        CONFIG.MAX_PRODUCTS
                    );

            /*
             * Preserve a copy for later local searching.
             */
            state.filteredProducts =
                [
                    ...state.products
                ];

            if (
                !state.products.length
            ) {

                throw new Error(
                    "The Worker returned no usable products."
                );
            }

            applyFiltersAndRender();

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
                "[PRASUN SHOP] General catalog loading failed:",
                error
            );

            renderErrorState(
                error?.message ||
                "Unable to load products."
            );

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


    async function fetchGeneralCatalog(
        signal
    ) {

        const allProducts =
            [];

        const seenPages =
            new Set();

        for (
            let page = 1;
            page <= CONFIG.GENERAL_MAX_PAGES;
            page++
        ) {

            const url =
                buildProductsUrl(
                    {
                        page,
                        limit:
                            CONFIG.GENERAL_PAGE_SIZE
                    }
                );

            const data =
                await fetchJSON(
                    url,
                    {
                        signal,
                        timeout:
                            CONFIG.REQUEST_TIMEOUT
                    }
                );

            if (
                data?.success ===
                false
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "Product API returned an error."
                );
            }

            const pageProducts =
                extractProducts(
                    data
                );

            if (
                !pageProducts.length
            ) {
                break;
            }

            allProducts.push(
                ...pageProducts
            );

            const reportedTotal =
                Number(
                    data?.totalProducts ||
                    data?.totalMatches ||
                    data?.totalRecords ||
                    data?.total ||
                    0
                );

            const reportedPages =
                Number(
                    data?.totalPages ||
                    0
                );

            seenPages.add(
                page
            );

            /*
             * Stop when the response says there are no more pages.
             */
            if (
                data?.hasMore ===
                false
            ) {
                break;
            }

            if (
                reportedPages > 0 &&
                page >= reportedPages
            ) {
                break;
            }

            if (
                reportedTotal > 0 &&
                allProducts.length >=
                Math.min(
                    reportedTotal,
                    CONFIG.MAX_PRODUCTS
                )
            ) {
                break;
            }

            /*
             * If Worker returns fewer than requested items, there is
             * probably no additional page.
             */
            if (
                pageProducts.length <
                CONFIG.GENERAL_PAGE_SIZE
            ) {
                break;
            }
        }

        return allProducts;
    }


    /* =========================================================================
       12. LIVE CATEGORY LOADING
       ========================================================================= */

    async function loadCategoryProducts(
        category
    ) {

        if (
            !category?.query
        ) {

            applyFiltersAndRender();

            return;
        }

        cancelCurrentLoad();

        const loadId =
            ++state.loadSequence;

        const controller =
            new AbortController();

        state.loadController =
            controller;

        state.categoryLoading =
            true;

        state.loading =
            true;

        renderLoadingState();

        updatePageHeading(
            category.label
        );

        try {

            const cacheKey =
                category.query;

            const cached =
                getValidCachedResult(
                    state.categoryCache,
                    cacheKey
                );

            let products;

            if (
                cached
            ) {

                products =
                    cached;

            } else {

                products =
                    await fetchCategoryProducts(
                        category,
                        controller.signal
                    );

                setResultCache(
                    state.categoryCache,
                    cacheKey,
                    products
                );
            }

            if (
                loadId !==
                state.loadSequence
            ) {
                return;
            }

            const normalized =
                deduplicateProducts(
                    products
                )
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    );

            /*
             * Keep the category results as the active product pool.
             * This is important for Add-to-Cart / modal lookup.
             */
            state.products =
                normalized
                    .slice(
                        0,
                        CONFIG.MAX_PRODUCTS
                    );

            state.filteredProducts =
                categoryProductsSort(
                    state.products,
                    category
                )
                    .slice(
                        0,
                        CONFIG.MAX_VISIBLE_PRODUCTS
                    );

            updatePageHeading(
                category.label
            );

            updateResultsCount();

            if (
                !state.filteredProducts.length
            ) {

                renderEmptyState(
                    `No suitable products were found in "${category.label}".`
                );

                return;
            }

            renderProductGrid();

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
                "[PRASUN SHOP] Category loading failed:",
                error
            );

            renderErrorState(
                error?.message ||
                `Unable to load ${category.label}.`
            );

        } finally {

            if (
                loadId ===
                state.loadSequence
            ) {

                state.categoryLoading =
                    false;

                state.loading =
                    false;

                state.loadController =
                    null;
            }
        }
    }


    async function fetchCategoryProducts(
        category,
        signal
    ) {

        const terms =
            uniqueStrings(
                [
                    ...(category.searchTerms || []),
                    ...(category.terms || [])
                ]
            )
                .slice(
                    0,
                    CONFIG.CATEGORY_MAX_QUERIES
                );

        const collected =
            [];

        /*
         * Sequential requests are intentional.
         * They reduce pressure on the Worker/CJ request path.
         */
        for (
            const term
            of terms
        ) {

            const url =
                buildProductsUrl(
                    {
                        q:
                            term,

                        page:
                            1,

                        limit:
                            CONFIG.CATEGORY_QUERY_LIMIT
                    }
                );

            const data =
                await fetchJSON(
                    url,
                    {
                        signal,
                        timeout:
                            CONFIG.REQUEST_TIMEOUT_CATEGORY
                    }
                );

            if (
                data?.success ===
                false
            ) {

                console.warn(
                    "[PRASUN SHOP] Category query failed:",
                    term,
                    data?.error
                );

                continue;
            }

            const products =
                extractProducts(
                    data
                );

            if (
                products.length
            ) {

                collected.push(
                    ...products
                );
            }

            /*
             * Stop as soon as we have enough usable products.
             */
            const normalizedCount =
                deduplicateProducts(
                    collected
                ).length;

            if (
                normalizedCount >=
                CONFIG.CATEGORY_TARGET
            ) {
                break;
            }
        }

        /*
         * Normalize and strongly rank category relevance.
         *
         * We do not throw away every returned product simply because one
         * metadata field is missing. CJ search itself already narrows the
         * result set.
         */
        const normalized =
            deduplicateProducts(
                collected
            )
                .map(
                    normalizeProduct
                )
                .filter(
                    Boolean
                );

        const relevant =
            normalized
                .map(
                    product => ({
                        product,
                        score:
                            getCategoryMatchScore(
                                product,
                                category
                            )
                    })
                )
                .filter(
                    item =>
                        item.score > 0
                )
                .sort(
                    (
                        a,
                        b
                    ) => {

                        if (
                            b.score !==
                            a.score
                        ) {
                            return (
                                b.score -
                                a.score
                            );
                        }

                        return compareProducts(
                            a.product,
                            b.product
                        );
                    }
                )
                .map(
                    item =>
                        item.product
                );

        /*
         * In case the category metadata is weak, retain CJ returned products
         * rather than showing an empty category.
         */
        if (
            relevant.length >=
            Math.min(
                CONFIG.CATEGORY_TARGET,
                normalized.length
            )
        ) {
            return relevant;
        }

        return (
            relevant.length
                ? relevant
                : normalized
        );
    }


    /* =========================================================================
       13. LIVE SEARCH
       ========================================================================= */

    async function performLiveSearch(
        query
    ) {

        const normalizedQuery =
            normalizeSearchText(
                query
            );

        if (
            !normalizedQuery
        ) {

            state.searchQuery =
                "";

            state.activeCategory =
                "";

            state.mode =
                "all";

            highlightCategory();

            updateClearSearchButton();

            applyFiltersAndRender();

            return;
        }

        state.searchQuery =
            normalizedQuery;

        state.activeCategory =
            "";

        state.mode =
            "search";

        highlightCategory();

        updateClearSearchButton();

        const cacheKey =
            normalizedQuery;

        const cached =
            getValidCachedResult(
                state.liveSearchCache,
                cacheKey
            );

        if (
            cached
        ) {

            state.products =
                cached
                    .slice(
                        0,
                        CONFIG.SEARCH_MAX_PRODUCTS
                    );

            updatePageHeading(
                `Search: ${normalizedQuery}`
            );

            applySearchResultsAndRender();

            return;
        }

        cancelCurrentLoad();

        const loadId =
            ++state.loadSequence;

        const controller =
            new AbortController();

        state.loadController =
            controller;

        state.searchLoading =
            true;

        state.loading =
            true;

        renderLoadingState();

        updatePageHeading(
            `Search: ${normalizedQuery}`
        );

        try {

            const url =
                buildProductsUrl(
                    {
                        q:
                            normalizedQuery,

                        page:
                            1,

                        limit:
                            CONFIG.SEARCH_LIMIT
                    }
                );

            const data =
                await fetchJSON(
                    url,
                    {
                        signal:
                            controller.signal,

                        timeout:
                            CONFIG.REQUEST_TIMEOUT_SEARCH
                    }
                );

            if (
                data?.success ===
                false
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "Search service returned an error."
                );
            }

            const raw =
                extractProducts(
                    data
                );

            const normalized =
                deduplicateProducts(
                    raw
                )
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    );

            /*
             * The Worker is already performing the actual CJ search.
             *
             * Therefore we do NOT apply a strict local text filter here.
             * Doing so could incorrectly eliminate valid CJ results whose
             * metadata does not contain every search term.
             */
            const ranked =
                normalized
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            getSearchScore(
                                b,
                                normalizedQuery
                            ) -
                            getSearchScore(
                                a,
                                normalizedQuery
                            )
                    )
                    .slice(
                        0,
                        CONFIG.SEARCH_MAX_PRODUCTS
                    );

            if (
                loadId !==
                state.loadSequence
            ) {
                return;
            }

            state.products =
                ranked;

            setResultCache(
                state.liveSearchCache,
                cacheKey,
                ranked
            );

            updatePageHeading(
                `Search: ${normalizedQuery}`
            );

            applySearchResultsAndRender();

            if (
                !ranked.length
            ) {

                renderEmptyState(
                    `No products found for "${normalizedQuery}".`
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
                "[PRASUN SHOP] Live search failed:",
                error
            );

            renderErrorState(
                error?.message ||
                "Unable to search products."
            );

        } finally {

            if (
                loadId ===
                state.loadSequence
            ) {

                state.searchLoading =
                    false;

                state.loading =
                    false;

                state.loadController =
                    null;
            }
        }
    }


    function applySearchResultsAndRender() {

        const results =
            state.products
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) =>
                        getSearchScore(
                            b,
                            state.searchQuery
                        ) -
                        getSearchScore(
                            a,
                            state.searchQuery
                        )
                );

        state.filteredProducts =
            results.slice(
                0,
                CONFIG.MAX_VISIBLE_PRODUCTS
            );

        updatePageHeading(
            `Search: ${state.searchQuery}`
        );

        updateResultsCount();

        if (
            !state.filteredProducts.length
        ) {

            renderEmptyState(
                `No products found for "${state.searchQuery}".`
            );

            return;
        }

        renderProductGrid();
    }


    /* =========================================================================
       14. RESPONSE EXTRACTION
       ========================================================================= */

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

        const directPaths = [

            data?.products,

            data?.items,

            data?.list,

            data?.results,

            data?.data?.products,

            data?.data?.items,

            data?.data?.list,

            data?.data?.results,

            data?.data?.data?.products,

            data?.data?.data?.items,

            data?.data?.data?.list,

            data?.data?.data?.results,

            data?.result?.products,

            data?.result?.items,

            data?.result?.list,

            data?.result?.results

        ];

        for (
            const candidate
            of directPaths
        ) {

            if (
                Array.isArray(
                    candidate
                )
            ) {
                return candidate;
            }
        }

        /*
         * Last-resort recursive search for a product-looking array.
         *
         * This makes the frontend tolerant of future Worker response
         * wrappers without having to rewrite the extractor.
         */
        return findProductArray(
            data
        );
    }


    function findProductArray(
        value,
        depth = 0
    ) {

        if (
            depth > 5 ||
            value === null ||
            value === undefined
        ) {
            return [];
        }

        if (
            Array.isArray(
                value
            )
        ) {

            if (
                looksLikeProductArray(
                    value
                )
            ) {
                return value;
            }

            for (
                const item
                of value
            ) {

                const nested =
                    findProductArray(
                        item,
                        depth + 1
                    );

                if (
                    nested.length
                ) {
                    return nested;
                }
            }

            return [];
        }

        if (
            typeof value !==
            "object"
        ) {
            return [];
        }

        for (
            const key
            of Object.keys(
                value
            )
        ) {

            const nested =
                findProductArray(
                    value[key],
                    depth + 1
                );

            if (
                nested.length
            ) {
                return nested;
            }
        }

        return [];
    }


    function looksLikeProductArray(
        array
    ) {

        if (
            !Array.isArray(
                array
            ) ||
            !array.length
        ) {
            return false;
        }

        const sample =
            array.find(
                item =>
                    item &&
                    typeof item ===
                    "object"
            );

        if (
            !sample
        ) {
            return false;
        }

        return Boolean(
            sample?.id ||
            sample?.pid ||
            sample?.productId ||
            sample?.product_id ||
            sample?.itemId ||
            sample?.item_id ||
            sample?.sku ||
            sample?.title ||
            sample?.name ||
            sample?.subject ||
            sample?.productName ||
            sample?.productNameEn
        );
    }


    /* =========================================================================
       15. DEDUPLICATION
       ========================================================================= */

    function getProductIdentity(
        product
    ) {

        if (
            !product ||
            typeof product !==
                "object"
        ) {
            return "";
        }

        const candidates = [

            product?.id,

            product?.pid,

            product?.productId,

            product?.product_id,

            product?.itemId,

            product?.item_id,

            product?.goodsId,

            product?.goods_id,

            product?.cj_id,

            product?.sku,

            product?.productSku,

            product?.product_sku

        ];

        for (
            const value
            of candidates
        ) {

            const normalized =
                cleanString(
                    value
                );

            if (
                normalized
            ) {
                return normalized
                    .toLowerCase();
            }
        }

        /*
         * Last-resort stable identity for a badly formed response.
         */
        const fallback =
            cleanString(
                product?.title ||
                product?.name ||
                product?.subject ||
                product?.productName ||
                ""
            );

        return fallback
            ? `title:${normalizeSearchText(fallback)}`
            : "";
    }


    function deduplicateProducts(
        products
    ) {

        const map =
            new Map();

        for (
            const product
            of Array.isArray(
                products
            )
                ? products
                : []
        ) {

            if (
                !product ||
                typeof product !==
                    "object"
            ) {
                continue;
            }

            const identity =
                getProductIdentity(
                    product
                );

            if (
                !identity
            ) {
                continue;
            }

            if (
                !map.has(
                    identity
                )
            ) {

                map.set(
                    identity,
                    product
                );

            } else {

                const existing =
                    map.get(
                        identity
                    );

                map.set(
                    identity,
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

        const result = {

            ...(first || {}),
            ...(second || {})

        };

        const fields = [

            "id",
            "pid",
            "productId",
            "product_id",
            "itemId",
            "item_id",
            "title",
            "name",
            "subject",
            "productName",
            "productNameEn",
            "description",
            "category",
            "categoryName",
            "categoryPath",
            "categoryId",
            "image",
            "originalImage",
            "sku",
            "productSku",
            "price",
            "quantity",
            "source"

        ];

        for (
            const field
            of fields
        ) {

            const secondValue =
                second?.[field];

            const firstValue =
                first?.[field];

            if (
                isEmptyValue(
                    secondValue
                ) &&
                !isEmptyValue(
                    firstValue
                )
            ) {

                result[field] =
                    firstValue;
            }
        }

        result.images =
            uniqueStrings(
                [
                    ...(Array.isArray(
                        first?.images
                    )
                        ? first.images
                        : []),

                    ...(Array.isArray(
                        second?.images
                    )
                        ? second.images
                        : []),

                    first?.image,
                    second?.image,

                    first?.originalImage,
                    second?.originalImage
                ]
            );

        result.originalImages =
            uniqueStrings(
                [
                    ...(Array.isArray(
                        first?.originalImages
                    )
                        ? first.originalImages
                        : []),

                    ...(Array.isArray(
                        second?.originalImages
                    )
                        ? second.originalImages
                        : []),

                    first?.originalImage,
                    second?.originalImage
                ]
            );

        result.variants =
            mergeVariants(
                first?.variants,
                second?.variants
            );

        const firstCategories =
            Array.isArray(
                first?.storeCategories
            )
                ? first.storeCategories
                : [];

        const secondCategories =
            Array.isArray(
                second?.storeCategories
            )
                ? second.storeCategories
                : [];

        result.storeCategories =
            uniqueStrings(
                [
                    ...firstCategories,
                    ...secondCategories
                ]
            );

        /*
         * Prefer non-zero inventory.
         */
        const firstQuantity =
            normalizeInventory(
                first?.quantity
            );

        const secondQuantity =
            normalizeInventory(
                second?.quantity
            );

        result.quantity =
            Math.max(
                firstQuantity,
                secondQuantity
            );

        return result;
    }


    function mergeVariants(
        first,
        second
    ) {

        const combined =
            [
                ...(Array.isArray(
                    first
                )
                    ? first
                    : []),

                ...(Array.isArray(
                    second
                )
                    ? second
                    : [])
            ];

        const map =
            new Map();

        for (
            const variant
            of combined
        ) {

            if (
                !variant ||
                typeof variant !==
                    "object"
            ) {
                continue;
            }

            const key =
                cleanString(
                    variant?.vid ||
                    variant?.variantId ||
                    variant?.id ||
                    variant?.sku ||
                    variant?.variantSku ||
                    variant?.variantKey ||
                    variant?.name ||
                    ""
                )
                    .toLowerCase();

            if (
                !key
            ) {
                continue;
            }

            if (
                !map.has(
                    key
                )
            ) {

                map.set(
                    key,
                    variant
                );

            } else {

                map.set(
                    key,
                    {
                        ...map.get(
                            key
                        ),
                        ...variant
                    }
                );
            }
        }

        return [
            ...map.values()
        ];
    }


    /* =========================================================================
       16. SEARCH
       ========================================================================= */

    function handleSearch(
        event
    ) {

        const query =
            cleanString(
                event.target?.value ||
                ""
            );

        const normalized =
            normalizeSearchText(
                query
            );

        state.searchQuery =
            normalized;

        state.activeCategory =
            "";

        state.mode =
            normalized
                ? "search"
                : "all";

        updateClearSearchButton();

        highlightCategory();

        if (
            !normalized
        ) {

            if (
                state.products.length
            ) {

                updatePageHeading();

                applyFiltersAndRender();

            } else {

                loadGeneralCatalog();
            }

            return;
        }

        /*
         * Do not wait for the user to press Enter.
         * The debounce wrapper already protects the API.
         */
        performLiveSearch(
            normalized
        );
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

        state.activeCategory =
            "";

        state.mode =
            "all";

        updateClearSearchButton();

        highlightCategory();

        if (
            state.products.length
        ) {

            applyFiltersAndRender();

        } else {

            loadGeneralCatalog();
        }

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
       17. SEARCH TEXT
       ========================================================================= */

    function buildSearchText(
        product
    ) {

        const values = [

            product?.title,
            product?.name,
            product?.subject,
            product?.productName,
            product?.productNameEn,

            product?.description,

            product?.category,
            product?.categoryName,
            product?.oneCategoryName,
            product?.twoCategoryName,
            product?.threeCategoryName,
            product?.categoryPath,
            product?.categoryId,

            product?.sku,
            product?.productSku,

            product?.pid,
            product?.id,
            product?.cj_id,

            product?.product_id,
            product?.itemId,
            product?.item_id,

            product?.productType,

            product?.tags,

            product?.source,

            product?.cj?.productType,
            product?.cj?.supplierName,
            product?.cj?.sku,
            product?.cj?.categoryName,
            product?.cj?.categoryId
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
                product?.categories
            )
        ) {
            values.push(
                ...product.categories
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
                    value =>
                        stripHtml(
                            value
                        )
                )
                .filter(
                    Boolean
                )
                .join(
                    " "
                )
        );
    }


    function normalizeSearchText(
        value
    ) {

        return String(
            value ||
            ""
        )
            .toLowerCase()
            .normalize(
                "NFKD"
            )
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /&/g,
                " and "
            )
            .replace(
                /[_\-\/]+/g,
                " "
            )
            /*
             * Preserve Unicode letters/numbers.
             */
            .replace(
                /[^\p{L}\p{N}\s]+/gu,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    /* =========================================================================
   18. CATEGORY MATCHING
   ========================================================================= */

function matchesCategory(
    product,
    category
) {

    if (
        !category ||
        category.query === ""
    ) {
        return true;
    }

    return (
        getCategoryMatchScore(
            product,
            category
        ) > 0
    );
}


function getCategoryMatchScore(
    product,
    category
) {

    if (
        !product ||
        !category
    ) {
        return 0;
    }


    const categoryId =
        normalizeSearchText(
            category.query
        );


    /*
     * =====================================================================
     * 1. STOREFRONT CATEGORY METADATA
     * =====================================================================
     *
     * Only treat a value as an authoritative storefront category when it
     * exactly matches one of our actual storefront IDs.
     *
     * This prevents CJ's generic categories such as:
     *
     *     solar
     *     lighting
     *     electrical
     *     home-improvement
     *
     * from incorrectly overriding our own:
     *
     *     solar-lights
     *     battery
     *     power-bank
     *     cables
     */

    const storeCategories =
        normalizeStoreCategories(
            product?.storeCategories
        );


    if (
        storeCategories.includes(
            categoryId
        )
    ) {

        return 100;

    }


    /*
     * =====================================================================
     * 2. CATEGORY METADATA
     * =====================================================================
     */

    const categoryText =
        normalizeSearchText(
            [
                product?.category,
                product?.categoryName,
                product?.oneCategoryName,
                product?.twoCategoryName,
                product?.threeCategoryName,
                product?.categoryPath
            ]
                .join(" ")
        );


    /*
     * =====================================================================
     * 3. PRODUCT TITLE
     * =====================================================================
     *
     * Title is the strongest text-based signal because it is generally much
     * more reliable than a long CJ description.
     */

    const titleText =
        normalizeSearchText(
            [
                product?.title,
                product?.name,
                product?.subject,
                product?.productName,
                product?.productNameEn
            ]
                .join(" ")
        );


    /*
     * =====================================================================
     * 4. COMPLETE PRODUCT TEXT
     * =====================================================================
     *
     * Used only as a low-confidence fallback.
     */

    const fullText =
        buildSearchText(
            product
        );


    let score =
        0;


    /*
     * =====================================================================
     * 5. CATEGORY TERM MATCHING
     * =====================================================================
     */

    for (
        const term
        of category.terms || []
    ) {

        const normalizedTerm =
            normalizeSearchText(
                term
            );


        if (
            !normalizedTerm
        ) {
            continue;
        }


        /*
         * Exact title.
         */

        if (
            titleText ===
            normalizedTerm
        ) {

            score += 60;

            continue;

        }


        /*
         * Strong title match.
         */

        if (
            titleText.includes(
                normalizedTerm
            )
        ) {

            score += 35;

            continue;

        }


        /*
         * Category metadata match.
         */

        if (
            categoryText.includes(
                normalizedTerm
            )
        ) {

            score += 25;

            continue;

        }


        /*
         * Full product text is weak evidence only.
         *
         * This prevents words in long descriptions from creating a
         * category by themselves.
         */

        if (
            fullText.includes(
                normalizedTerm
            )
        ) {

            score += 3;

        }

    }


    /*
     * =====================================================================
     * 6. CATEGORY-SPECIFIC STRONG HEURISTICS
     * =====================================================================
     */

    switch (
        category.query
    ) {

        /* -----------------------------------------------------------------
           SOLAR LIGHTS
           ----------------------------------------------------------------- */

        case "solar-lights":

            if (
                /\bsolar\b/.test(
                    titleText
                ) &&
                (
                    /\blight\b/.test(
                        titleText
                    ) ||
                    /\blamp\b/.test(
                        titleText
                    ) ||
                    /\bled\b/.test(
                        titleText
                    ) ||
                    /\bfloodlight\b/.test(
                        titleText
                    ) ||
                    /\bflood\s*light\b/.test(
                        titleText
                    ) ||
                    /\bspotlight\b/.test(
                        titleText
                    ) ||
                    /\bstreet\b/.test(
                        titleText
                    ) ||
                    /\bgarden\b/.test(
                        titleText
                    ) ||
                    /\bwall\b/.test(
                        titleText
                    ) ||
                    /\bpathway\b/.test(
                        titleText
                    ) ||
                    /\boutdoor\b/.test(
                        titleText
                    ) ||
                    /\bmotion\b/.test(
                        titleText
                    )
                )
            ) {

                score += 80;

            }

            /*
             * CJ category fallback:
             * "Solar Lamps", "Solar Lighting", etc.
             */

            if (
                /\bsolar\b/.test(
                    categoryText
                ) &&
                (
                    /\blamp\b/.test(
                        categoryText
                    ) ||
                    /\blight\b/.test(
                        categoryText
                    ) ||
                    /\blighting\b/.test(
                        categoryText
                    )
                )
            ) {

                score += 60;

            }

            break;


        /* -----------------------------------------------------------------
           BATTERY
           ----------------------------------------------------------------- */

        case "battery":

            if (
                /\bbattery\b/.test(
                    titleText
                ) ||
                /\bbatteries\b/.test(
                    titleText
                ) ||
                /\b18650\b/.test(
                    titleText
                ) ||
                /\b21700\b/.test(
                    titleText
                ) ||
                /\blifepo4\b/.test(
                    titleText
                ) ||
                /\blithium\s+(ion\s+)?battery\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           CHARGERS
           ----------------------------------------------------------------- */

        case "chargers":

            if (
                /\bcharger\b/.test(
                    titleText
                ) ||
                /\bcharging\s+adapter\b/.test(
                    titleText
                ) ||
                /\bfast\s+charger\b/.test(
                    titleText
                ) ||
                /\bquick\s+charger\b/.test(
                    titleText
                ) ||
                /\bwireless\s+charger\b/.test(
                    titleText
                ) ||
                /\bwall\s+charger\b/.test(
                    titleText
                ) ||
                /\bphone\s+charger\b/.test(
                    titleText
                ) ||
                /\bcar\s+charger\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           POWER BANK
           ----------------------------------------------------------------- */

        case "power-bank":

            if (
                /\bpower[\s-]*bank\b/.test(
                    titleText
                ) ||
                /\bpowerbank\b/.test(
                    titleText
                )
            ) {

                score += 90;

            } else if (
                /\bportable\b/.test(
                    titleText
                ) &&
                (
                    /\bcharger\b/.test(
                        titleText
                    ) ||
                    /\bbattery\b/.test(
                        titleText
                    ) ||
                    /\bpower\b/.test(
                        titleText
                    )
                )
            ) {

                score += 45;

            }

            break;


        /* -----------------------------------------------------------------
           CABLES
           ----------------------------------------------------------------- */

        case "cables":

            if (
                /\bcable\b/.test(
                    titleText
                ) ||
                /\bcables\b/.test(
                    titleText
                ) ||
                /\busb[\s-]*c\b/.test(
                    titleText
                ) ||
                /\btype[\s-]*c\b/.test(
                    titleText
                ) ||
                /\bhdmi\b/.test(
                    titleText
                ) ||
                /\bethernet\b/.test(
                    titleText
                ) ||
                /\blan\s+cable\b/.test(
                    titleText
                ) ||
                /\bdisplayport\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           EARPHONES
           ----------------------------------------------------------------- */

        case "earphones":

            if (
                /\bearphone\b/.test(
                    titleText
                ) ||
                /\bearbuds?\b/.test(
                    titleText
                ) ||
                /\btws\b/.test(
                    titleText
                ) ||
                /\btrue\s+wireless\b/.test(
                    titleText
                ) ||
                /\bwireless\s+earbuds?\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           HEADPHONES
           ----------------------------------------------------------------- */

        case "headphones":

            if (
                /\bheadphones?\b/.test(
                    titleText
                ) ||
                /\bheadset\b/.test(
                    titleText
                ) ||
                /\bgaming\s+headset\b/.test(
                    titleText
                ) ||
                /\bover[\s-]?ear\b/.test(
                    titleText
                ) ||
                /\bon[\s-]?ear\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           MODEM
           ----------------------------------------------------------------- */

        case "modem":

            if (
                /\bmodem\b/.test(
                    titleText
                ) ||
                /\b4g\s+modem\b/.test(
                    titleText
                ) ||
                /\b5g\s+modem\b/.test(
                    titleText
                ) ||
                /\blte\s+modem\b/.test(
                    titleText
                ) ||
                /\busb\s+modem\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           ROUTERS
           ----------------------------------------------------------------- */

        case "routers":

            if (
                /\brouter\b/.test(
                    titleText
                ) ||
                /\bwi[\s-]?fi\s+router\b/.test(
                    titleText
                ) ||
                /\b4g\s+router\b/.test(
                    titleText
                ) ||
                /\b5g\s+router\b/.test(
                    titleText
                ) ||
                /\blte\s+router\b/.test(
                    titleText
                ) ||
                /\bmesh\s+router\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           LAPTOPS
           ----------------------------------------------------------------- */

        case "laptops":

            if (
                /\blaptop\b/.test(
                    titleText
                ) ||
                /\bnotebook\b/.test(
                    titleText
                ) ||
                /\bchromebook\b/.test(
                    titleText
                ) ||
                /\bultrabook\b/.test(
                    titleText
                ) ||
                /\bmacbook\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           POWER TOOLS
           ----------------------------------------------------------------- */

        case "power-tools":

            if (
                /\bdrill\b/.test(
                    titleText
                ) ||
                /\bgrinder\b/.test(
                    titleText
                ) ||
                /\bscrewdriver\b/.test(
                    titleText
                ) ||
                /\bwrench\b/.test(
                    titleText
                ) ||
                /\bsaw\b/.test(
                    titleText
                ) ||
                /\bsander\b/.test(
                    titleText
                ) ||
                /\bpower[\s-]*tool\b/.test(
                    titleText
                ) ||
                /\bimpact\s+driver\b/.test(
                    titleText
                ) ||
                /\bimpact\s+wrench\b/.test(
                    titleText
                ) ||
                /\bheat\s+gun\b/.test(
                    titleText
                ) ||
                /\brotary\s+tool\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           CAMERA
           ----------------------------------------------------------------- */

        case "camera":

            if (
                /\bcamera\b/.test(
                    titleText
                ) ||
                /\bcctv\b/.test(
                    titleText
                ) ||
                /\bwebcam\b/.test(
                    titleText
                ) ||
                /\bdash[\s-]*cam\b/.test(
                    titleText
                ) ||
                /\bsurveillance\b/.test(
                    titleText
                ) ||
                /\bip\s+camera\b/.test(
                    titleText
                ) ||
                /\bsecurity\s+camera\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        /* -----------------------------------------------------------------
           SMART HOME
           ----------------------------------------------------------------- */

        case "smart-home":

            if (
                (
                    /\bsmart\b/.test(
                        titleText
                    ) &&
                    (
                        /\bhome\b/.test(
                            titleText
                        ) ||
                        /\bplug\b/.test(
                            titleText
                        ) ||
                        /\bswitch\b/.test(
                            titleText
                        ) ||
                        /\bsocket\b/.test(
                            titleText
                        ) ||
                        /\bbulb\b/.test(
                            titleText
                        ) ||
                        /\bsensor\b/.test(
                            titleText
                        ) ||
                        /\block\b/.test(
                            titleText
                        ) ||
                        /\brelay\b/.test(
                            titleText
                        )
                    )
                ) ||
                /\bhome\s+automation\b/.test(
                    titleText
                )
            ) {

                score += 80;

            }

            break;


        default:

            break;
    }


    /*
     * =====================================================================
     * 7. MINIMUM CONFIDENCE
     * =====================================================================
     *
     * A weak description-only match should not create a category.
     *
     * Title/category/storefront-ID matches will normally exceed this
     * threshold comfortably.
     */

    return score >= 15
        ? score
        : 0;
}


function normalizeStoreCategories(
    categories
) {

    if (
        !Array.isArray(
            categories
        )
    ) {

        return [];

    }


    return categories
        .map(
            value =>
                normalizeSearchText(
                    value
                )
        )
        .filter(
            Boolean
        );

}
    /* =========================================================================
       19. FILTER + SORT + RENDER
       ========================================================================= */

    function applyFiltersAndRender() {

        let products =
            [
                ...state.products
            ];

        /*
         * Search mode.
         *
         * Search results have already come from Worker/CJ.
         * Do not aggressively filter them again.
         */
        if (
            state.mode ===
            "search"
        ) {

            products =
                products.sort(
                    (
                        a,
                        b
                    ) =>
                        getSearchScore(
                            b,
                            state.searchQuery
                        ) -
                        getSearchScore(
                            a,
                            state.searchQuery
                        )
                );

        } else if (
            state.activeCategory
        ) {

            const category =
                getActiveCategory();

            products =
                products
                    .map(
                        product => ({
                            product,
                            score:
                                getCategoryMatchScore(
                                    product,
                                    category
                                )
                        })
                    )
                    .filter(
                        item =>
                            item.score > 0
                    )
                    .sort(
                        (
                            a,
                            b
                        ) => {

                            if (
                                b.score !==
                                a.score
                            ) {
                                return (
                                    b.score -
                                    a.score
                                );
                            }

                            return compareProducts(
                                a.product,
                                b.product
                            );
                        }
                    )
                    .map(
                        item =>
                            item.product
                    );

        } else {

            products.sort(
                compareProducts
            );
        }

        state.filteredProducts =
            products.slice(
                0,
                CONFIG.MAX_VISIBLE_PRODUCTS
            );

        updatePageHeading();

        updateResultsCount();

        if (
            !state.filteredProducts.length
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


    function categoryProductsSort(
        products,
        category
    ) {

        return products
            .slice()
            .sort(
                (
                    a,
                    b
                ) => {

                    const scoreA =
                        getCategoryMatchScore(
                            a,
                            category
                        );

                    const scoreB =
                        getCategoryMatchScore(
                            b,
                            category
                        );

                    if (
                        scoreA !==
                        scoreB
                    ) {
                        return (
                            scoreB -
                            scoreA
                        );
                    }

                    return compareProducts(
                        a,
                        b
                    );
                }
            );
    }


    /* =========================================================================
       20. SORTING
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
            sort ===
            "priceasc"
        ) {

            return (
                priceA -
                priceB
            );
        }

        if (
            sort ===
            "pricedesc"
        ) {

            return (
                priceB -
                priceA
            );
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
         * Featured:
         * 1. In stock
         * 2. image
         * 3. listed/popularity
         * 4. category confidence
         * 5. name
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

        const imageA =
            firstImage(
                a
            )
                ? 1
                : 0;

        const imageB =
            firstImage(
                b
            )
                ? 1
                : 0;

        if (
            imageA !==
            imageB
        ) {
            return (
                imageB -
                imageA
            );
        }

        const listedA =
            Number(
                a?.listedNum ||
                a?.cj?.listedNum ||
                a?.sales ||
                a?.soldCount ||
                0
            );

        const listedB =
            Number(
                b?.listedNum ||
                b?.cj?.listedNum ||
                b?.sales ||
                b?.soldCount ||
                0
            );

        if (
            listedA !==
            listedB
        ) {
            return (
                listedB -
                listedA
            );
        }

        const categoryScoreA =
            getCategoryPriorityScore(
                a
            );

        const categoryScoreB =
            getCategoryPriorityScore(
                b
            );

        if (
            categoryScoreA !==
            categoryScoreB
        ) {
            return (
                categoryScoreB -
                categoryScoreA
            );
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


    function getCategoryPriorityScore(
        product
    ) {

        const categories =
            normalizeStoreCategories(
                product?.storeCategories
            );

        return Math.min(
            categories.length,
            5
        );
    }


    function getSearchScore(
        product,
        query
    ) {

        if (
            !product ||
            !query
        ) {
            return 0;
        }

        const terms =
            normalizeSearchText(
                query
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

        if (
            !terms.length
        ) {
            return 0;
        }

        const title =
            normalizeSearchText(
                [
                    product?.title,
                    product?.name,
                    product?.subject,
                    product?.productName,
                    product?.productNameEn
                ]
                    .join(
                        " "
                    )
            );

        const category =
            normalizeSearchText(
                [
                    product?.category,
                    product?.categoryName,
                    product?.threeCategoryName
                ]
                    .join(
                        " "
                    )
            );

        const text =
            buildSearchText(
                product
            );

        let score =
            0;

        for (
            const term
            of terms
        ) {

            if (
                title.includes(
                    term
                )
            ) {
                score += 40;
            } else if (
                category.includes(
                    term
                )
            ) {
                score += 20;
            } else if (
                text.includes(
                    term
                )
            ) {
                score += 5;
            }
        }

        /*
         * Bonus when every term is present.
         */
        if (
            terms.every(
                term =>
                    text.includes(
                        term
                    )
            )
        ) {
            score += 50;
        }

        return score;
    }


    function normalizeSortValue(
        value
    ) {

        const sort =
            String(
                value ||
                CONFIG.DEFAULT_SORT
            )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
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
            return "priceasc";
        }

        if (
            sort.includes(
                "hightolow"
            ) ||
            sort.includes(
                "pricedesc"
            )
        ) {
            return "pricedesc";
        }

        if (
            sort.includes(
                "atoz"
            ) ||
            sort.includes(
                "nameaz"
            )
        ) {
            return "nameaz";
        }

        if (
            sort.includes(
                "ztoa"
            ) ||
            sort.includes(
                "nameza"
            )
        ) {
            return "nameza";
        }

        return "featured";
    }


    /* =========================================================================
       21. PRODUCT NORMALIZATION
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
            cleanString(
                firstDefined(
                    raw?.pid,
                    raw?.productId,
                    raw?.product_id,
                    raw?.itemId,
                    raw?.item_id,
                    raw?.id,
                    raw?.cj_id
                )
            );

        const id =
            cleanString(
                firstDefined(
                    raw?.id,
                    raw?.pid,
                    raw?.productId,
                    raw?.product_id,
                    raw?.itemId,
                    raw?.item_id,
                    raw?.cj_id,
                    raw?.sku,
                    raw?.productSku,
                    raw?.product_sku
                )
            );

        const name =
            cleanString(
                firstDefined(
                    raw?.title,
                    raw?.name,
                    raw?.subject,
                    raw?.productNameEn,
                    raw?.productName,
                    raw?.nameEn,
                    raw?.item_title,
                    raw?.itemTitle,
                    "Product"
                )
            );

        /*
         * The Worker normally provides an ID and title.
         * We only reject a truly unusable record.
         */
        if (
            !id ||
            !name
        ) {
            return null;
        }

        const price =
            normalizeProductPrice(
                raw
            );

        const quantity =
            normalizeProductQuantity(
                raw
            );

        const rating =
            normalizeRating(
                firstDefined(
                    raw?.rating,
                    raw?.averageRating,
                    raw?.score,
                    raw?.reviewScore,
                    0
                )
            );

        const images =
            getGalleryImages(
                raw
            );

        const originalImages =
            collectOriginalImages(
                raw
            );

        const originalImage =
            originalImages[0] ||
            "";

        const image =
            normalizeImageUrl(
                raw?.image
            ) ||
            images[0] ||
            (
                originalImage
                    ? buildProxyUrl(
                        originalImage
                    )
                    : ""
            ) ||
            PLACEHOLDER_IMAGE;

        const variants =
            normalizeVariants(
                firstDefined(
                    raw?.variants,
                    raw?.variantList,
                    raw?.variantListData,
                    raw?.combinationVariants,
                    []
                )
            );

        const storeCategories =
            normalizeStoreCategories(
                raw?.storeCategories
            );

        const category =
            cleanString(
                firstDefined(
                    raw?.category,
                    raw?.categoryName,
                    raw?.threeCategoryName,
                    raw?.twoCategoryName,
                    raw?.oneCategoryName,
                    raw?.item_category,
                    raw?.categoryPath,
                    raw?.cj?.categoryName,
                    CONFIG.DEFAULT_CATEGORY
                )
            );

        const source =
            cleanString(
                firstDefined(
                    raw?.source,
                    raw?.platform,
                    "CJ Dropshipping"
                )
            );

        const normalized = {

            ...raw,

            id,

            pid:
                pid ||
                id,

            productId:
                cleanString(
                    firstDefined(
                        raw?.productId,
                        raw?.product_id,
                        id
                    )
                ),

            product_id:
                cleanString(
                    firstDefined(
                        raw?.product_id,
                        raw?.productId,
                        id
                    )
                ),

            itemId:
                cleanString(
                    firstDefined(
                        raw?.itemId,
                        raw?.item_id,
                        ""
                    )
                ),

            item_id:
                cleanString(
                    firstDefined(
                        raw?.item_id,
                        raw?.itemId,
                        ""
                    )
                ),

            cj_id:
                cleanString(
                    firstDefined(
                        raw?.cj_id,
                        raw?.cjId,
                        ""
                    )
                ),

            sku:
                cleanString(
                    firstDefined(
                        raw?.sku,
                        raw?.productSku,
                        raw?.product_sku,
                        raw?.cj?.sku,
                        ""
                    )
                ),

            productSku:
                cleanString(
                    firstDefined(
                        raw?.productSku,
                        raw?.product_sku,
                        raw?.sku,
                        ""
                    )
                ),

            title:
                name,

            name,

            subject:
                cleanString(
                    firstDefined(
                        raw?.subject,
                        raw?.title,
                        raw?.name,
                        ""
                    )
                ),

            description:
                String(
                    firstDefined(
                        raw?.description,
                        raw?.detail,
                        raw?.productDescription,
                        raw?.item_description,
                        ""
                    )
                ),

            category,

            categoryName:
                cleanString(
                    firstDefined(
                        raw?.categoryName,
                        raw?.threeCategoryName,
                        raw?.category,
                        raw?.cj?.categoryName,
                        ""
                    )
                ),

            oneCategoryName:
                cleanString(
                    firstDefined(
                        raw?.oneCategoryName,
                        raw?.cj?.oneCategoryName,
                        ""
                    )
                ),

            twoCategoryName:
                cleanString(
                    firstDefined(
                        raw?.twoCategoryName,
                        raw?.cj?.twoCategoryName,
                        ""
                    )
                ),

            threeCategoryName:
                cleanString(
                    firstDefined(
                        raw?.threeCategoryName,
                        raw?.cj?.threeCategoryName,
                        ""
                    )
                ),

            categoryPath:
                cleanString(
                    firstDefined(
                        raw?.categoryPath,
                        raw?.category_path,
                        raw?.item_category,
                        ""
                    )
                ),

            categoryId:
                cleanString(
                    firstDefined(
                        raw?.categoryId,
                        raw?.category_id,
                        raw?.cj?.categoryId,
                        ""
                    )
                ),

            storeCategories,

            price,

            quantity,

            inventory:
                quantity,

            rating,

            image,

            images,

            originalImage,

            originalImages,

            variants,

            listedNum:
                Number(
                    firstDefined(
                        raw?.listedNum,
                        raw?.sales,
                        raw?.soldCount,
                        raw?.cj?.listedNum,
                        0
                    )
                ) || 0,

            source
        };

        normalized.searchText =
            buildSearchText(
                normalized
            );

        return normalized;
    }


    function normalizeProductPrice(
        raw
    ) {

        const candidateValues = [

            raw?.price,
            raw?.salePrice,
            raw?.sale_price,
            raw?.discountPrice,
            raw?.discount_price,
            raw?.sellPrice,
            raw?.unitPrice,
            raw?.unit_price,
            raw?.nowPrice,
            raw?.targetSalePrice,
            raw?.target_sale_price,
            raw?.targetOriginalPrice,
            raw?.target_original_price
        ];

        for (
            const value
            of candidateValues
        ) {

            if (
                value ===
                undefined ||
                value ===
                null ||
                value ===
                ""
            ) {
                continue;
            }

            const number =
                normalizePrice(
                    value
                );

            if (
                number >
                0
            ) {
                return number;
            }
        }

        return 0;
    }


    function normalizeProductQuantity(
        raw
    ) {

        const candidates = [

            raw?.quantity,
            raw?.inventory,
            raw?.availableQuantity,
            raw?.available_quantity,
            raw?.totalInventory,
            raw?.warehouseInventoryNum,
            raw?.totalVerifiedInventory,
            raw?.totalUnVerifiedInventory,

            raw?.stock,
            raw?.stockQuantity,
            raw?.stock_quantity,

            raw?.cj?.totalInventory,
            raw?.cj?.warehouseInventoryNum

        ];

        for (
            const value
            of candidates
        ) {

            if (
                value ===
                undefined ||
                value ===
                null ||
                value ===
                ""
            ) {
                continue;
            }

            const normalized =
                normalizeInventory(
                    value
                );

            /*
             * Explicit quantity is valid even when it equals zero.
             */
            return normalized;
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
                ) =>
                    total +
                    normalizeInventory(
                        firstDefined(
                            variant?.inventory,
                            variant?.quantity,
                            variant?.totalInventory,
                            0
                        )
                    ),
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
                            cleanString(
                                firstDefined(
                                    variant?.vid,
                                    variant?.variantId,
                                    variant?.variant_id,
                                    variant?.id,
                                    ""
                                )
                            ),

                        pid:
                            cleanString(
                                firstDefined(
                                    variant?.pid,
                                    variant?.productId,
                                    variant?.product_id,
                                    ""
                                )
                            ),

                        sku:
                            cleanString(
                                firstDefined(
                                    variant?.sku,
                                    variant?.variantSku,
                                    variant?.variant_sku,
                                    variant?.variantKey,
                                    ""
                                )
                            ),

                        name:
                            cleanString(
                                firstDefined(
                                    variant?.name,
                                    variant?.variantNameEn,
                                    variant?.variantName,
                                    variant?.variantKey,
                                    "Default"
                                )
                            ),

                        variantKey:
                            cleanString(
                                variant?.variantKey
                            ),

                        price:
                            normalizePrice(
                                firstDefined(
                                    variant?.price,
                                    variant?.salePrice,
                                    variant?.sellPrice,
                                    0
                                )
                            ),

                        costPrice:
                            normalizePrice(
                                firstDefined(
                                    variant?.costPrice,
                                    variant?.cost_price,
                                    0
                                )
                            ),

                        inventory:
                            normalizeInventory(
                                firstDefined(
                                    variant?.inventory,
                                    variant?.quantity,
                                    variant?.totalInventory,
                                    0
                                )
                            ),

                        quantity:
                            normalizeInventory(
                                firstDefined(
                                    variant?.quantity,
                                    variant?.inventory,
                                    variant?.totalInventory,
                                    0
                                )
                            ),

                        image:
                            normalizeImageUrl(
                                firstDefined(
                                    variant?.image,
                                    variant?.variantImage,
                                    variant?.variant_image,
                                    ""
                                )
                            )
                    };
                }
            )
            .filter(
                Boolean
            );
    }


    /* =========================================================================
       22. IMAGE HANDLING
       ========================================================================= */

    function firstImage(
        product
    ) {

        const all =
            collectProductImageUrls(
                product
            );

        return all[0] ||
            "";
    }


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

        if (
            typeof value !==
            "string"
        ) {
            return false;
        }

        try {

            const url =
                new URL(
                    value
                );

            return (
                url.origin ===
                    CONFIG.API_BASE &&
                (
                    url.pathname ===
                        CONFIG.IMAGE_PROXY_ENDPOINT ||
                    url.pathname ===
                        "/image-proxy"
                )
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

        const push =
            value => {

                if (
                    typeof value ===
                    "string"
                ) {

                    candidates.push(
                        value
                    );

                    return;
                }

                if (
                    Array.isArray(
                        value
                    )
                ) {

                    candidates.push(
                        ...value
                    );

                    return;
                }

                if (
                    value &&
                    typeof value ===
                    "object"
                ) {

                    candidates.push(
                        value.url,
                        value.imageUrl,
                        value.image_url,
                        value.bigImage,
                        value.productImage,
                        value.src
                    );
                }
            };

        push(
            product?.image
        );

        push(
            product?.images
        );

        push(
            product?.originalImage
        );

        push(
            product?.originalImages
        );

        push(
            product?.bigImage
        );

        push(
            product?.productImage
        );

        push(
            product?.productImg
        );

        push(
            product?.mainImage
        );

        push(
            product?.item_main_img
        );

        push(
            product?.itemMainImg
        );

        push(
            product?.main_image
        );

        push(
            product?.imageUrl
        );

        push(
            product?.imageList
        );

        push(
            product?.productImageSet
        );

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
                product?.variants
            )
        ) {

            for (
                const variant
                of product.variants
            ) {

                push(
                    variant?.image
                );

                push(
                    variant?.variantImage
                );

                push(
                    variant?.variant_image
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


    function collectOriginalImages(
        product
    ) {

        const candidates =
            [];

        const push =
            value => {

                if (
                    typeof value ===
                    "string"
                ) {
                    candidates.push(
                        value
                    );

                } else if (
                    Array.isArray(
                        value
                    )
                ) {
                    candidates.push(
                        ...value
                    );
                }
            };

        push(
            product?.originalImage
        );

        push(
            product?.originalImages
        );

        push(
            product?.bigImage
        );

        push(
            product?.productImage
        );

        push(
            product?.productImg
        );

        push(
            product?.mainImage
        );

        push(
            product?.item_main_img
        );

        push(
            product?.itemMainImg
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
       23. PRODUCT GRID
       ========================================================================= */

    function renderProductGrid() {

        if (
            !elements.productList
        ) {
            return;
        }

        const products =
            state.filteredProducts;

        const renderId =
            ++state.renderSequence;

        elements.productList.innerHTML =
            "";

        setLoadingState(
            true
        );

        let index =
            0;

        const renderBatch =
            () => {

                if (
                    renderId !==
                    state.renderSequence
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
                    index <
                    end;
                    index++
                ) {

                    const element =
                        createProductCardElement(
                            products[index]
                        );

                    if (
                        element
                    ) {

                        fragment.appendChild(
                            element
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

        return (
            wrapper.firstElementChild ||
            null
        );
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
                "Product"
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
            quantity > 0;

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

                    <span class="product-badge">
                        ${svgIcon(
                            "apps",
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

                <div class="product-card-body">

                    <h3 class="product-title">

                        <button
                            type="button"
                            class="product-title-button"
                            data-action="view-details"
                            data-product-id="${productId}"
                        >
                            ${title}
                        </button>

                    </h3>

                    <p class="product-card-description">
                        ${escapeHTML(
                            shortDescription
                        )}
                    </p>

                    ${
                        product.rating > 0
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

                    ${
                        variantCount > 0
                            ? `
                                <div class="product-variant-count">
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

                    <div class="product-card-footer">

                        <div class="price-container">

                            <span class="product-price">
                                ${escapeHTML(
                                    price
                                )}
                            </span>

                        </div>

                        <div class="product-actions-group">

                            <button
                                type="button"
                                class="btn-card btn-secondary view-details-btn"
                                data-action="view-details"
                                data-product-id="${productId}"
                                aria-label="View details for ${title}"
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
                                ${available ? "" : "disabled"}
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


    /* =========================================================================
       24. GRID EVENTS
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

            async function findProductById(
    id
) {

    const wanted =
        String(
            id ||
            ""
        )
            .trim();


    if (
        !wanted
    ) {

        return null;

    }


    /*
     * ================================================================
     * 1. FULL DETAIL CACHE
     * ================================================================
     */

    const cachedDetail =
        state.productDetailCache?.get(
            wanted
        );


    if (
        cachedDetail &&
        cachedDetail.detailLoaded === true
    ) {

        return cachedDetail;

    }


    /*
     * ================================================================
     * 2. LOCAL CATALOG FALLBACK
     * ================================================================
     *
     * This is only a fallback.
     *
     * We intentionally DO NOT return it immediately because the
     * catalog record may be the lightweight CJ listV2 record.
     */

    const local =
        state.products.find(
            product =>
                String(
                    product?.id ||
                    ""
                ) ===
                wanted
        ) ||

        state.products.find(
            product =>
                String(
                    product?.pid ||
                    ""
                ) ===
                wanted
        ) ||

        state.products.find(
            product =>
                String(
                    product?.productId ||
                    ""
                ) ===
                wanted
        ) ||

        null;


    /*
     * ================================================================
     * 3. REQUEST FULL CJ DETAIL FROM WORKER
     * ================================================================
     */

    try {

        const data =
            await fetchJSON(
                buildProductsUrl(
                    {
                        pid:
                            wanted
                    }
                ),
                {
                    timeout:
                        CONFIG.REQUEST_TIMEOUT
                }
            );


        /*
         * Worker response:
         *
         * {
         *     success: true,
         *     product: {...}
         * }
         */

        if (
            data?.success === false
        ) {

            throw new Error(
                data?.error ||
                data?.message ||
                "Product detail request failed."
            );

        }


        const raw =
            data?.product ||
            data?.data?.product ||
            data?.data ||
            null;


        if (
            !raw ||
            typeof raw !== "object"
        ) {

            throw new Error(
                "Product detail response was empty."
            );

        }


        const normalized =
            normalizeProduct(
                raw
            );


        if (
            !normalized
        ) {

            throw new Error(
                "Product detail could not be normalized."
            );

        }


        /*
         * Explicitly mark this as full detail.
         */
        normalized.detailLoaded =
            true;


        normalized.detailFetchedAt =
            new Date().toISOString();


        /*
         * Store in frontend detail cache.
         */
        state.productDetailCache.set(
            wanted,
            normalized
        );


        /*
         * ============================================================
         * 4. MERGE FULL DETAIL INTO MAIN PRODUCT STATE
         * ============================================================
         *
         * This means the richer record becomes the product used by
         * the rest of the storefront too.
         */

        const productIndex =
            state.products.findIndex(
                product =>
                    String(
                        product?.id ||
                        product?.pid ||
                        product?.productId ||
                        ""
                    ) ===
                    wanted
            );


        if (
            productIndex >= 0
        ) {

            state.products[
                productIndex
            ] =
                {
                    ...state.products[
                        productIndex
                    ],

                    ...normalized
                };

        }


        /*
         * Also update filteredProducts when applicable.
         */
        const filteredIndex =
            state.filteredProducts.findIndex(
                product =>
                    String(
                        product?.id ||
                        product?.pid ||
                        product?.productId ||
                        ""
                    ) ===
                    wanted
            );


        if (
            filteredIndex >= 0
        ) {

            state.filteredProducts[
                filteredIndex
            ] =
                {
                    ...state.filteredProducts[
                        filteredIndex
                    ],

                    ...normalized
                };

        }


        return normalized;

    } catch (
        error
    ) {

        console.warn(
            "[PRASUN SHOP] Full product detail lookup failed; using catalog fallback:",
            error
        );


        /*
         * If CJ detail is temporarily unavailable, don't break the
         * product modal. Return the existing lightweight product.
         */

        return local || null;

    }

}

    /* =========================================================================
       25. IMAGE FALLBACK
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
            normalizeImageUrl(
                image.dataset.originalImage ||
                ""
            );

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
       26. PRODUCT MODAL
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
                        element =>
                            element.remove()
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
                                    name ===
                                    "style"
                                ) {

                                    element.removeAttribute(
                                        attribute.name
                                    );

                                    return;
                                }

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

        return (
            parsed.body.innerHTML
        );
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

            const url =
                new URL(
                    value,
                    window.location.href
                );

            return (
                url.protocol ===
                    "https:" ||
                url.protocol ===
                    "http:"
            );

        } catch {

            return false;
        }
    }


    async function openProductModal(
        productId
    ) {

        if (
            !elements.productModal ||
            !elements.modalBody
        ) {

            console.error(
                "[PRASUN SHOP] Product modal is missing."
            );

            return;
        }

        let product =
            state.products.find(
                item =>
                    String(
                        item?.id
                    ) ===
                    String(
                        productId
                    )
            );

        if (
            !product
        ) {

            product =
                await findProductById(
                    productId
                );
        }

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
                "Product"
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
                    <div class="modal-gallery">
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
            variants.length > 0
                ? `
                    <div class="product-variants-info">
                        <strong>
                            ${
                                variants.length === 1
                                    ? "Variant:"
                                    : "Variants:"
                            }
                        </strong>

                        <span>
                            ${variants.length} available
                        </span>
                    </div>
                `
                : "";

        elements.modalBody.innerHTML =
            `
                <div class="modal-image-column">

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

                <div class="modal-details">

                    <span class="product-category-tag">
                        ${category}
                    </span>

                    <h2
                        id="modal-title"
                        class="modal-product-title"
                    >
                        ${title}
                    </h2>

                    <div class="modal-product-price-row">

                        <strong class="modal-product-price">
                            ${formatPrice(
                                product.price
                            )}
                        </strong>

                        <span class="modal-product-stock">
                            ${
                                quantity > 0
                                    ? `In Stock: ${quantity}`
                                    : "Out of Stock"
                            }
                        </span>

                    </div>

                    ${variantsHtml}

                    <div class="modal-description-box">

                        <strong class="modal-description-title">
                            Product Description
                        </strong>

                        <div class="cj-description-container">
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

                    const original =
                        normalizeImageUrl(
                            product.originalImage
                        );

                    if (
                        original &&
                        !mainImage.dataset.proxyAttempted
                    ) {

                        mainImage.dataset.proxyAttempted =
                            "true";

                        const proxy =
                            buildProxyUrl(
                                original
                            );

                        if (
                            proxy &&
                            proxy !==
                            mainImage.src
                        ) {

                            mainImage.src =
                                proxy;

                            return;
                        }
                    }

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
       27. UI STATES
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
                        Loading products...
                    </p>

                </div>
            `;

        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "Loading...";
        }

        setLoadingState(
            true
        );
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

                    if (
                        state.mode ===
                        "search" &&
                        state.searchQuery
                    ) {

                        performLiveSearch(
                            state.searchQuery
                        );

                    } else if (
                        state.mode ===
                        "category" &&
                        state.activeCategory
                    ) {

                        loadCategoryProducts(
                            getActiveCategory()
                        );

                    } else {

                        loadGeneralCatalog();
                    }

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
                count === 1
                    ? "product"
                    : "products"
            } available`;
    }


    function updatePageHeading(
        override = ""
    ) {

        if (
            !elements.pageHeading
        ) {
            return;
        }

        if (
            override
        ) {

            elements.pageHeading.textContent =
                override;

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
       28. API HELPERS
       ========================================================================= */

    function buildProductsUrl(
        params = {}
    ) {

        const url =
            new URL(
                CONFIG.PRODUCTS_ENDPOINT,
                CONFIG.API_BASE
            );

        Object.entries(
            params
        )
            .forEach(
                (
                    [
                        key,
                        value
                    ]
                ) => {

                    if (
                        value ===
                        undefined ||
                        value ===
                        null ||
                        value ===
                        ""
                    ) {
                        return;
                    }

                    url.searchParams.set(
                        key,
                        String(
                            value
                        )
                    );
                }
            );

        return url.toString();
    }


    async function fetchJSON(
        url,
        options = {}
    ) {

        const controller =
            new AbortController();

        const timeoutMs =
            Number(
                options.timeout ||
                CONFIG.REQUEST_TIMEOUT
            );

        const timeoutId =
            window.setTimeout(
                () => {
                    controller.abort();
                },
                timeoutMs
            );

        /*
         * Combine caller signal with our timeout.
         */
        let removeAbortListener =
            null;

        if (
            options.signal
        ) {

            const abortFromCaller =
                () => {
                    try {
                        controller.abort();
                    } catch {
                        /* Ignore. */
                    }
                };

            if (
                options.signal.aborted
            ) {

                abortFromCaller();

            } else {

                options.signal.addEventListener(
                    "abort",
                    abortFromCaller,
                    {
                        once:
                            true
                    }
                );

                removeAbortListener =
                    () => {

                        try {

                            options.signal.removeEventListener(
                                "abort",
                                abortFromCaller
                            );

                        } catch {

                            /* Ignore. */
                        }
                    };
            }
        }

        try {

            const response =
                await fetch(
                    url,
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

                        signal:
                            controller.signal
                    }
                );

            if (
                !response.ok
            ) {

                const body =
                    await safeResponseText(
                        response
                    );

                throw new Error(
                    `Product service returned HTTP ${response.status}${
                        body
                            ? `: ${body.slice(0, 180)}`
                            : "."
                    }`
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

            return data;

        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "The product request timed out or was cancelled."
                );
            }

            throw error;

        } finally {

            window.clearTimeout(
                timeoutId
            );

            if (
                removeAbortListener
            ) {
                removeAbortListener();
            }
        }
    }


    async function safeResponseText(
        response
    ) {

        try {

            return await response.text();

        } catch {

            return "";
        }
    }


    function cancelCurrentLoad() {

        if (
            state.loadController
        ) {

            try {
                state.loadController.abort();
            } catch {
                /* Ignore. */
            }
        }

        state.loadController =
            null;
    }


    /* =========================================================================
       29. RESULT CACHE
       ========================================================================= */

    function setResultCache(
        map,
        key,
        products
    ) {

        if (
            !(map instanceof Map)
        ) {
            return;
        }

        map.set(
            key,
            {
                timestamp:
                    Date.now(),

                products:
                    Array.isArray(
                        products
                    )
                        ? products.map(
                            product =>
                                ({
                                    ...product
                                })
                        )
                        : []
            }
        );
    }


    function getValidCachedResult(
        map,
        key
    ) {

        if (
            !(map instanceof Map)
        ) {
            return null;
        }

        const entry =
            map.get(
                key
            );

        if (
            !entry
        ) {
            return null;
        }

        if (
            Date.now() -
            Number(
                entry.timestamp ||
                0
            ) >
            CONFIG.RESULT_CACHE_MS
        ) {

            map.delete(
                key
            );

            return null;
        }

        return Array.isArray(
            entry.products
        )
            ? entry.products.map(
                product =>
                    ({
                        ...product
                    })
            )
            : [];
    }


    /* =========================================================================
       30. GENERAL HELPERS
       ========================================================================= */

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

        return "";
    }


    function isEmptyValue(
        value
    ) {

        return (
            value ===
                undefined ||
            value ===
                null ||
            value ===
                "" ||
            (
                Array.isArray(
                    value
                ) &&
                !value.length
            )
        );
    }


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


    function normalizeInventory(
        value
    ) {

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

        if (
            value &&
            typeof value ===
            "object"
        ) {

            value =
                firstDefined(
                    value.amount,
                    value.value,
                    value.quantity,
                    value.inventory,
                    value.stock,
                    0
                );
        }

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


    function normalizePrice(
        value
    ) {

        if (
            value &&
            typeof value ===
            "object"
        ) {

            value =
                firstDefined(
                    value.amount,
                    value.value,
                    value.price,
                    value.raw,
                    0
                );
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

        return Number.isFinite(
            number
        )
            ? Number(
                number.toFixed(
                    2
                )
            )
            : 0;
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
            ) ||
            number <= 0
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


    function uniqueStrings(
        values
    ) {

        return [
            ...new Set(
                (values || [])
                    .filter(
                        value =>
                            typeof value ===
                            "string"
                    )
                    .map(
                        value =>
                            value.trim()
                    )
                    .filter(
                        Boolean
                    )
            )
        ];
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


    function debounce(
        fn,
        wait
    ) {

        let timer =
            null;

        return function (
            ...args
        ) {

            window.clearTimeout(
                timer
            );

            timer =
                window.setTimeout(
                    () => {

                        fn.apply(
                            this,
                            args
                        );

                    },
                    wait
                );
        };
    }


    /* =========================================================================
       31. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload:
            () =>
                loadGeneralCatalog(),

        search:
            query =>
                performLiveSearch(
                    query
                ),

        filterCategory:
            query => {

                const normalized =
                    cleanString(
                        query
                    );

                state.activeCategory =
                    normalized;

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

                if (
                    normalized
                ) {

                    loadCategoryProducts(
                        getActiveCategory()
                    );

                } else {

                    loadGeneralCatalog();
                }
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
                state.products.find(
                    product =>
                        String(
                            product.pid
                        ) ===
                        String(
                            id
                        )
                ) ||
                null,

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
                loading:
                    state.loading,

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

                mode:
                    state.mode,

                categoryLoading:
                    state.categoryLoading,

                searchLoading:
                    state.searchLoading
            }),

        clearCaches:
            () => {

                state.liveSearchCache.clear();

                state.categoryCache.clear();

                state.productDetailCache.clear();
            }
    };

})();
