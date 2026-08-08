/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (PRODUCTION OPTIMIZED)
 * High-performance product listing, async fetch, search, filtering, and sorting.
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

    // Reusable Formatters & Collators (Instantiated once to eliminate GC overhead)
    const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const NAME_COLLATOR = new Intl.Collator("en-US", { 
        numeric: true, 
        sensitivity: "base" 
    });

    /* =========================================================================
       STATE & CACHED DOM ELEMENTS
       ========================================================================= */

    const state = {
        allProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        renderFrame: null
    };

    const elements = {
        productList: null,
        searchInput: null,
        sortSelect: null,
        resultCount: null,
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
        return Number.isFinite(price) ? CURRENCY_FORMATTER.format(price) : "$0.00";
    }

    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /* =========================================================================
       PRODUCT NORMALIZATION (Pre-computing Search Index)
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") return null;

        const rawId = item.id ?? item.productId ?? `product-${index + 1}`;
        const id = String(rawId);
        const name = String(item.name ?? item.title ?? "Unnamed Product").trim();
        const category = String(item.category ?? "").trim();
        const description = String(item.description ?? "").trim();
        const price = Number(item.price ?? 0);
        const rating = Number(item.rating ?? 0);

        return {
            id,
            safeId: encodeURIComponent(id),
            name,
            price: Number.isFinite(price) ? price : 0,
            image: String(item.image ?? item.imageUrl ?? item.thumbnail ?? "").trim(),
            category,
            normalizedCategory: normalize(category),
            description,
            rating: Number.isFinite(rating) ? rating : 0,
            // Pre-computed normalized search index for fast lookup
            searchIndex: normalize(`${name} ${description} ${category}`)
        };
    }

    /* =========================================================================
       DATA LOADING
       ========================================================================= */

    async function loadProducts() {
        if (!elements.productList) return;

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
                } catch (err) {
                    console.warn("[Prasun Shop] Invalid JSON in localStorage:", err);
                }
            }

            // 2. Fetch API Fallback
            if (!state.allProducts.length) {
                const response = await fetch(CONFIG.API_ENDPOINT);
                if (response.ok) {
                    const json = await response.json();
                    if (Array.isArray(json)) {
                        state.allProducts = json.map(normalizeProduct).filter(Boolean);
                    }
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

        if (elements.searchInput) elements.searchInput.value = state.currentKeyword;
        if (elements.sortSelect) elements.sortSelect.value = state.currentSort;

        updateCategoryNavigation();
        updatePageHeading();
    }

    // Prevents browser history pollution by using replaceState during filter/search operations
    function syncStateToURL(replace = true) {
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

        if (replace) {
            window.history.replaceState({}, "", url);
        } else {
            window.history.pushState({}, "", url);
        }
    }

    function updateCategoryNavigation() {
        if (!elements.categoryPills.length) return;

        const selected = normalize(state.currentCategory);

        elements.categoryPills.forEach(pill => {
            const category = pill.dataset.category || "";
            const active = selected && category === selected;

            pill.classList.toggle("active", Boolean(active));
            pill.setAttribute("aria-current", active ? "page" : "false");
        });
    }

    function updatePageHeading() {
        if (elements.heading) {
            elements.heading.textContent = state.currentCategory || "All Products";
        }
    }

    /* =========================================================================
       FILTER & SORT ENGINE
       ========================================================================= */

    function applyFilters() {
        const cat = normalize(state.currentCategory);
        const rawKw = normalize(state.currentKeyword);
        // Tokenize search query to support non-contiguous word matching
        const kwTokens = rawKw ? rawKw.split(/\s+/).filter(Boolean) : [];

        // Fast filtering using pre-computed fields & token matching
        let filtered = state.allProducts.filter(p => {
            if (cat && p.normalizedCategory !== cat) return false;
            if (kwTokens.length > 0) {
                return kwTokens.every(token => p.searchIndex.includes(token));
            }
            return true;
        });

        // Fast sorting using pre-instantiated collator
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
                filtered.sort((a, b) => NAME_COLLATOR.compare(a.name, b.name));
                break;
            default:
                break;
        }

        // Schedule batch DOM update via Animation Frame
        if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
        state.renderFrame = requestAnimationFrame(() => renderProducts(filtered));
    }

    /* =========================================================================
       PRODUCT RENDERING
       ========================================================================= */

    function renderProducts(products) {
        if (!elements.productList) return;

        updateResultsCount(products.length);

        if (!products.length) {
            renderEmptyState();
            return;
        }

        // Fast DOM insertion using single batch HTML string write
        elements.productList.innerHTML = products.map(renderProductCard).join("");
    }

    function renderProductCard(product) {
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
            <article class="product-card" data-id="${product.safeId}">
                <a class="product-card-link" href="product.html?id=${product.safeId}" aria-label="View ${escapeHTML(product.name)}">
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
        if (!elements.productList) return;

        elements.productList.addEventListener("error", (event) => {
            if (event.target && event.target.tagName === "IMG") {
                const img = event.target;
                img.src = CONFIG.FALLBACK_IMAGE;
                img.classList.add("is-fallback");
                img.closest(".product-card-image")?.classList.add("image-error");
            }
        }, true);
    }

    /* =========================================================================
       CONTROLS & INITIALIZATION
       ========================================================================= */

    function cacheDOMElements() {
        elements.productList = $("#product-list");
        elements.searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        elements.sortSelect = $("#sortSelect") || $(".products-sort-select");
        elements.resultCount = $(".products-result-count");
        elements.heading = $("#products-heading") || $(".products-heading");

        // Cache category pills and pre-parse target categories into dataset
        elements.categoryPills = $$(".category-pill, .products-categories a");
        elements.categoryPills.forEach(pill => {
            try {
                const url = new URL(pill.getAttribute("href") || "", window.location.href);
                pill.dataset.category = normalize(url.searchParams.get("category") || "");
            } catch {
                pill.dataset.category = "";
            }
        });
    }

    function initializeControls() {
        // Search Input with debounced handler
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", debounce(() => {
                state.currentKeyword = elements.searchInput.value.trim();
                syncStateToURL(true); // replaceState avoids polluting history during typing
                applyFilters();
            }, CONFIG.DEBOUNCE_MS));
        }

        // Sort Select Dropdown
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener("change", () => {
                state.currentSort = elements.sortSelect.value;
                syncStateToURL(true);
                applyFilters();
            });
        }

        // Intercept Category Pill Clicks for instant SPA switching without reloads
        if (elements.categoryPills.length) {
            document.addEventListener("click", (event) => {
                const pill = event.target.closest(".category-pill, .products-categories a");
                if (!pill) return;

                event.preventDefault();
                const targetCategory = pill.dataset.category || "";

                if (state.currentCategory === targetCategory) return;

                state.currentCategory = targetCategory;
                syncStateToURL(false); // pushState for explicit navigation click
                updateCategoryNavigation();
                updatePageHeading();
                applyFilters();
            });
        }

        // Global Shortcut (Cmd/Ctrl + K)
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                if (elements.searchInput) {
                    event.preventDefault();
                    elements.searchInput.focus();
                    elements.searchInput.select();
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
        if (!elements.resultCount) return;

        if (!elements.resultCount.hasAttribute("aria-live")) {
            elements.resultCount.setAttribute("aria-live", "polite");
        }

        elements.resultCount.textContent = count === 0
            ? "No products"
            : `${count} ${count === 1 ? "product" : "products"}`;
    }

    /* =========================================================================
       EMPTY & ERROR STATES
       ========================================================================= */

    function renderEmptyState() {
        if (!elements.productList) return;

        const hasFilters = Boolean(state.currentCategory || state.currentKeyword);

        elements.productList.innerHTML = `
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
        if (!elements.productList) return;

        elements.productList.innerHTML = `
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

        if (elements.searchInput) elements.searchInput.value = "";
        if (elements.sortSelect) elements.sortSelect.value = "featured";

        syncStateToURL(true);
        updateCategoryNavigation();
        updatePageHeading();
        applyFilters();
    }

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    function initialize() {
        cacheDOMElements();
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
