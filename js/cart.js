/**
 * Prasun Shop — Cart Management Module
 * Production-Grade Performance & Accessibility Optimized Implementation
 */
"use strict";

(function () {
    const CART_KEY_PRIMARY = "prasunShopCart";
    const CART_KEY_LEGACY = "cart";
    const CART_EVENT_NAME = "prasunCartUpdated";

    const cartItemsContainer = document.getElementById("cart-items");
    const cartTotalEl = document.getElementById("cart-total");
    const cartCountEl = document.getElementById("cart-count");

    if (!cartItemsContainer) return;

    // Singleton Intl.NumberFormat instance (prevents repeated GC overhead)
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    // Cached HashMap (Map<string, Product>) and active fetch Promise to prevent network races
    let productsMap = null;
    let productsFetchPromise = null;

    // Safe HTML Escaping Helper to Prevent XSS
    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Reuse singleton currency formatter
    function formatPrice(price) {
        const num = Number(price);
        return currencyFormatter.format(Number.isFinite(num) ? num : 0);
    }

    // Retrieve and validate cart items from LocalStorage
    function getCart() {
        try {
            const stored = localStorage.getItem(CART_KEY_PRIMARY) || localStorage.getItem(CART_KEY_LEGACY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];

            const validCart = [];
            for (const item of parsed) {
                if (!item || item.id === undefined || item.id === null) continue;
                const qty = Number(item.quantity);
                validCart.push({
                    id: String(item.id),
                    quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
                });
            }
            return validCart;
        } catch (error) {
            console.error("Error reading cart from localStorage:", error);
            return [];
        }
    }

    let cart = getCart();

    // Save cart state and notify both cross-tab and same-tab listeners
    function saveCart() {
        try {
            const serialized = JSON.stringify(cart);
            localStorage.setItem(CART_KEY_PRIMARY, serialized);
            localStorage.setItem(CART_KEY_LEGACY, serialized);

            // Notify components on the SAME page/tab
            window.dispatchEvent(
                new CustomEvent(CART_EVENT_NAME, {
                    detail: { cart: [...cart] }
                })
            );
        } catch (error) {
            console.error("Error saving cart to localStorage:", error);
        }
    }

    // Update Header Cart Badge with Accessibility Support
    function updateCartCount() {
        if (!cartCountEl) return;

        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.textContent = totalCount;

        // Ensure accessibility announcement for screen readers
        if (!cartCountEl.getAttribute("aria-live")) {
            cartCountEl.setAttribute("aria-live", "polite");
        }

        if (totalCount > 0) {
            cartCountEl.classList.remove("opacity-0", "invisible");
            cartCountEl.classList.add("opacity-100", "visible");
        } else {
            cartCountEl.classList.remove("opacity-100", "visible");
            cartCountEl.classList.add("opacity-0", "invisible");
        }
    }

    // Compute total cost using O(1) HashMap lookups
    function calculateTotal() {
        if (!productsMap) return 0;
        return cart.reduce((sum, item) => {
            const product = productsMap.get(item.id);
            if (!product) return sum;
            return sum + (Number(product.price) || 0) * item.quantity;
        }, 0);
    }

    // Render Empty Cart State
    function renderEmptyCart() {
        cartItemsContainer.innerHTML = `
            <div class="py-12 px-4 text-center col-span-full space-y-4">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 text-zinc-400 mb-2" aria-hidden="true">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.7">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                </div>
                <h2 class="text-lg font-semibold text-zinc-900">Your cart is empty</h2>
                <p class="text-sm text-zinc-500 max-w-sm mx-auto">Discover our latest products and add something you love to your cart.</p>
                <div class="pt-2">
                    <a href="products.html" class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900">
                        Continue Shopping
                    </a>
                </div>
            </div>
        `;

        if (cartTotalEl) {
            cartTotalEl.textContent = formatPrice(0);
        }
    }

    // Fetch Products Catalog & Build Map Index (Race-condition safe)
    function fetchProductsMap() {
        if (productsMap) return Promise.resolve(productsMap);

        // Deduplicate simultaneous fetch invocations
        if (!productsFetchPromise) {
            productsFetchPromise = fetch("data/products.json")
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (!Array.isArray(data)) {
                        throw new Error("Invalid data format: products.json must contain an array.");
                    }

                    productsMap = new Map();
                    for (const product of data) {
                        if (product && product.id !== undefined && product.id !== null) {
                            productsMap.set(String(product.id), product);
                        }
                    }
                    return productsMap;
                })
                .catch(error => {
                    productsFetchPromise = null; // Clear so subsequent calls can retry
                    throw error;
                });
        }

        return productsFetchPromise;
    }

    // Main Render Cart Function
    async function renderCart() {
        updateCartCount();

        if (cart.length === 0) {
            renderEmptyCart();
            return;
        }

        try {
            const pMap = await fetchProductsMap();
            let total = 0;
            let html = "";

            cart.forEach(item => {
                const product = pMap.get(item.id);
                if (!product) return;

                const quantity = item.quantity;
                const price = Number(product.price) || 0;
                const subtotal = price * quantity;
                total += subtotal;

                const image = escapeHTML(product.image || "");
                const name = escapeHTML(product.name || "Unnamed Product");
                const category = escapeHTML(product.category || "Product");
                const productId = escapeHTML(product.id);
                const encodedId = encodeURIComponent(product.id);

                html += `
                    <article class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-zinc-100 last:border-b-0" data-product-id="${productId}">
                        <!-- Product Details -->
                        <div class="flex items-center gap-4 min-w-0">
                            <a href="product.html?id=${encodedId}" class="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-xl" aria-label="View ${name}">
                                <img 
                                    src="${image}" 
                                    alt="${name}" 
                                    class="w-20 h-20 object-cover rounded-xl border border-zinc-200 bg-zinc-100"
                                    loading="lazy"
                                    decoding="async"
                                >
                            </a>
                            <div class="min-w-0">
                                <span class="inline-block text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">${category}</span>
                                <h3 class="text-sm font-semibold text-zinc-900 truncate mb-1">
                                    <a href="product.html?id=${encodedId}" class="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-sm">${name}</a>
                                </h3>
                                <p class="text-xs text-zinc-500">${formatPrice(price)} each</p>
                            </div>
                        </div>

                        <!-- Quantity Control & Subtotal Actions -->
                        <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6">
                            <!-- Quantity Selector -->
                            <div class="inline-flex items-center border border-zinc-300 rounded-lg bg-white shadow-xs" aria-label="Quantity controls for ${name}">
                                <button 
                                    type="button" 
                                    data-action="decrease" 
                                    data-id="${productId}" 
                                    class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-l-lg cursor-pointer"
                                    aria-label="Decrease quantity of ${name}"
                                >
                                    −
                                </button>
                                <span class="w-10 text-center text-xs font-semibold text-zinc-900" data-role="quantity-display" aria-label="Quantity: ${quantity}">${quantity}</span>
                                <button 
                                    type="button" 
                                    data-action="increase" 
                                    data-id="${productId}" 
                                    class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-r-lg cursor-pointer"
                                    aria-label="Increase quantity of ${name}"
                                >
                                    +
                                </button>
                            </div>

                            <!-- Subtotal and Remove -->
                            <div class="text-right shrink-0">
                                <p class="text-sm font-bold text-zinc-900 mb-1" data-role="subtotal-display">${formatPrice(subtotal)}</p>
                                <button 
                                    type="button" 
                                    data-action="remove" 
                                    data-id="${productId}" 
                                    class="text-xs font-medium text-red-600 hover:text-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded-sm cursor-pointer"
                                    aria-label="Remove ${name} from cart"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            });

            if (!html) {
                renderEmptyCart();
                return;
            }

            cartItemsContainer.innerHTML = html;

            if (cartTotalEl) {
                cartTotalEl.textContent = formatPrice(total);
            }

        } catch (error) {
            console.error("Error loading cart inventory:", error);
            cartItemsContainer.innerHTML = `
                <div class="py-8 text-center col-span-full space-y-3">
                    <h3 class="text-sm font-semibold text-red-600">Unable to load your cart items</h3>
                    <p class="text-xs text-zinc-500">Please check your network connection and try again.</p>
                    <button type="button" data-action="retry" class="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-xs cursor-pointer">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Fast in-place DOM update for quantity modifications (bypasses full innerHTML re-parse)
    function updateItemDOM(articleEl, item) {
        const product = productsMap ? productsMap.get(item.id) : null;
        if (!product) return;

        const qtyDisplay = articleEl.querySelector('[data-role="quantity-display"]');
        const subtotalDisplay = articleEl.querySelector('[data-role="subtotal-display"]');

        if (qtyDisplay) {
            qtyDisplay.textContent = item.quantity;
            qtyDisplay.setAttribute("aria-label", `Quantity: ${item.quantity}`);
        }
        
        if (subtotalDisplay) {
            const price = Number(product.price) || 0;
            subtotalDisplay.textContent = formatPrice(price * item.quantity);
        }

        if (cartTotalEl) {
            cartTotalEl.textContent = formatPrice(calculateTotal());
        }
        updateCartCount();
    }

    // Event Delegation for Image Failures with loop guard
    cartItemsContainer.addEventListener("error", event => {
        const target = event.target;
        if (target && target.tagName === "IMG" && !target.dataset.fallbackApplied) {
            target.dataset.fallbackApplied = "true";
            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f4f4f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23a1a1aa' font-family='sans-serif' font-size='12'%3ENo Img%3C/text%3E%3C/svg%3E";
        }
    }, true);

    // Event Delegation for Cart Actions
    cartItemsContainer.addEventListener("click", event => {
        const retryBtn = event.target.closest('button[data-action="retry"]');
        if (retryBtn) {
            renderCart();
            return;
        }

        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = String(button.dataset.id);
        const action = button.dataset.action;
        const item = cart.find(i => i.id === id);

        if (action === "remove") {
            cart = cart.filter(i => i.id !== id);
            saveCart();
            renderCart();
        } else if (item && (action === "increase" || action === "decrease")) {
            if (action === "increase") {
                item.quantity += 1;
            } else {
                item.quantity -= 1;
            }

            if (item.quantity <= 0) {
                cart = cart.filter(i => i.id !== id);
                saveCart();
                renderCart();
            } else {
                saveCart();
                const articleEl = button.closest("article[data-product-id]");
                if (articleEl) {
                    updateItemDOM(articleEl, item);
                } else {
                    renderCart();
                }
            }
        }
    });

    // Cross-tab Synchronization (Native window storage event)
    window.addEventListener("storage", event => {
        if (event.key === CART_KEY_PRIMARY || event.key === CART_KEY_LEGACY) {
            cart = getCart();
            renderCart();
        }
    });

    // Same-tab Synchronization (Custom event listener) - Fixed to fully re-render cart view
    window.addEventListener(CART_EVENT_NAME, event => {
        if (event.detail && Array.isArray(event.detail.cart)) {
            cart = event.detail.cart;
            renderCart();
        }
    });

    // Initial Load
    renderCart();
})();
