/**
 * ============================================================================
 * PRASUN SHOP — STOREFRONT CONTROLLER
 * ============================================================================
 *
 * AliExpress-only production storefront controller.
 *
 * Compatible with:
 *
 *   Cloudflare Worker:
 *   https://prasun-shop-api.prasun301.workers.dev
 *
 * API:
 *
 *   GET /api/products
 *   GET /api/products/:id
 *
 * Product source:
 *
 *   products.json
 *
 * Supported product fields:
 *
 *   id
 *   aliexpress_id
 *   sku
 *   name
 *   category
 *   price
 *   rating
 *   image
 *   description
 *   features[]
 *   specifications{}
 *
 * IMPORTANT:
 *   This file contains NO CJ Dropshipping logic.
 *
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const API_BASE_URL =
        "https://prasun-shop-api.prasun301.workers.dev";

    const PRODUCTS_ENDPOINT =
        `${API_BASE_URL}/api/products`;

    const PRODUCT_ENDPOINT =
        `${API_BASE_URL}/api/products/`;

    const PRODUCT_DETAIL_PAGE =
        "/product.html";

    const API_TIMEOUT =
        15000;

    const SEARCH_DELAY =
        300;

    const MAX_PRODUCTS =
        1000;

    /*
     * Currency display only.
     *
     * The Worker stores authoritative prices in USD.
     * These rates are for storefront display only.
     *
     * Change these whenever you want to update display rates.
     */
    const CURRENCY_RATES = {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79
    };

    /* =========================================================================
       2. STATE
       ========================================================================= */

    let masterCatalog = [];

    let allProducts = [];

    let filteredProducts = [];

    let activeCategory = "all";

    let currentSearch = "";

    let currentSort = "featured";

    let searchTimer = null;

    let catalogRequestSequence = 0;

    /* =========================================================================
       3. DOM ELEMENTS
       ========================================================================= */

    const productList =
        document.getElementById("product-list");

    /*
     * If this script is loaded on a page without the product grid,
     * simply stop here.
     */
    if (!productList) {
        return;
    }

    const searchInput =
        document.getElementById("product-search");

    const sortSelect =
        document.getElementById("product-sort");

    const categoriesContainer =
        document.getElementById("products-categories");

    const productsHeading =
        document.getElementById("products-heading") ||
        document.getElementById("page-heading");

    const productsCount =
        document.getElementById("results-count");

    const clearSearchButton =
        document.getElementById("clear-search");

    const ariaLiveRegion =
        document.getElementById("aria-live-region");

    const cartCountBadge =
        document.getElementById("cart-count") ||
        document.getElementById("cart-badge");

    const currencySelect =
        document.getElementById("global-currency");

    /* =========================================================================
       4. FALLBACK IMAGE
       ========================================================================= */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="800"
                height="800"
                viewBox="0 0 800 800"
            >
                <rect
                    width="800"
                    height="800"
                    fill="#f8fafc"
                />

                <path
                    d="M180 560
                       L300 420
                       L395 500
                       L500 385
                       L620 560
                       Z"
                    fill="#e2e8f0"
                />

                <circle
                    cx="325"
                    cy="305"
                    r="58"
                    fill="#cbd5e1"
                />

                <text
                    x="400"
                    y="650"
                    text-anchor="middle"
                    fill="#64748b"
                    font-family="Arial, sans-serif"
                    font-size="28"
                >
                    Image Unavailable
                </text>
            </svg>
        `);

    /* =========================================================================
       5. HTML ESCAPING
       ========================================================================= */

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
            character => ESCAPE_MAP[character]
        );
    }

    /* =========================================================================
       6. TEXT NORMALIZATION
       ========================================================================= */

    function cleanText(
        value,
        fallback = ""
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return fallback;
        }

        const text =
            String(value).trim();

        return text || fallback;
    }

    /* =========================================================================
       7. PRICE NORMALIZATION
       ========================================================================= */

    function parsePrice(value) {
        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return Math.max(
                0,
                value
            );
        }

        const parsed =
            parseFloat(
                String(value ?? "")
                    .replace(
                        /[^0-9.-]/g,
                        ""
                    )
            );

        if (
            !Number.isFinite(parsed)
        ) {
            return 0;
        }

        return Math.max(
            0,
            parsed
        );
    }

    /* =========================================================================
       8. PRICE DISPLAY
       ========================================================================= */

    function formatPrice(
        amount
    ) {
        const usdPrice =
            parsePrice(amount);

        const selectedCurrency =
            currencySelect?.value ||
            "USD";

        const rate =
            CURRENCY_RATES[
                selectedCurrency
            ] ||
            1;

        const convertedPrice =
            usdPrice * rate;

        try {
            return new Intl.NumberFormat(
                "en-US",
                {
                    style: "currency",
                    currency:
                        selectedCurrency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            ).format(
                convertedPrice
            );
        } catch {
            return `$${convertedPrice.toFixed(2)}`;
        }
    }

    /* =========================================================================
       9. IMAGE URL NORMALIZATION
       ========================================================================= */

    function normalizeImageURL(
        value
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        const image =
            String(value).trim();

        if (!image) {
            return "";
        }

        /*
         * Protocol-relative URL.
         */
        if (
            image.startsWith("//")
        ) {
            return `https:${image}`;
        }

        /*
         * Absolute HTTP/HTTPS URL.
         */
        if (
            /^https?:\/\//i.test(image)
        ) {
            return image;
        }

        /*
         * Data URL.
         */
        if (
            image.startsWith("data:")
        ) {
            return image;
        }

        /*
         * Relative URL.
         */
        if (
            image.startsWith("/")
        ) {
            return image;
        }

        if (
            image.startsWith("./")
        ) {
            return image;
        }

        /*
         * Everything else is treated as HTTPS.
         */
        return `https://${image}`;
    }

    /* =========================================================================
       10. IMAGE EXTRACTION
       ========================================================================= */

    function extractImages(
        product
    ) {
        const images = [];

        const addImage = value => {
            if (
                Array.isArray(value)
            ) {
                value.forEach(
                    addImage
                );

                return;
            }

            if (
                value &&
                typeof value === "object"
            ) {
                addImage(
                    value.url
                );

                addImage(
                    value.image
                );

                addImage(
                    value.imageUrl
                );

                return;
            }

            const normalized =
                normalizeImageURL(
                    value
                );

            if (
                normalized &&
                !images.includes(
                    normalized
                )
            ) {
                images.push(
                    normalized
                );
            }
        };

        if (!product) {
            return [];
        }

        addImage(
            product.image
        );

        addImage(
            product.images
        );

        addImage(
            product.imageUrl
        );

        addImage(
            product.thumbnail
        );

        addImage(
            product.bigImage
        );

        addImage(
            product.productImage
        );

        return images;
    }

    /* =========================================================================
       11. PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(
        rawProduct,
        index = 0
    ) {
        if (
            !rawProduct ||
            typeof rawProduct !== "object"
        ) {
            return null;
        }

        const id =
            cleanText(
                rawProduct.id,
                `prod-${index + 1}`
            );

        const aliexpressId =
            cleanText(
                rawProduct.aliexpress_id
            );

        const sku =
            cleanText(
                rawProduct.sku
            );

        const name =
            cleanText(
                rawProduct.name,
                "Unnamed Product"
            );

        const category =
            cleanText(
                rawProduct.category,
                "General"
            );

        const description =
            cleanText(
                rawProduct.description,
                "High quality product."
            );

        const price =
            parsePrice(
                rawProduct.price
            );

        let rating = null;

        if (
            rawProduct.rating !==
            null &&
            rawProduct.rating !==
            undefined &&
            rawProduct.rating !== ""
        ) {
            const parsedRating =
                Number(
                    rawProduct.rating
                );

            if (
                Number.isFinite(
                    parsedRating
                )
            ) {
                rating =
                    Math.min(
                        5,
                        Math.max(
                            0,
                            parsedRating
                        )
                    );
            }
        }

        const images =
            extractImages(
                rawProduct
            );

        const image =
            images[0] ||
            "";

        const features =
            Array.isArray(
                rawProduct.features
            )
                ? rawProduct.features
                    .map(
                        feature =>
                            cleanText(
                                feature
                            )
                    )
                    .filter(Boolean)
                : [];

        const specifications =
            rawProduct.specifications &&
            typeof rawProduct.specifications ===
                "object"
                ? rawProduct.specifications
                : {};

        /*
         * The storefront requires the core AliExpress catalog fields.
         */
        if (
            !id ||
            !name ||
            !sku ||
            !aliexpressId
        ) {
            console.warn(
                "[PRASUN SHOP] Invalid product skipped:",
                rawProduct
            );

            return null;
        }

        return {
            id,

            aliexpress_id:
                aliexpressId,

            sku,

            name,

            category,

            price:
                Number(
                    price.toFixed(2)
                ),

            rating,

            image,

            images,

            description,

            features,

            specifications
        };
    }

    /* =========================================================================
       12. API RESPONSE NORMALIZATION
       ========================================================================= */

    function extractProductsFromAPI(
        data
    ) {
        if (
            Array.isArray(data)
        ) {
            return data
                .map(
                    normalizeProduct
                )
                .filter(Boolean);
        }

        if (
            !data ||
            typeof data !== "object"
        ) {
            return [];
        }

        let rawProducts = [];

        if (
            Array.isArray(
                data.products
            )
        ) {
            rawProducts =
                data.products;
        } else if (
            Array.isArray(
                data.items
            )
        ) {
            rawProducts =
                data.items;
        } else if (
            Array.isArray(
                data.results
            )
        ) {
            rawProducts =
                data.results;
        } else if (
            data.data &&
            Array.isArray(
                data.data.products
            )
        ) {
            rawProducts =
                data.data.products;
        } else if (
            data.data &&
            Array.isArray(
                data.data.items
            )
        ) {
            rawProducts =
                data.data.items;
        } else if (
            Array.isArray(
                data.data
            )
        ) {
            rawProducts =
                data.data;
        }

        return rawProducts
            .map(
                normalizeProduct
            )
            .filter(Boolean);
    }

    /* =========================================================================
       13. FETCH WITH TIMEOUT
       ========================================================================= */

    async function fetchJSON(
        url,
        timeout = API_TIMEOUT
    ) {
        const controller =
            new AbortController();

        const timer =
            setTimeout(
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
                    `HTTP ${response.status}`
                );
            }

            return await response.json();

        } finally {
            clearTimeout(
                timer
            );
        }
    }

    /* =========================================================================
       14. LOAD COMPLETE PRODUCT CATALOG
       ========================================================================= */

    async function loadProductsFromAPI() {
        const data =
            await fetchJSON(
                PRODUCTS_ENDPOINT
            );

        return extractProductsFromAPI(
            data
        ).slice(
            0,
            MAX_PRODUCTS
        );
    }

    /* =========================================================================
       15. ACCESSIBILITY ANNOUNCEMENT
       ========================================================================= */

    function announce(
        message
    ) {
        if (
            !ariaLiveRegion
        ) {
            return;
        }

        ariaLiveRegion.textContent =
            "";

        setTimeout(
            () => {
                ariaLiveRegion.textContent =
                    message;
            },
            20
        );
    }

    /* =========================================================================
       16. SEARCH CLEAR BUTTON
       ========================================================================= */

    function updateClearSearchButton() {
        if (
            !clearSearchButton ||
            !searchInput
        ) {
            return;
        }

        clearSearchButton.hidden =
            !searchInput.value.trim();
    }

    /* =========================================================================
       17. FILTER PRODUCTS
       ========================================================================= */

    function filterProducts() {
        const searchTerm =
            currentSearch
                .trim()
                .toLowerCase();

        filteredProducts =
            allProducts.filter(
                product => {

                    /*
                     * Category filter.
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
                     * Search filter.
                     */
                    if (
                        !searchTerm
                    ) {
                        return true;
                    }

                    const searchableText =
                        [
                            product.name,
                            product.category,
                            product.sku,
                            product.aliexpress_id,
                            product.description,
                            ...(product.features || [])
                        ]
                            .join(" ")
                            .toLowerCase();

                    return searchableText.includes(
                        searchTerm
                    );
                }
            );

        applySort();
    }

    /* =========================================================================
       18. SORT PRODUCTS
       ========================================================================= */

    function applySort() {
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
                        (b.rating || 0) -
                        (a.rating || 0)
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

                /*
                 * Preserve products.json order.
                 */
                break;
        }
    }

    /* =========================================================================
       19. BUILD CATEGORY FILTER
       ========================================================================= */

    function buildCategories() {
        if (
            !categoriesContainer
        ) {
            return;
        }

        const categorySet =
            new Set();

        allProducts.forEach(
            product => {

                const category =
                    cleanText(
                        product.category
                    );

                if (
                    category
                ) {
                    categorySet.add(
                        category
                    );
                }
            }
        );

        const categories =
            Array.from(
                categorySet
            ).sort(
                (a, b) =>
                    a.localeCompare(
                        b
                    )
            );

        categoriesContainer.innerHTML =
            `
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
                        category =>
                            `
                                <button
                                    type="button"
                                    class="category-pill"
                                    data-category="${escapeHTML(category)}"
                                    aria-pressed="false"
                                >
                                    ${escapeHTML(category)}
                                </button>
                            `
                    )
                    .join("")}
            `;
    }

    /* =========================================================================
       20. ACTIVE CATEGORY
       ========================================================================= */

    function setActiveCategory(
        category
    ) {
        activeCategory =
            cleanText(
                category,
                "all"
            );

        if (
            !categoriesContainer
        ) {
            return;
        }

        categoriesContainer
            .querySelectorAll(
                ".category-pill"
            )
            .forEach(
                button => {

                    const isActive =
                        String(
                            button.dataset.category
                        ).toLowerCase() ===
                        activeCategory.toLowerCase();

                    button.classList.toggle(
                        "active",
                        isActive
                    );

                    button.setAttribute(
                        "aria-pressed",
                        isActive
                            ? "true"
                            : "false"
                    );
                }
            );
    }

    /* =========================================================================
       21. LOADING STATE
       ========================================================================= */

    function renderLoading(
        message =
            "Loading products..."
    ) {
        productList.innerHTML =
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

                    <p>
                        ${escapeHTML(message)}
                    </p>
                </div>
            `;

        announce(
            message
        );
    }

    /* =========================================================================
       22. EMPTY STATE
       ========================================================================= */

    function renderEmpty(
        message =
            "No products found."
    ) {
        productList.innerHTML =
            `
                <div
                    class="product-status-card empty"
                    role="status"
                >
                    <div
                        class="status-icon"
                        aria-hidden="true"
                    >
                        🔎
                    </div>

                    <h3>
                        No products found
                    </h3>

                    <p>
                        ${escapeHTML(message)}
                    </p>
                </div>
            `;

        announce(
            message
        );
    }

    /* =========================================================================
       23. ERROR STATE
       ========================================================================= */

    function renderError(
        message =
            "Unable to load products."
    ) {
        productList.innerHTML =
            `
                <div
                    class="product-status-card empty"
                    role="alert"
                >
                    <div
                        class="status-icon"
                        aria-hidden="true"
                    >
                        ⚠️
                    </div>

                    <h3>
                        Store temporarily unavailable
                    </h3>

                    <p>
                        ${escapeHTML(message)}
                    </p>

                    <button
                        type="button"
                        class="btn-retry-products"
                        id="retry-products"
                    >
                        Try Again
                    </button>
                </div>
            `;

        document
            .getElementById(
                "retry-products"
            )
            ?.addEventListener(
                "click",
                initCatalog,
                {
                    once: true
                }
            );

        announce(
            message
        );
    }

    /* =========================================================================
       24. RATING DISPLAY
       ========================================================================= */

    function renderRating(
        rating
    ) {
        if (
            rating === null ||
            !Number.isFinite(
                rating
            )
        ) {
            return `
                <span
                    class="rating-badge rating-none"
                >
                    No reviews
                </span>
            `;
        }

        const rounded =
            Math.min(
                5,
                Math.max(
                    0,
                    Math.round(
                        rating
                    )
                )
            );

        const stars =
            "★".repeat(
                rounded
            ) +
            "☆".repeat(
                5 - rounded
            );

        return `
            <span
                class="rating-badge"
                aria-label="Rating ${rating.toFixed(1)} out of 5"
            >
                ${stars}
                <span>
                    (${rating.toFixed(1)})
                </span>
            </span>
        `;
    }

    /* =========================================================================
       25. PRODUCT CARD
       ========================================================================= */

    function renderProductCard(
        product
    ) {
        const detailUrl =
            `${PRODUCT_DETAIL_PAGE}?id=${encodeURIComponent(product.id)}`;

        const image =
            product.image ||
            FALLBACK_IMAGE;

        const safeImage =
            escapeHTML(
                image
            );

        const safeName =
            escapeHTML(
                product.name
            );

        const safeId =
            escapeHTML(
                product.id
            );

        return `
            <article
                class="product-card"
                data-id="${safeId}"
            >

                <a
                    href="${detailUrl}"
                    class="product-card-image-link"
                    aria-label="View ${safeName}"
                >

                    <img
                        src="${safeImage}"
                        alt="${safeName}"
                        loading="lazy"
                        decoding="async"
                        class="product-image"
                        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
                    >

                </a>

                <div
                    class="product-card-body"
                >

                    <div
                        class="product-meta"
                    >

                        <span
                            class="product-category"
                        >
                            ${escapeHTML(
                                product.category
                            )}
                        </span>

                        ${renderRating(
                            product.rating
                        )}

                    </div>

                    <h3
                        class="product-title"
                    >

                        <a
                            href="${detailUrl}"
                        >
                            ${safeName}
                        </a>

                    </h3>

                    <p
                        class="product-description"
                    >
                        ${escapeHTML(
                            product.description
                        )}
                    </p>

                    <div
                        class="product-card-footer"
                    >

                        <span
                            class="product-price"
                        >
                            ${formatPrice(
                                product.price
                            )}
                        </span>

                        <button
                            type="button"
                            class="btn-add-to-cart"
                            data-id="${safeId}"
                            aria-label="Add ${safeName} to cart"
                        >
                            Add to Cart
                        </button>

                    </div>

                </div>

            </article>
        `;
    }

    /* =========================================================================
       26. UPDATE PAGE HEADING / COUNT
       ========================================================================= */

    function updateHeadingAndCount() {
        if (
            productsCount
        ) {
            productsCount.textContent =
                `${filteredProducts.length} ${
                    filteredProducts.length === 1
                        ? "product"
                        : "products"
                }`;
        }

        if (
            productsHeading
        ) {
            if (
                currentSearch.trim()
            ) {
                productsHeading.textContent =
                    `Search Results for "${currentSearch.trim()}"`;
            } else if (
                activeCategory !== "all"
            ) {
                productsHeading.textContent =
                    activeCategory;
            } else {
                productsHeading.textContent =
                    "All Products";
            }
        }
    }

    /* =========================================================================
       27. RENDER PRODUCTS
       ========================================================================= */

    function renderProducts() {
        filterProducts();

        updateHeadingAndCount();

        if (
            !filteredProducts.length
        ) {
            renderEmpty(
                currentSearch.trim()
                    ? "Try another search term or category."
                    : "No products are currently available."
            );

            return;
        }

        productList.innerHTML =
            filteredProducts
                .map(
                    renderProductCard
                )
                .join("");

        announce(
            `Showing ${filteredProducts.length} products`
        );
    }

    /* =========================================================================
       28. CART BADGE
       ========================================================================= */

    function updateCartBadge() {
        /*
         * Prefer the central cart.js implementation.
         */
        if (
            window.PrasunShopCart &&
            typeof window.PrasunShopCart.updateCartBadge ===
                "function"
        ) {
            window.PrasunShopCart.updateCartBadge();

            return;
        }

        /*
         * Safe fallback.
         */
        if (
            !cartCountBadge
        ) {
            return;
        }

        try {
            const cart =
                JSON.parse(
                    localStorage.getItem(
                        "prasun_cart"
                    ) || "[]"
                );

            const count =
                Array.isArray(cart)
                    ? cart.reduce(
                        (
                            total,
                            item
                        ) =>
                            total +
                            Math.max(
                                0,
                                Number(
                                    item.quantity
                                ) || 0
                            ),
                        0
                    )
                    : 0;

            cartCountBadge.textContent =
                String(
                    count
                );

            cartCountBadge.hidden =
                count <= 0;

        } catch {
            cartCountBadge.textContent =
                "0";

            cartCountBadge.hidden =
                true;
        }
    }

    /* =========================================================================
       29. ADD TO CART
       ========================================================================= */

    function handleAddToCart(
        productId
    ) {
        const product =
            masterCatalog.find(
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
            console.warn(
                "[PRASUN SHOP] Product not found:",
                productId
            );

            return;
        }

        /*
         * AliExpress-only cart object.
         *
         * IMPORTANT:
         * No CJ fields are included.
         */
        if (
            window.PrasunShopCart &&
            typeof window.PrasunShopCart.addToCart ===
                "function"
        ) {
            window.PrasunShopCart.addToCart(
                {
                    id:
                        product.id,

                    name:
                        product.name,

                    price:
                        product.price,

                    image:
                        product.image,

                    category:
                        product.category,

                    sku:
                        product.sku,

                    aliexpress_id:
                        product.aliexpress_id
                },
                1
            );

        } else {
            /*
             * If cart.js is not loaded, do not silently pretend
             * the product was added.
             */
            console.error(
                "[PRASUN SHOP] PrasunShopCart.addToCart() is unavailable."
            );

            announce(
                "Cart is temporarily unavailable."
            );

            return;
        }

        announce(
            `${product.name} added to cart.`
        );

        /*
         * Visual feedback.
         */
        const selector =
            `.btn-add-to-cart[data-id="${CSS.escape(
                String(product.id)
            )}"]`;

        const button =
            productList.querySelector(
                selector
            );

        if (
            button
        ) {
            const originalText =
                button.textContent;

            button.textContent =
                "✓ Added";

            button.classList.add(
                "added"
            );

            button.disabled =
                true;

            setTimeout(
                () => {
                    button.textContent =
                        originalText;

                    button.classList.remove(
                        "added"
                    );

                    button.disabled =
                        false;
                },
                1200
            );
        }

        updateCartBadge();
    }

    /* =========================================================================
       30. SEARCH
       ========================================================================= */

    function executeLocalSearch(
        query
    ) {
        currentSearch =
            cleanText(
                query
            );

        allProducts =
            [...masterCatalog];

        renderProducts();
    }

    /* =========================================================================
       31. INITIAL CATALOG LOAD
       ========================================================================= */

    async function initCatalog() {
        catalogRequestSequence++;

        const requestSequence =
            catalogRequestSequence;

        renderLoading(
            "Fetching catalog..."
        );

        try {
            const products =
                await loadProductsFromAPI();

            /*
             * Ignore old request if a newer request started.
             */
            if (
                requestSequence !==
                catalogRequestSequence
            ) {
                return;
            }

            if (
                !products.length
            ) {
                masterCatalog = [];

                allProducts = [];

                buildCategories();

                renderEmpty(
                    "No products are currently available."
                );

                return;
            }

            /*
             * The Worker is authoritative.
             */
            masterCatalog =
                products;

            allProducts =
                [...masterCatalog];

            /*
             * Reset category only if the current
             * category no longer exists.
             */
            const categoryExists =
                activeCategory ===
                    "all" ||
                allProducts.some(
                    product =>
                        product.category
                            .toLowerCase() ===
                        activeCategory.toLowerCase()
                );

            if (
                !categoryExists
            ) {
                activeCategory =
                    "all";
            }

            buildCategories();

            setActiveCategory(
                activeCategory
            );

            renderProducts();

            console.info(
                `[PRASUN SHOP] Loaded ${masterCatalog.length} products.`
            );

        } catch (
            error
        ) {
            console.error(
                "[PRASUN SHOP] Catalog loading failed:",
                error
            );

            masterCatalog = [];

            allProducts = [];

            renderError(
                "Unable to connect to the product catalog. Please try again."
            );
        }

        updateCartBadge();

        updateClearSearchButton();
    }

    /* =========================================================================
       32. EVENT LISTENERS
       ========================================================================= */

    function attachEventListeners() {

        /*
         * SEARCH
         */
        searchInput?.addEventListener(
            "input",
            event => {

                currentSearch =
                    event.target.value;

                updateClearSearchButton();

                clearTimeout(
                    searchTimer
                );

                searchTimer =
                    setTimeout(
                        () => {

                            executeLocalSearch(
                                currentSearch
                            );

                        },
                        SEARCH_DELAY
                    );
            }
        );

        /*
         * CLEAR SEARCH
         */
        clearSearchButton?.addEventListener(
            "click",
            () => {

                if (
                    searchInput
                ) {
                    searchInput.value =
                        "";

                    currentSearch =
                        "";

                    updateClearSearchButton();

                    executeLocalSearch(
                        ""
                    );

                    searchInput.focus();
                }
            }
        );

        /*
         * SORT
         */
        sortSelect?.addEventListener(
            "change",
            event => {

                currentSort =
                    event.target.value;

                renderProducts();
            }
        );

        /*
         * CATEGORY
         */
        categoriesContainer?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".category-pill"
                    );

                if (
                    !button
                ) {
                    return;
                }

                setActiveCategory(
                    button.dataset.category
                );

                renderProducts();
            }
        );

        /*
         * ADD TO CART
         */
        productList.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".btn-add-to-cart"
                    );

                if (
                    !button
                ) {
                    return;
                }

                event.preventDefault();

                handleAddToCart(
                    button.dataset.id
                );
            }
        );

        /*
         * CURRENCY DISPLAY.
         *
         * This does NOT change the Worker price.
         * It only changes the displayed currency.
         */
        currencySelect?.addEventListener(
            "change",
            () => {
                renderProducts();
            }
        );

        /*
         * CART EVENTS.
         */
        window.addEventListener(
            "prasun:cart-updated",
            updateCartBadge
        );

        /*
         * Storage changes from another tab.
         */
        window.addEventListener(
            "storage",
            event => {

                if (
                    event.key ===
                    "prasun_cart"
                ) {
                    updateCartBadge();
                }
            }
        );
    }

    /* =========================================================================
       33. INITIALIZATION
       ========================================================================= */

    function init() {
        attachEventListeners();

        updateClearSearchButton();

        updateCartBadge();

        initCatalog();
    }

    /* =========================================================================
       34. START
       ========================================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }

})();
