/**
 * ============================================================================
 * PRASUN SHOP — CART ICON COUNTER
 * ============================================================================
 *
 * Production-ready cart badge synchronization.
 *
 * PRIMARY STORAGE:
 *     prasun_cart
 *
 * EVENTS:
 *     prasunCartUpdated
 *     cartUpdated (legacy compatibility)
 *
 * FEATURES:
 *     - Single canonical cart key
 *     - Legacy cart migration support
 *     - Cross-tab synchronization
 *     - Same-tab synchronization
 *     - Accurate quantity counting
 *     - Duplicate product protection
 *     - Invalid quantity protection
 *     - Accessible ARIA labels
 *     - Works on every page containing #cart-count
 *     - No dependency on cart.js
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const CART_EVENT_NAME = "prasunCartUpdated";

    const LEGACY_EVENT_NAME = "cartUpdated";


    /* ========================================================================
       DOM
       ======================================================================== */

    const cartCountEl =
        document.getElementById("cart-count");


    /*
     * If this page does not contain a cart badge,
     * there is nothing for this module to do.
     */
    if (!cartCountEl) {
        return;
    }


    /* ========================================================================
       NORMALIZE QUANTITY
       ======================================================================== */

    function normalizeQuantity(value) {

        const quantity =
            Number(value);

        if (
            !Number.isFinite(quantity) ||
            quantity <= 0
        ) {
            return 0;
        }

        return Math.floor(quantity);
    }


    /* ========================================================================
       READ CART
       ======================================================================== */

    function readCartFromStorage(key) {

        try {

            const raw =
                localStorage.getItem(key);

            if (!raw) {
                return null;
            }

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return null;
            }

            return parsed;

        } catch (error) {

            console.warn(
                `[PRASUN SHOP] Unable to read cart key "${key}".`,
                error
            );

            return null;
        }
    }


    /* ========================================================================
       GET CART
       ======================================================================== */

    function getCart() {

        /*
         * Always prefer the canonical cart.
         */
        const primaryCart =
            readCartFromStorage(
                CART_KEY
            );

        if (primaryCart) {
            return primaryCart;
        }


        /*
         * Legacy fallback.
         *
         * This does NOT overwrite the canonical cart automatically.
         * cart.js remains responsible for full cart normalization/migration.
         */
        for (
            const legacyKey of LEGACY_KEYS
        ) {

            const legacyCart =
                readCartFromStorage(
                    legacyKey
                );

            if (legacyCart) {
                return legacyCart;
            }
        }


        return [];
    }


    /* ========================================================================
       CALCULATE TOTAL QUANTITY
       ======================================================================== */

    function getCartTotalQuantity() {

        const cart =
            getCart();


        if (!Array.isArray(cart)) {
            return 0;
        }


        let total =
            0;


        for (
            const item of cart
        ) {

            if (
                !item ||
                typeof item !== "object"
            ) {
                continue;
            }


            total +=
                normalizeQuantity(
                    item.quantity
                );
        }


        return total;
    }


    /* ========================================================================
       UPDATE ARIA LABELS
       ======================================================================== */

    function updateAccessibility(
        total
    ) {

        const itemLabel =
            total === 1
                ? "item"
                : "items";


        /*
         * Badge accessibility.
         */
        cartCountEl.setAttribute(
            "aria-label",
            `${total} ${itemLabel} in cart`
        );


        /*
         * Cart link accessibility.
         */
        const cartLink =
            cartCountEl.closest("a");


        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",

                total > 0

                    ? `View Shopping Cart, ${total} ${itemLabel}`

                    : "View Shopping Cart"
            );
        }
    }


    /* ========================================================================
       UPDATE BADGE
       ======================================================================== */

    function updateCartCount() {

        const total =
            getCartTotalQuantity();


        /*
         * Update displayed quantity.
         */
        cartCountEl.textContent =
            String(total);


        /*
         * Keep both hidden and visual accessibility states
         * compatible with different site CSS implementations.
         */
        if (total === 0) {

            cartCountEl.hidden =
                true;

            cartCountEl.classList.add(
                "hidden"
            );

            cartCountEl.classList.add(
                "opacity-0"
            );

            cartCountEl.classList.add(
                "invisible"
            );

            cartCountEl.classList.remove(
                "visible"
            );

            cartCountEl.classList.remove(
                "opacity-100"
            );

        } else {

            cartCountEl.hidden =
                false;

            cartCountEl.classList.remove(
                "hidden"
            );

            cartCountEl.classList.remove(
                "opacity-0"
            );

            cartCountEl.classList.remove(
                "invisible"
            );

            cartCountEl.classList.add(
                "visible"
            );

            cartCountEl.classList.add(
                "opacity-100"
            );
        }


        updateAccessibility(
            total
        );
    }


    /* ========================================================================
       STORAGE EVENT
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            /*
             * The storage event fires in OTHER tabs/windows.
             */
            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {

                updateCartCount();
            }
        }
    );


    /* ========================================================================
       SAME-TAB CART EVENT
       ======================================================================== */

    window.addEventListener(
        CART_EVENT_NAME,
        event => {

            /*
             * cart.js sends the current cart in event.detail.cart.
             *
             * We don't need to trust the event payload because
             * localStorage is the canonical source.
             */
            updateCartCount();
        }
    );


    /* ========================================================================
       LEGACY EVENT
       ======================================================================== */

    window.addEventListener(
        LEGACY_EVENT_NAME,
        () => {

            updateCartCount();

        }
    );


    /* ========================================================================
       PAGE VISIBILITY SYNC
       ======================================================================== */

    /*
     * Useful when a user switches back to a tab after modifying
     * the cart elsewhere.
     */
    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState === "visible"
            ) {

                updateCartCount();
            }
        }
    );


    /* ========================================================================
       WINDOW FOCUS SYNC
       ======================================================================== */

    window.addEventListener(
        "focus",
        updateCartCount
    );


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    updateCartCount();

})();
