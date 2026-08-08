/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (PERFORMANCE & A11Y OPTIMIZED)
 * Production-ready async fetch, tokenized search, filtering, and cart sync.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIG & CONSTANTS
       ========================================================================= */

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

    // Global reusable currency formatter
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

    /* =========================================================================
       UTILITIES & HELPERS
       ========================================================================= */

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
                : 0;

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
       PRODUCT NORMALIZATION & PRE-INDEXING
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") return null;

        const id = item.id ?? item.productId ?? `product-${index + 1}`;
        const name = String(item.name ?? item.title ?? "Unnamed Product").trim();
        const price = Number(item.price ?? 0);
        const rating = Number(item.rating ?? 0);
        const category = String(item.category ?? "").trim();
        const description = String(item.description ?? "").trim();

        const normalizedCategory = normalize(category);
        const searchIndex = `${normalize(name)} ${normalize(description)} ${normalizedCategory}`;

        return {
            id: String(id),
            name: name || "Unnamed Product",
            price: Number.isFinite(price) ? price : 0,
            image: String(item.image ?? item.imageUrl ?? item.thumbnail ?? "").trim(),
            category,
            description,
            rating: Number.isFinite(rating) ? rating : 0,
            _normalizedCategory: normalizedCategory,
            _searchIndex: searchIndex
        };
    }

    /* =========================================================================
       DATA FETCHING & STORAGE WITH CACHE EXPIRATION
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
                    /* Handle quota exceeded gracefully */
                }
            }

            return normalized;
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("[Prasun Shop] Fetch failed:", error);
                throw error;
            }
            return [];
        }
    }

    async function loadProducts() {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "true");

        const cached = getCachedProducts();
        if (cached) {
            state.allProducts = cached;
            readStateFromURL();
            applyFilters();
            return;
        }

        try {
            state.allProducts = await fetchProductsFromAPI();
            if (!state.allProducts.length) {
                renderEmptyState();
                updateResultsCount(0);
                return;
            }
            readStateFromURL();
            applyFilters();
        } catch {
            renderErrorState();
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
            DOM.heading.textContent = state.currentCategory || "All Products";
        }
    }

    /* =========================================================================
       FILTER & SORT ENGINE (TOKENIZED)
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
       OPTIMIZED PRODUCT RENDERING (DOCUMENT FRAGMENT)
       ========================================================================= */

    function renderProducts(products) {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "false");
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

        const ratingHTML = product.rating
            ? `<span class="product-rating" aria-label="Rating ${product.rating} out of 5">★ ${product.rating.toFixed(1)}</span>`
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
                            />
                            ${categoryHTML}
                        </div>
                        <div class="product-card-body">
                            ${ratingHTML ? `<div class="product-meta">${ratingHTML}</div>` : ""}
                            <h3 class="product-title">${escapeHTML(product.name)}</h3>
                            ${product.description ? `<p class="product-description">${escapeHTML(product.description)}</p>` : ""}
                            <p class="product-price">${formatPrice(product.price)}</p>
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

        // Image error handling delegation
        DOM.productList.addEventListener("error", (event) => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true);

        // Click delegation for Add to Cart
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
       CONTROLS & ACCESSIBILITY LISTENERS
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

        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                if (DOM.searchInput) {
                    event.preventDefault();
                    DOM.searchInput.focus();
                    DOM.searchInput.select();
                }
            }
        });

        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });

        // Sync cart counter across tabs/windows
        window.addEventListener("storage", (e) => {
            if (e.key === CONFIG.CART_KEY) {
                updateCartBadge();
            }
        });
    }

    /* =========================================================================
       EMPTY & ERROR STATES
       ========================================================================= */

    function renderEmptyState() {
        if (!DOM.productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        DOM.productList.innerHTML = `
            <div class="products-empty" role="status">
                <div class="products-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="m20 20-4-4"/>
                    </svg>
                </div>
                <h2>${hasFilters ? "No products found" : "No products available"}</h2>
                <p>${hasFilters ? "Try adjusting your search query or category filter." : "Products will appear here when available."}</p>
                ${hasFilters ? `<button type="button" class="products-empty-button" id="clear-product-filters">Clear Filters</button>` : ""}
            </div>
        `;

        $("#clear-product-filters")?.addEventListener("click", clearFilters);
    }

    function renderErrorState() {
        if (!DOM.productList) return;

        DOM.productList.innerHTML = `
            <div class="products-error" role="alert">
                <div class="products-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 8v4"/>
                        <path d="M12 16h.01"/>
                    </svg>
                </div>
                <h2>Unable to load products</h2>
                <p>Please check your internet connection and try again.</p>
                <button type="button" class="products-empty-button" id="retry-products">Try Again</button>
            </div>
        `;

        $("#retry-products")?.addEventListener("click", loadProducts);
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
        DOM.searchInput = $("#product-search") || $("#searchInput") || $(".products-search-input");
        DOM.searchClearBtn = $("#search-clear");
        DOM.sortSelect = $("#product-sort") || $("#sortSelect") || $(".products-sort");
        DOM.resultsCount = $("#products-count") || $(".products-result-count");
        DOM.heading = $("#products-heading") || $(".products-heading");
        DOM.categoryPills = $$(".category-pill");
        DOM.cartBadge = $("#cart-count");

        let liveRegion = $("#a11y-status-region");
        if (!liveRegion) {
            liveRegion = document.createElement("div");
            liveRegion.id = "a11y-status-region";
            liveRegion.className = "visually-hidden";
            liveRegion.setAttribute("aria-live", "polite");
            liveRegion.setAttribute("aria-atomic", "true");
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
