/**
 * ============================================================================
 * PRASUN SHOP — MAIN STOREFRONT CONTROLLER (script.js)
 * ============================================================================
 *
 * Handles live catalog loading, UI rendering, real-time debounced search,
 * dynamic category filtering, sorting, and seamless integration with
 * PrasunShopCart (cart.js).
 *
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIGURATION & STATE
       ========================================================================= */

    const API_ENDPOINT = "https://prasun-shop-api.prasun301.workers.dev/api/products";
    const PRODUCT_DETAIL_PAGE = "/product.html";
    const API_TIMEOUT = 12000;
    const SEARCH_DELAY = 400;

    // Hardcoded local catalog is left empty to prevent stale CJ products from force-displaying.
    const LOCAL_CATALOG = [];

    const CURRENCY_RATES = {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79
    };

    let masterCatalog = [];
    let allProducts = [];
    let filteredProducts = [];
    let activeCategory = "all";
    let currentSearch = "";
    let currentSort = "featured";
    let searchTimer = null;
    let activeSearchController = null;
    let searchRequestSequence = 0;
    let catalogRequestSequence = 0;

    /* =========================================================================
       DOM ELEMENTS
       ========================================================================= */

    const productList = document.getElementById("product-list");
    if (!productList) return;

    const searchInput = document.getElementById("product-search");
    const sortSelect = document.getElementById("product-sort");
    const categoriesContainer = document.getElementById("products-categories");
    const productsHeading = document.getElementById("products-heading") || document.getElementById("page-heading");
    const productsCount = document.getElementById("results-count");
    const clearSearchButton = document.getElementById("clear-search");
    const ariaLiveRegion = document.getElementById("aria-live-region");
    const cartCountBadge = document.getElementById("cart-count") || document.getElementById("cart-badge");
    const shipToSelect = document.getElementById("global-ship-to");
    const currencySelect = document.getElementById("global-currency");

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
                <rect width="800" height="800" fill="#f8fafc"/>
                <path d="M220 540 L330 420 L420 500 L500 430 L580 540 Z" fill="#e2e8f0"/>
                <circle cx="330" cy="300" r="55" fill="#cbd5e1"/>
                <text x="400" y="635" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="28">
                    Image Unavailable
                </text>
            </svg>
        `);

    /* =========================================================================
       UTILITIES & FORMATTERS
       ========================================================================= */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/[&<>"']/g, char => ESCAPE_MAP[char]);
    }

    function cleanText(val, fallback = "") {
        if (val === null || val === undefined) return fallback;
        const text = String(val).trim();
        return text || fallback;
    }

    function parsePrice(val) {
        if (typeof val === "number" && Number.isFinite(val)) return Math.max(0, val);
        const parsed = parseFloat(String(val ?? "").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    function formatPrice(amount) {
        const rawPrice = parsePrice(amount);
        const curr = currencySelect?.value || "USD";
        const rate = CURRENCY_RATES[curr] || 1.0;
        const converted = rawPrice * rate;

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: curr,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(converted);
        } catch (e) {
            return `$${converted.toFixed(2)}`;
        }
    }

    function normalizeImageURL(url) {
        if (!url) return "";
        let img = String(url).trim();
        if (!img) return "";
        if (img.startsWith("//")) return "https:" + img;
        if (/^https?:\/\//i.test(img) || img.startsWith("data:") || img.startsWith("/") || img.startsWith("./")) {
            return img;
        }
        return "https://" + img.replace(/^\/+/, "");
    }

    function extractImages(item) {
        const candidates = [];
        function add(val) {
            if (Array.isArray(val)) { val.forEach(add); return; }
            if (val && typeof val === "object") {
                add(val.url); add(val.imageUrl); add(val.image); return;
            }
            const norm = normalizeImageURL(val);
            if (norm) candidates.push(norm);
        }
        if (!item) return [];
        add(item.image); add(item.bigImage); add(item.imageUrl);
        add(item.productImage); add(item.thumbnail); add(item.images);
        return [...new Set(candidates)];
    }

    /* =========================================================================
       DATA NORMALIZATION
       ========================================================================= */

    function normalizeProduct(raw, index = 0) {
        if (!raw || typeof raw !== "object") return null;

        const id = cleanText(raw.id || raw.pid || raw.productId || raw.productID, `prod-${index + 1}`);
        const cjProductId = cleanText(raw.cjProductId || raw.cjPid || raw.pid || raw.productId, "");
        const sku = cleanText(raw.sku || raw.cjSku || raw.productSku, "");
        const name = cleanText(raw.name || raw.productName || raw.title || raw.productNameEn, "Unnamed Product");
        const category = cleanText(raw.category || raw.categoryName, "General");

        const priceCandidates = [
            raw.discountPrice, raw.nowPrice, raw.sellPrice,
            raw.price, raw.startSellPrice, raw.salePrice, raw.productPrice
        ];

        let price = 0;
        for (const cand of priceCandidates) {
            const parsed = parsePrice(cand);
            if (parsed > 0) { price = parsed; break; }
        }

        const images = extractImages(raw);
        const image = images[0] || "";

        return {
            id,
            cjProductId,
            sku,
            name,
            category,
            price,
            rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
            image,
            images,
            description: cleanText(raw.description || raw.productDescription, "High quality product."),
            raw
        };
    }

    function extractProductsFromAPI(data) {
        if (Array.isArray(data)) return data.map(normalizeProduct).filter(Boolean);
        if (!data || typeof data !== "object") return [];

        const keys = [data.products, data.items, data.list, data.results, data.data?.products, data.data?.items, data.data];
        for (const key of keys) {
            if (Array.isArray(key)) return key.map(normalizeProduct).filter(Boolean);
        }
        return [];
    }

    /* =========================================================================
       API FETCHING
       ========================================================================= */

    async function fetchJSON(url, timeout = API_TIMEOUT) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(url, {
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function loadProductsFromAPI(keyword = "") {
        const params = new URLSearchParams();
        if (keyword.trim()) params.set("keyword", keyword.trim());
        if (shipToSelect?.value) params.set("country", shipToSelect.value);
        if (currencySelect?.value) params.set("currency", currencySelect.value);

        const query = params.toString();
        const url = query ? `${API_ENDPOINT}?${query}` : API_ENDPOINT;

        const data = await fetchJSON(url);
        return extractProductsFromAPI(data);
    }

    /* =========================================================================
       FILTER, SORT & RENDER
       ========================================================================= */

    function announce(msg) {
        if (ariaLiveRegion) {
            ariaLiveRegion.textContent = "";
            setTimeout(() => { ariaLiveRegion.textContent = msg; }, 20);
        }
    }

    function updateClearSearchButton() {
        if (clearSearchButton && searchInput) {
            clearSearchButton.hidden = !searchInput.value.trim();
        }
    }

    function filterProducts() {
        const term = currentSearch.trim().toLowerCase();

        filteredProducts = allProducts.filter(p => {
            if (activeCategory !== "all") {
                if (p.category.toLowerCase() !== activeCategory.toLowerCase()) return false;
            }
            if (!term) return true;

            const searchStr = `${p.name} ${p.category} ${p.sku} ${p.description}`.toLowerCase();
            return searchStr.includes(term);
        });

        applySort();
    }

    function applySort() {
        switch (currentSort) {
            case "price-low":
                filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case "price-high":
                filteredProducts.sort((a, b) => b.price - a.price);
                break;
            case "rating":
                filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case "name-az":
                filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }
    }

    function buildCategories() {
        if (!categoriesContainer) return;

        const categorySet = new Set();
        allProducts.forEach(p => {
            if (p.category) categorySet.add(p.category);
        });

        const categories = Array.from(categorySet).sort();

        categoriesContainer.innerHTML = `
            <button type="button" class="category-pill active" data-category="all" aria-pressed="true">
                All
            </button>
            ${categories.map(cat => `
                <button type="button" class="category-pill" data-category="${escapeHTML(cat)}" aria-pressed="false">
                    ${escapeHTML(cat)}
                </button>
            `).join("")}
        `;
    }

    function setActiveCategory(cat) {
        activeCategory = String(cat || "all");
        if (!categoriesContainer) return;

        categoriesContainer.querySelectorAll(".category-pill").forEach(btn => {
            const isActive = btn.dataset.category.toLowerCase() === activeCategory.toLowerCase();
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function renderLoading(message = "Loading products...") {
        productList.innerHTML = `
            <div class="product-status-card" role="status">
                <div class="spinner" aria-hidden="true"></div>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        announce(message);
    }

    function renderEmpty(message = "No products found matching your criteria.") {
        productList.innerHTML = `
            <div class="product-status-card empty">
                <div class="status-icon" aria-hidden="true">🔎</div>
                <h3>No products found</h3>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        announce(message);
    }

    function renderRating(rating) {
        if (rating === null || !Number.isFinite(rating)) {
            return `<span class="rating-badge rating-none">No reviews</span>`;
        }
        const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
        return `<span class="rating-badge">${stars} (${rating.toFixed(1)})</span>`;
    }

    function renderProductCard(p) {
        const detailUrl = `${PRODUCT_DETAIL_PAGE}?id=${encodeURIComponent(p.id)}`;
        const imageSrc = escapeHTML(p.image || FALLBACK_IMAGE);

        return `
            <article class="product-card" data-id="${escapeHTML(p.id)}">
                <a href="${detailUrl}" class="product-card-image-link" aria-label="${escapeHTML(p.name)}">
                    <img src="${imageSrc}" alt="${escapeHTML(p.name)}" loading="lazy" class="product-image" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
                </a>
                <div class="product-card-body">
                    <div class="product-meta">
                        <span class="product-category">${escapeHTML(p.category)}</span>
                        ${renderRating(p.rating)}
                    </div>
                    <h3 class="product-title">
                        <a href="${detailUrl}">${escapeHTML(p.name)}</a>
                    </h3>
                    <p class="product-description">${escapeHTML(p.description)}</p>
                    <div class="product-card-footer">
                        <span class="product-price">${formatPrice(p.price)}</span>
                        <button type="button" class="btn-add-to-cart" data-id="${escapeHTML(p.id)}">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function updateHeadingAndCount() {
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
        updateHeadingAndCount();

        if (!filteredProducts.length) {
            renderEmpty();
            return;
        }

        productList.innerHTML = filteredProducts.map(renderProductCard).join("");
        announce(`Showing ${filteredProducts.length} products`);
    }

    /* =========================================================================
       CART INTEGRATION WITH cart.js (PrasunShopCart)
       ========================================================================= */

    function updateCartBadge() {
        if (window.PrasunShopCart?.updateCartBadge) {
            window.PrasunShopCart.updateCartBadge();
        } else if (cartCountBadge) {
            const cart = JSON.parse(localStorage.getItem("prasun_cart") || "[]");
            const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
            cartCountBadge.textContent = String(count);
            cartCountBadge.hidden = count <= 0;
        }
    }

    function handleAddToCart(productId) {
        const product = masterCatalog.find(p => String(p.id) === String(productId));
        if (!product) return;

        if (window.PrasunShopCart?.addToCart) {
            window.PrasunShopCart.addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category,
                sku: product.sku,
                cjProductId: product.cjProductId
            }, 1);
        }

        announce(`${product.name} added to cart.`);

        const btn = productList.querySelector(`.btn-add-to-cart[data-id="${CSS.escape(String(product.id))}"]`);
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✓ Added";
            btn.classList.add("added");
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove("added");
            }, 1200);
        }
    }

    /* =========================================================================
       SEARCH EXECUTION
       ========================================================================= */

    async function handleSearchExecution(query) {
        const trimmed = query.trim();
        searchRequestSequence++;
        const seq = searchRequestSequence;

        if (activeSearchController) {
            activeSearchController.abort();
            activeSearchController = null;
        }

        if (trimmed.length >= 2) {
            renderLoading(`Searching for "${trimmed}"...`);
            try {
                const results = await loadProductsFromAPI(trimmed);
                if (seq !== searchRequestSequence) return;

                allProducts = results;
                buildCategories();
                renderProducts();
            } catch (e) {
                if (e.name === "AbortError") return;
                renderEmpty("Unable to complete search. Please try again.");
            }
        } else {
            allProducts = [...masterCatalog];
            buildCategories();
            renderProducts();
        }
    }

    /* =========================================================================
       INITIALIZATION & EVENTS
       ========================================================================= */

    async function initCatalog() {
        catalogRequestSequence++;
        const seq = catalogRequestSequence;

        renderLoading("Fetching catalog...");

        try {
            const remoteProducts = await loadProductsFromAPI();
            if (seq !== catalogRequestSequence) return;

            if (remoteProducts.length) {
                // Completely overwrite master catalog with live API data
                masterCatalog = remoteProducts;
                allProducts = [...masterCatalog];
                buildCategories();
                renderProducts();
            } else {
                masterCatalog = [];
                allProducts = [];
                renderEmpty("No products available at this time.");
            }
        } catch (error) {
            console.error("[PRASUN SHOP] Failed to load remote products:", error);
            masterCatalog = [];
            allProducts = [];
            renderEmpty("Unable to load store catalog. Please refresh the page.");
        }

        updateCartBadge();
        updateClearSearchButton();
    }

    function attachEventListeners() {
        searchInput?.addEventListener("input", e => {
            currentSearch = e.target.value;
            updateClearSearchButton();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => handleSearchExecution(currentSearch), SEARCH_DELAY);
        });

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
            const btn = e.target.closest(".category-pill");
            if (!btn) return;
            setActiveCategory(btn.dataset.category);
            renderProducts();
        });

        productList.addEventListener("click", e => {
            const btn = e.target.closest(".btn-add-to-cart");
            if (!btn) return;
            e.preventDefault();
            handleAddToCart(btn.dataset.id);
        });

        shipToSelect?.addEventListener("change", () => initCatalog());
        currencySelect?.addEventListener("change", () => renderProducts());

        window.addEventListener("prasun:cart-updated", updateCartBadge);
    }

    function init() {
        attachEventListeners();
        initCatalog();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
