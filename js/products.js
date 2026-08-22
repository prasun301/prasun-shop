/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS MANAGER
 * ============================================================================
 *
 * File:
 *   js/products.js
 *
 * ARCHITECTURE
 * ============================================================================
 *
 *   index.html
 *       |
 *       v
 *   STATIC PRODUCT CATALOG
 *       |
 *       +---- Search
 *       |
 *       +---- Categories
 *       |
 *       +---- Sorting
 *       |
 *       v
 *   Product Cards
 *       |
 *       v
 *   WED2C
 *       |
 *       +---- Product / Variants
 *       +---- Cart
 *       +---- Checkout
 *       +---- Payment
 *       +---- Fulfillment
 *
 * IMPORTANT
 * ============================================================================
 *
 * There is NO Cloudflare Worker.
 * There is NO /api/products request.
 * There is NO /api/order request.
 * There is NO CJ checkout logic.
 * There is NO custom cart logic.
 *
 * WED2C handles the transaction after the customer clicks the WED2C button.
 *
 * IMPORTANT LIMITATION
 * ============================================================================
 *
 * This file can only display products that exist inside PRODUCT_CATALOG.
 *
 * Your previous products.js did NOT contain the complete product catalog;
 * it loaded products from the Cloudflare Worker. Therefore this file includes
 * the verified WED2C product you supplied, but it does NOT fabricate the rest
 * of the old CJ catalog.
 *
 * Add additional products to PRODUCT_CATALOG as they are added to WED2C.
 * Each WED2C product should have either:
 *
 *   1. wed2cUrl
 *
 * OR:
 *
 *   2. jobsProductId + recommendProductId
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const CONFIG = {

        STORE_URL:
            "https://prasunshop.wed2c.com",

        WED2C_HY_ID:
            "kibt-fe-cj",

        DEFAULT_CATEGORY:
            "General",

        DEFAULT_SORT:
            "featured",

        MAX_VISIBLE_PRODUCTS:
            300

    };


    /* =========================================================================
   2. STATIC PRODUCT CATALOG
   =========================================================================
   IMPORTANT:
   Add your WED2C products here.
   ========================================================================= */

