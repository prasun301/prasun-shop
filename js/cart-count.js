/**
 * ============================================================================
 * PRASUN SHOP — GLOBAL CART ICON COUNTER
 * ============================================================================
 *
 * Canonical cart:
 *
 *     prasun_cart
 *
 * Legacy compatibility:
 *
 *     prasunShopCart
 *     cart
 *     prasun_cart_items
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const CART_EVENT_NAME =
        "prasunCartUpdated";

    const cartCountEl =
        document.getElementById("cart-count");

    if (!cartCountEl) {
        return;
    }

    function parseCart(raw) {

        if (!raw) {
            return [];
        }

        try {

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart counter JSON error:",
                error
            );

            return [];
        }
    }

    function getCart() {

        try {

            const primary =
                localStorage.getItem(
                    CART_KEY
                );

            if (primary) {
                return parseCart(primary);
            }

            for (
                const legacyKey of LEGACY_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        legacyKey
                    );

                if (legacy) {

                    const cart =
                        parseCart(legacy);

                    if (cart.length) {

                        try {
                            localStorage.setItem(
                                CART_KEY,
                                JSON.stringify(cart)
                            );
                        } catch (_) {}

                        return cart;
                    }
                }
            }

            return [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart counter read error:",
                error
            );

            return [];
        }
    }

    function getCartTotalQuantity() {

        return getCart().reduce(
            (sum, item) => {

                const quantity =
                    Number(item?.quantity);

                if (
                    !Number.isFinite(quantity) ||
                    quantity <= 0
                ) {
                    return sum;
                }

                return sum +
                    Math.floor(quantity);

            },
            0
        );
    }

    function updateCartCount() {

        const total =
            getCartTotalQuantity();

        cartCountEl.textContent =
            String(total);

        cartCountEl.hidden =
            total === 0;

        cartCountEl.setAttribute(
            "aria-label",
            `${total} ${
                total === 1
                    ? "item"
                    : "items"
            } in cart`
        );

        const cartLink =
            cartCountEl.closest("a");

        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${
                        total === 1
                            ? "item"
                            : "items"
                    }`
                    : "View Shopping Cart"
            );
        }
    }

    /*
     * Initial state.
     */
    updateCartCount();

    /*
     * Other browser tabs/windows.
     */
    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(event.key)
            ) {

                updateCartCount();
            }
        }
    );

    /*
     * Same browser tab.
     */
    window.addEventListener(
        CART_EVENT_NAME,
        updateCartCount
    );

    /*
     * Legacy event support.
     */
    window.addEventListener(
        "cartUpdated",
        updateCartCount
    );

})();
