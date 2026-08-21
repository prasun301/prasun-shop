/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * js/products.js
 *
 * IMPORTANT ARCHITECTURE
 * ============================================================================
 *
 * /api/products returns the COMPLETE synchronized CJ catalog.
 *
 * Main page:
 *     - displays ALL returned CJ products
 *     - does NOT send a category query to the Worker
 *
 * Category buttons:
 *     - filter the already-loaded catalog locally
 *     - no additional API request
 *
 * Search:
 *     - searches the already-loaded catalog locally
 *     - no API request while typing
 *
 * This avoids:
 *     - catalog shrinking to 4 products
 *     - unnecessary CJ requests
 *     - QPS problems
 *     - category-dependent server results
 *
 * Categories:
 *
 *     All Products
 *     Solar Lights
 *     Battery
 *     Chargers
 *     Power Bank
 *     Cables
 *     Earphones
 *     Headphones
 *     Modem
 *     Routers
 *     Laptops
 *     Power Tools
 *     Camera
 *     Smart Home
 *
 * No emoji.
 * No Material Symbols.
 * Inline SVG only.
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

        PRODUCT_PAGE:
            "/product.html",

        IMAGE_PROXY_ENDPOINT:
            "/api/image-proxy",

        REQUEST_TIMEOUT:
            20000,

        MAX_PRODUCTS:
            5000,

        SEARCH_MIN_LENGTH:
            1,

        DEFAULT_CATEGORY:
            "General"

    };


    /* =========================================================================
       2. PLACEHOLDER
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
                    "solar garden light"
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
                    "car charger"
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
                    "portable charger",
                    "portable power bank"
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
                    "usb-c cable",
                    "lightning cable",
                    "hdmi cable",
                    "network cable"
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
                    "wi-fi smart"
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

        searchQuery:
            "",

        activeCategory:
            "",

        sortBy:
            "featured",

        loading:
            false,

        initialized:
            false

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
       6. INIT
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

        loadCatalog();

    }


    /* =========================================================================
       7. CACHE DOM
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

        }

    }


    /* =========================================================================
       8. INLINE SVG
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
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true"
                     focusable="false">
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>
                `,

            solar:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
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
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <rect x="3" y="7" width="17" height="10" rx="2"></rect>
                    <path d="M21 10v4"></path>
                    <path d="M8 12h7"></path>
                </svg>
                `,

            charger:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M9 2v6"></path>
                    <path d="M15 2v6"></path>
                    <path d="M7 8h10"></path>
                    <path d="M12 8v14"></path>
                </svg>
                `,

            powerbank:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <path d="M8 12h8"></path>
                    <path d="M12 8v8"></path>
                </svg>
                `,

            cable:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M7 3v5"></path>
                    <path d="M17 16v5"></path>
                    <path d="M7 8c0 5 10 3 10 8"></path>
                    <path d="M5 3h4"></path>
                    <path d="M15 21h4"></path>
                </svg>
                `,

            earphone:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M7 13a4 4 0 1 1 4-4v7"></path>
                    <path d="M17 13a4 4 0 1 0-4-4v7"></path>
                </svg>
                `,

            headphone:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M4 15v-3a8 8 0 0 1 16 0v3"></path>
                    <path d="M4 15h3v5H5a1 1 0 0 1-1-1z"></path>
                    <path d="M20 15h-3v5h2a1 1 0 0 0 1-1z"></path>
                </svg>
                `,

            modem:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <rect x="4" y="9" width="16" height="9" rx="2"></rect>
                    <path d="M8 13h.01"></path>
                    <path d="M12 13h.01"></path>
                    <path d="M16 13h.01"></path>
                    <path d="M9 6h6"></path>
                </svg>
                `,

            router:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
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
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <rect x="5" y="4" width="14" height="11" rx="1.5"></rect>
                    <path d="M3 19h18"></path>
                    <path d="M8 19l1-3h6l1 3"></path>
                </svg>
                `,

            tool:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M14 6a5 5 0 0 0-7 7l-4 4 4 4 4-4a5 5 0 0 0 7-7"></path>
                    <path d="m13 11 4 4"></path>
                </svg>
                `,

            camera:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M4 7h4l2-2h4l2 2h4v12H4z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                </svg>
                `,

            home:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M3 11 12 4l9 7"></path>
                    <path d="M5 10v10h14V10"></path>
                    <path d="M9 20v-5h6v5"></path>
                </svg>
                `,

            category:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                    <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                    <rect x="14" y="14" width="6" height="6" rx="1"></rect>
                </svg>
                `,

            eye:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
                    <circle cx="12" cy="12" r="2.5"></circle>
                </svg>
                `,

            cart:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"></path>
                    <path d="M16 4v5"></path>
                    <path d="M13.5 6.5h5"></path>
                </svg>
                `,

            check:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="m5 12 4 4L19 6"></path>
                </svg>
                `,

            inventory:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M4 7h16v13H4z"></path>
                    <path d="M8 7V4h8v3"></path>
                    <path d="M8 11h8"></path>
                </svg>
                `,

            close:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M6 6l12 12"></path>
                    <path d="M18 6L6 18"></path>
                </svg>
                `,

            refresh:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
                `,

            error:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
                `,

            star:
                `
                <svg class="${safeClass}"
                     viewBox="0 0 24 24"
                     aria-hidden="true">
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
                category?.query ||
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
                    event.target.value ||
                    "featured";

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


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updateCartCount();

                }

            }
        );


        window.addEventListener(
            "prasunCartUpdated",
            updateCartCount
        );

    }


    /* =========================================================================
       10. LOAD COMPLETE CATALOG
       ========================================================================= */

    async function loadCatalog() {

        state.loading =
            true;


        renderLoadingState();


        const controller =
            new AbortController();


        const timeout =
            window.setTimeout(
                () =>
                    controller.abort(),
                CONFIG.REQUEST_TIMEOUT
            );


        try {

            const response =
                await fetch(
                    `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`,
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
                    "Product service returned an error."
                );

            }


            const rawProducts =
                extractProducts(
                    data
                );


            state.products =
                rawProducts
                    .slice(
                        0,
                        CONFIG.MAX_PRODUCTS
                    )
                    .map(
                        normalizeProduct
                    )
                    .filter(
                        Boolean
                    );


            applyFiltersAndRender();


        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                renderErrorState(
                    "The catalog request timed out."
                );

            } else {

                console.error(
                    "[PRASUN SHOP] Catalog error:",
                    error
                );


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


        return [];

    }


    /* =========================================================================
       11. SEARCH
       ========================================================================= */

    function handleSearch(
        event
    ) {

        state.searchQuery =
            String(
                event.target?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        updateClearSearchButton();

        applyFiltersAndRender();

    }


    function clearSearch() {

        if (
            elements.searchInput
        ) {

            elements.searchInput.value =
                "";

            elements.searchInput.focus();

        }


        state.searchQuery =
            "";

        updateClearSearchButton();

        applyFiltersAndRender();

    }


    function updateClearSearchButton() {

        if (
            elements.clearSearchButton
        ) {

            elements.clearSearchButton.hidden =
                !state.searchQuery;

        }

    }


    /* =========================================================================
       12. CATEGORIES
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

        updatePageHeading();

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


    function updatePageHeading() {

        if (
            !elements.pageHeading
        ) {

            return;

        }


        const category =
            getActiveCategory();


        if (
            category.query
        ) {

            elements.pageHeading.textContent =
                category.label;

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


    /* =========================================================================
       13. FILTERING
       ========================================================================= */

    function applyFiltersAndRender() {

        let products =
            [
                ...state.products
            ];


        const search =
            state.searchQuery
                .trim()
                .toLowerCase();


        /*
         * LOCAL SEARCH
         */

        if (
            search.length >=
            CONFIG.SEARCH_MIN_LENGTH
        ) {

            const terms =
                search.split(
                    /\s+/
                )
                    .filter(
                        Boolean
                    );


            products =
                products.filter(
                    product => {

                        const searchable =
                            buildSearchText(
                                product
                            );


                        return terms.every(
                            term =>
                                searchable.includes(
                                    term
                                )
                        );

                    }
                );

        }


        /*
         * LOCAL CATEGORY
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

            const message =
                state.searchQuery
                    ? `No products found for "${state.searchQuery}".`
                    : state.activeCategory
                        ? `No products found in ${getActiveCategory().label}.`
                        : "No products are currently available.";


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
            .join(" ");

    }


    function matchesCategory(
        product,
        category
    ) {

        if (
            !category ||
            !category.terms?.length
        ) {

            return true;

        }


        const text =
            buildSearchText(
                product
            );


        return category.terms.some(
            term =>
                text.includes(
                    term.toLowerCase()
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
                "featured"
            )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );


        const priceA =
            Number(
                a.price
            ) || 0;


        const priceB =
            Number(
                b.price
            ) || 0;


        const nameA =
            String(
                a.name ||
                ""
            );


        const nameB =
            String(
                b.name ||
                ""
            );


        const ratingA =
            Number(
                a.rating
            ) || 0;


        const ratingB =
            Number(
                b.rating
            ) || 0;


        const inventoryA =
            Number(
                a.quantity
            ) || 0;


        const inventoryB =
            Number(
                b.quantity
            ) || 0;


        if (
            sort.includes(
                "lowtohigh"
            ) ||
            sort.includes(
                "lowhigh"
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
                "highlow"
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
            ) ||
            sort ===
                "nameasc"
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
            ) ||
            sort ===
                "namedesc"
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


        if (
            sort.includes(
                "rating"
            ) ||
            sort.includes(
                "toprated"
            )
        ) {

            return (
                ratingB -
                ratingA
            );

        }


        /*
         * Featured:
         *
         * 1. In-stock products
         * 2. Listed products
         * 3. Stable name order
         */

        if (
            inventoryA > 0 &&
            inventoryB <= 0
        ) {

            return -1;

        }


        if (
            inventoryA <= 0 &&
            inventoryB > 0
        ) {

            return 1;

        }


        const listedA =
            Number(
                a.listedNum ||
                a.cj?.listedNum ||
                0
            );


        const listedB =
            Number(
                b.listedNum ||
                b.cj?.listedNum ||
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
       15. NORMALIZATION
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
            String(
                raw.id ??
                raw.pid ??
                raw.productId ??
                raw.sku ??
                ""
            )
                .trim();


        const pid =
            String(
                raw.pid ??
                raw.id ??
                raw.productId ??
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
                .trim();


        if (
            !id ||
            !name
        ) {

            return null;

        }


        let rawPrice =
            raw.price ??
            raw.sellPrice ??
            raw.unitPrice ??
            0;


        if (
            rawPrice &&
            typeof rawPrice ===
                "object"
        ) {

            rawPrice =
                rawPrice.amount ??
                rawPrice.value ??
                rawPrice.raw ??
                0;

        }


        const parsedPrice =
            parseFloat(
                String(
                    rawPrice
                )
                    .replace(
                        /[^0-9.]/g,
                        ""
                    )
            );


        const price =
            Number.isFinite(
                parsedPrice
            )
                ? Number(
                    parsedPrice.toFixed(
                        2
                    )
                )
                : 0;


        const quantity =
            normalizeInventory(
                raw.quantity ??
                raw.inventory ??
                raw.totalInventory ??
                raw.warehouseInventoryNum ??
                raw.totalVerifiedInventory
            );


        const rating =
            normalizeRating(
                raw.rating
            );


        const image =
            getPrimaryImage(
                raw
            );


        const images =
            getGalleryImages(
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
                ).trim(),

            sku:
                String(
                    raw.sku ||
                    raw.productSku ||
                    ""
                ).trim(),

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

            image,

            images,

            originalImage:
                normalizeImageUrl(
                    raw.originalImage ||
                    raw.bigImage ||
                    raw.productImage ||
                    ""
                ),

            originalImages:
                Array.isArray(
                    raw.originalImages
                )
                    ? raw.originalImages
                        .map(
                            normalizeImageUrl
                        )
                        .filter(
                            Boolean
                        )
                    : [],

            variants,

            rating,

            listedNum:
                Number(
                    raw.listedNum ||
                    raw.cj?.listedNum ||
                    0
                ),

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
                variant => ({

                    ...variant,

                    vid:
                        String(
                            variant?.vid ||
                            ""
                        ).trim(),

                    sku:
                        String(
                            variant?.sku ||
                            variant?.variantSku ||
                            ""
                        ).trim(),

                    name:
                        String(
                            variant?.name ||
                            variant?.variantNameEn ||
                            "Default"
                        ).trim(),

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

                })
            );

    }


    function normalizeInventory(
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
            number.toFixed(
                2
            )
        );

    }


    /* =========================================================================
       16. IMAGES
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


        return url;

    }


    function isProxyUrl(
        url
    ) {

        return (
            typeof url ===
                "string" &&
            url.includes(
                CONFIG.IMAGE_PROXY_ENDPOINT
            )
        );

    }


    function buildProxyUrl(
        url
    ) {

        const normalized =
            normalizeImageUrl(
                url
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


        const values = [

            product?.image,

            ...(Array.isArray(
                product?.images
            )
                ? product.images
                : []),

            product?.originalImage,

            ...(Array.isArray(
                product?.originalImages
            )
                ? product.originalImages
                : []),

            product?.bigImage,

            product?.productImage,

            product?.productImg

        ];


        candidates.push(
            ...values
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
                ...product
                    .productImageSet
                    .split(",")
            );

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


    function getPrimaryImage(
        product
    ) {

        const images =
            collectProductImageUrls(
                product
            );


        const proxy =
            images.find(
                isProxyUrl
            );


        if (
            proxy
        ) {

            return proxy;

        }


        if (
            images.length
        ) {

            return buildProxyUrl(
                images[0]
            );

        }


        return PLACEHOLDER_IMAGE;

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
       17. GRID
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

        updateCartCount();

    }


    function renderProductCard(
        product
    ) {

        const id =
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
            100
                ? (
                    description.slice(
                        0,
                        100
                    ) +
                    "..."
                )
                : (
                    description ||
                    "Product information available."
                );


        const rating =
            Number(
                product.rating
            ) || 0;


        return `

            <article
                class="product-card"
                data-product-id="${id}"
            >

                <button
                    type="button"
                    class="product-card-image-wrap"
                    data-action="view-details"
                    data-product-id="${id}"
                    aria-label="View ${title}"
                >

                    <span class="product-badge">

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


                <div class="product-card-body">

                    <h3 class="product-title">

                        <button
                            type="button"
                            class="product-title-button"
                            data-action="view-details"
                            data-product-id="${id}"
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
                        rating > 0
                            ? `

                                <div
                                    class="product-rating"
                                    aria-label="Rating ${rating.toFixed(
                                        1
                                    )} out of 5"
                                >

                                    ${svgIcon(
                                        "star",
                                        "ui-icon ui-icon-sm"
                                    )}

                                    <span>
                                        ${rating.toFixed(
                                            1
                                        )}
                                    </span>

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
                                data-product-id="${id}"
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
                                data-product-id="${id}"
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


    /* =========================================================================
       18. GRID EVENTS
       ========================================================================= */

    function handleProductGridClick(
        event
    ) {

        const details =
            event.target.closest(
                '[data-action="view-details"]'
            );


        if (
            details
        ) {

            event.preventDefault();


            openProductModal(
                details.dataset.productId
            );


            return;

        }


        const addButton =
            event.target.closest(
                '[data-action="add-cart"]'
            );


        if (
            !addButton
        ) {

            return;

        }


        event.preventDefault();


        const product =
            state.products.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        addButton.dataset.productId
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
            ) <=
            0
        ) {

            announce(
                `${product.name} is out of stock.`
            );


            return;

        }


        let added =
            false;


        if (
            typeof window.addToCart ===
            "function"
        ) {

            added =
                Boolean(
                    window.addToCart(
                        product
                    )
                );

        } else {

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


                added =
                    true;

            } catch (
                error
            ) {

                console.error(
                    "[PRASUN SHOP] Cart error:",
                    error
                );

            }

        }


        if (
            !added
        ) {

            return;

        }


        addButton.disabled =
            true;


        addButton.innerHTML =
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

                addButton.disabled =
                    false;


                addButton.innerHTML =
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


    /* =========================================================================
       19. MODAL
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


        const dangerous =
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
            ];


        dangerous.forEach(
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

                    const source =
                        image.getAttribute(
                            "src"
                        );


                    if (
                        source
                    ) {

                        const normalized =
                            normalizeImageUrl(
                                source
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


        const price =
            formatPrice(
                product.price
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


        const gallery =
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

                    ${gallery}

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
                            ${price}
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

                    let added =
                        false;


                    if (
                        typeof window.addToCart ===
                        "function"
                    ) {

                        added =
                            Boolean(
                                window.addToCart(
                                    product
                                )
                            );

                    } else {

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


                            added =
                                true;

                        } catch (
                            error
                        ) {

                            console.error(
                                "[PRASUN SHOP] Modal cart error:",
                                error
                            );

                        }

                    }


                    if (
                        !added
                    ) {

                        return;

                    }


                    modalCartButton.disabled =
                        true;


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
            40
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
       20. IMAGE FALLBACK
       ========================================================================= */

    function attachProductImageFallbacks() {

        document
            .querySelectorAll(
                ".product-image"
            )
            .forEach(
                image => {

                    image.addEventListener(
                        "error",
                        handleImageError,
                        {
                            once:
                                false
                        }
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
       21. UI
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
                >

                    <div
                        class="spinner"
                        aria-hidden="true"
                    ></div>

                    <h3>
                        Loading Products
                    </h3>

                    <p>
                        Loading the complete catalog.
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
                () =>
                    loadCatalog(),
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
            }`;

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


    function updateCartCount() {

        const count =
            Number(
                window.PrasunCart?.getCount?.() ||
                0
            );


        const badge =
            document.getElementById(
                "cart-count"
            );


        if (
            !badge
        ) {

            return;

        }


        badge.textContent =
            String(
                count
            );


        badge.hidden =
            count <=
            0;

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
        amount
    ) {

        const value =
            Number(
                amount
            );


        if (
            !Number.isFinite(
                value
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
                value
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
       23. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload:
            () =>
                loadCatalog(),

        search:
            query => {

                state.searchQuery =
                    String(
                        query ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


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
                    "featured";


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
                null

    };

})();