const PRODUCT_CATALOG = [

   {
    id: "1615328471586897920",

    name: "Solar Garden Light Waterproof Garden Lawn",

    category: "Solar Lights",

    price: 44.71,

    image:
        "https://cf.cjdropshipping.com/20652083-f3a5-4a12-ab41-af445124bb13.jpg",

    description:
        "Solar garden light suitable for outdoor garden and lawn applications.",

    jobsProductId:
        "1615328471586897920",

    recommendProductId:
        "2608221241380345100",

    wed2cUrl:
        "https://prasunshop.wed2c.com/goodsDetails?jobsProductId=1615328471586897920&recommendProductId=2608221241380345100&hyId=kibt-fe-cj",

    wed2cShareUrl:
        "https://prasunshop.wed2c.com/s/2GOGZubPOVn"
},

    {
    id: "1682031865621594112",

    name: "LED Solar Wall Light",

    category: "Solar Lights",

    price: 11.74,

    image: "",

    description:
        "LED solar wall light with multiple quantity and lamp options.",

    jobsProductId:
        "1682031865621594112",

    recommendProductId:
        "2608221741420326500",

    wed2cUrl:
        "https://prasunshop.wed2c.com/goodsDetails?jobsProductId=1682031865621594112&recommendProductId=2608221741420326500&hyId=kibt-fe-cj",

    wed2cShareUrl:
        "https://prasunshop.wed2c.com/s/2GOGZubPOVn"
},


/* =========================================================================
   3. STOREFRONT CATEGORIES
   ========================================================================= */

const CATEGORY_MAP = [

    {
        label: "All Products",
        query: "",
        icon: "apps"
    },

    {
        label: "Solar Lights",
        query: "solar-lights",
        icon: "solar"
    },

    {
        label: "Battery",
        query: "battery",
        icon: "battery"
    },

    {
        label: "Chargers",
        query: "chargers",
        icon: "charger"
    },

    {
        label: "Power Bank",
        query: "power-bank",
        icon: "powerbank"
    },

    {
        label: "Cables",
        query: "cables",
        icon: "cable"
    },

    {
        label: "Earphones",
        query: "earphones",
        icon: "earphone"
    },

    {
        label: "Headphones",
        query: "headphones",
        icon: "headphone"
    },

    {
        label: "Modem",
        query: "modem",
        icon: "modem"
    },

    {
        label: "Routers",
        query: "routers",
        icon: "router"
    },

    {
        label: "Laptops",
        query: "laptops",
        icon: "laptop"
    },

    {
        label: "Power Tools",
        query: "power-tools",
        icon: "tool"
    },

    {
        label: "Camera",
        query: "camera",
        icon: "camera"
    },

    {
        label: "Smart Home",
        query: "smart-home",
        icon: "home"
    }

];

    /* =========================================================================
       4. PLACEHOLDER
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
                    d="M180 335 L265 255 L325 315 L385 270 L430 335 Z"
                    fill="#cbd5e1"
                />

                <text
                    x="300"
                    y="430"
                    text-anchor="middle"
                    font-family="Arial,sans-serif"
                    font-size="24"
                    fill="#64748b"
                >
                    Image Unavailable
                </text>
            </svg>
        `);


    /* =========================================================================
       5. STATE
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

        initialized:
            false

    };


    /* =========================================================================
       6. DOM
       ========================================================================= */

    const elements = {

        productList:
            null,

        resultsCount:
            null,

        searchInput:
            null,

        clearSearch:
            null,

        sortSelect:
            null,

        categories:
            null,

        pageHeading:
            null,

        liveRegion:
            null

    };


    /* =========================================================================
       7. INITIALIZE
       ========================================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );

    } else {

        initialize();

    }


    function initialize() {

        if (state.initialized) {
            return;
        }

        state.initialized =
            true;

        cacheDOM();

        state.sortBy =
            elements.sortSelect?.value ||
            CONFIG.DEFAULT_SORT;

        /*
         * IMPORTANT:
         * Product data comes ONLY from the local static catalog.
         */
        state.products =
            PRODUCT_CATALOG
                .map(normalizeProduct)
                .filter(Boolean);

        renderCategories();

        bindEvents();

        updateClearSearch();

        applyFilters();

    }


    /* =========================================================================
       8. DOM CACHE
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

        elements.clearSearch =
            document.getElementById(
                "clear-search"
            );

        elements.sortSelect =
            document.getElementById(
                "product-sort"
            );

        elements.categories =
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


    /* =========================================================================
       9. EVENTS
       ========================================================================= */

    function bindEvents() {

        elements.searchInput?.addEventListener(
            "input",
            event => {

                state.searchQuery =
                    normalizeText(
                        event.target.value
                    );

                state.activeCategory =
                    "";

                highlightCategories();

                updateClearSearch();

                applyFilters();

            }
        );


        elements.clearSearch?.addEventListener(
            "click",
            () => {

                clearSearch();

            }
        );


        elements.sortSelect?.addEventListener(
            "change",
            event => {

                state.sortBy =
                    event.target.value ||
                    CONFIG.DEFAULT_SORT;

                applyFilters();

            }
        );


        elements.categories?.addEventListener(
            "click",
            handleCategoryClick
        );


        elements.productList?.addEventListener(
            "click",
            handleProductClick
        );

    }


    /* =========================================================================
       10. CATEGORIES
       ========================================================================= */

    function renderCategories() {

        if (!elements.categories) {
            return;
        }

        elements.categories.innerHTML =
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
                                data-category="${escapeHTML(category.query)}"
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


    function handleCategoryClick(event) {

        const button =
            event.target.closest(
                ".category-pill"
            );

        if (!button) {
            return;
        }

        state.activeCategory =
            String(
                button.dataset.category ||
                ""
            );

        state.searchQuery =
            "";

        if (elements.searchInput) {

            elements.searchInput.value =
                "";

        }

        updateClearSearch();

        highlightCategories();

        applyFilters();

    }


    function highlightCategories() {

        elements.categories
            ?.querySelectorAll(
                ".category-pill"
            )
            .forEach(
                button => {

                    const active =
                        String(
                            button.dataset.category ||
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


    /* =========================================================================
       11. SEARCH
       ========================================================================= */

    function clearSearch() {

        state.searchQuery =
            "";

        if (elements.searchInput) {

            elements.searchInput.value =
                "";

        }

        updateClearSearch();

        applyFilters();

        elements.searchInput?.focus();

    }


    function updateClearSearch() {

        if (!elements.clearSearch) {
            return;
        }

        elements.clearSearch.hidden =
            !state.searchQuery;

    }


    /* =========================================================================
       12. FILTERING
       ========================================================================= */

    function applyFilters() {

        let products =
            [...state.products];


        /*
         * Category filtering.
         */
        if (state.activeCategory) {

            products =
                products.filter(
                    product =>
                        matchesCategory(
                            product,
                            state.activeCategory
                        )
                );

        }


        /*
         * Search filtering.
         */
        if (state.searchQuery) {

            const terms =
                state.searchQuery
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 12);

            products =
                products.filter(
                    product => {

                        const searchText =
                            buildSearchText(
                                product
                            );

                        return terms.every(
                            term =>
                                searchText.includes(
                                    term
                                )
                        );

                    }
                );

        }


        /*
         * Sorting.
         */
        products.sort(
            sortProducts
        );


        state.filteredProducts =
            products.slice(
                0,
                CONFIG.MAX_VISIBLE_PRODUCTS
            );


        updatePageHeading();

        updateResultsCount();

        renderProducts();

    }


    function matchesCategory(
        product,
        categoryId
    ) {

        if (!categoryId) {
            return true;
        }

        const categories =
            Array.isArray(
                product.storeCategories
            )
                ? product.storeCategories
                : [];

        if (
            categories.includes(
                categoryId
            )
        ) {
            return true;
        }


        const text =
            normalizeText(
                [
                    product.name,
                    product.title,
                    product.category,
                    product.categoryName,
                    product.description
                ]
                    .join(" ")
            );


        switch (categoryId) {

            case "solar-lights":

                return (
                    /\bsolar\b/.test(text) &&
                    (
                        /\blight\b/.test(text) ||
                        /\blamp\b/.test(text) ||
                        /\bled\b/.test(text) ||
                        /\bgarden\b/.test(text) ||
                        /\bflood\b/.test(text) ||
                        /\bspotlight\b/.test(text)
                    )
                );


            case "camera":

                return (
                    /\bcamera\b/.test(text) ||
                    /\bcctv\b/.test(text) ||
                    /\bwebcam\b/.test(text) ||
                    /\bdash\s*cam\b/.test(text)
                );


            case "battery":

                return (
                    /\bbattery\b/.test(text) ||
                    /\bbatteries\b/.test(text) ||
                    /\blifepo4\b/.test(text) ||
                    /\b18650\b/.test(text) ||
                    /\b21700\b/.test(text)
                );


            case "power-bank":

                return (
                    /\bpower\s*bank\b/.test(text) ||
                    /\bpowerbank\b/.test(text) ||
                    /\bportable\s+charger\b/.test(text)
                );


            case "chargers":

                return (
                    /\bcharger\b/.test(text) ||
                    /\bcharging\b/.test(text)
                );


            case "cables":

                return (
                    /\bcable\b/.test(text) ||
                    /\busb[\s-]*c\b/.test(text) ||
                    /\bhdmi\b/.test(text) ||
                    /\blightning\b/.test(text) ||
                    /\bethernet\b/.test(text)
                );


            case "earphones":

                return (
                    /\bearphone\b/.test(text) ||
                    /\bearbud\b/.test(text) ||
                    /\btws\b/.test(text) ||
                    /\btrue\s+wireless\b/.test(text)
                );


            case "headphones":

                return (
                    /\bheadphone\b/.test(text) ||
                    /\bheadset\b/.test(text) ||
                    /\bover[\s-]?ear\b/.test(text)
                );


            case "modem":

                return /\bmodem\b/.test(text);


            case "routers":

                return (
                    /\brouter\b/.test(text) ||
                    /\bmesh\s+router\b/.test(text)
                );


            case "laptops":

                return (
                    /\blaptop\b/.test(text) ||
                    /\bnotebook\b/.test(text) ||
                    /\bchromebook\b/.test(text) ||
                    /\bmacbook\b/.test(text)
                );


            case "power-tools":

                return (
                    /\bdrill\b/.test(text) ||
                    /\bgrinder\b/.test(text) ||
                    /\bscrewdriver\b/.test(text) ||
                    /\bwrench\b/.test(text) ||
                    /\bsaw\b/.test(text) ||
                    /\bsander\b/.test(text) ||
                    /\bpower\s*tool\b/.test(text)
                );


            case "smart-home":

                return (
                    /\bsmart\s+(home|plug|switch|socket|bulb|lock|sensor|relay)\b/
                        .test(text)
                );


            default:

                return false;

        }

    }


    function buildSearchText(
        product
    ) {

        return normalizeText(
            [
                product.name,
                product.title,
                product.description,
                product.category,
                product.categoryName,
                ...(product.storeCategories || []),
                product.sku,
                product.pid
            ]
                .filter(Boolean)
                .join(" ")
        );

    }


    /* =========================================================================
       13. SORTING
       ========================================================================= */

    function sortProducts(
        a,
        b
    ) {

        const value =
            normalizeText(
                state.sortBy
            );


        if (
            value.includes(
                "price: low"
            ) ||
            value.includes(
                "price low"
            )
        ) {

            return (
                Number(a.price || 0) -
                Number(b.price || 0)
            );

        }


        if (
            value.includes(
                "price: high"
            ) ||
            value.includes(
                "price high"
            )
        ) {

            return (
                Number(b.price || 0) -
                Number(a.price || 0)
            );

        }


        if (
            value.includes(
                "a to z"
            )
        ) {

            return String(
                a.name
            ).localeCompare(
                String(b.name),
                undefined,
                {
                    sensitivity:
                        "base"
                }
            );

        }


        if (
            value.includes(
                "z to a"
            )
        ) {

            return String(
                b.name
            ).localeCompare(
                String(a.name),
                undefined,
                {
                    sensitivity:
                        "base"
                }
            );

        }


        /*
         * Featured:
         * Keep static catalog order.
         */
        return 0;

    }


    /* =========================================================================
       14. PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(
        product
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {
            return null;
        }


        const id =
            String(
                product.id ||
                product.pid ||
                product.sku ||
                ""
            ).trim();


        if (!id) {
            return null;
        }


        const name =
            String(
                product.name ||
                product.title ||
                "Product"
            ).trim();


        const image =
            normalizeUrl(
                product.image
            ) ||
            PLACEHOLDER_IMAGE;


        const variants =
            Array.isArray(
                product.variants
            )
                ? product.variants
                : [];


        const storeCategories =
            Array.isArray(
                product.storeCategories
            )
                ? [
                    ...new Set(
                        product.storeCategories
                            .map(
                                value =>
                                    String(
                                        value || ""
                                    ).trim()
                            )
                            .filter(Boolean)
                    )
                ]
                : [];


        return {

            ...product,

            id,

            pid:
                String(
                    product.pid ||
                    product.id ||
                    ""
                ),

            name,

            title:
                name,

            category:
                String(
                    product.category ||
                    CONFIG.DEFAULT_CATEGORY
                ),

            price:
                Number(
                    product.price
                ) || 0,

            quantity:
                Number(
                    product.quantity
                ) || 0,

            image,

            storeCategories,

            variants

        };

    }


    /* =========================================================================
       15. WED2C
       ========================================================================= */

    function getWED2CUrl(
        product
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {
            return CONFIG.STORE_URL;
        }


        /*
         * 1. Explicit WED2C URL.
         */
        const explicit =
            cleanString(
                product.wed2cUrl
            );


        if (
            isAllowedWED2CUrl(
                explicit
            )
        ) {
            return explicit;
        }


        /*
         * 2. Build from WED2C IDs.
         */
        if (
            product.jobsProductId &&
            product.recommendProductId
        ) {

            return buildWED2CUrl(
                product.jobsProductId,
                product.recommendProductId
            );

        }


        /*
         * 3. Legacy WED2C share URL.
         */
        const share =
            cleanString(
                product.wed2cShareUrl
            );


        if (
            isAllowedWED2CUrl(
                share
            )
        ) {
            return share;
        }


        /*
         * 4. Safe fallback.
         */
        return CONFIG.STORE_URL;

    }


    function buildWED2CUrl(
        jobsProductId,
        recommendProductId
    ) {

        return (
            `${CONFIG.STORE_URL}/goodsDetails` +
            `?jobsProductId=${encodeURIComponent(
                jobsProductId
            )}` +
            `&recommendProductId=${encodeURIComponent(
                recommendProductId
            )}` +
            `&hyId=${encodeURIComponent(
                CONFIG.WED2C_HY_ID
            )}`
        );

    }


    function isAllowedWED2CUrl(
        value
    ) {

        if (!value) {
            return false;
        }

        try {

            const url =
                new URL(
                    value,
                    window.location.href
                );

            return (
                url.protocol ===
                    "https:" &&
                (
                    url.hostname ===
                        "prasunshop.wed2c.com" ||
                    url.hostname.endsWith(
                        ".wed2c.com"
                    )
                )
            );

        } catch {

            return false;

        }

    }


    /* =========================================================================
       16. PRODUCT RENDERING
       ========================================================================= */

    function renderProducts() {

        if (
            !elements.productList
        ) {
            return;
        }


        const products =
            state.filteredProducts;


        if (!products.length) {

            renderEmptyState();

            return;

        }


        elements.productList.innerHTML =
            products
                .map(
                    product =>
                        renderProductCard(
                            product
                        )
                )
                .join("");


        bindImageFallbacks();

    }


    function renderProductCard(
        product
    ) {

        const title =
            escapeHTML(
                product.name
            );


        const image =
            escapeHTML(
                product.image
            );


        const price =
            formatPrice(
                product.price
            );


        const category =
            escapeHTML(
                product.category
            );


        const url =
            getWED2CUrl(
                product
            );


        return `
            <article
                class="product-card"
                data-product-id="${escapeHTML(
                    product.id
                )}"
            >

                <a
                    href="${escapeHTML(
                        url
                    )}"
                    class="product-card-image-wrap"
                    target="_self"
                    rel="noopener"
                    aria-label="View ${title} on WED2C"
                >

                    <span class="product-badge">

                        ${svgIcon(
                            product.category ===
                            "Solar Lights"
                                ? "solar"
                                : "apps",
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
                    >

                </a>


                <div class="product-card-body">


                    <h3 class="product-title">

                        <a
                            href="${escapeHTML(
                                url
                            )}"
                        >
                            ${title}
                        </a>

                    </h3>


                    <p class="product-card-description">
                        ${escapeHTML(
                            product.description ||
                            "Product information available."
                        )}
                    </p>


                    ${
                        product.variants.length
                            ? `
                                <div class="product-variant-count">
                                    ${
                                        product.variants.length
                                    }
                                    ${
                                        product.variants.length === 1
                                            ? "variant"
                                            : "variants"
                                    }
                                </div>
                            `
                            : ""
                    }


                    <div class="product-card-footer">


                        <div class="price-container">

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
                                    url
                                )}"
                                class="btn-card btn-primary btn-wed2c buy-now-button"
                                target="_self"
                                rel="noopener"
                                aria-label="Buy ${title} on WED2C"
                            >

                                ${svgIcon(
                                    "cart",
                                    "ui-icon ui-icon-sm"
                                )}

                                <span>
                                    ${
                                        product.jobsProductId &&
                                        product.recommendProductId
                                            ? "Buy on WED2C"
                                            : "Shop on WED2C"
                                    }
                                </span>

                            </a>

                        </div>

                    </div>

                </div>

            </article>
        `;

    }


    function handleProductClick(
        event
    ) {

        /*
         * Product cards use normal WED2C links.
         * No custom cart handling is necessary.
         */

        const retry =
            event.target.closest(
                '[data-action="retry"]'
            );


        if (retry) {

            event.preventDefault();

            applyFilters();

        }

    }


    /* =========================================================================
       17. UI
       ========================================================================= */

    function updatePageHeading() {

        if (
            !elements.pageHeading
        ) {
            return;
        }


        if (
            state.activeCategory
        ) {

            const category =
                CATEGORY_MAP.find(
                    item =>
                        item.query ===
                        state.activeCategory
                );


            elements.pageHeading.textContent =
                category
                    ? category.label
                    : "Products";


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
            }`;

    }


    function renderEmptyState() {

        elements.productList.innerHTML = `
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
                    ${
                        state.searchQuery
                            ? `No products found for "${escapeHTML(
                                state.searchQuery
                            )}".`
                            : state.activeCategory
                                ? `No products are currently available in "${escapeHTML(
                                    getCategoryLabel(
                                        state.activeCategory
                                    )
                                )}".`
                                : "No products are currently available."
                    }
                </p>

            </div>
        `;

    }


    function getCategoryLabel(
        query
    ) {

        const category =
            CATEGORY_MAP.find(
                item =>
                    item.query ===
                    query
            );


        return (
            category?.label ||
            "this category"
        );

    }


    /* =========================================================================
       18. IMAGES
       ========================================================================= */

    function bindImageFallbacks() {

        elements.productList
            ?.querySelectorAll(
                ".product-image"
            )
            .forEach(
                image => {

                    image.addEventListener(
                        "error",
                        () => {

                            if (
                                image.dataset.failed ===
                                "true"
                            ) {
                                return;
                            }


                            image.dataset.failed =
                                "true";


                            image.src =
                                PLACEHOLDER_IMAGE;

                        },
                        {
                            once:
                                true
                        }
                    );

                }
            );

    }


    function normalizeUrl(
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
            url.startsWith(
                "//"
            )
        ) {

            url =
                `https:${url}`;

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


    /* =========================================================================
       19. HELPERS
       ========================================================================= */

    function normalizeText(
        value
    ) {

        return String(
            value ||
            ""
        )
            .toLowerCase()
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
            ).format(
                number
            );

        } catch {

            return (
                "$" +
                number.toFixed(
                    2
                )
            );

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


    /* =========================================================================
       20. SVG ICONS
       ========================================================================= */

    function svgIcon(
        name,
        className
    ) {

        const safeClass =
            escapeHTML(
                className ||
                "ui-icon"
            );


        const icons = {

            apps: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <rect x="4" y="4" width="6" height="6" rx="1"/>
                    <rect x="14" y="4" width="6" height="6" rx="1"/>
                    <rect x="4" y="14" width="6" height="6" rx="1"/>
                    <rect x="14" y="14" width="6" height="6" rx="1"/>
                </svg>
            `,

            solar: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2"/>
                    <path d="M12 20v2"/>
                    <path d="M2 12h2"/>
                    <path d="M20 12h2"/>
                    <path d="m4.9 4.9 1.4 1.4"/>
                    <path d="m17.7 17.7 1.4 1.4"/>
                    <path d="m19.1 4.9-1.4 1.4"/>
                    <path d="m6.3 17.7-1.4 1.4"/>
                </svg>
            `,

            battery: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect x="3" y="7" width="17" height="10" rx="2"/>
                    <path d="M21 10v4"/>
                    <path d="M8 12h7"/>
                </svg>
            `,

            charger: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M9 2v6"/>
                    <path d="M15 2v6"/>
                    <path d="M7 8h10"/>
                    <path d="M12 8v14"/>
                </svg>
            `,

            powerbank: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                </svg>
            `,

            cable: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M7 3v5"/>
                    <path d="M17 16v5"/>
                    <path d="M7 8c0 5 10 3 10 8"/>
                    <path d="M5 3h4"/>
                    <path d="M15 21h4"/>
                </svg>
            `,

            earphone: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M7 13a4 4 0 1 1 4-4v7"/>
                    <path d="M17 13a4 4 0 1 0-4-4v7"/>
                </svg>
            `,

            headphone: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M4 15v-3a8 8 0 0 1 16 0v3"/>
                    <path d="M4 15h3v5H5a1 1 0 0 1-1-1z"/>
                    <path d="M20 15h-3v5h2a1 1 0 0 0 1-1z"/>
                </svg>
            `,

            modem: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <rect x="4" y="9" width="16" height="9" rx="2"/>
                    <path d="M8 13h.01"/>
                    <path d="M12 13h.01"/>
                    <path d="M16 13h.01"/>
                    <path d="M9 6h6"/>
                </svg>
            `,

            router: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <rect x="3" y="10" width="18" height="8" rx="2"/>
                    <path d="M8 10V7"/>
                    <path d="M16 10V7"/>
                    <path d="M6 14h.01"/>
                    <path d="M10 14h.01"/>
                    <path d="M14 14h.01"/>
                </svg>
            `,

            laptop: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <rect x="5" y="4" width="14" height="11" rx="1.5"/>
                    <path d="M3 19h18"/>
                    <path d="M8 19l1-3h6l1 3"/>
                </svg>
            `,

            tool: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M14 6a5 5 0 0 0-7 7l-4 4 4 4 4-4a5 5 0 0 0 7-7"/>
                    <path d="m13 11 4 4"/>
                </svg>
            `,

            camera: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <path d="M4 7h4l2-2h4l2 2h4v12H4z"/>
                    <circle cx="12" cy="13" r="3"/>
                </svg>
            `,

            home: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M3 11 12 4l9 7"/>
                    <path d="M5 10v10h14V10"/>
                    <path d="M9 20v-5h6v5"/>
                </svg>
            `,

            cart: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="9" cy="20" r="1"/>
                    <circle cx="19" cy="20" r="1"/>
                    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"/>
                    <path d="M16 4v5"/>
                    <path d="M13.5 6.5h5"/>
                </svg>
            `,

            inventory: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M4 7h16v13H4z"/>
                    <path d="M8 7V4h8v3"/>
                    <path d="M8 11h8"/>
                </svg>
            `

        };


        return (
            icons[name] ||
            icons.apps
        );

    }


    /* =========================================================================
       21. PUBLIC API
       ========================================================================= */

    window.PrasunProducts = {

        reload:
            () => {

                state.products =
                    PRODUCT_CATALOG
                        .map(normalizeProduct)
                        .filter(Boolean);

                applyFilters();

            },

        search:
            query => {

                state.searchQuery =
                    normalizeText(
                        query
                    );

                state.activeCategory =
                    "";

                if (
                    elements.searchInput
                ) {
                    elements.searchInput.value =
                        query || "";
                }

                highlightCategories();

                updateClearSearch();

                applyFilters();

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

                highlightCategories();

                updateClearSearch();

                applyFilters();

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

                applyFilters();

            },

        getProducts:
            () => [
                ...state.products
            ],

        getFilteredProducts:
            () => [
                ...state.filteredProducts
            ],

        getCategories:
            () => [
                ...CATEGORY_MAP
            ],

        getWED2CUrl:
            productId => {

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

                return getWED2CUrl(
                    product
                );

            },

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
                    state.sortBy

            })

    };

})();
