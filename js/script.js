/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY
 * ============================================================================
 *
 * Canonical cart:
 *     prasun_cart
 *
 * Features:
 * - Cloudflare Worker product API
 * - Local fallback catalog
 * - API timeout
 * - API response normalization
 * - Search
 * - Live API search
 * - Category filtering
 * - Sorting
 * - Add to cart
 * - Cart count synchronization
 * - Broken image protection
 * - Accessibility
 * - Search clear button
 * - Duplicate product protection
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIG
       ======================================================================== */

    const API_ENDPOINT =
        "./api/products";

    const CART_KEY =
        "prasun_cart";

    const CART_EVENT_NAME =
        "prasunCartUpdated";

    const API_TIMEOUT =
        8000;

    const SEARCH_DELAY =
        300;

    const MAX_CART_QUANTITY =
        99;


    /* ========================================================================
       DOM
       ======================================================================== */

    const productList =
        document.getElementById(
            "product-list"
        );

    if (!productList) {
        return;
    }

    const searchInput =
        document.getElementById(
            "product-search"
        );

    const clearSearchButton =
        document.getElementById(
            "clear-search"
        );

    const sortSelect =
        document.getElementById(
            "product-sort"
        );

    const categoriesContainer =
        document.getElementById(
            "products-categories"
        );

    const productsHeading =
        document.getElementById(
            "page-heading"
        );

    const productsCount =
        document.getElementById(
            "results-count"
        );

    const ariaLiveRegion =
        document.getElementById(
            "aria-live-region"
        );


    /* ========================================================================
       LOCAL FALLBACK CATALOG
       ======================================================================== */

    const LOCAL_CATALOG = [

        {
            id: "001",

            sku:
                "CJSN188416414NM",

            name:
                "G-Shaped Smart LED Atmosphere Lamp with Bluetooth Speaker & Wireless Charger",

            category:
                "Smart Lighting",

            price:
                29.99,

            rating:
                5,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",

            description:
                "Multifunctional smart LED atmosphere lamp with Bluetooth speaker, wireless charging, customizable lighting and alarm clock controls."
        },

        {
            id: "002",

            sku:
                "CJCD135893009IR",

            name:
                "Mini 5000mAh Magnetic Wireless Power Bank Fast Charging Portable Battery",

            category:
                "Power & Charging",

            price:
                39.99,

            rating:
                5,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",

            description:
                "Compact 5000mAh magnetic wireless power bank with fast charging, LED power display and portable design."
        },

        {
            id: "003",

            sku:
                "CJYP270967903CX",

            name:
                "High-Quality Noise Cancelling Wireless Bluetooth Sports Earbuds",

            category:
                "Audio",

            price:
                49.99,

            rating:
                5,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",

            description:
                "Wireless Bluetooth sports earbuds designed for workouts, travel, calls and low-latency entertainment."
        }

    ];


    /* ========================================================================
       FALLBACK IMAGE
       ======================================================================== */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="600"
                 height="600"
                 viewBox="0 0 600 600">

                <rect
                    width="600"
                    height="600"
                    fill="#f8fafc"
                />

                <text
                    x="300"
                    y="300"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#94a3b8"
                    font-family="Arial,sans-serif"
                    font-size="24"
                >
                    Image unavailable
                </text>

            </svg>
        `);


    /* ========================================================================
       ESCAPE HTML
       ======================================================================== */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).replace(
            /[&<>"']/g,
            character =>
                ESCAPE_MAP[character]
        );
    }


    /* ========================================================================
       CURRENCY
       ======================================================================== */

    const currencyFormatter =
        new Intl.NumberFormat(
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
        );

    function formatPrice(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }


    /* ========================================================================
       NORMALIZE PRODUCT
       ======================================================================== */

    function normalizeProduct(
        product,
        index = 0
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {
            return null;
        }

        const id =
            product.id ??
            product.pid ??
            product.productId ??
            product.productSku ??
            product.sku ??
            `product-${index + 1}`;

        const name =
            product.name ??
            product.productNameEn ??
            product.productName ??
            product.title ??
            "CJ Product";

        const sku =
            product.sku ??
            product.productSku ??
            product.productCode ??
            id;

        let price =
            product.price ??
            product.sellPrice ??
            product.startSellPrice ??
            product.productPrice ??
            0;

        price =
            parseFloat(
                String(price).replace(
                    /[^0-9.-]/g,
                    ""
                )
            );

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {
            price = 0;
        }

        let rating =
            Number(
                product.rating ??
                product.score ??
                5
            );

        if (!Number.isFinite(rating)) {
            rating = 5;
        }

        rating =
            Math.max(
                0,
                Math.min(
                    5,
                    rating
                )
            );

        const category =
            product.category ??
            product.categoryName ??
            product.categoryNameEn ??
            "General";

        const description =
            product.description ??
            product.productDescription ??
            product.descriptionEn ??
            "";

        let image =
            product.image ??
            product.productImage ??
            product.imageUrl ??
            product.productImageUrl ??
            product.imgUrl ??
            "";

        image =
            String(image || "").trim();

        if (
            image &&
            !/^https?:\/\//i.test(image) &&
            !image.startsWith("data:")
        ) {

            image =
                "https://" +
                image.replace(
                    /^\/+/,
                    ""
                );
        }

        return {

            id:
                String(id),

            sku:
                String(sku),

            name:
                String(name),

            category:
                String(category),

            price,

            rating,

            image,

            description:
                String(description),

            features:
                Array.isArray(
                    product.features
                )
                    ? product.features
                    : [],

            specifications:
                product.specifications &&
                typeof product.specifications ===
                    "object"
                    ? product.specifications
                    : {}

        };
    }


    /* ========================================================================
       EXTRACT PRODUCTS
       ======================================================================== */

    function extractProducts(data) {

        let list = null;

        if (Array.isArray(data)) {
            list = data;
        }

        else if (
            data &&
            Array.isArray(data.products)
        ) {
            list = data.products;
        }

        else if (
            data &&
            Array.isArray(data.data)
        ) {
            list = data.data;
        }

        else if (
            data?.data &&
            Array.isArray(
                data.data.list
            )
        ) {
            list = data.data.list;
        }

        else if (
            data?.data &&
            Array.isArray(
                data.data.products
            )
        ) {
            list =
                data.data.products;
        }

        else if (
            data &&
            typeof data === "object" &&
            (
                data.id ||
                data.pid ||
                data.productId ||
                data.productSku
            )
        ) {

            list = [
                data
            ];
        }

        if (!Array.isArray(list)) {
            return [];
        }

        return list
            .map(
                (item, index) =>
                    normalizeProduct(
                        item,
                        index
                    )
            )
            .filter(Boolean);
    }


    /* ========================================================================
       LOCAL PRODUCTS
       ======================================================================== */

    function getLocalProducts() {

        return LOCAL_CATALOG
            .map(
                (product, index) =>
                    normalizeProduct(
                        product,
                        index
                    )
            )
            .filter(Boolean);
    }


    /* ========================================================================
       FETCH JSON WITH TIMEOUT
       ======================================================================== */

    async function fetchJSON(
        url,
        timeout = API_TIMEOUT
    ) {

        const controller =
            new AbortController();

        const timeoutId =
            window.setTimeout(
                () =>
                    controller.abort(),
                timeout
            );

        try {

            const response =
                await fetch(
                    url,
                    {
                        method:
                            "GET",

                        headers: {
                            Accept:
                                "application/json"
                        },

                        cache:
                            "no-store",

                        signal:
                            controller.signal
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const text =
                await response.text();

            if (!text) {
                return null;
            }

            try {

                return JSON.parse(
                    text
                );

            } catch (_) {

                throw new Error(
                    "Invalid JSON response"
                );
            }

        } finally {

            window.clearTimeout(
                timeoutId
            );
        }
    }


    /* ========================================================================
       API PRODUCTS
       ======================================================================== */

    async function loadProductsFromAPI(
        keyword = ""
    ) {

        const url =
            new URL(
                API_ENDPOINT,
                window.location.href
            );

        if (keyword) {

            /*
             * Send several common parameter names.
             * The Worker can use whichever it supports.
             */
            url.searchParams.set(
                "keyword",
                keyword
            );

            url.searchParams.set(
                "q",
                keyword
            );
        }

        const data =
            await fetchJSON(
                url.toString()
            );

        const products =
            extractProducts(
                data
            );

        if (!products.length) {

            throw new Error(
                "API returned no products"
            );
        }

        return products;
    }


    /* ========================================================================
       MERGE PRODUCTS
       ======================================================================== */

    function mergeProducts(
        localProducts,
        apiProducts
    ) {

        const map =
            new Map();

        /*
         * Local products first.
         */
        localProducts.forEach(
            product => {

                if (
                    product?.id
                ) {

                    map.set(
                        String(product.id),
                        product
                    );
                }
            }
        );

        /*
         * API products overwrite matching IDs.
         */
        apiProducts.forEach(
            product => {

                if (
                    product?.id
                ) {

                    map.set(
                        String(product.id),
                        product
                    );
                }
            }
        );

        return Array.from(
            map.values()
        );
    }


    /* ========================================================================
       STATE
       ======================================================================== */

    let allProducts =
        [];

    let filteredProducts =
        [];

    let activeCategory =
        "all";

    let currentSearch =
        "";

    let currentSort =
        "featured";

    let searchTimer =
        null;

    let apiSearchRequestId =
        0;


    /* ========================================================================
       RENDER LOADING
       ======================================================================== */

    function renderLoading() {

        productList.setAttribute(
            "aria-busy",
            "true"
        );

        productList.innerHTML = `

            <div class="products-loading">

                <div
                    class="products-loading-spinner"
                    aria-hidden="true"
                ></div>

                <h2>
                    Loading products...
                </h2>

                <p>
                    Please wait while products are loaded.
                </p>

            </div>

        `;
    }


    /* ========================================================================
       FILTER
       ======================================================================== */

    function filterProducts() {

        const search =
            currentSearch
                .trim()
                .toLowerCase();

        filteredProducts =
            allProducts.filter(
                product => {

                    if (
                        activeCategory !==
                        "all"
                    ) {

                        if (
                            product.category
                                .toLowerCase() !==
                            activeCategory
                                .toLowerCase()
                        ) {
                            return false;
                        }
                    }

                    if (!search) {
                        return true;
                    }

                    const searchableText =
                        [
                            product.name,
                            product.category,
                            product.sku,
                            product.description
                        ]
                            .join(" ")
                            .toLowerCase();

                    return searchableText.includes(
                        search
                    );
                }
            );

        sortProducts();
    }


    /* ========================================================================
       SORT
       ======================================================================== */

    function sortProducts() {

        switch (
            currentSort
        ) {

            case "price-low":

                filteredProducts.sort(
                    (a, b) =>
                        a.price -
                        b.price
                );

                break;

            case "price-high":

                filteredProducts.sort(
                    (a, b) =>
                        b.price -
                        a.price
                );

                break;

            case "rating":

                filteredProducts.sort(
                    (a, b) =>
                        b.rating -
                        a.rating
                );

                break;

            case "name-az":

                filteredProducts.sort(
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
    }


    /* ========================================================================
       CATEGORY BUILD
       ======================================================================== */

    function buildCategories() {

        if (!categoriesContainer) {
            return;
        }

        const categoryMap =
            new Map();

        allProducts.forEach(
            product => {

                const category =
                    String(
                        product.category ||
                        ""
                    ).trim();

                if (!category) {
                    return;
                }

                const key =
                    category.toLowerCase();

                if (
                    !categoryMap.has(key)
                ) {

                    categoryMap.set(
                        key,
                        category
                    );
                }
            }
        );

        const categories =
            Array.from(
                categoryMap.values()
            ).sort(
                (a, b) =>
                    a.localeCompare(b)
            );

        categoriesContainer.innerHTML = `

            <button
                type="button"
                class="category-pill active"
                data-category="all"
                aria-pressed="true"
            >
                All
            </button>

            ${
                categories
                    .map(
                        category => `

                            <button
                                type="button"
                                class="category-pill"
                                data-category="${escapeHTML(
                                    category
                                )}"
                                aria-pressed="false"
                            >
                                ${escapeHTML(
                                    category
                                )}
                            </button>

                        `
                    )
                    .join("")
            }

        `;

        setActiveCategory(
            activeCategory
        );
    }


    /* ========================================================================
       CATEGORY STATE
       ======================================================================== */

    function setActiveCategory(
        category
    ) {

        activeCategory =
            category ||
            "all";

        if (!categoriesContainer) {
            return;
        }

        categoriesContainer
            .querySelectorAll(
                ".category-pill"
            )
            .forEach(
                button => {

                    const buttonCategory =
                        String(
                            button.dataset.category ||
                            "all"
                        );

                    const active =
                        buttonCategory.toLowerCase() ===
                        activeCategory.toLowerCase();

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


    /* ========================================================================
       STARS
       ======================================================================== */

    function renderStars(
        rating
    ) {

        const rounded =
            Math.round(
                Number(rating) || 0
            );

        const filled =
            Math.max(
                0,
                Math.min(
                    5,
                    rounded
                )
            );

        return (
            "★".repeat(filled) +
            "☆".repeat(
                5 - filled
            )
        );
    }


    /* ========================================================================
       PRODUCT CARD
       ======================================================================== */

    function createProductCard(
        product
    ) {

        const id =
            String(product.id);

        const encodedId =
            encodeURIComponent(id);

        const name =
            escapeHTML(
                product.name
            );

        const category =
            escapeHTML(
                product.category ||
                "Product"
            );

        const description =
            escapeHTML(
                product.description ||
                "Quality product from PRASUN SHOP."
            );

        const image =
            escapeHTML(
                product.image ||
                FALLBACK_IMAGE
            );

        const price =
            formatPrice(
                product.price
            );

        const rating =
            Number(
                product.rating
            ).toFixed(1);

        return `

            <article
                class="product-card"
                data-product-id="${escapeHTML(id)}"
            >

                <div class="product-card-inner">

                    <a
                        href="product.html?id=${encodedId}"
                        class="product-card-link"
                        aria-label="View ${name}"
                    >

                        <div class="product-card-image">

                            <span class="product-category">
                                ${category}
                            </span>

                            <img
                                src="${image}"
                                alt="${name}"
                                loading="lazy"
                                decoding="async"
                                data-product-image
                            >

                        </div>

                        <div class="product-card-body">

                            <span class="product-rating">

                                <span
                                    aria-hidden="true"
                                >
                                    ${renderStars(
                                        product.rating
                                    )}
                                </span>

                                <span>
                                    ${escapeHTML(
                                        rating
                                    )}
                                </span>

                            </span>

                            <h3 class="product-title">
                                ${name}
                            </h3>

                            <p class="product-description">
                                ${description}
                            </p>

                            <div class="product-bottom">

                                <span class="product-price">
                                    ${price}
                                </span>

                                <span class="product-view-button">
                                    View Product →
                                </span>

                            </div>

                        </div>

                    </a>

                    <div class="product-card-actions">

                        <button
                            type="button"
                            class="btn-add-to-cart"
                            data-action="add-to-cart"
                            data-product-id="${escapeHTML(id)}"
                            aria-label="Add ${name} to cart"
                        >
                            Add to Cart
                        </button>

                    </div>

                </div>

            </article>

        `;
    }


    /* ========================================================================
       EMPTY
       ======================================================================== */

    function renderEmpty() {

        productList.setAttribute(
            "aria-busy",
            "false"
        );

        productList.innerHTML = `

            <div class="products-empty">

                <div
                    class="products-empty-icon"
                    aria-hidden="true"
                >
                    🔎
                </div>

                <h2>
                    No products found
                </h2>

                <p>
                    Try another search term or category.
                </p>

                <button
                    type="button"
                    class="products-reset-button"
                    data-action="reset-filters"
                >
                    Clear Filters
                </button>

            </div>

        `;
    }


    /* ========================================================================
       RESULT BAR
       ======================================================================== */

    function updateResultBar() {

        if (productsHeading) {

            if (currentSearch) {

                productsHeading.textContent =
                    `Search results for "${currentSearch}"`;

            } else if (
                activeCategory !==
                "all"
            ) {

                productsHeading.textContent =
                    activeCategory;

            } else {

                productsHeading.textContent =
                    "All Products";
            }
        }

        if (productsCount) {

            const count =
                filteredProducts.length;

            productsCount.textContent =
                `${count} ${
                    count === 1
                        ? "product"
                        : "products"
                }`;
        }

        if (ariaLiveRegion) {

            const count =
                filteredProducts.length;

            ariaLiveRegion.textContent =
                `${count} ${
                    count === 1
                        ? "product"
                        : "products"
                } displayed.`;
        }
    }


    /* ========================================================================
       RENDER
       ======================================================================== */

    function renderProducts() {

        filterProducts();

        if (!filteredProducts.length) {

            renderEmpty();
            updateResultBar();

            return;
        }

        productList.innerHTML =
            filteredProducts
                .map(
                    createProductCard
                )
                .join("");

        productList.setAttribute(
            "aria-busy",
            "false"
        );

        updateResultBar();

        attachImageFallbacks();
    }


    /* ========================================================================
       IMAGE FALLBACK
       ======================================================================== */

    function attachImageFallbacks() {

        productList
            .querySelectorAll(
                "img[data-product-image]"
            )
            .forEach(
                image => {

                    image.addEventListener(
                        "error",
                        () => {

                            if (
                                image.dataset.fallbackApplied
                            ) {
                                return;
                            }

                            image.dataset.fallbackApplied =
                                "true";

                            image.src =
                                FALLBACK_IMAGE;

                        },
                        {
                            once: true
                        }
                    );

                }
            );
    }


    /* ========================================================================
       CART
       ======================================================================== */

    function readCart() {

        try {

            const raw =
                localStorage.getItem(
                    CART_KEY
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
        }
    }


    function saveCart(
        cart
    ) {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );

            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart:
                                cart.map(
                                    item => ({
                                        ...item
                                    })
                                )
                        }
                    }
                )
            );

            updateCartCount(
                cart
            );

            return true;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );

            return false;
        }
    }


    function updateCartCount(
        suppliedCart = null
    ) {

        const cart =
            suppliedCart ||
            readCart();

        const total =
            cart.reduce(
                (
                    sum,
                    item
                ) => {

                    const quantity =
                        Number(
                            item?.quantity
                        );

                    return sum +
                        (
                            Number.isFinite(quantity) &&
                            quantity > 0
                                ? Math.floor(quantity)
                                : 0
                        );
                },
                0
            );

        const element =
            document.getElementById(
                "cart-count"
            );

        if (!element) {
            return;
        }

        element.textContent =
            String(total);

        element.hidden =
            total === 0;

        element.setAttribute(
            "aria-label",
            `${total} ${
                total === 1
                    ? "item"
                    : "items"
            } in cart`
        );

        const cartLink =
            element.closest("a");

        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${
                        total === 1
                            ? "item"
                            : "items"
                    }`
                    : "View Shopping Cart"
            );
        }
    }


    /* ========================================================================
       ADD TO CART
       ======================================================================== */

    function addToCart(
        product
    ) {

        const cart =
            readCart();

        const productId =
            String(product.id);

        const existing =
            cart.find(
                item =>
                    String(item?.id) ===
                    productId
            );

        if (existing) {

            const currentQuantity =
                Number(
                    existing.quantity
                );

            existing.quantity =
                Math.min(
                    MAX_CART_QUANTITY,
                    (
                        Number.isFinite(
                            currentQuantity
                        )
                            ? Math.max(
                                1,
                                Math.floor(
                                    currentQuantity
                                )
                            )
                            : 1
                    ) + 1
                );

        } else {

            cart.push({

                id:
                    product.id,

                sku:
                    product.sku ||
                    product.id,

                name:
                    product.name,

                price:
                    Number(
                        product.price
                    ) || 0,

                image:
                    product.image ||
                    "",

                category:
                    product.category ||
                    "",

                description:
                    product.description ||
                    "",

                rating:
                    Number(
                        product.rating
                    ) || 5,

                features:
                    Array.isArray(
                        product.features
                    )
                        ? product.features
                        : [],

                specifications:
                    product.specifications &&
                    typeof product.specifications ===
                        "object"
                        ? product.specifications
                        : {},

                quantity:
                    1

            });
        }

        return saveCart(
            cart
        );
    }


    /* ========================================================================
       BUTTON FEEDBACK
       ======================================================================== */

    function showAddedFeedback(
        button
    ) {

        if (!button) {
            return;
        }

        if (
            button.dataset.busy ===
            "true"
        ) {
            return;
        }

        button.dataset.busy =
            "true";

        const originalText =
            button.textContent;

        button.textContent =
            "Added ✓";

        button.disabled =
            true;

        window.setTimeout(
            () => {

                button.textContent =
                    originalText;

                button.disabled =
                    false;

                button.dataset.busy =
                    "false";

            },
            1000
        );
    }


    /* ========================================================================
       PRODUCT LIST CLICK
       ======================================================================== */

    productList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "button[data-action]"
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            if (
                action ===
                "reset-filters"
            ) {

                currentSearch =
                    "";

                activeCategory =
                    "all";

                if (searchInput) {
                    searchInput.value =
                        "";
                }

                if (clearSearchButton) {
                    clearSearchButton.hidden =
                        true;
                }

                setActiveCategory(
                    "all"
                );

                renderProducts();

                return;
            }

            if (
                action !==
                "add-to-cart"
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

            const product =
                allProducts.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        productId
                );

            if (!product) {

                console.error(
                    "[PRASUN SHOP] Product not found:",
                    productId
                );

                return;
            }

            if (
                addToCart(product)
            ) {

                showAddedFeedback(
                    button
                );
            }
        }
    );


    /* ========================================================================
       SEARCH
       ======================================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                window.clearTimeout(
                    searchTimer
                );

                const value =
                    searchInput.value.trim();

                if (clearSearchButton) {

                    clearSearchButton.hidden =
                        value.length === 0;
                }

                currentSearch =
                    value;

                /*
                 * Instant local filtering.
                 */
                renderProducts();

                /*
                 * Live CJ/Worker search.
                 */
                window.clearTimeout(
                    searchTimer
                );

                searchTimer =
                    window.setTimeout(
                        async () => {

                            const requestId =
                                ++apiSearchRequestId;

                            if (
                                currentSearch.length <
                                2
                            ) {
                                return;
                            }

                            try {

                                const apiProducts =
                                    await loadProductsFromAPI(
                                        currentSearch
                                    );

                                /*
                                 * Ignore stale requests.
                                 */
                                if (
                                    requestId !==
                                    apiSearchRequestId
                                ) {
                                    return;
                                }

                                if (
                                    apiProducts.length
                                ) {

                                    allProducts =
                                        mergeProducts(
                                            allProducts,
                                            apiProducts
                                        );

                                    buildCategories();

                                    renderProducts();
                                }

                            } catch (error) {

                                console.warn(
                                    "[PRASUN SHOP] Live search unavailable:",
                                    error
                                );
                            }

                        },
                        SEARCH_DELAY
                    );
            }
        );
    }


    /* ========================================================================
       CLEAR SEARCH
       ======================================================================== */

    if (clearSearchButton) {

        clearSearchButton.addEventListener(
            "click",
            () => {

                window.clearTimeout(
                    searchTimer
                );

                ++apiSearchRequestId;

                if (searchInput) {
                    searchInput.value =
                        "";
                    searchInput.focus();
                }

                currentSearch =
                    "";

                clearSearchButton.hidden =
                    true;

                renderProducts();
            }
        );
    }


    /* ========================================================================
       SORT
       ======================================================================== */

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            () => {

                currentSort =
                    sortSelect.value ||
                    "featured";

                renderProducts();
            }
        );
    }


    /* ========================================================================
       CATEGORY
       ======================================================================== */

    if (categoriesContainer) {

        categoriesContainer.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".category-pill"
                    );

                if (!button) {
                    return;
                }

                activeCategory =
                    button.dataset.category ||
                    "all";

                setActiveCategory(
                    activeCategory
                );

                renderProducts();
            }
        );
    }


    /* ========================================================================
       CART SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                CART_KEY
            ) {

                updateCartCount();
            }
        }
    );

    window.addEventListener(
        CART_EVENT_NAME,
        event => {

            if (
                event.detail &&
                Array.isArray(
                    event.detail.cart
                )
            ) {

                updateCartCount(
                    event.detail.cart
                );
            }
        }
    );


    /* ========================================================================
       INITIALIZE
       ======================================================================== */

    async function initialize() {

        renderLoading();

        /*
         * Local products immediately.
         */
        allProducts =
            getLocalProducts();

        buildCategories();

        renderProducts();

        /*
         * Then attempt Worker/CJ.
         */
        try {

            const apiProducts =
                await loadProductsFromAPI();

            if (
                apiProducts.length
            ) {

                allProducts =
                    mergeProducts(
                        allProducts,
                        apiProducts
                    );

                buildCategories();

                renderProducts();
            }

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] Worker unavailable. Local catalog remains active.",
                error
            );

            /*
             * Never leave user staring at loading screen.
             */
            renderProducts();
        }

        updateCartCount();
    }


    updateCartCount();

    initialize();

})();
