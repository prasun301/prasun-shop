/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY
 * ============================================================================
 *
 * Complete replacement for script.js
 *
 * Features:
 * - Loads products from Cloudflare Worker
 * - Never remains stuck on "Loading products..."
 * - Local fallback catalog
 * - Search
 * - Category filtering
 * - Sorting
 * - Add to cart
 * - Cart count synchronization
 * - Product detail links
 * - Broken-image fallback
 * - API timeout protection
 * - Handles both array and wrapped API responses
 *
 * Cart storage:
 *
 *     prasun_cart
 *
 * API:
 *
 *     /api/products
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const API_ENDPOINT = "./api/products";

    const CART_KEY = "prasun_cart";

    const CART_EVENT_NAME = "prasunCartUpdated";

    const API_TIMEOUT = 8000;

    const SEARCH_DELAY = 350;

    const MAX_CART_QUANTITY = 99;


    /* ========================================================================
       LOCAL FALLBACK CATALOG
       ========================================================================

       This guarantees that the shop can still work if:

       - Cloudflare Worker is unavailable
       - CJ API fails
       - API returns invalid JSON
       - network connection fails
       - API request times out

       Keep this synchronized with worker.js.
       ======================================================================== */

    const LOCAL_CATALOG = [

        {
            id: "001",
            sku: "CJSN188416414NM",

            name:
                "G-Shaped Smart LED Atmosphere Lamp with Bluetooth Speaker & Wireless Charger",

            category:
                "Smart Lighting",

            price:
                29.99,

            rating:
                5.0,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",

            description:
                "Upgrade your living space with this multifunctional G-shaped Smart LED Atmosphere Lamp combining customizable lighting, Bluetooth audio, 15W wireless charging, and alarm clock controls."
        },


        {
            id: "002",
            sku: "CJCD135893009IR",

            name:
                "Mini 5000mAh Magnetic Wireless Power Bank Fast Charging Portable Battery",

            category:
                "Power & Charging",

            price:
                39.99,

            rating:
                5.0,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",

            description:
                "Compact 5000mAh Magnetic Wireless Power Bank featuring strong magnetic attachment, fast charging, LED power display, and an airplane-safe portable design."
        },


        {
            id: "003",
            sku: "CJYP270967903CX",

            name:
                "High-Quality Noise Cancelling Wireless Bluetooth Sports Earbuds",

            category:
                "Audio",

            price:
                49.99,

            rating:
                5.0,

            image:
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",

            description:
                "Immersive sound with these Noise Cancelling Wireless Bluetooth Sports Earbuds. Designed for workouts, travel, and low-latency gaming with extended battery performance."
        }

    ];


    /* ========================================================================
       DOM ELEMENTS
       ======================================================================== */

    const productList =
        document.getElementById(
            "product-list"
        );


    if (!productList) {

        console.error(
            "[PRASUN SHOP] #product-list was not found."
        );

        return;
    }


    const searchInput =
        document.getElementById(
            "products-search"
        );


    const sortSelect =
        document.getElementById(
            "products-sort"
        );


    const categoriesContainer =
        document.getElementById(
            "products-categories"
        );


    const productsHeading =
        document.getElementById(
            "products-heading"
        );


    const productsCount =
        document.getElementById(
            "products-count"
        );


    const cartCount =
        document.getElementById(
            "cart-count"
        );


    /* ========================================================================
       STATE
       ======================================================================== */

    let allProducts = [];

    let filteredProducts = [];

    let activeCategory = "all";

    let currentSearch = "";

    let currentSort = "featured";

    let searchTimer = null;


    /* ========================================================================
       FALLBACK IMAGE
       ======================================================================== */

    const FALLBACK_IMAGE =
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

                <text
                    x="300"
                    y="300"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#94a3b8"
                    font-family="Arial, sans-serif"
                    font-size="24"
                >
                    Image unavailable
                </text>

            </svg>
        `);


    /* ========================================================================
       HTML ESCAPING
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


        return String(value)
            .replace(
                /[&<>"']/g,
                character =>
                    ESCAPE_MAP[character]
            );
    }


    /* ========================================================================
       PRICE
       ======================================================================== */

    const currencyFormatter =
        new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
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
       PRODUCT NORMALIZATION
       ========================================================================

       CJ can return different field names.

       This function converts all possible formats into one predictable
       product structure used by the shop.
       ======================================================================== */

    function normalizeProduct(product, index = 0) {

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


        const rating =
            Number(
                product.rating ??
                product.score ??
                5
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
            "";


        image =
            String(image || "").trim();


        /*
         * CJ sometimes returns image paths without protocol.
         */

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

            price:
                price,

            rating:
                Number.isFinite(rating)
                    ? Math.max(
                        0,
                        Math.min(
                            5,
                            rating
                        )
                    )
                    : 5,

            image:
                image,

            description:
                String(description),

            features:
                Array.isArray(product.features)
                    ? product.features
                    : [],

            specifications:
                product.specifications &&
                typeof product.specifications === "object"
                    ? product.specifications
                    : {}

        };
    }


    /* ========================================================================
       NORMALIZE PRODUCT COLLECTION
       ======================================================================== */

    function extractProducts(data) {

        if (Array.isArray(data)) {

            return data
                .map(
                    (item, index) =>
                        normalizeProduct(
                            item,
                            index
                        )
                )
                .filter(Boolean);
        }


        if (
            data &&
            Array.isArray(data.products)
        ) {

            return data.products
                .map(
                    (item, index) =>
                        normalizeProduct(
                            item,
                            index
                        )
                )
                .filter(Boolean);
        }


        if (
            data &&
            Array.isArray(data.data)
        ) {

            return data.data
                .map(
                    (item, index) =>
                        normalizeProduct(
                            item,
                            index
                        )
                )
                .filter(Boolean);
        }


        if (
            data &&
            data.data &&
            Array.isArray(data.data.list)
        ) {

            return data.data.list
                .map(
                    (item, index) =>
                        normalizeProduct(
                            item,
                            index
                        )
                )
                .filter(Boolean);
        }


        if (
            data &&
            data.data &&
            Array.isArray(data.data.products)
        ) {

            return data.data.products
                .map(
                    (item, index) =>
                        normalizeProduct(
                            item,
                            index
                        )
                )
                .filter(Boolean);
        }


        /*
         * Single product object.
         */

        if (
            data &&
            typeof data === "object" &&
            (
                data.id ||
                data.pid ||
                data.productSku
            )
        ) {

            const product =
                normalizeProduct(
                    data
                );


            return product
                ? [product]
                : [];
        }


        return [];
    }


    /* ========================================================================
       LOCAL CATALOG
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
       API FETCH WITH TIMEOUT
       ======================================================================== */

    async function fetchJSON(
        url,
        timeout = API_TIMEOUT
    ) {

        const controller =
            new AbortController();


        const timeoutId =
            window.setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );


        try {

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache:
                            "no-store",

                        signal:
                            controller.signal
                    }
                );


            const text =
                await response.text();


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            let data;


            try {

                data =
                    text
                        ? JSON.parse(text)
                        : null;

            } catch (error) {

                throw new Error(
                    "Invalid JSON response"
                );
            }


            return data;

        } finally {

            window.clearTimeout(
                timeoutId
            );
        }
    }


    /* ========================================================================
       LOAD PRODUCTS FROM API
       ======================================================================== */

    async function loadProductsFromAPI(
        keyword = ""
    ) {

        let url =
            API_ENDPOINT;


        if (keyword) {

            url +=
                `?keyword=${encodeURIComponent(
                    keyword
                )}`;
        }


        const data =
            await fetchJSON(
                url
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
       INITIAL LOAD
       ======================================================================== */

    async function initializeProducts() {

        /*
         * First guarantee that the local catalog is available.
         *
         * This means the page has something to render immediately even if
         * the Worker is unavailable.
         */

        allProducts =
            getLocalProducts();


        renderProducts();


        /*
         * Now attempt the Worker.
         */

        try {

            const apiProducts =
                await loadProductsFromAPI();


            if (
                Array.isArray(apiProducts) &&
                apiProducts.length > 0
            ) {

                allProducts =
                    mergeProducts(
                        allProducts,
                        apiProducts
                    );


                renderProducts();
            }

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] API unavailable. Using local catalog.",
                error
            );


            /*
             * IMPORTANT:
             * Do not leave the page in a loading state.
             */

            renderProducts();
        }

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
         * API products first.
         */

        apiProducts.forEach(
            product => {

                if (
                    product &&
                    product.id
                ) {

                    map.set(
                        String(product.id),
                        product
                    );
                }
            }
        );


        /*
         * Local products are added only when the API did not return
         * the same ID.
         */

        localProducts.forEach(
            product => {

                if (
                    product &&
                    product.id &&
                    !map.has(
                        String(product.id)
                    )
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
       FILTER PRODUCTS
       ======================================================================== */

    function filterProducts() {

        const search =
            currentSearch
                .trim()
                .toLowerCase();


        filteredProducts =
            allProducts.filter(
                product => {

                    /*
                     * Category filter
                     */

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


                    /*
                     * Search filter
                     */

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
       SORT PRODUCTS
       ======================================================================== */

    function sortProducts() {

        const products =
            filteredProducts;


        switch (
            currentSort
        ) {

            case "price-low":

                products.sort(
                    (a, b) =>
                        a.price -
                        b.price
                );

                break;


            case "price-high":

                products.sort(
                    (a, b) =>
                        b.price -
                        a.price
                );

                break;


            case "name-az":

                products.sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );

                break;


            case "rating":

                products.sort(
                    (a, b) =>
                        b.rating -
                        a.rating
                );

                break;


            case "featured":

            default:

                /*
                 * Keep original order.
                 */

                break;
        }

    }


    /* ========================================================================
       BUILD CATEGORY LIST
       ======================================================================== */

    function buildCategories() {

        if (
            !categoriesContainer
        ) {
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


                if (!categoryMap.has(key)) {

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
            )
            .sort(
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

            ${categories
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
                .join("")}

        `;

    }


    /* ========================================================================
       STAR RATING
       ======================================================================== */

    function renderStars(
        rating
    ) {

        const numericRating =
            Number(rating);


        if (
            !Number.isFinite(
                numericRating
            )
        ) {

            return "★★★★★";
        }


        const rounded =
            Math.round(
                numericRating
            );


        return (
            "★".repeat(
                Math.max(
                    0,
                    Math.min(
                        5,
                        rounded
                    )
                )
            ) +
            "☆".repeat(
                Math.max(
                    0,
                    5 - rounded
                )
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
            String(
                product.id
            );


        const encodedId =
            encodeURIComponent(
                id
            );


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
            Number.isFinite(
                Number(product.rating)
            )
                ? Number(product.rating).toFixed(1)
                : "5.0";


        return `

            <article
                class="product-card"
                data-product-id="${escapeHTML(id)}"
            >

                <div class="product-card-inner">


                    <!-- ====================================================
                         PRODUCT LINK
                         ==================================================== -->

                    <a
                        href="./product.html?id=${encodedId}"
                        class="product-card-link"
                        aria-label="View ${name}"
                    >


                        <!-- ==================================================
                             IMAGE
                             ================================================== -->

                        <div
                            class="product-card-image"
                        >

                            <span
                                class="product-category"
                            >
                                ${category}
                            </span>


                            <img
                                src="${image}"
                                alt="${name}"
                                loading="lazy"
                                decoding="async"
                                data-product-image="true"
                            >

                        </div>


                        <!-- ==================================================
                             BODY
                             ================================================== -->

                        <div
                            class="product-card-body"
                        >

                            <span
                                class="product-rating"
                            >

                                ${renderStars(
                                    product.rating
                                )}

                                <span>
                                    ${escapeHTML(
                                        rating
                                    )}
                                </span>

                            </span>


                            <h3
                                class="product-title"
                            >
                                ${name}
                            </h3>


                            <p
                                class="product-description"
                            >
                                ${description}
                            </p>


                            <div
                                class="product-bottom"
                            >

                                <span
                                    class="product-price"
                                >
                                    ${price}
                                </span>


                                <span
                                    class="product-view-button"
                                >
                                    View Product →
                                </span>

                            </div>

                        </div>

                    </a>


                    <!-- ====================================================
                         ADD TO CART
                         ==================================================== -->

                    <div
                        class="product-card-actions"
                    >

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
       RENDER EMPTY
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
                    Try another search term or select a different category.
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
       RENDER PRODUCTS
       ======================================================================== */

    function renderProducts() {

        filterProducts();


        if (
            !filteredProducts.length
        ) {

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
       RESULT BAR
       ======================================================================== */

    function updateResultBar() {

        if (productsHeading) {

            if (
                currentSearch
            ) {

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

    }


    /* ========================================================================
       IMAGE FALLBACK
       ======================================================================== */

    function attachImageFallbacks() {

        const images =
            productList.querySelectorAll(
                "img[data-product-image]"
            );


        images.forEach(
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
       CART READ
       ======================================================================== */

    function readCart() {

        try {

            const stored =
                localStorage.getItem(
                    CART_KEY
                );


            if (!stored) {
                return [];
            }


            const parsed =
                JSON.parse(
                    stored
                );


            if (
                !Array.isArray(
                    parsed
                )
            ) {

                return [];
            }


            return parsed;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );


            return [];
        }

    }


    /* ========================================================================
       CART SAVE
       ======================================================================== */

    function saveCart(
        cart
    ) {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(
                    cart
                )
            );


            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart:
                                [...cart]
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


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount(
        suppliedCart = null
    ) {

        if (!cartCount) {
            return;
        }


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
                            Number.isFinite(
                                quantity
                            ) &&
                            quantity > 0
                                ? Math.floor(
                                    quantity
                                )
                                : 1
                        );

                },
                0
            );


        cartCount.textContent =
            String(total);


        cartCount.hidden =
            total === 0;


        const cartLink =
            cartCount.closest(
                "a"
            );


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
       ADD PRODUCT TO CART
       ======================================================================== */

    function addToCart(
        product
    ) {

        const cart =
            readCart();


        const productId =
            String(
                product.id
            );


        const existing =
            cart.find(
                item =>
                    String(
                        item?.id
                    ) === productId
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
       EVENT: PRODUCT LIST CLICK
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


            /* ---------------------------------------------------------------
               RESET FILTERS
               --------------------------------------------------------------- */

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


                setActiveCategory(
                    "all"
                );


                renderProducts();


                return;
            }


            /* ---------------------------------------------------------------
               ADD TO CART
               --------------------------------------------------------------- */

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
                        ) === productId
                );


            if (!product) {

                console.error(
                    "[PRASUN SHOP] Product not found:",
                    productId
                );


                return;
            }


            const success =
                addToCart(
                    product
                );


            if (success) {

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


                searchTimer =
                    window.setTimeout(
                        async () => {

                            currentSearch =
                                searchInput.value.trim();


                            /*
                             * First search locally.
                             *
                             * This gives instant results.
                             */

                            renderProducts();


                            /*
                             * If there is a search term, ask the Worker
                             * for live CJ products.
                             */

                            if (
                                currentSearch.length >=
                                2
                            ) {

                                try {

                                    const apiProducts =
                                        await loadProductsFromAPI(
                                            currentSearch
                                        );


                                    if (
                                        apiProducts.length
                                    ) {

                                        allProducts =
                                            mergeProducts(
                                                allProducts,
                                                apiProducts
                                            );


                                        buildCategories();

                                        setActiveCategory(
                                            activeCategory
                                        );

                                        renderProducts();
                                    }

                                } catch (error) {

                                    console.warn(
                                        "[PRASUN SHOP] Live search unavailable. Local search remains active.",
                                        error
                                    );

                                }

                            }

                        },
                        SEARCH_DELAY
                    );

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
       CATEGORY SELECTION
       ======================================================================== */

    function setActiveCategory(
        category
    ) {

        activeCategory =
            category ||
            "all";


        if (
            !categoriesContainer
        ) {
            return;
        }


        const buttons =
            categoriesContainer.querySelectorAll(
                ".category-pill"
            );


        buttons.forEach(
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


    if (
        categoriesContainer
    ) {

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
       CART STORAGE SYNCHRONIZATION
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
       INITIALIZATION
       ======================================================================== */

    updateCartCount();

    renderLoading();

    buildCategories();

    initializeProducts();


})();
