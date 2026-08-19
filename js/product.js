/**
 * ============================================================================
 * PRASUN SHOP — PRODUCT DETAILS
 * ============================================================================
 *
 * Production-safe product detail loader.
 *
 * Resolution priority:
 *   1. URL ?id=
 *   2. URL ?sku=
 *   3. URL ?product=
 *   4. URL ?name=
 *   5. localStorage selected product
 *   6. API / Cloudflare Worker catalog
 *
 * Designed to work with:
 *   - Local catalog products
 *   - CJ Dropshipping products
 *   - Cloudflare Worker normalized products
 *   - Existing index.html product cards
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CONFIG = {

        /*
         * IMPORTANT:
         * Change this ONLY if your Cloudflare Worker uses another endpoint.
         *
         * If your homepage already successfully loads products from the
         * Worker, use the SAME endpoint here.
         */
        API_URL: "/api/products",

        /*
         * Alternative endpoints that will be tried if the first endpoint
         * fails.
         */
        API_FALLBACK_URLS: [
            "/api/products",
            "/products",
            "/api/catalog"
        ],

        HOME_URL: "index.html",

        CART_URL: "cart.html",

        DEFAULT_IMAGE:
            "https://via.placeholder.com/800x800?text=PRASUN+SHOP",

        DEFAULT_CATEGORY: "General",

        DEFAULT_PRICE: 0,

        MAX_RELATED_PRODUCTS: 4,

        STORAGE_KEYS: [
            "prasun_selected_product",
            "selectedProduct",
            "currentProduct",
            "product"
        ],

        CART_STORAGE_KEYS: [
            "prasun_cart",
            "cart"
        ]

    };


    /* ========================================================================
       DOM REFERENCES
       ======================================================================== */

    const detailContainer =
        document.getElementById("product-detail");

    const breadcrumbCategory =
        document.getElementById("breadcrumb-category");

    const breadcrumbTitle =
        document.getElementById("breadcrumb-title");

    const productTabs =
        document.getElementById("product-tabs");

    const specTable =
        document.getElementById("spec-table-body");

    const relatedSection =
        document.getElementById("related-section");

    const relatedGrid =
        document.getElementById("related-products-grid");

    const mobileBuyBar =
        document.getElementById("mobile-buy-bar");

    const mobilePriceDisplay =
        document.getElementById("mobile-price-display");

    const mobileAddCartBtn =
        document.getElementById("mobile-add-cart-btn");

    const cartCount =
        document.getElementById("cart-count");


    /* ========================================================================
       STATE
       ======================================================================== */

    let allProducts = [];

    let currentProduct = null;

    let currentQuantity = 1;

    let currentImageIndex = 0;


    /* ========================================================================
       UTILITIES
       ======================================================================== */

    function normalize(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/&amp;/g, "&")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\s+/g, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

    }


    function slugify(value) {

        return normalize(value)
            .replace(/\s+/g, "-");

    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function escapeAttribute(value) {

        return escapeHTML(value);

    }


    function safeNumber(value, fallback = 0) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        const number = Number(
            String(value)
                .replace(/[$,\s]/g, "")
        );

        return Number.isFinite(number)
            ? number
            : fallback;

    }


    function formatPrice(value) {

        const number = safeNumber(value, 0);

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number);

    }


    function firstNonEmpty(...values) {

        for (const value of values) {

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {
                return value;
            }

        }

        return "";

    }


    /* ========================================================================
       IMAGE NORMALIZATION
       ======================================================================== */

    function normalizeImages(product) {

        const images = [];

        function addImage(value) {

            if (!value) return;

            if (Array.isArray(value)) {

                value.forEach(addImage);

                return;
            }

            if (typeof value === "object") {

                addImage(
                    value.url ||
                    value.src ||
                    value.image ||
                    value.imageUrl
                );

                return;
            }

            const url = String(value).trim();

            if (!url) return;

            if (!images.includes(url)) {
                images.push(url);
            }

        }


        addImage(product.image);

        addImage(product.imageUrl);

        addImage(product.img);

        addImage(product.thumbnail);

        addImage(product.thumbnailUrl);

        addImage(product.mainImage);

        addImage(product.main_image);

        addImage(product.images);

        addImage(product.imageUrls);

        addImage(product.image_urls);

        addImage(product.gallery);

        addImage(product.galleryImages);

        if (!images.length) {
            images.push(CONFIG.DEFAULT_IMAGE);
        }

        return images;

    }


    /* ========================================================================
       PRODUCT NORMALIZATION
       ======================================================================== */

    function normalizeProduct(raw) {

        if (!raw || typeof raw !== "object") {
            return null;
        }


        const id = firstNonEmpty(
            raw.id,
            raw.productId,
            raw.product_id,
            raw.itemId,
            raw.item_id,
            raw.goodsId,
            raw.goods_id,
            raw.pid,
            raw.uuid,
            raw.sku
        );


        const sku = firstNonEmpty(
            raw.sku,
            raw.SKU,
            raw.productSku,
            raw.product_sku,
            raw.itemSku,
            raw.item_sku
        );


        const name = firstNonEmpty(
            raw.name,
            raw.title,
            raw.productName,
            raw.product_name,
            raw.itemName,
            raw.item_name
        );


        const description = firstNonEmpty(
            raw.description,
            raw.productDescription,
            raw.product_description,
            raw.desc,
            raw.shortDescription,
            raw.short_description
        );


        const category = firstNonEmpty(
            raw.category,
            raw.categoryName,
            raw.category_name,
            raw.productCategory,
            raw.product_category,
            CONFIG.DEFAULT_CATEGORY
        );


        const price = safeNumber(
            firstNonEmpty(
                raw.price,
                raw.salePrice,
                raw.sale_price,
                raw.sellingPrice,
                raw.selling_price,
                raw.retailPrice,
                raw.retail_price,
                raw.amount
            ),
            CONFIG.DEFAULT_PRICE
        );


        const originalPrice = safeNumber(
            firstNonEmpty(
                raw.originalPrice,
                raw.original_price,
                raw.compareAtPrice,
                raw.compare_at_price,
                raw.listPrice,
                raw.list_price,
                raw.msrp
            ),
            0
        );


        const stock = firstNonEmpty(
            raw.stock,
            raw.inventory,
            raw.quantity,
            raw.availableQuantity,
            raw.available_quantity
        );


        const rating = safeNumber(
            firstNonEmpty(
                raw.rating,
                raw.averageRating,
                raw.average_rating,
                raw.reviewRating,
                raw.review_rating
            ),
            0
        );


        const reviewCount = safeNumber(
            firstNonEmpty(
                raw.reviewCount,
                raw.review_count,
                raw.reviewsCount,
                raw.reviews_count,
                raw.totalReviews,
                raw.total_reviews
            ),
            0
        );


        const images = normalizeImages(raw);


        const normalized = {

            ...raw,

            id: String(id || "").trim(),

            sku: String(sku || "").trim(),

            name:
                String(name || "Unnamed Product").trim(),

            title:
                String(name || "Unnamed Product").trim(),

            description:
                String(description || "No product description available.").trim(),

            category:
                String(category || CONFIG.DEFAULT_CATEGORY).trim(),

            price,

            originalPrice,

            stock,

            rating,

            reviewCount,

            images,

            image: images[0],

            slug: slugify(name || id || sku)

        };


        return normalized;

    }


    /* ========================================================================
       EXTRACT PRODUCTS FROM API RESPONSE
       ======================================================================== */

    function extractProducts(payload) {

        if (!payload) {
            return [];
        }


        if (Array.isArray(payload)) {
            return payload;
        }


        if (typeof payload !== "object") {
            return [];
        }


        const candidates = [

            payload.products,

            payload.data,

            payload.items,

            payload.results,

            payload.catalog,

            payload.productList,

            payload.product_list

        ];


        for (const candidate of candidates) {

            if (Array.isArray(candidate)) {
                return candidate;
            }


            if (
                candidate &&
                typeof candidate === "object"
            ) {

                const nested = extractProducts(candidate);

                if (nested.length) {
                    return nested;
                }

            }

        }


        /*
         * Some APIs return:
         *
         * {
         *   "001": {...},
         *   "002": {...}
         * }
         */

        const values = Object.values(payload);

        if (
            values.length &&
            values.every(
                value =>
                    value &&
                    typeof value === "object" &&
                    !Array.isArray(value)
            )
        ) {

            return values;

        }


        return [];

    }


    /* ========================================================================
       API FETCH
       ======================================================================== */

    async function fetchProductsFromAPI() {

        const urls = [
            ...new Set(CONFIG.API_FALLBACK_URLS)
        ];


        for (const url of urls) {

            try {

                const response = await fetch(
                    url,
                    {
                        method: "GET",
                        headers: {
                            "Accept": "application/json"
                        },
                        cache: "no-store"
                    }
                );


                if (!response.ok) {
                    continue;
                }


                const payload =
                    await response.json();


                const products =
                    extractProducts(payload);


                if (products.length) {

                    return products
                        .map(normalizeProduct)
                        .filter(Boolean);

                }

            } catch (error) {

                console.warn(
                    `Product API failed: ${url}`,
                    error
                );

            }

        }


        return [];

    }


    /* ========================================================================
       LOCAL STORAGE PRODUCT
       ======================================================================== */

    function getStoredProduct() {

        for (
            const key of CONFIG.STORAGE_KEYS
        ) {

            try {

                const raw =
                    localStorage.getItem(key);


                if (!raw) {
                    continue;
                }


                const parsed =
                    JSON.parse(raw);


                const product =
                    normalizeProduct(parsed);


                if (product) {
                    return product;
                }

            } catch (error) {

                console.warn(
                    `Invalid stored product in ${key}`,
                    error
                );

            }

        }


        return null;

    }


    /* ========================================================================
       URL PARAMETERS
       ======================================================================== */

    function getProductParameters() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return {

            id:
                params.get("id") ||
                params.get("productId") ||
                params.get("product_id"),

            sku:
                params.get("sku") ||
                params.get("SKU"),

            product:
                params.get("product"),

            name:
                params.get("name"),

            slug:
                params.get("slug")

        };

    }


    /* ========================================================================
       PRODUCT MATCHING
       ======================================================================== */

    function findProduct(products, params) {

        if (!products.length) {
            return null;
        }


        /*
         * 1. Exact ID
         */

        if (params.id) {

            const target =
                normalize(params.id);


            const found =
                products.find(product =>
                    normalize(product.id) === target
                );


            if (found) {
                return found;
            }

        }


        /*
         * 2. Exact SKU
         */

        if (params.sku) {

            const target =
                normalize(params.sku);


            const found =
                products.find(product =>
                    normalize(product.sku) === target
                );


            if (found) {
                return found;
            }

        }


        /*
         * 3. Product slug
         */

        if (params.slug) {

            const target =
                normalize(params.slug);


            const found =
                products.find(product =>
                    normalize(product.slug) === target ||
                    slugify(product.name) === target
                );


            if (found) {
                return found;
            }

        }


        /*
         * 4. Product name
         */

        const nameTarget =
            params.product ||
            params.name;


        if (nameTarget) {

            const target =
                normalize(
                    decodeURIComponent(nameTarget)
                );


            /*
             * Exact title
             */

            let found =
                products.find(product =>
                    normalize(product.name) === target
                );


            if (found) {
                return found;
            }


            /*
             * SKU / ID could have been passed through product parameter.
             */

            found =
                products.find(product =>
                    normalize(product.id) === target ||
                    normalize(product.sku) === target
                );


            if (found) {
                return found;
            }


            /*
             * Loose title matching.
             */

            found =
                products.find(product => {

                    const productName =
                        normalize(product.name);

                    return (
                        productName.includes(target) ||
                        target.includes(productName)
                    );

                });


            if (found) {
                return found;
            }

        }


        return null;

    }


    /* ========================================================================
       RESOLVE CURRENT PRODUCT
       ======================================================================== */

    async function resolveProduct() {

        const params =
            getProductParameters();


        /*
         * Fetch catalog first because this is the authoritative source.
         */

        const apiProducts =
            await fetchProductsFromAPI();


        allProducts =
            apiProducts;


        /*
         * Try URL-based resolution.
         */

        let product =
            findProduct(
                allProducts,
                params
            );


        if (product) {
            return product;
        }


        /*
         * Try stored product.
         */

        const storedProduct =
            getStoredProduct();


        if (storedProduct) {

            /*
             * If URL has no useful identifier,
             * use stored product directly.
             */

            if (
                !params.id &&
                !params.sku &&
                !params.product &&
                !params.name &&
                !params.slug
            ) {

                return storedProduct;

            }


            /*
             * If stored product has an ID/SKU,
             * try to resolve it against API catalog.
             */

            const storedResolved =
                findProduct(
                    allProducts,
                    {
                        id: storedProduct.id,
                        sku: storedProduct.sku,
                        product: storedProduct.name,
                        name: storedProduct.name
                    }
                );


            if (storedResolved) {
                return storedResolved;
            }


            return storedProduct;

        }


        /*
         * If no explicit product identifier exists,
         * use the first product only as a last resort.
         */

        if (
            !params.id &&
            !params.sku &&
            !params.product &&
            !params.name &&
            !params.slug &&
            allProducts.length
        ) {

            return allProducts[0];

        }


        return null;

    }


    /* ========================================================================
       UPDATE DOCUMENT SEO
       ======================================================================== */

    function updateSEO(product) {

        if (!product) {
            return;
        }


        const title =
            `${product.name} — PRASUN SHOP`;


        const description =
            product.description ||
            `Buy ${product.name} from PRASUN SHOP.`;


        document.title = title;


        const metaDescription =
            document.querySelector(
                'meta[name="description"]'
            );


        if (metaDescription) {

            metaDescription.setAttribute(
                "content",
                description.slice(0, 160)
            );

        }


        const ogTitle =
            document.querySelector(
                'meta[property="og:title"]'
            );


        if (ogTitle) {

            ogTitle.setAttribute(
                "content",
                title
            );

        }


        const ogDescription =
            document.querySelector(
                'meta[property="og:description"]'
            );


        if (ogDescription) {

            ogDescription.setAttribute(
                "content",
                description.slice(0, 200)
            );

        }


        const ogImage =
            document.querySelector(
                'meta[property="og:image"]'
            );


        if (ogImage) {

            ogImage.setAttribute(
                "content",
                product.image
            );

        }


        const schema =
            document.getElementById(
                "product-schema"
            );


        if (schema) {

            const schemaData = {

                "@context":
                    "https://schema.org/",

                "@type":
                    "Product",

                name:
                    product.name,

                image:
                    product.images,

                description:
                    description,

                sku:
                    product.sku || product.id,

                brand: {

                    "@type":
                        "Brand",

                    name:
                        "PRASUN SHOP"

                },

                offers: {

                    "@type":
                        "Offer",

                    priceCurrency:
                        "USD",

                    price:
                        product.price.toFixed(2),

                    availability:
                        safeNumber(product.stock, 1) > 0
                            ? "https://schema.org/InStock"
                            : "https://schema.org/OutOfStock"

                }

            };


            schema.textContent =
                JSON.stringify(
                    schemaData,
                    null,
                    2
                );

        }

    }


    /* ========================================================================
       RATING HTML
       ======================================================================== */

    function renderRating(product) {

        const rating =
            Math.max(
                0,
                Math.min(
                    5,
                    safeNumber(product.rating, 0)
                )
            );


        const rounded =
            Math.round(rating);


        let stars = "";


        for (let i = 1; i <= 5; i++) {

            stars +=
                i <= rounded
                    ? "★"
                    : "☆";

        }


        const count =
            safeNumber(
                product.reviewCount,
                0
            );


        return `

            <div class="product-rating">

                <span
                    class="rating-stars"
                    aria-label="${rating.toFixed(1)} out of 5 stars"
                >
                    ${stars}
                </span>

                <span>
                    ${rating > 0 ? rating.toFixed(1) : "New"}
                </span>

                ${
                    count > 0
                        ? `<span class="rating-count">
                            (${count})
                           </span>`
                        : ""
                }

            </div>

        `;

    }


    /* ========================================================================
       DISCOUNT
       ======================================================================== */

    function renderPricing(product) {

        const price =
            safeNumber(product.price, 0);


        const original =
            safeNumber(
                product.originalPrice,
                0
            );


        let originalHTML = "";

        let discountHTML = "";


        if (
            original > price &&
            price > 0
        ) {

            const discount =
                Math.round(
                    ((original - price) /
                        original) *
                    100
                );


            originalHTML = `
                <span class="price-original">
                    ${formatPrice(original)}
                </span>
            `;


            discountHTML = `
                <span class="price-discount">
                    ${discount}% OFF
                </span>
            `;

        }


        return `

            <div class="product-price">

                <span class="price-current">
                    ${formatPrice(price)}
                </span>

                ${originalHTML}

                ${discountHTML}

            </div>

        `;

    }


    /* ========================================================================
       RENDER MAIN PRODUCT
       ======================================================================== */

    function renderProduct(product) {

        if (!detailContainer) {
            return;
        }


        currentProduct =
            normalizeProduct(product);


        if (!currentProduct) {

            renderError(
                "Product data could not be loaded."
            );

            return;

        }


        currentImageIndex = 0;

        currentQuantity = 1;


        updateSEO(currentProduct);


        if (breadcrumbCategory) {

            breadcrumbCategory.textContent =
                currentProduct.category;

        }


        if (breadcrumbTitle) {

            breadcrumbTitle.textContent =
                currentProduct.name;

        }


        const images =
            currentProduct.images;


        const stockNumber =
            safeNumber(
                currentProduct.stock,
                999
            );


        const inStock =
            stockNumber > 0;


        detailContainer.innerHTML = `

            <div class="product-grid">

                <!-- =====================================================
                     GALLERY
                     ===================================================== -->

                <div class="gallery-wrapper">

                    <div class="product-image-container">

                        <img
                            id="main-product-image"
                            src="${escapeAttribute(images[0])}"
                            alt="${escapeAttribute(currentProduct.name)}"
                            loading="eager"
                            decoding="async"
                        >

                    </div>


                    ${
                        images.length > 1
                            ? `

                                <div
                                    class="gallery-thumbnails"
                                    id="gallery-thumbnails"
                                >

                                    ${images.map(
                                        (image, index) => `

                                        <button
                                            type="button"
                                            class="thumb-btn ${
                                                index === 0
                                                    ? "active"
                                                    : ""
                                            }"
                                            data-image-index="${index}"
                                            aria-label="View product image ${index + 1}"
                                        >

                                            <img
                                                src="${escapeAttribute(image)}"
                                                alt="${escapeAttribute(currentProduct.name)} image ${index + 1}"
                                                loading="lazy"
                                            >

                                        </button>

                                    `
                                    ).join("")}

                                </div>

                            `
                            : ""
                    }

                </div>


                <!-- =====================================================
                     PRODUCT INFORMATION
                     ===================================================== -->

                <div class="product-details">

                    <div class="product-category-row">

                        <span class="product-category">
                            ${escapeHTML(currentProduct.category)}
                        </span>

                        ${renderRating(currentProduct)}

                    </div>


                    <h1 class="product-title">
                        ${escapeHTML(currentProduct.name)}
                    </h1>


                    <div class="product-meta">

                        ${
                            inStock
                                ? `
                                    <span class="product-stock">

                                        <span class="stock-dot"></span>

                                        In Stock

                                    </span>
                                `
                                : `
                                    <span
                                        class="product-stock"
                                        style="
                                            background:#fef2f2;
                                            color:#dc2626;
                                        "
                                    >

                                        <span
                                            class="stock-dot"
                                            style="background:#dc2626;"
                                        ></span>

                                        Out of Stock

                                    </span>
                                `
                        }


                        ${
                            currentProduct.sku
                                ? `
                                    <span>
                                        SKU:
                                        ${escapeHTML(currentProduct.sku)}
                                    </span>
                                `
                                : ""
                        }

                    </div>


                    ${renderPricing(currentProduct)}


                    <div class="product-description">

                        ${formatDescription(
                            currentProduct.description
                        )}

                    </div>


                    <div class="quantity-row">

                        <span class="quantity-label">
                            Quantity
                        </span>

                        <div class="quantity-control">

                            <button
                                type="button"
                                id="quantity-minus"
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>

                            <input
                                id="product-quantity"
                                type="number"
                                min="1"
                                max="99"
                                value="1"
                                inputmode="numeric"
                                aria-label="Product quantity"
                            >

                            <button
                                type="button"
                                id="quantity-plus"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>

                        </div>

                    </div>


                    <div class="button-group">

                        <button
                            type="button"
                            class="product-button product-button-primary"
                            id="add-to-cart-btn"
                            ${
                                !inStock
                                    ? "disabled"
                                    : ""
                            }
                        >

                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>

                            Add to Cart

                        </button>


                        <button
                            type="button"
                            class="product-button product-button-secondary"
                            id="buy-now-btn"
                            ${
                                !inStock
                                    ? "disabled"
                                    : ""
                            }
                        >
                            Buy Now
                        </button>


                        <button
                            type="button"
                            class="wishlist-button"
                            id="wishlist-btn"
                            aria-label="Add to wishlist"
                        >

                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>

                        </button>

                    </div>


                    <div class="trust-badges">

                        <div class="trust-item">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect
                                    x="1"
                                    y="3"
                                    width="15"
                                    height="13"
                                ></rect>
                                <polygon
                                    points="16 8 20 8 23 11 23 16 16 16 16 8"
                                ></polygon>
                                <circle
                                    cx="5.5"
                                    cy="18.5"
                                    r="2.5"
                                ></circle>
                                <circle
                                    cx="18.5"
                                    cy="18.5"
                                    r="2.5"
                                ></circle>
                            </svg>

                            <span>
                                Fast Shipping
                            </span>

                        </div>


                        <div class="trust-item">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M20 12V22H4V12"></path>
                                <rect
                                    x="2"
                                    y="7"
                                    width="20"
                                    height="5"
                                ></rect>
                                <line
                                    x1="12"
                                    y1="22"
                                    x2="12"
                                    y2="7"
                                ></line>
                                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                            </svg>

                            <span>
                                Secure Packaging
                            </span>

                        </div>


                        <div class="trust-item">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M3 12a9 9 0 1 0 3-6.7"></path>
                                <polyline
                                    points="3 4 3 10 9 10"
                                ></polyline>
                            </svg>

                            <span>
                                Easy Returns
                            </span>

                        </div>

                    </div>

                </div>

            </div>

        `;


        if (mobileBuyBar) {

            mobileBuyBar.style.display =
                window.innerWidth <= 768
                    ? "flex"
                    : "";

        }


        if (mobilePriceDisplay) {

            mobilePriceDisplay.textContent =
                formatPrice(
                    currentProduct.price
                );

        }


        bindProductEvents();

        renderSpecifications(currentProduct);

        renderRelatedProducts(currentProduct);

        updateCartCount();

    }


    /* ========================================================================
       DESCRIPTION FORMATTER
       ======================================================================== */

    function formatDescription(description) {

        const safe =
            escapeHTML(
                description ||
                "No product description available."
            );


        return safe
            .replace(/\n{2,}/g, "</p><p>")
            .replace(/\n/g, "<br>");

    }


    /* ========================================================================
       PRODUCT EVENTS
       ======================================================================== */

    function bindProductEvents() {

        const quantityInput =
            document.getElementById(
                "product-quantity"
            );


        const minus =
            document.getElementById(
                "quantity-minus"
            );


        const plus =
            document.getElementById(
                "quantity-plus"
            );


        const addButton =
            document.getElementById(
                "add-to-cart-btn"
            );


        const buyButton =
            document.getElementById(
                "buy-now-btn"
            );


        const wishlistButton =
            document.getElementById(
                "wishlist-btn"
            );


        if (quantityInput) {

            quantityInput.addEventListener(
                "input",
                () => {

                    let value =
                        parseInt(
                            quantityInput.value,
                            10
                        );


                    if (!Number.isFinite(value)) {
                        value = 1;
                    }


                    value =
                        Math.max(
                            1,
                            Math.min(
                                99,
                                value
                            )
                        );


                    quantityInput.value =
                        value;


                    currentQuantity =
                        value;

                }
            );

        }


        if (minus) {

            minus.addEventListener(
                "click",
                () => {

                    setQuantity(
                        currentQuantity - 1
                    );

                }
            );

        }


        if (plus) {

            plus.addEventListener(
                "click",
                () => {

                    setQuantity(
                        currentQuantity + 1
                    );

                }
            );

        }


        if (addButton) {

            addButton.addEventListener(
                "click",
                () => {

                    addCurrentProductToCart();

                }
            );

        }


        if (buyButton) {

            buyButton.addEventListener(
                "click",
                () => {

                    buyCurrentProduct();

                }
            );

        }


        if (mobileAddCartBtn) {

            mobileAddCartBtn.onclick =
                () => {

                    addCurrentProductToCart();

                };

        }


        if (wishlistButton) {

            wishlistButton.addEventListener(
                "click",
                () => {

                    toggleWishlist(
                        wishlistButton
                    );

                }
            );

        }


        document
            .querySelectorAll(
                ".thumb-btn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset
                                    .imageIndex
                            );


                        changeMainImage(index);

                    }
                );

            });

    }


    /* ========================================================================
       QUANTITY
       ======================================================================== */

    function setQuantity(value) {

        currentQuantity =
            Math.max(
                1,
                Math.min(
                    99,
                    Number(value) || 1
                )
            );


        const input =
            document.getElementById(
                "product-quantity"
            );


        if (input) {

            input.value =
                currentQuantity;

        }

    }


    /* ========================================================================
       CHANGE IMAGE
       ======================================================================== */

    function changeMainImage(index) {

        if (!currentProduct) {
            return;
        }


        const images =
            currentProduct.images || [];


        if (
            index < 0 ||
            index >= images.length
        ) {
            return;
        }


        currentImageIndex =
            index;


        const mainImage =
            document.getElementById(
                "main-product-image"
            );


        if (mainImage) {

            mainImage.src =
                images[index];

        }


        document
            .querySelectorAll(
                ".thumb-btn"
            )
            .forEach(
                (button, buttonIndex) => {

                    button.classList.toggle(
                        "active",
                        buttonIndex === index
                    );

                }
            );

    }


    /* ========================================================================
       CART
       ======================================================================== */

    function getCart() {

        /*
         * Prefer the same cart storage used by cart.js.
         */

        for (
            const key of CONFIG.CART_STORAGE_KEYS
        ) {

            try {

                const raw =
                    localStorage.getItem(key);


                if (!raw) {
                    continue;
                }


                const parsed =
                    JSON.parse(raw);


                if (Array.isArray(parsed)) {
                    return parsed;
                }

            } catch (error) {

                console.warn(
                    "Unable to read cart:",
                    error
                );

            }

        }


        return [];

    }


    function saveCart(cart) {

        /*
         * Main cart storage.
         */

        localStorage.setItem(
            "prasun_cart",
            JSON.stringify(cart)
        );


        /*
         * Keep legacy key synchronized.
         */

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

    }


    function addCurrentProductToCart() {

        if (!currentProduct) {

            showToast(
                "Product is not available."
            );

            return;

        }


        const quantity =
            currentQuantity || 1;


        const cart =
            getCart();


        const productId =
            currentProduct.id ||
            currentProduct.sku ||
            slugify(
                currentProduct.name
            );


        const existing =
            cart.find(item => {

                const itemId =
                    item.id ||
                    item.sku ||
                    item.productId ||
                    slugify(
                        item.name ||
                        item.title ||
                        ""
                    );


                return (
                    String(itemId) ===
                    String(productId)
                );

            });


        if (existing) {

            existing.quantity =
                Math.max(
                    1,
                    safeNumber(
                        existing.quantity,
                        0
                    ) + quantity
                );

        } else {

            cart.push({

                id:
                    currentProduct.id ||
                    productId,

                sku:
                    currentProduct.sku ||
                    "",

                name:
                    currentProduct.name,

                title:
                    currentProduct.name,

                price:
                    currentProduct.price,

                image:
                    currentProduct.image,

                images:
                    currentProduct.images,

                category:
                    currentProduct.category,

                quantity,

                stock:
                    currentProduct.stock

            });

        }


        saveCart(cart);

        updateCartCount();


        showToast(
            `${currentProduct.name} added to cart`
        );

    }


    /* ========================================================================
       BUY NOW
       ======================================================================== */

    function buyCurrentProduct() {

        addCurrentProductToCart();


        setTimeout(() => {

            window.location.href =
                CONFIG.CART_URL;

        }, 250);

    }


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount() {

        if (!cartCount) {
            return;
        }


        const cart =
            getCart();


        const count =
            cart.reduce(
                (total, item) =>
                    total +
                    Math.max(
                        0,
                        safeNumber(
                            item.quantity,
                            0
                        )
                    ),
                0
            );


        cartCount.textContent =
            count > 99
                ? "99+"
                : String(count);


        cartCount.hidden =
            count <= 0;

    }


    /* ========================================================================
       WISHLIST
       ======================================================================== */

    function getWishlist() {

        try {

            const raw =
                localStorage.getItem(
                    "prasun_wishlist"
                );


            if (!raw) {
                return [];
            }


            const parsed =
                JSON.parse(raw);


            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch {

            return [];

        }

    }


    function toggleWishlist(button) {

        if (!currentProduct) {
            return;
        }


        const wishlist =
            getWishlist();


        const id =
            currentProduct.id ||
            currentProduct.sku ||
            slugify(
                currentProduct.name
            );


        const index =
            wishlist.findIndex(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (index >= 0) {

            wishlist.splice(
                index,
                1
            );


            button.classList.remove(
                "active"
            );


            showToast(
                "Removed from wishlist"
            );

        } else {

            wishlist.push({

                id,

                sku:
                    currentProduct.sku,

                name:
                    currentProduct.name,

                price:
                    currentProduct.price,

                image:
                    currentProduct.image

            });


            button.classList.add(
                "active"
            );


            showToast(
                "Added to wishlist"
            );

        }


        localStorage.setItem(
            "prasun_wishlist",
            JSON.stringify(wishlist)
        );

    }


    /* ========================================================================
       SPECIFICATIONS
       ======================================================================== */

    function renderSpecifications(product) {

        if (!productTabs || !specTable) {
            return;
        }


        const specifications = [];


        function add(label, value) {

            if (
                value === undefined ||
                value === null ||
                String(value).trim() === ""
            ) {
                return;
            }


            specifications.push({
                label,
                value
            });

        }


        add(
            "Product ID",
            product.id
        );


        add(
            "SKU",
            product.sku
        );


        add(
            "Category",
            product.category
        );


        add(
            "Availability",
            safeNumber(
                product.stock,
                999
            ) > 0
                ? "In Stock"
                : "Out of Stock"
        );


        /*
         * Preserve useful custom specifications returned by the Worker.
         */

        const specs =
            product.specifications ||
            product.specs ||
            product.attributes;


        if (
            specs &&
            typeof specs === "object" &&
            !Array.isArray(specs)
        ) {

            Object.entries(specs)
                .forEach(
                    ([key, value]) => {

                        if (
                            typeof value ===
                            "object"
                        ) {
                            value =
                                JSON.stringify(
                                    value
                                );
                        }


                        add(
                            formatLabel(key),
                            value
                        );

                    }
                );

        }


        if (!specifications.length) {

            specTable.innerHTML = `
                <tbody>
                    <tr>
                        <td colspan="2">
                            No additional specifications available.
                        </td>
                    </tr>
                </tbody>
            `;

        } else {

            specTable.innerHTML = `

                <tbody>

                    ${specifications.map(
                        item => `

                        <tr>

                            <td>
                                ${escapeHTML(item.label)}
                            </td>

                            <td>
                                ${escapeHTML(item.value)}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            `;

        }


        productTabs.style.display =
            "block";

    }


    function formatLabel(value) {

        return String(value)
            .replace(/[_-]+/g, " ")
            .replace(
                /([a-z])([A-Z])/g,
                "$1 $2"
            )
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );

    }


    /* ========================================================================
       RELATED PRODUCTS
       ======================================================================== */

    function renderRelatedProducts(product) {

        if (
            !relatedSection ||
            !relatedGrid
        ) {
            return;
        }


        let related =
            allProducts.filter(item =>
                item &&
                (
                    item.id !== product.id ||
                    item.sku !== product.sku
                )
            );


        const sameCategory =
            related.filter(item =>
                normalize(item.category) ===
                normalize(product.category)
            );


        if (sameCategory.length) {

            related =
                [
                    ...sameCategory,
                    ...related.filter(
                        item =>
                            !sameCategory.includes(
                                item
                            )
                    )
                ];

        }


        related =
            related.slice(
                0,
                CONFIG.MAX_RELATED_PRODUCTS
            );


        if (!related.length) {

            relatedSection.style.display =
                "none";

            return;

        }


        relatedGrid.innerHTML =
            related.map(
                relatedProduct =>
                    createRelatedCard(
                        relatedProduct
                    )
            ).join("");


        relatedSection.style.display =
            "block";


        relatedGrid
            .querySelectorAll(
                "[data-product-id]"
            )
            .forEach(card => {

                card.addEventListener(
                    "click",
                    () => {

                        const id =
                            card.dataset.productId;


                        const relatedProduct =
                            allProducts.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(id)
                            );


                        if (
                            relatedProduct
                        ) {

                            navigateToProduct(
                                relatedProduct
                            );

                        }

                    }
                );

            });

    }


    function createRelatedCard(product) {

        const id =
            product.id ||
            product.sku ||
            slugify(product.name);


        return `

            <article
                class="related-card"
                data-product-id="${escapeAttribute(id)}"
                tabindex="0"
                role="link"
                aria-label="View ${escapeAttribute(product.name)}"
            >

                <img
                    src="${escapeAttribute(product.image)}"
                    alt="${escapeAttribute(product.name)}"
                    loading="lazy"
                    decoding="async"
                >

                <h3 class="related-card-title">
                    ${escapeHTML(product.name)}
                </h3>

                <div class="related-card-price">
                    ${formatPrice(product.price)}
                </div>

            </article>

        `;

    }


    /* ========================================================================
       NAVIGATION
       ======================================================================== */

    function navigateToProduct(product) {

        const identifier =
            product.id ||
            product.sku ||
            slugify(product.name);


        /*
         * ID is preferred.
         */

        const parameter =
            product.id
                ? `id=${encodeURIComponent(product.id)}`
                : product.sku
                    ? `sku=${encodeURIComponent(product.sku)}`
                    : `slug=${encodeURIComponent(slugify(product.name))}`;


        /*
         * Store a complete fallback copy.
         */

        try {

            localStorage.setItem(
                "prasun_selected_product",
                JSON.stringify(product)
            );

        } catch (error) {

            console.warn(
                "Could not store selected product:",
                error
            );

        }


        window.location.href =
            `product.html?${parameter}`;

    }


    /* ========================================================================
       ERROR STATE
       ======================================================================== */

    function renderError(message) {

        if (!detailContainer) {
            return;
        }


        detailContainer.innerHTML = `

            <div
                style="
                    min-height:420px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    text-align:center;
                    padding:40px 20px;
                "
            >

                <div>

                    <div
                        style="
                            font-size:52px;
                            margin-bottom:20px;
                        "
                    >
                        🛍️
                    </div>

                    <h1
                        style="
                            margin:0 0 12px;
                            font-size:28px;
                        "
                    >
                        Product Not Found
                    </h1>

                    <p
                        style="
                            max-width:560px;
                            margin:0 auto 24px;
                            color:#71717a;
                            line-height:1.6;
                        "
                    >
                        ${escapeHTML(message)}
                    </p>

                    <a
                        href="${CONFIG.HOME_URL}"
                        class="product-button product-button-primary"
                    >
                        Back to Shop
                    </a>

                </div>

            </div>

        `;


        if (productTabs) {
            productTabs.style.display =
                "none";
        }


        if (relatedSection) {
            relatedSection.style.display =
                "none";
        }

    }


    /* ========================================================================
       TOAST
       ======================================================================== */

    function showToast(message) {

        if (
            typeof window.showToast ===
            "function"
        ) {

            window.showToast(
                message
            );

            return;

        }


        const container =
            document.getElementById(
                "toast-container"
            );


        if (!container) {
            return;
        }


        const toast =
            document.createElement(
                "div"
            );


        toast.className =
            "toast";


        toast.textContent =
            message;


        container.appendChild(
            toast
        );


        setTimeout(() => {

            toast.remove();

        }, 3000);

    }


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    async function init() {

        try {

            /*
             * Resolve product from URL/API/storage.
             */

            const product =
                await resolveProduct();


            if (!product) {

                renderError(
                    "We could not find this product. Please return to the shop and select the product again."
                );

                return;

            }


            renderProduct(
                product
            );


        } catch (error) {

            console.error(
                "Product page initialization failed:",
                error
            );


            renderError(
                "Something went wrong while loading this product. Please try again."
            );

        }

    }


    /* ========================================================================
       GLOBAL HELPERS
       ======================================================================== */

    window.PrasunProduct = {

        getCurrentProduct:
            () => currentProduct,

        getAllProducts:
            () => allProducts,

        navigateToProduct,

        addCurrentProductToCart,

        updateCartCount

    };


    /* ========================================================================
       START
       ======================================================================== */

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
