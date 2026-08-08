// =================================
// Prasun Shop Cart Icon Counter
// =================================

(() => {
    // Cache element reference once
    const cartCountEl = document.getElementById("cart-count");
    if (!cartCountEl) return;

    // Safely retrieve total item count from LocalStorage
    function getCartTotalQuantity() {
        try {
            const rawCart = localStorage.getItem("cart");
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
            cartCountEl.classList.remove("hidden", "opacity-0");
        } else {
            cartCountEl.classList.add("hidden", "opacity-0");
        }
    }

    // Initial Execution
    updateCartCount();

    // Cross-Tab Sync: Update badge when cart changes in another tab
    window.addEventListener("storage", (e) => {
        if (e.key === "cart") {
            updateCartCount();
        }
    });

    // Custom Event Hook: Expose listener for single-page dynamic cart updates
    window.addEventListener("cartUpdated", updateCartCount);
})();
