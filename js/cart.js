/**
 * ============================================================================
 * PRASUN SHOP — CART MANAGEMENT
 * ============================================================================
 *
 * Production-ready cart system
 *
 * Canonical storage:
 *     prasun_cart
 *
 * Legacy storage automatically migrated from:
 *     prasunShopCart
 *     cart
 *
 * Compatible with:
 *     products.js
 *     product.js
 *     cart.html
 *     checkout.html
 *     checkout.js
 *
 * Features:
 *     - Single canonical localStorage key
 *     - Automatic legacy-cart migration
 *     - Quantity controls
 *     - Remove items
 *     - Cart count synchronization
 *     - Cross-tab synchronization
 *     - Same-page custom cart events
 *     - Image fallback
 *     - HTML escaping
 *     - Currency formatting
 *     - Duplicate-product normalization
 *     - Responsive-safe rendering
 *     - No inline onclick handlers required
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart"
    ];

    const CART_EVENT_NAME = "prasunCartUpdated";

    const PRODUCTS_PAGE = "products.html";

    const CHECKOUT_PAGE = "checkout.html";

    const PRODUCT_PAGE = "product.html";


    /* =========================================================================
       DOM
       ========================================================================= */

    const cartContainer =
        document.getElementById("cart-container");

    /*
     * The current cart.html uses #cart-container.
     *
     * The code also supports the older #cart-items structure
     * if that element exists in another version of the page.
     */

    const cartItemsContainer =
        document.getElementById("cart-items") ||
        cartContainer;

    const cartTotalEl =
        document.getElementById("cart-total");

    const cartCountEl =
        document.getElementById("cart-count");


    /*
     * If this script is accidentally loaded on a page without
     * a cart container, don't interfere with the page.
     */

    if (!cartItemsContainer) {
        return;
    }


    /* =========================================================================
       CURRENCY
       ========================================================================= */

    const currencyFormatter =
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });


    function formatPrice(value) {

        const number = Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }


    /* =========================================================================
       FALLBACK IMAGE
       ========================================================================= */

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


    /* =========================================================================
       HTML ESCAPING
       ========================================================================= */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    const ESCAPE_REGEX = /[&<>"']/g;


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).replace(
            ESCAPE_REGEX,
            character => ESCAPE_MAP[character]
        );
    }


    /* =========================================================================
       NORMALIZE CART ITEM
       ========================================================================= */

    function normalizeCartItem(item) {

        if (
            !item ||
            item.id === undefined ||
            item.id === null
        ) {
            return null;
        }

        const price =
            Number(
                String(item.price ?? "")
                    .replace(/[^0-9.-]/g, "")
            );

        const quantity =
            Number(item.quantity);


        return {

            id:
                String(item.id),

            name:
                String(
                    item.name ||
                    item.title ||
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


    /* =========================================================================
       NORMALIZE ENTIRE CART
       ========================================================================= */

    function normalizeCart(items) {

        if (!Array.isArray(items)) {
            return [];
        }

        const normalized = [];

        /*
         * Map gives O(1) duplicate lookup instead of repeatedly
         * scanning the array.
         */

        const itemMap = new Map();


        for (const rawItem of items) {

            const item =
                normalizeCartItem(rawItem);

            if (!item) {
                continue;
            }


            const id =
                String(item.id);


            const existing =
                itemMap.get(id);


            if (existing) {

                existing.quantity +=
                    item.quantity;

            } else {

                itemMap.set(
                    id,
                    item
                );

                normalized.push(item);
            }
        }


        return normalized;
    }


    /* =========================================================================
       READ LOCAL STORAGE
       ========================================================================= */

    function readStorageCart(key) {

        try {

            const stored =
                localStorage.getItem(key);

            if (!stored) {
                return [];
            }

            const parsed =
                JSON.parse(stored);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.warn(
                `[PRASUN SHOP] Unable to read ${key}:`,
                error
            );

            return [];
        }
    }


    /* =========================================================================
       CART MIGRATION
       ========================================================================= */

    function loadCart() {

        /*
         * First check the new canonical key.
         */

        const current =
            readStorageCart(CART_KEY);


        if (current.length > 0) {

            return normalizeCart(current);
        }


        /*
         * If canonical cart is empty, check legacy keys.
         */

        for (const legacyKey of LEGACY_KEYS) {

            const legacy =
                readStorageCart(legacyKey);

            if (legacy.length > 0) {

                const migrated =
                    normalizeCart(legacy);


                /*
                 * Immediately migrate into the canonical key.
                 */

                try {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(migrated)
                    );

                    console.info(
                        `[PRASUN SHOP] Migrated cart from ${legacyKey}`
                    );

                } catch (error) {

                    console.warn(
                        "[PRASUN SHOP] Cart migration failed:",
                        error
                    );
                }


                return migrated;
            }
        }


        return [];
    }


    let cart =
        loadCart();


    /* =========================================================================
       SAVE CART
       ========================================================================= */

    function saveCart() {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );


            /*
             * Remove old storage keys so the site has
             * one source of truth.
             */

            for (const legacyKey of LEGACY_KEYS) {

                try {

                    localStorage.removeItem(
                        legacyKey
                    );

                } catch (error) {

                    console.warn(
                        `[PRASUN SHOP] Could not remove ${legacyKey}`,
                        error
                    );
                }
            }


            /*
             * Notify other PRASUN SHOP scripts on the same page.
             */

            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: {
                            cart: cart.map(
                                item => ({
                                    ...item
                                })
                            )
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


    /* =========================================================================
       CART COUNT
       ========================================================================= */

    function getCartCount() {

        return cart.reduce(
            (total, item) => {

                const quantity =
                    Number(item.quantity);

                return total +
                    (
                        Number.isFinite(quantity) &&
                        quantity > 0
                            ? quantity
                            : 0
                    );
            },
            0
        );
    }


    function updateCartCount() {

        if (!cartCountEl) {
            return;
        }


        const total =
            getCartCount();


        cartCountEl.textContent =
            String(total);


        /*
         * Current cart.html uses a visible badge.
         * Hide it when there are no items.
         */

        cartCountEl.hidden =
            total === 0;


        cartCountEl.setAttribute(
            "aria-label",
            `${total} ${
                total === 1
                    ? "item"
                    : "items"
            } in cart`
        );


        const cartLink =
            cartCountEl.closest("a");


        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",

                total > 0
                    ? `View Shopping Cart, ${total} ${
                        total === 1
                            ? "item"
                            : "items"
                    }`
                    : "View Shopping Cart"
            );
        }
    }


    /* =========================================================================
       CART TOTAL
       ========================================================================= */

    function calculateTotal() {

        return cart.reduce(
            (total, item) => {

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


    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {

        cartItemsContainer.innerHTML = `

            <div class="empty-cart">

                <div
                    class="cart-empty-icon"
                    aria-hidden="true"
                >

                    <svg
                        width="52"
                        height="52"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
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

                </div>


                <h2>
                    Your shopping bag is empty
                </h2>


                <p>
                    Discover our latest products and add something you love to your bag.
                </p>


                <a
                    href="${PRODUCTS_PAGE}"
                    class="btn-checkout"
                    style="
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        text-decoration:none;
                        margin-top:1rem;
                    "
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


    /* =========================================================================
       RENDER CART
       ========================================================================= */

    function renderCart() {

        updateCartCount();


        if (!cart.length) {

            renderEmptyCart();

            return;
        }


        /*
         * Current cart.html uses #cart-container.
         * Therefore render the complete cart page content here.
         */

        let subtotal = 0;


        const itemsHTML =
            cart.map(
                (item, index) => {

                    const price =
                        Number(item.price) || 0;

                    const quantity =
                        Number(item.quantity) || 1;

                    const itemSubtotal =
                        price *
                        quantity;


                    subtotal +=
                        itemSubtotal;


                    const id =
                        String(item.id);

                    const encodedId =
                        encodeURIComponent(id);


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

                            <div class="cart-item-info">

                                <a
                                    href="${PRODUCT_PAGE}?id=${encodedId}"
                                    aria-label="View ${name}"
                                >

                                    <img
                                        src="${image}"
                                        alt="${name}"
                                        class="cart-item-img"
                                        loading="lazy"
                                        decoding="async"
                                    >

                                </a>


                                <div class="cart-item-details">

                                    ${
                                        category
                                            ? `
                                                <span
                                                    class="cart-item-category"
                                                >
                                                    ${category}
                                                </span>
                                            `
                                            : ""
                                    }


                                    <h4>
                                        <a
                                            href="${PRODUCT_PAGE}?id=${encodedId}"
                                            style="
                                                color:inherit;
                                                text-decoration:none;
                                            "
                                        >
                                            ${name}
                                        </a>
                                    </h4>


                                    <p class="cart-item-price">
                                        ${formatPrice(price)} each
                                    </p>

                                </div>

                            </div>


                            <div class="cart-actions">

                                <div
                                    class="qty-controls"
                                    aria-label="Quantity controls"
                                >

                                    <button
                                        type="button"
                                        class="qty-btn"
                                        data-action="decrease"
                                        data-index="${index}"
                                        aria-label="Decrease quantity"
                                    >
                                        −
                                    </button>


                                    <span
                                        class="quantity-value"
                                        aria-label="Quantity ${quantity}"
                                    >
                                        ${quantity}
                                    </span>


                                    <button
                                        type="button"
                                        class="qty-btn"
                                        data-action="increase"
                                        data-index="${index}"
                                        aria-label="Increase quantity"
                                    >
                                        +
                                    </button>

                                </div>


                                <strong class="cart-item-subtotal">
                                    ${formatPrice(itemSubtotal)}
                                </strong>


                                <button
                                    type="button"
                                    class="btn-remove"
                                    data-action="remove"
                                    data-index="${index}"
                                    aria-label="Remove ${name}"
                                >
                                    Remove
                                </button>

                            </div>

                        </article>

                    `;
                }
            ).join("");


        const total =
            subtotal;


        cartItemsContainer.innerHTML = `

            ${itemsHTML}


            <div class="cart-summary">

                <div
                    class="summary-row"
                    style="
                        display:flex;
                        justify-content:space-between;
                        width:100%;
                        max-width:360px;
                        color:var(--apple-gray);
                    "
                >
                    <span>
                        Subtotal
                    </span>

                    <span>
                        ${formatPrice(subtotal)}
                    </span>
                </div>


                <div
                    class="summary-row"
                    style="
                        display:flex;
                        justify-content:space-between;
                        width:100%;
                        max-width:360px;
                        color:var(--apple-gray);
                    "
                >
                    <span>
                        Shipping
                    </span>

                    <span>
                        Free
                    </span>
                </div>


                <div
                    class="summary-total"
                    style="
                        width:100%;
                        max-width:360px;
                        display:flex;
                        justify-content:space-between;
                    "
                >
                    <span>
                        Total
                    </span>

                    <span id="cart-total">
                        ${formatPrice(total)}
                    </span>
                </div>


                <button
                    type="button"
                    class="btn-checkout"
                    id="proceed-checkout"
                >
                    Proceed to Checkout
                </button>

            </div>

        `;


        /*
         * Update external total element if present.
         */

        if (cartTotalEl) {

            cartTotalEl.textContent =
                formatPrice(total);
        }


        /*
         * Checkout navigation.
         */

        const checkoutButton =
            document.getElementById(
                "proceed-checkout"
            );


        if (checkoutButton) {

            checkoutButton.addEventListener(
                "click",
                () => {

                    if (!cart.length) {
                        return;
                    }

                    window.location.href =
                        CHECKOUT_PAGE;
                }
            );
        }
    }


    /* =========================================================================
       UPDATE QUANTITY
       ========================================================================= */

    function updateQuantity(
        index,
        delta
    ) {

        if (
            !Number.isInteger(index) ||
            !cart[index]
        ) {
            return;
        }


        const item =
            cart[index];


        const currentQuantity =
            Number(item.quantity) || 1;


        const newQuantity =
            currentQuantity + delta;


        /*
         * Remove item when quantity reaches zero.
         */

        if (newQuantity <= 0) {

            cart.splice(
                index,
                1
            );

        } else {

            item.quantity =
                Math.floor(
                    newQuantity
                );
        }


        saveCart();

        renderCart();
    }


    /* =========================================================================
       REMOVE ITEM
       ========================================================================= */

    function removeItem(index) {

        if (
            !Number.isInteger(index) ||
            !cart[index]
        ) {
            return;
        }


        cart.splice(
            index,
            1
        );


        saveCart();

        renderCart();
    }


    /* =========================================================================
       CART ACTION HANDLER
       ========================================================================= */

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


            const index =
                Number(
                    button.dataset.index
                );


            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= cart.length
            ) {
                return;
            }


            /*
             * Prevent accidental double-click
             * navigation or duplicate actions.
             */

            button.disabled = true;


            try {

                if (
                    action === "increase"
                ) {

                    updateQuantity(
                        index,
                        1
                    );

                    return;
                }


                if (
                    action === "decrease"
                ) {

                    updateQuantity(
                        index,
                        -1
                    );

                    return;
                }


                if (
                    action === "remove"
                ) {

                    removeItem(
                        index
                    );

                    return;
                }

            } finally {

                /*
                 * The DOM may have been replaced by renderCart().
                 * Therefore this only matters if the button still exists.
                 */

                if (button.isConnected) {
                    button.disabled = false;
                }
            }
        }
    );


    /* =========================================================================
       IMAGE FALLBACK
       ========================================================================= */

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
                image.dataset.fallbackApplied === "true"
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


    /* =========================================================================
       STORAGE SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(event.key)
            ) {

                cart =
                    loadCart();

                renderCart();
            }
        }
    );


    /* =========================================================================
       SAME-PAGE CART SYNCHRONIZATION
       ========================================================================= */

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
                    normalizeCart(
                        event.detail.cart
                    );

                renderCart();
            }
        }
    );


    /* =========================================================================
       PUBLIC CART API
       ========================================================================= */

    /*
     * Makes the cart system available to other scripts without exposing
     * internal implementation details.
     */

    window.PrasunCart = {

        getCart: () =>
            cart.map(
                item => ({
                    ...item
                })
            ),

        getCount:
            getCartCount,

        getTotal:
            calculateTotal,

        addItem(item, quantity = 1) {

            const normalized =
                normalizeCartItem({
                    ...item,
                    quantity
                });


            if (!normalized) {
                return false;
            }


            const existing =
                cart.find(
                    item =>
                        String(item.id) ===
                        String(normalized.id)
                );


            if (existing) {

                existing.quantity +=
                    normalized.quantity;

            } else {

                cart.push(
                    normalized
                );
            }


            saveCart();

            renderCart();

            return true;
        },


        removeItem(index) {

            removeItem(index);
        },


        updateQuantity(
            index,
            quantity
        ) {

            if (
                !Number.isInteger(index) ||
                !cart[index]
            ) {
                return false;
            }


            const normalizedQuantity =
                Math.floor(
                    Number(quantity)
                );


            if (
                !Number.isFinite(
                    normalizedQuantity
                ) ||
                normalizedQuantity <= 0
            ) {

                cart.splice(
                    index,
                    1
                );

            } else {

                cart[index].quantity =
                    normalizedQuantity;
            }


            saveCart();

            renderCart();

            return true;
        },


        clear() {

            cart = [];

            saveCart();

            renderCart();
        },

        refresh() {

            cart =
                loadCart();

            renderCart();
        }
    };


    /* =========================================================================
       INITIAL RENDER
       ========================================================================= */

    renderCart();

})();
