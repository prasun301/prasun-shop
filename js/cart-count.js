/**
 * ============================================================================
 * PRASUN SHOP — GLOBAL CART ICON COUNTER (v2.0)
 * ============================================================================
 *
 * Canonical storage:
 *      prasun_cart
 *
 * Legacy storage supported:
 *      prasunShopCart, cart, prasun_cart_items
 *
 * Features:
 * - Direct integration with window.PrasunCart (avoids redundant storage reads)
 * - Multi-element target binding (#cart-count, #cart-items-count, [data-cart-count])
 * - Restricted/blocked localStorage resilience
 * - Subtle visual bump animation on quantity increases
 * - Complete accessibility attribute management for badges & links
 * - Multi-tab & custom event synchronization
 * ============================================================================
 */

"use strict";

(() => {
    const CART_KEY = "prasun_cart";
    const LEGACY_KEYS = ["prasunShopCart", "cart", "prasun_cart_items"];
    const CART_EVENT_NAME = "prasunCartUpdated";
    const ANIMATION_CLASS = "cart-count-bump";
    const ANIMATION_DURATION_MS = 300;

    let previousTotal = null;

    /* Safe storage check */
    function isStorageAvailable() {
        try {
            const testKey = "__prasun_test__";
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (_) {
            return false;
        }
    }

    const storageAvailable = isStorageAvailable();

    function getStorageItem(key) {
        if (!storageAvailable) return null;
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function setStorageItem(key, value) {
        if (!storageAvailable) return;
        try {
            localStorage.setItem(key, value);
        } catch (_) {}
    }

    function parseCart(raw) {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("[PRASUN SHOP] Cart counter JSON error:", error);
            return [];
        }
    }

    function getCartFromStorage() {
        const primary = getStorageItem(CART_KEY);
        if (primary) {
            return parseCart(primary);
        }

        for (const legacyKey of LEGACY_KEYS) {
            const legacy = getStorageItem(legacyKey);
            if (legacy) {
                const cart = parseCart(legacy);
                if (cart.length) {
                    setStorageItem(CART_KEY, JSON.stringify(cart));
                    return cart;
                }
            }
        }

        return [];
    }

    function getCartTotalQuantity() {
        // Priority 1: Use window.PrasunCart API if cart.js is loaded
        if (window.PrasunCart && typeof window.PrasunCart.getTotals === "function") {
            const totals = window.PrasunCart.getTotals();
            if (totals && typeof totals.itemCount === "number") {
                return totals.itemCount;
            }
        }

        // Priority 2: Fallback to direct local storage reading
        const cart = getCartFromStorage();
        return cart.reduce((sum, item) => {
            const quantity = Number(item?.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                return sum;
            }
            return sum + Math.floor(quantity);
        }, 0);
    }

    function getTargetElements() {
        const targets = new Set();

        const primaryCount = document.getElementById("cart-count");
        if (primaryCount) targets.add(primaryCount);

        const itemsCount = document.getElementById("cart-items-count");
        if (itemsCount) targets.add(itemsCount);

        document.querySelectorAll("[data-cart-count]").forEach(el => targets.add(el));

        return Array.from(targets);
    }

    function updateElement(el, total) {
        const countString = String(total);
        const labelText = `${total} ${total === 1 ? "item" : "items"}`;

        if (el.textContent !== countString) {
            el.textContent = countString;
        }

        if (el.id === "cart-count" || el.hasAttribute("data-hide-when-empty")) {
            el.hidden = total === 0;
        }

        el.setAttribute("aria-label", `${labelText} in cart`);

        const cartLink = el.closest("a");
        if (cartLink) {
            cartLink.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${labelText}`
                    : "View Shopping Cart"
            );
        }

        if (previousTotal !== null && total > previousTotal) {
            el.classList.remove(ANIMATION_CLASS);
            void el.offsetWidth; // Trigger reflow for CSS animation reset
            el.classList.add(ANIMATION_CLASS);

            setTimeout(() => {
                el.classList.remove(ANIMATION_CLASS);
            }, ANIMATION_DURATION_MS);
        }
    }

    function updateCartCount() {
        const elements = getTargetElements();
        if (!elements.length) return;

        const total = getCartTotalQuantity();

        elements.forEach(el => updateElement(el, total));

        previousTotal = total;
    }

    /* Initial state execution */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateCartCount);
    } else {
        updateCartCount();
    }

    /* Event Listeners */
    window.addEventListener("storage", event => {
        if (event.key === CART_KEY || LEGACY_KEYS.includes(event.key)) {
            updateCartCount();
        }
    });

    window.addEventListener(CART_EVENT_NAME, updateCartCount);
    window.addEventListener("cartUpdated", updateCartCount);

    /* PUBLIC API */
    window.PrasunCartCount = {
        update: updateCartCount,
        getQuantity: getCartTotalQuantity
    };
})();
