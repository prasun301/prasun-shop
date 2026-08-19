/**
 * ============================================================================
 * PRASUN SHOP — CART ICON COUNTER
 * ============================================================================
 *
 * Single cart storage key:
 *
 *     prasun_cart
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


    const CART_EVENT_NAME =
        "prasunCartUpdated";


    function getCart() {

        try {

            let raw =
                localStorage.getItem(
                    CART_KEY
                );


            /*
             * Legacy migration fallback.
             */
            if (!raw) {

                for (
                    const key of LEGACY_KEYS
                ) {

                    const legacy =
                        localStorage.getItem(
                            key
                        );


                    if (legacy) {

                        raw =
                            legacy;

                        break;
                    }
                }
            }


            if (!raw) {
                return [];
            }


            const parsed =
                JSON.parse(raw);


            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart count read error:",
                error
            );


            return [];
        }
    }


    function getCartTotalQuantity() {

        const cart =
            getCart();


        return cart.reduce(
            (sum, item) => {

                const quantity =
                    Number(
                        item?.quantity
                    );


                if (
                    !Number.isFinite(
                        quantity
                    ) ||
                    quantity <= 0
                ) {
                    return sum;
                }


                return sum +
                    Math.floor(
                        quantity
                    );

            },
            0
        );
    }


    function updateCartCount() {

        const cartCountEl =
            document.getElementById(
                "cart-count"
            );


        if (!cartCountEl) {
            return;
        }


        const total =
            getCartTotalQuantity();


        cartCountEl.textContent =
            String(total);


        cartCountEl.hidden =
            total === 0;


        cartCountEl.setAttribute(
            "aria-label",
            `${total} ${total === 1 ? "item" : "items"} in cart`
        );


        const cartLink =
            cartCountEl.closest("a");


        if (cartLink) {

            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }


    /*
     * Initial update.
     */
    updateCartCount();


    /*
     * Cross-tab synchronization.
     */
    window.addEventListener(
        "storage",
        event => {

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


    /*
     * Same-tab synchronization.
     */
    window.addEventListener(
        CART_EVENT_NAME,
        updateCartCount
    );


    /*
     * Legacy compatibility.
     */
    window.addEventListener(
        "cartUpdated",
        updateCartCount
    );

})();// =================================
// Prasun Shop Cart Icon Counter
// =================================

"use strict";

(() => {
    const CART_KEY_PRIMARY = "prasunShopCart";
    const CART_KEY_LEGACY = "cart";
    const CART_EVENT_NAME = "prasunCartUpdated";

    // Cache element reference once
    const cartCountEl = document.getElementById("cart-count");
    if (!cartCountEl) return;

    // Safely retrieve total item count from LocalStorage
    function getCartTotalQuantity() {
        try {
            const rawCart = localStorage.getItem(CART_KEY_PRIMARY) || localStorage.getItem(CART_KEY_LEGACY);
            if (!rawCart) return 0;

            const cart = JSON.parse(rawCart);
            if (!Array.isArray(cart)) return 0;

            return cart.reduce((sum, item) => {
                const qty = Number(item?.quantity);
                return sum + (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0);
            }, 0);
        } catch (error) {
            console.error("Error reading cart count from localStorage:", error);
            return 0;
        }
    }

    // Main Update Function
    function updateCartCount() {
        const totalItems = getCartTotalQuantity();

        // textContent prevents unnecessary browser layout reflows
        cartCountEl.textContent = totalItems;
        cartCountEl.setAttribute("aria-label", `${totalItems} items in cart`);

        // Optional UX: Toggle badge visibility if empty
        if (totalItems > 0) {
            cartCountEl.classList.remove("hidden", "opacity-0", "invisible");
            cartCountEl.classList.add("opacity-100", "visible");
        } else {
            cartCountEl.classList.remove("opacity-100", "visible");
            cartCountEl.classList.add("hidden", "opacity-0", "invisible");
        }
    }

    // Initial Execution
    updateCartCount();

    // Cross-Tab Sync: Update badge when cart changes in another tab
    window.addEventListener("storage", (e) => {
        if (e.key === CART_KEY_PRIMARY || e.key === CART_KEY_LEGACY) {
            updateCartCount();
        }
    });

    // Custom Event Hook: Synchronized with cart.js event name ("prasunCartUpdated")
    window.addEventListener(CART_EVENT_NAME, updateCartCount);
    window.addEventListener("cartUpdated", updateCartCount); // Legacy fallback support
})();
