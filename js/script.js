/**
 * ============================================================================
 * PRASUN SHOP — MAIN SHOP INTERACTIVITY (CJ DROPSHIPPING DYNAMIC API SYNC)
 * ============================================================================
 *
 * Automatically fetches and displays physical products from your backend 
 * proxy endpoint connected to the CJ Dropshipping API.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CONFIG = {
        API_ENDPOINT: "/api/products", // Backend endpoint that proxies CJ Dropshipping API
        CART_KEY: "prasun_cart",
        ITEMS_PER_PAGE: 24,
        DEBOUNCE_MS: 150,

        FALLBACK_IMAGE:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="800"
                    height="600"
                    viewBox="0 0 800 600">

                    <rect
                        width="800"
                        height="600"
                        fill="#f4f4f5"/>

                    <text
                        x="400"
                        y="300"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="#a1a1aa"
                        font-family="system-ui, sans-serif"
                        font-size="24">
                        Image unavailable
                    </text>

                </svg>
            `)
    };


    /* ========================================================================
       CURRENCY FORMATTER
       ======================================================================== */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


    /* ========================================================================
       STATE
       ======================================================================== */

    const state = {
        allProducts: [],
        filteredProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        currentPage: 1,
        searchTimer: null,
        isLoading: true,
        fetchError: null
    };


    /* ========================================================================
       DOM CACHE
       ======================================================================== */

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


    /* ========================================================================
       BASIC HELPERS
       ======================================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    function escapeHTML(value) {
        if (value == null) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    }


    function formatPrice(value) {
        const price = Number(value);

        return Number.isFinite(price)
            ? currencyFormatter.format(price)
            : "$0.00";
    }


    /* ========================================================================
       PRODUCT NORMALIZATION
       ======================================================================== */

    function normalizeProduct(product) {
        const normalized = {
            id: String(product.id || product.pid || product.sku || "").trim(),
            name: String(product.name || product.productName || "Product").trim(),
            price: Number(product.price || product.sellPrice || 0),
            image: String(product.image || product.productImage || "").trim(),
            category: String(product.category || product.categoryName || "").trim(),
            description: String(product.description || "").trim(),
            rating: Number(product.rating || 4.5)
        };

        normalized._normalizedCategory = normalize(normalized.category);

        normalized._searchIndex = [
            normalized.name,
            normalized.category,
            normalized.description
        ]
            .map(normalize)
            .join(" ");

        return normalized;
    }


    /* ========================================================================
       FETCH PRODUCTS FROM CJ DROPSHIPPING BACKEND ENDPOINT
       ======================================================================== */

    async function fetchProducts() {
        state.isLoading = true;
        state.fetchError = null;
        renderLoadingState();

        try {
            const response = await fetch(CONFIG.API_ENDPOINT, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }

            const data = await response.json();
            const rawProducts = Array.isArray(data) ? data : (data.products || data.data || []);

            state.allProducts = rawProducts.map(normalizeProduct);
            state.isLoading = false;

            applyFilters();

        } catch (error) {
            console.error("[PRASUN SHOP] Failed to fetch products:", error);
            state.isLoading = false;
            state.fetchError = error.message;
            renderErrorState(error.message);
        }
    }


    /* ========================================================================
       CART
       ======================================================================== */

    function getCart() {
        try {
            const rawCart = localStorage.getItem(CONFIG.CART_KEY);
            if (!rawCart) return [];

            const parsed = JSON.parse(rawCart);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn("[PRASUN SHOP] Unable to read cart:", error);
            return [];
        }
    }


    function updateCartBadge() {
        if (!DOM.cartBadge) return;

        const cart = getCart();
        const totalCount = cart.reduce((total, item) => {
            const quantity = Number(item.quantity);
            return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
        }, 0);

        DOM.cartBadge.textContent = String(totalCount);
        DOM.cartBadge.hidden = totalCount === 0;

        const cartLink = DOM.cartBadge.closest("a");
        if (cartLink) {
            cartLink.setAttribute(
                "aria-label",
                totalCount > 0
                    ? `View Shopping Cart, ${totalCount} ${totalCount === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    function addToCart(productId) {
        const product = state.allProducts.find(item => item.id === productId);
        if (!product) return;

        try {
            const cart = getCart();
            const existingIndex = cart.findIndex(item => item.id === productId);

            if (existingIndex !== -1) {
                const currentQuantity = Number(cart[existingIndex].quantity) || 1;
                cart[existingIndex].quantity = currentQuantity + 1;
            } else {
                cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    category: product.category,
                    description: product.description,
                    rating: product.rating,
                    quantity: 1
                });
            }

            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
            updateCartBadge();

            if (DOM.liveRegion) {
                DOM.liveRegion.textContent = `${product.name} added to cart.`;
            }

        } catch (error) {
            console.error("[PRASUN SHOP] Unable to add product to cart:", error);
        }
    }


    /* ========================================================================
       URL STATE
       ======================================================================== */

    function readStateFromURL() {
        const params = new URLSearchParams(window.location.search);

        state.currentCategory = params.get("category")?.trim() || "";
        state.currentKeyword = params.get("q")?.trim() || "";
        state.currentSort = params.get("sort")?.trim() || "featured";

        const validSorts = ["featured", "price-low", "price-high", "rating", "name"];
        if (!validSorts.includes(state.currentSort)) {
            state.currentSort = "featured";
        }

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

        if (state.currentCategory) {
            url.searchParams.set("category", state.currentCategory);
        } else {
            url.searchParams.delete("category");
        }

        if (state.currentKeyword) {
            url.searchParams.set("q", state.currentKeyword);
        } else {
            url.searchParams.delete("q");
        }

        if (state.currentSort && state.currentSort !== "featured") {
            url.searchParams.set("sort", state.currentSort);
        } else {
            url.searchParams.delete("sort");
        }

        window.history.pushState({}, "", url);
    }


    /* ========================================================================
       CATEGORY NAVIGATION & HEADINGS
       ======================================================================== */

    function updateCategoryNavigation() {
        const selected = normalize(state.currentCategory);

        DOM.categoryPills.forEach(pill => {
            const pillCategory = normalize(pill.dataset.category || "");
            const active = (selected === "" && pillCategory === "all") || (selected !== "" && pillCategory === selected);

            pill.classList.toggle("active", active);
            pill.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }


    function updatePageHeading() {
        if (!DOM.heading) return;
        DOM.heading.textContent = state.currentCategory || "Shop Physical Products";
    }


    /* ========================================================================
       FILTER & SORT
       ======================================================================== */

    function applyFilters() {
        if (state.isLoading) return;

        let filtered = [...state.allProducts];

        if (state.currentCategory) {
            const category = normalize(state.currentCategory);
            filtered = filtered.filter(product => product._normalizedCategory === category);
        }

        if (state.currentKeyword) {
            const tokens = normalize(state.currentKeyword).split(/\s+/).filter(Boolean);
            filtered = filtered.filter(product =>
                tokens.every(token => product._searchIndex.includes(token))
            );
        }

        switch (state.currentSort) {
            case "price-low":
                filtered.sort((a, b) => a.price - b.price);
                break;
            case "price-high":
                filtered.sort((a, b) => b.price - a.price);
                break;
            case "rating":
                filtered.sort((a, b) => b.rating - a.rating);
                break;
            case "name":
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "featured":
            default:
                break;
        }

        state.filteredProducts = filtered;
        state.currentPage = 1;
        renderProducts(state.filteredProducts);
    }


    /* ========================================================================
       RENDERING STATES (LOADING & ERROR)
       ======================================================================== */

    function renderLoadingState() {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "true");
        DOM.productList.innerHTML = `
            <div class="products-loading" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
                <div class="spinner" style="display: inline-block; width: 40px; height: 40px; border: 3px solid #e4e4e7; border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <p style="margin-top: 1rem; color: #71717a;">Loading products from CJ Dropshipping...</p>
            </div>
        `;
    }


    function renderErrorState(errorMessage) {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "false");
        DOM.productList.innerHTML = `
            <div class="products-error" role="alert" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Unable to load CJ products</h2>
                <p style="color: #ef4444; margin-bottom: 1.5rem;">${escapeHTML(errorMessage)}</p>
                <button type="button" id="retry-fetch-btn" class="btn-load-more" style="padding: 0.5rem 1.5rem; background: #000; color: #fff; border-radius: 0.375rem; border: none; cursor: pointer;">
                    Retry Connection
                </button>
            </div>
        `;

        const retryBtn = $("#retry-fetch-btn");
        if (retryBtn) {
            retryBtn.addEventListener("click", fetchProducts);
        }
    }


    /* ========================================================================
       PRODUCT RENDERING
       ======================================================================== */

    function renderProducts(products) {
        if (!DOM.productList) return;

        updateResultsCount(products.length);

        if (!products.length) {
            renderEmptyState();
            return;
        }

        const visibleCount = state.currentPage * CONFIG.ITEMS_PER_PAGE;
        const visibleProducts = products.slice(0, visibleCount);
        const fragment = document.createDocumentFragment();

        visibleProducts.forEach(product => {
            const template = document.createElement("template");
            template.innerHTML = renderProductCardHTML(product);
            fragment.appendChild(template.content);
        });

        if (products.length > visibleCount) {
            const pagination = document.createElement("div");
            pagination.className = "products-pagination-container";
            pagination.style.gridColumn = "1 / -1";
            pagination.style.textAlign = "center";
            pagination.style.padding = "2rem 0";

            const remaining = products.length - visibleCount;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn-load-more";
            button.id = "load-more-products";
            button.textContent = `Load More (${remaining} remaining)`;

            button.addEventListener("click", () => {
                state.currentPage++;
                renderProducts(state.filteredProducts);
            });

            pagination.appendChild(button);
            fragment.appendChild(pagination);
        }

        DOM.productList.replaceChildren(fragment);
        DOM.productList.setAttribute("aria-busy", "false");
    }


    function renderProductCardHTML(product) {
        const safeId = encodeURIComponent(product.id);
        const image = product.image || CONFIG.FALLBACK_IMAGE;

        const categoryHTML = product.category
            ? `<span class="product-category">${escapeHTML(product.category)}</span>`
            : "";

        const ratingHTML = Number.isFinite(product.rating) && product.rating > 0
            ? `
                <div class="product-meta" aria-label="Rating ${product.rating.toFixed(1)} out of 5">
                    <span class="product-rating">★ ${product.rating.toFixed(1)}</span>
                </div>
            `
            : "";

        return `
            <article class="product-card" data-id="${escapeHTML(product.id)}">
                <div class="product-card-inner">
                    <a class="product-card-link" href="product.html?id=${safeId}" aria-label="View ${escapeHTML(product.name)}">
                        <div class="product-card-image">
                            <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async" width="600" height="600">
                            ${categoryHTML}
                        </div>
                        <div class="product-card-body">
                            ${ratingHTML}
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


    /* ========================================================================
       EMPTY STATE
       ======================================================================== */

    function renderEmptyState() {
        if (!DOM.productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        DOM.productList.innerHTML = `
            <div class="products-empty" role="status">
                <div class="products-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-4-4"></path>
                    </svg>
                </div>
                <h2>${hasFilters ? "No products found" : "No products available"}</h2>
                <p>${hasFilters ? "Try adjusting your search query or category filter." : "Products will appear here when available."}</p>
                ${hasFilters ? `<button type="button" class="products-empty-button" id="clear-product-filters">Clear Filters</button>` : ""}
            </div>
        `;

        const clearButton = $("#clear-product-filters");
        if (clearButton) {
            clearButton.addEventListener("click", clearFilters);
        }
    }


    /* ========================================================================
       RESULTS COUNTER
       ======================================================================== */

    function updateResultsCount(count) {
        const text = count === 0
            ? "No products found"
            : `${count} ${count === 1 ? "product" : "products"} available`;

        if (DOM.resultsCount) DOM.resultsCount.textContent = text;
        if (DOM.liveRegion) DOM.liveRegion.textContent = text;
    }


    /* ========================================================================
       SEARCH CLEAR BUTTON & FILTERS
       ======================================================================== */

    function toggleClearButtonVisibility(show) {
        if (!DOM.searchClearBtn) return;
        DOM.searchClearBtn.hidden = !show;
        DOM.searchClearBtn.setAttribute("aria-hidden", show ? "false" : "true");
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


    /* ========================================================================
       PRODUCT LIST DELEGATION
       ======================================================================== */

    function setupProductListDelegation() {
        if (!DOM.productList) return;

        DOM.productList.addEventListener("error", event => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                if (img.dataset.fallbackApplied) return;

                img.dataset.fallbackApplied = "true";
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true);

        DOM.productList.addEventListener("click", event => {
            const button = event.target.closest('[data-action="add-cart"]');
            if (!button) return;

            event.preventDefault();
            const productId = decodeURIComponent(button.dataset.id || "");
            addToCart(productId);
        });
    }


    /* ========================================================================
       SEARCH & CONTROLS
       ======================================================================== */

    function initializeControls() {
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", () => {
                const value = DOM.searchInput.value.trim();
                toggleClearButtonVisibility(Boolean(value));

                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    state.currentKeyword = value;
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
                state.currentKeyword = "";
                toggleClearButtonVisibility(false);
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
            categoryContainer.addEventListener("click", event => {
                const button = event.target.closest(".category-pill");
                if (!button) return;

                const category = button.dataset.category === "all" ? "" : button.dataset.category;
                if (category === state.currentCategory) return;

                state.currentCategory = category;
                syncStateToURL();
                updateCategoryNavigation();
                updatePageHeading();
                applyFilters();
            });
        }
    }


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    function populateDOMCache() {
        DOM.productList = $("#product-list") || $("#products-grid") || $(".products-grid");
        DOM.searchInput = $("#product-search");
        DOM.searchClearBtn = $("#clear-search");
        DOM.sortSelect = $("#product-sort");
        DOM.resultsCount = $("#results-count");
        DOM.heading = $("#page-heading");
        DOM.liveRegion = $("#aria-live-region");
        DOM.cartBadge = $("#cart-count");
        DOM.categoryPills = $$(".category-pill");
    }


    function init() {
        populateDOMCache();
        readStateFromURL();
        updateCartBadge();
        setupProductListDelegation();
        initializeControls();

        // Trigger dynamic API fetch from CJ Dropshipping server proxy
        fetchProducts();

        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
