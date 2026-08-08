/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS & INTERACTIVITY
 * Production-ready product listing, search, filtering and rendering.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       STATE
       ========================================================================= */

    let allProducts = [];
    let currentCategory = "";
    let currentKeyword = "";
    let searchTimer = null;

    const PRODUCT_STORAGE_KEYS = [
        "products",
        "prasun_products"
    ];

    /* =========================================================================
       DOM HELPERS
       ========================================================================= */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    /* =========================================================================
       UTILITIES
       ========================================================================= */

    function escapeHTML(value) {
        if (value === null || value === undefined) {
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

        if (!Number.isFinite(price)) {
            return "$0.00";
        }

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    function createFallbackImage() {
        return [
            "data:image/svg+xml;charset=UTF-8,",
            encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg"
                     width="800"
                     height="600"
                     viewBox="0 0 800 600">
                    <rect width="800" height="600" fill="#f4f4f5"/>
                    <text
                        x="400"
                        y="300"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="#a1a1aa"
                        font-family="Arial, sans-serif"
                        font-size="24">
                        Image unavailable
                    </text>
                </svg>
            `)
        ].join("");
    }

    /* =========================================================================
       PRODUCT NORMALIZATION
       ========================================================================= */

    function normalizeProduct(item, index) {
        if (!item || typeof item !== "object") {
            return null;
        }

        const id =
            item.id ??
            item.productId ??
            `product-${index + 1}`;

        const name =
            item.name ??
            item.title ??
            "Unnamed Product";

        const price =
            Number(item.price ?? 0);

        const image =
            item.image ??
            item.imageUrl ??
            item.thumbnail ??
            "";

        const category =
            item.category ??
            "";

        const description =
            item.description ??
            "";

        const rating =
            item.rating ??
            "";

        return {
            id: String(id),
            name: String(name).trim() || "Unnamed Product",
            price: Number.isFinite(price) ? price : 0,
            image: String(image).trim(),
            category: String(category).trim(),
            description: String(description).trim(),
            rating: String(rating).trim()
        };
    }

    /* =========================================================================
       LOAD PRODUCTS
       ========================================================================= */

    function loadProducts() {
        const productList = $("#product-list");

        if (!productList) {
            return;
        }

        try {
            let storedProducts = null;

            for (const key of PRODUCT_STORAGE_KEYS) {
                const value = localStorage.getItem(key);

                if (value) {
                    storedProducts = value;
                    break;
                }
            }

            if (!storedProducts) {
                allProducts = [];
                renderEmptyState();
                updateResultsCount(0);
                return;
            }

            const parsed = JSON.parse(storedProducts);

            if (!Array.isArray(parsed)) {
                throw new Error("Product data must be an array.");
            }

            allProducts = parsed
                .map(normalizeProduct)
                .filter(Boolean);

            readCategoryFromURL();
            applyFilters();

        } catch (error) {
            console.error(
                "[Prasun Shop] Unable to load products:",
                error
            );

            renderErrorState();
        }
    }

    /* =========================================================================
       URL / CATEGORY
       ========================================================================= */

    function readCategoryFromURL() {
        const params = new URLSearchParams(
            window.location.search
        );

        currentCategory =
            params.get("category")?.trim() || "";

        updateCategoryNavigation();
        updatePageHeading();
    }

    function updateCategoryNavigation() {
        const pills = $$(
            ".category-pill, .products-categories a"
        );

        if (!pills.length) {
            return;
        }

        const selected = normalize(currentCategory);

        pills.forEach(pill => {
            const href =
                pill.getAttribute("href") || "";

            let category = "";

            try {
                const url = new URL(
                    href,
                    window.location.href
                );

                category =
                    url.searchParams.get("category") || "";
            } catch {
                category = "";
            }

            const active =
                selected &&
                normalize(category) === selected;

            pill.classList.toggle(
                "active",
                Boolean(active)
            );

            pill.setAttribute(
                "aria-current",
                active ? "page" : "false"
            );
        });
    }

    function updatePageHeading() {
        if (!currentCategory) {
            return;
        }

        const heading =
            $("#products-heading") ||
            $(".products-heading");

        if (!heading) {
            return;
        }

        heading.textContent =
            currentCategory;
    }

    /* =========================================================================
       SEARCH
       ========================================================================= */

    function initializeSearch() {
        const searchInput =
            $("#searchInput") ||
            $(".search-input") ||
            $(".products-search-input");

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener(
            "input",
            () => {
                clearTimeout(searchTimer);

                searchTimer = setTimeout(() => {
                    currentKeyword =
                        searchInput.value
                            .trim()
                            .toLowerCase();

                    applyFilters();
                }, 120);
            }
        );

        const initialValue =
            searchInput.value.trim();

        if (initialValue) {
            currentKeyword =
                initialValue.toLowerCase();
        }

        initializeSearchShortcut(
            searchInput
        );
    }

    function initializeSearchShortcut(
        searchInput
    ) {
        document.addEventListener(
            "keydown",
            event => {
                if (
                    (event.metaKey ||
                        event.ctrlKey) &&
                    event.key.toLowerCase() === "k"
                ) {
                    event.preventDefault();

                    searchInput.focus();
                    searchInput.select();
                }
            }
        );
    }

    /* =========================================================================
       FILTER ENGINE
       ========================================================================= */

    function applyFilters() {
        let filtered =
            [...allProducts];

        if (currentCategory) {
            const category =
                normalize(currentCategory);

            filtered =
                filtered.filter(product =>
                    normalize(product.category) ===
                    category
                );
        }

        if (currentKeyword) {
            const keyword =
                normalize(currentKeyword);

            filtered =
                filtered.filter(product => {
                    const searchableText = [
                        product.name,
                        product.description,
                        product.category
                    ]
                        .map(normalize)
                        .join(" ");

                    return searchableText.includes(
                        keyword
                    );
                });
        }

        renderProducts(filtered);
    }

    /* =========================================================================
       PRODUCT RENDERING
       ========================================================================= */

    function renderProducts(products) {
        const productList =
            $("#product-list");

        if (!productList) {
            return;
        }

        updateResultsCount(
            products.length
        );

        if (
            !Array.isArray(products) ||
            products.length === 0
        ) {
            renderEmptyState();
            return;
        }

        productList.innerHTML =
            products
                .map(renderProductCard)
                .join("");

        initializeProductImages(
            productList
        );
    }

    function renderProductCard(product) {
        const safeId =
            encodeURIComponent(product.id);

        const image =
            product.image ||
            createFallbackImage();

        const category =
            product.category
                ? `
                    <span class="product-category">
                        ${escapeHTML(product.category)}
                    </span>
                `
                : "";

        const rating =
            product.rating
                ? `
                    <span class="product-rating"
                          aria-label="Rating ${escapeHTML(product.rating)} out of 5">
                        ★ ${escapeHTML(product.rating)}
                    </span>
                `
                : "";

        return `
            <article class="product-card">

                <a
                    class="product-card-link"
                    href="product.html?id=${safeId}"
                    aria-label="View ${escapeHTML(product.name)}"
                >

                    <div class="product-card-image">

                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(product.name)}"
                            loading="lazy"
                            decoding="async"
                        >

                        ${category}

                    </div>

                    <div class="product-card-body">

                        ${
                            rating
                                ? `
                                    <div class="product-meta">
                                        ${rating}
                                    </div>
                                `
                                : ""
                        }

                        <h3 class="product-title">
                            ${escapeHTML(product.name)}
                        </h3>

                        ${
                            product.description
                                ? `
                                    <p class="product-description">
                                        ${escapeHTML(
                                            product.description
                                        )}
                                    </p>
                                `
                                : ""
                        }

                        <div class="product-bottom">

                            <p class="product-price">
                                ${formatPrice(
                                    product.price
                                )}
                            </p>

                            <span class="product-view-button">
                                View Details
                            </span>

                        </div>

                    </div>

                </a>

            </article>
        `;
    }

    /* =========================================================================
       IMAGE HANDLING
       ========================================================================= */

    function initializeProductImages(
        container
    ) {
        const images =
            $$(
                ".product-card-image img",
                container
            );

        images.forEach(image => {
            image.addEventListener(
                "error",
                () => {
                    image.src =
                        createFallbackImage();

                    image.classList.add(
                        "is-fallback"
                    );

                    const wrapper =
                        image.closest(
                            ".product-card-image"
                        );

                    wrapper?.classList.add(
                        "image-error"
                    );
                },
                { once: true }
            );
        });
    }

    /* =========================================================================
       RESULTS COUNT
       ========================================================================= */

    function updateResultsCount(
        count
    ) {
        const resultCount =
            $(
                ".products-result-count"
            );

        if (!resultCount) {
            return;
        }

        if (count === 0) {
            resultCount.textContent =
                "No products";
            return;
        }

        resultCount.textContent =
            `${count} ${
                count === 1
                    ? "product"
                    : "products"
            }`;
    }

    /* =========================================================================
       EMPTY / ERROR STATES
       ========================================================================= */

    function renderEmptyState() {
        const productList =
            $("#product-list");

        if (!productList) {
            return;
        }

        const hasFilters =
            Boolean(
                currentCategory ||
                currentKeyword
            );

        productList.innerHTML = `
            <div class="products-empty">

                <div
                    class="products-empty-icon"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                        />
                        <path d="m20 20-4-4"/>
                    </svg>
                </div>

                <h2>
                    ${
                        hasFilters
                            ? "No products found"
                            : "No products available"
                    }
                </h2>

                <p>
                    ${
                        hasFilters
                            ? "Try a different search or category."
                            : "Products will appear here when they are available."
                    }
                </p>

                ${
                    hasFilters
                        ? `
                            <button
                                type="button"
                                class="products-empty-button"
                                id="clear-product-filters"
                            >
                                Clear Filters
                            </button>
                        `
                        : ""
                }

            </div>
        `;

        const clearButton =
            $("#clear-product-filters");

        clearButton?.addEventListener(
            "click",
            clearFilters
        );
    }

    function renderErrorState() {
        const productList =
            $("#product-list");

        if (!productList) {
            return;
        }

        productList.innerHTML = `
            <div class="products-error">

                <div
                    class="products-empty-icon"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />
                        <path d="M12 8v4"/>
                        <path d="M12 16h.01"/>
                    </svg>
                </div>

                <h2>
                    Unable to load products
                </h2>

                <p>
                    Please refresh the page and try again.
                </p>

                <button
                    type="button"
                    class="products-empty-button"
                    id="retry-products"
                >
                    Try Again
                </button>

            </div>
        `;

        $("#retry-products")?.addEventListener(
            "click",
            loadProducts
        );
    }

    /* =========================================================================
       CLEAR FILTERS
       ========================================================================= */

    function clearFilters() {
        currentCategory = "";
        currentKeyword = "";

        const searchInput =
            $("#searchInput") ||
            $(".search-input") ||
            $(".products-search-input");

        if (searchInput) {
            searchInput.value = "";
        }

        updateCategoryNavigation();

        const url =
            new URL(window.location.href);

        url.searchParams.delete(
            "category"
        );

        window.history.replaceState(
            {},
            "",
            url
        );

        updatePageHeading();
        applyFilters();
    }

    /* =========================================================================
       CATEGORY LINKS
       ========================================================================= */

    function initializeCategoryLinks() {
        const links =
            $$(
                ".category-pill, .category-card"
            );

        links.forEach(link => {
            link.addEventListener(
                "click",
                () => {
                    /*
                     * Let the browser handle normal
                     * navigation. This only clears
                     * transient search state.
                     */

                    currentKeyword = "";
                }
            );
        });
    }

    /* =========================================================================
       SMOOTH ANCHOR SCROLL
       ========================================================================= */

    function initializeSmoothScrolling() {
        $$('a[href^="#"]').forEach(link => {
            link.addEventListener(
                "click",
                event => {
                    const href =
                        link.getAttribute(
                            "href"
                        );

                    if (
                        !href ||
                        href === "#"
                    ) {
                        return;
                    }

                    const target =
                        document.querySelector(
                            href
                        );

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            );
        });
    }

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    function initialize() {
        initializeSearch();
        initializeCategoryLinks();
        initializeSmoothScrolling();
        loadProducts();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

})();
