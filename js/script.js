/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (ENTERPRISE EDITION)
 * High-performance product catalog, resilient async fetch, token-based search,
 * intelligent pagination, event delegation, and accessible DOM rendering.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIG & CONSTANTS
       ========================================================================= */

    const CONFIG = Object.freeze({
        STORAGE_KEYS: ["products", "prasun_products"],
        API_ENDPOINT: "/api/products.json",
        FETCH_TIMEOUT_MS: 8000,
        DEBOUNCE_MS: 150,
        ITEMS_PER_PAGE: 12,
        EAGER_IMAGE_COUNT: 4, // Prevent LCP degradation on above-the-fold cards
        MAX_PAGINATION_BUTTONS: 5, // Max page buttons visible in sliding window
        FALLBACK_IMAGE: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                <rect width="800" height="600" fill="#f4f4f5"/>
                <text x="400" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500">
                    Image unavailable
                </text>
            </svg>
        `)}`
    });

    // Reusable Formatters & Collators (Instantiated once to avoid Garbage Collection overhead)
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
       STATE & DOM CACHE
       ========================================================================= */

    const state = {
        allProducts: [],
        filteredProducts: [],
        currentCategory: "",
        currentKeyword: "",
        currentSort: "featured",
        currentPage: 1,
        renderFrame: null,
        isLoading: true
    };

    const elements = {
        productList: null,
        searchInput: null,
        sortSelect: null,
        resultCount: null,
        heading: null,
        paginationContainer: null,
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
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function parsePrice(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        if (!value) return 0;
        const cleaned = String(value).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatPrice(value) {
        return CURRENCY_FORMATTER.format(parsePrice(value));
    }

    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function dispatchCustomEvent(name, detail = {}) {
        document.dispatchEvent(new CustomEvent(`prasun:${name}`, { detail, bubbles: true }));
    }

    /* =========================================================================
       PRODUCT DATA NORMALIZATION
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") return null;

        const rawId = item.id ?? item.productId ?? item.sku ?? `product-${index + 1}`;
        const id = String(rawId);
        const name = String(item.name ?? item.title ?? "Unnamed Product").trim();
        const category = String(item.category ?? "").trim();
        const description = String(item.description ?? "").trim();
        const brand = String(item.brand ?? item.vendor ?? "").trim();
        const tags = Array.isArray(item.tags) ? item.tags.join(" ") : String(item.tags ?? "");
        const price = parsePrice(item.price);
        const rating = parsePrice(item.rating);

        return {
            id,
            safeId: encodeURIComponent(id),
            name,
            price,
            image: String(item.image ?? item.imageUrl ?? item.thumbnail ?? "").trim(),
            category,
            normalizedCategory: normalize(category),
            description,
            brand,
            rating,
            // Pre-computed normalized index for lightning-fast token matching
            searchIndex: normalize(`${name} ${description} ${category} ${brand} ${tags}`)
        };
    }

    /* =========================================================================
       DATA FETCHING & CACHING
       ========================================================================= */

    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = CONFIG.FETCH_TIMEOUT_MS } = options;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(timer);
            return response;
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }

    async function loadProducts() {
        if (!elements.productList) return;

        state.isLoading = true;
        renderSkeletonState();

        try {
            let rawData = null;

            // 1. LocalStorage Retrieval
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
                    const list = Array.isArray(parsed) ? parsed : (parsed.products || parsed.data);
                    if (Array.isArray(list) && list.length > 0) {
                        state.allProducts = list.map(normalizeProduct).filter(Boolean);
                    }
                } catch (err) {
                    console.warn("[Prasun Shop] Invalid JSON payload in localStorage:", err);
                }
            }

            // 2. Network Endpoint Fallback
            if (!state.allProducts.length) {
                const response = await fetchWithTimeout(CONFIG.API_ENDPOINT);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                
                const json = await response.json();
                const list = Array.isArray(json) ? json : (json.products || json.data || []);
                if (Array.isArray(list)) {
                    state.allProducts = list.map(normalizeProduct).filter(Boolean);
                }
            }

            state.isLoading = false;

            if (!state.allProducts.length) {
                renderEmptyState();
                updateResultsCount(0);
                return;
            }

            readStateFromURL();
            applyFilters();
            dispatchCustomEvent("products-loaded", { total: state.allProducts.length });

        } catch (error) {
            state.isLoading = false;
            console.error("[Prasun Shop] Failed to initialize product catalog:", error);
            renderErrorState();
        }
    }

    /* =========================================================================
       URL & ROUTING SYNCHRONIZATION
       ========================================================================= */

    function readStateFromURL() {
        const params = new URLSearchParams(window.location.search);

        state.currentCategory = params.get("category")?.trim() || "";
        state.currentKeyword = params.get("q")?.trim() || "";
        state.currentSort = params.get("sort")?.trim() || "featured";
        
        const pageParam = parseInt(params.get("page"), 10);
        state.currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

        if (elements.searchInput) elements.searchInput.value = state.currentKeyword;
        if (elements.sortSelect) elements.sortSelect.value = state.currentSort;

        updateCategoryNavigation();
        updatePageHeading();
    }

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

        if (state.currentPage > 1) {
            url.searchParams.set("page", state.currentPage);
        } else {
            url.searchParams.delete("page");
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
            const active = selected ? category === selected : category === "";

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
       FILTER, SORT & PAGINATION LOGIC
       ========================================================================= */

    function applyFilters() {
        const cat = normalize(state.currentCategory);
        const rawKw = normalize(state.currentKeyword);
        const kwTokens = rawKw ? rawKw.split(/\s+/).filter(Boolean) : [];

        // 1. Filtering (Multi-token match + Category)
        state.filteredProducts = state.allProducts.filter(product => {
            if (cat && product.normalizedCategory !== cat) return false;
            if (kwTokens.length > 0) {
                return kwTokens.every(token => product.searchIndex.includes(token));
            }
            return true;
        });

        // 2. Sorting
        switch (state.currentSort) {
            case "price-asc":
                state.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case "price-desc":
                state.filteredProducts.sort((a, b) => b.price - a.price);
                break;
            case "rating":
                state.filteredProducts.sort((a, b) => b.rating - a.rating);
                break;
            case "name-asc":
                state.filteredProducts.sort((a, b) => NAME_COLLATOR.compare(a.name, b.name));
                break;
            case "name-desc":
                state.filteredProducts.sort((a, b) => NAME_COLLATOR.compare(b.name, a.name));
                break;
            default:
                break;
        }

        // 3. Clamp Bounds
        const totalPages = Math.ceil(state.filteredProducts.length / CONFIG.ITEMS_PER_PAGE) || 1;
        if (state.currentPage > totalPages) state.currentPage = totalPages;

        // 4. Batch Frame Rendering
        if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
        state.renderFrame = requestAnimationFrame(() => {
            renderPaginatedProducts();
            dispatchCustomEvent("filter-changed", {
                category: state.currentCategory,
                keyword: state.currentKeyword,
                sort: state.currentSort,
                resultsCount: state.filteredProducts.length
            });
        });
    }

    function renderPaginatedProducts() {
        if (!elements.productList) return;

        elements.productList.removeAttribute("aria-busy");
        updateResultsCount(state.filteredProducts.length);

        if (!state.filteredProducts.length) {
            renderEmptyState();
            renderPagination(0);
            return;
        }

        const startIndex = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
        const pageItems = state.filteredProducts.slice(startIndex, startIndex + CONFIG.ITEMS_PER_PAGE);

        elements.productList.innerHTML = pageItems.map((product, idx) => renderProductCard(product, idx)).join("");
        renderPagination(state.filteredProducts.length);
        
        dispatchCustomEvent("products-rendered", { page: state.currentPage, count: pageItems.length });
    }

    /* =========================================================================
       DOM CARD RENDERING (ACCESSIBLE & COMPLIANT HTML)
       ========================================================================= */

    function renderProductCard(product, index) {
        const image = product.image || CONFIG.FALLBACK_IMAGE;
        const isEager = index < CONFIG.EAGER_IMAGE_COUNT;
        const loadingAttr = isEager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';

        const categoryHTML = product.category
            ? `<span class="product-category">${escapeHTML(product.category)}</span>`
            : "";

        const ratingHTML = product.rating > 0
            ? `<span class="product-rating" aria-label="Rated ${product.rating} out of 5 stars">
                   ★ ${product.rating.toFixed(1)}
               </span>`
            : "";

        const brandHTML = product.brand
            ? `<span class="product-brand">${escapeHTML(product.brand)}</span>`
            : "";

        // Valid HTML structure: Interactive elements (<button> and <a>) are decoupled
        return `
            <article class="product-card" data-id="${product.safeId}">
                <div class="product-card-image">
                    <img 
                        src="${escapeHTML(image)}" 
                        alt="${escapeHTML(product.name)}" 
                        ${loadingAttr}
                    />
                    ${categoryHTML}
                </div>
                <div class="product-card-body">
                    ${(ratingHTML || brandHTML) ? `<div class="product-meta">${brandHTML}${ratingHTML}</div>` : ""}
                    <h3 class="product-title">
                        <a href="product.html?id=${product.safeId}" class="product-title-link">
                            ${escapeHTML(product.name)}
                        </a>
                    </h3>
                    ${product.description ? `<p class="product-description">${escapeHTML(product.description)}</p>` : ""}
                    <div class="product-bottom">
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <button type="button" class="product-add-btn" data-action="add-to-cart" data-id="${product.safeId}" aria-label="Add ${escapeHTML(product.name)} to cart">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    /* =========================================================================
       WINDOWED PAGINATION (Smart Ellipsis Logic)
       ========================================================================= */

    function renderPagination(totalItems) {
        if (!elements.paginationContainer) {
            elements.paginationContainer = $(".products-pagination");
        }

        if (!elements.paginationContainer) return;

        const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            elements.paginationContainer.innerHTML = "";
            elements.paginationContainer.style.display = "none";
            return;
        }

        elements.paginationContainer.style.display = "flex";
        let html = `<nav aria-label="Product pagination" class="pagination-nav">`;

        // Prev Button
        html += `<button type="button" class="pagination-btn prev" ${state.currentPage === 1 ? "disabled" : ""} data-page="${state.currentPage - 1}" aria-label="Previous Page">&laquo; Prev</button>`;

        // Smart Windowing Logic
        const maxButtons = CONFIG.MAX_PAGINATION_BUTTONS;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        // First Page + Ellipsis
        if (startPage > 1) {
            html += `<button type="button" class="pagination-btn number" data-page="1" aria-label="Page 1">1</button>`;
            if (startPage > 2) html += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
        }

        // Page Range
        for (let i = startPage; i <= endPage; i++) {
            const isCurrent = i === state.currentPage;
            html += `<button type="button" class="pagination-btn number ${isCurrent ? "active" : ""}" data-page="${i}" aria-current="${isCurrent ? "page" : "false"}" aria-label="Page ${i}">${i}</button>`;
        }

        // Last Page + Ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
            html += `<button type="button" class="pagination-btn number" data-page="${totalPages}" aria-label="Page ${totalPages}">${totalPages}</button>`;
        }

        // Next Button
        html += `<button type="button" class="pagination-btn next" ${state.currentPage === totalPages ? "disabled" : ""} data-page="${state.currentPage + 1}" aria-label="Next Page">Next &raquo;</button>`;
        html += `</nav>`;

        elements.paginationContainer.innerHTML = html;
    }

    /* =========================================================================
       EVENT DELEGATION & LISTENERS
       ========================================================================= */

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

    function cacheDOMElements() {
        elements.productList = $("#product-list");
        elements.searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        elements.sortSelect = $("#sortSelect") || $(".products-sort-select");
        elements.resultCount = $(".products-result-count");
        elements.heading = $("#products-heading") || $(".products-heading");
        elements.paginationContainer = $(".products-pagination");

        elements.categoryPills = $$(".category-pill, .products-categories a");
        elements.categoryPills.forEach(pill => {
            try {
                const href = pill.getAttribute("href") || "";
                if (href.startsWith("?") || href.includes("category=")) {
                    const url = new URL(href, window.location.href);
                    pill.dataset.category = normalize(url.searchParams.get("category") || "");
                } else if (pill.dataset.category) {
                    pill.dataset.category = normalize(pill.dataset.category);
                } else {
                    pill.dataset.category = normalize(pill.textContent.trim());
                }
            } catch {
                pill.dataset.category = "";
            }
        });
    }

    function initializeControls() {
        // Search handler
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", debounce(() => {
                state.currentKeyword = elements.searchInput.value.trim();
                state.currentPage = 1;
                syncStateToURL(true);
                applyFilters();
            }, CONFIG.DEBOUNCE_MS));
        }

        // Sort handler
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener("change", () => {
                state.currentSort = elements.sortSelect.value;
                state.currentPage = 1;
                syncStateToURL(true);
                applyFilters();
            });
        }

        // Delegated Document Click Handler
        document.addEventListener("click", (event) => {
            // 1. Add to Cart Button
            const addBtn = event.target.closest('[data-action="add-to-cart"]');
            if (addBtn) {
                event.preventDefault();
                event.stopPropagation();
                const productId = addBtn.dataset.id;
                const product = state.allProducts.find(p => p.safeId === productId);
                dispatchCustomEvent("cart-add", { productId, product });
                return;
            }

            // 2. Category Pill
            const pill = event.target.closest(".category-pill, .products-categories a");
            if (pill) {
                event.preventDefault();
                const targetCategory = pill.dataset.category || "";
                if (state.currentCategory === targetCategory) return;

                state.currentCategory = targetCategory;
                state.currentPage = 1;
                syncStateToURL(false);
                updateCategoryNavigation();
                updatePageHeading();
                applyFilters();
                return;
            }

            // 3. Pagination Button
            const pageBtn = event.target.closest(".pagination-btn");
            if (pageBtn && !pageBtn.disabled) {
                event.preventDefault();
                const newPage = parseInt(pageBtn.dataset.page, 10);
                if (newPage && newPage !== state.currentPage) {
                    state.currentPage = newPage;
                    syncStateToURL(false);
                    applyFilters();
                    
                    // Accessibility: Scroll and shift focus to top of list
                    elements.productList?.scrollIntoView({ behavior: "smooth", block: "start" });
                    elements.productList?.focus({ preventScroll: true });
                }
            }
        });

        // Global Shortcut: Cmd/Ctrl + K to focus search
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                const activeTag = document.activeElement?.tagName;
                if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

                if (elements.searchInput) {
                    event.preventDefault();
                    elements.searchInput.focus();
                    elements.searchInput.select();
                }
            }
        });

        // Browser History Popstate Support
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
       UI STATES (SKELETON, EMPTY & ERROR)
       ========================================================================= */

    function renderSkeletonState() {
        if (!elements.productList) return;

        elements.productList.setAttribute("aria-busy", "true");

        const skeletons = Array.from({ length: 6 }).map(() => `
            <div class="product-card skeleton-card" aria-hidden="true">
                <div class="skeleton-image"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line text"></div>
                    <div class="skeleton-line btn"></div>
                </div>
            </div>
        `).join("");

        elements.productList.innerHTML = skeletons;
    }

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
                <p>${hasFilters ? "Try adjusting your search query or active category filter." : "Products will appear here once stocked."}</p>
                ${hasFilters ? `<button type="button" class="products-empty-button" id="clear-product-filters">Clear All Filters</button>` : ""}
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
        state.currentPage = 1;

        if (elements.searchInput) elements.searchInput.value = "";
        if (elements.sortSelect) elements.sortSelect.value = "featured";

        syncStateToURL(true);
        updateCategoryNavigation();
        updatePageHeading();
        applyFilters();
    }

    /* =========================================================================
       BOOTSTRAP INITIALIZATION
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
