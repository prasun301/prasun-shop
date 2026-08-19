/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY
 * ============================================================================
 *
 * Compatible with:
 *   - index.html
 *   - Cloudflare Worker /api/products
 *   - CJ Dropshipping API 2.0
 *
 * Features:
 *   - Live CJ catalog loading
 *   - CJ keyword search
 *   - Local fallback catalog
 *   - Safe local/CJ merging
 *   - SKU/PID-aware deduplication
 *   - Category filtering
 *   - Price/name/rating sorting
 *   - Debounced search
 *   - Abortable search requests
 *   - Search request race protection
 *   - Shopping cart integration
 *   - Cart quantity protection
 *   - Product detail links
 *   - CJ variant preservation
 *   - Broken-image protection
 *   - Timeout protection
 *   - Accessible UI states
 *   - Accurate handling of missing ratings
 * ============================================================================
 */
"use strict";
(() => {
    /* ========================================================================
       CONFIG
       ======================================================================== */
    const API_ENDPOINT = "https://prasun-shop-api.prasun301.workers.dev/api/products";
    const CART_KEY = "prasun_cart";
    const CART_EVENT_NAME = "prasunCartUpdated";
    const API_TIMEOUT = 12000;
    const SEARCH_DELAY = 400;
    const MAX_CART_QUANTITY = 99;
    const MIN_SEARCH_LENGTH = 2;
    const PRODUCT_DETAIL_PAGE = "/product.html";

    /* ========================================================================
       LOCAL FALLBACK CATALOG
       ======================================================================== */
    const LOCAL_CATALOG = [
        {
            id: "001",
            sku: "CJSN188416414NM",
            name: "G-Shaped Smart LED Atmosphere Lamp with Bluetooth Speaker & Wireless Charger",
            category: "Smart Lighting",
            price: 29.99,
            rating: null,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",
            images: [
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/10_57d942b5-c025-425a-a8a4-d87c6a612631.png"
            ],
            description:
                "Upgrade your living space with this multifunctional G-shaped Smart LED Atmosphere Lamp combining customizable lighting, Bluetooth audio, 15W wireless charging, and alarm clock controls.",
            features: [
                "15W fast wireless charging",
                "Built-in Bluetooth speaker",
                "RGB atmosphere lighting",
                "APP, voice, remote and button control",
                "Adjustable brightness from 1% to 100%",
                "Multiple light color modes",
                "Smart wake-up and sleep mode",
                "Modern decorative design"
            ],
            specifications: {
                "Material": "Plastic",
                "Product Type": "Electronic Smart Lamp",
                "Color Options": "Black, Light Grey, White",
                "Dimensions": "22.5 × 8.2 × 23 cm",
                "Package Size": "227 × 86 × 240 mm",
                "Wireless Charging": "15W",
                "Control": "APP / Voice / Remote / Button",
                "Power Input": "100-240V"
            },
            variants: []
        },
        {
            id: "002",
            sku: "CJCD135893009IR",
            name: "Mini 5000mAh Magnetic Wireless Power Bank Fast Charging Portable Battery",
            category: "Power & Charging",
            price: 39.99,
            rating: null,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",
            images: [
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg"
            ],
            description:
                "Compact 5000mAh Magnetic Wireless Power Bank featuring strong magnetic attachment, fast charging, LED power display, and a travel-friendly portable design.",
            features: [
                "5000mAh battery capacity",
                "Strong magnetic wireless charging",
                "Six-level magnetic adsorption system",
                "Fast charging technology",
                "LED battery display",
                "Supports wireless and wired charging",
                "Compact travel-friendly design",
                "Portable rechargeable battery"
            ],
            specifications: {
                "Material": "Plastic",
                "Product Type": "Portable Power Bank",
                "Capacity": "5000mAh",
                "Input / Output": "5V / 2.1A",
                "Wireless Charging": "5W",
                "Dimensions": "91 × 64 × 15 mm",
                "Color Options":
                    "Cool Black, Retro Green, Ivory White, Cherry Blossom Pink",
                "Compatibility": "Apple & Qi-compatible devices"
            },
            variants: []
        },
        {
            id: "003",
            sku: "CJYP270967903CX",
            name: "High-Quality Noise Cancelling Wireless Bluetooth Sports Earbuds",
            category: "Audio",
            price: 49.99,
            rating: null,
            image: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",
            images: [
                "https://cc-west-usa.oss-us-west-1.aliyuncs.com/1688/683789098711/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg"
            ],
            description:
                "Immersive sound with Noise Cancelling Wireless Bluetooth Sports Earbuds designed for workouts, travel, calls, and low-latency gaming.",
            features: [
                "Noise cancellation technology",
                "Bluetooth wireless connection",
                "Water-resistant design",
                "Low-latency gaming mode",
                "Voice control support",
                "Hands-free calling",
                "Long battery life",
                "Comfortable in-ear design"
            ],
            specifications: {
                "Material": "PC + ABS",
                "Product Type": "Wireless Bluetooth Earbuds",
                "Wearing Style": "In-ear",
                "Transmission Distance": "10 meters",
                "Battery Life": "4-8 hours",
                "Color Options": "White, Skin Tone, Black",
                "Package Size": "120 × 100 × 60 mm"
            },
            variants: []
        }
    ];

    /* ========================================================================
       DOM
       ======================================================================== */
    const productList = document.getElementById("product-list");
    if (!productList) {
        console.error("[PRASUN SHOP] #product-list was not found.");
        return;
    }

    const searchInput = document.getElementById("product-search");
    const sortSelect = document.getElementById("product-sort");
    const categoriesContainer = document.getElementById("products-categories");
    const productsHeading =
        document.getElementById("products-heading") ||
        document.getElementById("page-heading");
    const productsCount = document.getElementById("results-count");
    const clearSearchButton = document.getElementById("clear-search");
    const ariaLiveRegion = document.getElementById("aria-live-region");
    const cartCount = document.getElementById("cart-count");

    /* ========================================================================
       STATE
       ======================================================================== */
    let masterCatalog = []; // Master store for all loaded catalog items
    let allProducts = [];   // Active dataset for current filter/search view
    let filteredProducts = [];
    let activeCategory = "all";
    let currentSearch = "";
    let currentSort = sortSelect?.value || "featured";
    let searchTimer = null;
    let activeSearchController = null;
    let searchRequestSequence = 0;
    let catalogRequestSequence = 0;

    /* ========================================================================
       FALLBACK IMAGE
       ======================================================================== */
    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="800"
                 height="800"
                 viewBox="0 0 800 800">
                <rect width="800" height="800" fill="#f8fafc"/>
                <path
                    d="M220 540 L330 420 L420 500 L500 430 L580 540 Z"
                    fill="#e2e8f0"
                />
                <circle
                    cx="330"
                    cy="300"
                    r="55"
                    fill="#cbd5e1"
                />
                <text
                    x="400"
                    y="635"
                    text-anchor="middle"
                    fill="#64748b"
                    font-family="Arial, sans-serif"
                    font-size="28"
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
        if (value === null || value === undefined) {
            return "";
        }
        return String(value).replace(/[&<>"']/g, character => ESCAPE_MAP[character]);
    }

    /* ========================================================================
       SAFE TEXT
       ======================================================================== */
    function cleanText(value, fallback = "") {
        if (value === null || value === undefined) {
            return fallback;
        }
        const text = String(value).trim();
        return text || fallback;
    }

    /* ========================================================================
       PRICE
       ======================================================================== */
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function parsePrice(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return Math.max(0, value);
        }
        const parsed = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    function extractPrice(product) {
        if (!product || typeof product !== "object") {
            return 0;
        }
        const candidates = [
            product.discountPrice,
            product.nowPrice,
            product.sellPrice,
            product.price,
            product.startSellPrice,
            product.salePrice,
            product.productPrice
        ];
        for (const candidate of candidates) {
            const parsed = parsePrice(candidate);
            if (parsed > 0) {
                return parsed;
            }
        }
        return 0;
    }

    function formatPrice(value) {
        return currencyFormatter.format(parsePrice(value));
    }

    /* ========================================================================
       IMAGE URL NORMALIZATION
       ======================================================================== */
    function normalizeImageURL(value) {
        if (value === null || value === undefined) {
            return "";
        }
        let image = String(value).trim();
        if (!image) {
            return "";
        }
        if (image.startsWith("//")) {
            return "https:" + image;
        }
        if (
            /^https?:\/\//i.test(image) ||
            image.startsWith("data:") ||
            image.startsWith("blob:") ||
            image.startsWith("/") ||
            image.startsWith("./") ||
            image.startsWith("../")
        ) {
            return image;
        }
        return "https://" + image.replace(/^\/+/, "");
    }

    /* ========================================================================
       IMAGE EXTRACTION
       ======================================================================== */
    function extractImages(product) {
        const candidates = [];
        const addCandidate = value => {
            if (Array.isArray(value)) {
                value.forEach(addCandidate);
                return;
            }
            if (value && typeof value === "object") {
                addCandidate(value.url);
                addCandidate(value.imageUrl);
                addCandidate(value.image);
                return;
            }
            const normalized = normalizeImageURL(value);
            if (normalized) {
                candidates.push(normalized);
            }
        };

        addCandidate(product.image);
        addCandidate(product.bigImage);
        addCandidate(product.imageUrl);
        addCandidate(product.productImage);
        addCandidate(product.productImageUrl);
        addCandidate(product.imgUrl);
        addCandidate(product.thumbnail);
        addCandidate(product.thumbnailUrl);
        addCandidate(product.mainImage);
        addCandidate(product.productMainImage);
        addCandidate(product.images);
        addCandidate(product.productImageList);
        addCandidate(product.imageList);

        return [...new Set(candidates)];
    }

    /* ========================================================================
       ARRAY NORMALIZATION
       ======================================================================== */
    function normalizeArray(value) {
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim()) {
            return value
                .split(/[,\n|]+/)
                .map(item => item.trim())
                .filter(Boolean);
        }
        return [];
    }

    /* ========================================================================
       OBJECT NORMALIZATION
       ======================================================================== */
    function normalizeObject(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    /* ========================================================================
       RATING NORMALIZATION
       ======================================================================== */
    function normalizeRating(product) {
        const value = product?.rating ?? product?.score ?? product?.productScore ?? null;
        if (value === null || value === undefined || value === "") {
            return null;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.max(0, Math.min(5, numeric));
    }

    /* ========================================================================
       VARIANT NORMALIZATION
       ======================================================================== */
    function normalizeVariants(product) {
        const source = Array.isArray(product?.variants)
            ? product.variants
            : Array.isArray(product?.variantList)
            ? product.variantList
            : [];

        return source
            .filter(variant => variant && typeof variant === "object")
            .map(variant => ({
                vid: cleanText(variant.vid),
                pid: cleanText(variant.pid),
                name: cleanText(variant.variantNameEn ?? variant.variantName),
                sku: cleanText(variant.variantSku ?? variant.sku),
                barcode: cleanText(variant.barcode),
                key: cleanText(variant.variantKey),
                image: normalizeImageURL(variant.variantImage ?? variant.image),
                price: parsePrice(variant.variantSellPrice ?? variant.sellPrice ?? variant.price),
                inventories: Array.isArray(variant.inventories) ? variant.inventories : []
            }));
    }

    /* ========================================================================
       PRODUCT NORMALIZATION
       ======================================================================== */
    function normalizeProduct(product, index = 0) {
        if (!product || typeof product !== "object") {
            return null;
        }
        const id =
            product.id ??
            product.pid ??
            product.productId ??
            product.productID ??
            product.productSku ??
            product.sku ??
            `product-${index + 1}`;
        const sku =
            product.sku ??
            product.productSku ??
            product.productCode ??
            product.spu ??
            id;
        const name =
            product.name ??
            product.nameEn ??
            product.productNameEn ??
            product.productName ??
            product.title ??
            "CJ Product";
        const category =
            product.category ??
            product.categoryName ??
            product.categoryNameEn ??
            product.threeCategoryName ??
            product.categoryNameCn ??
            "General";
        const description =
            product.description ??
            product.productDescriptionEn ??
            product.productDescription ??
            product.descriptionEn ??
            product.desc ??
            "";

        const price = extractPrice(product);
        const rating = normalizeRating(product);
        const images = extractImages(product);
        const image = images[0] || "";
        const features = normalizeArray(
            product.features ?? product.featureList ?? product.attributes
        );
        const specifications = normalizeObject(
            product.specifications ?? product.specs ?? product.productSpecifications
        );
        const variants = normalizeVariants(product);

        return {
            id: cleanText(id, `product-${index + 1}`),
            sku: cleanText(sku, cleanText(id, `SKU-${index + 1}`)),
            name: cleanText(name, "CJ Product"),
            category: cleanText(category, "General"),
            price,
            rating,
            image,
            images,
            description: cleanText(description, "Quality product from PRASUN SHOP."),
            features,
            specifications,
            variants,
            productId: cleanText(product.productId ?? product.pid ?? product.id),
            cjProductId: cleanText(product.cjProductId ?? product.pid ?? product.id),
            cjSku: cleanText(product.cjSku ?? product.productSku ?? product.sku),
            inventory: product.inventory ?? product.stock ?? product.warehouseInventoryNum ?? null,
            deliveryCycle: product.deliveryCycle ?? product.deliveryTime ?? null,
            freeShipping: product.freeShipping === true || product.isFreeShipping === true,
            warehouse: cleanText(product.warehouse ?? product.warehouseName),
            country: cleanText(product.country ?? product.countryCode),
            shipping: product.shipping ?? product.shippingInfo ?? null,
            raw: product
        };
    }

    /* ========================================================================
       PRODUCT RESPONSE EXTRACTION
       ======================================================================== */
    function extractProducts(data) {
        if (Array.isArray(data)) {
            return data.map(normalizeProduct).filter(Boolean);
        }
        if (!data || typeof data !== "object") {
            return [];
        }
        const candidates = [
            data.products,
            data.items,
            data.list,
            data.results,
            data.records,
            data.data?.products,
            data.data?.items,
            data.data?.list,
            data.data?.results,
            data.data?.records,
            data.data?.content,
            data.data?.data
        ];
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                const flattened = candidate.flatMap(item => {
                    if (item && Array.isArray(item.productList)) {
                        return item.productList;
                    }
                    return [item];
                });
                return flattened.map(normalizeProduct).filter(Boolean);
            }
        }
        if (data.result && typeof data.result === "object") {
            const nested = extractProducts(data.result);
            if (nested.length) {
                return nested;
            }
        }
        if (data.id || data.pid || data.productId || data.productSku || data.sku) {
            const product = normalizeProduct(data);
            return product ? [product] : [];
        }
        return [];
    }

    /* ========================================================================
       LOCAL PRODUCTS
       ======================================================================== */
    function getLocalProducts() {
        return LOCAL_CATALOG.map(normalizeProduct).filter(Boolean);
    }

    /* ========================================================================
       PRODUCT DEDUPLICATION KEY
       ======================================================================== */
    function productKey(product) {
        if (!product) {
            return "";
        }
        return String(
            product.sku ||
            product.cjSku ||
            product.productId ||
            product.cjProductId ||
            product.id ||
            ""
        )
            .trim()
            .toLowerCase();
    }

    /* ========================================================================
       MERGE PRODUCTS
       ======================================================================== */
    function mergeProducts(baseProducts, incomingProducts) {
        const map = new Map();
        for (const product of baseProducts || []) {
            const normalized = normalizeProduct(product);
            if (!normalized) continue;
            const key = productKey(normalized);
            if (!key) continue;
            map.set(key, normalized);
        }
        for (const product of incomingProducts || []) {
            const normalized = normalizeProduct(product);
            if (!normalized) continue;
            const key = productKey(normalized);
            if (!key) continue;
            map.set(key, normalized);
        }
        return Array.from(map.values());
    }

    /* ========================================================================
       FETCH JSON
       ======================================================================== */
    async function fetchJSON(url, timeout = API_TIMEOUT, externalSignal = null) {
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        let removeExternalListener = null;
        try {
            if (externalSignal) {
                if (externalSignal.aborted) {
                    controller.abort();
                } else {
                    const abortHandler = () => controller.abort();
                    externalSignal.addEventListener("abort", abortHandler, { once: true });
                    removeExternalListener = () => {
                        externalSignal.removeEventListener("abort", abortHandler);
                    };
                }
            }
            const response = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store",
                signal: controller.signal
            });
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            if (!text.trim()) {
                return null;
            }
            try {
                return JSON.parse(text);
            } catch {
                throw new Error("Invalid JSON response");
            }
        } catch (error) {
            if (timedOut || error?.name === "AbortError") {
                const timeoutError = new Error(
                    timedOut ? "Request timed out." : "Request cancelled."
                );
                timeoutError.name = error?.name === "AbortError" ? "AbortError" : "TimeoutError";
                throw timeoutError;
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
            if (removeExternalListener) {
                removeExternalListener();
            }
        }
    }

    /* ========================================================================
       LOAD API PRODUCTS
       ======================================================================== */
    async function loadProductsFromAPI(keyword = "", signal = null) {
        const trimmed = String(keyword || "").trim();
        let url = API_ENDPOINT;
        if (trimmed) {
            const params = new URLSearchParams();
            params.set("keyword", trimmed);
            url += `?${params.toString()}`;
        }
        const data = await fetchJSON(url, API_TIMEOUT, signal);
        const products = extractProducts(data);
        if (!products.length) {
            throw new Error("API returned no usable products.");
        }
        return products;
    }

    /* ========================================================================
       SEARCH STATUS
       ======================================================================== */
    function announce(message) {
        if (ariaLiveRegion) {
            ariaLiveRegion.textContent = message;
        }
    }

    /* ========================================================================
       CLEAR SEARCH BUTTON
       ======================================================================== */
    function updateClearSearchButton() {
        if (!clearSearchButton || !searchInput) {
            return;
        }
        clearSearchButton.hidden = !searchInput.value.trim();
    }

    /* ========================================================================
       FILTER PRODUCTS
       ======================================================================== */
    function filterProducts() {
        const search = currentSearch.trim().toLowerCase();
        filteredProducts = allProducts.filter(product => {
            if (activeCategory !== "all") {
                const productCategory = String(product.category || "").trim().toLowerCase();
                if (productCategory !== activeCategory.trim().toLowerCase()) {
                    return false;
                }
            }
            if (!search) {
                return true;
            }
            const specifications = product.specifications || {};
            const searchableText = [
                product.name,
                product.category,
                product.sku,
                product.cjSku,
                product.productId,
                product.cjProductId,
                product.description,
                ...(product.features || []),
                ...Object.keys(specifications),
                ...Object.values(specifications)
            ]
                .filter(value => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(search);
        });
        applySort();
    }

    /* ========================================================================
       SORT
       ======================================================================== */
    function applySort() {
        switch (currentSort) {
            case "price-low":
                filteredProducts.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
                break;
            case "price-high":
                filteredProducts.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
                break;
            case "rating":
                filteredProducts.sort((a, b) => {
                    const ratingA = a.rating === null || a.rating === undefined ? -1 : Number(a.rating);
                    const ratingB = b.rating === null || b.rating === undefined ? -1 : Number(b.rating);
                    if (ratingB !== ratingA) {
                        return ratingB - ratingA;
                    }
                    return a.name.localeCompare(b.name);
                });
                break;
            case "name-az":
                filteredProducts.sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                );
                break;
            case "featured":
            default:
                break;
        }
    }

    /* ========================================================================
       CATEGORIES
       ======================================================================== */
    function buildCategories() {
        if (!categoriesContainer) {
            return;
        }
        const categoryMap = new Map();
        allProducts.forEach(product => {
            const category = cleanText(product.category);
            if (!category) return;
            const key = category.toLowerCase();
            if (!categoryMap.has(key)) {
                categoryMap.set(key, category);
            }
        });
        const categories = Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b));

        categoriesContainer.innerHTML = `
            <button
                type="button"
                class="category-pill"
                data-category="all"
                aria-pressed="false"
            >
                All
            </button>
            ${categories
                .map(
                    category => `
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
        setActiveCategory(activeCategory);
    }

    /* ========================================================================
       ACTIVE CATEGORY
       ======================================================================== */
    function setActiveCategory(category) {
        activeCategory = String(category || "all");
        if (!categoriesContainer) {
            return;
        }
        const buttons = categoriesContainer.querySelectorAll(".category-pill");
        buttons.forEach(button => {
            const buttonCategory = String(button.dataset.category || "all");
            const active =
                buttonCategory.trim().toLowerCase() === activeCategory.trim().toLowerCase();
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    /* ========================================================================
       STAR RATING
       ======================================================================== */
    function renderStars(rating) {
        if (rating === null || rating === undefined || !Number.isFinite(Number(rating))) {
            return `<span class="product-stars-empty">No rating</span>`;
        }
        const numeric = Math.max(0, Math.min(5, Number(rating)));
        const rounded = Math.round(numeric);
        return "★".repeat(rounded) + "☆".repeat(5 - rounded);
    }

    /* ========================================================================
       PRODUCT RATING TEXT
       ======================================================================== */
    function renderRatingText(rating) {
        if (rating === null || rating === undefined || !Number.isFinite(Number(rating))) {
            return "";
        }
        return Number(rating).toFixed(1);
    }

    /* ========================================================================
       PRODUCT CARD
       ======================================================================== */
    function createProductCard(product) {
        const id = String(product.id);
        const encodedId = encodeURIComponent(id);
        const name = escapeHTML(product.name);
        const category = escapeHTML(product.category || "Product");
        const description = escapeHTML(
            product.description || "Quality product from PRASUN SHOP."
        );
        const image = escapeHTML(product.image || FALLBACK_IMAGE);
        const price = formatPrice(product.price);
        const ratingText = renderRatingText(product.rating);
        const stars = renderStars(product.rating);
        const sku = escapeHTML(product.sku || "");
        const ratingLabel = ratingText ? `Rated ${ratingText} out of 5` : "No rating available";

        return `
            <article
                class="product-card"
                data-product-id="${escapeHTML(id)}"
                data-product-sku="${sku}"
            >
                <div class="product-card-inner">
                    <a
                        href="${PRODUCT_DETAIL_PAGE}?id=${encodedId}"
                        class="product-card-link"
                        aria-label="View ${name}"
                    >
                        <div class="product-card-image">
                            <span class="product-category">${category}</span>
                            <img
                                src="${image}"
                                alt="${name}"
                                loading="lazy"
                                decoding="async"
                                data-product-image="true"
                                width="600"
                                height="600"
                            >
                        </div>
                        <div class="product-card-body">
                            <div
                                class="product-rating"
                                aria-label="${escapeHTML(ratingLabel)}"
                            >
                                <span class="product-stars" aria-hidden="true">${stars}</span>
                                ${
                                    ratingText
                                        ? `<span class="product-rating-number">${escapeHTML(ratingText)}</span>`
                                        : ""
                                }
                            </div>
                            <h3 class="product-title">${name}</h3>
                            <p class="product-description">${description}</p>
                            <div class="product-bottom">
                                <span class="product-price">${escapeHTML(price)}</span>
                                <span class="product-view-button">View Product →</span>
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
                            <span class="cart-button-icon" aria-hidden="true">+</span>
                            <span class="cart-button-text">Add to Cart</span>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    /* ========================================================================
       LOADING STATE
       ======================================================================== */
    function renderLoading(message = "Loading products...") {
        productList.setAttribute("aria-busy", "true");
        productList.innerHTML = `
            <div class="products-loading" role="status">
                <div class="products-loading-spinner" aria-hidden="true"></div>
                <h2>${escapeHTML(message)}</h2>
                <p>We're preparing the latest products for you.</p>
            </div>
        `;
    }

    /* ========================================================================
       EMPTY STATE
       ======================================================================== */
    function renderEmpty() {
        productList.setAttribute("aria-busy", "false");
        productList.innerHTML = `
            <div class="products-empty" role="status">
                <div class="products-empty-icon" aria-hidden="true">🔎</div>
                <h2>No products found</h2>
                <p>Try another search term or select a different category.</p>
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
                productsHeading.textContent = `Search results for "${currentSearch}"`;
            } else if (activeCategory !== "all") {
                productsHeading.textContent = activeCategory;
            } else {
                productsHeading.textContent = "All Products";
            }
        }
        if (productsCount) {
            const count = filteredProducts.length;
            productsCount.textContent = `${count} ${count === 1 ? "product" : "products"}`;
        }
    }

    /* ========================================================================
       RENDER PRODUCTS
       ======================================================================== */
    function renderProducts() {
        filterProducts();
        updateClearSearchButton();
        if (!filteredProducts.length) {
            renderEmpty();
            updateResultBar();
            return;
        }
        productList.innerHTML = filteredProducts.map(createProductCard).join("");
        productList.setAttribute("aria-busy", "false");
        updateResultBar();
        attachImageFallbacks();
        announce(
            `${filteredProducts.length} ${
                filteredProducts.length === 1 ? "product" : "products"
            } displayed.`
        );
    }

    /* ========================================================================
       IMAGE FALLBACK
       ======================================================================== */
    function attachImageFallbacks() {
        const images = productList.querySelectorAll("img[data-product-image]");
        images.forEach(image => {
            image.addEventListener(
                "error",
                () => {
                    if (image.dataset.fallbackApplied === "true") return;
                    image.dataset.fallbackApplied = "true";
                    image.src = FALLBACK_IMAGE;
                },
                { once: true }
            );
        });
    }

    /* ========================================================================
       CART READ
       ======================================================================== */
    function readCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter(item => item && typeof item === "object")
                .map(item => ({
                    ...item,
                    id: String(item.id ?? ""),
                    quantity: Math.max(
                        1,
                        Math.min(MAX_CART_QUANTITY, Math.floor(Number(item.quantity) || 1))
                    )
                }))
                .filter(item => item.id);
        } catch (error) {
            console.error("[PRASUN SHOP] Cart read error:", error);
            return [];
        }
    }

    /* ========================================================================
       CART SAVE
       ======================================================================== */
    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            window.dispatchEvent(
                new CustomEvent(CART_EVENT_NAME, {
                    detail: { cart: [...cart] }
                })
            );
            updateCartCount(cart);
            return true;
        } catch (error) {
            console.error("[PRASUN SHOP] Cart save error:", error);
            return false;
        }
    }

    /* ========================================================================
       CART COUNT
       ======================================================================== */
    function updateCartCount(suppliedCart = null) {
        if (!cartCount) return;
        const cart = suppliedCart || readCart();
        const total = cart.reduce((sum, item) => {
            const quantity = Math.max(
                1,
                Math.min(MAX_CART_QUANTITY, Math.floor(Number(item?.quantity) || 1))
            );
            return sum + quantity;
        }, 0);

        cartCount.textContent = String(total);
        cartCount.hidden = total <= 0;

        const cartLink = cartCount.closest("a");
        if (cartLink) {
            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }

    /* ========================================================================
       ADD TO CART
       ======================================================================== */
    function addToCart(product) {
        if (!product) return false;
        const cart = readCart();
        const productId = String(product.id);
        const existing = cart.find(item => String(item.id) === productId);

        if (existing) {
            existing.quantity = Math.min(
                MAX_CART_QUANTITY,
                Math.max(1, Number(existing.quantity) || 1) + 1
            );
        } else {
            cart.push({
                id: product.id,
                sku: product.sku || product.id,
                name: product.name,
                price: parsePrice(product.price),
                image: product.image || "",
                images: Array.isArray(product.images) ? [...product.images] : [],
                category: product.category || "",
                description: product.description || "",
                rating: product.rating ?? null,
                features: Array.isArray(product.features) ? [...product.features] : [],
                specifications: normalizeObject(product.specifications),
                variants: Array.isArray(product.variants) ? [...product.variants] : [],
                productId: product.productId || product.cjProductId || product.id,
                cjProductId: product.cjProductId || product.productId || product.id,
                cjSku: product.cjSku || product.sku || "",
                inventory: product.inventory ?? null,
                quantity: 1
            });
        }
        return saveCart(cart);
    }

    /* ========================================================================
       BUTTON FEEDBACK
       ======================================================================== */
    function showAddedFeedback(button) {
        if (!button || button.dataset.busy === "true") return;
        button.dataset.busy = "true";
        const textElement = button.querySelector(".cart-button-text");
        const originalText = textElement ? textElement.textContent : button.textContent;

        if (textElement) {
            textElement.textContent = "Added ✓";
        } else {
            button.textContent = "Added ✓";
        }
        button.classList.add("is-added");
        button.disabled = true;

        window.setTimeout(() => {
            if (textElement) {
                textElement.textContent = originalText;
            } else {
                button.textContent = originalText;
            }
            button.classList.remove("is-added");
            button.disabled = false;
            button.dataset.busy = "false";
        }, 1100);
    }

    /* ========================================================================
       PRODUCT LIST EVENTS
       ======================================================================== */
    productList.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;

        if (action === "reset-filters") {
            if (activeSearchController) {
                activeSearchController.abort();
                activeSearchController = null;
            }
            searchRequestSequence++;
            currentSearch = "";
            activeCategory = "all";
            if (searchInput) {
                searchInput.value = "";
            }
            allProducts = masterCatalog;
            buildCategories();
            setActiveCategory("all");
            renderProducts();
            announce("Search and category filters cleared.");
            return;
        }

        if (action !== "add-to-cart") return;
        event.preventDefault();
        event.stopPropagation();

        const productId = String(button.dataset.productId || "");
        const product = allProducts.find(item => String(item.id) === productId);

        if (!product) {
            console.error("[PRASUN SHOP] Product not found:", productId);
            return;
        }

        if (addToCart(product)) {
            showAddedFeedback(button);
            announce(`${product.name} added to cart.`);
        }
    });

    /* ========================================================================
       SEARCH REQUEST
       ======================================================================== */
    async function performSearch(keyword) {
        const trimmed = String(keyword || "").trim();

        if (activeSearchController) {
            activeSearchController.abort();
        }

        const requestId = ++searchRequestSequence;
        currentSearch = trimmed;

        if (trimmed.length < MIN_SEARCH_LENGTH) {
            allProducts = masterCatalog;
            renderProducts();
            return;
        }

        renderProducts();

        const controller = new AbortController();
        activeSearchController = controller;

        try {
            const apiProducts = await loadProductsFromAPI(trimmed, controller.signal);

            if (requestId !== searchRequestSequence || controller.signal.aborted) {
                return;
            }

            const localMatches = masterCatalog.filter(product =>
                matchesSearch(product, trimmed)
            );
            allProducts = mergeProducts(localMatches, apiProducts);
            buildCategories();
            renderProducts();
            announce(`${filteredProducts.length} search results found for ${trimmed}.`);
        } catch (error) {
            if (error?.name === "AbortError") return;
            if (requestId !== searchRequestSequence) return;

            console.warn(
                "[PRASUN SHOP] Live search unavailable. Local search remains active.",
                error
            );
            allProducts = masterCatalog;
            buildCategories();
            renderProducts();
            announce("Live search is temporarily unavailable. Showing local results.");
        } finally {
            if (requestId === searchRequestSequence) {
                activeSearchController = null;
            }
        }
    }

    /* ========================================================================
       MATCH SEARCH
       ======================================================================== */
    function matchesSearch(product, search) {
        const normalizedSearch = String(search || "").trim().toLowerCase();
        if (!normalizedSearch) {
            return true;
        }
        const specifications = product.specifications || {};
        const searchableText = [
            product.name,
            product.category,
            product.sku,
            product.cjSku,
            product.productId,
            product.cjProductId,
            product.description,
            ...(product.features || []),
            ...Object.keys(specifications),
            ...Object.values(specifications)
        ]
            .filter(value => value !== null && value !== undefined)
            .join(" ")
            .toLowerCase();

        return searchableText.includes(normalizedSearch);
    }

    /* ========================================================================
       SEARCH INPUT EVENTS
       ======================================================================== */
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            window.clearTimeout(searchTimer);
            updateClearSearchButton();
            currentSearch = searchInput.value.trim();

            renderProducts();

            if (currentSearch.length === 0) {
                searchRequestSequence++;
                if (activeSearchController) {
                    activeSearchController.abort();
                    activeSearchController = null;
                }
                allProducts = masterCatalog;
                buildCategories();
                renderProducts();
                return;
            }

            if (currentSearch.length < MIN_SEARCH_LENGTH) {
                return;
            }

            searchTimer = window.setTimeout(() => {
                performSearch(currentSearch);
            }, SEARCH_DELAY);
        });

        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                window.clearTimeout(searchTimer);
                performSearch(searchInput.value);
            }
        });
    }

    /* ========================================================================
       CLEAR SEARCH
       ======================================================================== */
    if (clearSearchButton && searchInput) {
        clearSearchButton.addEventListener("click", () => {
            window.clearTimeout(searchTimer);
            searchRequestSequence++;
            if (activeSearchController) {
                activeSearchController.abort();
                activeSearchController = null;
            }
            searchInput.value = "";
            currentSearch = "";
            allProducts = masterCatalog;
            buildCategories();
            setActiveCategory("all");
            renderProducts();
            searchInput.focus();
            announce("Search cleared.");
        });
    }

    /* ========================================================================
       SORT EVENTS
       ======================================================================== */
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value || "featured";
            renderProducts();
            announce(
                `Products sorted by ${
                    sortSelect.options[sortSelect.selectedIndex]?.text || "Featured"
                }.`
            );
        });
    }

    /* ========================================================================
       CATEGORY EVENTS
       ======================================================================== */
    if (categoriesContainer) {
        categoriesContainer.addEventListener("click", event => {
            const button = event.target.closest(".category-pill");
            if (!button) return;
            activeCategory = button.dataset.category || "all";
            setActiveCategory(activeCategory);
            renderProducts();
            announce(`Category ${activeCategory} selected.`);
        });
    }

    /* ========================================================================
       CART SYNCHRONIZATION
       ======================================================================== */
    window.addEventListener("storage", event => {
        if (event.key === CART_KEY) {
            updateCartCount();
        }
    });

    window.addEventListener(CART_EVENT_NAME, event => {
        if (event.detail && Array.isArray(event.detail.cart)) {
            updateCartCount(event.detail.cart);
        }
    });

    /* ========================================================================
       INITIAL CATALOG LOADING
       ======================================================================== */
    async function initializeProducts() {
        masterCatalog = getLocalProducts();
        allProducts = masterCatalog;
        buildCategories();
        setActiveCategory("all");
        renderProducts();

        const requestId = ++catalogRequestSequence;
        try {
            const apiProducts = await loadProductsFromAPI();
            if (requestId !== catalogRequestSequence) return;

            if (apiProducts.length) {
                masterCatalog = mergeProducts(getLocalProducts(), apiProducts);
                allProducts = masterCatalog;
                buildCategories();
                setActiveCategory(activeCategory);
                renderProducts();
                announce(`${allProducts.length} products loaded.`);
            }
        } catch (error) {
            console.warn(
                "[PRASUN SHOP] API unavailable. Local catalog remains active.",
                error
            );
            masterCatalog = getLocalProducts();
            allProducts = masterCatalog;
            buildCategories();
            setActiveCategory(activeCategory);
            renderProducts();
            announce("Products loaded from the local catalog.");
        }
    }

    /* ========================================================================
       INITIAL STATE
       ======================================================================== */
    updateCartCount();
    updateClearSearchButton();

    masterCatalog = getLocalProducts();
    allProducts = masterCatalog;
    buildCategories();
    setActiveCategory("all");
    renderLoading();
    initializeProducts();
})();
