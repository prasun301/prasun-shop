/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 * File: js/products.js
 *
 * Production architecture:
 *
 *   Cloudflare Worker /api/products
 *          |
 *          v
 *   Curated KV catalog (fast)
 *          |
 *          v
 *   products.js
 *      |       |
 *      v       v
 *   Search   Categories
 *      |       |
 *      +---+---+
 *          |
 *          v
 *       Sorting
 *          |
 *          v
 *       Rendering
 *
 * Product details are deliberately lazy-loaded:
 *   product card -> View Details -> /api/products?pid=... -> full CJ detail
 *
 * IMPORTANT:
 *   - Category UI is completely independent of product data.
 *   - Detail records are NEVER merged into state.products.
 *   - Catalog/category/search remains based on the original snapshot.
 *   - Full CJ detail is cached in memory only for the current page session.
 *   - Worker remains responsible for persistent detail caching.
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

        MAX_PRODUCTS:
            300,

        MAX_VISIBLE_PRODUCTS:
            300,

        RENDER_BATCH_SIZE:
            40,

        DEFAULT_CATEGORY:
            "General",

        DEFAULT_SORT:
            "featured",

        MAX_SEARCH_TERMS:
            12,

        CACHE_MODE:
            "default",

        INITIAL_LOAD_DELAY:
            0
    };


    /* =========================================================================
       WED2C CHECKOUT / SHARE LINKS
       ========================================================================= */

    /*
     * WED2C share links are product-specific and cannot be safely generated
     * from a CJ PID. Add each WED2C share URL here after creating it in WED2C.
     *
     * The tested example below is the Solar Garden Light product.
     */
    const WED2C = {

        STORE_URL:
            "https://prasunshop.wed2c.com",

        HY_ID:
            "kibt-fe-cj",

        /*
         * WED2C creates its own product identifiers. They are NOT the same
         * as the CJ PID, so they cannot be mathematically generated from a
         * CJ PID.
         *
         * Add a mapping here whenever a product has been imported into your
         * WED2C store and you have its jobsProductId + recommendProductId.
         *
         * This first mapping is verified from the WED2C product page supplied
         * for the Solar Garden Light product.
         */
        PRODUCTS:
            {
                /* Verified Solar Garden Light mapping. */
                "CJTY1501525": {
                    jobsProductId:
                        "1615328471586897920",

                    recommendProductId:
                        "2608221241380345100"
                },

                /* Same WED2C product, indexed by the CJ parent PID. */
                "1535868866805641216": {
                    jobsProductId:
                        "1615328471586897920",

                    recommendProductId:
                        "2608221241380345100"
                }
            },

        /* Legacy direct share-link support. */
        SHARE_LINKS:
            {
                "1535868866805641216":
                    "https://prasunshop.wed2c.com/s/2GOGScv6sKC"
            }
    };


    /* =========================================================================
       2. PLACEHOLDER IMAGE
       ========================================================================= */

    const PLACEHOLDER_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
                <rect width="600" height="600" fill="#f8fafc"/>
                <rect x="155" y="150" width="290" height="220" rx="18" fill="#e2e8f0"/>
                <circle cx="240" cy="225" r="34" fill="#cbd5e1"/>
                <path d="M180 335 L265 255 L325 315 L385 270 L430 335 Z" fill="#cbd5e1"/>
                <text x="300" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#64748b">Image Unavailable</text>
            </svg>
        `);


    /* =========================================================================
       3. STOREFRONT CATEGORIES
       ========================================================================= */

    const CATEGORY_MAP = [

        {
            label: "All Products",
            query: "",
            icon: "apps",
            terms: []
        },

        {
            label: "Solar Lights",
            query: "solar-lights",
            icon: "solar",
            terms: [
                "solar light", "solar lights", "solar lamp", "solar led",
                "solar lighting", "solar floodlight", "solar flood light",
                "solar spotlight", "solar street light", "solar street lamp",
                "solar garden light", "solar garden lamp", "solar wall light",
                "solar outdoor light", "solar pathway light", "solar lawn light",
                "solar motion light", "solar powered light", "solar powered lamp"
            ]
        },

        {
            label: "Battery",
            query: "battery",
            icon: "battery",
            terms: [
                "battery", "batteries", "rechargeable battery", "lithium battery",
                "lithium ion battery", "li-ion battery", "li ion battery",
                "battery pack", "battery bank", "power battery", "aa battery",
                "aaa battery", "18650", "21700", "lifepo4", "lithium cell",
                "rechargeable cell"
            ]
        },

        {
            label: "Chargers",
            query: "chargers",
            icon: "charger",
            terms: [
                "charger", "chargers", "charging", "charging station",
                "charging adapter", "fast charger", "fast charging",
                "quick charger", "quick charging", "wall charger", "usb charger",
                "type c charger", "type-c charger", "phone charger", "mobile charger",
                "wireless charger", "car charger", "travel charger", "power adapter",
                "usb power adapter", "ac adapter"
            ]
        },

        {
            label: "Power Bank",
            query: "power-bank",
            icon: "powerbank",
            terms: [
                "power bank", "powerbank", "power bank charger",
                "portable power bank", "portable charger", "portable battery",
                "mobile power", "emergency power bank", "power station",
                "portable power station"
            ]
        },

        {
            label: "Cables",
            query: "cables",
            icon: "cable",
            terms: [
                "cable", "cables", "usb cable", "charging cable", "data cable",
                "type c cable", "type-c cable", "usb-c cable", "usbc cable",
                "lightning cable", "micro usb cable", "micro-usb cable", "hdmi cable",
                "display cable", "displayport cable", "dp cable", "network cable",
                "ethernet cable", "lan cable", "audio cable", "aux cable", "power cable"
            ]
        },

        {
            label: "Earphones",
            query: "earphones",
            icon: "earphone",
            terms: [
                "earphone", "earphones", "earbud", "earbuds", "tws", "true wireless",
                "wireless earbud", "wireless earbuds", "bluetooth earphone",
                "bluetooth earbuds", "in-ear", "in ear", "sports earphones"
            ]
        },

        {
            label: "Headphones",
            query: "headphones",
            icon: "headphone",
            terms: [
                "headphone", "headphones", "headset", "gaming headset",
                "gaming headphones", "bluetooth headset", "wireless headset",
                "wireless headphones", "over-ear", "over ear", "on-ear", "on ear",
                "stereo headset", "computer headset", "pc headset"
            ]
        },

        {
            label: "Modem",
            query: "modem",
            icon: "modem",
            terms: [
                "modem", "4g modem", "5g modem", "lte modem", "usb modem",
                "mobile modem", "wireless modem", "cellular modem", "4g usb modem",
                "5g usb modem", "mobile broadband"
            ]
        },

        {
            label: "Routers",
            query: "routers",
            icon: "router",
            terms: [
                "router", "routers", "wifi router", "wi-fi router", "wireless router",
                "4g router", "5g router", "lte router", "network router", "mesh router",
                "wifi mesh", "wi-fi mesh", "network gateway", "wireless network"
            ]
        },

        {
            label: "Laptops",
            query: "laptops",
            icon: "laptop",
            terms: [
                "laptop", "laptops", "notebook", "notebooks", "ultrabook", "chromebook",
                "gaming laptop", "gaming notebook", "computer notebook", "portable computer",
                "netbook", "windows laptop", "macbook"
            ]
        },

        {
            label: "Power Tools",
            query: "power-tools",
            icon: "tool",
            terms: [
                "power tool", "power tools", "drill", "cordless drill", "electric drill",
                "impact driver", "impact wrench", "grinder", "angle grinder", "screwdriver",
                "electric screwdriver", "cordless screwdriver", "saw", "circular saw",
                "jigsaw", "reciprocating saw", "sander", "rotary tool", "heat gun",
                "polisher", "cutting tool", "hammer drill", "power cutter", "electric tool"
            ]
        },

        {
            label: "Camera",
            query: "camera",
            icon: "camera",
            terms: [
                "camera", "cameras", "digital camera", "security camera", "cctv",
                "ip camera", "wireless camera", "wifi camera", "wi-fi camera",
                "action camera", "webcam", "web camera", "dash camera", "dash cam",
                "surveillance camera", "outdoor camera", "indoor camera", "home camera",
                "baby camera", "doorbell camera", "camcorder"
            ]
        },

        {
            label: "Smart Home",
            query: "smart-home",
            icon: "home",
            terms: [
                "smart home", "smart device", "smart devices", "smart switch", "smart plug",
                "smart socket", "smart sensor", "smart lock", "smart bulb", "smart light",
                "smart lighting", "smart thermostat", "smart security", "smart doorbell",
                "smart camera", "wifi smart", "wi-fi smart", "home automation",
                "smart automation", "smart relay", "smart remote", "smart controller"
            ]
        }
    ];


    const KNOWN_STOREFRONT_CATEGORY_IDS = new Set(
        CATEGORY_MAP
            .map(category => category.query)
            .filter(Boolean)
    );


    /* =========================================================================
       4. STATE
       ========================================================================= */

    const state = {

        products: [],

        filteredProducts: [],

        activeCategory: "",

        searchQuery: "",

        sortBy: CONFIG.DEFAULT_SORT,

        loading: false,

        initialized: false,

        loadController: null,

        loadSequence: 0,

        renderSequence: 0,

        /* Full-detail records are kept separate from the catalog. */
        productDetailCache: new Map(),

        /* Prevent duplicate simultaneous detail requests. */
        productDetailRequests: new Map()
    };


    /* =========================================================================
       5. DOM REFERENCES
       ========================================================================= */

    const elements = {
        productList: null,
        resultsCount: null,
        searchInput: null,
        clearSearchButton: null,
        sortSelect: null,
        categoriesNav: null,
        pageHeading: null,
        liveRegion: null,
        productModal: null,
        modalBody: null,
        modalClose: null
    };


    /* =========================================================================
       6. INITIALIZATION
       ========================================================================= */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }


    function initialize() {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        cacheDOM();
        loadInitialSort();

        /* Category UI must render independently of catalog availability. */
        renderCategoryPills();

        bindEvents();
        updateClearSearchButton();
        updatePageHeading();
        renderLoadingState();

        window.setTimeout(
            () => loadCatalog(),
            CONFIG.INITIAL_LOAD_DELAY
        );
    }


    /* =========================================================================
       7. DOM CACHE
       ========================================================================= */

    function cacheDOM() {

        elements.productList = document.getElementById("product-list");
        elements.resultsCount = document.getElementById("results-count");
        elements.searchInput = document.getElementById("product-search");
        elements.clearSearchButton = document.getElementById("clear-search");
        elements.sortSelect = document.getElementById("product-sort");
        elements.categoriesNav = document.getElementById("products-categories");
        elements.pageHeading = document.getElementById("page-heading");
        elements.liveRegion = document.getElementById("aria-live-region");
        elements.productModal = document.getElementById("product-modal");
        elements.modalBody = document.getElementById("modal-body");
        elements.modalClose = document.getElementById("modal-close");
    }


    function loadInitialSort() {
        state.sortBy = elements.sortSelect?.value || CONFIG.DEFAULT_SORT;
    }


    /* =========================================================================
       8. ICONS
       ========================================================================= */

    function svgIcon(name, className = "ui-icon") {

        const safeClass = escapeHTML(className);

        const icons = {

            apps: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>`,

            solar: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path><path d="M12 20v2"></path>
                    <path d="M2 12h2"></path><path d="M20 12h2"></path>
                    <path d="m4.9 4.9 1.4 1.4"></path><path d="m17.7 17.7 1.4 1.4"></path>
                    <path d="m19.1 4.9-1.4 1.4"></path><path d="m6.3 17.7-1.4 1.4"></path>
                </svg>`,

            battery: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="7" width="17" height="10" rx="2"></rect>
                    <path d="M21 10v4"></path><path d="M8 12h7"></path>
                </svg>`,

            charger: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 2v6"></path><path d="M15 2v6"></path>
                    <path d="M7 8h10"></path><path d="M12 8v14"></path>
                </svg>`,

            powerbank: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <path d="M8 12h8"></path><path d="M12 8v8"></path>
                </svg>`,

            cable: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3v5"></path><path d="M17 16v5"></path>
                    <path d="M7 8c0 5 10 3 10 8"></path><path d="M5 3h4"></path><path d="M15 21h4"></path>
                </svg>`,

            earphone: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 13a4 4 0 1 1 4-4v7"></path><path d="M17 13a4 4 0 1 0-4-4v7"></path>
                </svg>`,

            headphone: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 15v-3a8 8 0 0 1 16 0v3"></path>
                    <path d="M4 15h3v5H5a1 1 0 0 1-1-1z"></path>
                    <path d="M20 15h-3v5h2a1 1 0 0 1-1-1z"></path>
                </svg>`,

            modem: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="9" width="16" height="9" rx="2"></rect>
                    <path d="M8 13h.01"></path><path d="M12 13h.01"></path><path d="M16 13h.01"></path>
                    <path d="M9 6h6"></path>
                </svg>`,

            router: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="10" width="18" height="8" rx="2"></rect>
                    <path d="M8 10V7"></path><path d="M16 10V7"></path>
                    <path d="M6 14h.01"></path><path d="M10 14h.01"></path><path d="M14 14h.01"></path>
                </svg>`,

            laptop: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="4" width="14" height="11" rx="1.5"></rect>
                    <path d="M3 19h18"></path><path d="M8 19l1-3h6l1 3"></path>
                </svg>`,

            tool: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 6a5 5 0 0 0-7 7l-4 4 4 4 4-4a5 5 0 0 0 7-7"></path>
                    <path d="m13 11 4 4"></path>
                </svg>`,

            camera: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h4l2-2h4l2 2h4v12H4z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                </svg>`,

            home: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 11 12 4l9 7"></path><path d="M5 10v10h14V10"></path>
                    <path d="M9 20v-5h6v5"></path>
                </svg>`,

            category: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>`,

            eye: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
                    <circle cx="12" cy="12" r="2.5"></circle>
                </svg>`,

            cart: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="20" r="1"></circle><circle cx="19" cy="20" r="1"></circle>
                    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"></path>
                    <path d="M16 4v5"></path><path d="M13.5 6.5h5"></path>
                </svg>`,

            check: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 4 4L19 6"></path>
                </svg>`,

            inventory: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16v13H4z"></path><path d="M8 7V4h8v3"></path><path d="M8 11h8"></path>
                </svg>`,

            refresh: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0 1 4"></path><path d="M20 4v7h-7"></path>
                </svg>`,

            error: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path>
                </svg>`,

            star: `
                <svg class="${safeClass}" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"></path>
                </svg>`
        };

        return icons[name] || icons.category;
    }


    function categoryIcon(category) {

        const label = String(category?.label || "").toLowerCase();

        if (label.includes("solar")) return "solar";
        if (label.includes("battery")) return "battery";
        if (label.includes("charger")) return "charger";
        if (label.includes("power bank")) return "powerbank";
        if (label.includes("cable")) return "cable";
        if (label.includes("earphone")) return "earphone";
        if (label.includes("headphone")) return "headphone";
        if (label.includes("modem")) return "modem";
        if (label.includes("router")) return "router";
        if (label.includes("laptop")) return "laptop";
        if (label.includes("power tool")) return "tool";
        if (label.includes("camera")) return "camera";
        if (label.includes("smart")) return "home";

        return "apps";
    }


    /* =========================================================================
       9. EVENTS
       ========================================================================= */

    function bindEvents() {

        elements.searchInput?.addEventListener("input", handleSearch);

        elements.searchInput?.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    clearSearch();
                }
            }
        );

        elements.clearSearchButton?.addEventListener("click", clearSearch);

        elements.sortSelect?.addEventListener(
            "change",
            event => {
                state.sortBy = event.target?.value || CONFIG.DEFAULT_SORT;
                applyFiltersAndRender();
            }
        );

        elements.categoriesNav?.addEventListener("click", handleCategoryClick);
        elements.productList?.addEventListener("click", handleProductGridClick);
        elements.modalClose?.addEventListener("click", closeProductModal);

        elements.productModal?.addEventListener(
            "click",
            event => {
                if (event.target === elements.productModal) {
                    closeProductModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape" &&
                    elements.productModal?.classList.contains("is-open")
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

        if (!elements.categoriesNav) {
            console.warn("[PRASUN SHOP] #products-categories not found.");
            return;
        }

        /* Always render the static category map, regardless of catalog state. */
        elements.categoriesNav.innerHTML = CATEGORY_MAP
            .map(category => {

                const active =
                    category.query === state.activeCategory;

                return `
                    <button
                        type="button"
                        class="category-pill${active ? " active" : ""}"
                        data-query="${escapeHTML(category.query)}"
                        aria-pressed="${active ? "true" : "false"}"
                    >
                        ${svgIcon(
                            category.icon || categoryIcon(category),
                            "ui-icon ui-icon-sm"
                        )}
                        <span>${escapeHTML(category.label)}</span>
                    </button>
                `;
            })
            .join("");
    }


    function handleCategoryClick(event) {

        const button = event.target.closest(".category-pill");

        if (!button) {
            return;
        }

        state.activeCategory = String(button.dataset.query || "").trim();
        state.searchQuery = "";

        if (elements.searchInput) {
            elements.searchInput.value = "";
        }

        updateClearSearchButton();
        highlightCategory();
        applyFiltersAndRender();
    }


    function highlightCategory() {

        elements.categoriesNav?.querySelectorAll(".category-pill").forEach(button => {

            const active =
                String(button.dataset.query || "") === state.activeCategory;

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }


    function getActiveCategory() {
        return CATEGORY_MAP.find(category => category.query === state.activeCategory) || CATEGORY_MAP[0];
    }


    /* =========================================================================
       11. CATALOG LOAD
       ========================================================================= */

    async function loadCatalog() {

        cancelCurrentLoad();

        state.loading = true;

        const controller = new AbortController();
        state.loadController = controller;

        const loadId = ++state.loadSequence;

        renderLoadingState();

        try {

            const endpoint = buildCatalogEndpoint();

            console.info("[PRASUN SHOP] Loading catalog:", endpoint);

            const response = await fetch(endpoint, {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: CONFIG.CACHE_MODE,
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Product service returned HTTP ${response.status}.`);
            }

            const data = await parseJsonResponse(response);

            if (data?.success === false) {
                throw new Error(
                    data?.error ||
                    data?.message ||
                    "Product service returned an error."
                );
            }

            const rawProducts = extractProducts(data);

            console.info(
                "[PRASUN SHOP] Worker returned:",
                rawProducts.length,
                "products"
            );

            if (loadId !== state.loadSequence) {
                return;
            }

            const normalized = deduplicateProducts(rawProducts)
                .map(normalizeProduct)
                .filter(Boolean);

            state.products = normalized.slice(0, CONFIG.MAX_PRODUCTS);

            console.info(
                "[PRASUN SHOP] Usable storefront products:",
                state.products.length
            );

            if (!state.products.length) {

                const count = Number(
                    data?.count ||
                    data?.totalProducts ||
                    data?.totalMatches ||
                    0
                );

                throw new Error(
                    count > 0
                        ? `The Worker reports ${count} products, but none could be normalized.`
                        : "The Worker returned an empty catalog. Please synchronize the curated CJ catalog first."
                );
            }

            applyFiltersAndRender();

        } catch (error) {

            if (loadId !== state.loadSequence) {
                return;
            }

            console.error("[PRASUN SHOP] Catalog loading failed:", error);

            renderErrorState(
                error?.name === "AbortError"
                    ? "The catalog request was cancelled."
                    : error?.message || "Unable to load products."
            );

        } finally {

            if (loadId === state.loadSequence) {
                state.loading = false;
                state.loadController = null;
            }
        }
    }


    function cancelCurrentLoad() {

        if (state.loadController) {
            try {
                state.loadController.abort();
            } catch {
                /* Ignore. */
            }
        }

        state.loadController = null;
    }


    function buildCatalogEndpoint() {
        return `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;
    }


    function buildProductsUrl(params = {}) {

        const url = new URL(
            CONFIG.PRODUCTS_ENDPOINT,
            CONFIG.API_BASE
        );

        Object.entries(params).forEach(([key, value]) => {
            if (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            ) {
                url.searchParams.set(key, String(value));
            }
        });

        return url.toString();
    }


    async function parseJsonResponse(response) {
        try {
            return await response.json();
        } catch {
            throw new Error("Product service returned invalid JSON.");
        }
    }


    async function fetchJSON(url, options = {}) {

        const timeout = Number(options.timeout) || CONFIG.REQUEST_TIMEOUT;
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeout);

        try {

            const response = await fetch(url, {
                method: options.method || "GET",
                headers: {
                    Accept: "application/json",
                    ...(options.headers || {})
                },
                cache: options.cache || CONFIG.CACHE_MODE,
                credentials: "omit",
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Product service returned HTTP ${response.status}.`);
            }

            return await response.json();

        } finally {
            window.clearTimeout(timer);
        }
    }


    /* =========================================================================
       12. RESPONSE EXTRACTION
       ========================================================================= */

    function extractProducts(data) {

        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.products)) return data.products;
        if (Array.isArray(data?.data?.products)) return data.data.products;
        if (Array.isArray(data?.data?.items)) return data.data.items;
        if (Array.isArray(data?.data?.list)) return data.data.list;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.list)) return data.list;
        if (Array.isArray(data?.results)) return data.results;

        return [];
    }


    /* =========================================================================
       13. PRODUCT IDENTITY / DEDUPLICATION
       ========================================================================= */

    function getProductIdentity(product) {

        const value =
            product?.pid ??
            product?.cj_id ??
            product?.productId ??
            product?.id ??
            product?.sku ??
            "";

        return String(value).trim().toLowerCase();
    }


    function deduplicateProducts(products) {

        const map = new Map();

        for (const product of Array.isArray(products) ? products : []) {

            if (!product || typeof product !== "object") {
                continue;
            }

            const identity = getProductIdentity(product);

            if (!identity) {
                continue;
            }

            if (!map.has(identity)) {
                map.set(identity, product);
            } else {
                map.set(
                    identity,
                    mergeProductRecords(map.get(identity), product)
                );
            }
        }

        return [...map.values()];
    }


    function mergeProductRecords(first, second) {

        const result = {
            ...(first || {}),
            ...(second || {})
        };

        const preferredFields = [
            "title", "name", "description", "category", "categoryName",
            "oneCategoryName", "twoCategoryName", "threeCategoryName",
            "categoryPath", "categoryId", "image", "originalImage", "sku", "price", "quantity"
        ];

        for (const field of preferredFields) {

            const firstValue = first?.[field];
            const secondValue = second?.[field];

            const firstPresent =
                typeof firstValue === "string"
                    ? firstValue.trim().length > 0
                    : firstValue !== null && firstValue !== undefined && firstValue !== "";

            const secondPresent =
                typeof secondValue === "string"
                    ? secondValue.trim().length > 0
                    : secondValue !== null && secondValue !== undefined && secondValue !== "";

            if (firstPresent && !secondPresent) {
                result[field] = firstValue;
            }
        }

        if (!Array.isArray(result.images) && Array.isArray(first?.images)) {
            result.images = first.images;
        }

        if (!Array.isArray(result.originalImages) && Array.isArray(first?.originalImages)) {
            result.originalImages = first.originalImages;
        }

        if (!Array.isArray(result.variants) && Array.isArray(first?.variants)) {
            result.variants = first.variants;
        }

        if (!Array.isArray(result.storeCategories) && Array.isArray(first?.storeCategories)) {
            result.storeCategories = first.storeCategories;
        }

        return result;
    }


    /* =========================================================================
       14. SEARCH
       ========================================================================= */

    function handleSearch(event) {

        state.searchQuery = normalizeSearchText(event.target?.value || "");

        if (state.searchQuery) {
            state.activeCategory = "";
            highlightCategory();
        }

        updateClearSearchButton();
        applyFiltersAndRender();
    }


    function clearSearch() {

        if (elements.searchInput) {
            elements.searchInput.value = "";
        }

        state.searchQuery = "";
        updateClearSearchButton();
        applyFiltersAndRender();
        elements.searchInput?.focus();
    }


    function updateClearSearchButton() {

        if (!elements.clearSearchButton) return;
        elements.clearSearchButton.hidden = !state.searchQuery;
    }


    /* =========================================================================
       15. SEARCH TEXT
       ========================================================================= */

    function buildSearchText(product) {

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
            product?.categoryId,
            product?.sku,
            product?.pid,
            product?.id,
            product?.cj_id,
            product?.productType,
            product?.productNameEn,
            product?.productName,
            product?.cj?.productType,
            product?.cj?.supplierName,
            product?.cj?.sku,
            product?.cj?.categoryId,
            product?.cj?.categoryName
        ];

        if (Array.isArray(product?.storeCategories)) {
            values.push(...product.storeCategories);
        }

        if (Array.isArray(product?.categories)) {
            values.push(...product.categories);
        }

        if (Array.isArray(product?.tags)) {
            values.push(...product.tags);
        }

        return normalizeSearchText(
            values
                .map(value => stripHtml(value))
                .filter(Boolean)
                .join(" ")
        );
    }


    function normalizeSearchText(value) {

        return String(value || "")
            .toLowerCase()
            .replace(/&/g, " and ")
            .replace(/[_\-\/]+/g, " ")
            .replace(/[^a-z0-9\s]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }


    /* =========================================================================
       16. CATEGORY FILTERING
       ========================================================================= */

    function matchesCategory(product, category) {

        if (!category || category.query === "") {
            return true;
        }

        const query = String(category.query).trim().toLowerCase();
        const titleText = normalizeSearchText([
            product?.title,
            product?.name,
            product?.productNameEn,
            product?.productName
        ].join(" "));

        const categoryText = normalizeSearchText([
            product?.category,
            product?.categoryName,
            product?.oneCategoryName,
            product?.twoCategoryName,
            product?.threeCategoryName,
            product?.categoryPath
        ].join(" "));

        /*
         * Only exact known storefront IDs are trusted. CJ taxonomy values such
         * as "solar" or "home-improvement" never substitute for our IDs.
         */
        const explicit = normalizeStoreCategories(product?.storeCategories)
            .filter(value => KNOWN_STOREFRONT_CATEGORY_IDS.has(value));

        if (explicit.includes(query)) {
            return true;
        }

        switch (query) {

            case "solar-lights":
                return (
                    /\bsolar\b/.test(titleText) &&
                    (
                        /\blight\b/.test(titleText) ||
                        /\blamp\b/.test(titleText) ||
                        /\bled\b/.test(titleText) ||
                        /\bfloodlight\b/.test(titleText) ||
                        /\bspotlight\b/.test(titleText) ||
                        /\bstreet\b/.test(titleText) ||
                        /\bgarden\b/.test(titleText) ||
                        /\bwall\b/.test(titleText) ||
                        /\boutdoor\b/.test(titleText) ||
                        /\bpathway\b/.test(titleText) ||
                        /\bmotion\b/.test(titleText)
                    )
                ) ||
                (
                    /\bsolar\b/.test(categoryText) &&
                    (/\blamp\b/.test(categoryText) || /\blight/.test(categoryText))
                );

            case "battery":
                return (
                    /\bbattery\b/.test(titleText) ||
                    /\bbatteries\b/.test(titleText) ||
                    /\b18650\b/.test(titleText) ||
                    /\b21700\b/.test(titleText) ||
                    /\blifepo4\b/.test(titleText) ||
                    (/\blithium\b/.test(titleText) && /\bcell\b/.test(titleText)) ||
                    /\bbattery\b/.test(categoryText)
                );

            case "chargers":
                return (
                    /\bcharger\b/.test(titleText) ||
                    /\bcharging\b/.test(titleText) ||
                    /\bpower\s*adapter\b/.test(titleText) ||
                    /\bcharger\b/.test(categoryText)
                );

            case "power-bank":
                return (
                    /\bpower[\s-]*bank\b/.test(titleText) ||
                    /\bpowerbank\b/.test(titleText) ||
                    (/\bportable\b/.test(titleText) && (
                        /\bpower\b/.test(titleText) ||
                        /\bcharger\b/.test(titleText) ||
                        /\bbattery\b/.test(titleText)
                    )) ||
                    /\bpower[\s-]*bank\b/.test(categoryText)
                );

            case "cables":
                return (
                    /\bcables?\b/.test(titleText) ||
                    /\busb[\s-]*c\b/.test(titleText) ||
                    /\btype[\s-]*c\b/.test(titleText) ||
                    /\bhdmi\b/.test(titleText) ||
                    /\bethernet\b/.test(titleText) ||
                    /\bdisplayport\b/.test(titleText)
                );

            case "earphones":
                return (
                    /\bearphones?\b/.test(titleText) ||
                    /\bearbuds?\b/.test(titleText) ||
                    /\btws\b/.test(titleText) ||
                    /\btrue\s+wireless\b/.test(titleText)
                );

            case "headphones":
                return (
                    /\bheadphones?\b/.test(titleText) ||
                    /\bheadset\b/.test(titleText) ||
                    /\bover[\s-]?ear\b/.test(titleText) ||
                    /\bon[\s-]?ear\b/.test(titleText)
                );

            case "modem":
                return /\bmodem\b/.test(titleText);

            case "routers":
                return (
                    /\brouter\b/.test(titleText) ||
                    /\bmesh\s+router\b/.test(titleText)
                );

            case "laptops":
                return (
                    /\blaptops?\b/.test(titleText) ||
                    /\bnotebooks?\b/.test(titleText) ||
                    /\bchromebook\b/.test(titleText) ||
                    /\bultrabook\b/.test(titleText) ||
                    /\bmacbook\b/.test(titleText)
                );

            case "power-tools":
                return (
                    /\bdrill\b/.test(titleText) ||
                    /\bgrinder\b/.test(titleText) ||
                    /\bscrewdriver\b/.test(titleText) ||
                    /\bwrench\b/.test(titleText) ||
                    /\bsaw\b/.test(titleText) ||
                    /\bsander\b/.test(titleText) ||
                    /\bpower[\s-]*tool\b/.test(titleText) ||
                    /\bimpact\s+driver\b/.test(titleText) ||
                    /\bimpact\s+wrench\b/.test(titleText) ||
                    /\bhammer\s+drill\b/.test(titleText) ||
                    /\brotary\s+tool\b/.test(titleText) ||
                    /\bheat\s+gun\b/.test(titleText)
                );

            case "camera":
                return (
                    /\bcameras?\b/.test(titleText) ||
                    /\bcctv\b/.test(titleText) ||
                    /\bwebcam\b/.test(titleText) ||
                    /\bdash[\s-]*cam\b/.test(titleText) ||
                    /\bsurveillance\b/.test(titleText) ||
                    /\bsecurity\s+camera\b/.test(titleText) ||
                    /\bip\s+camera\b/.test(titleText) ||
                    /\baction\s+camera\b/.test(titleText)
                );

            case "smart-home":
                return (
                    (
                        /\bsmart\b/.test(titleText) &&
                        (
                            /\bhome\b/.test(titleText) ||
                            /\bplug\b/.test(titleText) ||
                            /\bswitch\b/.test(titleText) ||
                            /\bsocket\b/.test(titleText) ||
                            /\bbulb\b/.test(titleText) ||
                            /\bsensor\b/.test(titleText) ||
                            /\block\b/.test(titleText) ||
                            /\brelay\b/.test(titleText)
                        )
                    ) ||
                    /\bhome\s+automation\b/.test(titleText)
                );

            default:
                break;
        }

        /* Generic term fallback after category-specific rules. */
        for (const term of category.terms || []) {
            const normalizedTerm = normalizeSearchText(term);

            if (!normalizedTerm) continue;

            if (titleText.includes(normalizedTerm)) return true;
            if (categoryText.includes(normalizedTerm)) return true;
        }

        return false;
    }


    function normalizeStoreCategories(categories) {

        if (!Array.isArray(categories)) {
            return [];
        }

        return categories
            .map(value => normalizeSearchText(value))
            .filter(Boolean);
    }


    /* =========================================================================
       17. FILTER + SORT + RENDER
       ========================================================================= */

    function applyFiltersAndRender() {

        let products = [...state.products];

        if (state.searchQuery) {

            const terms = state.searchQuery
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, CONFIG.MAX_SEARCH_TERMS);

            products = products.filter(product => {
                const text = buildSearchText(product);
                return terms.every(term => text.includes(term));
            });
        }

        if (state.activeCategory) {

            const category = getActiveCategory();

            products = products.filter(product =>
                matchesCategory(product, category)
            );
        }

        products.sort(compareProducts);

        state.filteredProducts = products.slice(
            0,
            CONFIG.MAX_VISIBLE_PRODUCTS
        );

        updatePageHeading();
        updateResultsCount();

        if (!state.filteredProducts.length) {

            let message = "No products are currently available.";

            if (state.searchQuery) {
                message = `No products found for "${state.searchQuery}".`;
            } else if (state.activeCategory) {
                message = `No products found in "${getActiveCategory().label}".`;
            }

            renderEmptyState(message);
            return;
        }

        renderProductGrid();
    }


    /* =========================================================================
       18. SORTING
       ========================================================================= */

    function compareProducts(a, b) {

        const sort = normalizeSortValue(state.sortBy);

        const priceA = Number(a?.price) || 0;
        const priceB = Number(b?.price) || 0;

        const nameA = String(a?.name || a?.title || "");
        const nameB = String(b?.name || b?.title || "");

        if (sort === "priceasc") return priceA - priceB;
        if (sort === "pricedesc") return priceB - priceA;
        if (sort === "nameaz") return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
        if (sort === "nameza") return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });

        const stockA = Number(a?.quantity) > 0;
        const stockB = Number(b?.quantity) > 0;

        if (stockA && !stockB) return -1;
        if (!stockA && stockB) return 1;

        const listedA = Number(a?.listedNum || a?.cj?.listedNum || 0);
        const listedB = Number(b?.listedNum || b?.cj?.listedNum || 0);

        if (listedA !== listedB) {
            return listedB - listedA;
        }

        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    }


    function normalizeSortValue(value) {

        const sort = String(value || CONFIG.DEFAULT_SORT)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        if (sort.includes("lowtohigh") || sort.includes("priceasc")) return "priceasc";
        if (sort.includes("hightolow") || sort.includes("pricedesc")) return "pricedesc";
        if (sort.includes("atoz") || sort.includes("nameaz")) return "nameaz";
        if (sort.includes("ztoa") || sort.includes("nameza")) return "nameza";

        return "featured";
    }


    /* =========================================================================
       19. PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(raw) {

        if (!raw || typeof raw !== "object") {
            return null;
        }

        const pid = cleanString(
            raw.pid ??
            raw.productId ??
            raw.id ??
            raw.cj_id
        );

        const id = cleanString(
            raw.id ??
            raw.pid ??
            raw.productId ??
            raw.cj_id ??
            raw.sku
        );

        const name = cleanString(
            raw.title ??
            raw.name ??
            raw.productNameEn ??
            raw.productName ??
            raw.nameEn ??
            "CJ Product"
        );

        if (!id || !name) {
            return null;
        }

        const price = normalizeProductPrice(raw);
        const quantity = normalizeProductQuantity(raw);
        const rating = normalizeRating(raw.rating);
        const images = getGalleryImages(raw);
        const originalImages = collectOriginalImages(raw);

        const image =
            normalizeImageUrl(raw.image) ||
            images[0] ||
            (originalImages[0] ? buildProxyUrl(originalImages[0]) : "") ||
            PLACEHOLDER_IMAGE;

        const variants = normalizeVariants(raw.variants);

        const category = cleanString(
            raw.category ||
            raw.categoryName ||
            raw.threeCategoryName ||
            raw.twoCategoryName ||
            raw.oneCategoryName ||
            raw.cj?.categoryName ||
            CONFIG.DEFAULT_CATEGORY
        );

        const baseRecord = {
            ...raw,
            id,
            pid,
            title: name,
            name,
            productNameEn: cleanString(raw.productNameEn),
            category,
            categoryName: cleanString(raw.categoryName || raw.cj?.categoryName),
            oneCategoryName: cleanString(raw.oneCategoryName || raw.cj?.oneCategoryName),
            twoCategoryName: cleanString(raw.twoCategoryName || raw.cj?.twoCategoryName),
            threeCategoryName: cleanString(raw.threeCategoryName || raw.cj?.threeCategoryName),
            categoryPath: cleanString(raw.categoryPath),
            categoryId: cleanString(raw.categoryId || raw.cj?.categoryId),
            description: String(raw.description || "")
        };

        /* Derive storefront categories from OUR rules, never CJ taxonomy. */
        const derivedStoreCategories = CATEGORY_MAP
            .filter(categoryDefinition =>
                categoryDefinition.query &&
                matchesCategory(baseRecord, categoryDefinition)
            )
            .map(categoryDefinition => categoryDefinition.query);

        return {
            ...raw,
            ...baseRecord,
            id,
            pid,
            cj_id: cleanString(raw.cj_id || raw.cjId || pid),
            sku: cleanString(raw.sku || raw.productSku || raw.cj?.sku),
            productSku: cleanString(raw.productSku || raw.sku || raw.cj?.sku),
            title: name,
            name,
            description: String(raw.description || ""),
            category,
            categoryName: cleanString(raw.categoryName || raw.cj?.categoryName),
            oneCategoryName: cleanString(raw.oneCategoryName || raw.cj?.oneCategoryName),
            twoCategoryName: cleanString(raw.twoCategoryName || raw.cj?.twoCategoryName),
            threeCategoryName: cleanString(raw.threeCategoryName || raw.cj?.threeCategoryName),
            categoryPath: cleanString(raw.categoryPath),
            categoryId: cleanString(raw.categoryId || raw.cj?.categoryId),
            storeCategories: derivedStoreCategories.length
                ? derivedStoreCategories
                : normalizeStoreCategories(raw.storeCategories)
                    .filter(categoryId => KNOWN_STOREFRONT_CATEGORY_IDS.has(categoryId)),
            price,
            quantity,
            rating,
            image,
            images,
            originalImage: originalImages[0] || "",
            originalImages,
            variants,
            listedNum: Number(raw.listedNum || raw.cj?.listedNum || 0),
            source: raw.source || "CJ Dropshipping"
        };
    }


    function normalizeProductPrice(raw) {

        let value =
            raw?.price ??
            raw?.salePrice ??
            raw?.sellPrice ??
            raw?.unitPrice ??
            raw?.nowPrice ??
            raw?.discountPrice ??
            0;

        if (value && typeof value === "object") {
            value = value.amount ?? value.value ?? value.price ?? value.raw ?? 0;
        }

        return normalizePrice(value);
    }


    function normalizeProductQuantity(raw) {

        const candidates = [
            raw?.quantity,
            raw?.inventory,
            raw?.availableQuantity,
            raw?.totalInventory,
            raw?.warehouseInventoryNum,
            raw?.totalVerifiedInventory,
            raw?.totalUnVerifiedInventory,
            raw?.cj?.totalInventory,
            raw?.cj?.warehouseInventoryNum
        ];

        for (const value of candidates) {

            if (value === undefined || value === null || value === "") {
                continue;
            }

            return normalizeInventory(value);
        }

        if (Array.isArray(raw?.variants)) {
            return raw.variants.reduce(
                (total, variant) =>
                    total + normalizeInventory(
                        variant?.inventory ??
                        variant?.quantity ??
                        variant?.totalInventory
                    ),
                0
            );
        }

        return 0;
    }


    function normalizeVariants(variants) {

        if (!Array.isArray(variants)) {
            return [];
        }

        return variants
            .map(variant => {

                if (!variant || typeof variant !== "object") {
                    return null;
                }

                return {
                    ...variant,
                    vid: cleanString(variant?.vid || variant?.variantId || variant?.id),
                    pid: cleanString(variant?.pid || variant?.productId),
                    sku: cleanString(variant?.sku || variant?.variantSku || variant?.variantKey),
                    name: cleanString(
                        variant?.name ||
                        variant?.variantNameEn ||
                        variant?.variantName ||
                        variant?.variantKey ||
                        "Default"
                    ),
                    variantKey: cleanString(variant?.variantKey),
                    variantStandard: cleanString(variant?.variantStandard),
                    price: normalizePrice(
                        variant?.price ??
                        variant?.sellPrice
                    ),
                    costPrice: normalizePrice(variant?.costPrice),
                    inventory: normalizeInventory(
                        variant?.inventory ??
                        variant?.quantity ??
                        variant?.totalInventory
                    ),
                    quantity: normalizeInventory(
                        variant?.quantity ??
                        variant?.inventory ??
                        variant?.totalInventory
                    ),
                    image: normalizeImageUrl(
                        variant?.image ||
                        variant?.variantImage
                    )
                };
            })
            .filter(Boolean);
    }


    /* =========================================================================
       20. IMAGE HANDLING
       ========================================================================= */

    function normalizeImageUrl(value) {

        if (!value || typeof value !== "string") {
            return "";
        }

        let url = value.trim();

        if (!url) return "";
        if (url.startsWith("data:image/")) return url;
        if (url.startsWith("//")) url = `https:${url}`;

        if (/^http:\/\//i.test(url)) {
            url = url.replace(/^http:\/\//i, "https://");
        }

        if (!/^https:\/\//i.test(url)) {
            return "";
        }

        return url;
    }


    function isProxyUrl(value) {

        if (typeof value !== "string") return false;

        try {
            const url = new URL(value);
            return (
                url.origin === CONFIG.API_BASE &&
                (
                    url.pathname === CONFIG.IMAGE_PROXY_ENDPOINT ||
                    url.pathname === "/image-proxy"
                )
            );
        } catch {
            return false;
        }
    }


    function buildProxyUrl(value) {

        const normalized = normalizeImageUrl(value);

        if (!normalized) return "";
        if (normalized.startsWith("data:image/")) return normalized;
        if (isProxyUrl(normalized)) return normalized;

        return `${CONFIG.API_BASE}${CONFIG.IMAGE_PROXY_ENDPOINT}?url=${encodeURIComponent(normalized)}`;
    }


    function collectProductImageUrls(product) {

        const candidates = [];

        candidates.push(product?.image);

        if (Array.isArray(product?.images)) {
            candidates.push(...product.images);
        }

        candidates.push(product?.originalImage);

        if (Array.isArray(product?.originalImages)) {
            candidates.push(...product.originalImages);
        }

        candidates.push(
            product?.bigImage,
            product?.productImage,
            product?.productImg,
            product?.mainImage
        );

        if (Array.isArray(product?.productImageSet)) {
            candidates.push(...product.productImageSet);
        }

        if (typeof product?.productImageSet === "string") {
            candidates.push(...product.productImageSet.split(","));
        }

        if (Array.isArray(product?.imageList)) {
            for (const item of product.imageList) {
                if (typeof item === "string") {
                    candidates.push(item);
                } else if (item && typeof item === "object") {
                    candidates.push(
                        item.url,
                        item.imageUrl,
                        item.image_url,
                        item.src,
                        item.bigImage,
                        item.productImage
                    );
                }
            }
        }

        if (Array.isArray(product?.variants)) {
            for (const variant of product.variants) {
                candidates.push(
                    variant?.image,
                    variant?.variantImage,
                    variant?.productImage
                );
            }
        }

        return [
            ...new Set(
                candidates
                    .map(normalizeImageUrl)
                    .filter(Boolean)
            )
        ];
    }


    function collectOriginalImages(product) {

        const candidates = [
            product?.originalImage
        ];

        if (Array.isArray(product?.originalImages)) {
            candidates.push(...product.originalImages);
        }

        candidates.push(
            product?.bigImage,
            product?.productImage,
            product?.productImg,
            product?.mainImage
        );

        if (Array.isArray(product?.productImageSet)) {
            candidates.push(...product.productImageSet);
        }

        if (typeof product?.productImageSet === "string") {
            candidates.push(...product.productImageSet.split(","));
        }

        return [
            ...new Set(
                candidates
                    .map(normalizeImageUrl)
                    .filter(Boolean)
            )
        ];
    }


    function getGalleryImages(product) {

        return collectProductImageUrls(product)
            .map(buildProxyUrl)
            .filter(Boolean)
            .filter((value, index, array) => array.indexOf(value) === index);
    }


    /* =========================================================================
       21. PRODUCT GRID
       ========================================================================= */

    function renderProductGrid() {

        if (!elements.productList) return;

        const products = state.filteredProducts;
        const renderId = ++state.renderSequence;

        elements.productList.innerHTML = "";
        setLoadingState(true);

        let index = 0;

        const renderBatch = () => {

            if (renderId !== state.renderSequence) return;

            const fragment = document.createDocumentFragment();
            const end = Math.min(
                index + CONFIG.RENDER_BATCH_SIZE,
                products.length
            );

            for (; index < end; index++) {

                const element = createProductCardElement(products[index]);

                if (element) {
                    fragment.appendChild(element);
                }
            }

            elements.productList.appendChild(fragment);

            if (index < products.length) {
                window.requestAnimationFrame(renderBatch);
            } else {
                setLoadingState(false);
                attachProductImageFallbacks();
            }
        };

        renderBatch();
    }


    function createProductCardElement(product) {

        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderProductCard(product);

        return wrapper.firstElementChild || null;
    }


    function getWed2cProductUrl(product) {

        if (!product || typeof product !== "object") {
            return "";
        }

        /*
         * 1. If the backend already supplied a WED2C URL, use it.
         */
        const direct = [
            product.wed2cUrl,
            product.wed2cShareUrl,
            product.wed2cLink,
            product.shareUrl,
            product.shareLink,
            product.externalUrl,
            product.externalLink
        ]
            .map(value => cleanString(value))
            .find(value => isSafeExternalProductUrl(value));

        if (direct) {
            return direct;
        }

        /*
         * 2. If the raw product contains WED2C identifiers, construct the
         * exact goodsDetails URL. This is the preferred format.
         */
        const jobsProductId = cleanString(
            product.jobsProductId ||
            product.wed2cJobsProductId ||
            product.wed2c?.jobsProductId ||
            product.wed2cProductId
        );

        const recommendProductId = cleanString(
            product.recommendProductId ||
            product.wed2cRecommendProductId ||
            product.wed2c?.recommendProductId
        );

        if (jobsProductId && recommendProductId) {
            return buildWED2CProductUrl(
                jobsProductId,
                recommendProductId
            );
        }

        /*
         * 3. Match by a true CJ/product SKU using our explicit WED2C map.
         */
        const skuCandidates = [
            product.sku,
            product.productSku,
            product.cj?.sku
        ]
            .map(value => cleanString(value))
            .filter(Boolean);

        for (const sku of skuCandidates) {

            const mapping = WED2C.PRODUCTS?.[sku];

            if (mapping?.jobsProductId && mapping?.recommendProductId) {
                return buildWED2CProductUrl(
                    mapping.jobsProductId,
                    mapping.recommendProductId
                );
            }
        }

        /*
         * 4. Also match the WED2C map by CJ PID / product ID when the
         * catalogue record does not expose the SKU consistently.
         */
        const productIdCandidates = [
            product.pid,
            product.id,
            product.productId,
            product.cj_id
        ]
            .map(value => cleanString(value))
            .filter(Boolean);

        for (const productId of productIdCandidates) {

            const mapping = WED2C.PRODUCTS?.[productId];

            if (mapping?.jobsProductId && mapping?.recommendProductId) {
                return buildWED2CProductUrl(
                    mapping.jobsProductId,
                    mapping.recommendProductId
                );
            }
        }

        /*
         * 5. Legacy /s/... share-link mapping.
         */
        const ids = [
            product.id,
            product.pid,
            product.productId,
            product.cj_id
        ]
            .map(value => cleanString(value))
            .filter(Boolean);

        for (const id of ids) {

            const shareLink = WED2C.SHARE_LINKS?.[id];

            if (isSafeExternalProductUrl(shareLink)) {
                return shareLink;
            }
        }

        return "";
    }


    /* Backward-compatible alias for existing public code. */
    function getWed2cShareUrl(product) {
        return getWed2cProductUrl(product);
    }


    function buildWED2CProductUrl(
        jobsProductId,
        recommendProductId
    ) {

        return (
            `${WED2C.STORE_URL}/goodsDetails` +
            `?jobsProductId=${encodeURIComponent(jobsProductId)}` +
            `&recommendProductId=${encodeURIComponent(recommendProductId)}` +
            `&hyId=${encodeURIComponent(WED2C.HY_ID)}`
        );
    }


    function isSafeExternalProductUrl(value) {

        const normalized = cleanString(value);

        if (!normalized) {
            return false;
        }

        try {

            const url = new URL(
                normalized,
                window.location.href
            );

            return (
                url.protocol === "https:" &&
                (
                    url.hostname === "prasunshop.wed2c.com" ||
                    url.hostname.endsWith(".wed2c.com")
                )
            );

        } catch {
            return false;
        }
    }


    function openWed2cProduct(product) {

        const directUrl =
            getWed2cProductUrl(product);

        const url =
            directUrl ||
            WED2C.STORE_URL;

        if (!url) {

            announce(
                "WED2C store is currently unavailable."
            );

            return false;
        }

        /*
         * Keep the customer in the same tab. WED2C then owns the rest of the
         * transaction: variant selection, cart, checkout, payment and
         * fulfillment.
         */
        window.location.href = url;

        return true;
    }

    function renderProductCard(product) {

        const productId =
            escapeHTML(product.id);

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

        const wed2cUrl =
            getWed2cProductUrl(product);

        const hasDirectWED2C =
            Boolean(wed2cUrl);

        const destinationUrl =
            wed2cUrl ||
            WED2C.STORE_URL;

        const description =
            stripHtml(
                product.description
            );

        const shortDescription =
            description.length > 105
                ? `${description.slice(0, 105)}...`
                : (
                    description ||
                    "Product information available."
                );

        const variantCount =
            Array.isArray(product.variants)
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
                    data-action="wed2c-view"
                    data-product-id="${productId}"
                    aria-label="View ${title} on WED2C"
                    title="${hasDirectWED2C ? "View product on WED2C" : "Open PRASUN SHOP on WED2C"}"
                >

                    <span class="product-badge">
                        ${svgIcon(
                            "category",
                            "ui-icon ui-icon-sm"
                        )}
                        <span>${category}</span>
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
                            data-action="wed2c-view"
                            data-product-id="${productId}"
                            title="${hasDirectWED2C ? "View product on WED2C" : "Open PRASUN SHOP on WED2C"}"
                        >
                            ${title}
                        </button>
                    </h3>

                    <p class="product-card-description">
                        ${escapeHTML(shortDescription)}
                    </p>

                    ${
                        product.rating > 0
                            ? `
                                <div
                                    class="product-rating"
                                    aria-label="Rating ${Number(product.rating).toFixed(1)} out of 5"
                                >
                                    ${svgIcon(
                                        "star",
                                        "ui-icon ui-icon-sm"
                                    )}
                                    <span>${Number(product.rating).toFixed(1)}</span>
                                </div>
                            `
                            : ""
                    }

                    ${
                        variantCount > 0
                            ? `
                                <div
                                    class="product-variant-count"
                                    aria-label="${variantCount} ${variantCount === 1 ? "variant" : "variants"} available"
                                >
                                    ${variantCount} ${variantCount === 1 ? "variant" : "variants"}
                                </div>
                            `
                            : ""
                    }

                    <div class="product-card-footer">

                        <div class="price-container">

                            <span class="product-price">
                                ${escapeHTML(
                                    formatPrice(
                                        product.price
                                    )
                                )}
                            </span>

                        </div>

                        <div class="product-actions-group">

                            <button
                                type="button"
                                class="btn-card btn-secondary view-details-btn"
                                data-action="wed2c-view"
                                data-product-id="${productId}"
                                aria-label="View ${title} on WED2C"
                            >
                                ${svgIcon(
                                    "eye",
                                    "ui-icon ui-icon-sm"
                                )}
                                <span>
                                    ${
                                        hasDirectWED2C
                                            ? "View on WED2C"
                                            : "Open WED2C Store"
                                    }
                                </span>
                            </button>

                            <button
                                type="button"
                                class="btn-card btn-primary btn-wed2c buy-now-button"
                                data-action="wed2c-buy"
                                data-product-id="${productId}"
                                data-wed2c-url="${escapeHTML(destinationUrl)}"
                                aria-label="${
                                    hasDirectWED2C
                                        ? `Buy ${title} on WED2C`
                                        : `Open PRASUN SHOP on WED2C`
                                }"
                                title="${
                                    hasDirectWED2C
                                        ? "Continue to the WED2C product page"
                                        : "Open the PRASUN SHOP WED2C store"
                                }"
                            >
                                ${svgIcon(
                                    "cart",
                                    "ui-icon ui-icon-sm"
                                )}
                                <span>
                                    ${
                                        hasDirectWED2C
                                            ? "Buy on WED2C"
                                            : "Shop on WED2C"
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
       22. GRID EVENTS / CART
       ========================================================================= */

    function handleProductGridClick(event) {

        const wed2cButton =
            event.target.closest(
                '[data-action="wed2c-view"], [data-action="wed2c-buy"]'
            );

        if (!wed2cButton) {
            return;
        }

        event.preventDefault();

        const product =
            findCatalogProductById(
                wed2cButton.dataset.productId
            );

        if (!product) {

            announce(
                "Product is no longer available."
            );

            return;
        }

        openWed2cProduct(product);
    }



    function invokeAddToCart(product) {

        if (typeof window.addToCart === "function") {

            try {
                const result = window.addToCart(product);
                return result !== false;
            } catch (error) {

                console.error("[PRASUN SHOP] addToCart failed:", error);
                announce("Unable to add this product to the cart.");
                return false;
            }
        }

        try {
            document.dispatchEvent(
                new CustomEvent("cart:add", { detail: product })
            );
            return true;
        } catch (error) {

            console.error("[PRASUN SHOP] cart event failed:", error);
            announce("Unable to add this product to the cart.");
            return false;
        }
    }


    function findCatalogProductById(id) {

        const wanted = String(id || "").trim();

        if (!wanted) return null;

        return (
            state.products.find(product => String(product?.id || "") === wanted) ||
            state.products.find(product => String(product?.pid || "") === wanted) ||
            state.products.find(product => String(product?.productId || "") === wanted) ||
            null
        );
    }


    /* =========================================================================
       23. FULL PRODUCT DETAIL LOADING
       ========================================================================= */

    async function getFullProductDetails(productId) {

        const wanted = String(productId || "").trim();

        if (!wanted) return null;

        const cached = state.productDetailCache.get(wanted);

        if (cached?.detailLoaded === true) {
            return cached;
        }

        const existingRequest = state.productDetailRequests.get(wanted);

        if (existingRequest) {
            return existingRequest;
        }

        const request = (async () => {

            try {

                const data = await fetchJSON(
                    buildProductsUrl({ pid: wanted }),
                    { timeout: CONFIG.REQUEST_TIMEOUT }
                );

                if (data?.success === false) {
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

                if (!raw || typeof raw !== "object") {
                    throw new Error("Product detail response was empty.");
                }

                const normalized = normalizeProduct(raw);

                if (!normalized) {
                    throw new Error("Product detail could not be normalized.");
                }

                normalized.detailLoaded = true;
                normalized.detailFetchedAt = new Date().toISOString();

                /*
                 * IMPORTANT:
                 * Store full detail separately. Do NOT merge it into
                 * state.products or state.filteredProducts.
                 */
                state.productDetailCache.set(wanted, normalized);

                return normalized;

            } catch (error) {

                console.warn(
                    "[PRASUN SHOP] Full product detail lookup failed:",
                    error
                );

                /* Use the existing lightweight catalog record as fallback. */
                return findCatalogProductById(wanted);
            }
        })();

        state.productDetailRequests.set(wanted, request);

        try {
            return await request;
        } finally {
            state.productDetailRequests.delete(wanted);
        }
    }


    /* Keep the public/helper name for compatibility with existing code. */
    async function findProductById(id) {
        return getFullProductDetails(id);
    }


    /* =========================================================================
       24. IMAGE FALLBACK
       ========================================================================= */

    function attachProductImageFallbacks() {

        elements.productList?.querySelectorAll(".product-image").forEach(image => {

            if (image.dataset.fallbackBound === "true") {
                return;
            }

            image.dataset.fallbackBound = "true";
            image.addEventListener("error", handleImageError);
        });
    }


    function handleImageError(event) {

        const image = event.currentTarget;

        if (!image) return;

        const original = normalizeImageUrl(
            image.dataset.originalImage || ""
        );

        if (original && !image.dataset.originalAttempted) {

            image.dataset.originalAttempted = "true";

            const proxy = buildProxyUrl(original);

            if (proxy && proxy !== image.src) {
                image.src = proxy;
                return;
            }
        }

        if (!image.dataset.placeholderUsed) {
            image.dataset.placeholderUsed = "true";
            image.src = PLACEHOLDER_IMAGE;
        }
    }


    /* =========================================================================
       25. PRODUCT MODAL
       ========================================================================= */

    async function openProductModal(productId) {

        const product =
            findCatalogProductById(
                productId
            );

        if (!product) {
            announce(
                "Product is no longer available."
            );
            return;
        }

        /*
         * WED2C is now the commerce engine.
         * Send customers to the direct WED2C product page when the mapping
         * exists; otherwise open the PRASUN SHOP WED2C storefront.
         */
        openWed2cProduct(product);
    }



    function renderProductModalContent(product) {

        const images = getGalleryImages(product);

        const primaryImage =
            images[0] ||
            buildProxyUrl(product.originalImage) ||
            product.image ||
            PLACEHOLDER_IMAGE;

        const title = escapeHTML(product.name || product.title || "CJ Product");
        const category = escapeHTML(product.category || CONFIG.DEFAULT_CATEGORY);
        const quantity = Number(product.quantity) || 0;

        const description =
            sanitizeDescription(product.description) ||
            "<p>Product description is currently unavailable.</p>";

        const variants = Array.isArray(product.variants)
            ? product.variants
            : [];

        const galleryHtml = images.length > 1
            ? `
                <div class="modal-gallery">
                    ${images.map((image, index) => `
                        <button
                            type="button"
                            class="modal-gallery-thumb ${index === 0 ? "is-active" : ""}"
                            data-gallery-image="${escapeHTML(image)}"
                            aria-label="View product image ${index + 1}"
                        >
                            <img
                                src="${escapeHTML(image)}"
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerpolicy="no-referrer"
                            >
                        </button>
                    `).join("")}
                </div>
            `
            : "";

        const variantsHtml = variants.length > 0
            ? `
                <div class="product-variants-info">
                    <strong>${variants.length === 1 ? "Variant:" : "Variants:"}</strong>
                    <span>${variants.length} available</span>
                </div>
            `
            : "";

        elements.modalBody.innerHTML = `
            <div class="modal-image-column">
                <img
                    id="main-modal-img"
                    src="${escapeHTML(primaryImage)}"
                    alt="${title}"
                    class="modal-product-img"
                    loading="eager"
                    decoding="async"
                    referrerpolicy="no-referrer"
                >
                ${galleryHtml}
            </div>

            <div class="modal-details">
                <span class="product-category-tag">${category}</span>

                <h2 id="modal-title" class="modal-product-title">
                    ${title}
                </h2>

                <div class="modal-product-price-row">
                    <strong class="modal-product-price">
                        ${formatPrice(product.price)}
                    </strong>

                    <span class="modal-product-stock">
                        ${quantity > 0 ? `In Stock: ${quantity}` : "Out of Stock"}
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
                    ${quantity <= 0 ? "disabled" : ""}
                >
                    ${svgIcon(quantity > 0 ? "cart" : "inventory", "ui-icon ui-icon-sm")}
                    <span>${quantity > 0 ? "Add to Cart" : "Out of Stock"}</span>
                </button>
            </div>
        `;

        const mainImage = document.getElementById("main-modal-img");

        if (mainImage) {

            mainImage.addEventListener("error", () => {

                const original = normalizeImageUrl(
                    product.originalImage || ""
                );

                if (original && !mainImage.dataset.proxyAttempted) {

                    mainImage.dataset.proxyAttempted = "true";

                    const proxy = buildProxyUrl(original);

                    if (proxy && proxy !== mainImage.src) {
                        mainImage.src = proxy;
                        return;
                    }
                }

                if (!mainImage.dataset.placeholderUsed) {
                    mainImage.dataset.placeholderUsed = "true";
                    mainImage.src = PLACEHOLDER_IMAGE;
                }
            });
        }

        elements.modalBody.querySelectorAll(".modal-gallery-thumb").forEach(button => {

            button.addEventListener("click", () => {

                const image = button.dataset.galleryImage;

                if (mainImage && image) {
                    mainImage.src = image;
                    mainImage.dataset.placeholderUsed = "";
                    mainImage.dataset.proxyAttempted = "";
                }

                elements.modalBody
                    .querySelectorAll(".modal-gallery-thumb")
                    .forEach(thumbnail => thumbnail.classList.remove("is-active"));

                button.classList.add("is-active");
            });
        });

        const modalCartButton = document.getElementById("modal-add-cart-btn");

        if (modalCartButton && quantity > 0) {

            modalCartButton.addEventListener("click", () => {

                const added = invokeAddToCart(product);

                if (!added) return;

                modalCartButton.disabled = true;
                modalCartButton.classList.add("added");

                modalCartButton.innerHTML = `
                    ${svgIcon("check", "ui-icon ui-icon-sm")}
                    <span>Added to Cart</span>
                `;

                announce(`${product.name} added to cart.`);
            });
        }

        window.setTimeout(() => {
            elements.modalClose?.focus();
        }, 50);
    }


    function closeProductModal() {

        if (!elements.productModal) return;

        elements.productModal.classList.remove("is-open");
        elements.productModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");

        if (elements.modalBody) {
            elements.modalBody.innerHTML = "";
        }
    }


    /* =========================================================================
       26. DESCRIPTION SANITIZATION
       ========================================================================= */

    function sanitizeDescription(html) {

        if (!html) {
            return "";
        }

        const parser = new DOMParser();
        const parsed = parser.parseFromString(String(html), "text/html");

        const forbiddenTags = [
            "script", "style", "iframe", "object", "embed", "form",
            "input", "button", "textarea", "select", "option", "video",
            "audio", "source", "link", "meta", "base"
        ];

        forbiddenTags.forEach(tag => {
            parsed.querySelectorAll(tag).forEach(element => element.remove());
        });

        parsed.querySelectorAll("*").forEach(element => {

            [...element.attributes].forEach(attribute => {

                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim();

                if (name.startsWith("on")) {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (name === "style") {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (name === "href") {

                    if (!isSafeHref(value)) {
                        element.removeAttribute("href");
                    } else {
                        element.setAttribute("target", "_blank");
                        element.setAttribute(
                            "rel",
                            "noopener noreferrer nofollow"
                        );
                    }
                }

                if (name === "src") {

                    const normalized = normalizeImageUrl(value);

                    if (normalized) {
                        element.setAttribute(
                            "src",
                            buildProxyUrl(normalized)
                        );
                    } else {
                        element.removeAttribute("src");
                    }
                }

                if (name === "srcset") {
                    element.removeAttribute("srcset");
                }
            });
        });

        parsed.querySelectorAll("img").forEach(image => {
            image.setAttribute("loading", "lazy");
            image.setAttribute("decoding", "async");
            image.setAttribute("referrerpolicy", "no-referrer");
            image.removeAttribute("width");
            image.removeAttribute("height");
        });

        return parsed.body.innerHTML;
    }


    function isSafeHref(value) {

        if (!value) return false;
        if (value.startsWith("#")) return true;

        try {
            const url = new URL(value, window.location.href);
            return url.protocol === "https:" || url.protocol === "http:";
        } catch {
            return false;
        }
    }


    /* =========================================================================
       27. UI STATES
       ========================================================================= */

    function renderLoadingState() {

        if (!elements.productList) return;

        elements.productList.innerHTML = `
            <div class="product-status-card" role="status" aria-live="polite">
                <div class="spinner" aria-hidden="true"></div>
                <h3>Loading Products</h3>
                <p>Loading the curated CJ catalog...</p>
            </div>
        `;

        if (elements.resultsCount) {
            elements.resultsCount.textContent = "Loading...";
        }

        setLoadingState(true);
    }


    function renderEmptyState(message) {

        if (!elements.productList) return;

        elements.productList.innerHTML = `
            <div class="product-status-card" role="status">
                ${svgIcon("inventory", "ui-icon ui-icon-xl")}
                <h3>No Products Found</h3>
                <p>${escapeHTML(message)}</p>
            </div>
        `;

        if (elements.resultsCount) {
            elements.resultsCount.textContent = "0 products found";
        }

        setLoadingState(false);
    }


    function renderErrorState(message) {

        if (!elements.productList) return;

        elements.productList.innerHTML = `
            <div class="product-status-card" role="alert">
                ${svgIcon("error", "ui-icon ui-icon-xl")}
                <h3>Unable to Load Products</h3>
                <p>${escapeHTML(message)}</p>
                <button type="button" class="btn-primary" data-action="retry">
                    ${svgIcon("refresh", "ui-icon ui-icon-sm")}
                    <span>Try Again</span>
                </button>
            </div>
        `;

        elements.productList
            .querySelector('[data-action="retry"]')
            ?.addEventListener(
                "click",
                () => loadCatalog(),
                { once: true }
            );

        if (elements.resultsCount) {
            elements.resultsCount.textContent = "Unable to load products";
        }

        setLoadingState(false);
    }


    function updateResultsCount() {

        if (!elements.resultsCount) return;

        const count = state.filteredProducts.length;

        elements.resultsCount.textContent =
            `${count} ${count === 1 ? "product" : "products"} available`;
    }


    function updatePageHeading() {

        if (!elements.pageHeading) return;

        if (state.activeCategory) {
            elements.pageHeading.textContent = getActiveCategory().label;
            return;
        }

        if (state.searchQuery) {
            elements.pageHeading.textContent = `Search: ${state.searchQuery}`;
            return;
        }

        elements.pageHeading.textContent = "All Products";
    }


    function setLoadingState(loading) {

        elements.productList?.setAttribute(
            "aria-busy",
            loading ? "true" : "false"
        );
    }


    /* =========================================================================
       28. GENERIC HELPERS
       ========================================================================= */

    function cleanString(value) {

        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();
    }


    function normalizeInventory(value) {

        if (typeof value === "number") {
            return Number.isFinite(value)
                ? Math.max(0, Math.floor(value))
                : 0;
        }

        const number = Number(
            String(value ?? "")
                .replace(/,/g, "")
                .replace(/[^0-9.-]/g, "")
        );

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.max(0, Math.floor(number));
    }


    function normalizePrice(value) {

        if (value && typeof value === "object") {
            value = value.amount ?? value.value ?? value.price ?? value.raw ?? 0;
        }

        const number = Number(
            String(value ?? 0)
                .replace(/,/g, "")
                .replace(/[^0-9.-]/g, "")
        );

        return Number.isFinite(number)
            ? Number(number.toFixed(2))
            : 0;
    }


    function normalizeRating(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Number(
            Math.min(5, Math.max(0, number)).toFixed(1)
        );
    }


    function stripHtml(value) {

        if (value === null || value === undefined) {
            return "";
        }

        const div = document.createElement("div");
        div.innerHTML = String(value);

        return (div.textContent || div.innerText || "")
            .replace(/\s+/g, " ")
            .trim();
    }


    function formatPrice(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "$0.00";
        }

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(number);
        } catch {
            return `$${number.toFixed(2)}`;
        }
    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function announce(message) {

        if (!elements.liveRegion) return;

        elements.liveRegion.textContent = "";

        window.setTimeout(() => {
            elements.liveRegion.textContent = String(message || "");
        }, 20);
    }


    /* =========================================================================
       29. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload: () => loadCatalog(),

        search: query => {

            state.searchQuery = normalizeSearchText(query);
            state.activeCategory = "";

            if (elements.searchInput) {
                elements.searchInput.value = query || "";
            }

            updateClearSearchButton();
            highlightCategory();
            applyFiltersAndRender();
        },

        filterCategory: query => {

            const wanted = cleanString(query);

            if (
                wanted &&
                !CATEGORY_MAP.some(category => category.query === wanted)
            ) {
                return;
            }

            state.activeCategory = wanted;
            state.searchQuery = "";

            if (elements.searchInput) {
                elements.searchInput.value = "";
            }

            updateClearSearchButton();
            highlightCategory();
            applyFiltersAndRender();
        },

        sort: value => {

            state.sortBy = value || CONFIG.DEFAULT_SORT;

            if (elements.sortSelect) {
                elements.sortSelect.value = state.sortBy;
            }

            applyFiltersAndRender();
        },

        openDetails: id => openProductModal(id),

        closeDetails: () => closeProductModal(),

        getProducts: () => [...state.products],

        getFilteredProducts: () => [...state.filteredProducts],

        getProductById: id => findCatalogProductById(id),

        getWED2CLink: id => {
            const product = findCatalogProductById(id);
            return getWed2cProductUrl(product) || WED2C.STORE_URL;
        },

        getWED2CConfig: () => ({
            storeUrl: WED2C.STORE_URL,
            hyId: WED2C.HY_ID,
            products: { ...WED2C.PRODUCTS }
        }),

        getCategoryMap: () => CATEGORY_MAP.map(category => ({
            label: category.label,
            query: category.query
        })),

        getState: () => ({
            loading: state.loading,
            productCount: state.products.length,
            filteredCount: state.filteredProducts.length,
            activeCategory: state.activeCategory,
            searchQuery: state.searchQuery,
            sortBy: state.sortBy,
            detailCacheCount: state.productDetailCache.size
        })
    };

})();
