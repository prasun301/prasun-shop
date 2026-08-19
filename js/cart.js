/**
 * ============================================================================
 * PRASUN SHOP — CART MANAGEMENT
 * ============================================================================
 *
 * Single storage key:
 *
 *     prasun_cart
 *
 * Compatible with:
 *
 *     product.js
 *     products.js
 *     checkout.js
 *
 * ============================================================================
 */

"use strict";


(() => {

    const CART_KEY =
        "prasun_cart";

    const CART_EVENT_NAME =
        "prasunCartUpdated";


    /* ========================================================================
       DOM
       ======================================================================== */

    const cartItemsContainer =
        document.getElementById(
            "cart-items"
        );


    /*
     * cart.js only runs on the cart page.
     */

    if (!cartItemsContainer) {
        return;
    }


    const cartTotalEl =
        document.getElementById(
            "cart-total"
        );

    const cartCountEl =
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
       FALLBACK IMAGE
       ======================================================================== */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="400"
                height="400"
                viewBox="0 0 400 400"
            >
                <rect
                    width="400"
                    height="400"
                    fill="#f4f4f5"
                />

                <text
                    x="200"
                    y="200"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#a1a1aa"
                    font-family="Arial, sans-serif"
                    font-size="18"
                >
                    Image unavailable
                </text>
            </svg>
        `);


    /* ========================================================================
       ESCAPE HTML
       ======================================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* ========================================================================
       NORMALIZE ITEM
       ======================================================================== */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            item.id === undefined ||
            item.id === null
        ) {
            return null;
        }


        const price =
            Number(item.price);

        const quantity =
            Number(item.quantity);


        return {

            id:
                String(item.id),

            name:
                String(
                    item.name ||
                    item.productName ||
                    "Product"
                ),

            price:
                Number.isFinite(price) &&
                price >= 0
                    ? price
                    : 0,

            image:
                String(
                    item.image ||
                    item.productImage ||
                    ""
                ),

            category:
                String(
                    item.category ||
                    item.categoryName ||
                    ""
                ),

            description:
                String(
                    item.description ||
                    ""
                ),

            rating:
                Number.isFinite(
                    Number(item.rating)
                )
                    ? Number(item.rating)
                    : 5,

            sku:
                String(
                    item.sku ||
                    item.id
                ),

            quantity:
                Number.isFinite(quantity) &&
                quantity > 0
                    ? Math.floor(quantity)
                    : 1
        };
    }


    /* ========================================================================
       GET CART
       ======================================================================== */

    function getCart() {

        try {

            const stored =
                localStorage.getItem(
                    CART_KEY
                );

            if (!stored) {
                return [];
            }


            const parsed =
                JSON.parse(
                    stored
                );


            if (
                !Array.isArray(parsed)
            ) {
                return [];
            }


            const normalized = [];


            for (
                const item of parsed
            ) {

                const valid =
                    normalizeCartItem(
                        item
                    );

                if (!valid) {
                    continue;
                }


                const existing =
                    normalized.find(
                        entry =>
                            String(entry.id) ===
                            String(valid.id)
                    );


                if (existing) {

                    existing.quantity +=
                        valid.quantity;

                } else {

                    normalized.push(
                        valid
                    );
                }
            }


            return normalized;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
        }
    }


    let cart =
        getCart();


    /* ========================================================================
       SAVE CART
       ======================================================================== */

    function saveCart() {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(
                    cart
                )
            );


            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart: [
                                ...cart
                            ]
                        }
                    }
                )
            );


            return true;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );

            return false;
        }
    }


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount() {

        if (!cartCountEl) {
            return;
        }


        const total =
            cart.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    (
                        Number(item.quantity) || 1
                    ),
                0
            );


        cartCountEl.textContent =
            String(total);


        cartCountEl.hidden =
            total === 0;


        cartCountEl.setAttribute(
            "aria-label",
            `${total} ${total === 1 ? "item" : "items"} in cart`
        );


        const cartLink =
            cartCountEl.closest("a");


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
       TOTAL
       ======================================================================== */

    function calculateTotal() {

        return cart.reduce(
            (
                total,
                item
            ) => {

                const price =
                    Number(item.price) || 0;

                const quantity =
                    Number(item.quantity) || 1;

                return total +
                    (
                        price *
                        quantity
                    );

            },
            0
        );
    }


    /* ========================================================================
       EMPTY CART
       ======================================================================== */

    function renderEmptyCart() {

        cartItemsContainer.innerHTML = `

            <div class="cart-empty">

                <div
                    class="cart-empty-icon"
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

                        <path
                            d="M6 8h12l1 13H5L6 8Z"
                        ></path>

                        <path
                            d="M9 8V6a3 3 0 0 1 6 0v2"
                        ></path>

                    </svg>

                </div>


                <h2>
                    Your cart is empty
                </h2>


                <p>
                    Discover our latest products and add something you love to your cart.
                </p>


                <a
                    href="products.html"
                    class="cart-continue-button"
                >
                    Continue Shopping
                </a>

            </div>

        `;


        if (cartTotalEl) {

            cartTotalEl.textContent =
                formatPrice(0);
        }
    }


    /* ========================================================================
       RENDER CART
       ======================================================================== */

    function renderCart() {

        updateCartCount();


        if (!cart.length) {

            renderEmptyCart();

            return;
        }


        let total = 0;


        const html =
            cart
                .map(
                    item => {

                        const price =
                            Number(item.price) || 0;

                        const quantity =
                            Number(item.quantity) || 1;

                        const subtotal =
                            price *
                            quantity;


                        total +=
                            subtotal;


                        const id =
                            String(item.id);

                        const encodedId =
                            encodeURIComponent(
                                id
                            );


                        const name =
                            escapeHTML(
                                item.name ||
                                "Product"
                            );


                        const category =
                            escapeHTML(
                                item.category ||
                                ""
                            );


                        const image =
                            escapeHTML(
                                item.image ||
                                FALLBACK_IMAGE
                            );


                        return `

                            <article
                                class="cart-item"
                                data-product-id="${escapeHTML(id)}"
                            >


                                <!-- PRODUCT -->

                                <div class="cart-item-product">

                                    <a
                                        href="product.html?id=${encodedId}"
                                        class="cart-item-image-link"
                                        aria-label="View ${name}"
                                    >

                                        <img
                                            src="${image}"
                                            alt="${name}"
                                            class="cart-item-image"
                                            loading="lazy"
                                            decoding="async"
                                        >

                                    </a>


                                    <div class="cart-item-info">


                                        ${
                                            category
                                                ? `

                                                    <span class="cart-item-category">

                                                        ${category}

                                                    </span>

                                                `
                                                : ""
                                        }


                                        <h2 class="cart-item-title">

                                            <a
                                                href="product.html?id=${encodedId}"
                                            >
                                                ${name}
                                            </a>

                                        </h2>


                                        <p class="cart-item-price">

                                            ${formatPrice(price)}
                                            each

                                        </p>

                                    </div>

                                </div>


                                <!-- CONTROLS -->

                                <div class="cart-item-controls">


                                    <div
                                        class="quantity-control"
                                        aria-label="Quantity controls"
                                    >

                                        <button
                                            type="button"
                                            data-action="decrease"
                                            data-id="${escapeHTML(id)}"
                                            aria-label="Decrease quantity of ${name}"
                                        >
                                            −
                                        </button>


                                        <span
                                            data-role="quantity-display"
                                            aria-label="Quantity: ${quantity}"
                                        >
                                            ${quantity}
                                        </span>


                                        <button
                                            type="button"
                                            data-action="increase"
                                            data-id="${escapeHTML(id)}"
                                            aria-label="Increase quantity of ${name}"
                                        >
                                            +
                                        </button>

                                    </div>


                                    <div class="cart-item-subtotal">

                                        <strong
                                            data-role="subtotal-display"
                                        >
                                            ${formatPrice(subtotal)}
                                        </strong>


                                        <button
                                            type="button"
                                            data-action="remove"
                                            data-id="${escapeHTML(id)}"
                                            class="cart-remove-button"
                                            aria-label="Remove ${name} from cart"
                                        >
                                            Remove
                                        </button>

                                    </div>

                                </div>

                            </article>

                        `;
                    }
                )
                .join("");


        cartItemsContainer.innerHTML =
            html;


        if (cartTotalEl) {

            cartTotalEl.textContent =
                formatPrice(
                    total
                );
        }
    }


    /* ========================================================================
       UPDATE SINGLE ITEM
       ======================================================================== */

    function updateItemDOM(
        article,
        item
    ) {

        if (!article) {
            return;
        }


        const price =
            Number(item.price) || 0;

        const quantity =
            Number(item.quantity) || 1;


        const quantityDisplay =
            article.querySelector(
                '[data-role="quantity-display"]'
            );


        const subtotalDisplay =
            article.querySelector(
                '[data-role="subtotal-display"]'
            );


        if (quantityDisplay) {

            quantityDisplay.textContent =
                String(quantity);

            quantityDisplay.setAttribute(
                "aria-label",
                `Quantity: ${quantity}`
            );
        }


        if (subtotalDisplay) {

            subtotalDisplay.textContent =
                formatPrice(
                    price *
                    quantity
                );
        }


        if (cartTotalEl) {

            cartTotalEl.textContent =
                formatPrice(
                    calculateTotal()
                );
        }


        updateCartCount();
    }


    /* ========================================================================
       IMAGE FALLBACK
       ======================================================================== */

    cartItemsContainer.addEventListener(
        "error",
        event => {

            const image =
                event.target;


            if (
                !image ||
                image.tagName !== "IMG"
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


            image.src =
                FALLBACK_IMAGE;

        },
        true
    );


    /* ========================================================================
       CART ACTIONS
       ======================================================================== */

    cartItemsContainer.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "button[data-action]"
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.action;


            const id =
                String(
                    button.dataset.id ||
                    ""
                );


            const item =
                cart.find(
                    entry =>
                        String(entry.id) ===
                        id
                );


            if (!item) {
                return;
            }


            /* ================================================================
               REMOVE
               ================================================================ */

            if (
                action === "remove"
            ) {

                cart =
                    cart.filter(
                        entry =>
                            String(entry.id) !==
                            id
                    );


                saveCart();

                renderCart();

                return;
            }


            /* ================================================================
               INCREASE
               ================================================================ */

            if (
                action === "increase"
            ) {

                item.quantity += 1;

                saveCart();

                const article =
                    button.closest(
                        ".cart-item"
                    );

                updateItemDOM(
                    article,
                    item
                );

                return;
            }


            /* ================================================================
               DECREASE
               ================================================================ */

            if (
                action === "decrease"
            ) {

                item.quantity -= 1;


                if (
                    item.quantity <= 0
                ) {

                    cart =
                        cart.filter(
                            entry =>
                                String(entry.id) !==
                                id
                        );

                    saveCart();

                    renderCart();

                    return;
                }


                saveCart();


                const article =
                    button.closest(
                        ".cart-item"
                    );


                updateItemDOM(
                    article,
                    item
                );

                return;
            }

        }
    );


    /* ========================================================================
       STORAGE SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY
            ) {

                cart =
                    getCart();

                renderCart();
            }
        }
    );


    /* ========================================================================
       SAME-PAGE CART SYNC
       ======================================================================== */

    window.addEventListener(
        CART_EVENT_NAME,
        event => {

            if (
                event.detail &&
                Array.isArray(
                    event.detail.cart
                )
            ) {

                cart =
                    event.detail.cart
                        .map(
                            normalizeCartItem
                        )
                        .filter(Boolean);


                renderCart();
            }
        }
    );


    /* ========================================================================
       INITIAL RENDER
       ======================================================================== */

    renderCart();

})();
