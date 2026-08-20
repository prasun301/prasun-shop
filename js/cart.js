/**
 * ============================================================================
 * PRASUN SHOP — CART SYSTEM
 * js/cart.js
 * ============================================================================
 *
 * SUPPLIER SUPPORT:
 *     Multi-Supplier (CJ Dropshipping & AliExpress Compatible)
 *
 * CANONICAL STORAGE:
 *     prasun_cart
 *
 * CART ITEM STRUCTURE:
 * {
 *   id: "Storefront / Product ID",
 *   pid: "Supplier Product ID (CJ/AliExpress)",
 *   cj_id: "CJ Product ID",
 *   aliexpress_id: "AliExpress product ID",
 *   sku: "storefront / supplier SKU",
 *   variantId: "Supplier variant ID (vid)",
 *   variantSku: "Supplier variant SKU",
 *   variantOptions: "Color: Black; Size: M",
 *   name: "Product name",
 *   category: "Category",
 *   price: 29.99,
 *   image: "https://...",
 *   quantity: 1
 * }
 *
 * IMPORTANT:
 *     - No supplier credentials stored in browser.
 *     - Local cart handles quantity, variant matching, and display.
 *     - Cloudflare Worker validates product/price/stock during checkout.
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       1. CONFIGURATION & CONSTANTS
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    /* Legacy storage keys for automatic migration */
    const LEGACY_KEYS = [
        "store_cart",
        "ae_dropship_cart",
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const MAX_QUANTITY = 99;
    const CHECKOUT_URL = "/checkout.html";
    const PRODUCTS_URL = "/products.html";


    /* =========================================================================
       2. CURRENCY FORMATTER
       ========================================================================= */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


    /* =========================================================================
       3. DOM ELEMENTS CACHE
       ========================================================================= */

    let elements = {};

    function cacheDOMElements() {
        elements = {
            cartItems: document.getElementById("cart-items"),
            cartCount: document.getElementById("cart-count"),
            cartItemsCount: document.getElementById("cart-items-count"),
            summaryItemCount: document.getElementById("summary-item-count"),
            cartSubtotal: document.getElementById("cart-subtotal"),
            cartTotal: document.getElementById("cart-total"),
            checkoutButton: document.getElementById("checkout-button"),
            clearCartButton: document.getElementById("clear-cart-button"),
            liveRegion: document.getElementById("cart-live-region")
        };
    }


    /* =========================================================================
       4. STATE
       ========================================================================= */

    let cart = [];


    /* =========================================================================
       5. UTILITY HELPERS
       ========================================================================= */

    function cleanString(value) {
        return String(value ?? "").trim();
    }

    function firstNonEmpty(...values) {
        for (const value of values) {
            const cleaned = cleanString(value);
            if (cleaned) return cleaned;
        }
        return "";
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHTML(value);
    }

    function formatPrice(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "$0.00";
        return currencyFormatter.format(number);
    }

    function normalizeQuantity(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 1;
        return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(number)));
    }

    function normalizePrice(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) return 0;
        return Number(number.toFixed(2));
    }


    /* =========================================================================
       6. SUPPLIER FIELD EXTRACTORS (CJ DROPSHIPPING & ALIEXPRESS)
       ========================================================================= */

    function getSupplierProductId(item) {
        return firstNonEmpty(
            item?.pid,
            item?.cj_id,
            item?.cjId,
            item?.aliexpress_id,
            item?.aliexpressId,
            item?.aliExpressId,
            item?.aliProductId,
            item?.productId,
            item?.productID
        );
    }

    function getAliExpressProductId(item) {
        return firstNonEmpty(
            item?.aliexpress_id,
            item?.aliexpressId,
            item?.aliExpressId,
            item?.aliProductId
        );
    }

    function getStorefrontId(item) {
        return firstNonEmpty(
            item?.id,
            item?.storefrontId,
            item?.storefrontID,
            getSupplierProductId(item)
        );
    }

    function getSKU(item) {
        return firstNonEmpty(
            item?.sku,
            item?.productSku,
            item?.productSKU,
            item?.supplierSku,
            item?.supplierSKU
        );
    }

    function getVariantId(item) {
        return firstNonEmpty(
            item?.variantId,
            item?.variantID,
            item?.variant_id,
            item?.vid,
            item?.aliVariantId,
            item?.aliVariantID
        );
    }

    function getVariantSKU(item) {
        return firstNonEmpty(
            item?.variantSku,
            item?.variantSKU,
            item?.variant_sku,
            item?.aliVariantSku,
            item?.aliVariantSKU
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
            item?.name,
            item?.productName,
            item?.productNameEn,
            item?.title,
            item?.product_title,
            item?.productTitle
        );
    }

    function getProductImage(item) {
        return firstNonEmpty(
            item?.image,
            item?.productImage,
            item?.imageUrl,
            item?.imageURL,
            item?.thumbnail,
            item?.thumbnailUrl,
            item?.mainImage
        );
    }

    function getProductCategory(item) {
        return firstNonEmpty(
            item?.category,
            item?.categoryName,
            item?.category_name,
            item?.categoryNameEn
        );
    }


    /* =========================================================================
       7. CART ITEM NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(item) {
        if (!item || typeof item !== "object") return null;

        const storefrontId = getStorefrontId(item);
        const supplierId = getSupplierProductId(item);
        const aliexpressId = getAliExpressProductId(item);
        const name = getProductName(item);

        /* Product identity requirement */
        if (!storefrontId && !supplierId && !name) {
            return null;
        }

        const sku = getSKU(item);
        const variantId = getVariantId(item);
        const variantSku = getVariantSKU(item);
        const variantOptions = getVariantOptions(item);

        return {
            id: storefrontId || supplierId || name,
            pid: supplierId || storefrontId,
            cj_id: item?.cj_id || item?.cjId || (supplierId && !aliexpressId ? supplierId : ""),
            aliexpress_id: aliexpressId,
            aliexpressId: aliexpressId,
            sku: sku,
            variantId: variantId,
            variantSku: variantSku,
            variantOptions: variantOptions,
            name: name || "Product",
            category: getProductCategory(item),
            price: normalizePrice(item?.price ?? item?.sellPrice),
            image: getProductImage(item),
            quantity: normalizeQuantity(item?.quantity)
        };
    }

    function normalizeCartArray(value) {
        if (!Array.isArray(value)) return [];
        return value.map(normalizeCartItem).filter(Boolean);
    }


    /* =========================================================================
       8. LOCAL STORAGE OPERATIONS
       ========================================================================= */

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error("[PRASUN SHOP] Unable to read localStorage:", error);
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error("[PRASUN SHOP] Unable to write localStorage:", error);
            return false;
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error("[PRASUN SHOP] Unable to remove localStorage item:", error);
        }
    }


    /* =========================================================================
       9. CART DATA READ & WRITE
       ========================================================================= */

    function parseStoredCart(raw) {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return normalizeCartArray(parsed);
        } catch {
            return [];
        }
    }

    function readCartFromStorage() {
        const primary = readStorage(CART_KEY);

        if (primary) {
            const parsed = parseStoredCart(primary);
            if (parsed.length) return parsed;

            try {
                const value = JSON.parse(primary);
                if (Array.isArray(value)) return [];
            } catch (_) {}
        }

        /* Legacy Key Migration */
        for (const key of LEGACY_KEYS) {
            const raw = readStorage(key);
            if (!raw) continue;

            const migrated = parseStoredCart(raw);
            if (!migrated.length) continue;

            writeStorage(CART_KEY, JSON.stringify(migrated));
            return migrated;
        }

        return [];
    }

    function saveCart(nextCart) {
        cart = normalizeCartArray(nextCart);

        writeStorage(CART_KEY, JSON.stringify(cart));

        /* Clean up legacy storage entries */
        for (const key of LEGACY_KEYS) {
            removeStorage(key);
        }

        dispatchCartUpdate();
        return cart;
    }

    function dispatchCartUpdate() {
        try {
            window.dispatchEvent(
                new CustomEvent("prasunCartUpdated", {
                    detail: { cart: cart.map(item => ({ ...item })) }
                })
            );
        } catch (error) {
            console.error("[PRASUN SHOP] Cart event error:", error);
        }
    }

    function clearAllCartStorage() {
        removeStorage(CART_KEY);
        for (const key of LEGACY_KEYS) {
            removeStorage(key);
        }
    }


    /* =========================================================================
       10. PRODUCT IDENTITY MATCHING
       ========================================================================= */

    function sameCartProduct(a, b) {
        const aVariantId = getVariantId(a);
        const bVariantId = getVariantId(b);

        if (aVariantId && bVariantId) {
            return aVariantId === bVariantId;
        }

        if (aVariantId || bVariantId) {
            return false;
        }

        const aVariantSku = getVariantSKU(a);
        const bVariantSku = getVariantSKU(b);

        if (aVariantSku && bVariantSku) {
            if (aVariantSku.toLowerCase() !== bVariantSku.toLowerCase()) {
                return false;
            }
        }

        const aOptions = getVariantOptions(a);
        const bOptions = getVariantOptions(b);

        if (aOptions && bOptions) {
            if (aOptions.toLowerCase() !== bOptions.toLowerCase()) {
                return false;
            }
        }

        const aSupplierId = getSupplierProductId(a);
        const bSupplierId = getSupplierProductId(b);

        if (aSupplierId && bSupplierId) {
            return aSupplierId === bSupplierId;
        }

        const aSKU = getSKU(a);
        const bSKU = getSKU(b);

        if (aSKU && bSKU) {
            return aSKU.toLowerCase() === bSKU.toLowerCase();
        }

        const aId = cleanString(a.id);
        const bId = cleanString(b.id);

        if (aId && bId) {
            return aId === bId;
        }

        const aName = cleanString(a.name).toLowerCase();
        const bName = cleanString(b.name).toLowerCase();

        return Boolean(aName && bName && aName === bName);
    }


    /* =========================================================================
       11. CART MUTATIONS
       ========================================================================= */

    function addProduct(product, quantity = 1) {
        if (!product || typeof product !== "object") {
            console.error("[PRASUN SHOP] Invalid product passed to cart.");
            return false;
        }

        cart = readCartFromStorage();

        const normalized = normalizeCartItem({
            ...product,
            quantity: normalizeQuantity(quantity)
        });

        if (!normalized) {
            console.error("[PRASUN SHOP] Product normalization failed:", product);
            return false;
        }

        const existingIndex = cart.findIndex(item => sameCartProduct(item, normalized));

        if (existingIndex >= 0) {
            const existing = cart[existingIndex];
            const newQuantity = normalizeQuantity(existing.quantity + normalized.quantity);

            cart[existingIndex] = {
                ...existing,
                ...normalized,
                quantity: newQuantity
            };
        } else {
            cart.push(normalized);
        }

        saveCart(cart);
        renderCart();
        announce(`${normalized.name} added to cart.`);

        return true;
    }

    function updateQuantity(index, quantity) {
        if (!Number.isInteger(index) || index < 0 || index >= cart.length) {
            return false;
        }

        const item = cart[index];
        const newQuantity = normalizeQuantity(quantity);

        item.quantity = newQuantity;

        saveCart(cart);
        renderCart();
        announce(`${item.name} quantity updated to ${newQuantity}.`);

        return true;
    }

    function removeItem(index) {
        if (!Number.isInteger(index) || index < 0 || index >= cart.length) {
            return false;
        }

        const removed = cart[index];
        cart.splice(index, 1);

        saveCart(cart);
        renderCart();
        announce(`${removed.name} removed from cart.`);

        return true;
    }

    function clearCart() {
        cart = [];
        clearAllCartStorage();
        dispatchCartUpdate();
        renderCart();
        announce("Cart cleared.");
    }


    /* =========================================================================
       12. CALCULATIONS & STATS
       ========================================================================= */

    function getTotalQuantity() {
        return cart.reduce((total, item) => {
            return total + normalizeQuantity(item.quantity);
        }, 0);
    }

    function getSubtotal() {
        return Number(
            cart.reduce((total, item) => {
                const price = normalizePrice(item.price);
                const quantity = normalizeQuantity(item.quantity);
                return total + (price * quantity);
            }, 0).toFixed(2)
        );
    }


    /* =========================================================================
       13. DOM RENDERING & UI UPDATES
       ========================================================================= */

    function updateHeaderCount() {
        const totalQuantity = getTotalQuantity();

        if (elements.cartCount) {
            elements.cartCount.textContent = String(totalQuantity);
            elements.cartCount.hidden = totalQuantity <= 0;
            elements.cartCount.setAttribute(
                "aria-label",
                `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"} in cart`
            );
        }

        if (elements.cartItemsCount) {
            elements.cartItemsCount.textContent = `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`;
        }

        if (elements.summaryItemCount) {
            elements.summaryItemCount.textContent = String(totalQuantity);
        }
    }

    function renderEmptyCart() {
        if (!elements.cartItems) return;

        elements.cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="20" r="1"></circle>
                        <circle cx="19" cy="20" r="1"></circle>
                        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"></path>
                    </svg>
                </div>
                <h2>Your cart is empty</h2>
                <p>Browse our products and add something to your cart to continue shopping.</p>
                <a href="${PRODUCTS_URL}" class="continue-shopping">Continue Shopping</a>
            </div>
        `;
    }

    function handleImageError(image) {
        if (!image) return;
        image.style.display = "none";
        const parent = image.parentElement;
        if (!parent || parent.querySelector(".cart-item-image-placeholder")) return;

        const placeholder = document.createElement("div");
        placeholder.className = "cart-item-image cart-item-image-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.textContent = "🛍";
        parent.appendChild(placeholder);
    }

    function renderCart() {
        cacheDOMElements();
        cart = readCartFromStorage();
        updateHeaderCount();

        if (!elements.cartItems) return;

        if (!cart.length) {
            renderEmptyCart();

            if (elements.cartSubtotal) elements.cartSubtotal.textContent = "$0.00";
            if (elements.cartTotal) elements.cartTotal.textContent = "$0.00";

            if (elements.checkoutButton) {
                elements.checkoutButton.disabled = true;
                elements.checkoutButton.setAttribute("aria-disabled", "true");
            }

            if (elements.clearCartButton) {
                elements.clearCartButton.disabled = true;
            }

            return;
        }

        let subtotal = 0;

        const html = cart.map((item, index) => {
            const quantity = normalizeQuantity(item.quantity);
            const price = normalizePrice(item.price);
            const itemSubtotal = Number((price * quantity).toFixed(2));
            subtotal += itemSubtotal;

            const image = escapeAttribute(item.image);
            const name = escapeHTML(item.name || "Product");
            const category = escapeHTML(item.category || "");
            const variantId = escapeHTML(getVariantId(item));
            const variantSKU = escapeHTML(getVariantSKU(item));
            const variantOptions = escapeHTML(getVariantOptions(item));

            let variantText = "";
            if (variantOptions) {
                variantText = variantOptions;
            } else if (variantSKU) {
                variantText = `SKU: ${variantSKU}`;
            } else if (variantId) {
                variantText = `Variant: ${variantId}`;
            }

            return `
                <article class="cart-item" data-cart-index="${index}">
                    <div class="cart-item-product">
                        <a href="${PRODUCTS_URL}" class="cart-item-image-link" aria-label="${escapeAttribute(name)}">
                            ${
                                image
                                    ? `<img src="${image}" alt="${escapeAttribute(name)}" class="cart-item-image" loading="lazy" decoding="async">`
                                    : `<div class="cart-item-image cart-item-image-placeholder" aria-hidden="true">🛍</div>`
                            }
                        </a>

                        <div class="cart-item-info">
                            ${category ? `<span class="cart-item-category">${category}</span>` : ""}
                            <h3 class="cart-item-title">
                                <a href="${PRODUCTS_URL}">${name}</a>
                            </h3>
                            <p class="cart-item-price">${formatPrice(price)} each</p>
                            ${variantText ? `<p class="cart-item-variant">${variantText}</p>` : ""}
                        </div>
                    </div>

                    <div class="cart-item-controls">
                        <div class="quantity-control" aria-label="Quantity controls">
                            <button
                                type="button"
                                data-action="decrease"
                                data-index="${index}"
                                aria-label="Decrease quantity of ${escapeAttribute(name)}"
                                ${quantity <= 1 ? "disabled" : ""}
                            >
                                −
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
                                aria-label="Quantity for ${escapeAttribute(name)}"
                                inputmode="numeric"
                            >

                            <button
                                type="button"
                                data-action="increase"
                                data-index="${index}"
                                aria-label="Increase quantity of ${escapeAttribute(name)}"
                                ${quantity >= MAX_QUANTITY ? "disabled" : ""}
                            >
                                +
                            </button>
                        </div>

                        <div class="cart-item-subtotal">
                            <strong>${formatPrice(itemSubtotal)}</strong>
                            <button
                                type="button"
                                class="cart-remove-button"
                                data-action="remove"
                                data-index="${index}"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        elements.cartItems.innerHTML = html;

        /* Image fallbacks */
        const images = elements.cartItems.querySelectorAll("img.cart-item-image");
        images.forEach(image => {
            image.addEventListener("error", () => handleImageError(image), { once: true });
        });

        /* Summary & Action Updates */
        subtotal = Number(subtotal.toFixed(2));

        if (elements.cartSubtotal) elements.cartSubtotal.textContent = formatPrice(subtotal);
        if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(subtotal);

        if (elements.checkoutButton) {
            elements.checkoutButton.disabled = false;
            elements.checkoutButton.setAttribute("aria-disabled", "false");
        }

        if (elements.clearCartButton) {
            elements.clearCartButton.disabled = false;
        }
    }


    /* =========================================================================
       14. ACCESSIBILITY ANNOUNCEMENTS
       ========================================================================= */

    function announce(message) {
        if (!elements.liveRegion) return;
        elements.liveRegion.textContent = "";
        window.setTimeout(() => {
            elements.liveRegion.textContent = message;
        }, 20);
    }


    /* =========================================================================
       15. EVENT LISTENERS
       ========================================================================= */

    function bindEvents() {
        if (elements.cartItems) {
            elements.cartItems.addEventListener("click", event => {
                const button = event.target.closest("button[data-action]");
                if (!button) return;

                const index = Number(button.dataset.index);
                const action = button.dataset.action;

                if (!Number.isInteger(index) || index < 0 || index >= cart.length) return;

                if (action === "increase") {
                    updateQuantity(index, cart[index].quantity + 1);
                } else if (action === "decrease") {
                    updateQuantity(index, cart[index].quantity - 1);
                } else if (action === "remove") {
                    removeItem(index);
                }
            });

            elements.cartItems.addEventListener("change", event => {
                const input = event.target.closest('input[data-action="quantity"]');
                if (!input) return;

                const index = Number(input.dataset.index);
                if (!Number.isInteger(index)) return;

                updateQuantity(index, input.value);
            });

            elements.cartItems.addEventListener("keydown", event => {
                const input = event.target.closest('input[data-action="quantity"]');
                if (!input) return;

                if (event.key === "Enter") {
                    event.preventDefault();
                    input.blur();
                }
            });
        }

        if (elements.checkoutButton) {
            elements.checkoutButton.addEventListener("click", () => {
                cart = readCartFromStorage();
                if (!cart.length) return;

                saveCart(cart);
                window.location.href = CHECKOUT_URL;
            });
        }

        if (elements.clearCartButton) {
            elements.clearCartButton.addEventListener("click", () => {
                if (!cart.length) return;

                if (window.confirm("Are you sure you want to clear your cart?")) {
                    clearCart();
                }
            });
        }

        /* Listen for custom add-to-cart events (dispatched by product cards) */
        document.addEventListener("cart:add", event => {
            if (event.detail) {
                addProduct(event.detail);
            }
        });
    }


    /* =========================================================================
       16. CROSS-TAB & SYNCHRONIZATION LISTENERS
       ========================================================================= */

    window.addEventListener("storage", event => {
        if (event.key === CART_KEY || LEGACY_KEYS.includes(event.key)) {
            cart = readCartFromStorage();
            renderCart();
        }
    });

    window.addEventListener("prasunCartUpdated", () => {
        cart = readCartFromStorage();
        renderCart();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            cart = readCartFromStorage();
            renderCart();
        }
    });


    /* =========================================================================
       17. PUBLIC API & GLOBAL BINDINGS
       ========================================================================= */

    window.addToCart = addProduct;

    window.PrasunCart = {
        getCart: () => readCartFromStorage(),
        getCount: () => {
            cart = readCartFromStorage();
            return getTotalQuantity();
        },
        getSubtotal: () => {
            cart = readCartFromStorage();
            return getSubtotal();
        },
        add: addProduct,
        addProduct: addProduct,
        updateQuantity: updateQuantity,
        removeItem: removeItem,
        clear: clearCart,
        clearCart: clearCart,
        save: saveCart,
        render: renderCart
    };


    /* =========================================================================
       18. INITIALIZATION
       ========================================================================= */

    document.addEventListener("DOMContentLoaded", () => {
        cacheDOMElements();
        bindEvents();
        cart = readCartFromStorage();
        renderCart();
    });

    /* Initial immediate load */
    cacheDOMElements();
    cart = readCartFromStorage();
    renderCart();

})();
