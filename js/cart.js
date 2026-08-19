/**
 * ============================================================================
 * PRASUN SHOP — CART MANAGEMENT
 * ============================================================================
 * Shared cart system for:
 *
 *   index.html
 *   products.html
 *   product.html
 *   cart.html
 *   checkout.html
 *
 * Canonical localStorage key:
 *   prasun_cart
 *
 * Legacy keys are automatically migrated.
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
        "cart",
        "prasun_cart_items"
    ];

    const CART_EVENT_NAME = "prasunCartUpdated";

    const LEGACY_EVENT_NAME = "cartUpdated";

    const MAX_QUANTITY = 99;


    /* =========================================================================
       FALLBACK IMAGE
       ========================================================================= */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="600"
                 height="600"
                 viewBox="0 0 600 600">

                <rect width="600"
                      height="600"
                      fill="#f8fafc"/>

                <path
                    d="M150 420
                       L250 315
                       L330 380
                       L410 300
                       L490 420 Z"
                    fill="#e2e8f0"/>

                <circle
                    cx="255"
                    cy="220"
                    r="48"
                    fill="#cbd5e1"/>

                <text
                    x="300"
                    y="500"
                    text-anchor="middle"
                    fill="#64748b"
                    font-family="Arial,sans-serif"
                    font-size="24">
                    Image unavailable
                </text>

            </svg>
        `);


    /* =========================================================================
       CURRENCY
       ========================================================================= */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
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
       HTML ESCAPING
       ========================================================================= */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };


    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value).replace(
            /[&<>"']/g,
            character => ESCAPE_MAP[character]
        );
    }


    /* =========================================================================
       STORAGE
       ========================================================================= */

    let memoryStorage = {};


    function storageAvailable() {

        try {

            const testKey = "__prasun_cart_test__";

            localStorage.setItem(testKey, "1");
            localStorage.removeItem(testKey);

            return true;

        } catch (_) {

            return false;
        }
    }


    const HAS_STORAGE = storageAvailable();


    function readStorage(key) {

        if (HAS_STORAGE) {

            try {
                return localStorage.getItem(key);
            } catch (_) {
                return null;
            }
        }

        return Object.prototype.hasOwnProperty.call(memoryStorage, key)
            ? memoryStorage[key]
            : null;
    }


    function writeStorage(key, value) {

        if (HAS_STORAGE) {

            try {

                localStorage.setItem(
                    key,
                    String(value)
                );

                return true;

            } catch (error) {

                console.error(
                    "[PRASUN SHOP] Unable to save cart.",
                    error
                );

                return false;
            }
        }

        memoryStorage[key] = String(value);

        return true;
    }


    function deleteStorage(key) {

        if (HAS_STORAGE) {

            try {
                localStorage.removeItem(key);
            } catch (_) {}

        } else {

            delete memoryStorage[key];
        }
    }


    /* =========================================================================
       NORMALIZE CART ITEM
       ========================================================================= */

    function normalizeCartItem(item) {

        if (!item || typeof item !== "object") {
            return null;
        }


        const rawId =
            item.id ??
            item.productId ??
            item.pid ??
            item.sku;


        if (
            rawId === undefined ||
            rawId === null ||
            String(rawId).trim() === ""
        ) {
            return null;
        }


        const id = String(rawId);

        const sku = String(
            item.sku ??
            item.productSku ??
            id
        );


        const name = String(
            item.name ??
            item.productName ??
            item.title ??
            "Product"
        );


        const rawPrice = Number(
            item.price ??
            item.sellPrice ??
            item.salePrice ??
            item.productPrice ??
            0
        );


        const price =
            Number.isFinite(rawPrice) && rawPrice >= 0
                ? rawPrice
                : 0;


        const rawQuantity = Number(
            item.quantity ?? 1
        );


        let quantity =
            Number.isFinite(rawQuantity) && rawQuantity > 0
                ? Math.floor(rawQuantity)
                : 1;


        quantity = Math.max(
            1,
            Math.min(MAX_QUANTITY, quantity)
        );


        const image = String(
            item.image ??
            item.productImage ??
            item.imageUrl ??
            ""
        );


        const category = String(
            item.category ??
            item.categoryName ??
            ""
        );


        const description = String(
            item.description ??
            ""
        );


        const ratingNumber = Number(
            item.rating
        );


        const rating =
            Number.isFinite(ratingNumber)
                ? Math.max(
                    0,
                    Math.min(5, ratingNumber)
                )
                : null;


        return {

            id,

            sku,

            name,

            price,

            image,

            category,

            description,

            rating,

            quantity,

            features: Array.isArray(item.features)
                ? item.features
                : [],

            specifications:
                item.specifications &&
                typeof item.specifications === "object"
                    ? item.specifications
                    : {}
        };
    }


    /* =========================================================================
       PARSE CART
       ========================================================================= */

    function parseCart(raw) {

        if (!raw) {
            return [];
        }


        try {

            const parsed = JSON.parse(raw);


            if (!Array.isArray(parsed)) {
                return [];
            }


            return parsed
                .map(normalizeCartItem)
                .filter(Boolean);


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Invalid cart data.",
                error
            );

            return [];
        }
    }


    /* =========================================================================
       MERGE DUPLICATES
       ========================================================================= */

    function mergeDuplicateItems(items) {

        const map = new Map();


        for (const rawItem of items) {

            const item = normalizeCartItem(rawItem);

            if (!item) {
                continue;
            }


            const key =
                String(item.id || item.sku)
                    .trim()
                    .toLowerCase();


            const existing = map.get(key);


            if (existing) {

                existing.quantity = Math.min(
                    MAX_QUANTITY,
                    existing.quantity + item.quantity
                );

            } else {

                map.set(
                    key,
                    { ...item }
                );
            }
        }


        return Array.from(map.values());
    }


    /* =========================================================================
       READ CART
       ========================================================================= */

    function getCart() {

        try {

            const primary = readStorage(CART_KEY);


            if (primary !== null) {

                return mergeDuplicateItems(
                    parseCart(primary)
                );
            }


            /* -------------------------------------------------------------
               Legacy migration
               ------------------------------------------------------------- */

            for (const key of LEGACY_KEYS) {

                const legacyData =
                    readStorage(key);


                if (!legacyData) {
                    continue;
                }


                const migrated =
                    mergeDuplicateItems(
                        parseCart(legacyData)
                    );


                if (migrated.length) {

                    writeStorage(
                        CART_KEY,
                        JSON.stringify(migrated)
                    );

                    LEGACY_KEYS.forEach(
                        deleteStorage
                    );

                    return migrated;
                }
            }


            return [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error.",
                error
            );

            return [];
        }
    }


    /* =========================================================================
       CURRENT CART STATE
       ========================================================================= */

    let cart = getCart();


    /* =========================================================================
       SAVE CART
       ========================================================================= */

    function saveCart() {

        const normalizedCart =
            mergeDuplicateItems(cart);


        cart = normalizedCart;


        writeStorage(
            CART_KEY,
            JSON.stringify(cart)
        );


        /* Remove old cart formats */

        LEGACY_KEYS.forEach(
            deleteStorage
        );


        /* -------------------------------------------------------------
           Unified event
           ------------------------------------------------------------- */

        const eventDetail = {
            cart: cart.map(
                item => ({ ...item })
            )
        };


        try {

            window.dispatchEvent(
                new CustomEvent(
                    CART_EVENT_NAME,
                    {
                        detail: eventDetail
                    }
                )
            );

        } catch (_) {}


        /* Legacy compatibility */

        try {

            window.dispatchEvent(
                new CustomEvent(
                    LEGACY_EVENT_NAME,
                    {
                        detail: {
                            cart: cart.map(
                                item => ({ ...item })
                            )
                        }
                    }
                )
            );

        } catch (_) {}


        return true;
    }


    /* =========================================================================
       CART TOTALS
       ========================================================================= */

    function getTotalQuantity() {

        return cart.reduce(
            (total, item) => {

                const quantity =
                    Number(item.quantity);


                return total +
                    (
                        Number.isFinite(quantity) &&
                        quantity > 0
                            ? Math.floor(quantity)
                            : 0
                    );

            },
            0
        );
    }


    function getSubtotal() {

        return cart.reduce(
            (total, item) => {

                const price =
                    Number(item.price) || 0;

                const quantity =
                    Number(item.quantity) || 0;


                return total +
                    (price * quantity);

            },
            0
        );
    }


    /* =========================================================================
       UPDATE HEADER
       ========================================================================= */

    function updateCartHeader() {

        const totalQuantity =
            getTotalQuantity();


        const cartCount =
            document.getElementById(
                "cart-count"
            );


        const cartItemsCount =
            document.getElementById(
                "cart-items-count"
            );


        if (cartCount) {

            cartCount.textContent =
                String(totalQuantity);


            cartCount.hidden =
                totalQuantity === 0;


            cartCount.setAttribute(
                "aria-label",
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                } in cart`
            );
        }


        if (cartItemsCount) {

            cartItemsCount.textContent =
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                }`;
        }
    }


    /* =========================================================================
       UPDATE SUMMARY
       ========================================================================= */

    function updateSummary() {

        const subtotal =
            getSubtotal();


        const subtotalElement =
            document.getElementById(
                "cart-subtotal"
            );


        const totalElement =
            document.getElementById(
                "cart-total"
            );


        const checkoutButton =
            document.getElementById(
                "checkout-button"
            );


        const clearButton =
            document.getElementById(
                "clear-cart-button"
            );


        if (subtotalElement) {

            subtotalElement.textContent =
                formatPrice(subtotal);
        }


        if (totalElement) {

            totalElement.textContent =
                formatPrice(subtotal);
        }


        if (checkoutButton) {

            const empty =
                cart.length === 0;


            checkoutButton.disabled =
                empty;


            checkoutButton.setAttribute(
                "aria-disabled",
                empty
                    ? "true"
                    : "false"
            );


            checkoutButton.classList.toggle(
                "disabled",
                empty
            );
        }


        if (clearButton) {

            clearButton.disabled =
                cart.length === 0;
        }
    }


    /* =========================================================================
       ACCESSIBILITY
       ========================================================================= */

    function announce(message) {

        let region =
            document.getElementById(
                "cart-live-region"
            );


        if (!region) {

            region =
                document.createElement(
                    "div"
                );


            region.id =
                "cart-live-region";


            region.className =
                "visually-hidden";


            region.setAttribute(
                "aria-live",
                "polite"
            );


            region.setAttribute(
                "aria-atomic",
                "true"
            );


            document.body.appendChild(
                region
            );
        }


        region.textContent =
            message;
    }


    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {

        const container =
            document.getElementById(
                "cart-items"
            );


        if (!container) {
            return;
        }


        container.innerHTML = `

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
                        <path d="M6 8h12l1 13H5L6 8Z"></path>
                        <path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
                    </svg>
                </div>

                <h2>Your cart is empty</h2>

                <p>
                    Discover our products and add
                    something you love.
                </p>

                <a
                    href="/"
                    class="continue-button"
                >
                    Continue Shopping
                </a>

            </div>
        `;
    }


    /* =========================================================================
       CART ITEM HTML
       ========================================================================= */

    function createCartItemHTML(item) {

        const id =
            String(item.id);


        const encodedId =
            encodeURIComponent(id);


        const name =
            escapeHTML(item.name);


        const category =
            escapeHTML(item.category);


        const image =
            escapeHTML(
                item.image ||
                FALLBACK_IMAGE
            );


        const price =
            Number(item.price) || 0;


        const quantity =
            Math.max(
                1,
                Math.min(
                    MAX_QUANTITY,
                    Number(item.quantity) || 1
                )
            );


        const itemSubtotal =
            price * quantity;


        return `

            <article
                class="cart-item"
                data-product-id="${escapeHTML(id)}"
            >

                <div class="cart-item-product">

                    <a
                        href="/product.html?id=${encodedId}"
                        class="cart-item-image-link"
                        aria-label="View ${name}"
                    >

                        <img
                            src="${image}"
                            alt="${name}"
                            class="cart-item-image"
                            loading="lazy"
                            decoding="async"
                            data-cart-image
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
                                href="/product.html?id=${encodedId}"
                            >
                                ${name}
                            </a>

                        </h2>


                        <p class="cart-item-price">
                            ${formatPrice(price)} each
                        </p>

                    </div>

                </div>


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
                            ${quantity <= 1 ? "disabled" : ""}
                        >
                            −
                        </button>


                        <input
                            type="number"
                            class="quantity-input"
                            data-role="quantity-input"
                            data-id="${escapeHTML(id)}"
                            value="${quantity}"
                            min="1"
                            max="${MAX_QUANTITY}"
                            inputmode="numeric"
                            aria-label="Quantity for ${name}"
                        >


                        <button
                            type="button"
                            data-action="increase"
                            data-id="${escapeHTML(id)}"
                            aria-label="Increase quantity of ${name}"
                            ${quantity >= MAX_QUANTITY ? "disabled" : ""}
                        >
                            +
                        </button>

                    </div>


                    <div class="cart-item-subtotal">

                        <strong data-role="subtotal">
                            ${formatPrice(itemSubtotal)}
                        </strong>


                        <button
                            type="button"
                            class="cart-remove-button"
                            data-action="remove"
                            data-id="${escapeHTML(id)}"
                            aria-label="Remove ${name} from cart"
                        >
                            Remove
                        </button>

                    </div>

                </div>

            </article>
        `;
    }


    /* =========================================================================
       IMAGE FALLBACKS
       ========================================================================= */

    function attachImageFallbacks() {

        const container =
            document.getElementById(
                "cart-items"
            );


        if (!container) {
            return;
        }


        container
            .querySelectorAll(
                "img[data-cart-image]"
            )
            .forEach(image => {

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

                    },
                    {
                        once: true
                    }
                );
            });
    }


    /* =========================================================================
       RENDER CART
       ========================================================================= */

    function renderCart() {

        updateCartHeader();

        updateSummary();


        const container =
            document.getElementById(
                "cart-items"
            );


        if (!container) {
            return;
        }


        if (!cart.length) {

            renderEmptyCart();

            return;
        }


        container.innerHTML =
            cart
                .map(createCartItemHTML)
                .join("");


        attachImageFallbacks();
    }


    /* =========================================================================
       UPDATE SINGLE ITEM
       ========================================================================= */

    function updateSingleItem(article, item) {

        if (!article) {
            return;
        }


        const quantity =
            Number(item.quantity) || 1;


        const subtotal =
            (Number(item.price) || 0) *
            quantity;


        const input =
            article.querySelector(
                '[data-role="quantity-input"]'
            );


        const subtotalElement =
            article.querySelector(
                '[data-role="subtotal"]'
            );


        const decrease =
            article.querySelector(
                '[data-action="decrease"]'
            );


        const increase =
            article.querySelector(
                '[data-action="increase"]'
            );


        if (input) {

            input.value =
                String(quantity);
        }


        if (decrease) {

            decrease.disabled =
                quantity <= 1;
        }


        if (increase) {

            increase.disabled =
                quantity >= MAX_QUANTITY;
        }


        if (subtotalElement) {

            subtotalElement.textContent =
                formatPrice(subtotal);
        }


        updateCartHeader();

        updateSummary();
    }


    /* =========================================================================
       ADD ITEM
       ========================================================================= */

    function addItem(rawItem, quantity = 1) {

        const normalized =
            normalizeCartItem({
                ...rawItem,
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

            existing.quantity =
                Math.min(
                    MAX_QUANTITY,
                    existing.quantity +
                    normalized.quantity
                );

        } else {

            cart.push(
                normalized
            );
        }


        saveCart();

        renderCart();


        announce(
            `Added ${normalized.name} to your cart.`
        );


        return true;
    }


    /* =========================================================================
       REMOVE ITEM
       ========================================================================= */

    function removeItem(id) {

        const stringId =
            String(id);


        const existing =
            cart.find(
                item =>
                    String(item.id) ===
                    stringId
            );


        if (!existing) {
            return false;
        }


        cart =
            cart.filter(
                item =>
                    String(item.id) !==
                    stringId
            );


        saveCart();

        renderCart();


        announce(
            `${existing.name} removed from your cart.`
        );


        return true;
    }


    /* =========================================================================
       UPDATE QUANTITY
       ========================================================================= */

    function updateQuantity(id, quantity) {

        const stringId =
            String(id);


        const item =
            cart.find(
                entry =>
                    String(entry.id) ===
                    stringId
            );


        if (!item) {
            return false;
        }


        let q =
            Number(quantity);


        if (
            !Number.isFinite(q) ||
            q < 1
        ) {
            q = 1;
        }


        q =
            Math.min(
                MAX_QUANTITY,
                Math.floor(q)
            );


        item.quantity =
            q;


        saveCart();

        renderCart();


        return true;
    }


    /* =========================================================================
       CLEAR CART
       ========================================================================= */

    function clearCart() {

        cart = [];

        saveCart();

        renderCart();

        announce(
            "Your cart has been cleared."
        );
    }


    /* =========================================================================
       EVENT LISTENERS
       ========================================================================= */

    function initCartApp() {

        const container =
            document.getElementById(
                "cart-items"
            );


        const checkoutButton =
            document.getElementById(
                "checkout-button"
            );


        const clearButton =
            document.getElementById(
                "clear-cart-button"
            );


        /* -------------------------------------------------------------
           Cart item buttons
           ------------------------------------------------------------- */

        if (container) {

            container.addEventListener(
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
                        button.dataset.id;


                    const item =
                        cart.find(
                            entry =>
                                String(entry.id) ===
                                String(id)
                        );


                    if (!item) {
                        return;
                    }


                    if (action === "remove") {

                        removeItem(id);

                        return;
                    }


                    if (action === "increase") {

                        if (
                            item.quantity >=
                            MAX_QUANTITY
                        ) {
                            return;
                        }


                        item.quantity += 1;


                        saveCart();


                        updateSingleItem(
                            button.closest(
                                ".cart-item"
                            ),
                            item
                        );


                        announce(
                            `${item.name} quantity increased to ${item.quantity}.`
                        );


                        return;
                    }


                    if (action === "decrease") {

                        if (
                            item.quantity <= 1
                        ) {
                            return;
                        }


                        item.quantity -= 1;


                        saveCart();


                        updateSingleItem(
                            button.closest(
                                ".cart-item"
                            ),
                            item
                        );


                        announce(
                            `${item.name} quantity decreased to ${item.quantity}.`
                        );
                    }

                }
            );


            /* -------------------------------------------------------------
               Quantity input
               ------------------------------------------------------------- */

            container.addEventListener(
                "change",
                event => {

                    const input =
                        event.target.closest(
                            '[data-role="quantity-input"]'
                        );


                    if (!input) {
                        return;
                    }


                    updateQuantity(
                        input.dataset.id,
                        input.value
                    );
                }
            );
        }


        /* -------------------------------------------------------------
           Clear cart
           ------------------------------------------------------------- */

        if (clearButton) {

            clearButton.addEventListener(
                "click",
                () => {

                    if (!cart.length) {
                        return;
                    }


                    if (
                        window.confirm(
                            "Are you sure you want to clear your cart?"
                        )
                    ) {
                        clearCart();
                    }
                }
            );
        }


        /* -------------------------------------------------------------
           Checkout
           ------------------------------------------------------------- */

        if (checkoutButton) {

            checkoutButton.addEventListener(
                "click",
                event => {

                    cart =
                        getCart();


                    if (!cart.length) {

                        event.preventDefault();

                        window.alert(
                            "Your cart is empty."
                        );


                        renderCart();

                        return;
                    }


                    /*
                     * If checkout.html exists,
                     * navigate there.
                     */

                    event.preventDefault();

                    window.location.href =
                        "/checkout.html";
                }
            );
        }


        /* -------------------------------------------------------------
           Initial hydration
           ------------------------------------------------------------- */

        cart =
            getCart();


        /*
         * Re-save normalized cart.
         * This also ensures older cart formats
         * become the canonical format.
         */

        writeStorage(
            CART_KEY,
            JSON.stringify(cart)
        );


        renderCart();
    }


    /* =========================================================================
       CROSS-TAB SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(event.key)
            ) {

                cart =
                    getCart();


                renderCart();
            }
        }
    );


    /* =========================================================================
       SAME-PAGE CART EVENT
       ========================================================================= */

    window.addEventListener(
        CART_EVENT_NAME,
        event => {

            /*
             * Accept both:
             *
             * detail.cart
             *
             * and
             *
             * detail
             *
             * for compatibility.
             */

            const incoming =
                Array.isArray(event.detail)
                    ? event.detail
                    : event.detail?.cart;


            if (!Array.isArray(incoming)) {
                return;
            }


            cart =
                incoming
                    .map(normalizeCartItem)
                    .filter(Boolean);


            renderCart();
        }
    );


    window.addEventListener(
        LEGACY_EVENT_NAME,
        () => {

            cart =
                getCart();


            renderCart();
        }
    );


    /* =========================================================================
       GLOBAL API
       ========================================================================= */

    window.PrasunCart = {

        getCart() {

            return cart.map(
                item => ({ ...item })
            );
        },


        getTotals() {

            const subtotal =
                getSubtotal();


            return {

                itemCount:
                    getTotalQuantity(),

                subtotal,

                formattedSubtotal:
                    formatPrice(subtotal)
            };
        },


        addItem,


        removeItem,


        updateQuantity,


        clearCart
    };


    /* =========================================================================
       START
       ========================================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initCartApp
        );

    } else {

        initCartApp();
    }

})();
