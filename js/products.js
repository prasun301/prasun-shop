/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (PERFORMANCE OPTIMIZED)
 * Production-ready async fetch, pre-indexed search, filtering, and rendering.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIG & CONSTANTS
       ========================================================================= */

    const CONFIG = {
        STORAGE_KEYS: ["products", "prasun_products"],
        API_ENDPOINT: "/api/products.json",
        DEBOUNCE_MS: 120,
        FALLBACK_IMAGE: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                <rect width="800" height="600" fill="#f4f4f5"/>
                <text x="400" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="system-ui, sans-serif" font-size="24">
                    Image unavailable
                </text>
            </svg>
        `)}`
    };

    // Global reusable currency formatter (Prevents heavy object creation in render loops)
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
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        searchTimer: null,
        renderFrame: null
    };

    // Cached DOM elements to eliminate repeated querySelector calls
    const DOM = {
        productList: null,
        searchInput: null,
        searchClearBtn: null,
        sortSelect: null,
        resultsCount: null,
        heading: null,
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

        // Pre-compute normalized values once during load to optimize filter loops
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
       DATA LOADING
       ========================================================================= */

    async function loadProducts() {
        if (!DOM.productList) return;

        try {
            let rawData = null;

            // 1. Check LocalStorage
            for (const key of CONFIG.STORAGE_KEYS) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    rawData = stored;
                    break;
                }
            }

            if (rawData) {
                try {
                    const parsed = JSON.parse(rawData);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        state.allProducts = parsed.map(normalizeProduct).filter(Boolean);
                    }
                } catch (e) {
                    console.warn("[Prasun Shop] LocalStorage JSON parse failed, falling back to network.", e);
                }
            }

            // 2. Fetch API fallback
            if (!state.allProducts.length) {
                const response = await fetch(CONFIG.API_ENDPOINT);
                if (response.ok) {
                    const json = await response.json();
                    state.allProducts = Array.isArray(json)
                        ? json.map(normalizeProduct).filter(Boolean)
                        : [];
                }
            }

            if (!state.allProducts.length) {
                renderEmptyState();
                updateResultsCount(0);
                return;
            }

            readStateFromURL();
            applyFilters();

        } catch (error) {
            console.error("[Prasun Shop] Unable to load products:", error);
            renderErrorState();
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

        // Sync inputs
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
       FILTER & SORT ENGINE
       ========================================================================= */

    function applyFilters() {
        let filtered = state.allProducts;

        // 1. Pre-normalized Category Filter
        if (state.currentCategory) {
            const cat = normalize(state.currentCategory);
            filtered = filtered.filter(p => p._normalizedCategory === cat);
        }

        // 2. Pre-indexed Search Filter
        if (state.currentKeyword) {
            const kw = normalize(state.currentKeyword);
            filtered = filtered.filter(p => p._searchIndex.includes(kw));
        }

        // 3. Sorting (Avoid copying array if sorting isn't needed)
        if (state.currentSort !== "featured") {
            filtered = [...filtered]; // Shallow copy only when sorting mutate is needed
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

        // Batch UI render using requestAnimationFrame
        if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
        state.renderFrame = requestAnimationFrame(() => {
            renderProducts(filtered);
        });
    }

    /* =========================================================================
       PRODUCT RENDERING
       ========================================================================= */

    function renderProducts(products) {
        if (!DOM.productList) return;

        DOM.productList.setAttribute("aria-busy", "false");
        updateResultsCount(products.length);

        if (!products.length) {
            renderEmptyState();
            return;
        }

        // Optimized string joining
        DOM.productList.innerHTML = products.map(renderProductCard).join("");
    }

    function renderProductCard(product) {
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
                        <div class="product-bottom">
                            <p class="product-price">${formatPrice(product.price)}</p>
                            <span class="product-view-button">View Details</span>
                        </div>
                    </div>
                </a>
            </article>
        `;
    }

    function setupImageErrorDelegation() {
        if (!DOM.productList) return;

        DOM.productList.addEventListener("error", (event) => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true);
    }

    /* =========================================================================
       CONTROLS & LISTENERS
       ========================================================================= */

    function toggleClearButtonVisibility(show) {
        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.hidden = !show;
        }
    }

    function initializeControls() {
        // Search Input & Debounce
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

        // Search Clear Button
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

        // Sort Select Dropdown
        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener("change", () => {
                state.currentSort = DOM.sortSelect.value;
                syncStateToURL();
                applyFilters();
            });
        }

        // Category Pill Click Delegation
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

        // Global Keyboard Shortcut (⌘ K / Ctrl K)
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                if (DOM.searchInput) {
                    event.preventDefault();
                    DOM.searchInput.focus();
                    DOM.searchInput.select();
                }
            }
        });

        // Browser Back/Forward navigation
        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });
    }

    function updateResultsCount(count) {
        if (!DOM.resultsCount) return;

        DOM.resultsCount.textContent = count === 0
            ? "No products"
            : `${count} ${count === 1 ? "product" : "products"}`;
    }

    /* =========================================================================
       EMPTY & ERROR STATES
       ========================================================================= */

    function renderEmptyState() {
        if (!DOM.productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        DOM.productList.innerHTML = `
            <div class="products-empty">
                <div class="products-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="m20 20-4-4"/>
                    </svg>
                </div>
                <h2>${hasFilters ? "No products found" : "No products available"}</h2>
                <p>${hasFilters ? "Try adjusting your search or category filter." : "Products will appear here when available."}</p>
                ${hasFilters ? `<button type="button" class="products-empty-button" id="clear-product-filters">Clear Filters</button>` : ""}
            </div>
        `;

        $("#clear-product-filters")?.addEventListener("click", clearFilters);
    }

    function renderErrorState() {
        if (!DOM.productList) return;

        DOM.productList.innerHTML = `
            <div class="products-error">
                <div class="products-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 8v4"/>
                        <path d="M12 16h.01"/>
                    </svg>
                </div>
                <h2>Unable to load products</h2>
                <p>Please check your connection and try again.</p>
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
    }

    function initialize() {
        cacheDOM();
        initializeControls();
        setupImageErrorDelegation();
        loadProducts();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();
