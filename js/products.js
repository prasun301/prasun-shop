/**
 * products.js - CJ Dropshipping Integrated Product Catalog
 * Handles fetching, parsing, caching, filtering, and displaying CJ Dropshipping products.
 */
(function () {
    "use strict";

    // ==========================================
    // Configuration & Fallbacks
    // ==========================================
    const CONFIG = {
        // Replace with your backend endpoint that connects to CJ API 
        // Or your raw JSON feed exported from CJ Dropshipping
        API_URL: "/api/cj-products", 
        CACHE_KEY: "prasun_cj_products_cache",
        CACHE_TTL_MS: 1000 * 60 * 30, // 30 Minutes
        CART_KEY: "prasun_cart_items",
        DEBOUNCE_DELAY_MS: 150,
        // Fallback placeholder image when CJ image links are broken or loading
        FALLBACK_IMAGE: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENo CJ Image Available%3C/text%3E%3C/svg%3E"
    };

    // Backup local products in case API is unreachable
    const MOCK_PRODUCTS = [
        { id: "cj-p1", name: "Wireless Headphones", category: "Electronics", price: 29.99, available: true, image: "", description: "High-quality wireless headphones from CJ." },
        { id: "cj-p2", name: "Ergonomic Desk Chair", category: "Furniture", price: 189.00, available: true, image: "", description: "Comfortable ergonomic office chair." }
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
    // CJ Dropshipping Data Normalizer
    // Maps raw CJ API properties to shop structure
    // ==========================================
    function normalizeProduct(item) {
        if (!item) return null;

        // CJ API field mappings (supports raw CJ response format & standard format)
        const id = item.pid || item.productSku || item.id || `cj-${Math.random().toString(36).substring(2, 9)}`;
        const name = item.productNameEn || item.productName || item.name || "CJ Product";
        const category = item.categoryName || item.category || "General";
        const price = Number(item.sellPrice || item.sellPriceMin || item.price || 0);
        
        // CJ Image field resolution (CJ delivers images via HTTP/HTTPS URLs)
        let image = item.productImage || item.productImageSet?.[0] || item.image || "";
        if (image && image.startsWith("//")) {
            image = "https:" + image; // Ensure valid protocol
        }

        // CJ Description parsing
        const description = item.description || item.entryName || "Quality dropshipped item directly from CJ Dropshipping.";

        return {
            id: String(id),
            name: String(name).trim(),
            category: String(category).trim(),
            price: price,
            available: item.quantity !== 0 && item.available !== false,
            image: image || CONFIG.FALLBACK_IMAGE,
            description: String(description)
        };
    }

    // ==========================================
    // Storage Utilities
    // ==========================================
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
            console.warn("[CJ Shop] LocalStorage quota exceeded or disabled.", e);
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
            console.error("[CJ Shop] Unable to save cart item.", e);
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
            
            // Extract array whether returned directly or inside CJ API wrappers (e.g. data.list)
            const productsList = Array.isArray(rawData) ? rawData : (rawData.data?.list || rawData.data || []);
            const normalized = productsList.map(normalizeProduct).filter(Boolean);

            if (normalized.length > 0) {
                setCachedProducts(normalized);
                return normalized;
            }
            throw new Error("No valid products returned from CJ feed.");
        } catch (error) {
            if (error.name === "AbortError") return [];
            console.warn("[CJ Shop] API connection failed. Loading local fallback list.", error.message);
            return MOCK_PRODUCTS.map(normalizeProduct).filter(Boolean);
        }
    }

    // ==========================================
    // Filter & Search Logic
    // ==========================================
    function applyFilters() {
        let results = [...state.allProducts];

        if (state.currentCategory) {
            results = results.filter(
                p => p.category.toLowerCase() === state.currentCategory.toLowerCase()
            );
        }

        if (state.currentKeyword) {
            const kw = state.currentKeyword.toLowerCase();
            results = results.filter(
                p => p.name.toLowerCase().includes(kw) || 
                     p.category.toLowerCase().includes(kw) ||
                     p.description.toLowerCase().includes(kw)
            );
        }

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
            default:
                break;
        }

        state.filteredProducts = results;
        renderProducts();
        syncStateToURL();
    }

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
    // UI Rendering
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
                    <p>Try searching for something else or reset your filters.</p>
                </div>
            `;
            return;
        }

        DOM.productList.innerHTML = state.filteredProducts.map(p => `
            <article class="product-card ${!p.available ? 'is-disabled' : ''}">
                <div class="product-image-wrapper">
                    <img 
                        src="${p.image}" 
                        alt="${p.name}" 
                        class="product-image" 
                        loading="lazy"
                        onerror="this.onerror=null; this.src='${CONFIG.FALLBACK_IMAGE}';"
                    />
                </div>
                <div class="product-info">
                    <span class="product-category">${p.category}</span>
                    <h3 class="product-name">${p.name}</h3>
                    <p class="product-description">${p.description}</p>
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
            </article>
        `).join("");
    }

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
    // Event Listeners
    // ==========================================
    function attachEventListeners() {
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

        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.addEventListener("click", () => {
                clearTimeout(state.searchTimer);
                DOM.searchInput.value = "";
                DOM.searchClearBtn.style.display = "none";
                state.currentKeyword = "";
                applyFilters();
            });
        }

        if (DOM.categoryFilter) {
            DOM.categoryFilter.addEventListener("change", (e) => {
                state.currentCategory = e.target.value;
                applyFilters();
            });
        }

        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener("change", (e) => {
                state.currentSort = e.target.value;
                applyFilters();
            });
        }

        if (DOM.resetFiltersBtn) {
            DOM.resetFiltersBtn.addEventListener("click", resetAllFilters);
        }

        if (DOM.productList) {
            DOM.productList.addEventListener("click", (e) => {
                const cartBtn = e.target.closest("[data-action='add-cart']");
                if (!cartBtn) return;

                e.preventDefault();
                const productId = cartBtn.dataset.id;
                if (productId) addToCart(productId, cartBtn);
            });
        }

        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });
    }

    // ==========================================
    // Initialization
    // ==========================================
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

            fetchProductsFromAPI().then(freshData => {
                if (freshData && freshData.length > 0) {
                    state.allProducts = freshData;
                    buildCategories();
                    applyFilters();
                }
            });
            return;
        }

        const freshData = await fetchProductsFromAPI();
        state.allProducts = freshData;
        buildCategories();
        readStateFromURL();
        applyFilters();
        DOM.productList.setAttribute("aria-busy", "false");
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheDOMElements();
        attachEventListeners();
        loadProducts();
    });
})();
