/**
 * ============================================================================
 * PRASUN SHOP — CART MANAGEMENT
 * ============================================================================
 *
 * Single cart storage key:
 *
 *     prasun_cart
 *
 * Product information is stored as a snapshot when the product is added.
 *
 * This avoids a second product catalog such as data/products.json.
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

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
     * If this is not the cart page, stop.
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
                width="300"
                height="300"
                viewBox="0 0 300 300">

                <rect
                    width="300"
                    height="300"
                    fill="#f4f4f5"
                />

                <text
                    x="150"
                    y="150"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#a1a1aa"
                    font-family="system-ui, sans-serif"
                    font-size="16"
                >
                    Image unavailable
                </text>

            </svg>
        `);


    /* ========================================================================
       HTML ESCAPING
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
       CART NORMALIZATION
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


        const quantity =
            Number(item.quantity);


        const price =
            Number(item.price);


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
                    : 4.5,


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

            /*
             * Primary cart.
             */
            const primary =
                localStorage.getItem(
                    CART_KEY
                );


            if (primary) {

                const parsed =
                    JSON.parse(primary);


                if (Array.isArray(parsed)) {

                    return parsed
                        .map(
                            normalizeCartItem
                        )
                        .filter(Boolean);
                }
            }


            /*
             * Legacy migration.
             */
            for (
                const key of LEGACY_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        key
                    );


                if (!legacy) {
                    continue;
                }


                const parsed =
                    JSON.parse(legacy);


                if (
                    !Array.isArray(parsed)
                ) {
                    continue;
                }


                const migrated =
                    parsed
                        .map(
                            normalizeCartItem
                        )
                        .filter(Boolean);


                if (migrated.length) {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(
                            migrated
                        )
                    );


                    return migrated;
                }
            }


            return [];

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
                JSON.stringify(cart)
            );


            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart: [...cart]
                        }
                    }
                )
            );


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );
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
                (sum, item) =>
                    sum +
                    Number(item.quantity || 1),
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
            (total, item) => {

                const price =
                    Number(item.price);


                const quantity =
                    Number(item.quantity);


                return total +
                    (
                        Number.isFinite(price)
                            ? price
                            : 0
                    ) *
                    (
                        Number.isFinite(quantity)
                            ? quantity
                            : 1
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


                        const image =
                            escapeHTML(
                                item.image ||
                                FALLBACK_IMAGE
                            );


                        const category =
                            escapeHTML(
                                item.category ||
                                "Product"
                            );


                        return `

                            <article
                                class="cart-item"
                                data-product-id="${escapeHTML(id)}"
                            >

                                <!-- Product -->
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
                                            ${formatPrice(price)} each
                                        </p>

                                    </div>

                                </div>


                                <!-- Controls -->
                                <div class="cart-item-controls">

                                    <div
                                        class="quantity-control"
                                        aria-label="Quantity controls for ${name}"
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
                formatPrice(total);
        }
    }


    /* ========================================================================
       UPDATE SINGLE ITEM DOM
       ======================================================================== */

    function updateItemDOM(
        article,
        item
    ) {

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
                        String(entry.id) === id
                );


            if (!item) {
                return;
            }


            if (action === "remove") {

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


            if (
                action === "increase" ||
                action === "decrease"
            ) {

                if (
                    action === "increase"
                ) {

                    item.quantity += 1;

                } else {

                    item.quantity -= 1;
                }


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


                if (article) {

                    updateItemDOM(
                        article,
                        item
                    );
                }
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
                event.key ===
                CART_KEY
            ) {

                cart =
                    getCart();


                renderCart();
            }
        }
    );


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
