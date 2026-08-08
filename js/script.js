/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY
 * Production-ready product listing, async fetch, search, filtering, and sorting.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIG & CONSTANTS
       ========================================================================= */

    const CONFIG = {
        STORAGE_KEYS: ["products", "prasun_products"],
        API_ENDPOINT: "/api/products.json", // Fallback if localStorage is empty
        DEBOUNCE_MS: 150,
        FALLBACK_IMAGE: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                <rect width="800" height="600" fill="#f4f4f5"/>
                <text x="400" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="system-ui, sans-serif" font-size="24">
                    Image unavailable
                </text>
            </svg>
        `)}`
    };

    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {
        allProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        searchTimer: null
    };

    /* =========================================================================
       DOM HELPERS & UTILITIES
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
        if (!Number.isFinite(price)) return "$0.00";

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    /* =========================================================================
       PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") return null;

        const id = item.id ?? item.productId ?? `product-${index + 1}`;
        const name = item.name ?? item.title ?? "Unnamed Product";
        const price = Number(item.price ?? 0);
        const rating = Number(item.rating ?? 0);

        return {
            id: String(id),
            name: String(name).trim() || "Unnamed Product",
            price: Number.isFinite(price) ? price : 0,
            image: String(item.image ?? item.imageUrl ?? item.thumbnail ?? "").trim(),
            category: String(item.category ?? "").trim(),
            description: String(item.description ?? "").trim(),
            rating: Number.isFinite(rating) ? rating : 0
        };
    }

    /* =========================================================================
       DATA LOADING (LocalStorage with API Fallback)
       ========================================================================= */

    async function loadProducts() {
        const productList = $("#product-list");
        if (!productList) return;

        try {
            let rawData = null;

            // 1. Try LocalStorage
            for (const key of CONFIG.STORAGE_KEYS) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    rawData = stored;
                    break;
                }
            }

            if (rawData) {
                const parsed = JSON.parse(rawData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    state.allProducts = parsed.map(normalizeProduct).filter(Boolean);
                }
            }

            // 2. Fetch from API fallback if LocalStorage is empty
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

        // Sync inputs with URL
        const searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        if (searchInput) searchInput.value = state.currentKeyword;

        const sortSelect = $("#sortSelect") || $(".products-sort-select");
        if (sortSelect) sortSelect.value = state.currentSort;

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
        const pills = $$(".category-pill, .products-categories a");
        if (!pills.length) return;

        const selected = normalize(state.currentCategory);

        pills.forEach(pill => {
            let category = "";
            try {
                const url = new URL(pill.getAttribute("href") || "", window.location.href);
                category = url.searchParams.get("category") || "";
            } catch {
                category = "";
            }

            const active = selected && normalize(category) === selected;
            pill.classList.toggle("active", Boolean(active));
            pill.setAttribute("aria-current", active ? "page" : "false");
        });
    }

    function updatePageHeading() {
        const heading = $("#products-heading") || $(".products-heading");
        if (heading) {
            heading.textContent = state.currentCategory || "All Products";
        }
    }

    /* =========================================================================
       FILTER & SORT ENGINE
       ========================================================================= */

    function applyFilters() {
        let filtered = [...state.allProducts];

        // 1. Category Filter
        if (state.currentCategory) {
            const cat = normalize(state.currentCategory);
            filtered = filtered.filter(p => normalize(p.category) === cat);
        }

        // 2. Search Keyword Filter
        if (state.currentKeyword) {
            const kw = normalize(state.currentKeyword);
            filtered = filtered.filter(p => {
                const text = `${p.name} ${p.description} ${p.category}`;
                return normalize(text).includes(kw);
            });
        }

        // 3. Sorting
        switch (state.currentSort) {
            case "price-asc":
                filtered.sort((a, b) => a.price - b.price);
                break;
            case "price-desc":
                filtered.sort((a, b) => b.price - a.price);
                break;
            case "rating":
                filtered.sort((a, b) => b.rating - a.rating);
                break;
            case "name-asc":
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                break;
        }

        renderProducts(filtered);
    }

    /* =========================================================================
       PRODUCT RENDERING & EVENT DELEGATION
       ========================================================================= */

    function renderProducts(products) {
        const productList = $("#product-list");
        if (!productList) return;

        updateResultsCount(products.length);

        if (!products.length) {
            renderEmptyState();
            return;
        }

        productList.innerHTML = products.map(renderProductCard).join("");
    }

    function renderProductCard(product) {
        const safeId = encodeURIComponent(product.id);
        const image = product.image || CONFIG.FALLBACK_IMAGE;

        const categoryHTML = product.category
            ? `<span class="product-category">${escapeHTML(product.category)}</span>`
            : "";

        const ratingHTML = product.rating
            ? `<span class="product-rating" aria-label="Rating ${product.rating} out of 5">
                   ★ ${product.rating.toFixed(1)}
               </span>`
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

    /**
     * Event delegation for dynamic image error handling on container level.
     */
    function setupImageErrorDelegation() {
        const productList = $("#product-list");
        if (!productList) return;

        productList.addEventListener("error", (event) => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true); // Capture phase required for standard 'error' events
    }

    /* =========================================================================
       SEARCH, SORT & CONTROLS
       ========================================================================= */

    function initializeControls() {
        // Search Input
        const searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    state.currentKeyword = searchInput.value.trim();
                    syncStateToURL();
                    applyFilters();
                }, CONFIG.DEBOUNCE_MS);
            });
        }

        // Sort Select Dropdown
        const sortSelect = $("#sortSelect") || $(".products-sort-select");
        if (sortSelect) {
            sortSelect.addEventListener("change", () => {
                state.currentSort = sortSelect.value;
                syncStateToURL();
                applyFilters();
            });
        }

        // Global Keyboard Shortcut (Cmd/Ctrl + K)
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                if (searchInput) {
                    event.preventDefault();
                    searchInput.focus();
                    searchInput.select();
                }
            }
        });

        // Browser Back/Forward navigation support
        window.addEventListener("popstate", () => {
            readStateFromURL();
            applyFilters();
        });
    }

    function updateResultsCount(count) {
        const resultCount = $(".products-result-count");
        if (!resultCount) return;

        // Ensure accessibility Live Region for screen readers
        if (!resultCount.hasAttribute("aria-live")) {
            resultCount.setAttribute("aria-live", "polite");
        }

        resultCount.textContent = count === 0
            ? "No products"
            : `${count} ${count === 1 ? "product" : "products"}`;
    }

    /* =========================================================================
       EMPTY, ERROR STATES & CLEAR FILTERS
       ========================================================================= */

    function renderEmptyState() {
        const productList = $("#product-list");
        if (!productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        productList.innerHTML = `
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
        const productList = $("#product-list");
        if (!productList) return;

        productList.innerHTML = `
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

        const searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        if (searchInput) searchInput.value = "";

        const sortSelect = $("#sortSelect") || $(".products-sort-select");
        if (sortSelect) sortSelect.value = "featured";

        syncStateToURL();
        updateCategoryNavigation();
        updatePageHeading();
        applyFilters();
    }

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    function initialize() {
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
