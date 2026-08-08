```javascript
/**
 * Prasun Shop — Products & Interactivity
 * Modern, dependency-free frontend module
 */

"use strict";

(() => {
    /* =========================================================
       STATE
    ========================================================= */

    const state = {
        products: [],
        category: "",
        keyword: "",
        loading: true
    };

    /* =========================================================
       DOM
    ========================================================= */

    const dom = {
        grid: null,
        search: null,
        categoryNav: null
    };

    /* =========================================================
       CONFIG
    ========================================================= */

    const CONFIG = {
        productsUrl: "data/products.json",
        productPage: "product.html",
        currency: "USD",
        locale: "en-US"
    };

    /* =========================================================
       UTILITIES
    ========================================================= */

    const escapeHTML = (value) => {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const formatPrice = (price) => {
        const value = Number(price);

        if (!Number.isFinite(value)) {
            return "$0.00";
        }

        return new Intl.NumberFormat(CONFIG.locale, {
            style: "currency",
            currency: CONFIG.currency
        }).format(value);
    };

    const normalize = (value) => {
        return String(value ?? "")
            .toLowerCase()
            .trim();
    };

    const capitalize = (value) => {
        if (!value) return "";

        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const getURLParams = () => {
        const params = new URLSearchParams(window.location.search);

        return {
            category: normalize(params.get("category")),
            keyword: normalize(
                params.get("search") ||
                params.get("q") ||
                ""
            )
        };
    };

    /* =========================================================
       IMAGE FALLBACK
       ========================================================= */

    const IMAGE_FALLBACK = `
        data:image/svg+xml;charset=UTF-8,
        <svg xmlns="http://www.w3.org/2000/svg"
             width="600"
             height="600"
             viewBox="0 0 600 600">
            <rect width="600" height="600" fill="#f4f4f5"/>
            <text x="50%"
                  y="50%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  fill="#a1a1aa"
                  font-family="Arial,sans-serif"
                  font-size="22">
                No Image
            </text>
        </svg>
    `.replace(/\s+/g, " ");

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    const init = () => {
        dom.grid = document.querySelector("[data-product-grid]") ||
                   document.getElementById("product-list");

        dom.search = document.querySelector("[data-product-search]") ||
                     document.querySelector(".search-input");

        dom.categoryNav = document.querySelector("[data-category-nav]");

        if (!dom.grid) {
            console.warn("Prasun Shop: Product grid not found.");
            return;
        }

        const urlState = getURLParams();

        state.category = urlState.category;
        state.keyword = urlState.keyword;

        initializeSearch();
        initializeKeyboardShortcut();
        initializeNavigation();
        initializeCategoryNavigation();
        initializeImageFallback();

        loadProducts();
    };

    /* =========================================================
       PRODUCT LOADING
       ========================================================= */

    const loadProducts = async () => {
        state.loading = true;

        renderLoading();

        try {
            const response = await fetch(CONFIG.productsUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                cache: "no-cache"
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to load products: HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error(
                    "Invalid products.json format. Expected an array."
                );
            }

            state.products = data
                .map(normalizeProduct)
                .filter(product => product.id);

            state.loading = false;

            syncSearchInput();
            updateCategoryNavigation();
            updatePageHeading();
            applyFilters();

        } catch (error) {
            state.loading = false;

            console.error(
                "Prasun Shop: Product loading failed.",
                error
            );

            renderError();
        }
    };

    /* =========================================================
       PRODUCT NORMALIZATION
       ========================================================= */

    const normalizeProduct = (product = {}) => {
        return {
            id: String(product.id ?? "").trim(),

            name: String(
                product.name ?? "Unnamed Product"
            ).trim(),

            price: Number(product.price) || 0,

            image: String(
                product.image ?? ""
            ).trim(),

            category: String(
                product.category ?? ""
            ).trim(),

            rating: String(
                product.rating ?? "5.0"
            ).trim(),

            description: String(
                product.description ?? ""
            ).trim()
        };
    };

    /* =========================================================
       FILTERING
       ========================================================= */

    const applyFilters = () => {
        let products = [...state.products];

        if (state.category) {
            products = products.filter(product =>
                normalize(product.category) === state.category
            );
        }

        if (state.keyword) {
            const keyword = state.keyword;

            products = products.filter(product => {
                const searchableText = [
                    product.name,
                    product.description,
                    product.category
                ]
                    .map(normalize)
                    .join(" ");

                return searchableText.includes(keyword);
            });
        }

        renderProducts(products);
    };

    /* =========================================================
       PRODUCT RENDERING
       ========================================================= */

    const renderProducts = (products) => {
        if (!dom.grid) return;

        if (!products.length) {
            renderEmptyState();
            return;
        }

        dom.grid.innerHTML = products
            .map(renderProductCard)
            .join("");
    };

    const renderProductCard = (product) => {
        const id = encodeURIComponent(product.id);

        const name = escapeHTML(product.name);
        const image = escapeHTML(
            product.image || IMAGE_FALLBACK
        );
        const category = escapeHTML(product.category);
        const rating = escapeHTML(product.rating);
        const description = escapeHTML(product.description);

        return `
            <article
                class="group bg-white rounded-2xl border border-zinc-200/80
                       overflow-hidden shadow-xs hover:shadow-md
                       transition-all duration-300 flex flex-col"
                data-product-card
                data-product-id="${id}"
            >

                <!-- Product Image -->
                <a
                    href="${CONFIG.productPage}?id=${id}"
                    class="block aspect-square bg-zinc-100 overflow-hidden relative"
                    aria-label="View ${name}"
                >

                    <img
                        src="${image}"
                        alt="${name}"
                        class="w-full h-full object-cover
                               group-hover:scale-105
                               transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                    >

                    ${
                        category
                            ? `
                                <span
                                    class="absolute top-3 left-3
                                           bg-white/90 backdrop-blur-md
                                           px-2.5 py-1 text-[11px]
                                           font-semibold text-zinc-800
                                           rounded-full shadow-xs"
                                >
                                    ${category}
                                </span>
                              `
                            : ""
                    }

                </a>

                <!-- Product Information -->
                <div class="p-5 flex flex-col flex-grow">

                    <!-- Rating / Stock -->
                    <div
                        class="flex items-center justify-between
                               text-xs text-zinc-500 mb-2"
                    >

                        <span
                            class="flex items-center gap-1
                                   font-medium text-amber-500"
                            aria-label="Rating ${rating} out of 5"
                        >
                            <span aria-hidden="true">★</span>
                            <span class="text-zinc-700">
                                ${rating}
                            </span>
                        </span>

                        <span
                            class="inline-flex items-center gap-1.5
                                   text-emerald-600
                                   font-medium text-[11px]"
                        >
                            <span
                                class="w-1.5 h-1.5 rounded-full
                                       bg-emerald-500"
                                aria-hidden="true"
                            ></span>

                            In Stock
                        </span>

                    </div>

                    <!-- Product Name -->
                    <h3
                        class="text-base font-semibold text-zinc-900
                               group-hover:text-zinc-600
                               transition-colors line-clamp-1 mb-1"
                    >
                        ${name}
                    </h3>

                    <!-- Description -->
                    <p
                        class="text-xs text-zinc-500 line-clamp-2
                               mb-4 flex-grow"
                    >
                        ${description}
                    </p>

                    <!-- Price / Action -->
                    <div
                        class="flex items-center justify-between
                               pt-4 border-t border-zinc-100
                               mt-auto"
                    >

                        <span
                            class="text-lg font-bold text-zinc-900"
                        >
                            ${formatPrice(product.price)}
                        </span>

                        <a
                            href="${CONFIG.productPage}?id=${id}"
                            class="inline-flex items-center
                                   justify-center px-4 py-2
                                   text-xs font-semibold
                                   text-white bg-zinc-900
                                   hover:bg-zinc-800
                                   active:scale-95
                                   rounded-xl transition-all
                                   shadow-xs
                                   focus-visible:outline-none
                                   focus-visible:ring-2
                                   focus-visible:ring-zinc-900"
                        >
                            View Details
                        </a>

                    </div>

                </div>

            </article>
        `;
    };

    /* =========================================================
       LOADING STATE
       ========================================================= */

    const renderLoading = () => {
        if (!dom.grid) return;

        dom.grid.innerHTML = `
            <div
                class="col-span-full py-20 text-center"
                role="status"
                aria-live="polite"
            >
                <div
                    class="mx-auto mb-4 w-8 h-8
                           border-2 border-zinc-200
                           border-t-zinc-900
                           rounded-full animate-spin"
                    aria-hidden="true"
                ></div>

                <p class="text-sm font-medium text-zinc-500">
                    Loading products...
                </p>
            </div>
        `;
    };

    /* =========================================================
       EMPTY STATE
       ========================================================= */

    const renderEmptyState = () => {
        if (!dom.grid) return;

        const hasSearch = Boolean(state.keyword);
        const hasCategory = Boolean(state.category);

        let title = "No products found";
        let message =
            "Try adjusting your search or category.";

        if (hasSearch && hasCategory) {
            message =
                `No products match "${escapeHTML(state.keyword)}" in this category.`;
        } else if (hasSearch) {
            message =
                `No products match "${escapeHTML(state.keyword)}".`;
        } else if (hasCategory) {
            message =
                `There are currently no products in this category.`;
        }

        dom.grid.innerHTML = `
            <div
                class="col-span-full py-20 text-center"
                role="status"
            >

                <div
                    class="mx-auto mb-4 flex items-center
                           justify-center w-12 h-12
                           rounded-2xl bg-zinc-100
                           text-zinc-400"
                    aria-hidden="true"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-4-4"></path>
                    </svg>
                </div>

                <h3
                    class="text-base font-semibold
                           text-zinc-900 mb-1"
                >
                    ${title}
                </h3>

                <p
                    class="text-sm text-zinc-500 max-w-sm
                           mx-auto"
                >
                    ${message}
                </p>

                ${
                    hasSearch || hasCategory
                        ? `
                            <button
                                type="button"
                                data-clear-filters
                                class="mt-5 inline-flex items-center
                                       justify-center px-4 py-2
                                       text-xs font-semibold
                                       text-white bg-zinc-900
                                       hover:bg-zinc-800
                                       rounded-xl transition-all"
                            >
                                Clear Filters
                            </button>
                          `
                        : ""
                }

            </div>
        `;
    };

    /* =========================================================
       ERROR STATE
       ========================================================= */

    const renderError = () => {
        if (!dom.grid) return;

        dom.grid.innerHTML = `
            <div
                class="col-span-full py-20 text-center"
                role="alert"
            >

                <div
                    class="mx-auto mb-4 flex items-center
                           justify-center w-12 h-12
                           rounded-2xl bg-red-50
                           text-red-500"
                    aria-hidden="true"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M12 8v4"></path>
                        <path d="M12 16h.01"></path>
                    </svg>
                </div>

                <h3
                    class="text-base font-semibold
                           text-zinc-900 mb-1"
                >
                    Products unavailable
                </h3>

                <p
                    class="text-sm text-zinc-500
                           max-w-sm mx-auto mb-5"
                >
                    We couldn't load the product catalog.
                    Please try again.
                </p>

                <button
                    type="button"
                    data-retry-products
                    class="inline-flex items-center
                           justify-center px-4 py-2
                           text-xs font-semibold
                           text-white bg-zinc-900
                           hover:bg-zinc-800
                           rounded-xl transition-all"
                >
                    Try Again
                </button>

            </div>
        `;
    };

    /* =========================================================
       SEARCH
       ========================================================= */

    const initializeSearch = () => {
        if (!dom.search) return;

        dom.search.addEventListener("input", () => {
            state.keyword = normalize(dom.search.value);

            updateURL();
            applyFilters();
        });

        dom.search.addEventListener("search", () => {
            state.keyword = normalize(dom.search.value);

            updateURL();
            applyFilters();
        });
    };

    const syncSearchInput = () => {
        if (!dom.search) return;

        dom.search.value = state.keyword;
    };

    /* =========================================================
       KEYBOARD SHORTCUT
       ========================================================= */

    const initializeKeyboardShortcut = () => {
        if (!dom.search) return;

        document.addEventListener("keydown", event => {
            const isSearchShortcut =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k";

            if (!isSearchShortcut) return;

            event.preventDefault();

            dom.search.focus();
            dom.search.select();
        });
    };

    /* =========================================================
       CATEGORY NAVIGATION
       ========================================================= */

    const initializeCategoryNavigation = () => {
        const nav = dom.categoryNav ||
            document.querySelector(
                '[data-category-nav], nav'
            );

        if (!nav) return;

        nav.addEventListener("click", event => {
            const link = event.target.closest("a");

            if (!link) return;

            const href = link.getAttribute("href");

            if (!href || href === "#") return;

            const url = new URL(
                href,
                window.location.href
            );

            const category =
                normalize(
                    url.searchParams.get("category")
                );

            if (!category) return;

            event.preventDefault();

            state.category = category;

            updateURL();
            updateCategoryNavigation();
            updatePageHeading();
            applyFilters();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    };

    const updateCategoryNavigation = () => {
        const nav = dom.categoryNav ||
            document.querySelector("[data-category-nav]");

        if (!nav) return;

        nav.querySelectorAll("a").forEach(link => {
            const href =
                link.getAttribute("href") || "";

            let linkCategory = "";

            try {
                const url = new URL(
                    href,
                    window.location.href
                );

                linkCategory =
                    normalize(
                        url.searchParams.get("category")
                    );
            } catch {
                linkCategory = "";
            }

            const isActive =
                state.category &&
                linkCategory === state.category;

            link.classList.toggle(
                "bg-zinc-900",
                Boolean(isActive)
            );

            link.classList.toggle(
                "text-white",
                Boolean(isActive)
            );

            link.classList.toggle(
                "font-semibold",
                Boolean(isActive)
            );

            link.classList.toggle(
                "bg-zinc-100",
                !isActive
            );

            link.classList.toggle(
                "text-zinc-700",
                !isActive
            );

            link.classList.toggle(
                "font-medium",
                !isActive
            );

            link.setAttribute(
                "aria-current",
                isActive ? "page" : "false"
            );
        });
    };

    /* =========================================================
       PAGE HEADING
       ========================================================= */

    const updatePageHeading = () => {
        if (!state.category) return;

        const heading =
            document.querySelector(
                "[data-page-title]"
            ) ||
            document.querySelector("h1");

        if (!heading) return;

        heading.textContent =
            capitalize(state.category);
    };

    /* =========================================================
       URL STATE
       ========================================================= */

    const updateURL = () => {
        const url =
            new URL(window.location.href);

        if (state.category) {
            url.searchParams.set(
                "category",
                state.category
            );
        } else {
            url.searchParams.delete("category");
        }

        if (state.keyword) {
            url.searchParams.set(
                "search",
                state.keyword
            );
        } else {
            url.searchParams.delete("search");
        }

        window.history.replaceState(
            {},
            "",
            url
        );
    };

    /* =========================================================
       GLOBAL NAVIGATION
       ========================================================= */

    const initializeNavigation = () => {
        document.addEventListener("click", event => {

            /*
             * Clear filters
             */
            const clearButton =
                event.target.closest(
                    "[data-clear-filters]"
                );

            if (clearButton) {
                event.preventDefault();

                state.category = "";
                state.keyword = "";

                syncSearchInput();
                updateURL();
                updateCategoryNavigation();
                applyFilters();

                return;
            }

            /*
             * Retry loading products
             */
            const retryButton =
                event.target.closest(
                    "[data-retry-products]"
                );

            if (retryButton) {
                event.preventDefault();

                loadProducts();

                return;
            }

            /*
             * Smooth scrolling
             */
            const link =
                event.target.closest(
                    'a[href^="#"]'
                );

            if (!link) return;

            const href =
                link.getAttribute("href");

            if (!href || href === "#") return;

            const target =
                document.querySelector(href);

            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    };

    /* =========================================================
       IMAGE ERROR HANDLING
       ========================================================= */

    const initializeImageFallback = () => {
        if (!dom.grid) return;

        dom.grid.addEventListener(
            "error",
            event => {
                const image = event.target;

                if (
                    !(image instanceof HTMLImageElement)
                ) {
                    return;
                }

                if (
                    image.dataset.fallbackApplied
                ) {
                    return;
                }

                image.dataset.fallbackApplied =
                    "true";

                image.src = IMAGE_FALLBACK;
            },
            true
        );
    };

    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }

})();
```
