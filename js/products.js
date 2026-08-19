/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS.JS COMPATIBILITY MODULE
 * ============================================================================
 *
 * Product catalog management is now handled by:
 *
 *     js/script.js
 *
 * Products are loaded from:
 *
 *     /api/products
 *
 * This file intentionally contains no hard-coded product catalog.
 * It is retained only for compatibility with older pages that may still
 * reference products.js.
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY = "prasun_cart";

    function getCart() {

        try {

            const raw =
                localStorage.getItem(
                    CART_KEY
                );


            if (!raw) {
                return [];
            }


            const parsed =
                JSON.parse(raw);


            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] Unable to read cart:",
                error
            );

            return [];
        }
    }


    function updateCartBadge() {

        const badge =
            document.getElementById(
                "cart-count"
            );


        if (!badge) {
            return;
        }


        const cart =
            getCart();


        const count =
            cart.reduce(
                (total, item) => {

                    const quantity =
                        Number(item?.quantity);


                    return total +
                        (
                            Number.isFinite(quantity) &&
                            quantity > 0
                        )
                            ? Math.floor(quantity)
                            : 0;
                },
                0
            );


        badge.textContent =
            String(count);


        badge.hidden =
            count === 0;


        badge.setAttribute(
            "aria-label",
            `${count} ${count === 1 ? "item" : "items"} in cart`
        );
    }


    /*
     * Public compatibility helper.
     *
     * Older scripts can call:
     *
     *     window.PrasunShopProducts.updateCartBadge()
     */
    window.PrasunShopProducts = {
        updateCartBadge
    };


    updateCartBadge();


    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY
            ) {
                updateCartBadge();
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        updateCartBadge
    );

})();
