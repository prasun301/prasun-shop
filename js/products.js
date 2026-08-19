/**
 * ============================================================================
 * PRASUN SHOP — products.js
 * Compatibility / shared product utilities
 * ============================================================================
 *
 * IMPORTANT:
 * The products page is controlled by script.js.
 * Do NOT fetch or render products from this file.
 *
 * This prevents duplicate API requests, duplicate event listeners,
 * conflicting product rendering, and inconsistent cart storage.
 * ============================================================================
 */

"use strict";

(function () {

    const CONFIG = {
        CART_KEY: "prasun_cart"
    };

    /**
     * Read shopping cart safely.
     */
    function getCart() {
        try {
            const stored = localStorage.getItem(CONFIG.CART_KEY);

            if (!stored) {
                return [];
            }

            const parsed = JSON.parse(stored);

            return Array.isArray(parsed) ? parsed : [];

        } catch (error) {

            console.error("PRASUN SHOP: Failed to read cart.", error);

            return [];
        }
    }

    /**
     * Save shopping cart safely.
     */
    function saveCart(cart) {

        try {

            localStorage.setItem(
                CONFIG.CART_KEY,
                JSON.stringify(Array.isArray(cart) ? cart : [])
            );

            return true;

        } catch (error) {

            console.error("PRASUN SHOP: Failed to save cart.", error);

            return false;
        }
    }

    /**
     * Add a product to cart.
     *
     * This function is exposed globally so other pages can use the
     * same cart structure.
     */
    function addToCart(product, quantity = 1) {

        if (!product || product.id === undefined || product.id === null) {
            return false;
        }

        const cart = getCart();

        const productId = String(product.id);

        const qty = Math.max(
            1,
            Math.min(
                10,
                Number.parseInt(quantity, 10) || 1
            )
        );

        const existing = cart.find(
            item => String(item.id) === productId
        );

        if (existing) {

            existing.quantity =
                (Number(existing.quantity) || 1) + qty;

        } else {

            cart.push({
                id: product.id,
                name: String(product.name || "Product"),
                price: Number(product.price) || 0,
                image: String(product.image || ""),
                category: String(product.category || ""),
                sku: String(product.sku || product.id),
                quantity: qty
            });
        }

        return saveCart(cart);
    }

    /**
     * Get total cart quantity.
     */
    function getCartCount() {

        const cart = getCart();

        return cart.reduce(
            (total, item) =>
                total + (Number(item.quantity) || 1),
            0
        );
    }

    /**
     * Update cart badge.
     */
    function updateCartBadge() {

        const count = getCartCount();

        const badges = document.querySelectorAll(
            "#cart-count, #cart-badge"
        );

        badges.forEach(badge => {

            badge.textContent = count;

            if (count > 0) {
                badge.hidden = false;
                badge.style.display = "";
            } else {
                badge.hidden = true;
            }

            badge.setAttribute(
                "aria-label",
                `${count} item${count === 1 ? "" : "s"} in cart`
            );
        });
    }

    /**
     * Public API.
     */
    window.PrasunShopCart = {
        getCart,
        saveCart,
        addToCart,
        getCartCount,
        updateCartBadge
    };

    /**
     * Keep cart badge synchronized.
     */
    document.addEventListener(
        "DOMContentLoaded",
        updateCartBadge
    );

})();
