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
       UI RENDERERS
       ======================================================================== */
    function renderLoading(message = "Loading catalog...") {
        productList.innerHTML = `
            <div class="product-status-card" role="status">
                <div class="spinner" aria-hidden="true"></div>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        announce(message);
    }

    function renderError(message, retryCallback = null) {
        productList.innerHTML = `
            <div class="product-status-card error" role="alert">
                <p>${escapeHTML(message)}</p>
                ${retryCallback ? '<button type="button" class="btn btn-secondary" id="retry-btn">Try Again</button>' : ''}
            </div>
        `;
        if (retryCallback) {
            document.getElementById("retry-btn")?.addEventListener("click", retryCallback);
        }
        announce(message);
    }

    function renderEmpty(message = "No products found matching your criteria.") {
        productList.innerHTML = `
            <div class="product-status-card empty">
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        announce(message);
    }

    function renderRating(rating) {
        if (rating === null || rating === undefined || !Number.isFinite(rating)) {
            return '<span class="rating-badge rating-none">No reviews</span>';
        }
        const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
        return `<span class="rating-badge" aria-label="Rating ${rating.toFixed(1)} out of 5 stars">${stars} (${rating.toFixed(1)})</span>`;
    }

    function renderProductCard(product) {
        const detailUrl = `${PRODUCT_DETAIL_PAGE}?id=${encodeURIComponent(product.id || product.sku)}`;
        const imageSrc = escapeHTML(product.image || FALLBACK_IMAGE);

        return `
            <article class="product-card" data-id="${escapeHTML(product.id)}" data-sku="${escapeHTML(product.sku)}">
                <a href="${detailUrl}" class="product-card-image-link" tabindex="-1" aria-hidden="true">
                    <img
                        src="${imageSrc}"
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
                        class="product-image"
                    />
                </a>
                <div class="product-card-body">
                    <div class="product-meta">
                        <span class="product-category">${escapeHTML(product.category)}</span>
                        ${renderRating(product.rating)}
                    </div>
                    <h3 class="product-title">
                        <a href="${detailUrl}">${escapeHTML(product.name)}</a>
                    </h3>
                    <p class="product-description">${escapeHTML(product.description)}</p>
                    <div class="product-card-footer">
                        <span class="product-price">${formatPrice(product.price)}</span>
                        <button
                            type="button"
                            class="btn btn-primary add-to-cart-btn"
                            data-id="${escapeHTML(product.id)}"
                            aria-label="Add ${escapeHTML(product.name)} to cart"
                        >
                            Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function updateProductHeadingAndCount() {
        if (productsCount) {
            productsCount.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`;
        }
        if (productsHeading) {
            if (currentSearch.trim()) {
                productsHeading.textContent = `Search Results for "${currentSearch.trim()}"`;
            } else if (activeCategory !== "all") {
                productsHeading.textContent = activeCategory;
            } else {
                productsHeading.textContent = "All Products";
            }
        }
    }

    function renderProducts() {
        filterProducts();
        updateProductHeadingAndCount();

        if (!filteredProducts.length) {
            renderEmpty();
            return;
        }

        productList.innerHTML = filteredProducts.map(renderProductCard).join("");
        announce(`Showing ${filteredProducts.length} products`);
    }

    /* ========================================================================
       SHOPPING CART ENGINE
       ======================================================================== */
    function getCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            window.dispatchEvent(new CustomEvent(CART_EVENT_NAME, { detail: cart }));
        } catch (e) {
            console.error("[PRASUN SHOP] Failed to save cart to localStorage", e);
        }
    }

    function updateCartBadge() {
        if (!cartCount) return;
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        cartCount.textContent = String(totalItems);
        cartCount.hidden = totalItems === 0;
    }

    function addToCart(productId) {
        const product = allProducts.find(p => p.id === productId || p.sku === productId) ||
                        masterCatalog.find(p => p.id === productId || p.sku === productId);

        if (!product) return;

        const cart = getCart();
        const existingIndex = cart.findIndex(item => item.id === product.id || item.sku === product.sku);

        if (existingIndex > -1) {
            const currentQty = cart[existingIndex].quantity || 1;
            cart[existingIndex].quantity = Math.min(MAX_CART_QUANTITY, currentQty + 1);
        } else {
            cart.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }

        saveCart(cart);
        updateCartBadge();
        announce(`Added ${product.name} to your cart.`);
    }

    /* ========================================================================
       SEARCH ENGINE (DEBOUNCED & RACE-PROTECTED)
       ======================================================================== */
    async function handleSearchExecution(query) {
        const trimmed = query.trim();
        searchRequestSequence++;
        const currentSeq = searchRequestSequence;

        if (activeSearchController) {
            activeSearchController.abort();
            activeSearchController = null;
        }

        if (trimmed.length >= MIN_SEARCH_LENGTH) {
            renderLoading(`Searching for "${trimmed}"...`);
            activeSearchController = new AbortController();

            try {
                const apiResults = await loadProductsFromAPI(trimmed, activeSearchController.signal);
                if (currentSeq !== searchRequestSequence) return; // Race condition check

                allProducts = mergeProducts(masterCatalog, apiResults);
                buildCategories();
                renderProducts();
            } catch (err) {
                if (err.name === "AbortError") return;
                if (currentSeq !== searchRequestSequence) return;

                console.warn("[PRASUN SHOP] Live search failed, falling back to local dataset:", err.message);
                allProducts = [...masterCatalog];
                renderProducts();
            } finally {
                if (currentSeq === searchRequestSequence) {
                    activeSearchController = null;
                }
            }
        } else {
            allProducts = [...masterCatalog];
            renderProducts();
        }
    }

    function onSearchInput(e) {
        currentSearch = e.target.value;
        updateClearSearchButton();

        if (searchTimer) {
            window.clearTimeout(searchTimer);
        }

        searchTimer = window.setTimeout(() => {
            handleSearchExecution(currentSearch);
        }, SEARCH_DELAY);
    }

    /* ========================================================================
       EVENT LISTENERS & BINDINGS
       ======================================================================== */
    function attachEventListeners() {
        searchInput?.addEventListener("input", onSearchInput);

        clearSearchButton?.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                currentSearch = "";
                updateClearSearchButton();
                handleSearchExecution("");
                searchInput.focus();
            }
        });

        sortSelect?.addEventListener("change", e => {
            currentSort = e.target.value;
            renderProducts();
        });

        categoriesContainer?.addEventListener("click", e => {
            const button = e.target.closest(".category-pill");
            if (!button) return;
            const category = button.dataset.category;
            setActiveCategory(category);
            renderProducts();
        });

        productList.addEventListener("click", e => {
            const btn = e.target.closest(".add-to-cart-btn");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) {
                addToCart(id);
            }
        });

        window.addEventListener(CART_EVENT_NAME, updateCartBadge);
        window.addEventListener("storage", e => {
            if (e.key === CART_KEY) updateCartBadge();
        });
    }

    /* ========================================================================
       INITIALIZATION
       ======================================================================== */
    async function initCatalog() {
        catalogRequestSequence++;
        const currentSeq = catalogRequestSequence;
        renderLoading("Fetching products...");

        try {
            const remoteProducts = await loadProductsFromAPI();
            if (currentSeq !== catalogRequestSequence) return;

            masterCatalog = mergeProducts(getLocalProducts(), remoteProducts);
            allProducts = [...masterCatalog];
        } catch (err) {
            if (currentSeq !== catalogRequestSequence) return;
            console.warn("[PRASUN SHOP] Remote API unavailable. Utilizing local fallback catalog.", err.message);

            masterCatalog = getLocalProducts();
            allProducts = [...masterCatalog];
        }

        buildCategories();
        renderProducts();
        updateCartBadge();
        updateClearSearchButton();
    }

    function init() {
        attachEventListeners();
        initCatalog();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
