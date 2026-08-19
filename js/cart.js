/**
 * ============================================================================
 * PRASUN SHOP — CART SYSTEM
 * ============================================================================
 *
 * Canonical storage:
 *
 *     prasun_cart
 *
 * Cart item:
 *
 * {
 *   id: "internal storefront ID",
 *   cjProductId: "actual CJ product ID",
 *   cjPid: "actual CJ product ID",
 *   sku: "storefront/CJ SKU",
 *   cjSku: "CJ SKU",
 *   variantId: "CJ variant ID",
 *   variantSku: "CJ variant SKU",
 *   name: "display name",
 *   category: "category",
 *   price: 29.99,
 *   image: "https://...",
 *   quantity: 1
 * }
 *
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY =
        "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    const MAX_QUANTITY =
        99;

    const REQUEST_TIMEOUT_MS =
        12000;

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

    /* =========================================================================
       DOM
       ========================================================================= */

    const cartItemsElement =
        document.getElementById(
            "cart-items"
        );

    const cartCountElement =
        document.getElementById(
            "cart-count"
        );

    const cartItemsCountElement =
        document.getElementById(
            "cart-items-count"
        );

    const summaryItemCountElement =
        document.getElementById(
            "summary-item-count"
        );

    const cartSubtotalElement =
        document.getElementById(
            "cart-subtotal"
        );

    const cartTotalElement =
        document.getElementById(
            "cart-total"
        );

    const checkoutButton =
        document.getElementById(
            "checkout-button"
        );

    const clearCartButton =
        document.getElementById(
            "clear-cart-button"
        );

    const liveRegion =
        document.getElementById(
            "cart-live-region"
        );

    let cart = [];

    /* =========================================================================
       HELPERS
       ========================================================================= */

    function cleanString(
        value
    ) {

        return String(
            value ?? ""
        ).trim();
    }

    function firstNonEmpty(
        ...values
    ) {

        for (
            const value
            of values
        ) {

            const cleaned =
                cleanString(
                    value
                );

            if (cleaned) {
                return cleaned;
            }
        }

        return "";
    }

    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
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

    function formatPrice(
        value
    ) {

        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? currencyFormatter.format(
                number
            )
            : "$0.00";
    }

    function normalizeQuantity(
        value
    ) {

        const number =
            Number(value);

        if (
            !Number.isFinite(
                number
            ) ||
            number <= 0
        ) {
            return 1;
        }

        return Math.min(
            MAX_QUANTITY,
            Math.max(
                1,
                Math.floor(
                    number
                )
            )
        );
    }

    /* =========================================================================
       CJ IDENTITY
       ========================================================================= */

    function getProductIdentity(
        item
    ) {

        return firstNonEmpty(

            item?.cjProductId,

            item?.cjPid,

            item?.pid,

            item?.productId,

            item?.productID,

            item?.id
        );
    }

    function getSKU(
        item
    ) {

        return firstNonEmpty(

            item?.cjSku,

            item?.cjSKU,

            item?.productSku,

            item?.productSKU,

            item?.sku
        );
    }

    function getVariantIdentity(
        item
    ) {

        return firstNonEmpty(

            item?.variantId,

            item?.variantID,

            item?.vid,

            item?.cjVariantId
        );
    }

    function getVariantSKU(
        item
    ) {

        return firstNonEmpty(

            item?.variantSku,

            item?.variantSKU,

            item?.cjVariantSku
        );
    }

    /* =========================================================================
       CART NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            typeof item !==
                "object"
        ) {
            return null;
        }

        const cjProductId =
            getProductIdentity(
                item
            );

        /*
         * Legacy carts sometimes contain the product
         * name inside `id`.
         *
         * We preserve the name for display, but don't
         * deliberately create a fake CJ ID from it.
         */
        const name =
            firstNonEmpty(

                item.name,

                item.productName,

                item.title,

                /*
                 * Legacy compatibility only.
                 */
                typeof item.id ===
                    "string" &&
                !/^CJ/i.test(
                    item.id
                )
                    ? item.id
                    : ""
            );

        if (
            !cjProductId &&
            !name
        ) {
            return null;
        }

        const price =
            Number(
                item.price
            );

        const normalized = {

            id:
                firstNonEmpty(
                    item.id,
                    cjProductId
                ),

            sku:
                getSKU(
                    item
                ),

            cjProductId:
                cjProductId,

            cjPid:
                cjProductId,

            cjSku:
                getSKU(
                    item
                ),

            variantId:
                getVariantIdentity(
                    item
                ),

            variantSku:
                getVariantSKU(
                    item
                ),

            name:
                name ||
                "Product",

            category:
                firstNonEmpty(
                    item.category,
                    item.categoryName
                ),

            price:
                Number.isFinite(
                    price
                ) &&
                price >= 0
                    ? Number(
                        price.toFixed(
                            2
                        )
                    )
                    : 0,

            image:
                firstNonEmpty(
                    item.image,
                    item.imageUrl,
                    item.thumbnail
                ),

            quantity:
                normalizeQuantity(
                    item.quantity
                )
        };

        return normalized;
    }

    function normalizeCartArray(
        value
    ) {

        if (
            !Array.isArray(
                value
            )
        ) {
            return [];
        }

        return value
            .map(
                normalizeCartItem
            )
            .filter(Boolean);
    }

    /* =========================================================================
       STORAGE
       ========================================================================= */

    function readStorage(
        key
    ) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] localStorage read error:",
                error
            );

            return null;
        }
    }

    function writeStorage(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                value
            );

            return true;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] localStorage write error:",
                error
            );

            return false;
        }
    }

    function readCartFromStorage() {

        const primary =
            readStorage(
                CART_KEY
            );

        if (primary) {

            try {

                const parsed =
                    JSON.parse(
                        primary
                    );

                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    return normalizeCartArray(
                        parsed
                    );
                }

            } catch (error) {

                console.error(
                    "[PRASUN SHOP] Invalid primary cart:",
                    error
                );
            }
        }

        /*
         * Legacy migration.
         */
        for (
            const key
            of LEGACY_KEYS
        ) {

            const raw =
                readStorage(
                    key
                );

            if (!raw) {
                continue;
            }

            try {

                const parsed =
                    JSON.parse(
                        raw
                    );

                if (
                    !Array.isArray(
                        parsed
                    )
                ) {
                    continue;
                }

                const migrated =
                    normalizeCartArray(
                        parsed
                    );

                if (
                    migrated.length
                ) {

                    saveCart(
                        migrated
                    );

                    return migrated;
                }

            } catch (error) {

                console.error(
                    "[PRASUN SHOP] Legacy migration error:",
                    error
                );
            }
        }

        return [];
    }

    function saveCart(
        nextCart
    ) {

        cart =
            normalizeCartArray(
                nextCart
            );

        writeStorage(
            CART_KEY,
            JSON.stringify(
                cart
            )
        );

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: {
                        cart:
                            cart.map(
                                item =>
                                    ({
                                        ...item
                                    })
                            )
                    }
                }
            )
        );

        return cart;
    }

    function clearAllCartStorage() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            for (
                const key
                of LEGACY_KEYS
            ) {

                localStorage.removeItem(
                    key
                );
            }

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart clearing error:",
                error
            );
        }
    }

    /* =========================================================================
       CART IDENTITY
       ========================================================================= */

    function sameCartProduct(
        a,
        b
    ) {

        const aVariant =
            getVariantIdentity(
                a
            );

        const bVariant =
            getVariantIdentity(
                b
            );

        if (
            aVariant ||
            bVariant
        ) {

            return (
                aVariant &&
                bVariant &&
                aVariant ===
                    bVariant
            );
        }

        const aCJ =
            firstNonEmpty(
                a.cjProductId,
                a.cjPid,
                a.pid
            );

        const bCJ =
            firstNonEmpty(
                b.cjProductId,
                b.cjPid,
                b.pid
            );

        if (
            aCJ &&
            bCJ
        ) {

            return (
                aCJ ===
                bCJ
            );
        }

        const aSKU =
            getSKU(
                a
            );

        const bSKU =
            getSKU(
                b
            );

        if (
            aSKU &&
            bSKU
        ) {

            return (
                aSKU ===
                bSKU
            );
        }

        const aId =
            cleanString(
                a.id
            );

        const bId =
            cleanString(
                b.id
            );

        if (
            aId &&
            bId
        ) {

            return (
                aId ===
                bId
            );
        }

        return (
            cleanString(
                a.name
            ).toLowerCase() ===
            cleanString(
                b.name
            ).toLowerCase()
        );
    }

    /* =========================================================================
       CART OPERATIONS
       ========================================================================= */

    function addProduct(
        product,
        quantity = 1
    ) {

        if (
            !product ||
            typeof product !==
                "object"
        ) {
            return false;
        }

        const normalized =
            normalizeCartItem(
                {
                    ...product,
                    quantity
                }
            );

        if (!normalized) {

            console.error(
                "[PRASUN SHOP] Invalid product:",
                product
            );

            return false;
        }

        const existingIndex =
            cart.findIndex(
                item =>
                    sameCartProduct(
                        item,
                        normalized
                    )
            );

        if (
            existingIndex >= 0
        ) {

            const oldQuantity =
                normalizeQuantity(
                    cart[
                        existingIndex
                    ].quantity
                );

            cart[
                existingIndex
            ] = {

                ...cart[
                    existingIndex
                ],

                ...normalized,

                quantity:
                    normalizeQuantity(
                        oldQuantity +
                        normalized.quantity
                    )
            };

        } else {

            cart.push(
                normalized
            );
        }

        saveCart(
            cart
        );

        renderCart();

        announce(
            `${normalized.name} added to cart.`
        );

        return true;
    }

    function updateQuantity(
        index,
        quantity
    ) {

        if (
            !Number.isInteger(
                index
            ) ||
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        cart[index].quantity =
            normalizeQuantity(
                quantity
            );

        saveCart(
            cart
        );

        renderCart();

        announce(
            `${cart[index].name} quantity updated.`
        );
    }

    function removeItem(
        index
    ) {

        if (
            !Number.isInteger(
                index
            ) ||
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        const removed =
            cart[index];

        cart.splice(
            index,
            1
        );

        saveCart(
            cart
        );

        renderCart();

        announce(
            `${removed.name} removed from cart.`
        );
    }

    function clearCart() {

        cart = [];

        clearAllCartStorage();

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: {
                        cart: []
                    }
                }
            )
        );

        renderCart();

        announce(
            "Cart cleared."
        );
    }

    /* =========================================================================
       HEADER COUNT
       ========================================================================= */

    function updateHeaderCount() {

        const totalQuantity =
            cart.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    normalizeQuantity(
                        item.quantity
                    ),
                0
            );

        if (
            cartCountElement
        ) {

            cartCountElement.textContent =
                String(
                    totalQuantity
                );

            cartCountElement.hidden =
                totalQuantity <= 0;

            cartCountElement.setAttribute(
                "aria-label",
                `${totalQuantity} items in cart`
            );
        }

        if (
            cartItemsCountElement
        ) {

            cartItemsCountElement.textContent =
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                }`;
        }

        if (
            summaryItemCountElement
        ) {

            summaryItemCountElement.textContent =
                String(
                    totalQuantity
                );
        }
    }

    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {

        if (
            !cartItemsElement
        ) {
            return;
        }

        cartItemsElement.innerHTML = `

            <div
                class="cart-empty"
            >

                <div
                    class="cart-empty-icon"
                    aria-hidden="true"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <circle
                            cx="9"
                            cy="20"
                            r="1"
                        ></circle>

                        <circle
                            cx="19"
                            cy="20"
                            r="1"
                        ></circle>

                        <path
                            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"
                        ></path>

                    </svg>

                </div>

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Browse our products and add something
                    to your cart to continue shopping.
                </p>

                <a
                    href="/products.html"
                    class="continue-shopping"
                >
                    Continue Shopping
                </a>

            </div>

        `;
    }

    /* =========================================================================
       RENDER CART
       ========================================================================= */

    function renderCart() {

        cart =
            readCartFromStorage();

        updateHeaderCount();

        if (
            !cartItemsElement
        ) {
            return;
        }

        if (
            !cart.length
        ) {

            renderEmptyCart();

            if (
                cartSubtotalElement
            ) {

                cartSubtotalElement.textContent =
                    "$0.00";
            }

            if (
                cartTotalElement
            ) {

                cartTotalElement.textContent =
                    "$0.00";
            }

            if (
                checkoutButton
            ) {

                checkoutButton.disabled =
                    true;

                checkoutButton.setAttribute(
                    "aria-disabled",
                    "true"
                );
            }

            if (
                clearCartButton
            ) {

                clearCartButton.disabled =
                    true;
            }

            return;
        }

        let subtotal =
            0;

        const html =
            cart
                .map(
                    (
                        item,
                        index
                    ) => {

                        const quantity =
                            normalizeQuantity(
                                item.quantity
                            );

                        const price =
                            Number(
                                item.price
                            ) || 0;

                        const itemSubtotal =
                            price *
                            quantity;

                        subtotal +=
                            itemSubtotal;

                        const image =
                            escapeHTML(
                                item.image ||
                                ""
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

                        return `

                            <article
                                class="cart-item"
                                data-cart-index="${index}"
                            >

                                <div
                                    class="cart-item-product"
                                >

                                    <a
                                        href="/products.html"
                                        class="cart-item-image-link"
                                        aria-label="${name}"
                                    >

                                        ${
                                            image

                                                ? `
                                                    <img
                                                        src="${image}"
                                                        alt="${name}"
                                                        class="cart-item-image"
                                                        loading="lazy"
                                                        decoding="async"
                                                        onerror="this.onerror=null;this.style.display='none';"
                                                    >
                                                  `

                                                : `
                                                    <div
                                                        class="cart-item-image cart-item-image-placeholder"
                                                        aria-hidden="true"
                                                    >
                                                        🛍
                                                    </div>
                                                  `
                                        }

                                    </a>

                                    <div
                                        class="cart-item-info"
                                    >

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

                                        <h3
                                            class="cart-item-title"
                                        >

                                            <a
                                                href="/products.html"
                                            >
                                                ${name}
                                            </a>

                                        </h3>

                                        <p
                                            class="cart-item-price"
                                        >
                                            ${formatPrice(
                                                price
                                            )}
                                            each
                                        </p>

                                    </div>

                                </div>

                                <div
                                    class="cart-item-controls"
                                >

                                    <div
                                        class="quantity-control"
                                        aria-label="Quantity controls"
                                    >

                                        <button
                                            type="button"
                                            data-action="decrease"
                                            data-index="${index}"
                                            aria-label="Decrease quantity"
                                        >
                                            −
                                        </button>

                                        <input
                                            class="quantity-input"
                                            type="number"
                                            min="1"
                                            max="${MAX_QUANTITY}"
                                            value="${quantity}"
                                            data-action="quantity"
                                            data-index="${index}"
                                            aria-label="Quantity for ${name}"
                                        >

                                        <button
                                            type="button"
                                            data-action="increase"
                                            data-index="${index}"
                                            aria-label="Increase quantity"
                                        >
                                            +
                                        </button>

                                    </div>

                                    <div
                                        class="cart-item-subtotal"
                                    >

                                        <strong>
                                            ${formatPrice(
                                                itemSubtotal
                                            )}
                                        </strong>

                                        <button
                                            type="button"
                                            class="cart-remove-button"
                                            data-action="remove"
                                            data-index="${index}"
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

        cartItemsElement.innerHTML =
            html;

        if (
            cartSubtotalElement
        ) {

            cartSubtotalElement.textContent =
                formatPrice(
                    subtotal
                );
        }

        if (
            cartTotalElement
        ) {

            cartTotalElement.textContent =
                formatPrice(
                    subtotal
                );
        }

        if (
            checkoutButton
        ) {

            checkoutButton.disabled =
                false;

            checkoutButton.setAttribute(
                "aria-disabled",
                "false"
            );
        }

        if (
            clearCartButton
        ) {

            clearCartButton.disabled =
                false;
        }
    }

    /* =========================================================================
       EVENTS
       ========================================================================= */

    function announce(
        message
    ) {

        if (
            !liveRegion
        ) {
            return;
        }

        liveRegion.textContent =
            "";

        window.setTimeout(
            () => {

                liveRegion.textContent =
                    message;

            },
            20
        );
    }

    if (
        cartItemsElement
    ) {

        cartItemsElement.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "button[data-action]"
                    );

                if (!button) {
                    return;
                }

                const index =
                    Number(
                        button.dataset.index
                    );

                const action =
                    button.dataset.action;

                if (
                    !Number.isInteger(
                        index
                    )
                ) {
                    return;
                }

                if (
                    action ===
                    "increase"
                ) {

                    updateQuantity(
                        index,
                        cart[index]
                            .quantity + 1
                    );
                }

                if (
                    action ===
                    "decrease"
                ) {

                    updateQuantity(
                        index,
                        cart[index]
                            .quantity - 1
                    );
                }

                if (
                    action ===
                    "remove"
                ) {

                    removeItem(
                        index
                    );
                }
            }
        );

        cartItemsElement.addEventListener(
            "change",
            event => {

                const input =
                    event.target.closest(
                        'input[data-action="quantity"]'
                    );

                if (!input) {
                    return;
                }

                const index =
                    Number(
                        input.dataset.index
                    );

                updateQuantity(
                    index,
                    Number(
                        input.value
                    )
                );
            }
        );
    }

    if (
        checkoutButton
    ) {

        checkoutButton.addEventListener(
            "click",
            () => {

                if (
                    !cart.length
                ) {
                    return;
                }

                /*
                 * Store the current cart again before
                 * opening checkout.
                 */
                saveCart(
                    cart
                );

                window.location.href =
                    "/checkout.html";
            }
        );
    }

    if (
        clearCartButton
    ) {

        clearCartButton.addEventListener(
            "click",
            () => {

                if (
                    !cart.length
                ) {
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

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                    CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {

                cart =
                    readCartFromStorage();

                renderCart();
            }
        }
    );

    window.addEventListener(
        "prasunCartUpdated",
        () => {

            cart =
                readCartFromStorage();

            renderCart();
        }
    );

    /* =========================================================================
       PUBLIC API
       ========================================================================= */

    window.PrasunCart = {

        getCart:
            () =>
                readCartFromStorage(),

        add:
            addProduct,

        addProduct:
            addProduct,

        updateQuantity:
            updateQuantity,

        removeItem:
            removeItem,

        clear:
            clearCart,

        clearCart:
            clearCart,

        save:
            saveCart,

        render:
            renderCart
    };

    /* =========================================================================
       INITIALIZE
       ========================================================================= */

    cart =
        readCartFromStorage();

    renderCart();

})();
