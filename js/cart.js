/**
 * ============================================================================
 * PRASUN SHOP — ENHANCED CART MANAGEMENT (v2.1)
 * ============================================================================
 */

"use strict";

(() => {
    const CART_KEY = "prasun_cart";
    const LEGACY_KEYS = ["prasunShopCart", "cart", "prasun_cart_items"];
    const CART_EVENT_NAME = "prasunCartUpdated";
    const MAX_QUANTITY = 99;

    /* Safe storage fallback */
    let memoryStorage = null;

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
        if (storageAvailable) {
            return localStorage.getItem(key);
        }
        return memoryStorage ? memoryStorage[key] || null : null;
    }

    function setStorageItem(key, value) {
        if (storageAvailable) {
            try {
                localStorage.setItem(key, value);
            } catch (err) {
                console.warn("[PRASUN SHOP] Storage quota exceeded or disabled.", err);
            }
        } else {
            if (!memoryStorage) memoryStorage = {};
            memoryStorage[key] = String(value);
        }
    }

    function removeStorageItem(key) {
        if (storageAvailable) {
            try {
                localStorage.removeItem(key);
            } catch (_) {}
        } else if (memoryStorage) {
            delete memoryStorage[key];
        }
    }

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const FALLBACK_IMAGE =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
              <rect width="400" height="400" fill="#f4f4f5"/>
              <text x="200" y="200" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="Arial,sans-serif" font-size="18">
                Image unavailable
              </text>
            </svg>
        `);

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value).replace(/[&<>"']/g, char => ESCAPE_MAP[char]);
    }

    function formatPrice(value) {
        const number = Number(value);
        return Number.isFinite(number) ? currencyFormatter.format(number) : "$0.00";
    }

    function announceAccessibility(message) {
        let liveRegionEl = document.getElementById("cart-live-region");
        if (!liveRegionEl) {
            liveRegionEl = document.createElement("div");
            liveRegionEl.id = "cart-live-region";
            liveRegionEl.className = "visually-hidden";
            liveRegionEl.setAttribute("aria-live", "polite");
            liveRegionEl.setAttribute("aria-atomic", "true");
            document.body.appendChild(liveRegionEl);
        }
        liveRegionEl.textContent = message;
    }

    function normalizeCartItem(item) {
        if (!item || item.id === undefined || item.id === null) {
            return null;
        }

        const price = Number(item.price);
        const quantity = Number(item.quantity);

        return {
            id: String(item.id),
            sku: String(item.sku || item.productSku || item.id),
            name: String(item.name || item.productName || item.title || "Product"),
            price: Number.isFinite(price) && price >= 0 ? price : 0,
            image: String(item.image || item.productImage || item.imageUrl || ""),
            category: String(item.category || item.categoryName || ""),
            description: String(item.description || ""),
            rating: Number.isFinite(Number(item.rating))
                ? Math.max(0, Math.min(5, Number(item.rating)))
                : 5,
            features: Array.isArray(item.features) ? item.features : [],
            specifications: item.specifications && typeof item.specifications === "object" ? item.specifications : {},
            quantity: Number.isFinite(quantity) && quantity > 0
                ? Math.min(MAX_QUANTITY, Math.floor(quantity))
                : 1
        };
    }

    function parseCart(raw) {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.map(normalizeCartItem).filter(Boolean);
        } catch (error) {
            console.error("[PRASUN SHOP] Invalid cart JSON:", error);
            return [];
        }
    }

    function mergeDuplicateItems(items) {
        const map = new Map();
        items.forEach(item => {
            const id = String(item.id);
            const existing = map.get(id);
            if (existing) {
                existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + item.quantity);
            } else {
                map.set(id, { ...item });
            }
        });
        return Array.from(map.values());
    }

    function getCart() {
        try {
            const primary = getStorageItem(CART_KEY);
            if (primary) {
                return mergeDuplicateItems(parseCart(primary));
            }

            for (const key of LEGACY_KEYS) {
                const legacy = getStorageItem(key);
                if (!legacy) continue;

                const migrated = mergeDuplicateItems(parseCart(legacy));
                if (migrated.length) {
                    setStorageItem(CART_KEY, JSON.stringify(migrated));
                    return migrated;
                }
            }

            return [];
        } catch (error) {
            console.error("[PRASUN SHOP] Cart read error:", error);
            return [];
        }
    }

    let cart = getCart();

    function saveCart(silent = false) {
        try {
            setStorageItem(CART_KEY, JSON.stringify(cart));
            LEGACY_KEYS.forEach(key => removeStorageItem(key));

            window.dispatchEvent(
                new CustomEvent(CART_EVENT_NAME, {
                    detail: {
                        cart: cart.map(item => ({ ...item })),
                        silent
                    }
                })
            );

            return true;
        } catch (error) {
            console.error("[PRASUN SHOP] Cart save error:", error);
            return false;
        }
    }

    function getTotalQuantity() {
        return cart.reduce((sum, item) => {
            const q = Number(item.quantity);
            return sum + (Number.isFinite(q) && q > 0 ? Math.floor(q) : 0);
        }, 0);
    }

    function calculateSubtotal() {
        return cart.reduce((sum, item) => {
            const p = Number(item.price) || 0;
            const q = Number(item.quantity) || 0;
            return sum + p * q;
        }, 0);
    }

    function updateCartHeader() {
        const totalQuantity = getTotalQuantity();
        const cartCountEl = document.getElementById("cart-count");
        const cartItemsCountEl = document.getElementById("cart-items-count");

        if (cartCountEl) {
            cartCountEl.textContent = String(totalQuantity);
            cartCountEl.hidden = totalQuantity === 0;
            cartCountEl.setAttribute(
                "aria-label",
                `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"} in cart`
            );
        }

        if (cartItemsCountEl) {
            cartItemsCountEl.textContent = `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`;
        }
    }

    function updateTotals() {
        const subtotal = calculateSubtotal();
        const cartSubtotalEl = document.getElementById("cart-subtotal");
        const cartTotalEl = document.getElementById("cart-total");
        const checkoutButton = document.getElementById("checkout-button");
        const clearCartButton = document.getElementById("clear-cart-button");

        if (cartSubtotalEl) {
            cartSubtotalEl.textContent = formatPrice(subtotal);
        }

        if (cartTotalEl) {
            cartTotalEl.textContent = formatPrice(subtotal);
        }

        if (checkoutButton) {
            const empty = cart.length === 0;
            checkoutButton.setAttribute("aria-disabled", empty ? "true" : "false");
            checkoutButton.classList.toggle("disabled", empty);
        }

        if (clearCartButton) {
            clearCartButton.disabled = cart.length === 0;
        }
    }

    function renderEmptyCart() {
        const cartItemsContainer = document.getElementById("cart-items");
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 8h12l1 13H5L6 8Z"></path>
                        <path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
                    </svg>
                </div>
                <h2>Your cart is empty</h2>
                <p>Discover our products and add something you love to your shopping cart.</p>
                <a href="products.html" class="continue-button">Continue Shopping</a>
            </div>
        `;
    }

    function createCartItemHTML(item) {
        const id = String(item.id);
        const encodedId = encodeURIComponent(id);
        const name = escapeHTML(item.name);
        const category = escapeHTML(item.category);
        const image = escapeHTML(item.image || FALLBACK_IMAGE);
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        const subtotal = price * quantity;

        return `
            <article class="cart-item" data-product-id="${escapeHTML(id)}">
                <div class="cart-item-product">
                    <a href="product.html?id=${encodedId}" class="cart-item-image-link" aria-label="View ${name}">
                        <img src="${image}" alt="${name}" class="cart-item-image" loading="lazy" decoding="async" data-cart-image>
                    </a>
                    <div class="cart-item-info">
                        ${category ? `<span class="cart-item-category">${category}</span>` : ""}
                        <h2 class="cart-item-title">
                            <a href="product.html?id=${encodedId}">${name}</a>
                        </h2>
                        <p class="cart-item-price">${formatPrice(price)} each</p>
                    </div>
                </div>

                <div class="cart-item-controls">
                    <div class="quantity-control" aria-label="Quantity controls for ${name}">
                        <button type="button" data-action="decrease" data-id="${escapeHTML(id)}" aria-label="Decrease quantity of ${name}" ${quantity <= 1 ? "aria-disabled='true'" : ""}>−</button>
                        
                        <input 
                            type="number" 
                            class="quantity-input" 
                            data-role="quantity-input" 
                            data-id="${escapeHTML(id)}" 
                            value="${quantity}" 
                            min="1" 
                            max="${MAX_QUANTITY}" 
                            aria-label="Quantity for ${name}"
                        />

                        <button type="button" data-action="increase" data-id="${escapeHTML(id)}" aria-label="Increase quantity of ${name}" ${quantity >= MAX_QUANTITY ? "aria-disabled='true'" : ""}>+</button>
                    </div>

                    <div class="cart-item-subtotal">
                        <strong data-role="subtotal">${formatPrice(subtotal)}</strong>
                        <button type="button" class="cart-remove-button" data-action="remove" data-id="${escapeHTML(id)}" aria-label="Remove ${name} from cart">Remove</button>
                    </div>
                </div>
            </article>
        `;
    }

    function attachImageFallbacks() {
        const cartItemsContainer = document.getElementById("cart-items");
        if (!cartItemsContainer) return;
        const images = cartItemsContainer.querySelectorAll("img[data-cart-image]");

        images.forEach(image => {
            image.addEventListener("error", () => {
                if (image.dataset.fallbackApplied) return;
                image.dataset.fallbackApplied = "true";
                image.src = FALLBACK_IMAGE;
            }, { once: true });
        });
    }

    function renderCart() {
        updateCartHeader();
        updateTotals();

        const cartItemsContainer = document.getElementById("cart-items");
        if (!cartItemsContainer) return;

        if (!cart.length) {
            renderEmptyCart();
            return;
        }

        cartItemsContainer.innerHTML = cart.map(createCartItemHTML).join("");
        attachImageFallbacks();
    }

    function updateSingleItemDOM(article, item) {
        if (!article) return;

        const quantity = Number(item.quantity) || 1;
        const subtotal = (Number(item.price) || 0) * quantity;

        const inputEl = article.querySelector('[data-role="quantity-input"]');
        const subtotalEl = article.querySelector('[data-role="subtotal"]');
        const decBtn = article.querySelector('[data-action="decrease"]');
        const incBtn = article.querySelector('[data-action="increase"]');

        if (inputEl && Number(inputEl.value) !== quantity) {
            inputEl.value = String(quantity);
        }

        if (decBtn) {
            decBtn.setAttribute("aria-disabled", quantity <= 1 ? "true" : "false");
        }
        if (incBtn) {
            incBtn.setAttribute("aria-disabled", quantity >= MAX_QUANTITY ? "true" : "false");
        }

        if (subtotalEl) {
            subtotalEl.textContent = formatPrice(subtotal);
        }

        updateCartHeader();
        updateTotals();
    }

    function initCartApp() {
        const cartItemsContainer = document.getElementById("cart-items");
        const checkoutButton = document.getElementById("checkout-button");
        const clearCartButton = document.getElementById("clear-cart-button");

        if (cartItemsContainer) {
            cartItemsContainer.addEventListener("click", event => {
                const button = event.target.closest("button[data-action]");
                if (!button) return;

                const action = button.dataset.action;
                const id = String(button.dataset.id || "");
                const item = cart.find(entry => String(entry.id) === id);

                if (!item) return;

                if (action === "remove") {
                    cart = cart.filter(entry => String(entry.id) !== id);
                    saveCart();
                    renderCart();
                    announceAccessibility(`${item.name} removed from cart.`);
                    return;
                }

                if (action === "increase") {
                    if (item.quantity >= MAX_QUANTITY) return;
                    item.quantity += 1;
                    saveCart();
                    updateSingleItemDOM(button.closest(".cart-item"), item);
                    announceAccessibility(`Increased ${item.name} quantity to ${item.quantity}.`);
                    return;
                }

                if (action === "decrease") {
                    if (item.quantity <= 1) return;
                    item.quantity -= 1;
                    saveCart();
                    updateSingleItemDOM(button.closest(".cart-item"), item);
                    announceAccessibility(`Decreased ${item.name} quantity to ${item.quantity}.`);
                }
            });

            cartItemsContainer.addEventListener("change", event => {
                const input = event.target.closest('input[data-role="quantity-input"]');
                if (!input) return;

                const id = String(input.dataset.id || "");
                const item = cart.find(entry => String(entry.id) === id);
                if (!item) return;

                let parsedVal = parseInt(input.value, 10);
                if (isNaN(parsedVal) || parsedVal < 1) parsedVal = 1;
                if (parsedVal > MAX_QUANTITY) parsedVal = MAX_QUANTITY;

                item.quantity = parsedVal;
                saveCart();
                updateSingleItemDOM(input.closest(".cart-item"), item);
                announceAccessibility(`Updated ${item.name} quantity to ${item.quantity}.`);
            });
        }

        if (checkoutButton) {
            checkoutButton.addEventListener("click", event => {
                cart = getCart();
                if (!cart.length) {
                    event.preventDefault();
                    alert("Your cart is empty.");
                    renderCart();
                }
            });
        }

        if (clearCartButton) {
            clearCartButton.addEventListener("click", () => {
                if (!cart.length) return;
                if (confirm("Are you sure you want to clear your cart?")) {
                    cart = [];
                    saveCart();
                    renderCart();
                    announceAccessibility("Cart cleared.");
                }
            });
        }

        /* Initial Sync and Hydration */
        cart = getCart();
        setStorageItem(CART_KEY, JSON.stringify(cart));
        renderCart();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCartApp);
    } else {
        initCartApp();
    }

    /* Tab Synchronization */
    window.addEventListener("storage", event => {
        if (event.key === CART_KEY || LEGACY_KEYS.includes(event.key)) {
            cart = getCart();
            renderCart();
        }
    });

    window.addEventListener(CART_EVENT_NAME, event => {
        if (event.detail && Array.isArray(event.detail.cart)) {
            cart = event.detail.cart.map(normalizeCartItem).filter(Boolean);
            renderCart();
        }
    });

    window.addEventListener("cartUpdated", () => {
        cart = getCart();
        renderCart();
    });

    /* =========================================================================
     * PUBLIC GLOBAL API (window.PrasunCart)
     * ========================================================================= */
    window.PrasunCart = {
        getCart: () => cart.map(item => ({ ...item })),

        getTotals: () => ({
            itemCount: getTotalQuantity(),
            subtotal: calculateSubtotal(),
            formattedSubtotal: formatPrice(calculateSubtotal())
        }),

        addItem: (rawItem, quantity = 1) => {
            const normalized = normalizeCartItem({ ...rawItem, quantity });
            if (!normalized) return false;

            const existing = cart.find(i => String(i.id) === normalized.id);
            if (existing) {
                existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + normalized.quantity);
            } else {
                cart.push(normalized);
            }

            saveCart();
            renderCart();
            announceAccessibility(`Added ${normalized.name} to cart.`);
            return true;
        },

        removeItem: (id) => {
            const strId = String(id);
            const item = cart.find(i => String(i.id) === strId);
            if (!item) return false;

            cart = cart.filter(i => String(i.id) !== strId);
            saveCart();
            renderCart();
            announceAccessibility(`Removed ${item.name} from cart.`);
            return true;
        },

        updateQuantity: (id, quantity) => {
            const strId = String(id);
            const item = cart.find(i => String(i.id) === strId);
            if (!item) return false;

            const q = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 0)));
            if (q === 0) {
                return window.PrasunCart.removeItem(id);
            }

            item.quantity = q;
            saveCart();
            renderCart();
            return true;
        },

        clearCart: () => {
            cart = [];
            saveCart();
            renderCart();
            announceAccessibility("Cart emptied.");
        }
    };
})();
