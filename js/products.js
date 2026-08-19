/**
 * ============================================================================
 * PRASUN SHOP — products.js
 * Compatibility & Shared Cart Utility Module
 * ============================================================================
 *
 * IMPORTANT:
 * The products page rendering and fetching is controlled by script.js.
 * Do NOT fetch or render products from this file to prevent duplicate 
 * API calls, event listeners, or state conflicts.
 * ============================================================================
 */

"use strict";

(function () {

    const CONFIG = Object.freeze({
        CART_KEY: "prasun_cart",
        MAX_ITEM_QTY: 99,
        EVENT_CART_UPDATED: "prasun:cart-updated"
    });

    /**
     * Check if localStorage is supported and accessible.
     */
    function isStorageAvailable() {
        try {
            const testKey = "__prasun_storage_test__";
            localStorage.setItem(testKey, "1");
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Read shopping cart safely from localStorage.
     * @returns {Array<Object>}
     */
    function getCart() {
        if (!isStorageAvailable()) {
            return [];
        }

        try {
            const stored = localStorage.getItem(CONFIG.CART_KEY);
            if (!stored) return [];

            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("PRASUN SHOP: Failed to parse cart data.", error);
            return [];
        }
    }

    /**
     * Save shopping cart safely to localStorage and notify listeners.
     * @param {Array<Object>} cart 
     * @returns {boolean}
     */
    function saveCart(cart) {
        const sanitizedCart = Array.isArray(cart) ? cart : [];

        if (!isStorageAvailable()) {
            console.warn("PRASUN SHOP: LocalStorage is not accessible.");
            return false;
        }

        try {
            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(sanitizedCart));
            updateCartBadge();
            notifyCartUpdated(sanitizedCart);
            return true;
        } catch (error) {
            console.error("PRASUN SHOP: Failed to save cart to storage.", error);
            return false;
        }
    }

    /**
     * Broadcast a custom event whenever the cart is updated.
     * @param {Array<Object>} cart 
     */
    function notifyCartUpdated(cart) {
        const count = getCartCount(cart);
        const event = new CustomEvent(CONFIG.EVENT_CART_UPDATED, {
            detail: { cart, count }
        });
        window.dispatchEvent(event);
    }

    /**
     * Add a product to the cart or increment its quantity.
     * @param {Object} product 
     * @param {number|string} quantity 
     * @returns {boolean}
     */
    function addToCart(product, quantity = 1) {
        if (!product || product.id === undefined || product.id === null) {
            console.warn("PRASUN SHOP: Invalid product object provided to addToCart.");
            return false;
        }

        const cart = getCart();
        const productId = String(product.id);
        const parsedQty = Number.parseInt(quantity, 10);
        const addQty = Math.max(1, Math.min(CONFIG.MAX_ITEM_QTY, Number.isNaN(parsedQty) ? 1 : parsedQty));

        const existingIndex = cart.findIndex(item => String(item.id) === productId);

        if (existingIndex > -1) {
            const currentQty = Number(cart[existingIndex].quantity) || 1;
            cart[existingIndex].quantity = Math.min(CONFIG.MAX_ITEM_QTY, currentQty + addQty);
        } else {
            cart.push({
                id: product.id,
                name: String(product.name || "Product"),
                price: Math.max(0, Number(product.price) || 0),
                image: String(product.image || ""),
                category: String(product.category || ""),
                sku: String(product.sku || product.id),
                quantity: addQty
            });
        }

        return saveCart(cart);
    }

    /**
     * Remove an item completely from the cart by Product ID.
     * @param {string|number} productId 
     * @returns {boolean}
     */
    function removeFromCart(productId) {
        if (productId === undefined || productId === null) return false;
        const targetId = String(productId);
        const cart = getCart();
        const filtered = cart.filter(item => String(item.id) !== targetId);
        return saveCart(filtered);
    }

    /**
     * Update item quantity directly in the cart.
     * @param {string|number} productId 
     * @param {number} newQuantity 
     * @returns {boolean}
     */
    function updateQuantity(productId, newQuantity) {
        if (productId === undefined || productId === null) return false;
        const targetId = String(productId);
        const qty = Number.parseInt(newQuantity, 10);

        if (Number.isNaN(qty) || qty <= 0) {
            return removeFromCart(productId);
        }

        const cart = getCart();
        const item = cart.find(i => String(i.id) === targetId);
        if (!item) return false;

        item.quantity = Math.min(CONFIG.MAX_ITEM_QTY, qty);
        return saveCart(cart);
    }

    /**
     * Empty the cart completely.
     * @returns {boolean}
     */
    function clearCart() {
        return saveCart([]);
    }

    /**
     * Calculate total cart quantity across all items.
     * @param {Array<Object>} [cartData] Optional cart array
     * @returns {number}
     */
    function getCartCount(cartData) {
        const cart = Array.isArray(cartData) ? cartData : getCart();
        return cart.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
    }

    /**
     * Calculate subtotal for all items in cart.
     * @param {Array<Object>} [cartData]
     * @returns {number}
     */
    function getCartSubtotal(cartData) {
        const cart = Array.isArray(cartData) ? cartData : getCart();
        return cart.reduce((total, item) => {
            const price = Number(item.price) || 0;
            const qty = Math.max(1, Number(item.quantity) || 1);
            return total + (price * qty);
        }, 0);
    }

    /**
     * Format currency display string.
     * @param {number} amount 
     * @param {string} currencySymbol 
     * @returns {string}
     */
    function formatPrice(amount, currencySymbol = "$") {
        const num = Number(amount) || 0;
        return `${currencySymbol}${num.toFixed(2)}`;
    }

    /**
     * Synchronize DOM cart badges/counters across the page.
     */
    function updateCartBadge() {
        const count = getCartCount();
        const badges = document.querySelectorAll("#cart-count, #cart-badge, .cart-count, .cart-badge");

        badges.forEach(badge => {
            badge.textContent = String(count);

            if (count > 0) {
                badge.hidden = false;
                badge.classList.remove("is-empty");
                if (badge.style.display === "none") {
                    badge.style.display = "";
                }
            } else {
                badge.hidden = true;
                badge.classList.add("is-empty");
            }

            badge.setAttribute(
                "aria-label",
                `${count} item${count === 1 ? "" : "s"} in cart`
            );
        });
    }

    /**
     * Listen for storage events across browser tabs.
     */
    window.addEventListener("storage", function (event) {
        if (event.key === CONFIG.CART_KEY) {
            updateCartBadge();
            notifyCartUpdated(getCart());
        }
    });

    /**
     * Public Shared Cart API
     */
    const PublicAPI = Object.freeze({
        getCart,
        saveCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartCount,
        getCartSubtotal,
        formatPrice,
        updateCartBadge
    });

    window.PrasunShopCart = PublicAPI;
    window.PrasunCart = PublicAPI;

    /**
     * Initialize badge state once DOM is loaded.
     */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateCartBadge);
    } else {
        updateCartBadge();
    }

})();
