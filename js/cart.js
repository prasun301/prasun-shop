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
 *   Fresh CJ product validation
 *       ↓
 *   checkout.html
 *       ↓
 *   Cloudflare Worker
 *       ↓
 *   CJ order API
 *
 *
 * IMPORTANT
 *
 * - No CJ credentials are stored in the browser.
 * - Browser price is display-only.
 * - Worker remains authoritative for final price, stock and order creation.
 * - CJ PID / VID / SKU / variant information is preserved.
 * - No emoji.
 * - No Material Symbols dependency.
 * - All dynamic UI icons use inline SVG.
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
       2. STATE
       ========================================================================= */

    let cart = [];

    let checkoutBusy = false;

    let initialized = false;

    let elements = {};


    /* =========================================================================
       3. CURRENCY
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


    function formatPrice(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {

            return "$0.00";

        }

        return currencyFormatter.format(
            number
        );

    }


    /* =========================================================================
       4. DOM
       ========================================================================= */

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
       5. GENERAL HELPERS
       ========================================================================= */

    function cleanString(value) {

        return String(
            value ?? ""
        ).trim();

    }


    function firstNonEmpty(...values) {

        for (
            const value of values
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


    function normalizeQuantity(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
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


    function normalizeInventory(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {

            return 0;

        }

        return Math.max(
            0,
            Math.floor(number)
        );

    }


    function getAvailableQuantity(item) {

        return normalizeInventory(
            item?.availableQuantity
        );

    }


    /* =========================================================================
       6. INLINE SVG ICON SYSTEM
       ========================================================================= */

    function svgIcon(
        name,
        className = "ui-icon"
    ) {

        const safeClass =
            escapeHTML(
                className
            );


        const common =
            `
                class="${safeClass}"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            `;


        const icons = {

            cart: `
                <svg ${common}>
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path
                        d="
                            M3 4h2
                            l2.4 11.2
                            a2 2 0 0 0 2 1.6h8.8
                            a2 2 0 0 0 1.9-1.4L22 8H6
                        "
                    ></path>
                </svg>
            `,

            cartCheck: `
                <svg ${common}>
                    <circle cx="9" cy="20" r="1"></circle>
                    <circle cx="19" cy="20" r="1"></circle>
                    <path
                        d="
                            M3 4h2
                            l2.4 11.2
                            a2 2 0 0 0 2 1.6h8.8
                            a2 2 0 0 0 1.9-1.4L22 8H6
                        "
                    ></path>
                    <path d="m15 5 2 2 4-4"></path>
                </svg>
            `,

            add: `
                <svg ${common}>
                    <path d="M12 5v14"></path>
                    <path d="M5 12h14"></path>
                </svg>
            `,

            remove: `
                <svg ${common}>
                    <path d="M5 12h14"></path>
                </svg>
            `,

            delete: `
                <svg ${common}>
                    <path d="M4 7h16"></path>
                    <path d="M10 11v6"></path>
                    <path d="M14 11v6"></path>
                    <path d="M6 7l1 14h10l1-14"></path>
                    <path d="M9 7V4h6v3"></path>
                </svg>
            `,

            image: `
                <svg ${common}>
                    <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                    ></rect>
                    <circle
                        cx="8.5"
                        cy="8.5"
                        r="1.5"
                    ></circle>
                    <path d="m3 16 5-5 4 4 3-3 6 6"></path>
                </svg>
            `,

            tune: `
                <svg ${common}>
                    <path d="M4 6h16"></path>
                    <circle cx="9" cy="6" r="2"></circle>
                    <path d="M4 12h16"></path>
                    <circle cx="15" cy="12" r="2"></circle>
                    <path d="M4 18h16"></path>
                    <circle cx="11" cy="18" r="2"></circle>
                </svg>
            `,

            refresh: `
                <svg ${common}>
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
            `,

            error: `
                <svg ${common}>
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
            `,

            shield: `
                <svg ${common}>
                    <path
                        d="
                            M12 3
                            20 6
                            v5
                            c0 5.2-3.4 8.7-8 10
                            -4.6-1.3-8-4.8-8-10V6z
                        "
                    ></path>
                    <path d="m9 12 2 2 4-4"></path>
                </svg>
            `,

            store: `
                <svg ${common}>
                    <path d="M4 10v10h16V10"></path>
                    <path d="M3 10 5 4h14l2 6"></path>
                    <path d="M8 20v-6h8v6"></path>
                    <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"></path>
                </svg>
            `

        };


        return (
            icons[name] ||
            icons.image
        );

    }


    /* =========================================================================
       7. CJ FIELD EXTRACTORS
       ========================================================================= */

    function getProductId(item) {

        return firstNonEmpty(

            item?.pid,

            item?.id,

            item?.productId,

            item?.productID

        );

    }


    function getCJProductId(item) {

        return firstNonEmpty(

            item?.cj_id,

            item?.cjId,

            item?.pid

        );

    }


    function getSKU(item) {

        return firstNonEmpty(

            item?.sku,

            item?.productSku,

            item?.supplierSku

        );

    }


    function getVariantId(item) {

        return firstNonEmpty(

            item?.variantId,

            item?.variantID,

            item?.vid,

            item?.variant_id

        );

    }


    function getVariantSKU(item) {

        return firstNonEmpty(

            item?.variantSku,

            item?.variantSKU,

            item?.variant_sku

        );

    }


    function getVariantOptions(item) {

        return firstNonEmpty(

            item?.variantOptions,

            item?.variant_options,

            item?.options,

            item?.selectedOptions,

            item?.propertyValues

        );

    }


    function getProductName(item) {

        return firstNonEmpty(

            item?.title,

            item?.name,

            item?.productNameEn,

            item?.productName

        );

    }


    function getProductCategory(item) {

        return firstNonEmpty(

            item?.category,

            item?.categoryName,

            "Home Improvement / Solar"

        );

    }


    function getProductImage(item) {

        return firstNonEmpty(

            item?.image,

            item?.originalImage,

            item?.productImage,

            item?.bigImage

        );

    }


    /* =========================================================================
       8. CART ITEM NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(item) {

        if (
            !item ||
            typeof item !== "object"
        ) {

            return null;

        }


        const id =
            getProductId(item);

        const pid =
            getCJProductId(item);

        const name =
            getProductName(item);


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
            variants
                .map(
                    variant => {

                        if (
                            !variant ||
                            typeof variant !== "object"
                        ) {

                            return null;

                        }


                        return {

                            vid:
                                cleanString(
                                    variant?.vid
                                ),

                            sku:
                                firstNonEmpty(
                                    variant?.sku,
                                    variant?.variantSku
                                ),

                            name:
                                firstNonEmpty(
                                    variant?.name,
                                    variant?.variantNameEn,
                                    "Default"
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
                                normalizeInventory(
                                    variant?.inventory
                                )

                        };

                    }
                )
                .filter(Boolean);


        const rawAvailable =
            item?.availableQuantity ??
            item?.inventory ??
            item?.totalInventory ??
            item?.quantity ??
            0;


        return {

            id:
                id ||
                pid ||
                name,

            pid:
                pid ||
                id,

            cj_id:
                firstNonEmpty(
                    item?.cj_id,
                    item?.cjId,
                    pid ||
                    id
                ),

            sku:
                getSKU(item),

            variantId:
                getVariantId(item),

            vid:
                getVariantId(item),

            variantSku:
                getVariantSKU(item),

            variantOptions:
                getVariantOptions(item),

            name:
                name ||
                "CJ Product",

            title:
                name ||
                "CJ Product",

            category:
                getProductCategory(item),

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
                getProductImage(item),

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
                normalizeInventory(
                    rawAvailable
                ),

            variants:
                normalizedVariants,

            source:
                "CJ Dropshipping"

        };

    }


    function normalizeCartArray(items) {

        if (
            !Array.isArray(items)
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
       9. LOCAL STORAGE
       ========================================================================= */

    function readStorage(key) {

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


    function removeStorage(key) {

        try {

            localStorage.removeItem(
                key
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] localStorage remove error:",
                error
            );

        }

    }


    function parseStoredCart(raw) {

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

        } catch (error) {

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
            const key of LEGACY_KEYS
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


    function saveCart(items) {

        cart =
            normalizeCartArray(
                items
            );


        const saved =
            writeStorage(
                CART_KEY,
                JSON.stringify(
                    cart
                )
            );


        if (
            !saved
        ) {

            console.error(
                "[PRASUN SHOP] Cart could not be saved."
            );

        }


        for (
            const key of LEGACY_KEYS
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
       10. PRODUCT IDENTITY
       ========================================================================= */

    function sameCartProduct(
        a,
        b
    ) {

        const aVariant =
            getVariantId(a);

        const bVariant =
            getVariantId(b);


        if (
            aVariant ||
            bVariant
        ) {

            return (
                Boolean(aVariant) &&
                Boolean(bVariant) &&
                String(aVariant) ===
                String(bVariant)
            );

        }


        const aVariantSku =
            getVariantSKU(a);

        const bVariantSku =
            getVariantSKU(b);


        if (
            aVariantSku ||
            bVariantSku
        ) {

            return (
                Boolean(aVariantSku) &&
                Boolean(bVariantSku) &&
                aVariantSku.toLowerCase() ===
                bVariantSku.toLowerCase()
            );

        }


        const aPid =
            getCJProductId(a);

        const bPid =
            getCJProductId(b);


        if (
            aPid &&
            bPid
        ) {

            return (
                String(aPid) ===
                String(bPid)
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
                aSku.toLowerCase() ===
                bSku.toLowerCase()
            );

        }


        return (
            cleanString(a.id) ===
            cleanString(b.id)
        );

    }


    /* =========================================================================
       11. ADD PRODUCT
       ========================================================================= */

    function addProduct(
        product,
        quantity = 1
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {

            return false;

        }


        let requestedQuantity =
            normalizeQuantity(
                quantity
            );


        const normalized =
            normalizeCartItem(
                {
                    ...product,
                    quantity:
                        requestedQuantity
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
            available > 0
        ) {

            requestedQuantity =
                Math.min(
                    requestedQuantity,
                    available
                );

        }


        if (
            requestedQuantity <= 0
        ) {

            return false;

        }


        normalized.quantity =
            normalizeQuantity(
                requestedQuantity
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
            existingIndex >= 0
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


            const freshAvailable =
                getAvailableQuantity(
                    normalized
                );


            if (
                freshAvailable > 0
            ) {

                newQuantity =
                    Math.min(
                        newQuantity,
                        freshAvailable
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
       12. QUANTITY
       ========================================================================= */

    function updateQuantity(
        index,
        value
    ) {

        if (
            !Number.isInteger(index) ||
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
                cart[index]
            );


        if (
            available > 0
        ) {

            quantity =
                Math.min(
                    quantity,
                    available
                );

        }


        cart[index].quantity =
            quantity;


        saveCart(
            cart
        );


        renderCart();


        announce(
            `${cart[index].name} quantity updated to ${quantity}.`
        );


        return true;

    }


    /* =========================================================================
       13. REMOVE
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
       14. CLEAR
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
            const key of LEGACY_KEYS
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
       15. TOTALS
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


    /* =========================================================================
       16. HEADER / SUMMARY
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


    /* =========================================================================
       17. EMPTY CART
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

                    ${svgIcon(
                        "cart",
                        "ui-icon ui-icon-xl"
                    )}

                </div>


                <h2>
                    Your cart is empty
                </h2>


                <p>
                    Browse our CJ-powered products and
                    add products to your cart to continue shopping.
                </p>


                <a
                    href="${PRODUCTS_URL}"
                    class="continue-shopping"
                >

                    ${svgIcon(
                        "store",
                        "ui-icon ui-icon-sm"
                    )}

                    <span>
                        Continue Shopping
                    </span>

                </a>

            </div>

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


                        const lineTotal =
                            Number(
                                (
                                    price *
                                    quantity
                                ).toFixed(2)
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


                        const variantId =
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
                            variantId
                        ) {

                            variantText =
                                `Variant: ${variantId}`;

                        }


                        const originalImage =
                            escapeHTML(
                                item.originalImage ||
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
                                                        data-original="${originalImage}"
                                                    >

                                                `

                                                : `

                                                    <div
                                                        class="cart-item-image cart-item-image-placeholder"
                                                        aria-hidden="true"
                                                    >

                                                        ${svgIcon(
                                                            "image",
                                                            "ui-icon ui-icon-md"
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

                                                        ${svgIcon(
                                                            "tune",
                                                            "ui-icon ui-icon-sm"
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
                                                quantity <= 1
                                                    ? "disabled"
                                                    : ""
                                            }
                                        >

                                            ${svgIcon(
                                                "remove",
                                                "ui-icon ui-icon-sm"
                                            )}

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
                                                quantity >= MAX_QUANTITY
                                                    ? "disabled"
                                                    : ""
                                            }
                                        >

                                            ${svgIcon(
                                                "add",
                                                "ui-icon ui-icon-sm"
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

                                            ${svgIcon(
                                                "delete",
                                                "ui-icon ui-icon-sm"
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
                )
                .join("");


        elements.cartItems.innerHTML =
            html;


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
                                svgIcon(
                                    "image",
                                    "ui-icon ui-icon-md"
                                );


                            image.replaceWith(
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

    async function fetchFreshProduct(item) {

        const pid =
            getCJProductId(item) ||
            getProductId(item);


        if (
            !pid
        ) {

            throw new Error(
                `Missing CJ product ID for ${item.name || "product"}.`
            );

        }


        const controller =
            new AbortController();


        const timeout =
            window.setTimeout(
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
                            Accept:
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
                    "The product service returned invalid JSON."
                );

            }


            if (
                !response.ok ||
                data?.success !== true ||
                !data?.product
            ) {

                throw new Error(
                    data?.error ||
                    `Unable to refresh ${item.name || "product"}.`
                );

            }


            const fresh =
                normalizeCartItem(
                    data.product
                );


            if (
                !fresh
            ) {

                throw new Error(
                    `Unable to normalize ${item.name || "product"}.`
                );

            }


            return fresh;

        } catch (error) {

            if (
                error?.name === "AbortError"
            ) {

                throw new Error(
                    "The product validation request timed out."
                );

            }

            throw error;

        } finally {

            window.clearTimeout(
                timeout
            );

        }

    }


    /* =========================================================================
       21. VARIANT MATCHING
       ========================================================================= */

    function findMatchingVariant(
        freshProduct,
        cartItem
    ) {

        if (
            !Array.isArray(
                freshProduct?.variants
            )
        ) {

            return null;

        }


        const selectedVid =
            getVariantId(
                cartItem
            );


        if (
            selectedVid
        ) {

            const byVid =
                freshProduct.variants.find(
                    variant =>
                        String(
                            variant.vid
                        ) ===
                        String(
                            selectedVid
                        )
                );


            if (
                byVid
            ) {

                return byVid;

            }

        }


        const selectedSku =
            getVariantSKU(
                cartItem
            );


        if (
            selectedSku
        ) {

            const bySku =
                freshProduct.variants.find(
                    variant =>
                        String(
                            variant.sku
                        ).toLowerCase() ===
                        String(
                            selectedSku
                        ).toLowerCase()
                );


            if (
                bySku
            ) {

                return bySku;

            }

        }


        return null;

    }


    /* =========================================================================
       22. REFRESH CART FOR CHECKOUT
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


        const refreshed = [];


        for (
            const item of cart
        ) {

            const fresh =
                await fetchFreshProduct(
                    item
                );


            const selectedVariant =
                findMatchingVariant(
                    fresh,
                    item
                );


            /*
             * A selected variant must still exist.
             */

            if (
                getVariantId(item) ||
                getVariantSKU(item)
            ) {

                if (
                    !selectedVariant
                ) {

                    throw new Error(
                        `${item.name} is no longer available in the selected variant.`
                    );

                }

            }


            let updated = {

                ...fresh,

                quantity:
                    normalizeQuantity(
                        item.quantity
                    ),

                variantId:
                    getVariantId(item),

                vid:
                    getVariantId(item),

                variantSku:
                    getVariantSKU(item),

                variantOptions:
                    getVariantOptions(item)

            };


            /*
             * Use the current CJ variant price.
             */

            if (
                selectedVariant
            ) {

                updated.price =
                    normalizePrice(
                        selectedVariant.price
                    );

                updated.availableQuantity =
                    normalizeInventory(
                        selectedVariant.inventory
                    );

            } else {

                /*
                 * For non-variant products,
                 * use current product inventory.
                 */

                updated.availableQuantity =
                    normalizeInventory(
                        fresh.quantity
                    );

            }


            const available =
                getAvailableQuantity(
                    updated
                );


            if (
                available > 0 &&
                updated.quantity > available
            ) {

                throw new Error(
                    `${item.name} has only ${available} unit${
                        available === 1
                            ? ""
                            : "s"
                    } available.`
                );

            }


            /*
             * Preserve the browser's selected quantity,
             * but use fresh authoritative product information.
             */

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
       23. CHECKOUT SNAPSHOT
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

                        displayPrice:
                            normalizePrice(
                                item.price
                            )

                    })
                )

        };

    }


    /* =========================================================================
       24. PROCEED TO CHECKOUT
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

                ${svgIcon(
                    "refresh",
                    "ui-icon ui-icon-md"
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

        } catch (error) {

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


            /*
             * This page may have navigated already.
             * If it has not, restore the button.
             */

            if (
                elements.checkoutButton
            ) {

                elements.checkoutButton.disabled =
                    cart.length === 0;

                elements.checkoutButton.setAttribute(
                    "aria-disabled",
                    cart.length === 0
                        ? "true"
                        : "false"
                );


                elements.checkoutButton.innerHTML = `

                    ${svgIcon(
                        "cartCheck",
                        "ui-icon ui-icon-md"
                    )}

                    <span>
                        Proceed to Checkout
                    </span>

                `;

            }

        }

    }


    /* =========================================================================
       25. CHECKOUT ERROR
       ========================================================================= */

    function showCheckoutError(
        message
    ) {

        const oldNotice =
            document.getElementById(
                "cart-checkout-error"
            );


        if (
            oldNotice
        ) {

            oldNotice.remove();

        }


        if (
            !elements.cartItems ||
            !elements.cartItems.parentElement
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


        notice.innerHTML = `

            ${svgIcon(
                "error",
                "ui-icon ui-icon-sm"
            )}

            <span>
                ${escapeHTML(
                    message
                )}
            </span>

        `;


        /*
         * Keep the styling compatible with both the new cart page
         * and the existing stylesheet.
         */

        notice.style.display =
            "flex";

        notice.style.alignItems =
            "flex-start";

        notice.style.gap =
            "10px";

        notice.style.margin =
            "16px 22px";

        notice.style.padding =
            "12px 14px";

        notice.style.border =
            "1px solid #fecaca";

        notice.style.borderRadius =
            "12px";

        notice.style.background =
            "#fef2f2";

        notice.style.color =
            "#991b1b";

        notice.style.fontSize =
            "0.84rem";

        notice.style.lineHeight =
            "1.5";


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
       26. ACCESSIBILITY
       ========================================================================= */

    function announce(message) {

        const liveRegion =
            elements.liveRegion;


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
                    String(
                        message ||
                        ""
                    );

            },
            20
        );

    }


    /* =========================================================================
       27. EVENT LISTENERS
       ========================================================================= */

    function bindEvents() {

        /*
         * Cart controls
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
                        !Number.isInteger(index) ||
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
                            cart[index].quantity + 1
                        );

                        return;

                    }


                    if (
                        action ===
                        "decrease"
                    ) {

                        updateQuantity(
                            index,
                            cart[index].quantity - 1
                        );

                        return;

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
             * Quantity field
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
                        event.key === "Enter"
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


                    const confirmed =
                        window.confirm(
                            "Are you sure you want to clear your cart?"
                        );


                    if (
                        confirmed
                    ) {

                        clearCart();

                    }

                }
            );

        }


        /*
         * Product pages can send:
         *
         * document.dispatchEvent(
         *     new CustomEvent("cart:add", {
         *         detail: product
         *     })
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
       28. CROSS-TAB SYNCHRONIZATION
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
       29. PUBLIC API
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
       30. INITIALIZATION
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
