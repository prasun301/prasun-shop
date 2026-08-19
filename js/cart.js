/**
 * ============================================================================
 * PRASUN SHOP — CART MANAGEMENT
 * cart.js
 * Production-ready cart system
 * ============================================================================
 *
 * Features:
 * - Persistent localStorage cart
 * - Legacy cart migration
 * - Add / remove / increase / decrease quantity
 * - Direct quantity editing
 * - Cart count synchronization
 * - Subtotal / total calculation
 * - Empty-cart rendering
 * - Loading-state protection
 * - Image fallback
 * - Cross-tab synchronization
 * - Custom cart events
 * - Public window.PrasunCart API
 * - Safe HTML escaping
 * - Works independently of the product API
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const CART_EVENT_NAME = "prasunCartUpdated";

    const MAX_QUANTITY = 99;

    const CART_PAGE = "cart.html";

    /* =========================================================================
       2. SAFE MEMORY STORAGE FALLBACK
       ========================================================================= */

    let memoryStorage = {};

    function isLocalStorageAvailable() {
        try {
            const testKey = "__prasun_cart_test__";

            window.localStorage.setItem(testKey, "1");
            window.localStorage.removeItem(testKey);

            return true;
        } catch (error) {
            return false;
        }
    }

    const hasLocalStorage = isLocalStorageAvailable();

    function getStorageItem(key) {
        if (hasLocalStorage) {
            try {
                return window.localStorage.getItem(key);
            } catch (error) {
                console.warn(
                    "[PRASUN SHOP] Unable to read localStorage:",
                    error
                );
            }
        }

        return Object.prototype.hasOwnProperty.call(memoryStorage, key)
            ? memoryStorage[key]
            : null;
    }

    function setStorageItem(key, value) {
        const stringValue = String(value);

        if (hasLocalStorage) {
            try {
                window.localStorage.setItem(key, stringValue);
                return true;
            } catch (error) {
                console.warn(
                    "[PRASUN SHOP] Unable to write localStorage:",
                    error
                );
            }
        }

        memoryStorage[key] = stringValue;

        return true;
    }

    function removeStorageItem(key) {
        if (hasLocalStorage) {
            try {
                window.localStorage.removeItem(key);
            } catch (error) {
                console.warn(
                    "[PRASUN SHOP] Unable to remove localStorage item:",
                    error
                );
            }
        }

        delete memoryStorage[key];
    }

    /* =========================================================================
       3. CURRENCY
       ========================================================================= */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function formatPrice(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "$0.00";
        }

        return currencyFormatter.format(number);
    }

    /* =========================================================================
       4. FALLBACK IMAGE
       ========================================================================= */

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="500"
                height="500"
                viewBox="0 0 500 500"
            >
                <rect
                    width="500"
                    height="500"
                    fill="#f1f5f9"
                />

                <path
                    d="M160 190h180v150H160z"
                    fill="none"
                    stroke="#94a3b8"
                    stroke-width="8"
                    rx="8"
                />

                <circle
                    cx="220"
                    cy="240"
                    r="18"
                    fill="#94a3b8"
                />

                <path
                    d="M175 315l55-55 38 38 28-27 29 44"
                    fill="none"
                    stroke="#94a3b8"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <text
                    x="250"
                    y="390"
                    text-anchor="middle"
                    fill="#64748b"
                    font-family="Arial,sans-serif"
                    font-size="22"
                >
                    Image unavailable
                </text>
            </svg>
        `);

    /* =========================================================================
       5. HTML ESCAPING
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
       6. IMAGE URL SANITIZATION
       ========================================================================= */

    function getSafeImageURL(value) {
        if (!value) {
            return FALLBACK_IMAGE;
        }

        const image = String(value).trim();

        if (!image) {
            return FALLBACK_IMAGE;
        }

        /*
         * Allow:
         * - https://
         * - http://
         * - relative URLs
         * - data:image
         * - blob:
         */

        if (
            image.startsWith("https://") ||
            image.startsWith("http://") ||
            image.startsWith("/") ||
            image.startsWith("./") ||
            image.startsWith("../") ||
            image.startsWith("data:image/") ||
            image.startsWith("blob:")
        ) {
            return image;
        }

        return FALLBACK_IMAGE;
    }

    /* =========================================================================
       7. ACCESSIBILITY
       ========================================================================= */

    function announce(message) {
        if (!document.body) {
            return;
        }

        let liveRegion = document.getElementById("cart-live-region");

        if (!liveRegion) {
            liveRegion = document.createElement("div");

            liveRegion.id = "cart-live-region";
            liveRegion.className = "visually-hidden";

            liveRegion.setAttribute("aria-live", "polite");
            liveRegion.setAttribute("aria-atomic", "true");

            document.body.appendChild(liveRegion);
        }

        liveRegion.textContent = "";

        window.setTimeout(() => {
            liveRegion.textContent = message;
        }, 20);
    }

    /* =========================================================================
       8. NORMALIZE CART ITEM
       ========================================================================= */

    function normalizeCartItem(item) {
        if (!item || typeof item !== "object") {
            return null;
        }

        if (
            item.id === undefined ||
            item.id === null ||
            String(item.id).trim() === ""
        ) {
            return null;
        }

        const id = String(item.id);

        const priceNumber = Number(
            item.price ??
            item.salePrice ??
            item.productPrice ??
            0
        );

        const quantityNumber = Number(
            item.quantity ??
            item.qty ??
            1
        );

        const ratingNumber = Number(item.rating);

        const safePrice =
            Number.isFinite(priceNumber) && priceNumber >= 0
                ? priceNumber
                : 0;

        let safeQuantity =
            Number.isFinite(quantityNumber) && quantityNumber > 0
                ? Math.floor(quantityNumber)
                : 1;

        safeQuantity = Math.min(
            MAX_QUANTITY,
            Math.max(1, safeQuantity)
        );

        const safeRating =
            Number.isFinite(ratingNumber)
                ? Math.min(5, Math.max(0, ratingNumber))
                : 5;

        return {
            id,

            sku: String(
                item.sku ??
                item.productSku ??
                item.SKU ??
                id
            ),

            name: String(
                item.name ??
                item.productName ??
                item.title ??
                "Product"
            ),

            price: safePrice,

            image: String(
                item.image ??
                item.productImage ??
                item.imageUrl ??
                item.thumbnail ??
                ""
            ),

            category: String(
                item.category ??
                item.categoryName ??
                ""
            ),

            description: String(
                item.description ?? ""
            ),

            rating: safeRating,

            features: Array.isArray(item.features)
                ? item.features
                : [],

            specifications:
                item.specifications &&
                typeof item.specifications === "object"
                    ? item.specifications
                    : {},

            quantity: safeQuantity
        };
    }

    /* =========================================================================
       9. PARSE CART JSON
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
            console.warn(
                "[PRASUN SHOP] Invalid cart data. Resetting cart.",
                error
            );

            return [];
        }
    }

    /* =========================================================================
       10. MERGE DUPLICATE ITEMS
       ========================================================================= */

    function mergeDuplicateItems(items) {
        const map = new Map();

        for (const item of items) {
            if (!item) {
                continue;
            }

            const id = String(item.id);

            if (map.has(id)) {
                const existing = map.get(id);

                existing.quantity = Math.min(
                    MAX_QUANTITY,
                    existing.quantity + item.quantity
                );
            } else {
                map.set(id, {
                    ...item
                });
            }
        }

        return Array.from(map.values());
    }

    /* =========================================================================
       11. LOAD CART
       ========================================================================= */

    function loadCart() {
        try {
            /* Primary cart */

            const primaryCart = getStorageItem(CART_KEY);

            if (primaryCart !== null) {
                return mergeDuplicateItems(
                    parseCart(primaryCart)
                );
            }

            /* Legacy cart migration */

            for (const legacyKey of LEGACY_KEYS) {
                const legacyData = getStorageItem(legacyKey);

                if (!legacyData) {
                    continue;
                }

                const migratedCart = mergeDuplicateItems(
                    parseCart(legacyData)
                );

                if (migratedCart.length > 0) {
                    setStorageItem(
                        CART_KEY,
                        JSON.stringify(migratedCart)
                    );

                    for (const key of LEGACY_KEYS) {
                        removeStorageItem(key);
                    }

                    return migratedCart;
                }
            }

            return [];

        } catch (error) {
            console.error(
                "[PRASUN SHOP] Failed to load cart:",
                error
            );

            return [];
        }
    }

    /* =========================================================================
       12. CART STATE
       ========================================================================= */

    let cart = loadCart();

    /* =========================================================================
       13. SAVE CART
       ========================================================================= */

    function saveCart(options = {}) {
        const silent =
            typeof options === "boolean"
                ? options
                : Boolean(options.silent);

        try {
            const cleanCart = mergeDuplicateItems(
                cart
                    .map(normalizeCartItem)
                    .filter(Boolean)
            );

            cart = cleanCart;

            setStorageItem(
                CART_KEY,
                JSON.stringify(cart)
            );

            /*
             * Remove obsolete legacy keys.
             */

            LEGACY_KEYS.forEach(key => {
                removeStorageItem(key);
            });

            /*
             * Notify same-page scripts.
             */

            window.dispatchEvent(
                new CustomEvent(CART_EVENT_NAME, {
                    detail: {
                        cart: cart.map(item => ({
                            ...item
                        })),
                        silent
                    }
                })
            );

            /*
             * Backward compatibility.
             */

            window.dispatchEvent(
                new CustomEvent("cartUpdated", {
                    detail: {
                        cart: cart.map(item => ({
                            ...item
                        })),
                        silent
                    }
                })
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
       14. CART TOTAL QUANTITY
       ========================================================================= */

    function getTotalQuantity() {
        return cart.reduce(
            (total, item) => {
                const quantity = Number(item.quantity);

                if (
                    Number.isFinite(quantity) &&
                    quantity > 0
                ) {
                    return total + Math.floor(quantity);
                }

                return total;
            },
            0
        );
    }

    /* =========================================================================
       15. CART SUBTOTAL
       ========================================================================= */

    function calculateSubtotal() {
        return cart.reduce(
            (total, item) => {
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;

                return total + price * quantity;
            },
            0
        );
    }

    /* =========================================================================
       16. UPDATE CART HEADER
       ========================================================================= */

    function updateCartHeader() {
        const totalQuantity = getTotalQuantity();

        const countElements = [
            document.getElementById("cart-count"),
            document.getElementById("cart-items-count")
        ];

        const cartCount = countElements[0];
        const cartItemsCount = countElements[1];

        if (cartCount) {
            cartCount.textContent = String(totalQuantity);

            /*
             * Don't permanently hide the counter if your CSS expects
             * it to remain visible.
             */

            cartCount.hidden = totalQuantity === 0;

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

        /*
         * Support alternate cart count elements.
         */

        document
            .querySelectorAll(
                "[data-cart-count]"
            )
            .forEach(element => {
                element.textContent =
                    String(totalQuantity);

                element.setAttribute(
                    "data-cart-count",
                    String(totalQuantity)
                );
            });
    }

    /* =========================================================================
       17. UPDATE TOTALS
       ========================================================================= */

    function updateTotals() {
        const subtotal = calculateSubtotal();

        const subtotalElements = [
            document.getElementById("cart-subtotal"),
            document.querySelector(
                "[data-cart-subtotal]"
            )
        ];

        const totalElements = [
            document.getElementById("cart-total"),
            document.querySelector(
                "[data-cart-total]"
            )
        ];

        subtotalElements.forEach(element => {
            if (element) {
                element.textContent =
                    formatPrice(subtotal);
            }
        });

        totalElements.forEach(element => {
            if (element) {
                element.textContent =
                    formatPrice(subtotal);
            }
        });

        const checkoutButton =
            document.getElementById(
                "checkout-button"
            );

        const clearButton =
            document.getElementById(
                "clear-cart-button"
            );

        const empty =
            cart.length === 0;

        if (checkoutButton) {
            checkoutButton.disabled = empty;

            checkoutButton.classList.toggle(
                "disabled",
                empty
            );

            checkoutButton.setAttribute(
                "aria-disabled",
                String(empty)
            );
        }

        if (clearButton) {
            clearButton.disabled = empty;
        }
    }

    /* =========================================================================
       18. REMOVE LOADING STATE
       ========================================================================= */

    function removeLoadingState() {
        const container =
            document.getElementById("cart-items");

        if (container) {
            container.classList.remove(
                "loading",
                "is-loading"
            );

            container.removeAttribute(
                "aria-busy"
            );
        }

        /*
         * Remove common loading elements if present.
         */

        document
            .querySelectorAll(
                "#cart-loading, .cart-loading, [data-cart-loading]"
            )
            .forEach(element => {
                element.remove();
            });

        /*
         * Remove text-only loading placeholder.
         */

        if (container) {
            const loadingChildren =
                Array.from(container.children);

            loadingChildren.forEach(child => {
                const text =
                    child.textContent
                        ?.trim()
                        .toLowerCase();

                if (
                    text === "loading..." ||
                    text === "loading…"
                ) {
                    child.remove();
                }
            });
        }
    }

    /* =========================================================================
       19. EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {
        const container =
            document.getElementById("cart-items");

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
                    something you love to your shopping cart.
                </p>

                <a
                    href="products.html"
                    class="continue-button"
                >
                    Continue Shopping
                </a>
            </div>
        `;
    }

    /* =========================================================================
       20. CREATE CART ITEM
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
                getSafeImageURL(item.image)
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

        const subtotal =
            price * quantity;

        return `
            <article
                class="cart-item"
                data-product-id="${escapeHTML(id)}"
            >

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
                            ${
                                quantity <= 1
                                    ? 'aria-disabled="true"'
                                    : ""
                            }
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
                            step="1"
                            inputmode="numeric"
                            aria-label="Quantity for ${name}"
                        >

                        <button
                            type="button"
                            data-action="increase"
                            data-id="${escapeHTML(id)}"
                            aria-label="Increase quantity of ${name}"
                            ${
                                quantity >= MAX_QUANTITY
                                    ? 'aria-disabled="true"'
                                    : ""
                            }
                        >
                            +
                        </button>

                    </div>


                    <div class="cart-item-subtotal">

                        <strong
                            data-role="subtotal"
                        >
                            ${formatPrice(subtotal)}
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
       21. IMAGE FALLBACKS
       ========================================================================= */

    function attachImageFallbacks() {
        const container =
            document.getElementById("cart-items");

        if (!container) {
            return;
        }

        const images =
            container.querySelectorAll(
                "img[data-cart-image]"
            );

        images.forEach(image => {
            image.addEventListener(
                "error",
                () => {
                    if (
                        image.dataset.fallbackApplied ===
                        "true"
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
       22. RENDER CART
       ========================================================================= */

    function renderCart() {
        /*
         * Always update header/totals first.
         */

        updateCartHeader();
        updateTotals();

        const container =
            document.getElementById("cart-items");

        /*
         * If cart.html doesn't have #cart-items,
         * don't throw an exception.
         */

        if (!container) {
            console.warn(
                "[PRASUN SHOP] #cart-items was not found in cart.html."
            );

            removeLoadingState();

            return;
        }

        /*
         * IMPORTANT:
         * Remove Loading state BEFORE rendering.
         */

        removeLoadingState();

        /*
         * Empty cart.
         */

        if (!cart.length) {
            renderEmptyCart();
            return;
        }

        /*
         * Render products.
         */

        container.innerHTML =
            cart
                .map(createCartItemHTML)
                .join("");

        container.setAttribute(
            "aria-busy",
            "false"
        );

        attachImageFallbacks();
    }

    /* =========================================================================
       23. UPDATE ONE ITEM WITHOUT FULL RENDER
       ========================================================================= */

    function updateSingleItemDOM(
        article,
        item
    ) {
        if (!article || !item) {
            return;
        }

        const quantity =
            Number(item.quantity) || 1;

        const price =
            Number(item.price) || 0;

        const subtotal =
            price * quantity;

        const input =
            article.querySelector(
                '[data-role="quantity-input"]'
            );

        const subtotalElement =
            article.querySelector(
                '[data-role="subtotal"]'
            );

        const decreaseButton =
            article.querySelector(
                '[data-action="decrease"]'
            );

        const increaseButton =
            article.querySelector(
                '[data-action="increase"]'
            );

        if (input) {
            input.value =
                String(quantity);
        }

        if (subtotalElement) {
            subtotalElement.textContent =
                formatPrice(subtotal);
        }

        if (decreaseButton) {
            decreaseButton.setAttribute(
                "aria-disabled",
                String(quantity <= 1)
            );
        }

        if (increaseButton) {
            increaseButton.setAttribute(
                "aria-disabled",
                String(quantity >= MAX_QUANTITY)
            );
        }

        updateCartHeader();
        updateTotals();
    }

    /* =========================================================================
       24. FIND CART ITEM
       ========================================================================= */

    function findCartItem(id) {
        const stringId =
            String(id);

        return cart.find(
            item =>
                String(item.id) === stringId
        );
    }

    /* =========================================================================
       25. SET QUANTITY
       ========================================================================= */

    function setQuantity(id, quantity) {
        const item =
            findCartItem(id);

        if (!item) {
            return false;
        }

        let newQuantity =
            Number(quantity);

        if (!Number.isFinite(newQuantity)) {
            newQuantity = 1;
        }

        newQuantity =
            Math.floor(newQuantity);

        /*
         * Quantity 0 removes item.
         */

        if (newQuantity <= 0) {
            removeItem(id);
            return true;
        }

        newQuantity =
            Math.min(
                MAX_QUANTITY,
                Math.max(1, newQuantity)
            );

        item.quantity =
            newQuantity;

        saveCart();

        return true;
    }

    /* =========================================================================
       26. REMOVE ITEM
       ========================================================================= */

    function removeItem(id) {
        const stringId =
            String(id);

        const item =
            findCartItem(stringId);

        if (!item) {
            return false;
        }

        cart =
            cart.filter(
                entry =>
                    String(entry.id) !==
                    stringId
            );

        saveCart();

        renderCart();

        announce(
            `${item.name} removed from cart.`
        );

        return true;
    }

    /* =========================================================================
       27. INITIALIZE CART APP
       ========================================================================= */

    function initCartApp() {
        /*
         * Make sure DOM exists.
         */

        if (!document.body) {
            return;
        }

        /*
         * Re-read cart from storage.
         */

        cart =
            loadCart();

        /*
         * Save normalized version.
         */

        setStorageItem(
            CART_KEY,
            JSON.stringify(cart)
        );

        /*
         * Remove legacy keys.
         */

        LEGACY_KEYS.forEach(key => {
            removeStorageItem(key);
        });

        const container =
            document.getElementById("cart-items");

        const checkoutButton =
            document.getElementById(
                "checkout-button"
            );

        const clearCartButton =
            document.getElementById(
                "clear-cart-button"
            );

        /* =====================================================================
           CART CLICK EVENTS
           ===================================================================== */

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
                        String(
                            button.dataset.id || ""
                        );

                    const item =
                        findCartItem(id);

                    if (!item) {
                        return;
                    }

                    const article =
                        button.closest(
                            ".cart-item"
                        );

                    /* ---------------------------------------------------------
                       REMOVE
                       --------------------------------------------------------- */

                    if (action === "remove") {
                        removeItem(id);
                        return;
                    }

                    /* ---------------------------------------------------------
                       INCREASE
                       --------------------------------------------------------- */

                    if (action === "increase") {
                        if (
                            item.quantity >=
                            MAX_QUANTITY
                        ) {
                            return;
                        }

                        item.quantity += 1;

                        saveCart();

                        updateSingleItemDOM(
                            article,
                            item
                        );

                        announce(
                            `Increased ${item.name} quantity to ${item.quantity}.`
                        );

                        return;
                    }

                    /* ---------------------------------------------------------
                       DECREASE
                       --------------------------------------------------------- */

                    if (action === "decrease") {
                        if (
                            item.quantity <= 1
                        ) {
                            return;
                        }

                        item.quantity -= 1;

                        saveCart();

                        updateSingleItemDOM(
                            article,
                            item
                        );

                        announce(
                            `Decreased ${item.name} quantity to ${item.quantity}.`
                        );
                    }
                }
            );

            /* =================================================================
               QUANTITY INPUT
               ================================================================= */

            container.addEventListener(
                "change",
                event => {
                    const input =
                        event.target.closest(
                            'input[data-role="quantity-input"]'
                        );

                    if (!input) {
                        return;
                    }

                    const id =
                        String(
                            input.dataset.id || ""
                        );

                    const item =
                        findCartItem(id);

                    if (!item) {
                        return;
                    }

                    let quantity =
                        parseInt(
                            input.value,
                            10
                        );

                    if (
                        !Number.isFinite(
                            quantity
                        )
                    ) {
                        quantity = 1;
                    }

                    quantity =
                        Math.min(
                            MAX_QUANTITY,
                            Math.max(
                                1,
                                quantity
                            )
                        );

                    item.quantity =
                        quantity;

                    saveCart();

                    updateSingleItemDOM(
                        input.closest(
                            ".cart-item"
                        ),
                        item
                    );

                    announce(
                        `Updated ${item.name} quantity to ${quantity}.`
                    );
                }
            );

            /* ================================================================
               QUANTITY INPUT ENTER / BLUR SAFETY
               ================================================================ */

            container.addEventListener(
                "blur",
                event => {
                    const input =
                        event.target.closest(
                            'input[data-role="quantity-input"]'
                        );

                    if (!input) {
                        return;
                    }

                    const item =
                        findCartItem(
                            input.dataset.id
                        );

                    if (!item) {
                        return;
                    }

                    let quantity =
                        parseInt(
                            input.value,
                            10
                        );

                    if (
                        !Number.isFinite(
                            quantity
                        )
                    ) {
                        quantity = 1;
                    }

                    quantity =
                        Math.min(
                            MAX_QUANTITY,
                            Math.max(
                                1,
                                quantity
                            )
                        );

                    if (
                        quantity !==
                        item.quantity
                    ) {
                        item.quantity =
                            quantity;

                        saveCart();

                        updateSingleItemDOM(
                            input.closest(
                                ".cart-item"
                            ),
                            item
                        );
                    }
                },
                true
            );
        }

        /* =====================================================================
           CHECKOUT
           ===================================================================== */

        if (checkoutButton) {
            checkoutButton.addEventListener(
                "click",
                event => {
                    /*
                     * Always use latest storage state.
                     */

                    cart =
                        loadCart();

                    if (!cart.length) {
                        event.preventDefault();

                        alert(
                            "Your cart is empty."
                        );

                        renderCart();

                        return;
                    }

                    /*
                     * If your checkout page exists,
                     * allow normal navigation.
                     *
                     * Otherwise your existing href/action
                     * will be used.
                     */
                }
            );
        }

        /* =====================================================================
           CLEAR CART
           ===================================================================== */

        if (clearCartButton) {
            clearCartButton.addEventListener(
                "click",
                () => {
                    if (!cart.length) {
                        return;
                    }

                    const confirmed =
                        window.confirm(
                            "Are you sure you want to clear your cart?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    cart = [];

                    saveCart();

                    renderCart();

                    announce(
                        "Cart cleared."
                    );
                }
            );
        }

        /*
         * FIRST RENDER.
         *
         * This is intentionally synchronous.
         * No API call is required.
         * No product API is required.
         */

        renderCart();

        /*
         * Extra safety:
         * if another script inserted "Loading..." after initialization,
         * render again on the next event loop.
         */

        window.setTimeout(
            () => {
                if (
                    document.getElementById(
                        "cart-items"
                    )
                ) {
                    renderCart();
                }
            },
            0
        );
    }

    /* =========================================================================
       28. INITIALIZATION
       ========================================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initCartApp,
            {
                once: true
            }
        );
    } else {
        initCartApp();
    }

    /* =========================================================================
       29. CROSS-TAB STORAGE SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {
                cart =
                    loadCart();

                renderCart();
            }
        }
    );

    /* =========================================================================
       30. PRASUN CART EVENT
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
                    event.detail.cart
                        .map(
                            normalizeCartItem
                        )
                        .filter(Boolean);

                renderCart();
            }
        }
    );

    /* =========================================================================
       31. LEGACY CART EVENT
       ========================================================================= */

    window.addEventListener(
        "cartUpdated",
        () => {
            cart =
                loadCart();

            renderCart();
        }
    );

    /* =========================================================================
       32. PUBLIC GLOBAL API
       ========================================================================= */

    window.PrasunCart = {

        /* ---------------------------------------------------------------------
           Get cart
           --------------------------------------------------------------------- */

        getCart() {
            return cart.map(
                item => ({
                    ...item
                })
            );
        },

        /* ---------------------------------------------------------------------
           Get quantity
           --------------------------------------------------------------------- */

        getItemCount() {
            return getTotalQuantity();
        },

        /* ---------------------------------------------------------------------
           Get subtotal
           --------------------------------------------------------------------- */

        getSubtotal() {
            return calculateSubtotal();
        },

        /* ---------------------------------------------------------------------
           Get totals
           --------------------------------------------------------------------- */

        getTotals() {
            const itemCount =
                getTotalQuantity();

            const subtotal =
                calculateSubtotal();

            return {
                itemCount,
                subtotal,
                total: subtotal,
                formattedSubtotal:
                    formatPrice(subtotal),
                formattedTotal:
                    formatPrice(subtotal)
            };
        },

        /* ---------------------------------------------------------------------
           Check if item exists
           --------------------------------------------------------------------- */

        hasItem(id) {
            return Boolean(
                findCartItem(id)
            );
        },

        /* ---------------------------------------------------------------------
           Add item
           --------------------------------------------------------------------- */

        addItem(
            rawItem,
            quantity = 1
        ) {
            const normalized =
                normalizeCartItem({
                    ...rawItem,
                    quantity
                });

            if (!normalized) {
                console.warn(
                    "[PRASUN SHOP] Invalid product passed to addItem()."
                );

                return false;
            }

            const existing =
                findCartItem(
                    normalized.id
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
                `${normalized.name} added to cart.`
            );

            return true;
        },

        /* ---------------------------------------------------------------------
           Remove item
           --------------------------------------------------------------------- */

        removeItem(id) {
            return removeItem(id);
        },

        /* ---------------------------------------------------------------------
           Update quantity
           --------------------------------------------------------------------- */

        updateQuantity(
            id,
            quantity
        ) {
            const item =
                findCartItem(id);

            if (!item) {
                return false;
            }

            const numericQuantity =
                Number(quantity);

            if (
                !Number.isFinite(
                    numericQuantity
                )
            ) {
                return false;
            }

            if (
                numericQuantity <= 0
            ) {
                return removeItem(id);
            }

            item.quantity =
                Math.min(
                    MAX_QUANTITY,
                    Math.max(
                        1,
                        Math.floor(
                            numericQuantity
                        )
                    )
                );

            saveCart();

            renderCart();

            return true;
        },

        /* ---------------------------------------------------------------------
           Clear cart
           --------------------------------------------------------------------- */

        clearCart() {
            cart = [];

            saveCart();

            renderCart();

            announce(
                "Cart emptied."
            );

            return true;
        },

        /* ---------------------------------------------------------------------
           Refresh
           --------------------------------------------------------------------- */

        refresh() {
            cart =
                loadCart();

            renderCart();

            return this.getCart();
        }
    };

    /* =========================================================================
       33. DEBUG HELPER
       ========================================================================= */

    /*
     * Open browser console and run:
     *
     * PrasunCart.getCart()
     * PrasunCart.getTotals()
     *
     * to inspect the current cart.
     */

    window.PrasunCartReady = true;

})();
