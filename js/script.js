/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY (PRODUCTION ENTERPRISE)
 * High-performance product listing, async fetch, fuzzy/token search,
 * dynamic pagination, event-driven architecture, and zero-CLS rendering.
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
        ITEMS_PER_PAGE: 12,
        EAGER_IMAGE_COUNT: 4, // Prevent LCP degradation on above-the-fold cards
        FALLBACK_IMAGE: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                <rect width="800" height="600" fill="#f4f4f5"/>
                <text x="400" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500">
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

    // Strips diacritics/accents and normalizes text for search
    function normalize(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    // Parses mixed numeric/string prices (e.g., "$29.99" -> 29.99)
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
       PRODUCT NORMALIZATION (Pre-computing Search Index)
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
            // Pre-computed normalized search index (title, description, category, brand, tags)
            searchIndex: normalize(`${name} ${description} ${category} ${brand} ${tags}`)
        };
    }

    /* =========================================================================
       DATA LOADING
       ========================================================================= */

    async function loadProducts() {
        if (!elements.productList) return;

        state.isLoading = true;
        renderSkeletonState();

        try {
            let rawData = null;

            // 1. Check LocalStorage Cache
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
                    console.warn("[Prasun Shop] Invalid JSON in localStorage:", err);
                }
            }

            // 2. Fallback to API Endpoint
            if (!state.allProducts.length) {
                const response = await fetch(CONFIG.API_ENDPOINT);
                if (response.ok) {
                    const json = await response.json();
                    const list = Array.isArray(json) ? json : (json.products || json.data || []);
                    if (Array.isArray(list)) {
                        state.allProducts = list.map(normalizeProduct).filter(Boolean);
                    }
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
       FILTER, SORT & PAGINATION ENGINE
       ========================================================================= */

    function applyFilters() {
        const cat = normalize(state.currentCategory);
        const rawKw = normalize(state.currentKeyword);
        const kwTokens = rawKw ? rawKw.split(/\s+/).filter(Boolean) : [];

        // Filter products using token matching & category comparison
        state.filteredProducts = state.allProducts.filter(p => {
            if (cat && p.normalizedCategory !== cat) return false;
            if (kwTokens.length > 0) {
                return kwTokens.every(token => p.searchIndex.includes(token));
            }
            return true;
        });

        // Fast sorting
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

        // Clamp pagination bounds
        const totalPages = Math.ceil(state.filteredProducts.length / CONFIG.ITEMS_PER_PAGE) || 1;
        if (state.currentPage > totalPages) state.currentPage = totalPages;

        // Schedule DOM batch update on frame
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
       PRODUCT RENDERING
       ========================================================================= */

    function renderProductCard(product, index) {
        const image = product.image || CONFIG.FALLBACK_IMAGE;
        // Prioritize first N images to optimize Largest Contentful Paint (LCP)
        const isEager = index < CONFIG.EAGER_IMAGE_COUNT;
        const loadingAttr = isEager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';

        const categoryHTML = product.category
            ? `<span class="product-category">${escapeHTML(product.category)}</span>`
            : "";

        const ratingHTML = product.rating > 0
            ? `<span class="product-rating" aria-label="Rating ${product.rating} out of 5">
                   ★ ${product.rating.toFixed(1)}
               </span>`
            : "";

        const brandHTML = product.brand
            ? `<span class="product-brand">${escapeHTML(product.brand)}</span>`
            : "";

        return `
            <article class="product-card" data-id="${product.safeId}">
                <a class="product-card-link" href="product.html?id=${product.safeId}" aria-label="View ${escapeHTML(product.name)}">
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
                        <h3 class="product-title">${escapeHTML(product.name)}</h3>
                        ${product.description ? `<p class="product-description">${escapeHTML(product.description)}</p>` : ""}
                        <div class="product-bottom">
                            <p class="product-price">${formatPrice(product.price)}</p>
                            <button type="button" class="product-add-btn" data-action="add-to-cart" data-id="${product.safeId}" aria-label="Add ${escapeHTML(product.name)} to cart">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </a>
            </article>
        `;
    }

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

        // Previous Button
        html += `<button type="button" class="pagination-btn prev" ${state.currentPage === 1 ? "disabled" : ""} data-page="${state.currentPage - 1}" aria-label="Previous Page">&laquo; Prev</button>`;

        // Page Number Buttons
        for (let i = 1; i <= totalPages; i++) {
            const isCurrent = i === state.currentPage;
            html += `<button type="button" class="pagination-btn number ${isCurrent ? "active" : ""}" data-page="${i}" aria-current="${isCurrent ? "page" : "false"}">${i}</button>`;
        }

        // Next Button
        html += `<button type="button" class="pagination-btn next" ${state.currentPage === totalPages ? "disabled" : ""} data-page="${state.currentPage + 1}" aria-label="Next Page">Next &raquo;</button>`;
        html += `</nav>`;

        elements.paginationContainer.innerHTML = html;
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
       CONTROLS & DELEGATED EVENTS
       ========================================================================= */

    function cacheDOMElements() {
        elements.productList = $("#product-list");
        elements.searchInput = $("#searchInput") || $(".search-input") || $(".products-search-input");
        elements.sortSelect = $("#sortSelect") || $(".products-sort-select");
        elements.resultCount = $(".products-result-count");
        elements.heading = $("#products-heading") || $(".products-heading");
        elements.paginationContainer = $(".products-pagination");

        // Dynamic category pill parsing
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
        // Search Input handler with debouncing
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", debounce(() => {
                state.currentKeyword = elements.searchInput.value.trim();
                state.currentPage = 1;
                syncStateToURL(true);
                applyFilters();
            }, CONFIG.DEBOUNCE_MS));
        }

        // Sort Select Dropdown handler
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener("change", () => {
                state.currentSort = elements.sortSelect.value;
                state.currentPage = 1;
                syncStateToURL(true);
                applyFilters();
            });
        }

        // Delegated Click Listener (Handles Category Pills, Pagination & Add-to-Cart)
        document.addEventListener("click", (event) => {
            // 1. Add to Cart Button Click
            const addBtn = event.target.closest('[data-action="add-to-cart"]');
            if (addBtn) {
                event.preventDefault();
                event.stopPropagation();
                const productId = addBtn.dataset.id;
                const product = state.allProducts.find(p => p.safeId === productId);
                dispatchCustomEvent("cart-add", { productId, product });
                return;
            }

            // 2. Category Pill Click
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

            // 3. Pagination Button Click
            const pageBtn = event.target.closest(".pagination-btn");
            if (pageBtn && !pageBtn.disabled) {
                event.preventDefault();
                const newPage = parseInt(pageBtn.dataset.page, 10);
                if (newPage && newPage !== state.currentPage) {
                    state.currentPage = newPage;
                    syncStateToURL(false);
                    applyFilters();
                    elements.productList?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        });

        // Global Shortcut (Cmd/Ctrl + K to focus search)
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
       SKELETON, EMPTY & ERROR STATES
       ========================================================================= */

    function renderSkeletonState() {
        if (!elements.productList) return;

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
