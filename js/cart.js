/**
 * ============================================================================
 * PRASUN SHOP — CANONICAL CART SYSTEM
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH:
 *
 *     localStorage["prasun_cart"]
 *
 * script.js NEVER writes directly to this storage.
 *
 * checkout.js reads the same structure.
 *
 * The cart preserves:
 *
 *   - internal product ID
 *   - CJ product ID
 *   - SKU
 *   - CJ SKU
 *   - variant ID
 *   - variant SKU
 *   - productData / original CJ object
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

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

    const CART_EVENT_NAME =
        "prasunCartUpdated";

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

    /* =========================================================================
       STATE
       ========================================================================= */

    let cart = [];

    let productCache =
        new Map();

    let productFetchPromise =
        null;

    /* =========================================================================
       FORMATTING
       ========================================================================= */

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

        return Number.isFinite(
            number
        )
            ? currencyFormatter.format(
                number
            )
            : "$0.00";
    }

    /* =========================================================================
       HELPERS
       ========================================================================= */

    function escapeHTML(value) {

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

    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();
    }

    function firstNonEmpty(
        ...values
    ) {

        for (
            const value of values
        ) {

            const cleaned =
                cleanString(value);

            if (cleaned) {
                return cleaned;
            }
        }

        return "";
    }

    function normalizeQuantity(
        value
    ) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number <= 0
        ) {
            return 1;
        }

        return Math.min(
            MAX_QUANTITY,
            Math.max(
                1,
                Math.floor(number)
            )
        );
    }

    /* =========================================================================
       CJ PRODUCT IDENTITY
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

    function getVariantIdentity(
        item
    ) {

        return firstNonEmpty(

            item?.variantId,

            item?.variantID,

            item?.variant_id,

            item?.vid,

            item?.cjVariantId,

            item?.cjVariantID
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

            item?.productSkuEn,

            item?.sku
        );
    }

    function getVariantSKU(
        item
    ) {

        return firstNonEmpty(

            item?.variantSku,

            item?.variantSKU,

            item?.cjVariantSku,

            item?.cjVariantSKU
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
            typeof item !== "object"
        ) {
            return null;
        }

        const productData =
            item.productData &&
            typeof item.productData ===
                "object"
                ? item.productData
                : {};

        /*
         * Search both the cart item and original CJ object.
         */
        const id =
            firstNonEmpty(

                item.id,

                item.cjProductId,

                item.cjPid,

                item.pid,

                item.productId,

                productData.id,

                productData.cjProductId,

                productData.cjPid,

                productData.pid,

                productData.productId
            );

        const cjProductId =
            firstNonEmpty(

                item.cjProductId,

                item.cjPid,

                item.pid,

                item.productId,

                productData.cjProductId,

                productData.cjPid,

                productData.pid,

                productData.productId,

                productData.id
            );

        const sku =
            firstNonEmpty(

                item.sku,

                item.cjSku,

                item.productSku,

                productData.sku,

                productData.cjSku,

                productData.productSku,

                productData.productSkuEn
            );

        const cjSku =
            firstNonEmpty(

                item.cjSku,

                item.cjSKU,

                item.productSku,

                item.productSKU,

                productData.cjSku,

                productData.cjSKU,

                productData.productSku,

                productData.productSKU,

                productData.productSkuEn,

                productData.sku
            );

        const variantId =
            firstNonEmpty(

                item.variantId,

                item.variantID,

                item.vid,

                item.cjVariantId,

                productData.variantId,

                productData.variantID,

                productData.vid,

                productData.cjVariantId
            );

        const variantSku =
            firstNonEmpty(

                item.variantSku,

                item.variantSKU,

                item.cjVariantSku,

                item.cjVariantSKU,

                productData.variantSku,

                productData.variantSKU,

                productData.cjVariantSku,

                productData.cjVariantSKU
            );

        const name =
            firstNonEmpty(

                item.name,

                item.productName,

                item.title,

                productData.name,

                productData.productName,

                productData.title
            );

        if (
            !id &&
            !cjProductId &&
            !sku &&
            !cjSku &&
            !name
        ) {

            return null;
        }

        const rawPrice =
            Number(
                item.price ??
                productData.price ??
                productData.sellPrice ??
                productData.discountPrice ??
                0
            );

        const price =
            Number.isFinite(
                rawPrice
            ) &&
            rawPrice >= 0
                ? Number(
                    rawPrice.toFixed(2)
                )
                : 0;

        const image =
            firstNonEmpty(

                item.image,

                item.imageUrl,

                item.thumbnail,

                productData.image,

                productData.imageUrl,

                productData.bigImage,

                productData.productImage,

                Array.isArray(
                    productData.images
                )
                    ? productData.images[0]
                    : ""
            );

        return {

            id:
                id || "",

            sku:
                sku || cjSku || "",

            cjProductId:
                cjProductId || id || "",

            cjSku:
                cjSku || sku || "",

            variantId:
                variantId || "",

            variantSku:
                variantSku || "",

            name:
                name ||
                "Product",

            category:
                firstNonEmpty(

                    item.category,

                    item.categoryName,

                    productData.category,

                    productData.categoryName
                ),

            price,

            image,

            quantity:
                normalizeQuantity(
                    item.quantity
                ),

            /*
             * Preserve original CJ product data.
             */
            productData
        };
    }

    function normalizeCartArray(
        value
    ) {

        if (!Array.isArray(value)) {
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
                    Array.isArray(parsed)
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
            const key of LEGACY_KEYS
        ) {

            const raw =
                readStorage(key);

            if (!raw) {
                continue;
            }

            try {

                const parsed =
                    JSON.parse(raw);

                if (
                    !Array.isArray(parsed)
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
                    "[PRASUN SHOP] Legacy cart migration error:",
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
            JSON.stringify(cart)
        );

        dispatchCartEvent();

        return cart;
    }

    function dispatchCartEvent() {

        window.dispatchEvent(
            new CustomEvent(
                CART_EVENT_NAME,
                {
                    detail: {
                        cart:
                            cart.map(
                                item => ({
                                    ...item
                                })
                            )
                    }
                }
            )
        );
    }

    function clearAllCartStorage() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            for (
                const key of LEGACY_KEYS
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
       CART IDENTITY / MERGING
       ========================================================================= */

    function sameCartProduct(
        a,
        b
    ) {

        const aVariant =
            getVariantIdentity(a);

        const bVariant =
            getVariantIdentity(b);

        /*
         * If both have variants, compare variants.
         */
        if (
            aVariant &&
            bVariant
        ) {

            return (
                aVariant ===
                bVariant
            );
        }

        /*
         * If only one has a variant, do not accidentally merge
         * it with the base product.
         */
        if (
            aVariant ||
            bVariant
        ) {

            return false;
        }

        const aProduct =
            firstNonEmpty(
                a.cjProductId,
                a.id
            );

        const bProduct =
            firstNonEmpty(
                b.cjProductId,
                b.id
            );

        if (
            aProduct &&
            bProduct
        ) {

            return (
                aProduct ===
                bProduct
            );
        }

        const aSku =
            getSKU(a);

        const bSku =
            getSKU(b);

        if (
            aSku &&
            bSku
        ) {

            return (
                aSku ===
                bSku
            );
        }

        return (
            cleanString(a.name)
                .toLowerCase() ===
            cleanString(b.name)
                .toLowerCase()
        );
    }

    /* =========================================================================
       ADD PRODUCT
       ========================================================================= */

    function addProduct(
        product,
        quantity = 1
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {

            console.error(
                "[PRASUN SHOP] Invalid product:",
                product
            );

            return false;
        }

        const normalized =
            normalizeCartItem({
                ...product,
                quantity
            });

        if (!normalized) {

            console.error(
                "[PRASUN SHOP] Product could not be normalized:",
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

            const addedQuantity =
                normalizeQuantity(
                    normalized.quantity
                );

            const newQuantity =
                Math.min(
                    MAX_QUANTITY,
                    oldQuantity +
                        addedQuantity
                );

            cart[
                existingIndex
            ] = {

                ...cart[
                    existingIndex
                ],

                ...normalized,

                /*
                 * Never lose existing productData if
                 * the latest object does not have it.
                 */
                productData:
                    Object.keys(
                        normalized.productData ||
                        {}
                    ).length
                        ? normalized.productData
                        : cart[
                            existingIndex
                        ].productData,

                quantity:
                    newQuantity
            };

        } else {

            cart.push(
                normalized
            );
        }

        saveCart(cart);

        renderCart();

        announce(
            `${normalized.name} added to cart.`
        );

        return true;
    }

    /* =========================================================================
       UPDATE QUANTITY
       ========================================================================= */

    function updateQuantity(
        index,
        quantity
    ) {

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        const normalized =
            normalizeQuantity(
                quantity
            );

        cart[index].quantity =
            normalized;

        saveCart(cart);

        renderCart();

        announce(
            `${cart[index].name} quantity updated to ${normalized}.`
        );
    }

    /* =========================================================================
       REMOVE
       ========================================================================= */

    function removeItem(
        index
    ) {

        if (
            !Number.isInteger(index) ||
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

        saveCart(cart);

        renderCart();

        announce(
            `${removed.name} removed from cart.`
        );
    }

    /* =========================================================================
       CLEAR
       ========================================================================= */

    function clearCart() {

        cart = [];

        clearAllCartStorage();

        dispatchCartEvent();

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
                (sum, item) =>
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
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                } in cart`
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

        if (!cartItemsElement) {
            return;
        }

        cartItemsElement.innerHTML = `

            <div
                class="cart-empty"
                role="status"
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

        let subtotal = 0;

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
                                                    ></div>
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
                                            ${formatPrice(price)}
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
                                            ${formatPrice(itemSubtotal)}
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
       ANNOUNCEMENT
       ========================================================================= */

    function announce(
        message
    ) {

        if (!liveRegion) {
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

    /* =========================================================================
       EVENTS
       ========================================================================= */

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
                            .quantity +
                            1
                    );
                }

                if (
                    action ===
                    "decrease"
                ) {

                    const newQuantity =
                        cart[index]
                            .quantity -
                        1;

                    if (
                        newQuantity <= 0
                    ) {

                        removeItem(
                            index
                        );

                    } else {

                        updateQuantity(
                            index,
                            newQuantity
                        );
                    }
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

                /*
                 * Always refresh from storage so checkout
                 * receives the current canonical cart.
                 */
                cart =
                    readCartFromStorage();

                if (
                    !cart.length
                ) {
                    return;
                }

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
        CART_EVENT_NAME,
        event => {

            if (
                event?.detail?.cart &&
                Array.isArray(
                    event.detail.cart
                )
            ) {

                cart =
                    normalizeCartArray(
                        event.detail.cart
                    );

            } else {

                cart =
                    readCartFromStorage();
            }

            renderCart();
        }
    );

    /* =========================================================================
       PRODUCT ENRICHMENT
       ========================================================================= */

    async function fetchWithTimeout(
        resource,
        options = {},
        timeout =
            REQUEST_TIMEOUT_MS
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () =>
                    controller.abort(),
                timeout
            );

        try {

            return await fetch(
                resource,
                {
                    ...options,
                    signal:
                        controller.signal
                }
            );

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Product request timed out."
                );
            }

            throw error;

        } finally {

            clearTimeout(
                timer
            );
        }
    }

    async function fetchProducts() {

        if (
            productCache.size > 0
        ) {

            return productCache;
        }

        if (
            productFetchPromise
        ) {

            return productFetchPromise;
        }

        productFetchPromise =
            (async () => {

                try {

                    const response =
                        await fetchWithTimeout(
                            PRODUCTS_ENDPOINT,
                            {
                                method: "GET",

                                headers: {
                                    Accept:
                                        "application/json"
                                },

                                cache:
                                    "no-store"
                            }
                        );

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `Product API HTTP ${response.status}`
                        );
                    }

                    const data =
                        await response.json();

                    const products =
                        Array.isArray(data)
                            ? data
                            : Array.isArray(
                                data?.products
                            )
                                ? data.products
                                : Array.isArray(
                                    data?.items
                                )
                                    ? data.items
                                    : Array.isArray(
                                        data?.data?.products
                                    )
                                        ? data.data.products
                                        : [];

                    for (
                        const product
                        of products
                    ) {

                        if (
                            !product
                        ) {
                            continue;
                        }

                        const keys = [

                            product.id,

                            product.pid,

                            product.productId,

                            product.productID,

                            product.sku,

                            product.productSku,

                            product.productSKU,

                            product.productSkuEn,

                            product.cjProductId,

                            product.cjSku
                        ];

                        for (
                            const key
                            of keys
                        ) {

                            if (
                                key !==
                                    undefined &&
                                key !==
                                    null &&
                                String(
                                    key
                                ).trim()
                            ) {

                                productCache.set(
                                    String(
                                        key
                                    ),
                                    product
                                );
                            }
                        }
                    }

                    return productCache;

                } finally {

                    productFetchPromise =
                        null;
                }

            })();

        return productFetchPromise;
    }

    function findCachedProduct(
        item
    ) {

        const keys = [

            item.cjProductId,

            item.cjPid,

            item.pid,

            item.id,

            item.cjSku,

            item.sku,

            item.variantId,

            item.variantSku
        ];

        for (
            const key of keys
        ) {

            if (!key) {
                continue;
            }

            const product =
                productCache.get(
                    String(key)
                );

            if (product) {
                return product;
            }
        }

        return null;
    }

    async function enrichCart() {

        if (!cart.length) {
            return;
        }

        try {

            await fetchProducts();

            let changed = false;

            const enriched =
                cart.map(
                    item => {

                        const product =
                            findCachedProduct(
                                item
                            );

                        if (!product) {
                            return item;
                        }

                        changed = true;

                        const productData =
                            product;

                        const price =
                            Number(
                                item.price
                            );

                        const productPrice =
                            Number(
                                product.discountPrice ??
                                product.nowPrice ??
                                product.sellPrice ??
                                product.price ??
                                0
                            );

                        return {

                            ...item,

                            id:
                                firstNonEmpty(
                                    item.id,
                                    product.id,
                                    product.pid,
                                    product.productId
                                ),

                            sku:
                                firstNonEmpty(
                                    item.sku,
                                    product.sku,
                                    product.productSku
                                ),

                            cjProductId:
                                firstNonEmpty(
                                    item.cjProductId,
                                    product.cjProductId,
                                    product.cjPid,
                                    product.pid,
                                    product.productId,
                                    product.id
                                ),

                            cjSku:
                                firstNonEmpty(
                                    item.cjSku,
                                    product.cjSku,
                                    product.productSku,
                                    product.productSkuEn,
                                    product.sku
                                ),

                            variantId:
                                firstNonEmpty(
                                    item.variantId,
                                    product.variantId,
                                    product.variantID
                                ),

                            variantSku:
                                firstNonEmpty(
                                    item.variantSku,
                                    product.variantSku,
                                    product.variantSKU
                                ),

                            name:
                                firstNonEmpty(
                                    item.name,
                                    product.name,
                                    product.title
                                ),

                            category:
                                firstNonEmpty(
                                    item.category,
                                    product.category,
                                    product.categoryName
                                ),

                            image:
                                firstNonEmpty(
                                    item.image,
                                    product.image,
                                    product.imageUrl,
                                    product.bigImage,
                                    product.productImage
                                ),

                            price:
                                Number.isFinite(
                                    price
                                ) &&
                                price > 0
                                    ? price
                                    : (
                                        Number.isFinite(
                                            productPrice
                                        )
                                            ? productPrice
                                            : 0
                                    ),

                            productData:
                                item.productData &&
                                Object.keys(
                                    item.productData
                                ).length
                                    ? item.productData
                                    : productData
                        };
                    }
                );

            if (changed) {

                saveCart(
                    enriched
                );

                renderCart();
            }

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] Cart enrichment skipped:",
                error?.message ||
                    error
            );
        }
    }

    /* =========================================================================
       PUBLIC API
       ========================================================================= */

    window.PrasunCart = {

        getCart:
            () =>
                normalizeCartArray(
                    readCartFromStorage()
                ),

        add:
            addProduct,

        addProduct,

        updateQuantity,

        removeItem,

        clear:
            clearCart,

        clearCart,

        save:
            saveCart,

        render:
            renderCart,

        getKey:
            () => CART_KEY
    };

    /* =========================================================================
       INITIALIZE
       ========================================================================= */

    cart =
        readCartFromStorage();

    renderCart();

    /*
     * Enrich old/legacy cart entries after initial rendering.
     */
    if (cart.length) {

        enrichCart();
    }

})();
