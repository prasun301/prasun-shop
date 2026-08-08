// =================================
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
