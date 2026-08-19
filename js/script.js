/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS
 * ============================================================================
 *
 * API:
 *     /api/products
 *     /api/products?keyword=lamp
 *
 * Product details:
 *     product.html?id=001
 *
 * Cart:
 *     prasun_cart
 * ============================================================================
 */

"use strict";

(() => {

    const API_ENDPOINT = "/api/products";
    const CART_KEY = "prasun_cart";
    const CART_EVENT = "prasunCartUpdated";

    const container =
        document.getElementById("product-list");

    if (!container) {
        return;
    }


    const searchInput =
        document.getElementById("product-search");

    const sortSelect =
        document.getElementById("product-sort");

    const categoryContainer =
        document.getElementById("products-categories");

    const resultCount =
        document.getElementById("products-result-count");

    const cartCount =
        document.getElementById("cart-count");


    let allProducts = [];
    let activeCategory = "All";
    let currentSearch = "";

    let searchTimer = null;


    /* ========================================================================
       CURRENCY
       ======================================================================== */

    const currencyFormatter =
        new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );


    function formatPrice(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }


    /* ========================================================================
       ESCAPE
       ======================================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ========================================================================
       IMAGE FALLBACK
       ======================================================================== */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="600"
                height="600"
                viewBox="0 0 600 600"
            >
                <rect
                    width="600"
                    height="600"
                    fill="#f4f4f5"
                />

                <text
                    x="300"
                    y="300"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#a1a1aa"
                    font-family="Arial, sans-serif"
                    font-size="24"
                >
                    Image unavailable
                </text>
            </svg>
        `);


    /* ========================================================================
       NORMALIZE PRODUCT
       ======================================================================== */

    function normalizeProduct(product) {

        if (!product) {
            return null;
        }

        const id =
            product.id ??
            product.pid ??
            product.productId;

        if (
            id === undefined ||
            id === null ||
            String(id).trim() === ""
        ) {
            return null;
        }


        const price =
            Number(
                product.price ??
                product.sellPrice ??
                product.startSellPrice ??
                0
            );


        const rating =
            Number(
                product.rating ??
                5
            );


        return {

            id:
                String(id),

            sku:
                String(
                    product.sku ??
                    product.productSku ??
                    id
                ),

            name:
                String(
                    product.name ??
                    product.nameEn ??
                    product.productNameEn ??
                    product.productName ??
                    "Product"
                ),

            category:
                String(
                    product.category ??
                    product.categoryName ??
                    "General"
                ),

            price:
                Number.isFinite(price)
                    ? price
                    : 0,

            rating:
                Number.isFinite(rating)
                    ? rating
                    : 5,

            image:
                String(
                    product.image ??
                    product.bigImage ??
                    product.productImage ??
                    ""
                ),

            description:
                String(
                    product.description ??
                    ""
                )
        };
    }


    /* ========================================================================
       CART
       ======================================================================== */

    function readCart() {

        try {

            const raw =
                localStorage.getItem(
                    CART_KEY
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch {

            return [];
        }
    }


    function updateCartCount() {

        if (!cartCount) {
            return;
        }

        const cart =
            readCart();


        const total =
            cart.reduce(
                (sum, item) => {

                    const quantity =
                        Number(item?.quantity);

                    return sum +
                        (
                            Number.isFinite(quantity) &&
                            quantity > 0
                                ? Math.floor(quantity)
                                : 1
                        );

                },
                0
            );


        cartCount.textContent =
            String(total);

        cartCount.hidden =
            total === 0;


        const link =
            cartCount.closest("a");


        if (link) {

            link.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    /* ========================================================================
       IMAGE ERROR
       ======================================================================== */

    function attachImageFallbacks() {

        container
            .querySelectorAll("img")
            .forEach(
                image => {

                    image.addEventListener(
                        "error",
                        () => {

                            if (
                                image.dataset.fallbackApplied
                            ) {
                                return;
                            }

                            image.dataset.fallbackApplied =
                                "true";

                            image.src =
                                FALLBACK_IMAGE;

                        }
                    );

                }
            );
    }


    /* ========================================================================
       RENDER LOADING
       ======================================================================== */

    function renderLoading() {

        container.setAttribute(
            "aria-busy",
            "true"
        );

        container.innerHTML = `

            <div class="products-loading">

                <div class="products-spinner"></div>

                <p>
                    Loading products...
                </p>

            </div>

        `;


        if (resultCount) {

            resultCount.textContent =
                "Loading products...";
        }
    }


    /* ========================================================================
       RENDER ERROR
       ======================================================================== */

    function renderError(message) {

        container.setAttribute(
            "aria-busy",
            "false"
        );

        container.innerHTML = `

            <div class="products-error">

                <h2>
                    Unable to load products
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    id="retry-products"
                    class="products-retry"
                >
                    Try Again
                </button>

            </div>

        `;


        if (resultCount) {

            resultCount.textContent =
                "Unable to load products";
        }


        const retry =
            document.getElementById(
                "retry-products"
            );


        if (retry) {

            retry.addEventListener(
                "click",
                loadProducts
            );
        }
    }


    /* ========================================================================
       RENDER CATEGORIES
       ======================================================================== */

    function renderCategories() {

        if (!categoryContainer) {
            return;
        }


        const categories =
            [
                "All",
                ...new Set(
                    allProducts
                        .map(
                            product =>
                                product.category
                        )
                        .filter(Boolean)
                )
            ];


        categoryContainer.innerHTML =
            categories
                .map(
                    category => `

                        <button
                            type="button"
                            class="category-pill ${
                                category === activeCategory
                                    ? "active"
                                    : ""
                            }"
                            data-category="${escapeHTML(category)}"
                        >
                            ${escapeHTML(category)}
                        </button>

                    `
                )
                .join("");
    }


    /* ========================================================================
       FILTER
       ======================================================================== */

    function getVisibleProducts() {

        let products =
            [...allProducts];


        const search =
            currentSearch
                .trim()
                .toLowerCase();


        if (search) {

            products =
                products.filter(
                    product => {

                        return (
                            product.name
                                .toLowerCase()
                                .includes(search) ||

                            product.category
                                .toLowerCase()
                                .includes(search) ||

                            product.sku
                                .toLowerCase()
                                .includes(search)
                        );

                    }
                );
        }


        if (
            activeCategory !==
            "All"
        ) {

            products =
                products.filter(
                    product =>
                        product.category ===
                        activeCategory
                );
        }


        const sort =
            sortSelect
                ? sortSelect.value
                : "default";


        if (sort === "price-low") {

            products.sort(
                (a, b) =>
                    a.price - b.price
            );

        } else if (sort === "price-high") {

            products.sort(
                (a, b) =>
                    b.price - a.price
            );

        } else if (sort === "rating") {

            products.sort(
                (a, b) =>
                    b.rating - a.rating
            );

        } else if (sort === "name") {

            products.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );
        }


        return products;
    }


    /* ========================================================================
       RENDER PRODUCTS
       ======================================================================== */

    function renderProducts() {

        const products =
            getVisibleProducts();


        container.setAttribute(
            "aria-busy",
            "false"
        );


        if (resultCount) {

            resultCount.textContent =
                `${products.length} ${
                    products.length === 1
                        ? "product"
                        : "products"
                }`;
        }


        if (!products.length) {

            container.innerHTML = `

                <div class="products-empty">

                    <h2>
                        No products found
                    </h2>

                    <p>
                        Try another search or category.
                    </p>

                    <button
                        type="button"
                        id="clear-product-search"
                        class="products-retry"
                    >
                        Clear Search
                    </button>

                </div>

            `;


            const clear =
                document.getElementById(
                    "clear-product-search"
                );


            if (clear) {

                clear.addEventListener(
                    "click",
                    () => {

                        currentSearch = "";

                        activeCategory =
                            "All";

                        if (searchInput) {
                            searchInput.value =
                                "";
                        }

                        renderCategories();
                        renderProducts();

                    }
                );
            }

            return;
        }


        container.innerHTML =
            products
                .map(
                    product => {

                        const id =
                            encodeURIComponent(
                                product.id
                            );


                        const image =
                            product.image ||
                            FALLBACK_IMAGE;


                        const rating =
                            Number.isFinite(
                                product.rating
                            )
                                ? product.rating.toFixed(1)
                                : "5.0";


                        return `

                            <article
                                class="product-card"
                                data-product-id="${escapeHTML(product.id)}"
                            >

                                <div class="product-card-inner">

                                    <a
                                        href="product.html?id=${id}"
                                        class="product-card-link"
                                    >

                                        <div class="product-card-image">

                                            <span class="product-category">
                                                ${escapeHTML(
                                                    product.category
                                                )}
                                            </span>

                                            <img
                                                src="${escapeHTML(image)}"
                                                alt="${escapeHTML(product.name)}"
                                                loading="lazy"
                                                decoding="async"
                                            >

                                        </div>


                                        <div class="product-card-body">

                                            <span class="product-rating">
                                                ★ ${escapeHTML(rating)}
                                            </span>


                                            <h2 class="product-title">
                                                ${escapeHTML(product.name)}
                                            </h2>


                                            <p class="product-description">
                                                ${escapeHTML(
                                                    product.description
                                                )}
                                            </p>


                                            <div class="product-bottom">

                                                <span class="product-price">
                                                    ${formatPrice(
                                                        product.price
                                                    )}
                                                </span>


                                                <span class="product-view-button">
                                                    View →
                                                </span>

                                            </div>

                                        </div>

                                    </a>


                                    <div class="product-card-actions">

                                        <button
                                            type="button"
                                            class="btn-add-to-cart"
                                            data-add-id="${escapeHTML(product.id)}"
                                        >
                                            Add to Cart
                                        </button>

                                    </div>

                                </div>

                            </article>

                        `;
                    }
                )
                .join("");


        attachImageFallbacks();
    }


    /* ========================================================================
       ADD TO CART
       ======================================================================== */

    function addToCart(product) {

        const cart =
            readCart();


        const existing =
            cart.find(
                item =>
                    String(item.id) ===
                    String(product.id)
            );


        if (existing) {

            existing.quantity =
                (
                    Number(existing.quantity) ||
                    0
                ) + 1;

        } else {

            cart.push({

                id:
                    product.id,

                name:
                    product.name,

                price:
                    product.price,

                image:
                    product.image,

                category:
                    product.category,

                description:
                    product.description,

                rating:
                    product.rating,

                sku:
                    product.sku,

                quantity:
                    1
            });
        }


        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );


            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT,
                    {
                        detail: {
                            cart: cart
                        }
                    }
                )
            );


            updateCartCount();


            return true;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save failed:",
                error
            );

            return false;
        }
    }


    /* ========================================================================
       BUTTON CLICK
       ======================================================================== */

    container.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-add-id]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const id =
                String(
                    button.dataset.addId
                );


            const product =
                allProducts.find(
                    item =>
                        String(item.id) === id
                );


            if (!product) {
                return;
            }


            if (
                addToCart(product)
            ) {

                const original =
                    button.textContent;


                button.textContent =
                    "Added ✓";


                button.disabled =
                    true;


                window.setTimeout(
                    () => {

                        button.textContent =
                            original;

                        button.disabled =
                            false;

                    },
                    1000
                );
            }

        }
    );


    /* ========================================================================
       CATEGORY CLICK
       ======================================================================== */

    if (categoryContainer) {

        categoryContainer.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-category]"
                    );


                if (!button) {
                    return;
                }


                activeCategory =
                    button.dataset.category;


                renderCategories();
                renderProducts();

            }
        );
    }


    /* ========================================================================
       SEARCH
       ======================================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                currentSearch =
                    searchInput.value;


                /*
                 * Local filtering is immediate.
                 */

                renderProducts();


                /*
                 * Also ask the Worker/CJ for
                 * live search results.
                 */

                clearTimeout(
                    searchTimer
                );


                searchTimer =
                    setTimeout(
                        () => {

                            const keyword =
                                currentSearch.trim();


                            if (
                                keyword.length >= 2
                            ) {

                                loadProducts(
                                    keyword
                                );
                            }

                        },
                        500
                    );

            }
        );
    }


    /* ========================================================================
       SORT
       ======================================================================== */

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            renderProducts
        );
    }


    /* ========================================================================
       LOAD PRODUCTS
       ======================================================================== */

    async function loadProducts(
        keyword = ""
    ) {

        if (!keyword) {

            renderLoading();
        }


        try {

            const url =
                keyword
                    ? `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`
                    : API_ENDPOINT;


            const controller =
                new AbortController();


            const timeout =
                setTimeout(
                    () => controller.abort(),
                    10000
                );


            let response;


            try {

                response =
                    await fetch(
                        url,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            cache: "no-store",
                            signal:
                                controller.signal
                        }
                    );

            } finally {

                clearTimeout(
                    timeout
                );
            }


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            /*
             * Worker listing endpoint returns ARRAY.
             */

            const rawProducts =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data?.products)
                        ? data.products
                        : [];


            const normalized =
                rawProducts
                    .map(
                        normalizeProduct
                    )
                    .filter(Boolean);


            /*
             * If searching and CJ returns results,
             * replace current list.
             */

            if (keyword) {

                allProducts =
                    normalized;

                /*
                 * Search results should show All category.
                 */

                activeCategory =
                    "All";

            } else {

                allProducts =
                    normalized;
            }


            renderCategories();
            renderProducts();


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Products loading error:",
                error
            );


            /*
             * If we already have products,
             * don't destroy them during a failed
             * live search.
             */

            if (
                allProducts.length
            ) {

                renderProducts();

                return;
            }


            renderError(
                error?.name === "AbortError"
                    ? "The product request timed out."
                    : "Please check your Worker deployment and try again."
            );
        }
    }


    /* ========================================================================
       CART STORAGE SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                CART_KEY
            ) {

                updateCartCount();
            }
        }
    );


    window.addEventListener(
        CART_EVENT,
        updateCartCount
    );


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    updateCartCount();

    loadProducts();

})();
