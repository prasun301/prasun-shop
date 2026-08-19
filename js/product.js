/**
 * ============================================================================
 * PRASUN SHOP — PRODUCT DETAILS
 * ============================================================================
 *
 * Single product API:
 *
 *     /api/products?id=001
 *
 * Cart:
 *
 *     prasun_cart
 *
 * Compatible with cart.js.
 *
 * ============================================================================
 */

"use strict";


(() => {

    /* ========================================================================
       CONFIG
       ======================================================================== */

    const API_ENDPOINT =
        "/api/products";

    const CART_KEY =
        "prasun_cart";

    const CART_EVENT_NAME =
        "prasunCartUpdated";

    const MAX_QUANTITY =
        10;


    /* ========================================================================
       DOM
       ======================================================================== */

    const container =
        document.getElementById(
            "product-detail"
        );

    if (!container) {
        return;
    }


    const breadcrumb =
        document.getElementById(
            "breadcrumb-title"
        );

    const cartCount =
        document.getElementById(
            "cart-count"
        );


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
       HTML ESCAPING
       ======================================================================== */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(
                /[&<>"']/g,
                character =>
                    ESCAPE_MAP[character]
            );
    }


    /* ========================================================================
       FALLBACK IMAGE
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
                    font-size="22"
                >
                    Image unavailable
                </text>
            </svg>
        `);


    /* ========================================================================
       CART
       ======================================================================== */

    function readCart() {

        try {

            const stored =
                localStorage.getItem(
                    CART_KEY
                );

            if (!stored) {
                return [];
            }

            const parsed =
                JSON.parse(stored);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
        }
    }


    function saveCart(cart) {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );

            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart: cart
                        }
                    }
                )
            );

            updateCartBadge(cart);

            return true;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );

            return false;
        }
    }


    function updateCartBadge(
        suppliedCart = null
    ) {

        if (!cartCount) {
            return;
        }

        const cart =
            suppliedCart ||
            readCart();

        const total =
            cart.reduce(
                (
                    sum,
                    item
                ) => {

                    const quantity =
                        Number(
                            item?.quantity
                        );

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

        const cartLink =
            cartCount.closest("a");

        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",

                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    /* ========================================================================
       ADD TO CART
       ======================================================================== */

    function addProductToCart(
        product,
        quantity
    ) {

        const cart =
            readCart();

        const id =
            String(product.id);

        const safeQuantity =
            Math.max(
                1,
                Math.min(
                    MAX_QUANTITY,
                    Number(quantity) || 1
                )
            );

        const existing =
            cart.find(
                item =>
                    String(item.id) === id
            );


        if (existing) {

            existing.quantity =
                (
                    Number(existing.quantity) ||
                    0
                ) +
                safeQuantity;

        } else {

            cart.push({

                id: product.id,

                name: product.name,

                price: Number(product.price) || 0,

                image: product.image || "",

                category: product.category || "",

                description:
                    product.description || "",

                rating:
                    Number(product.rating) || 5,

                sku:
                    product.sku || product.id,

                quantity:
                    safeQuantity

            });
        }


        return saveCart(cart);
    }


    /* ========================================================================
       BUTTON FEEDBACK
       ======================================================================== */

    function buttonFeedback(
        button,
        text
    ) {

        if (!button) {
            return;
        }

        const span =
            button.querySelector(
                "span"
            );

        const originalText =
            span
                ? span.textContent
                : button.textContent;

        button.disabled = true;

        if (span) {
            span.textContent = text;
        } else {
            button.textContent = text;
        }

        window.setTimeout(
            () => {

                if (span) {
                    span.textContent =
                        originalText;
                } else {
                    button.textContent =
                        originalText;
                }

                button.disabled = false;

            },
            1200
        );
    }


    /* ========================================================================
       ERROR STATE
       ======================================================================== */

    function renderError(
        title,
        message
    ) {

        container.innerHTML = `

            <div class="product-error">

                <h2>
                    ${escapeHTML(title)}
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>

                <a
                    href="products.html"
                    class="back-button"
                >
                    Back to Products
                </a>

            </div>

        `;
    }


    /* ========================================================================
       LOADING STATE
       ======================================================================== */

    function renderLoading() {

        container.innerHTML = `

            <div class="product-loading">

                <div
                    class="loading-spinner"
                    aria-hidden="true"
                ></div>

                <p>
                    Loading product details...
                </p>

            </div>

        `;
    }


    /* ========================================================================
       GET PRODUCT ID
       ======================================================================== */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const productId =
        params.get("id");


    /* ========================================================================
       RENDER FEATURES
       ======================================================================== */

    function renderFeatures(
        features
    ) {

        if (
            !Array.isArray(features) ||
            features.length === 0
        ) {
            return "";
        }

        const validFeatures =
            features
                .filter(
                    feature =>
                        feature !== null &&
                        feature !== undefined &&
                        String(feature).trim() !== ""
                );

        if (!validFeatures.length) {
            return "";
        }

        return `

            <section class="product-extra-section">

                <h2 class="product-extra-title">
                    Key Features
                </h2>

                <ul class="feature-list">

                    ${validFeatures
                        .map(
                            feature => `

                                <li>

                                    <span
                                        class="feature-dot"
                                        aria-hidden="true"
                                    ></span>

                                    <span>
                                        ${escapeHTML(feature)}
                                    </span>

                                </li>

                            `
                        )
                        .join("")}

                </ul>

            </section>

        `;
    }


    /* ========================================================================
       RENDER SPECIFICATIONS
       ======================================================================== */

    function renderSpecifications(
        specifications
    ) {

        if (
            !specifications ||
            typeof specifications !== "object"
        ) {
            return "";
        }

        const keys =
            Object.keys(
                specifications
            );

        if (!keys.length) {
            return "";
        }

        return `

            <section class="product-extra-section">

                <h2 class="product-extra-title">
                    Specifications
                </h2>

                <table class="spec-table">

                    <tbody>

                        ${keys
                            .map(
                                key => `

                                    <tr>

                                        <td>
                                            ${escapeHTML(key)}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                specifications[key]
                                            )}
                                        </td>

                                    </tr>

                                `
                            )
                            .join("")}

                    </tbody>

                </table>

            </section>

        `;
    }


    /* ========================================================================
       RENDER PRODUCT
       ======================================================================== */

    function renderProduct(
        product
    ) {

        const image =
            product.image ||
            FALLBACK_IMAGE;

        const rating =
            Number.isFinite(
                Number(product.rating)
            )
                ? Number(product.rating).toFixed(1)
                : "5.0";


        document.title =
            `${product.name} — PRASUN SHOP`;


        if (breadcrumb) {

            breadcrumb.textContent =
                product.name;
        }


        container.innerHTML = `

            <div class="product-grid">


                <!-- ========================================================
                     PRODUCT IMAGE
                     ======================================================== -->

                <div class="product-image-container">

                    <img
                        id="product-main-image"
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(product.name)}"
                        loading="eager"
                        decoding="async"
                    >

                </div>


                <!-- ========================================================
                     PRODUCT DETAILS
                     ======================================================== -->

                <div class="product-details">


                    <div class="product-category-row">

                        <span class="product-category">
                            ${escapeHTML(
                                product.category ||
                                "Product"
                            )}
                        </span>


                        <span class="product-rating">

                            <span class="product-rating-star">
                                ★
                            </span>

                            ${escapeHTML(rating)}
                            / 5.0

                        </span>

                    </div>


                    <h1 class="product-title">
                        ${escapeHTML(product.name)}
                    </h1>


                    <div class="product-meta">

                        <span>
                            SKU:
                            <strong>
                                ${escapeHTML(
                                    product.sku ||
                                    product.id
                                )}
                            </strong>
                        </span>


                        <span class="product-stock">

                            <span
                                class="stock-dot"
                                aria-hidden="true"
                            ></span>

                            In Stock

                        </span>

                    </div>


                    <div class="product-price">

                        ${formatPrice(
                            product.price
                        )}

                    </div>


                    <p class="product-description">

                        ${escapeHTML(
                            product.description ||
                            "No detailed product description provided."
                        )}

                    </p>


                    <!-- ====================================================
                         QUANTITY
                         ==================================================== -->

                    <div class="quantity-row">

                        <label
                            class="quantity-label"
                            for="product-quantity"
                        >
                            Quantity
                        </label>


                        <div
                            class="quantity-control"
                            role="group"
                            aria-label="Product quantity"
                        >

                            <button
                                type="button"
                                id="qty-decrement"
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>


                            <input
                                id="product-quantity"
                                type="number"
                                min="1"
                                max="${MAX_QUANTITY}"
                                step="1"
                                value="1"
                                inputmode="numeric"
                                aria-label="Product quantity"
                            >


                            <button
                                type="button"
                                id="qty-increment"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>

                        </div>

                    </div>


                    <!-- ====================================================
                         ACTION BUTTONS
                         ==================================================== -->

                    <div class="button-group">

                        <button
                            type="button"
                            id="add-to-cart-btn"
                            class="product-button product-button-secondary"
                        >

                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >

                                <circle
                                    cx="9"
                                    cy="21"
                                    r="1"
                                ></circle>

                                <circle
                                    cx="20"
                                    cy="21"
                                    r="1"
                                ></circle>

                                <path
                                    d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
                                ></path>

                            </svg>


                            <span>
                                Add to Cart
                            </span>

                        </button>


                        <button
                            type="button"
                            id="buy-now-btn"
                            class="product-button product-button-primary"
                        >

                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >

                                <path
                                    d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                                ></path>

                            </svg>


                            <span>
                                Buy Now
                            </span>

                        </button>

                    </div>


                    ${renderFeatures(
                        product.features
                    )}


                    ${renderSpecifications(
                        product.specifications
                    )}

                </div>

            </div>

        `;


        /* ================================================================
           IMAGE FALLBACK
           ================================================================ */

        const imageElement =
            document.getElementById(
                "product-main-image"
            );

        if (imageElement) {

            imageElement.addEventListener(
                "error",
                () => {

                    if (
                        imageElement.dataset.fallbackApplied
                    ) {
                        return;
                    }

                    imageElement.dataset.fallbackApplied =
                        "true";

                    imageElement.src =
                        FALLBACK_IMAGE;

                }
            );
        }


        /* ================================================================
           BUTTONS
           ================================================================ */

        const quantityInput =
            document.getElementById(
                "product-quantity"
            );

        const decrementButton =
            document.getElementById(
                "qty-decrement"
            );

        const incrementButton =
            document.getElementById(
                "qty-increment"
            );

        const addButton =
            document.getElementById(
                "add-to-cart-btn"
            );

        const buyButton =
            document.getElementById(
                "buy-now-btn"
            );


        function getQuantity() {

            if (!quantityInput) {
                return 1;
            }

            let quantity =
                parseInt(
                    quantityInput.value,
                    10
                );

            if (
                !Number.isFinite(quantity)
            ) {
                quantity = 1;
            }

            quantity =
                Math.max(
                    1,
                    Math.min(
                        MAX_QUANTITY,
                        quantity
                    )
                );

            quantityInput.value =
                String(quantity);

            return quantity;
        }


        if (decrementButton) {

            decrementButton.addEventListener(
                "click",
                () => {

                    const current =
                        getQuantity();

                    quantityInput.value =
                        String(
                            Math.max(
                                1,
                                current - 1
                            )
                        );
                }
            );
        }


        if (incrementButton) {

            incrementButton.addEventListener(
                "click",
                () => {

                    const current =
                        getQuantity();

                    quantityInput.value =
                        String(
                            Math.min(
                                MAX_QUANTITY,
                                current + 1
                            )
                        );
                }
            );
        }


        if (quantityInput) {

            quantityInput.addEventListener(
                "change",
                getQuantity
            );

            quantityInput.addEventListener(
                "blur",
                getQuantity
            );
        }


        /* ================================================================
           ADD TO CART
           ================================================================ */

        if (addButton) {

            addButton.addEventListener(
                "click",
                () => {

                    const quantity =
                        getQuantity();

                    const success =
                        addProductToCart(
                            product,
                            quantity
                        );

                    if (success) {

                        buttonFeedback(
                            addButton,
                            "Added ✓"
                        );
                    }

                }
            );
        }


        /* ================================================================
           BUY NOW
           ================================================================ */

        if (buyButton) {

            buyButton.addEventListener(
                "click",
                () => {

                    const quantity =
                        getQuantity();

                    const success =
                        addProductToCart(
                            product,
                            quantity
                        );

                    if (success) {

                        window.location.href =
                            "cart.html";
                    }

                }
            );
        }
    }


    /* ========================================================================
       LOAD PRODUCT
       ======================================================================== */

    async function loadProduct() {

        updateCartBadge();


        if (!productId) {

            renderError(
                "No Product Selected",
                "Please return to the shop and select a valid product."
            );

            return;
        }


        renderLoading();


        try {

            const url =
                `${API_ENDPOINT}?id=${encodeURIComponent(productId)}`;


            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store"
                    }
                );


            let data = null;

            try {

                data =
                    await response.json();

            } catch (jsonError) {

                throw new Error(
                    "The server returned an invalid JSON response."
                );
            }


            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    `HTTP ${response.status}`
                );
            }


            const product =
                data?.product ||
                data?.data ||
                null;


            if (
                !product ||
                !product.id
            ) {

                throw new Error(
                    "Product data was not found."
                );
            }


            renderProduct(
                product
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Product loading error:",
                error
            );


            renderError(
                "Unable to Load Product",
                "We could not retrieve this product right now. Please return to the shop and try again."
            );
        }
    }


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    updateCartBadge();

    loadProduct();

})();
