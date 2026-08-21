/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * js/products.js
 *
 * Production-ready CJ Dropshipping storefront product manager.
 *
 * DATA FLOW
 *
 *     CJ Dropshipping
 *            ↓
 *     Cloudflare Worker
 *            ↓
 *     /api/products
 *            ↓
 *     products.js
 *            ↓
 *     Product grid
 *            ↓
 *     window.addToCart()
 *
 *
 * IMAGE FLOW
 *
 *     CJ original image
 *            ↓
 *     Cloudflare Worker image proxy
 *            ↓
 *     product.image
 *            ↓
 *     Product card
 *
 *
 * IMPORTANT
 *
 * - No Unsplash.
 * - No stock-photo URLs.
 * - No hard-coded product images.
 * - CJ images are the only real product images used.
 * - Local inline SVG is used only as a neutral final placeholder.
 * - No CJ credentials are exposed in the browser.
 * - Product price and stock remain server-authoritative.
 * - CJ PID / VID / SKU / variants are preserved.
 * - No emoji.
 * - No Material Symbols dependency.
 * - All dynamic UI icons use inline SVG.
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

        PRODUCT_PAGE:
            "/product.html",

        IMAGE_PROXY_ENDPOINT:
            "/api/image-proxy",

        REQUEST_TIMEOUT:
            15000,

        DEBOUNCE_DELAY:
            280,

        MAX_PRODUCTS:
            1000,

        DEFAULT_CATEGORY:
            "Home Improvement / Solar"

    };


    /* =========================================================================
       2. LOCAL IMAGE PLACEHOLDER
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
       3. CATEGORY MAP
       ========================================================================= */

    const CATEGORY_MAP = [

        {
            label:
                "All Items",

            query:
                ""
        },

        {
            label:
                "Solar Lights",

            query:
                "solar light"
        },

        {
            label:
                "Consumer Electronics",

            query:
                "consumer electronics"
        },

        {
            label:
                "Wireless Chargers",

            query:
                "wireless charger"
        },

        {
            label:
                "Smart Home",

            query:
                "smart home"
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

        activeCategoryQuery:
            "",

        searchQuery:
            "",

        sortBy:
            "featured",

        loading:
            false,

        requestSequence:
            0

    };


    let activeAbortController =
        null;

    let searchDebounceTimer =
        null;


    /* =========================================================================
       5. DOM ELEMENTS
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

        cacheDOM();

        loadInitialSort();

        bindEvents();

        renderCategoryPills();

        updateClearSearchButton();

        updatePageHeading(
            ""
        );

        loadProducts();

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
            findSortSelect();


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

    }


    function findSortSelect() {

        return (

            document.getElementById(
                "product-sort"
            ) ||

            document.querySelector(
                "select.product-sort"
            ) ||

            document.querySelector(
                "select[name='sort']"
            )

        );

    }


    function loadInitialSort() {

        const sort =
            findSortSelect();


        if (
            sort &&
            sort.value
        ) {

            state.sortBy =
                sort.value;

        }

    }


    /* =========================================================================
       8. INLINE SVG ICON SYSTEM
       ========================================================================= */

    function svgIcon(
        name,
        className =
            "ui-icon"
    ) {

        const safeClass =
            escapeHTML(
                className
            );


        const icons = {

            apps: `
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

            category: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M4 5h6v6H4z"></path>
                    <path d="M14 5h6v6h-6z"></path>
                    <path d="M4 15h6v4H4z"></path>
                    <path d="M14 15h6v4h-6z"></path>
                </svg>
            `,

            light_mode: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
            `,

            devices: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <rect x="3" y="4" width="14" height="11" rx="2"></rect>
                    <path d="M7 20h6"></path>
                    <path d="M10 15v5"></path>
                    <path d="M19 8h2v8a2 2 0 0 1-2 2h-2"></path>
                </svg>
            `,

            battery: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <rect x="3" y="7" width="17" height="10" rx="2"></rect>
                    <path d="M21 10v4"></path>
                    <path d="M8 12h7"></path>
                    <path d="M11.5 9.5 10 12h3.5L12 14.5"></path>
                </svg>
            `,

            smart_home: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M3 11 12 4l9 7"></path>
                    <path d="M5 10v10h14V10"></path>
                    <path d="M9 20v-5h6v5"></path>
                    <circle cx="17" cy="8" r="2"></circle>
                </svg>
            `,

            star: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        d="
                            m12 3
                            2.9 5.9
                            6.5.9
                            -4.7 4.6
                            1.1 6.5
                            -5.8-3.1
                            -5.8 3.1
                            1.1-6.5
                            -4.7-4.6
                            6.5-.9
                            z
                        "
                    ></path>
                </svg>
            `,

            eye: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        d="
                            M2 12
                            s3.5-6
                            10-6
                            10 6
                            10 6
                            -3.5 6
                            -10 6
                            S2 12 2 12Z
                        "
                    ></path>
                    <circle cx="12" cy="12" r="2.5"></circle>
                </svg>
            `,

            add_cart: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path
                        d="
                            M3 4h2
                            l2.4 11.2
                            a2 2 0 0 0 2 1.6h8.8
                            a2 2 0 0 0 1.9-1.4L22 8H6
                        "
                    ></path>
                    <path d="M16 4v5"></path>
                    <path d="M13.5 6.5h5"></path>
                </svg>
            `,

            check: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="m5 12 4 4L19 6"></path>
                </svg>
            `,

            inventory: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M4 7h16v13H4z"></path>
                    <path d="M8 7V4h8v3"></path>
                    <path d="M8 11h8"></path>
                    <path d="M8 15h5"></path>
                </svg>
            `,

            refresh: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
            `,

            error: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
            `

        };


        return (
            icons[name] ||
            icons.category
        );

    }


    function getCategoryIcon(
        query
    ) {

        const value =
            String(
                query ||
                ""
            ).toLowerCase();


        if (
            value.includes(
                "solar"
            )
        ) {

            return "light_mode";

        }


        if (
            value.includes(
                "electronic"
            )
        ) {

            return "devices";

        }


        if (
            value.includes(
                "wireless"
            )
        ) {

            return "battery";

        }


        if (
            value.includes(
                "smart"
            )
        ) {

            return "smart_home";

        }


        return "category";

    }


    /* =========================================================================
       9. EVENTS
       ========================================================================= */

    function bindEvents() {

        if (
            elements.searchInput
        ) {

            elements.searchInput.addEventListener(
                "input",
                handleSearchInput
            );


            elements.searchInput.addEventListener(
                "keydown",
                handleSearchKeydown
            );

        }


        if (
            elements.clearSearchButton
        ) {

            elements.clearSearchButton.addEventListener(
                "click",
                clearSearch
            );

        }


        if (
            elements.sortSelect
        ) {

            elements.sortSelect.addEventListener(
                "change",
                handleSortChange
            );

        }


        document.addEventListener(
            "change",
            event => {

                const target =
                    event.target;


                if (
                    !target
                ) {

                    return;

                }


                if (
                    target.id ===
                        "product-sort" ||

                    target.classList.contains(
                        "product-sort"
                    ) ||

                    target.name ===
                        "sort"
                ) {

                    handleSortChange(
                        event
                    );

                }

            }
        );


        if (
            elements.categoriesNav
        ) {

            elements.categoriesNav.addEventListener(
                "click",
                handleCategoryClick
            );

        }


        if (
            elements.productList
        ) {

            elements.productList.addEventListener(
                "click",
                handleProductGridClick
            );

        }

    }


    /* =========================================================================
       10. SEARCH
       ========================================================================= */

    function handleSearchInput(
        event
    ) {

        state.searchQuery =
            String(
                event.target?.value ||
                ""
            ).trim();


        updateClearSearchButton();


        window.clearTimeout(
            searchDebounceTimer
        );


        searchDebounceTimer =
            window.setTimeout(
                () => {

                    state.activeCategoryQuery =
                        "";

                    highlightActiveCategoryPill(
                        ""
                    );


                    loadProducts(
                        state.searchQuery
                    );

                },
                CONFIG.DEBOUNCE_DELAY
            );

    }


    function handleSearchKeydown(
        event
    ) {

        if (
            event.key !==
            "Enter"
        ) {

            return;

        }


        event.preventDefault();


        window.clearTimeout(
            searchDebounceTimer
        );


        state.activeCategoryQuery =
            "";


        highlightActiveCategoryPill(
            ""
        );


        loadProducts(
            state.searchQuery
        );

    }


    function clearSearch() {

        window.clearTimeout(
            searchDebounceTimer
        );


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


        loadProducts(
            state.activeCategoryQuery ||
            ""
        );

    }


    function updateClearSearchButton() {

        const button =
            elements.clearSearchButton ||
            document.getElementById(
                "clear-search"
            );


        if (
            !button
        ) {

            return;

        }


        button.hidden =
            state.searchQuery.length ===
            0;

    }


    function handleSortChange(
        event
    ) {

        state.sortBy =
            event.target?.value ||
            "featured";


        applyFiltersAndRender();

    }


    /* =========================================================================
       11. CATEGORY HANDLING
       ========================================================================= */

    function renderCategoryPills() {

        const nav =
            elements.categoriesNav ||
            document.getElementById(
                "products-categories"
            );


        if (
            !nav
        ) {

            return;

        }


        nav.innerHTML =
            CATEGORY_MAP
                .map(
                    category => {

                        const active =
                            category.query ===
                            state.activeCategoryQuery;


                        const icon =
                            category.query
                                ? getCategoryIcon(
                                    category.query
                                )
                                : "apps";


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
                                    icon,
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


        const query =
            String(
                button.dataset.query ||
                ""
            ).trim();


        state.activeCategoryQuery =
            query;


        state.searchQuery =
            "";


        if (
            elements.searchInput
        ) {

            elements.searchInput.value =
                "";

        }


        updateClearSearchButton();


        highlightActiveCategoryPill(
            query
        );


        loadProducts(
            query
        );

    }


    function highlightActiveCategoryPill(
        query
    ) {

        const nav =
            elements.categoriesNav ||
            document.getElementById(
                "products-categories"
            );


        if (
            !nav
        ) {

            return;

        }


        nav.querySelectorAll(
            ".category-pill"
        ).forEach(
            button => {

                const active =
                    String(
                        button.dataset.query ||
                        ""
                    ) ===
                    String(
                        query ||
                        ""
                    );


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


    /* =========================================================================
       12. API
       ========================================================================= */

    async function loadProducts(
        query = ""
    ) {

        const requestId =
            ++state.requestSequence;


        if (
            activeAbortController
        ) {

            activeAbortController.abort();

        }


        activeAbortController =
            new AbortController();


        const controller =
            activeAbortController;


        state.loading =
            true;


        setLoadingState(
            true
        );


        renderLoadingState();


        const cleanQuery =
            String(
                query ||
                ""
            ).trim();


        let apiUrl =
            `${CONFIG.API_BASE}${CONFIG.PRODUCTS_ENDPOINT}`;


        if (
            cleanQuery
        ) {

            apiUrl +=
                `?q=${encodeURIComponent(
                    cleanQuery
                )}`;

        }


        const timer =
            window.setTimeout(
                () => {

                    controller.abort();

                },
                CONFIG.REQUEST_TIMEOUT
            );


        try {

            const response =
                await fetch(
                    apiUrl,
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
                    data.error ||
                    "Product service returned an error."
                );

            }


            const rawProducts =
                extractProducts(
                    data
                );


            const normalizedProducts =
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


            if (
                requestId !==
                state.requestSequence
            ) {

                return;

            }


            state.products =
                normalizedProducts;


            updatePageHeading(
                cleanQuery
            );


            applyFiltersAndRender();


        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                return;

            }


            console.error(
                "[PRASUN SHOP] Product API error:",
                error
            );


            if (
                requestId ===
                state.requestSequence
            ) {

                renderErrorState(
                    error?.message ||
                    "Unable to load products."
                );

            }

        } finally {

            window.clearTimeout(
                timer
            );


            if (
                requestId ===
                state.requestSequence
            ) {

                state.loading =
                    false;

                setLoadingState(
                    false
                );


                if (
                    activeAbortController ===
                    controller
                ) {

                    activeAbortController =
                        null;

                }

            }

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
       13. IMAGE NORMALIZATION
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
        originalUrl
    ) {

        const normalized =
            normalizeImageUrl(
                originalUrl
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
            `${CONFIG.API_BASE}${CONFIG.IMAGE_PROXY_ENDPOINT}` +
            `?url=${encodeURIComponent(
                normalized
            )}`
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
                ...product
                    .productImageSet
                    .split(",")
                    .map(
                        value =>
                            value.trim()
                    )
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


        const existingProxy =
            images.find(
                isProxyUrl
            );


        if (
            existingProxy
        ) {

            return existingProxy;

        }


        if (
            images.length > 0
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
       14. PRODUCT NORMALIZATION
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
            ).trim();


        const pid =
            String(
                raw.pid ??
                raw.id ??
                raw.productId ??
                ""
            ).trim();


        const name =
            String(
                raw.title ??
                raw.name ??
                raw.productNameEn ??
                raw.productName ??
                "CJ Product"
            ).trim();


        if (
            !id ||
            !name
        ) {

            return null;

        }


        /* ---------------------------------------------------------------------
           Price
           --------------------------------------------------------------------- */

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
                ).replace(
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


        /* ---------------------------------------------------------------------
           Inventory
           --------------------------------------------------------------------- */

        const parsedQuantity =
            Number(
                raw.quantity ??
                raw.inventory ??
                raw.totalInventory ??
                raw.warehouseInventoryNum ??
                raw.totalVerifiedInventory ??
                0
            );


        const quantity =
            Number.isFinite(
                parsedQuantity
            )
                ? Math.max(
                    0,
                    Math.floor(
                        parsedQuantity
                    )
                )
                : 0;


        /* ---------------------------------------------------------------------
           Rating
           --------------------------------------------------------------------- */

        const parsedRating =
            parseFloat(
                raw.rating
            );


        const rating =
            Number.isFinite(
                parsedRating
            )
                ? Number(
                    Math.max(
                        0,
                        Math.min(
                            5,
                            parsedRating
                        )
                    ).toFixed(
                        1
                    )
                )
                : 0;


        /* ---------------------------------------------------------------------
           Images
           --------------------------------------------------------------------- */

        const image =
            getPrimaryImage(
                raw
            );


        const images =
            getGalleryImages(
                raw
            );


        /* ---------------------------------------------------------------------
           Variants
           --------------------------------------------------------------------- */

        const variants =
            Array.isArray(
                raw.variants
            )
                ? raw.variants.map(
                    variant => ({

                        vid:
                            String(
                                variant?.vid ||
                                ""
                            ),

                        sku:
                            String(
                                variant?.sku ||
                                variant?.variantSku ||
                                ""
                            ),

                        name:
                            String(
                                variant?.name ||
                                variant?.variantNameEn ||
                                "Default"
                            ),

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
                )
                : [];


        return {

            ...raw,

            id,

            pid,

            cj_id:
                String(
                    raw.cj_id ||
                    raw.cjId ||
                    pid
                ),

            sku:
                String(
                    raw.sku ||
                    raw.productSku ||
                    ""
                ),

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
                    CONFIG.DEFAULT_CATEGORY
                ),

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
                        .filter(Boolean)
                    : [],

            variants,

            rating,

            source:
                "CJ Dropshipping"

        };

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


    /* =========================================================================
       15. PAGE HEADING
       ========================================================================= */

    function updatePageHeading(
        query
    ) {

        const heading =
            elements.pageHeading ||
            document.getElementById(
                "page-heading"
            );


        if (
            !heading
        ) {

            return;

        }


        if (
            !query
        ) {

            heading.textContent =
                "Featured Products";

            return;

        }


        const category =
            CATEGORY_MAP.find(
                item =>
                    item.query ===
                    query
            );


        if (
            category
        ) {

            heading.textContent =
                category.label;

        } else {

            heading.textContent =
                `Search Results for "${query}"`;

        }

    }


    /* =========================================================================
       16. FILTER / SORT
       ========================================================================= */

    function applyFiltersAndRender() {

        let products =
            [
                ...state.products
            ];


        const localQuery =
            String(
                state.searchQuery ||
                ""
            )
                .trim()
                .toLowerCase();


        /*
         * Worker performs the primary search.
         * Local filtering is only a compatibility fallback.
         */

        if (
            localQuery
        ) {

            products =
                products.filter(
                    product => {

                        const searchable =
                            [

                                product.name,

                                product.title,

                                product.category,

                                product.sku,

                                product.pid,

                                stripHtml(
                                    product.description
                                )

                            ]
                                .map(
                                    value =>
                                        String(
                                            value ||
                                            ""
                                        ).toLowerCase()
                                )
                                .join(" ");


                        return searchable.includes(
                            localQuery
                        );

                    }
                );

        }


        /*
         * Category local filtering.
         *
         * Normally the Worker already returns the category-filtered
         * data because the category uses a search query.
         */

        if (
            state.activeCategoryQuery &&
            !state.searchQuery
        ) {

            const categoryQuery =
                state.activeCategoryQuery
                    .toLowerCase()
                    .trim();


            if (
                categoryQuery
            ) {

                products =
                    products.filter(
                        product => {

                            const searchable =
                                (

                                    String(
                                        product.name ||
                                        ""
                                    ) +

                                    " " +

                                    String(
                                        product.category ||
                                        ""
                                    ) +

                                    " " +

                                    stripHtml(
                                        product.description
                                    )

                                ).toLowerCase();


                            return searchable.includes(
                                categoryQuery
                            );

                        }
                    );

            }

        }


        products.sort(
            compareProducts
        );


        state.filteredProducts =
            products;


        if (
            products.length ===
            0
        ) {

            const query =
                state.searchQuery ||
                state.activeCategoryQuery ||
                "";


            renderEmptyState(
                query
                    ? `No available products found for "${query}".`
                    : "No active CJ products are available."
            );


            return;

        }


        renderProductGrid();

        updateResultsCount();

    }


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


        return 0;

    }


    /* =========================================================================
       17. PRODUCT GRID
       ========================================================================= */

    function renderProductGrid() {

        const productList =
            elements.productList ||
            document.getElementById(
                "product-list"
            );


        if (
            !productList
        ) {

            return;

        }


        productList.innerHTML =
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


    /* =========================================================================
       18. PRODUCT CARD
       ========================================================================= */

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


        const price =
            formatPrice(
                product.price
            );


        const quantity =
            Number(
                product.quantity
            );


        const available =
            Number.isFinite(
                quantity
            ) &&
            quantity > 0;


        const productUrl =
            `${CONFIG.PRODUCT_PAGE}?id=${encodeURIComponent(
                String(
                    product.id
                )
            )}`;


        const rating =
            Number(
                product.rating
            ) || 0;


        const descriptionText =
            stripHtml(
                product.description
            );


        const shortDescription =
            descriptionText.length > 120
                ? `${descriptionText.slice(
                    0,
                    120
                )}...`
                : (
                    descriptionText ||
                    "CJ product information available."
                );


        return `

            <article
                class="product-card"
                data-product-id="${productId}"
            >

                <a
                    href="${escapeHTML(
                        productUrl
                    )}"
                    class="product-card-image-wrap"
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

                </a>


                <div
                    class="product-card-body"
                >

                    <h3
                        class="product-title"
                    >

                        <a
                            href="${escapeHTML(
                                productUrl
                            )}"
                        >
                            ${title}
                        </a>

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

                            <a
                                href="${escapeHTML(
                                    productUrl
                                )}"
                                class="btn-card btn-secondary"
                            >

                                ${svgIcon(
                                    "eye",
                                    "ui-icon ui-icon-sm"
                                )}

                                <span>
                                    View Details
                                </span>

                            </a>


                            <button
                                type="button"
                                class="btn-card btn-primary btn-add-to-cart add-to-cart-btn"
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
                                        ? "add_cart"
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
       19. IMAGE FALLBACKS
       ========================================================================= */

    function attachProductImageFallbacks() {

        const images =
            document.querySelectorAll(
                ".product-image"
            );


        images.forEach(
            image => {

                image.addEventListener(
                    "error",
                    handleProductImageError
                );

            }
        );

    }


    function handleProductImageError(
        event
    ) {

        const image =
            event.currentTarget;


        if (
            !image
        ) {

            return;

        }


        /*
         * Try original CJ image through Cloudflare Worker.
         */

        const original =
            image.dataset.originalImage;


        if (
            original &&
            !image.dataset.originalAttempted
        ) {

            image.dataset.originalAttempted =
                "true";


            const proxiedOriginal =
                buildProxyUrl(
                    original
                );


            if (
                proxiedOriginal &&
                proxiedOriginal !==
                    image.src
            ) {

                image.src =
                    proxiedOriginal;

                return;

            }

        }


        /*
         * Final local placeholder.
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
       20. CART INTEGRATION
       ========================================================================= */

    function handleProductGridClick(
        event
    ) {

        const button =
            event.target.closest(
                ".add-to-cart-btn"
            );


        if (
            !button
        ) {

            return;

        }


        event.preventDefault();

        event.stopPropagation();


        const productId =
            String(
                button.dataset.productId ||
                ""
            );


        if (
            !productId
        ) {

            return;

        }


        const product =
            state.products.find(
                current =>
                    String(
                        current.id
                    ) ===
                    productId
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

            announceToScreenReader(
                `${product.name} is currently out of stock.`
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

                const customEvent =
                    new CustomEvent(
                        "cart:add",
                        {
                            detail:
                                product
                        }
                    );


                document.dispatchEvent(
                    customEvent
                );


                added =
                    true;

            } catch (
                error
            ) {

                console.error(
                    "[PRASUN SHOP] Cart event error:",
                    error
                );

                added =
                    false;

            }

        }


        if (
            !added
        ) {

            return;

        }


        button.disabled =
            true;


        button.classList.add(
            "added"
        );


        button.innerHTML = `

            ${svgIcon(
                "check",
                "ui-icon ui-icon-sm"
            )}

            <span>
                Added
            </span>

        `;


        announceToScreenReader(
            `${product.name} added to cart.`
        );


        window.setTimeout(
            () => {

                button.disabled =
                    false;


                button.classList.remove(
                    "added"
                );


                button.innerHTML = `

                    ${svgIcon(
                        "add_cart",
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
       21. UI STATES
       ========================================================================= */

    function renderLoadingState() {

        const productList =
            elements.productList ||
            document.getElementById(
                "product-list"
            );


        if (
            !productList
        ) {

            return;

        }


        productList.innerHTML = `

            <div
                class="product-status-card products-empty"
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
                    Fetching the latest available products.
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

        const productList =
            elements.productList ||
            document.getElementById(
                "product-list"
            );


        if (
            !productList
        ) {

            return;

        }


        productList.innerHTML = `

            <div
                class="product-status-card products-empty"
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

        const productList =
            elements.productList ||
            document.getElementById(
                "product-list"
            );


        if (
            !productList
        ) {

            return;

        }


        productList.innerHTML = `

            <div
                class="product-status-card products-error"
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
                    data-action="retry-products"
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


        if (
            elements.resultsCount
        ) {

            elements.resultsCount.textContent =
                "Unable to load products";

        }


        setLoadingState(
            false
        );


        const retry =
            productList.querySelector(
                '[data-action="retry-products"]'
            );


        if (
            retry
        ) {

            retry.addEventListener(
                "click",
                () => {

                    loadProducts(
                        state.searchQuery ||
                        state.activeCategoryQuery
                    );

                },
                {
                    once:
                        true
                }
            );

        }

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


    function setLoadingState(
        loading
    ) {

        if (
            !elements.productList
        ) {

            return;

        }


        elements.productList.setAttribute(
            "aria-busy",
            loading
                ? "true"
                : "false"
        );

    }


    /* =========================================================================
       22. TEXT HELPERS
       ========================================================================= */

    function stripHtml(
        value
    ) {

        if (
            !value
        ) {

            return "";

        }


        const container =
            document.createElement(
                "div"
            );


        container.innerHTML =
            String(
                value
            );


        return (
            container.textContent ||
            container.innerText ||
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
        ).format(
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


    function announceToScreenReader(
        message
    ) {

        const liveRegion =
            elements.liveRegion ||
            document.getElementById(
                "aria-live-region"
            );


        if (
            !liveRegion
        ) {

            return;

        }


        liveRegion.textContent =
            "";


        window.setTimeout(
            () => {

                liveRegion.textContent =
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
                loadProducts(
                    state.searchQuery ||
                    state.activeCategoryQuery
                ),


        search:
            query => {

                state.searchQuery =
                    String(
                        query ||
                        ""
                    ).trim();


                state.activeCategoryQuery =
                    "";


                if (
                    elements.searchInput
                ) {

                    elements.searchInput.value =
                        state.searchQuery;

                }


                updateClearSearchButton();


                highlightActiveCategoryPill(
                    ""
                );


                return loadProducts(
                    state.searchQuery
                );

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
