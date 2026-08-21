/**
 * ============================================================================
 * PRASUN SHOP — CJ-AWARE CART SYSTEM
 * ============================================================================
 *
 * js/cart.js
 *
 * Storage:
 *     prasun_cart
 *
 * Supplier:
 *     CJ Dropshipping
 *
 * Architecture:
 *
 *   CJ Product
 *       ↓
 *   Product page
 *       ↓
 *   window.addToCart()
 *       ↓
 *   localStorage
 *       ↓
 *   cart.html
 *       ↓
 *   /api/products?pid=...
 *       ↓
 *   Refresh current product data
 *       ↓
 *   checkout.html
 *       ↓
 *   Cloudflare Worker
 *       ↓
 *   CJ order API
 *
 * IMPORTANT
 * - No CJ API credentials are stored in the browser.
 * - Browser price is display-only.
 * - Worker must revalidate price and stock before creating the order.
 * - CJ variant IDs (vid) are preserved.
 * - No emoji or Unicode icon characters are used.
 * - Material Symbols are used for dynamic cart controls.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const CART_KEY =
        "prasun_cart";

    const CHECKOUT_SNAPSHOT_KEY =
        "prasun_checkout_snapshot";

    const LEGACY_KEYS = [
        "store_cart",
        "ae_dropship_cart",
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const MAX_QUANTITY =
        99;

    const CHECKOUT_URL =
        "/checkout.html";

    const PRODUCTS_URL =
        "/";

    const WORKER_BASE =
        "https://prasun-shop-api.prasun301.workers.dev";

    const PRODUCTS_ENDPOINT =
        `${WORKER_BASE}/api/products`;

    const REQUEST_TIMEOUT =
        12000;


    /* =========================================================================
       2. DOM CACHE
       ========================================================================= */

    let elements = {};

    function cacheDOMElements() {

        elements = {

            cartItems:
                document.getElementById(
                    "cart-items"
                ),

            cartCount:
                document.getElementById(
                    "cart-count"
                ),

            cartItemsCount:
                document.getElementById(
                    "cart-items-count"
                ),

            summaryItemCount:
                document.getElementById(
                    "summary-item-count"
                ),

            cartSubtotal:
                document.getElementById(
                    "cart-subtotal"
                ),

            cartTotal:
                document.getElementById(
                    "cart-total"
                ),

            checkoutButton:
                document.getElementById(
                    "checkout-button"
                ),

            clearCartButton:
                document.getElementById(
                    "clear-cart-button"
                ),

            liveRegion:
                document.getElementById(
                    "cart-live-region"
                )

        };

    }


    /* =========================================================================
       3. STATE
       ========================================================================= */

    let cart = [];

    let checkoutBusy =
        false;

    let initialized =
        false;


    /* =========================================================================
       4. CURRENCY
       ========================================================================= */

    const currencyFormatter =
        new Intl.NumberFormat(
            "en-US",
            {
                style:
                    "currency",

                currency:
                    "USD",

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2
            }
        );


    function formatPrice(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return "$0.00";

        }

        return currencyFormatter.format(
            number
        );

    }


    /* =========================================================================
       5. GENERAL HELPERS
       ========================================================================= */

    function cleanString(
        value
    ) {

        return String(
            value ??
            ""
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

            if (
                cleaned
            ) {

                return cleaned;

            }

        }

        return "";

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ??
            ""
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


    function normalizePrice(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            ) ||
            number < 0
        ) {

            return 0;

        }

        return Number(
            number.toFixed(
                2
            )
        );

    }


    function normalizeQuantity(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
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


    function getAvailableQuantity(
        item
    ) {

        const value =
            Number(
                item?.availableQuantity
            );

        return Number.isFinite(
            value
        )
            ? value
            : 0;

    }


    /* =========================================================================
       6. CJ FIELD EXTRACTORS
       ========================================================================= */

    function getProductId(
        item
    ) {

        return firstNonEmpty(

            item?.pid,

            item?.id,

            item?.productId,

            item?.productID

        );

    }


    function getCJProductId(
        item
    ) {

        return firstNonEmpty(

            item?.cj_id,

            item?.cjId,

            item?.pid

        );

    }


    function getSKU(
        item
    ) {

        return firstNonEmpty(

            item?.sku,

            item?.productSku,

            item?.supplierSku

        );

    }


    function getVariantId(
        item
    ) {

        return firstNonEmpty(

            item?.variantId,

            item?.variantID,

            item?.vid,

            item?.variant_id

        );

    }


    function getVariantSKU(
        item
    ) {

        return firstNonEmpty(

            item?.variantSku,

            item?.variantSKU,

            item?.variant_sku

        );

    }


    function getVariantOptions(
        item
    ) {

        return firstNonEmpty(

            item?.variantOptions,

            item?.variant_options,

            item?.options,

            item?.selectedOptions,

            item?.propertyValues

        );

    }


    function getProductName(
        item
    ) {

        return firstNonEmpty(

            item?.title,

            item?.name,

            item?.productNameEn,

            item?.productName

        );

    }


    function getProductCategory(
        item
    ) {

        return firstNonEmpty(

            item?.category,

            item?.categoryName,

            "Home Improvement / Solar"

        );

    }


    function getProductImage(
        item
    ) {

        return firstNonEmpty(

            item?.image,

            item?.originalImage,

            item?.productImage,

            item?.bigImage

        );

    }


    /* =========================================================================
       7. NORMALIZE CART ITEM
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


        const id =
            getProductId(
                item
            );


        const pid =
            getCJProductId(
                item
            );


        const name =
            getProductName(
                item
            );


        if (
            !id &&
            !pid &&
            !name
        ) {

            return null;

        }


        const variants =
            Array.isArray(
                item?.variants
            )
                ? item.variants
                : [];


        const normalizedVariants =
            variants.map(
                variant => ({

                    vid:
                        cleanString(
                            variant?.vid
                        ),

                    sku:
                        cleanString(
                            variant?.sku
                        ),

                    name:
                        cleanString(
                            variant?.name
                        ),

                    price:
                        normalizePrice(
                            variant?.price
                        ),

                    costPrice:
                        normalizePrice(
                            variant?.costPrice
                        ),

                    inventory:
                        Number(
                            variant?.inventory ||
                            0
                        )

                })
            );


        const availableQuantity =
            Number(
                item?.availableQuantity ??
                item?.quantity ??
                0
            );


        return {

            id:
                id ||
                pid ||
                name,

            pid:
                pid ||
                id,

            cj_id:
                pid ||
                id,

            sku:
                getSKU(
                    item
                ),

            variantId:
                getVariantId(
                    item
                ),

            vid:
                getVariantId(
                    item
                ),

            variantSku:
                getVariantSKU(
                    item
                ),

            variantOptions:
                getVariantOptions(
                    item
                ),

            name:
                name ||
                "CJ Product",

            title:
                name ||
                "CJ Product",

            category:
                getProductCategory(
                    item
                ),

            description:
                cleanString(
                    item?.description
                ),

            price:
                normalizePrice(
                    item?.price ??
                    item?.sellPrice
                ),

            image:
                getProductImage(
                    item
                ),

            images:
                Array.isArray(
                    item?.images
                )
                    ? [
                        ...item.images
                    ]
                    : [],

            originalImage:
                cleanString(
                    item?.originalImage
                ),

            originalImages:
                Array.isArray(
                    item?.originalImages
                )
                    ? [
                        ...item.originalImages
                    ]
                    : [],

            quantity:
                normalizeQuantity(
                    item?.quantity
                ),

            availableQuantity:
                Number.isFinite(
                    availableQuantity
                )
                    ? Math.max(
                        0,
                        Math.floor(
                            availableQuantity
                        )
                    )
                    : 0,

            variants:
                normalizedVariants,

            source:
                "CJ Dropshipping"

        };

    }


    function normalizeCartArray(
        items
    ) {

        if (
            !Array.isArray(
                items
            )
        ) {

            return [];

        }

        return items
            .map(
                normalizeCartItem
            )
            .filter(Boolean);

    }


    /* =========================================================================
       8. LOCAL STORAGE
       ========================================================================= */

    function readStorage(
        key
    ) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (
            error
        ) {

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

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] localStorage write error:",
                error
            );

            return false;

        }

    }


    function removeStorage(
        key
    ) {

        try {

            localStorage.removeItem(
                key
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] localStorage remove error:",
                error
            );

        }

    }


    function parseStoredCart(
        raw
    ) {

        if (
            !raw
        ) {

            return [];

        }


        try {

            const parsed =
                JSON.parse(
                    raw
                );


            return normalizeCartArray(
                parsed
            );

        } catch (
            error
        ) {

            console.warn(
                "[PRASUN SHOP] Invalid stored cart:",
                error
            );

            return [];

        }

    }


    function readCartFromStorage() {

        const primary =
            readStorage(
                CART_KEY
            );


        if (
            primary
        ) {

            const parsed =
                parseStoredCart(
                    primary
                );


            if (
                parsed.length
            ) {

                return parsed;

            }

        }


        for (
            const key
            of LEGACY_KEYS
        ) {

            const legacy =
                readStorage(
                    key
                );


            if (
                !legacy
            ) {

                continue;

            }


            const migrated =
                parseStoredCart(
                    legacy
                );


            if (
                migrated.length
            ) {

                writeStorage(
                    CART_KEY,
                    JSON.stringify(
                        migrated
                    )
                );

                return migrated;

            }

        }


        return [];

    }


    function saveCart(
        items
    ) {

        cart =
            normalizeCartArray(
                items
            );


        writeStorage(
            CART_KEY,
            JSON.stringify(
                cart
            )
        );


        for (
            const key
            of LEGACY_KEYS
        ) {

            removeStorage(
                key
            );

        }


        dispatchCartUpdate();


        return cart;

    }


    function dispatchCartUpdate() {

        try {

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

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Cart event error:",
                error
            );

        }

    }


    /* =========================================================================
       9. PRODUCT IDENTITY
       ========================================================================= */

    function sameCartProduct(
        a,
        b
    ) {

        const aVariant =
            getVariantId(
                a
            );


        const bVariant =
            getVariantId(
                b
            );


        if (
            aVariant ||
            bVariant
        ) {

            return (
                Boolean(
                    aVariant
                ) &&
                Boolean(
                    bVariant
                ) &&
                aVariant ===
                    bVariant
            );

        }


        const aVariantSku =
            getVariantSKU(
                a
            );


        const bVariantSku =
            getVariantSKU(
                b
            );


        if (
            aVariantSku ||
            bVariantSku
        ) {

            return (

                Boolean(
                    aVariantSku
                ) &&

                Boolean(
                    bVariantSku
                ) &&

                aVariantSku.toLowerCase() ===
                    bVariantSku.toLowerCase()

            );

        }


        const aPid =
            getCJProductId(
                a
            );


        const bPid =
            getCJProductId(
                b
            );


        if (
            aPid &&
            bPid
        ) {

            return (
                aPid ===
                bPid
            );

        }


        const aSku =
            getSKU(
                a
            );


        const bSku =
            getSKU(
                b
            );


        if (
            aSku &&
            bSku
        ) {

            return (
                aSku.toLowerCase() ===
                bSku.toLowerCase()
            );

        }


        return (

            cleanString(
                a.id
            ) ===

            cleanString(
                b.id
            )

        );

    }


    /* =========================================================================
       10. ADD PRODUCT
       ========================================================================= */

    function addProduct(
        product,
        quantity = 1
    ) {

        const normalized =
            normalizeCartItem(
                {
                    ...product,

                    quantity:
                        quantity
                }
            );


        if (
            !normalized
        ) {

            console.error(
                "[PRASUN SHOP] Product could not be added:",
                product
            );

            return false;

        }


        const available =
            getAvailableQuantity(
                normalized
            );


        if (
            available >
                0 &&
            quantity >
                available
        ) {

            quantity =
                available;

        }


        if (
            quantity <=
                0
        ) {

            return false;

        }


        normalized.quantity =
            normalizeQuantity(
                quantity
            );


        cart =
            readCartFromStorage();


        const existingIndex =
            cart.findIndex(
                item =>
                    sameCartProduct(
                        item,
                        normalized
                    )
            );


        if (
            existingIndex >=
                0
        ) {

            const existing =
                cart[
                    existingIndex
                ];


            let newQuantity =
                normalizeQuantity(
                    Number(
                        existing.quantity
                    ) +
                    Number(
                        normalized.quantity
                    )
                );


            const existingAvailable =
                getAvailableQuantity(
                    normalized
                );


            if (
                existingAvailable >
                    0
            ) {

                newQuantity =
                    Math.min(
                        newQuantity,
                        existingAvailable
                    );

            }


            cart[
                existingIndex
            ] = {

                ...existing,

                ...normalized,

                quantity:
                    newQuantity

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


    /* =========================================================================
       11. QUANTITY
       ========================================================================= */

    function updateQuantity(
        index,
        value
    ) {

        if (
            !Number.isInteger(
                index
            ) ||
            index < 0 ||
            index >= cart.length
        ) {

            return false;

        }


        let quantity =
            normalizeQuantity(
                value
            );


        const available =
            getAvailableQuantity(
                cart[
                    index
                ]
            );


        if (
            available >
                0
        ) {

            quantity =
                Math.min(
                    quantity,
                    available
                );

        }


        cart[
            index
        ].quantity =
            quantity;


        saveCart(
            cart
        );


        renderCart();


        return true;

    }


    /* =========================================================================
       12. REMOVE
       ========================================================================= */

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

            return false;

        }


        const removed =
            cart[
                index
            ];


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


        return true;

    }


    /* =========================================================================
       13. CLEAR
       ========================================================================= */

    function clearCart() {

        cart = [];


        removeStorage(
            CART_KEY
        );


        removeStorage(
            CHECKOUT_SNAPSHOT_KEY
        );


        for (
            const key
            of LEGACY_KEYS
        ) {

            removeStorage(
                key
            );

        }


        dispatchCartUpdate();


        renderCart();


        announce(
            "Cart cleared."
        );

    }


    /* =========================================================================
       14. TOTALS
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


    function getSubtotal() {

        const subtotal =
            cart.reduce(
                (
                    total,
                    item
                ) => {

                    return (

                        total +

                        (
                            normalizePrice(
                                item.price
                            ) *

                            normalizeQuantity(
                                item.quantity
                            )

                        )

                    );

                },
                0
            );


        return Number(
            subtotal.toFixed(
                2
            )
        );

    }


    /* =========================================================================
       15. HEADER AND SUMMARY
       ========================================================================= */

    function updateHeaderCount() {

        const total =
            getTotalQuantity();


        if (
            elements.cartCount
        ) {

            elements.cartCount.textContent =
                String(
                    total
                );


            elements.cartCount.hidden =
                total <=
                0;


            elements.cartCount.setAttribute(
                "aria-label",
                `${total} ${
                    total ===
                        1
                        ? "item"
                        : "items"
                } in cart`
            );

        }


        if (
            elements.cartItemsCount
        ) {

            elements.cartItemsCount.textContent =
                `${total} ${
                    total ===
                        1
                        ? "item"
                        : "items"
                }`;

        }


        if (
            elements.summaryItemCount
        ) {

            elements.summaryItemCount.textContent =
                String(
                    total
                );

        }

    }


    /* =========================================================================
       16. EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {

        if (
            !elements.cartItems
        ) {

            return;

        }


        elements.cartItems.innerHTML = `

            <div
                class="cart-empty"
                role="status"
            >

                <div
                    class="cart-empty-icon"
                    aria-hidden="true"
                >

                    <span
                        class="material-symbols-rounded icon-xl"
                    >
                        shopping_cart
                    </span>

                </div>


                <h2>
                    Your cart is empty
                </h2>


                <p>
                    Browse our CJ-powered products and add
                    products to your cart to continue shopping.
                </p>


                <a
                    href="${PRODUCTS_URL}"
                    class="continue-shopping"
                >

                    <span
                        class="material-symbols-rounded icon-sm"
                        aria-hidden="true"
                    >
                        storefront
                    </span>

                    <span>
                        Continue Shopping
                    </span>

                </a>

            </div>

        `;

    }


    /* =========================================================================
       17. DYNAMIC MATERIAL ICON
       ========================================================================= */

    function materialIcon(
        name,
        className = "icon-md"
    ) {

        return `

            <span
                class="material-symbols-rounded ${className}"
                aria-hidden="true"
            >
                ${escapeHTML(
                    name
                )}
            </span>

        `;

    }


    /* =========================================================================
       18. CART RENDER
       ========================================================================= */

    function renderCart() {

        cacheDOMElements();


        cart =
            readCartFromStorage();


        updateHeaderCount();


        if (
            !elements.cartItems
        ) {

            return;

        }


        if (
            !cart.length
        ) {

            renderEmptyCart();


            if (
                elements.cartSubtotal
            ) {

                elements.cartSubtotal.textContent =
                    "$0.00";

            }


            if (
                elements.cartTotal
            ) {

                elements.cartTotal.textContent =
                    "$0.00";

            }


            if (
                elements.checkoutButton
            ) {

                elements.checkoutButton.disabled =
                    true;

                elements.checkoutButton.setAttribute(
                    "aria-disabled",
                    "true"
                );

            }


            if (
                elements.clearCartButton
            ) {

                elements.clearCartButton.disabled =
                    true;

            }


            return;

        }


        let subtotal =
            0;


        elements.cartItems.innerHTML =
            cart.map(
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


                    const lineTotal =
                        Number(
                            (
                                price *
                                quantity
                            ).toFixed(
                                2
                            )
                        );


                    subtotal +=
                        lineTotal;


                    const name =
                        escapeHTML(
                            item.name
                        );


                    const category =
                        escapeHTML(
                            item.category
                        );


                    const image =
                        escapeHTML(
                            item.image ||
                            item.originalImage ||
                            ""
                        );


                    const vid =
                        escapeHTML(
                            getVariantId(
                                item
                            )
                        );


                    const variantSku =
                        escapeHTML(
                            getVariantSKU(
                                item
                            )
                        );


                    const variantOptions =
                        escapeHTML(
                            getVariantOptions(
                                item
                            )
                        );


                    let variantText =
                        "";


                    if (
                        variantOptions
                    ) {

                        variantText =
                            variantOptions;

                    } else if (
                        variantSku
                    ) {

                        variantText =
                            `SKU: ${variantSku}`;

                    } else if (
                        vid
                    ) {

                        variantText =
                            `Variant: ${vid}`;

                    }


                    const hasOriginalImage =
                        Boolean(
                            item.originalImage
                        );


                    return `

                        <article
                            class="cart-item"
                            data-cart-index="${index}"
                        >

                            <div class="cart-item-product">

                                <a
                                    href="${PRODUCTS_URL}"
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
                                                    referrerpolicy="no-referrer"
                                                    ${
                                                        hasOriginalImage
                                                            ? `data-original="${escapeHTML(
                                                                item.originalImage
                                                            )}"`
                                                            : ""
                                                    }
                                                >

                                            `

                                            : `

                                                <div
                                                    class="cart-item-image cart-item-image-placeholder"
                                                    aria-hidden="true"
                                                >

                                                    ${materialIcon(
                                                        "image",
                                                        "icon-md"
                                                    )}

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

                                                <span class="cart-item-category">
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
                                        ${formatPrice(
                                            price
                                        )}
                                        each
                                    </p>


                                    ${
                                        variantText

                                            ? `

                                                <p
                                                    class="cart-item-variant"
                                                >

                                                    ${materialIcon(
                                                        "tune",
                                                        "icon-sm"
                                                    )}

                                                    <span>
                                                        ${variantText}
                                                    </span>

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
                                        aria-label="Decrease quantity"
                                        ${
                                            quantity <=
                                                1
                                                ? "disabled"
                                                : ""
                                        }
                                    >

                                        ${materialIcon(
                                            "remove",
                                            "icon-sm"
                                        )}

                                    </button>


                                    <input
                                        class="quantity-input"
                                        type="number"
                                        min="1"
                                        max="${MAX_QUANTITY}"
                                        value="${quantity}"
                                        data-action="quantity"
                                        data-index="${index}"
                                        aria-label="Quantity"
                                        inputmode="numeric"
                                        autocomplete="off"
                                    >


                                    <button
                                        type="button"
                                        data-action="increase"
                                        data-index="${index}"
                                        aria-label="Increase quantity"
                                        ${
                                            quantity >=
                                                MAX_QUANTITY
                                                ? "disabled"
                                                : ""
                                        }
                                    >

                                        ${materialIcon(
                                            "add",
                                            "icon-sm"
                                        )}

                                    </button>

                                </div>


                                <div
                                    class="cart-item-subtotal"
                                >

                                    <strong>
                                        ${formatPrice(
                                            lineTotal
                                        )}
                                    </strong>


                                    <button
                                        type="button"
                                        class="cart-remove-button"
                                        data-action="remove"
                                        data-index="${index}"
                                        aria-label="Remove ${name} from cart"
                                    >

                                        ${materialIcon(
                                            "delete",
                                            "icon-sm"
                                        )}

                                        <span>
                                            Remove
                                        </span>

                                    </button>

                                </div>

                            </div>

                        </article>

                    `;

                }
            ).join("");


        attachCartImageFallbacks();


        subtotal =
            Number(
                subtotal.toFixed(
                    2
                )
            );


        if (
            elements.cartSubtotal
        ) {

            elements.cartSubtotal.textContent =
                formatPrice(
                    subtotal
                );

        }


        if (
            elements.cartTotal
        ) {

            elements.cartTotal.textContent =
                formatPrice(
                    subtotal
                );

        }


        if (
            elements.checkoutButton
        ) {

            elements.checkoutButton.disabled =
                false;

            elements.checkoutButton.setAttribute(
                "aria-disabled",
                "false"
            );

        }


        if (
            elements.clearCartButton
        ) {

            elements.clearCartButton.disabled =
                false;

        }

    }


    /* =========================================================================
       19. IMAGE FALLBACK
       ========================================================================= */

    function attachCartImageFallbacks() {

        if (
            !elements.cartItems
        ) {

            return;

        }


        elements.cartItems
            .querySelectorAll(
                "img.cart-item-image"
            )
            .forEach(
                image => {

                    image.addEventListener(
                        "error",
                        () => {

                            const original =
                                image.dataset.original;


                            if (
                                original &&
                                !image.dataset.originalTried
                            ) {

                                image.dataset.originalTried =
                                    "true";


                                image.src =
                                    original;


                                return;

                            }


                            const parent =
                                image.parentElement;


                            if (
                                !parent
                            ) {

                                return;

                            }


                            const placeholder =
                                document.createElement(
                                    "div"
                                );


                            placeholder.className =
                                "cart-item-image cart-item-image-placeholder";


                            placeholder.setAttribute(
                                "aria-hidden",
                                "true"
                            );


                            placeholder.innerHTML =
                                materialIcon(
                                    "image",
                                    "icon-md"
                                );


                            image.remove();


                            parent.appendChild(
                                placeholder
                            );

                        },
                        {
                            once:
                                true
                        }
                    );

                }
            );

    }


    /* =========================================================================
       20. FRESH PRODUCT VALIDATION
       ========================================================================= */

    async function fetchFreshProduct(
        item
    ) {

        const pid =
            getCJProductId(
                item
            ) ||
            getProductId(
                item
            );


        if (
            !pid
        ) {

            throw new Error(
                `Missing CJ product ID for ${item.name}.`
            );

        }


        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                REQUEST_TIMEOUT
            );


        try {

            const response =
                await fetch(

                    `${PRODUCTS_ENDPOINT}?pid=${encodeURIComponent(
                        pid
                    )}`,

                    {
                        method:
                            "GET",

                        headers: {

                            "Accept":
                                "application/json"

                        },

                        cache:
                            "no-store",

                        signal:
                            controller.signal

                    }

                );


            const rawText =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(
                        rawText
                    );

            } catch {

                throw new Error(
                    "The product service returned an invalid response."
                );

            }


            if (
                !response.ok ||
                data?.success !==
                    true ||
                !data?.product
            ) {

                throw new Error(
                    data?.error ||
                    `Unable to refresh ${item.name}.`
                );

            }


            return normalizeCartItem(
                data.product
            );

        } finally {

            clearTimeout(
                timeout
            );

        }

    }


    /* =========================================================================
       21. REFRESH CART FOR CHECKOUT
       ========================================================================= */

    async function refreshCartForCheckout() {

        cart =
            readCartFromStorage();


        if (
            !cart.length
        ) {

            throw new Error(
                "Your cart is empty."
            );

        }


        const refreshed =
            [];


        for (
            const item
            of cart
        ) {

            const fresh =
                await fetchFreshProduct(
                    item
                );


            if (
                !fresh
            ) {

                throw new Error(
                    `Unable to validate ${item.name}.`
                );

            }


            const selectedVid =
                getVariantId(
                    item
                );


            const selectedVariantSku =
                getVariantSKU(
                    item
                );


            let updated = {

                ...fresh,

                quantity:
                    item.quantity,

                variantId:
                    selectedVid,

                vid:
                    selectedVid,

                variantSku:
                    selectedVariantSku,

                variantOptions:
                    getVariantOptions(
                        item
                    )

            };


            /*
             * Preserve selected variant price when available.
             */

            if (
                selectedVid &&
                Array.isArray(
                    fresh.variants
                )
            ) {

                const variant =
                    fresh.variants.find(
                        current =>
                            String(
                                current.vid
                            ) ===
                            String(
                                selectedVid
                            )
                    );


                if (
                    variant
                ) {

                    updated.price =
                        normalizePrice(
                            variant.price
                        );

                }

            }


            /*
             * Verify requested quantity against current inventory.
             */

            const available =
                Number(
                    fresh.quantity
                );


            if (
                Number.isFinite(
                    available
                ) &&
                available > 0
            ) {

                if (
                    item.quantity >
                    available
                ) {

                    throw new Error(
                        `${item.name} has only ${available} unit${
                            available === 1
                                ? ""
                                : "s"
                        } available.`
                    );

                }

                updated.availableQuantity =
                    available;

            }


            refreshed.push(
                updated
            );

        }


        cart =
            refreshed;


        saveCart(
            cart
        );


        renderCart();


        return cart;

    }


    /* =========================================================================
       22. CHECKOUT SNAPSHOT
       ========================================================================= */

    function createCheckoutSnapshot(
        refreshedCart
    ) {

        return {

            version:
                1,

            createdAt:
                new Date()
                    .toISOString(),

            currency:
                "USD",

            items:
                refreshedCart.map(
                    (
                        item,
                        index
                    ) => ({

                        lineId:
                            `${Date.now()}-${index}-${String(
                                item.pid ||
                                item.id
                            )}`,

                        id:
                            item.id,

                        pid:
                            item.pid,

                        cj_id:
                            item.cj_id,

                        sku:
                            item.sku,

                        variantId:
                            item.variantId,

                        vid:
                            item.vid,

                        variantSku:
                            item.variantSku,

                        variantOptions:
                            item.variantOptions,

                        name:
                            item.name,

                        title:
                            item.title,

                        category:
                            item.category,

                        image:
                            item.image,

                        quantity:
                            normalizeQuantity(
                                item.quantity
                            ),

                        /*
                         * This is only for checkout display.
                         * Final price must be revalidated by Worker.
                         */

                        displayPrice:
                            normalizePrice(
                                item.price
                            )

                    })
                )

        };

    }


    /* =========================================================================
       23. PROCEED TO CHECKOUT
       ========================================================================= */

    async function proceedToCheckout() {

        if (
            checkoutBusy
        ) {

            return;

        }


        checkoutBusy =
            true;


        const button =
            elements.checkoutButton;


        if (
            button
        ) {

            button.disabled =
                true;

            button.setAttribute(
                "aria-disabled",
                "true"
            );

            button.innerHTML = `

                ${materialIcon(
                    "sync",
                    "icon-md"
                )}

                <span>
                    Checking availability
                </span>

            `;

        }


        try {

            const refreshedCart =
                await refreshCartForCheckout();


            const snapshot =
                createCheckoutSnapshot(
                    refreshedCart
                );


            const saved =
                writeStorage(
                    CHECKOUT_SNAPSHOT_KEY,
                    JSON.stringify(
                        snapshot
                    )
                );


            if (
                !saved
            ) {

                throw new Error(
                    "Unable to prepare checkout data."
                );

            }


            window.location.href =
                CHECKOUT_URL;

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Checkout preparation error:",
                error
            );


            announce(
                error?.message ||
                "Unable to prepare checkout."
            );


            showCheckoutError(
                error?.message ||
                "Unable to prepare checkout. Please try again."
            );


        } finally {

            checkoutBusy =
                false;


            if (
                elements.checkoutButton
            ) {

                elements.checkoutButton.disabled =
                    cart.length ===
                    0;

                elements.checkoutButton.setAttribute(
                    "aria-disabled",
                    cart.length ===
                        0
                        ? "true"
                        : "false"
                );


                elements.checkoutButton.innerHTML = `

                    ${materialIcon(
                        "shopping_cart_checkout",
                        "icon-md"
                    )}

                    <span>
                        Proceed to Checkout
                    </span>

                `;

            }

        }

    }


    /* =========================================================================
       24. CHECKOUT ERROR
       ========================================================================= */

    function showCheckoutError(
        message
    ) {

        const existing =
            document.getElementById(
                "cart-checkout-error"
            );


        if (
            existing
        ) {

            existing.remove();

        }


        if (
            !elements.cartItems
        ) {

            return;

        }


        const notice =
            document.createElement(
                "div"
            );


        notice.id =
            "cart-checkout-error";


        notice.setAttribute(
            "role",
            "alert"
        );


        notice.style.cssText = `

            display:flex;
            align-items:flex-start;
            gap:10px;
            margin:16px 24px;
            padding:13px 14px;
            border:1px solid #fecaca;
            border-radius:12px;
            background:#fef2f2;
            color:#991b1b;
            font-size:0.86rem;
            line-height:1.5;

        `;


        notice.innerHTML = `

            ${materialIcon(
                "error",
                "icon-sm"
            )}

            <span>
                ${escapeHTML(
                    message
                )}
            </span>

        `;


        elements.cartItems.parentElement.insertBefore(
            notice,
            elements.cartItems
        );


        window.setTimeout(
            () => {

                notice.remove();

            },
            7000
        );

    }


    /* =========================================================================
       25. ACCESSIBILITY ANNOUNCEMENTS
       ========================================================================= */

    function announce(
        message
    ) {

        if (
            !elements.liveRegion
        ) {

            return;

        }


        elements.liveRegion.textContent =
            "";


        window.setTimeout(
            () => {

                elements.liveRegion.textContent =
                    String(
                        message ||
                        ""
                    );

            },
            20
        );

    }


    /* =========================================================================
       26. EVENT LISTENERS
       ========================================================================= */

    function bindEvents() {

        /*
         * Cart item controls
         */

        if (
            elements.cartItems
        ) {

            elements.cartItems.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "button[data-action]"
                        );


                    if (
                        !button
                    ) {

                        return;

                    }


                    const index =
                        Number(
                            button.dataset.index
                        );


                    if (
                        !Number.isInteger(
                            index
                        ) ||
                        index < 0 ||
                        index >= cart.length
                    ) {

                        return;

                    }


                    const action =
                        button.dataset.action;


                    if (
                        action ===
                        "increase"
                    ) {

                        updateQuantity(
                            index,
                            cart[
                                index
                            ].quantity +
                                1
                        );

                    }


                    if (
                        action ===
                        "decrease"
                    ) {

                        updateQuantity(
                            index,
                            cart[
                                index
                            ].quantity -
                                1
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


            /*
             * Quantity input
             */

            elements.cartItems.addEventListener(
                "change",
                event => {

                    const input =
                        event.target.closest(
                            'input[data-action="quantity"]'
                        );


                    if (
                        !input
                    ) {

                        return;

                    }


                    updateQuantity(
                        Number(
                            input.dataset.index
                        ),
                        input.value
                    );

                }
            );


            /*
             * Enter key on quantity input
             */

            elements.cartItems.addEventListener(
                "keydown",
                event => {

                    const input =
                        event.target.closest(
                            'input[data-action="quantity"]'
                        );


                    if (
                        !input
                    ) {

                        return;

                    }


                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        input.blur();

                    }

                }
            );

        }


        /*
         * Checkout
         */

        if (
            elements.checkoutButton
        ) {

            elements.checkoutButton.addEventListener(
                "click",
                proceedToCheckout
            );

        }


        /*
         * Clear cart
         */

        if (
            elements.clearCartButton
        ) {

            elements.clearCartButton.addEventListener(
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


        /*
         * Products pages can dispatch:
         *
         * document.dispatchEvent(
         *   new CustomEvent("cart:add", {
         *     detail: product
         *   })
         * )
         */

        document.addEventListener(
            "cart:add",
            event => {

                if (
                    event.detail
                ) {

                    addProduct(
                        event.detail
                    );

                }

            }
        );

    }


    /* =========================================================================
       27. CROSS-TAB SYNCHRONIZATION
       ========================================================================= */

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
       28. PUBLIC API
       ========================================================================= */

    window.addToCart =
        addProduct;


    window.PrasunCart = {

        getCart:
            () =>
                readCartFromStorage(),

        getCount:
            () => {

                cart =
                    readCartFromStorage();

                return getTotalQuantity();

            },

        getSubtotal:
            () => {

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

        refreshForCheckout:
            refreshCartForCheckout,

        render:
            renderCart

    };


    /* =========================================================================
       29. INITIALIZATION
       ========================================================================= */

    function initialize() {

        if (
            initialized
        ) {

            return;

        }


        initialized =
            true;


        cacheDOMElements();

        cart =
            readCartFromStorage();

        bindEvents();

        renderCart();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();

    }

})();
