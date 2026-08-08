/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (PERFORMANCE & A11Y OPTIMIZED)
 * Production-ready async fetch, tokenized search, filtering, and local image mapping.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIG & CONSTANTS (Strict Local Image Overrides)
       ========================================================================= */

    const PRODUCT_IMAGE_OVERRIDES = {
        "smart-lamp": "images/products/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",
        "power-bank": "images/products/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",
        "earbuds": "images/products/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg"
    };

    const CONFIG = {
        STORAGE_KEYS: ["products", "prasun_products"],
        CART_KEY: "prasun_cart",
        CACHE_TTL_MS: 1000 * 60 * 30, // 30 minutes cache validity
        API_ENDPOINT: "/api/products.json",
        FETCH_TIMEOUT_MS: 8000,
        DEBOUNCE_MS: 150,
        ITEMS_PER_PAGE: 24,
        FALLBACK_IMAGE: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                <rect width="800" height="600" fill="#f4f4f5"/>
                <text x="400" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="system-ui, sans-serif" font-size="24">
                    Image unavailable
                </text>
            </svg>
        `)}`
    };

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    /* =========================================================================
       STATE & DOM CACHE
       ========================================================================= */

    const state = {
        allProducts: [],
        filteredProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        currentPage: 1,
        searchTimer: null,
        renderFrame: null,
        fetchAbortController: null
    };

    const DOM = {
        productList: null,
        searchInput: null,
        searchClearBtn: null,
        sortSelect: null,
        resultsCount: null,
        heading: null,
        liveRegion: null,
        cartBadge: null,
        categoryPills: []
    };

    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

    function escapeHTML(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function formatPrice(value) {
        const price = Number(value);
        return Number.isFinite(price) ? currencyFormatter.format(price) : "$0.00";
    }

    /* =========================================================================
       GLOBAL CART BADGE MANAGEMENT
       ========================================================================= */

    function updateCartBadge() {
        if (!DOM.cartBadge) return;

        try {
            const rawCart = localStorage.getItem(CONFIG.CART_KEY);
            const cart = rawCart ? JSON.parse(rawCart) : [];
            const totalCount = Array.isArray(cart) 
                ? cart.reduce((acc, item) => acc + Number(item.quantity || 1), 0)
                : 3;

            DOM.cartBadge.textContent = String(totalCount);
            DOM.cartBadge.hidden = totalCount === 0;
        } catch (e) {
            console.warn("[Prasun Shop] Failed to update cart badge count:", e);
        }
    }

    function addToCart(productId) {
        const product = state.allProducts.find(p => p.id === productId);
        if (!product) return;

        try {
            const rawCart = localStorage.getItem(CONFIG.CART_KEY);
            const cart = rawCart ? JSON.parse(rawCart) : [];
            const existingIndex = cart.findIndex(item => item.id === productId);

            if (existingIndex > -1) {
                cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
            } else {
                cart.push({ ...product, quantity: 1 });
            }

            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
            updateCartBadge();

            if (DOM.liveRegion) {
                DOM.liveRegion.textContent = `${product.name} added to cart.`;
            }
        } catch (e) {
            console.error("[Prasun Shop] Failed to add item to cart:", e);
        }
    }

    /* =========================================================================
       PRODUCT NORMALIZATION & IMAGE RESOLUTION
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") return null;

        const id = String(item.id ?? item.productId ?? `product-${index + 1}`).trim();
        const name = String(item.name ?? item.title ?? "Unnamed Product").trim();
        const price = Number(item.price ?? 0);
        const rating = Number(item.rating ?? 0);
        const category = String(item.category ?? "").trim();
        const description = String(item.description ?? "").trim();

        // Enforce strict mapping to your exact local images if ID matches, else fallback to properties or placeholder
        let rawImage = PRODUCT_IMAGE_OVERRIDES[id] || String(
            item.image ?? 
            item.imageUrl ?? 
            item.thumbnail ?? 
            item.img ?? 
            item.photo ?? 
            item.url ?? 
            ""
        ).trim();

        if (!rawImage) {
            rawImage = CONFIG.FALLBACK_IMAGE;
        }

        const normalizedCategory = normalize(category);
        const searchIndex = `${normalize(name)} ${normalize(description)} ${normalizedCategory}`;

        return {
            id,
            name: name || "Unnamed Product",
            price: Number.isFinite(price) ? price : 0,
            image: rawImage,
            category,
            description,
            rating: Number.isFinite(rating) ? rating : 0,
            _normalizedCategory: normalizedCategory,
            _searchIndex: searchIndex
        };
    }

    function getFallbackStaticProducts() {
        return [
            {
                id: "smart-lamp",
                name: "G-Shaped Smart LED Atmosphere Lamp",
                price: 29.99,
                image: "images/products/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",
                category: "Smart Lighting",
                description: "Includes built-in Bluetooth speaker and fast wireless charger pad.",
                rating: 4.8,
                _normalizedCategory: "smart lighting",
                _searchIndex: "g-shaped smart led atmosphere lamp includes built-in bluetooth speaker and fast wireless charger pad. smart lighting"
            },
            {
                id: "power-bank",
                name: "Mini 5000mAh Magnetic Wireless Power Bank",
                price: 39.99,
                image: "images/products/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",
                category: "Power & Charging",
                description: "Compact fast-charging portable battery pack for mobile devices.",
                rating: 4.7,
                _normalizedCategory: "power & charging",
                _searchIndex: "mini 5000mah magnetic wireless power bank compact fast-charging portable battery pack for mobile devices. power & charging"
            },
            {
                id: "earbuds",
                name: "Wireless Noise-Cancelling Sports Earbuds",
                price: 49.99,
                image: "images/products/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",
                category: "Audio",
                description: "High-fidelity Bluetooth audio with ergonomic sweat-resistant fit.",
                rating: 4.9,
                _normalizedCategory: "audio",
                _searchIndex: "wireless noise-cancelling sports earbuds high-fidelity bluetooth audio with ergonomic sweat-resistant fit. audio"
            }
        ];
    }

    /* =========================================================================
       DATA FETCHING & STORAGE
       ========================================================================= */

    function getCachedProducts() {
        for (const key of CONFIG.STORAGE_KEYS) {
            try {
                const stored = localStorage.getItem(key);
                if (!stored) continue;

                const parsed = JSON.parse(stored);
                if (parsed?.timestamp && (Date.now() - parsed.timestamp > CONFIG.CACHE_TTL_MS)) {
                    localStorage.removeItem(key);
                    continue;
                }

                const data = Array.isArray(parsed) ? parsed : parsed.data;
                if (Array.isArray(data) && data.length > 0) {
                    return data.map(normalizeProduct).filter(Boolean);
                }
            } catch (e) {
                console.warn("[Prasun Shop] LocalStorage parse warning:", e);
            }
        }
        return null;
    }

    async function fetchProductsFromAPI() {
        if (state.fetchAbortController) {
            state.fetchAbortController.abort();
        }
        state.fetchAbortController = new AbortController();

        const timeoutId = setTimeout(() => state.fetchAbortController.abort(), CONFIG.FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(CONFIG.API_ENDPOINT, {
                signal: state.fetchAbortController.signal,
                headers: { "Accept": "application/json" }
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const json = await response.json();
            const normalized = Array.isArray(json) ? json.map(normalizeProduct).filter(Boolean) : [];

            if (normalized.length > 0) {
                try {
                    localStorage.setItem(CONFIG.STORAGE_KEYS[0], JSON.stringify({
                        timestamp: Date.now(),
                        data: json
                    }));
                } catch (e) {
                    /* Quota exceeded safeguard */
                }
            }

            return normalized;
        } catch (error) {
            if (error.name !== "AbortError") {
                console.warn("[Prasun Shop] API fetch unavailable, falling back to static products.");
            }
            return getFallbackStaticProducts();
        }
    }

    async function loadProducts() {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "true");

        const cached = getCachedProducts();
        if (cached && cached.length > 0) {
            state.allProducts = cached;
            readStateFromURL();
            applyFilters();
            DOM.productList.setAttribute("aria-busy", "false");
            return;
        }

        try {
            state.allProducts = await fetchProductsFromAPI();
            if (!state.allProducts.length) {
                state.allProducts = getFallbackStaticProducts();
            }
            readStateFromURL();
            applyFilters();
        } catch {
            state.allProducts = getFallbackStaticProducts();
            readStateFromURL();
            applyFilters();
        } finally {
            DOM.productList.setAttribute("aria-busy", "false");
        }
    }

    /* =========================================================================
       URL & STATE MANAGEMENT
       ========================================================================= */

    function readStateFromURL() {
        const params = new URLSearchParams(window.location.search);

        state.currentCategory = params.get("category")?.trim() || "";
        state.currentKeyword = params.get("q")?.trim() || "";
        state.currentSort = params.get("sort")?.trim() || "featured";

        if (DOM.searchInput) {
            DOM.searchInput.value = state.currentKeyword;
            toggleClearButtonVisibility(Boolean(state.currentKeyword));
        }

        if (DOM.sortSelect) {
            DOM.sortSelect.value = state.currentSort;
        }

        updateCategoryNavigation();
        updatePageHeading();
    }

    function syncStateToURL() {
        const url = new URL(window.location.href);

        if (state.currentCategory) url.searchParams.set("category", state.currentCategory);
        else url.searchParams.delete("category");

        if (state.currentKeyword) url.searchParams.set("q", state.currentKeyword);
        else url.searchParams.delete("q");

        if (state.currentSort && state.currentSort !== "featured") {
            url.searchParams.set("sort", state.currentSort);
        } else {
            url.searchParams.delete("sort");
        }

        window.history.pushState({}, "", url);
    }

    function updateCategoryNavigation() {
        if (!DOM.categoryPills.length) return;

        const selected = normalize(state.currentCategory);

        DOM.categoryPills.forEach(pill => {
            const pillCat = normalize(pill.dataset.category || "");
            const active = (selected === "" && pillCat === "all") || (selected !== "" && pillCat === selected);

            pill.classList.toggle("active", active);
            pill.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    function updatePageHeading() {
        if (DOM.heading) {
            DOM.heading.textContent = state.currentCategory || "Find Products Instantly";
        }
    }

    /* =========================================================================
       FILTER & SORT ENGINE
       ========================================================================= */

    function applyFilters() {
        let filtered = state.allProducts;

        if (state.currentCategory) {
            const cat = normalize(state.currentCategory);
            filtered = filtered.filter(p => p._normalizedCategory === cat);
        }

        if (state.currentKeyword) {
            const tokens = normalize(state.currentKeyword).split(/\s+/).filter(Boolean);
            filtered = filtered.filter(p => tokens.every(token => p._searchIndex.includes(token)));
        }

        if (state.currentSort !== "featured") {
            filtered = [...filtered];
            switch (state.currentSort) {
                case "price-low":
                case "price-asc":
                    filtered.sort((a, b) => a.price - b.price);
                    break;
                case "price-high":
                case "price-desc":
                    filtered.sort((a, b) => b.price - a.price);
                    break;
                case "rating":
                    filtered.sort((a, b) => b.rating - a.rating);
                    break;
                case "name":
                case "name-asc":
                    filtered.sort((a, b) => a.name.localeCompare(b.name));
                    break;
            }
        }

        state.filteredProducts = filtered;
        state.currentPage = 1;

        if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
        state.renderFrame = requestAnimationFrame(() => {
            renderProducts(state.filteredProducts);
        });
    }

    /* =========================================================================
       PRODUCT RENDERING & DELEGATION
       ========================================================================= */

    function renderProducts(products) {
        if (!DOM.productList) return;

        updateResultsCount(products.length);

        if (!products.length) {
            renderEmptyState();
            return;
        }

        const paginatedItems = products.slice(0, CONFIG.ITEMS_PER_PAGE);
        const fragment = document.createDocumentFragment();
        const template = document.createElement("template");

        const cardsHTML = paginatedItems.map(renderProductCardHTML).join("");
        template.innerHTML = cardsHTML;
        fragment.appendChild(template.content);

        DOM.productList.replaceChildren(fragment);
    }

    function renderProductCardHTML(product) {
        const safeId = encodeURIComponent(product.id);
        const image = product.image || CONFIG.FALLBACK_IMAGE;

        const categoryHTML = product.category
            ? `<span class="product-category">${escapeHTML(product.category)}</span>`
            : "";

        return `
            <article class="product-card" data-id="${safeId}">
                <div class="product-card-inner">
                    <a class="product-card-link" href="product.html?id=${safeId}" aria-label="View ${escapeHTML(product.name)}">
                        <div class="product-card-image">
                            <img 
                                src="${escapeHTML(image)}" 
                                alt="${escapeHTML(product.name)}" 
                                loading="lazy" 
                                decoding="async"
                                width="600" 
                                height="600" 
                            />
                            ${categoryHTML}
                        </div>
                        <div class="product-card-body">
                            <h2 class="product-title">${escapeHTML(product.name)}</h2>
                            ${product.description ? `<p class="product-description">${escapeHTML(product.description)}</p>` : ""}
                            <div class="product-bottom">
                                <span class="product-price">${formatPrice(product.price)}</span>
                                <span class="product-view-button">View Details</span>
                            </div>
                        </div>
                    </a>
                    <div class="product-card-actions">
                        <button type="button" class="btn-add-to-cart" data-action="add-cart" data-id="${safeId}">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function setupProductListDelegation() {
        if (!DOM.productList) return;

        DOM.productList.addEventListener("error", (event) => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true);

        DOM.productList.addEventListener("click", (event) => {
            const cartBtn = event.target.closest('[data-action="add-cart"]');
            if (cartBtn) {
                event.preventDefault();
                const productId = decodeURIComponent(cartBtn.dataset.id);
                addToCart(productId);
            }
        });
    }

    /* =========================================================================
       CONTROLS & LISTENERS
       ========================================================================= */

    function toggleClearButtonVisibility(show) {
        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.hidden = !show;
            DOM.searchClearBtn.setAttribute("aria-hidden", show ? "false" : "true");
        }
    }

    function updateResultsCount(count) {
        const text = count === 0
            ? "No products found"
            : `${count} ${count === 1 ? "product" : "products"} available`;

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = text;
        }

        if (DOM.liveRegion) {
            DOM.liveRegion.textContent = text;
        }
    }

    function initializeControls() {
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", () => {
                const val = DOM.searchInput.value.trim();
                toggleClearButtonVisibility(Boolean(val));

                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    state.currentKeyword = val;
                    syncStateToURL();
                    applyFilters();
                }, CONFIG.DEBOUNCE_MS);
            });
        }

        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.addEventListener("click", () => {
                if (DOM.searchInput) {
                    DOM.searchInput.value = "";
                    DOM.searchInput.focus();
                }
                toggleClearButtonVisibility(false);
                state.currentKeyword = "";
                syncStateToURL();
                applyFilters();
            });
        }

        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener("change", () => {
                state.currentSort = DOM.sortSelect.value;
                syncStateToURL();
                applyFilters();
            });
        }

        const categoryContainer = $(".products-categories");
        if (categoryContainer) {
            categoryContainer.addEventListener("click", (e) => {
                const button = e.target.closest(".category-pill");
                if (!button) return;

                const cat = button.dataset.category === "all" ? "" : button.dataset.category;
                if (cat !== state.currentCategory) {
                    state.currentCategory = cat || "";
                    syncStateToURL();
                    updateCategoryNavigation();
                    updatePageHeading();
                    applyFilters();
                }
            });
        }

        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });

        window.addEventListener("storage", (e) => {
            if (e.key === CONFIG.CART_KEY) {
                updateCartBadge();
            }
        });
    }

    function renderEmptyState() {
        if (!DOM.productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        DOM.productList.innerHTML = `
            <div class="products-empty" role="status">
                <h2>${hasFilters ? "No products found" : "No products available"}</h2>
                <p>${hasFilters ? "Try adjusting your search query or category filter." : ""}</p>
                ${hasFilters ? `<button type="button" class="products-empty-button" id="clear-product-filters">Clear Filters</button>` : ""}
            </div>
        `;

        $("#clear-product-filters")?.addEventListener("click", clearFilters);
    }

    function clearFilters() {
        state.currentCategory = "";
        state.currentKeyword = "";
        state.currentSort = "featured";

        if (DOM.searchInput) DOM.searchInput.value = "";
        if (DOM.sortSelect) DOM.sortSelect.value = "featured";
        toggleClearButtonVisibility(false);

        syncStateToURL();
        updateCategoryNavigation();
        updatePageHeading();
        applyFilters();
    }

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    function cacheDOM() {
        DOM.productList = $("#product-list");
        DOM.searchInput = $("#product-search");
        DOM.searchClearBtn = $("#search-clear");
        DOM.sortSelect = $("#product-sort");
        DOM.resultsCount = $("#products-count");
        DOM.heading = $("#products-heading");
        DOM.categoryPills = $$(".category-pill");
        DOM.cartBadge = $(".cart-badge") || $("#cart-count");

        let liveRegion = $("#a11y-status-region");
        if (!liveRegion) {
            liveRegion = document.createElement("div");
            liveRegion.id = "a11y-status-region";
            liveRegion.className = "visually-hidden";
            liveRegion.setAttribute("aria-live", "polite");
            document.body.appendChild(liveRegion);
        }
        DOM.liveRegion = liveRegion;
    }

    function initialize() {
        cacheDOM();
        updateCartBadge();
        initializeControls();
        setupProductListDelegation();
        loadProducts();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();
