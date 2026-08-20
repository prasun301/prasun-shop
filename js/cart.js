/**
 * ============================================================================
 * PRASUN SHOP — CART SYSTEM
 * ============================================================================
 *
 * SUPPLIER:
 *     ALIEXPRESS ONLY
 *
 * CANONICAL STORAGE:
 *
 *     prasun_cart
 *
 * CART ITEM:
 *
 * {
 *   id: "storefront product ID",
 *   aliexpress_id: "AliExpress product ID",
 *   aliexpressId: "AliExpress product ID",
 *
 *   sku: "storefront / supplier SKU",
 *
 *   variantId: "AliExpress variant ID",
 *   variantSku: "AliExpress variant SKU",
 *   variantOptions: "Color: Black; Size: M",
 *
 *   name: "Product name",
 *   category: "Category",
 *
 *   price: 29.99,
 *
 *   image: "https://...",
 *
 *   quantity: 1
 * }
 *
 * IMPORTANT:
 *
 *     - No CJ Dropshipping
 *     - No CJ API
 *     - No supplier credentials in browser
 *     - Cart is only a storefront cart
 *     - Worker validates product/price during checkout
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    /*
     * Legacy cart keys.
     *
     * These are read only for migration/compatibility.
     */
    const LEGACY_KEYS = [
        "store_cart",
        "ae_dropship_cart",
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const MAX_QUANTITY = 99;

    const CHECKOUT_URL = "/checkout.html";

    const PRODUCTS_URL = "/products.html";


    /* =========================================================================
       CURRENCY
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


    /* =========================================================================
       DOM
       ========================================================================= */

    const cartItemsElement =
        document.getElementById("cart-items");

    const cartCountElement =
        document.getElementById("cart-count");

    const cartItemsCountElement =
        document.getElementById("cart-items-count");

    const summaryItemCountElement =
        document.getElementById("summary-item-count");

    const cartSubtotalElement =
        document.getElementById("cart-subtotal");

    const cartTotalElement =
        document.getElementById("cart-total");

    const checkoutButton =
        document.getElementById("checkout-button");

    const clearCartButton =
        document.getElementById("clear-cart-button");

    const liveRegion =
        document.getElementById("cart-live-region");


    let cart = [];


    /* =========================================================================
       BASIC HELPERS
       ========================================================================= */

    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();

    }


    function firstNonEmpty(...values) {

        for (const value of values) {

            const cleaned =
                cleanString(value);

            if (cleaned) {
                return cleaned;
            }

        }

        return "";

    }


    function escapeHTML(value) {

        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function escapeAttribute(value) {

        return escapeHTML(value);

    }


    function formatPrice(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return "$0.00";
        }

        return currencyFormatter.format(number);

    }


    function normalizeQuantity(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
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


    function normalizePrice(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number < 0
        ) {
            return 0;
        }

        return Number(
            number.toFixed(2)
        );

    }


    /* =========================================================================
       ALIEXPRESS PRODUCT ID
       ========================================================================= */

    function getAliExpressProductId(item) {

        return firstNonEmpty(

            item?.aliexpress_id,

            item?.aliexpressId,

            item?.aliExpressId,

            item?.aliProductId,

            item?.productId,

            item?.productID

        );

    }


    /* =========================================================================
       STOREFRONT PRODUCT ID
       ========================================================================= */

    function getStorefrontId(item) {

        return firstNonEmpty(

            item?.id,

            item?.storefrontId,

            item?.storefrontID,

            item?.productId,

            item?.productID,

            getAliExpressProductId(item)

        );

    }


    /* =========================================================================
       SKU
       ========================================================================= */

    function getSKU(item) {

        return firstNonEmpty(

            item?.sku,

            item?.productSku,

            item?.productSKU,

            item?.supplierSku,

            item?.supplierSKU

        );

    }


    /* =========================================================================
       VARIANT ID
       ========================================================================= */

    function getVariantId(item) {

        return firstNonEmpty(

            item?.variantId,

            item?.variantID,

            item?.aliVariantId,

            item?.aliVariantID

        );

    }


    /* =========================================================================
       VARIANT SKU
       ========================================================================= */

    function getVariantSKU(item) {

        return firstNonEmpty(

            item?.variantSku,

            item?.variantSKU,

            item?.aliVariantSku,

            item?.aliVariantSKU

        );

    }


    /* =========================================================================
       VARIANT OPTIONS
       ========================================================================= */

    function getVariantOptions(item) {

        return firstNonEmpty(

            item?.variantOptions,

            item?.variant_options,

            item?.options,

            item?.selectedOptions

        );

    }


    /* =========================================================================
       PRODUCT NAME
       ========================================================================= */

    function getProductName(item) {

        return firstNonEmpty(

            item?.name,

            item?.productName,

            item?.title,

            item?.product_title,

            item?.productTitle

        );

    }


    /* =========================================================================
       PRODUCT IMAGE
       ========================================================================= */

    function getProductImage(item) {

        return firstNonEmpty(

            item?.image,

            item?.imageUrl,

            item?.imageURL,

            item?.thumbnail,

            item?.thumbnailUrl,

            item?.productImage,

            item?.mainImage

        );

    }


    /* =========================================================================
       PRODUCT CATEGORY
       ========================================================================= */

    function getProductCategory(item) {

        return firstNonEmpty(

            item?.category,

            item?.categoryName,

            item?.category_name

        );

    }


    /* =========================================================================
       CART ITEM NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(item) {

        if (
            !item ||
            typeof item !== "object"
        ) {
            return null;
        }


        const storefrontId =
            getStorefrontId(item);

        const aliexpressId =
            getAliExpressProductId(item);

        const name =
            getProductName(item);


        /*
         * Product identity is required.
         */
        if (
            !storefrontId &&
            !aliexpressId &&
            !name
        ) {
            return null;
        }


        const sku =
            getSKU(item);

        const variantId =
            getVariantId(item);

        const variantSku =
            getVariantSKU(item);

        const variantOptions =
            getVariantOptions(item);


        return {

            /*
             * Canonical storefront ID.
             */
            id:
                storefrontId ||
                aliexpressId ||
                name,


            /*
             * AliExpress supplier product ID.
             */
            aliexpress_id:
                aliexpressId,


            /*
             * Camel-case compatibility.
             */
            aliexpressId:
                aliexpressId,


            /*
             * Product SKU.
             */
            sku:
                sku,


            /*
             * Variant information.
             */
            variantId:
                variantId,

            variantSku:
                variantSku,

            variantOptions:
                variantOptions,


            /*
             * Display information.
             */
            name:
                name ||
                "Product",

            category:
                getProductCategory(item),


            /*
             * Storefront price.
             *
             * This is only used for display.
             * The Worker remains authoritative at checkout.
             */
            price:
                normalizePrice(
                    item?.price
                ),


            image:
                getProductImage(item),


            quantity:
                normalizeQuantity(
                    item?.quantity
                )

        };

    }


    function normalizeCartArray(value) {

        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .map(normalizeCartItem)
            .filter(Boolean);

    }


    /* =========================================================================
       LOCAL STORAGE
       ========================================================================= */

    function readStorage(key) {

        try {

            return localStorage.getItem(key);

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Unable to read localStorage:",
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
                "[PRASUN SHOP] Unable to write localStorage:",
                error
            );

            return false;

        }

    }


    function removeStorage(key) {

        try {

            localStorage.removeItem(key);

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Unable to remove localStorage item:",
                error
            );

        }

    }


    /* =========================================================================
       READ CART
       ========================================================================= */

    function parseStoredCart(raw) {

        if (!raw) {
            return [];
        }

        try {

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return normalizeCartArray(parsed);

        } catch (error) {

            return [];

        }

    }


    function readCartFromStorage() {

        /*
         * First priority:
         *
         * prasun_cart
         */
        const primary =
            readStorage(CART_KEY);

        if (primary) {

            const parsed =
                parseStoredCart(primary);

            if (parsed.length) {
                return parsed;
            }

            /*
             * Empty but valid primary cart.
             */
            try {

                const value =
                    JSON.parse(primary);

                if (Array.isArray(value)) {
                    return [];
                }

            } catch (_) {}

        }


        /*
         * Legacy migration.
         */
        for (const key of LEGACY_KEYS) {

            const raw =
                readStorage(key);

            if (!raw) {
                continue;
            }

            const migrated =
                parseStoredCart(raw);

            if (!migrated.length) {
                continue;
            }


            /*
             * Save the migrated cart
             * into the canonical location.
             */
            writeStorage(
                CART_KEY,
                JSON.stringify(migrated)
            );


            return migrated;

        }


        return [];

    }


    /* =========================================================================
       SAVE CART
       ========================================================================= */

    function saveCart(nextCart) {

        cart =
            normalizeCartArray(nextCart);


        writeStorage(
            CART_KEY,
            JSON.stringify(cart)
        );


        /*
         * Keep old cart keys removed.
         *
         * This prevents multiple independent carts
         * from appearing on the same browser.
         */
        for (const key of LEGACY_KEYS) {
            removeStorage(key);
        }


        dispatchCartUpdate();


        return cart;

    }


    /* =========================================================================
       CART UPDATE EVENT
       ========================================================================= */

    function dispatchCartUpdate() {

        try {

            window.dispatchEvent(
                new CustomEvent(
                    "prasunCartUpdated",
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

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart event error:",
                error
            );

        }

    }


    /* =========================================================================
       CLEAR CART STORAGE
       ========================================================================= */

    function clearAllCartStorage() {

        removeStorage(CART_KEY);

        for (const key of LEGACY_KEYS) {
            removeStorage(key);
        }

    }


    /* =========================================================================
       PRODUCT IDENTITY
       ========================================================================= */

    function sameCartProduct(
        a,
        b
    ) {

        /*
         * Variant ID is the strongest identity.
         */
        const aVariantId =
            getVariantId(a);

        const bVariantId =
            getVariantId(b);


        if (
            aVariantId &&
            bVariantId
        ) {

            return (
                aVariantId ===
                bVariantId
            );

        }


        /*
         * A variant item must not merge
         * with a non-variant item.
         */
        if (
            aVariantId ||
            bVariantId
        ) {

            return false;

        }


        /*
         * If both have variant SKU,
         * use variant SKU.
         */
        const aVariantSku =
            getVariantSKU(a);

        const bVariantSku =
            getVariantSKU(b);


        if (
            aVariantSku &&
            bVariantSku
        ) {

            if (
                aVariantSku.toLowerCase() !==
                bVariantSku.toLowerCase()
            ) {

                return false;

            }

        }


        /*
         * Variant options must also match.
         */
        const aOptions =
            getVariantOptions(a);

        const bOptions =
            getVariantOptions(b);


        if (
            aOptions &&
            bOptions
        ) {

            if (
                aOptions.toLowerCase() !==
                bOptions.toLowerCase()
            ) {

                return false;

            }

        }


        /*
         * AliExpress product ID.
         */
        const aAli =
            getAliExpressProductId(a);

        const bAli =
            getAliExpressProductId(b);


        if (
            aAli &&
            bAli
        ) {

            return (
                aAli ===
                bAli
            );

        }


        /*
         * SKU fallback.
         */
        const aSKU =
            getSKU(a);

        const bSKU =
            getSKU(b);


        if (
            aSKU &&
            bSKU
        ) {

            return (
                aSKU.toLowerCase() ===
                bSKU.toLowerCase()
            );

        }


        /*
         * Storefront ID fallback.
         */
        const aId =
            cleanString(a.id);

        const bId =
            cleanString(b.id);


        if (
            aId &&
            bId
        ) {

            return (
                aId ===
                bId
            );

        }


        /*
         * Final fallback:
         * product name.
         */
        const aName =
            cleanString(a.name)
                .toLowerCase();

        const bName =
            cleanString(b.name)
                .toLowerCase();


        return Boolean(
            aName &&
            bName &&
            aName === bName
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
                "[PRASUN SHOP] Invalid product passed to cart."
            );

            return false;

        }


        /*
         * Refresh cart before modifying it.
         */
        cart =
            readCartFromStorage();


        const normalized =
            normalizeCartItem(
                {
                    ...product,
                    quantity:
                        normalizeQuantity(
                            quantity
                        )
                }
            );


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


        if (existingIndex >= 0) {

            const existing =
                cart[existingIndex];


            const newQuantity =
                normalizeQuantity(
                    existing.quantity +
                    normalized.quantity
                );


            /*
             * Refresh product information
             * while preserving accumulated quantity.
             */
            cart[existingIndex] = {

                ...existing,

                ...normalized,

                quantity:
                    newQuantity

            };

        } else {

            cart.push(normalized);

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

            return false;

        }


        const item =
            cart[index];


        const newQuantity =
            normalizeQuantity(quantity);


        item.quantity =
            newQuantity;


        saveCart(cart);

        renderCart();


        announce(
            `${item.name} quantity updated to ${newQuantity}.`
        );


        return true;

    }


    /* =========================================================================
       REMOVE ITEM
       ========================================================================= */

    function removeItem(index) {

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= cart.length
        ) {

            return false;

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


        return true;

    }


    /* =========================================================================
       CLEAR CART
       ========================================================================= */

    function clearCart() {

        cart = [];

        clearAllCartStorage();

        dispatchCartUpdate();

        renderCart();


        announce(
            "Cart cleared."
        );

    }


    /* =========================================================================
       TOTAL QUANTITY
       ========================================================================= */

    function getTotalQuantity() {

        return cart.reduce(
            (
                total,
                item
            ) => {

                return (
                    total +
                    normalizeQuantity(
                        item.quantity
                    )
                );

            },
            0
        );

    }


    /* =========================================================================
       SUBTOTAL
       ========================================================================= */

    function getSubtotal() {

        return Number(
            cart.reduce(
                (
                    total,
                    item
                ) => {

                    const price =
                        normalizePrice(
                            item.price
                        );

                    const quantity =
                        normalizeQuantity(
                            item.quantity
                        );


                    return (
                        total +
                        (
                            price *
                            quantity
                        )
                    );

                },
                0
            ).toFixed(2)
        );

    }


    /* =========================================================================
       UPDATE HEADER COUNT
       ========================================================================= */

    function updateHeaderCount() {

        const totalQuantity =
            getTotalQuantity();


        if (cartCountElement) {

            cartCountElement.textContent =
                String(totalQuantity);


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


        if (cartItemsCountElement) {

            cartItemsCountElement.textContent =
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                }`;

        }


        if (summaryItemCountElement) {

            summaryItemCountElement.textContent =
                String(totalQuantity);

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

            <div class="cart-empty">

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
                    href="${PRODUCTS_URL}"
                    class="continue-shopping"
                >
                    Continue Shopping
                </a>

            </div>

        `;

    }


    /* =========================================================================
       IMAGE FALLBACK
       ========================================================================= */

    function handleImageError(image) {

        if (!image) {
            return;
        }


        image.style.display =
            "none";


        const parent =
            image.parentElement;


        if (!parent) {
            return;
        }


        if (
            parent.querySelector(
                ".cart-item-image-placeholder"
            )
        ) {
            return;
        }


        const placeholder =
            document.createElement("div");


        placeholder.className =
            "cart-item-image cart-item-image-placeholder";


        placeholder.setAttribute(
            "aria-hidden",
            "true"
        );


        placeholder.textContent =
            "🛍";


        parent.appendChild(
            placeholder
        );

    }


    /* =========================================================================
       RENDER CART
       ========================================================================= */

    function renderCart() {

        cart =
            readCartFromStorage();


        updateHeaderCount();


        if (!cartItemsElement) {
            return;
        }


        if (!cart.length) {

            renderEmptyCart();


            if (cartSubtotalElement) {
                cartSubtotalElement.textContent =
                    "$0.00";
            }


            if (cartTotalElement) {
                cartTotalElement.textContent =
                    "$0.00";
            }


            if (checkoutButton) {

                checkoutButton.disabled =
                    true;

                checkoutButton.setAttribute(
                    "aria-disabled",
                    "true"
                );

            }


            if (clearCartButton) {
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
                            normalizePrice(
                                item.price
                            );


                        const itemSubtotal =
                            Number(
                                (
                                    price *
                                    quantity
                                ).toFixed(2)
                            );


                        subtotal +=
                            itemSubtotal;


                        const image =
                            escapeAttribute(
                                item.image
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


                        const variantId =
                            escapeHTML(
                                getVariantId(item)
                            );


                        const variantSKU =
                            escapeHTML(
                                getVariantSKU(item)
                            );


                        const variantOptions =
                            escapeHTML(
                                getVariantOptions(item)
                            );


                        let variantText =
                            "";


                        if (variantOptions) {

                            variantText =
                                variantOptions;

                        } else if (variantSKU) {

                            variantText =
                                `SKU: ${variantSKU}`;

                        } else if (variantId) {

                            variantText =
                                `Variant: ${variantId}`;

                        }


                        return `

                            <article
                                class="cart-item"
                                data-cart-index="${index}"
                            >

                                <div
                                    class="cart-item-product"
                                >

                                    <a
                                        href="${PRODUCTS_URL}"
                                        class="cart-item-image-link"
                                        aria-label="${escapeAttribute(name)}"
                                    >

                                        ${
                                            image

                                                ? `
                                                    <img
                                                        src="${image}"
                                                        alt="${escapeAttribute(name)}"
                                                        class="cart-item-image"
                                                        loading="lazy"
                                                        decoding="async"
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
                                                href="${PRODUCTS_URL}"
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


                                        ${
                                            variantText

                                                ? `
                                                    <p
                                                        class="cart-item-variant"
                                                    >
                                                        ${variantText}
                                                    </p>
                                                  `

                                                : ""
                                        }

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
                                            aria-label="Decrease quantity of ${escapeAttribute(name)}"
                                            ${
                                                quantity <= 1
                                                    ? "disabled"
                                                    : ""
                                            }
                                        >
                                            −
                                        </button>


                                        <input
                                            class="quantity-input"
                                            type="number"
                                            min="1"
                                            max="${MAX_QUANTITY}"
                                            step="1"
                                            value="${quantity}"
                                            data-action="quantity"
                                            data-index="${index}"
                                            aria-label="Quantity for ${escapeAttribute(name)}"
                                            inputmode="numeric"
                                        >


                                        <button
                                            type="button"
                                            data-action="increase"
                                            data-index="${index}"
                                            aria-label="Increase quantity of ${escapeAttribute(name)}"
                                            ${
                                                quantity >= MAX_QUANTITY
                                                    ? "disabled"
                                                    : ""
                                            }
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


        /*
         * Image error handling.
         */
        const images =
            cartItemsElement.querySelectorAll(
                "img.cart-item-image"
            );


        images.forEach(
            image => {

                image.addEventListener(
                    "error",
                    () => {

                        handleImageError(
                            image
                        );

                    },
                    {
                        once: true
                    }
                );

            }
        );


        /*
         * Summary.
         */
        subtotal =
            Number(
                subtotal.toFixed(2)
            );


        if (cartSubtotalElement) {

            cartSubtotalElement.textContent =
                formatPrice(subtotal);

        }


        if (cartTotalElement) {

            cartTotalElement.textContent =
                formatPrice(subtotal);

        }


        /*
         * Checkout.
         */
        if (checkoutButton) {

            checkoutButton.disabled =
                false;

            checkoutButton.setAttribute(
                "aria-disabled",
                "false"
            );

        }


        /*
         * Clear cart.
         */
        if (clearCartButton) {

            clearCartButton.disabled =
                false;

        }

    }


    /* =========================================================================
       ACCESSIBILITY ANNOUNCEMENTS
       ========================================================================= */

    function announce(message) {

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
       CART CLICK EVENTS
       ========================================================================= */

    if (cartItemsElement) {

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
                    !Number.isInteger(index)
                ) {
                    return;
                }


                if (
                    index < 0 ||
                    index >= cart.length
                ) {
                    return;
                }


                if (
                    action === "increase"
                ) {

                    updateQuantity(
                        index,
                        cart[index].quantity + 1
                    );

                    return;

                }


                if (
                    action === "decrease"
                ) {

                    updateQuantity(
                        index,
                        cart[index].quantity - 1
                    );

                    return;

                }


                if (
                    action === "remove"
                ) {

                    removeItem(index);

                }

            }
        );


        /* =====================================================================
           QUANTITY INPUT
           ===================================================================== */

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


                if (
                    !Number.isInteger(index)
                ) {
                    return;
                }


                updateQuantity(
                    index,
                    input.value
                );

            }
        );


        /*
         * Enter should update quantity instead
         * of submitting anything.
         */
        cartItemsElement.addEventListener(
            "keydown",
            event => {

                const input =
                    event.target.closest(
                        'input[data-action="quantity"]'
                    );


                if (!input) {
                    return;
                }


                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    input.blur();

                }

            }
        );

    }


    /* =========================================================================
       CHECKOUT
       ========================================================================= */

    if (checkoutButton) {

        checkoutButton.addEventListener(
            "click",
            () => {

                /*
                 * Refresh canonical cart.
                 */
                cart =
                    readCartFromStorage();


                if (!cart.length) {
                    return;
                }


                /*
                 * Normalize and save once more
                 * before entering checkout.
                 */
                saveCart(cart);


                window.location.href =
                    CHECKOUT_URL;

            }
        );

    }


    /* =========================================================================
       CLEAR CART BUTTON
       ========================================================================= */

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


                if (confirmed) {
                    clearCart();
                }

            }
        );

    }


    /* =========================================================================
       CROSS-TAB STORAGE SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(event.key)
            ) {

                cart =
                    readCartFromStorage();

                renderCart();

            }

        }
    );


    /* =========================================================================
       SAME-TAB CART SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "prasunCartUpdated",
        () => {

            /*
             * Always use canonical storage.
             */
            cart =
                readCartFromStorage();

            renderCart();

        }
    );


    /* =========================================================================
       PAGE VISIBILITY SYNCHRONIZATION
       ========================================================================= */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                cart =
                    readCartFromStorage();

                renderCart();

            }

        }
    );


    /* =========================================================================
       PUBLIC API
       ========================================================================= */

    window.PrasunCart = {

        getCart: () => {

            return readCartFromStorage();

        },


        getCount: () => {

            cart =
                readCartFromStorage();

            return getTotalQuantity();

        },


        getSubtotal: () => {

            cart =
                readCartFromStorage();

            return getSubtotal();

        },


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
       INITIALIZATION
       ========================================================================= */

    cart =
        readCartFromStorage();


    renderCart();

})();
