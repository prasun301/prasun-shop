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
 * Main supplier:
 *     CJ Dropshipping
 *
 * Architecture:
 *
 *   Product API
 *       ↓
 *   Product page
 *       ↓
 *   addToCart()
 *       ↓
 *   localStorage
 *       ↓
 *   cart.html
 *       ↓
 *   /api/products?pid=...
 *       ↓
 *   price / stock / variant refresh
 *       ↓
 *   checkout.html
 *       ↓
 *   Cloudflare Worker
 *       ↓
 *   CJ createOrderV3
 *
 * IMPORTANT:
 * - No CJ API credentials are stored in the browser.
 * - Browser price is display-only.
 * - Worker must revalidate price/stock before creating CJ order.
 * - CJ variant IDs (vid) are preserved.
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       1. CONFIG
       ======================================================================== */

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


    /* ========================================================================
       2. DOM
       ======================================================================== */

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


    /* ========================================================================
       3. STATE
       ======================================================================== */

    let cart = [];

    let checkoutBusy =
        false;


    /* ========================================================================
       4. FORMATTERS
       ======================================================================== */

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


    /* ========================================================================
       5. GENERAL HELPERS
       ======================================================================== */

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


    /* ========================================================================
       6. CJ FIELD EXTRACTION
       ======================================================================== */

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


    /* ========================================================================
       7. CART ITEM NORMALIZATION
       ======================================================================== */

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
                Number(
                    item?.availableQuantity ??
                    item?.quantity ??
                    0
                ),

            variants:

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
                            )

                    })
                ),

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


    /* ========================================================================
       8. LOCAL STORAGE
       ======================================================================== */

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

        } catch {

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
                        detail:
                            {
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


    /* ========================================================================
       9. CART ITEM IDENTITY
       ======================================================================== */

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

            if (
                aVariant &&
                bVariant
            ) {

                return (
                    aVariant ===
                    bVariant
                );

            }

            return false;

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
                aVariantSku &&
                bVariantSku &&
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


        return (
            cleanString(
                a.id
            ) ===
            cleanString(
                b.id
            )
        );

    }


    /* ========================================================================
       10. ADD TO CART
       ======================================================================== */

    function addProduct(
        product,
        quantity = 1
    ) {

        const normalized =
            normalizeCartItem(
                {
                    ...product,

                    quantity
                }
            );


        if (
            !normalized
        ) {

            console.error(
                "[PRASUN SHOP] Invalid CJ product:",
                product
            );

            return false;

        }


        cart =
            readCartFromStorage();


        const index =
            cart.findIndex(
                item =>
                    sameCartProduct(
                        item,
                        normalized
                    )
            );


        if (
            index >= 0
        ) {

            cart[index] =
                {

                    ...cart[index],

                    ...normalized,

                    quantity:
                        normalizeQuantity(
                            Number(
                                cart[index]
                                    .quantity
                            ) +
                            Number(
                                normalized
                                    .quantity
                            )
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


    /* ========================================================================
       11. QUANTITY
       ======================================================================== */

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
            Number(
                cart[index]
                    .availableQuantity
            );


        if (
            Number.isFinite(
                available
            ) &&
            available > 0
        ) {

            quantity =
                Math.min(
                    quantity,
                    available
                );

        }


        cart[index]
            .quantity =
                quantity;


        saveCart(
            cart
        );


        renderCart();


        return true;

    }


    /* ========================================================================
       12. REMOVE / CLEAR
       ======================================================================== */

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


        return true;

    }


    function clearCart() {

        cart =
            [];


        removeStorage(
            CART_KEY
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


    /* ========================================================================
       13. TOTALS
       ======================================================================== */

    function getTotalQuantity() {

        return cart.reduce(
            (
                total,
                item
            ) =>

                total +
                normalizeQuantity(
                    item.quantity
                ),

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
                        normalizePrice(
                            item.price
                        ) *
                        normalizeQuantity(
                            item.quantity
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


    /* ========================================================================
       14. HEADER / SUMMARY
       ======================================================================== */

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
                total <= 0;

            elements.cartCount.setAttribute(
                "aria-label",
                `${total} ${
                    total === 1
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
                    total === 1
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


    /* ========================================================================
       15. CART RENDERING
       ======================================================================== */

    function renderEmptyCart() {

        if (
            !elements.cartItems
        ) {

            return;

        }


        elements.cartItems.innerHTML = `

            <div class="cart-empty">

                <div
                    class="cart-empty-icon"
                    aria-hidden="true"
                >
                    🛒
                </div>

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Browse our CJ-powered products and add something
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
                                                    data-original="${escapeHTML(
                                                        item.originalImage ||
                                                        ""
                                                    )}"
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


                                    <h3 class="cart-item-title">

                                        <a href="${PRODUCTS_URL}">
                                            ${name}
                                        </a>

                                    </h3>


                                    <p class="cart-item-price">
                                        ${formatPrice(
                                            price
                                        )}
                                        each
                                    </p>


                                    ${
                                        variantText

                                            ? `

                                                <p class="cart-item-variant">
                                                    ${variantText}
                                                </p>

                                            `

                                            : ""
                                    }

                                </div>

                            </div>


                            <div class="cart-item-controls">

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
                                        aria-label="Quantity"
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


                                <div class="cart-item-subtotal">

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
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </article>

                    `;

                }
            ).join("");


        /* ---------------------------------------------------------------
           Image fallback
           --------------------------------------------------------------- */

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
                                !image.dataset.triedOriginal
                            ) {

                                image.dataset.triedOriginal =
                                    "true";

                                image.src =
                                    original;

                                return;

                            }


                            image.style.display =
                                "none";

                        },
                        {
                            once:
                                true
                        }
                    );

                }
            );


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


    /* ========================================================================
       16. WORKER PRODUCT REFRESH
       ======================================================================== */

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

                        headers:
                            {
                                "Accept":
                                    "application/json"
                            },

                        cache:
                            "no-store",

                        signal:
                            controller.signal
                    }
                );


            const data =
                await response.json();


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


    /* ========================================================================
       17. REFRESH CART BEFORE CHECKOUT
       ======================================================================== */

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


            /*
             * Keep the customer's selected variant.
             */

            const selectedVid =
                getVariantId(
                    item
                );


            const selectedVariantSku =
                getVariantSKU(
                    item
                );


            let updated =
                {
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
             * If a selected variant exists,
             * use the fresh variant price when available.
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
             * Stock validation.
             */

            const available =
                Number(
                    fresh.quantity
                );


            if (
                Number.isFinite(
                    available
                ) &&
                available > 0 &&
                item.quantity >
                    available
            ) {

                throw new Error(
                    `${item.name} has only ${available} unit(s) available.`
                );

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


    /* ========================================================================
       18. PREPARE CHECKOUT
       ======================================================================== */

    async function proceedToCheckout() {

        if (
            checkoutBusy
        ) {

            return;

        }


        checkoutBusy =
            true;


        if (
            elements.checkoutButton
        ) {

            elements.checkoutButton.disabled =
                true;

            elements.checkoutButton.textContent =
                "Checking CJ availability...";

        }


        try {

            const refreshedCart =
                await refreshCartForCheckout();


            const snapshot = {

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

                            price:
                                item.price,

                            quantity:
                                item.quantity

                        })
                    )

            };


            writeStorage(
                CHECKOUT_SNAPSHOT_KEY,
                JSON.stringify(
                    snapshot
                )
            );


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


            alert(
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

                elements.checkoutButton.textContent =
                    "Proceed to Checkout";

            }

        }

    }


    /* ========================================================================
       19. EVENT HANDLERS
       ======================================================================== */

    function bindEvents() {

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


                    const action =
                        button.dataset.action;


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

                        updateQuantity(
                            index,
                            cart[index]
                                .quantity -
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

        }


        if (
            elements.checkoutButton
        ) {

            elements.checkoutButton.addEventListener(
                "click",
                proceedToCheckout
            );

        }


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
         * Product pages use window.addToCart(product).
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


    /* ========================================================================
       20. EVENTS FROM OTHER TABS / WINDOWS
       ======================================================================== */

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


    /* ========================================================================
       21. PUBLIC API
       ======================================================================== */

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


    /* ========================================================================
       22. INITIALIZATION
       ======================================================================== */

    function initialize() {

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
