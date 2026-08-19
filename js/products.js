/**
 * products.js - Product Catalog Management
 * Handles API fetching, local caching, search/filter/sort, URL synchronization,
 * and cart integration.
 */
(function () {
    "use strict";

    // ==========================================
    // Configuration & Mock Data
    // ==========================================
    const CONFIG = {
        API_URL: "/api/products.json",
        CACHE_KEY: "prasun_products_cache",
        CACHE_TTL_MS: 1000 * 60 * 30, // 30 Minutes
        CART_KEY: "prasun_cart_items",
        DEBOUNCE_DELAY_MS: 150
    };

    const MOCK_PRODUCTS = [
        { id: "p1", name: "Premium Wireless Headphones", category: "Electronics", price: 199.99, available: true, image: "/images/headphones.jpg" },
        { id: "p2", name: "Ergonomic Desk Chair", category: "Furniture", price: 289.00, available: true, image: "/images/chair.jpg" },
        { id: "p3", name: "Organic Dark Roast Coffee", category: "Groceries", price: 14.50, available: true, image: "/images/coffee.jpg" },
        { id: "p4", name: "Mechanical Gaming Keyboard", category: "Electronics", price: 119.99, available: false, image: "/images/keyboard.jpg" }
    ];

    // ==========================================
    // Application State
    // ==========================================
    const state = {
        allProducts: [],
        filteredProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        searchTimer: null,
        fetchAbortController: null
    };

    // ==========================================
    // DOM Element Caching
    // ==========================================
    const DOM = {
        productList: null,
        searchInput: null,
        searchClearBtn: null,
        categoryFilter: null,
        sortSelect: null,
        resetFiltersBtn: null,
        cartBadge: null,
        resultsCount: null
    };

    function cacheDOMElements() {
        DOM.productList = document.getElementById("product-list");
        DOM.searchInput = document.getElementById("search-input");
        DOM.searchClearBtn = document.getElementById("search-clear");
        DOM.categoryFilter = document.getElementById("category-filter");
        DOM.sortSelect = document.getElementById("sort-select");
        DOM.resetFiltersBtn = document.getElementById("reset-filters");
        DOM.cartBadge = document.getElementById("cart-badge");
        DOM.resultsCount = document.getElementById("results-count");
    }

    // ==========================================
    // Helper & Storage Utilities
    // ==========================================
    function normalizeProduct(item) {
        if (!item || !item.id || !item.name) return null;
        return {
            id: String(item.id),
            name: String(item.name).trim(),
            category: String(item.category || "Uncategorized").trim(),
            price: Number(item.price) || 0,
            available: Boolean(item.available),
            image: item.image || "/images/placeholder.jpg"
        };
    }

    // FIX #4: Strictly validate `parsed.timestamp` to prevent stale cache lock-ins
    function getCachedProducts() {
        try {
            const raw = localStorage.getItem(CONFIG.CACHE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.timestamp === "number") {
                if (Date.now() - parsed.timestamp > CONFIG.CACHE_TTL_MS) {
                    localStorage.removeItem(CONFIG.CACHE_KEY);
                    return null;
                }
                return Array.isArray(parsed.data) ? parsed.data : null;
            } else {
                // Remove invalid or legacy un-timestamped cache
                localStorage.removeItem(CONFIG.CACHE_KEY);
                return null;
            }
        } catch (e) {
            localStorage.removeItem(CONFIG.CACHE_KEY);
            return null;
        }
    }

    function setCachedProducts(products) {
        try {
            const payload = {
                timestamp: Date.now(),
                data: products
            };
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.warn("[Prasun Shop] LocalStorage quota exceeded or disabled.", e);
        }
    }

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
            updateCartBadge();
        } catch (e) {
            console.error("[Prasun Shop] Unable to save cart item.", e);
        }
    }

    function updateCartBadge() {
        if (!DOM.cartBadge) return;
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        DOM.cartBadge.textContent = totalItems;
        DOM.cartBadge.style.display = totalItems > 0 ? "inline-block" : "none";
    }

    // ==========================================
    // API Data Fetching
    // ==========================================
    // FIX #3: Ignore `AbortError` to prevent unnecessary fallback overrides
    async function fetchProductsFromAPI() {
        if (state.fetchAbortController) {
            state.fetchAbortController.abort();
        }
        state.fetchAbortController = new AbortController();

        try {
            const response = await fetch(CONFIG.API_URL, {
                signal: state.fetchAbortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const rawData = await response.json();
            const normalized = rawData.map(normalizeProduct).filter(Boolean);
            setCachedProducts(normalized);
            return normalized;
        } catch (error) {
            if (error.name === "AbortError") {
                return []; // Silent exit on deliberate request cancellation
            }
            console.warn("[Prasun Shop] API fetch failed. Using fallback products.", error.message);
            return MOCK_PRODUCTS.map(normalizeProduct).filter(Boolean);
        }
    }

    // ==========================================
    // Product Operations: Filtering & Sorting
    // ==========================================
    function applyFilters() {
        let results = [...state.allProducts];

        // 1. Category Filter
        if (state.currentCategory) {
            results = results.filter(
                p => p.category.toLowerCase() === state.currentCategory.toLowerCase()
            );
        }

        // 2. Keyword Search
        if (state.currentKeyword) {
            const kw = state.currentKeyword.toLowerCase();
            results = results.filter(
                p => p.name.toLowerCase().includes(kw) || p.category.toLowerCase().includes(kw)
            );
        }

        // 3. Sorting
        switch (state.currentSort) {
            case "price-low":
                results.sort((a, b) => a.price - b.price);
                break;
            case "price-high":
                results.sort((a, b) => b.price - a.price);
                break;
            case "name-asc":
                results.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default: // "featured"
                break;
        }

        state.filteredProducts = results;
        renderProducts();
        syncStateToURL();
    }

    // FIX #2: Use `replaceState` to avoid polluting history on every change
    function syncStateToURL() {
        const url = new URL(window.location.href);

        if (state.currentCategory) url.searchParams.set("category", state.currentCategory);
        else url.searchParams.delete("category");

        if (state.currentKeyword) url.searchParams.set("q", state.currentKeyword);
        else url.searchParams.delete("q");

        if (state.currentSort && state.currentSort !== "featured") url.searchParams.set("sort", state.currentSort);
        else url.searchParams.delete("sort");

        window.history.replaceState({}, "", url);
    }

    function readStateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        state.currentCategory = urlParams.get("category") || "";
        state.currentKeyword = urlParams.get("q") || "";
        state.currentSort = urlParams.get("sort") || "featured";

        if (DOM.searchInput) DOM.searchInput.value = state.currentKeyword;
        if (DOM.categoryFilter) DOM.categoryFilter.value = state.currentCategory;
        if (DOM.sortSelect) DOM.sortSelect.value = state.currentSort;
        if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = state.currentKeyword ? "block" : "none";
    }

    function buildCategories() {
        if (!DOM.categoryFilter) return;
        const categories = [...new Set(state.allProducts.map(p => p.category))].sort();

        DOM.categoryFilter.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            DOM.categoryFilter.appendChild(option);
        });

        if (state.currentCategory) {
            DOM.categoryFilter.value = state.currentCategory;
        }
    }

    // ==========================================
    // DOM Rendering & Actions
    // ==========================================
    function renderProducts() {
        if (!DOM.productList) return;

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = `${state.filteredProducts.length} Product${state.filteredProducts.length !== 1 ? "s" : ""} Found`;
        }

        if (state.filteredProducts.length === 0) {
            DOM.productList.innerHTML = `
                <div class="no-results">
                    <h3>No products found</h3>
                    <p>Try adjusting your search or clear filters to see more results.</p>
                </div>
            `;
            return;
        }

        DOM.productList.innerHTML = state.filteredProducts.map(p => `
            <div class="product-card ${!p.available ? 'out-of-stock' : ''}">
                <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy" />
                <div class="product-info">
                    <span class="product-category">${p.category}</span>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="product-bottom">
                        <span class="product-price">$${p.price.toFixed(2)}</span>
                        <button 
                            type="button"
                            class="add-cart-btn" 
                            data-action="add-cart" 
                            data-id="${p.id}"
                            ${!p.available ? 'disabled' : ''}>
                            ${p.available ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        `).join("");
    }

    // UX IMPROVEMENT #1: Visual feedback when adding an item to the cart
    function addToCart(productId, targetBtn = null) {
        const product = state.allProducts.find(item => item.id === productId);
        if (!product || !product.available) return;

        const cart = getCart();
        const existingIndex = cart.findIndex(item => item.id === productId);

        if (existingIndex > -1) {
            cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }
        saveCart(cart);

        if (targetBtn) {
            const originalText = targetBtn.textContent;
            targetBtn.textContent = "Added!";
            targetBtn.disabled = true;
            setTimeout(() => {
                targetBtn.textContent = originalText;
                targetBtn.disabled = false;
            }, 1200);
        }
    }

    // FIX #1: Clear pending debounce timer on reset
    function resetAllFilters() {
        clearTimeout(state.searchTimer);
        state.currentCategory = "";
        state.currentKeyword = "";
        state.currentSort = "featured";

        if (DOM.searchInput) DOM.searchInput.value = "";
        if (DOM.categoryFilter) DOM.categoryFilter.value = "";
        if (DOM.sortSelect) DOM.sortSelect.value = "featured";
        if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = "none";

        applyFilters();
    }

    // ==========================================
    // Event Handlers
    // ==========================================
    function attachEventListeners() {
        // Search Input (Debounced)
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", (e) => {
                const query = e.target.value.trim();
                if (DOM.searchClearBtn) {
                    DOM.searchClearBtn.style.display = query ? "block" : "none";
                }

                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    state.currentKeyword = query;
                    applyFilters();
                }, CONFIG.DEBOUNCE_DELAY_MS);
            });
        }

        // FIX #1: Clear pending search timer on search clear button click
        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.addEventListener("click", () => {
                clearTimeout(state.searchTimer);
                DOM.searchInput.value = "";
                DOM.searchClearBtn.style.display = "none";
                state.currentKeyword = "";
                applyFilters();
            });
        }

        // Category Filter
        if (DOM.categoryFilter) {
            DOM.categoryFilter.addEventListener("change", (e) => {
                state.currentCategory = e.target.value;
                applyFilters();
            });
        }

        // Sort Select
        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener("change", (e) => {
                state.currentSort = e.target.value;
                applyFilters();
            });
        }

        // Reset Filters Button
        if (DOM.resetFiltersBtn) {
            DOM.resetFiltersBtn.addEventListener("click", resetAllFilters);
        }

        // Add to Cart Delegation
        if (DOM.productList) {
            DOM.productList.addEventListener("click", (e) => {
                const cartBtn = e.target.closest("[data-action='add-cart']");
                if (!cartBtn) return;

                e.preventDefault();
                const productId = cartBtn.dataset.id;
                if (productId) {
                    addToCart(productId, cartBtn);
                }
            });
        }

        // Browser History Back/Forward Handling
        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });
    }

    // ==========================================
    // Initialization (Stale-While-Revalidate)
    // ==========================================
    // UX IMPROVEMENT #2: Silent background update on cache hit
    async function loadProducts() {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "true");
        updateCartBadge();

        const cachedData = getCachedProducts();
        if (cachedData && cachedData.length > 0) {
            state.allProducts = cachedData;
            buildCategories();
            readStateFromURL();
            applyFilters();
            DOM.productList.setAttribute("aria-busy", "false");

            // Silent background revalidation
            fetchProductsFromAPI().then(freshData => {
                if (freshData && freshData.length > 0) {
                    state.allProducts = freshData;
                    buildCategories();
                    applyFilters();
                }
            });
            return;
        }

        // Fresh Load if no valid cache exists
        const freshData = await fetchProductsFromAPI();
        state.allProducts = freshData;
        buildCategories();
        readStateFromURL();
        applyFilters();
        DOM.productList.setAttribute("aria-busy", "false");
    }

    // DOM Ready Bootstrap
    document.addEventListener("DOMContentLoaded", () => {
        cacheDOMElements();
        attachEventListeners();
        loadProducts();
    });
})();
