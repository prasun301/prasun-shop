/**
 * Prasun Shop — Cart Management Module
 * Production-Grade 10/10 Optimized Implementation
 */
"use strict";

(function () {
    const CART_KEY_PRIMARY = "prasunShopCart";
    const CART_KEY_LEGACY = "cart";
    
    const cartItemsContainer = document.getElementById("cart-items");
    const cartTotalEl = document.getElementById("cart-total");
    const cartCountEl = document.getElementById("cart-count");

    if (!cartItemsContainer) return;

    // Cached products catalog to prevent redundant network requests
    let cachedProducts = null;

    // Retrieve and validate cart from LocalStorage (supports dual-key fallback)
    function getCart() {
        try {
            let stored = localStorage.getItem(CART_KEY_PRIMARY);
            if (!stored) {
                stored = localStorage.getItem(CART_KEY_LEGACY);
            }
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];

            const validCart = [];
            for (const item of parsed) {
                if (!item || item.id === undefined || item.id === null) continue;
                const qty = Number(item.quantity);
                validCart.push({
                    id: item.id,
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

    // Save cart state across both storage keys for maximum backward compatibility
    function saveCart() {
        try {
            const serialized = JSON.stringify(cart);
            localStorage.setItem(CART_KEY_PRIMARY, serialized);
            localStorage.setItem(CART_KEY_LEGACY, serialized);
        } catch (error) {
            console.error("Error saving cart to localStorage:", error);
        }
    }

    // Clean Currency Formatter
    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

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

    // Update Header Cart Badge Visibility and Count
    function updateCartCount() {
        if (!cartCountEl) return;

        const totalCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        cartCountEl.textContent = totalCount;

        if (totalCount > 0) {
            cartCountEl.classList.remove("opacity-0", "invisible");
            cartCountEl.classList.add("opacity-100", "visible");
        } else {
            cartCountEl.classList.remove("opacity-100", "visible");
            cartCountEl.classList.add("opacity-0", "invisible");
        }
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

    // Fetch Products Catalog with Memory Caching
    async function fetchProducts() {
        if (cachedProducts) return cachedProducts;

        const response = await fetch("data/products.json", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid data format: products.json must contain an array.");
        }

        cachedProducts = data;
        return cachedProducts;
    }

    // Main Render Cart Function
    async function renderCart() {
        updateCartCount();

        if (cart.length === 0) {
            renderEmptyCart();
            return;
        }

        try {
            const products = await fetchProducts();
            let total = 0;
            let html = "";

            cart.forEach(item => {
                const product = products.find(p => p && String(p.id) === String(item.id));
                if (!product) return;

                const quantity = Math.max(1, Number(item.quantity) || 1);
                const price = Number(product.price) || 0;
                const subtotal = price * quantity;
                total += subtotal;

                const image = escapeHTML(product.image);
                const name = escapeHTML(product.name);
                const category = escapeHTML(product.category || "Product");
                const productId = escapeHTML(product.id);

                html += `
                    <article class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" data-product-id="${productId}">
                        <!-- Product Details -->
                        <div class="flex items-center gap-4 min-w-0">
                            <a href="product.html?id=${encodeURIComponent(product.id)}" class="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-xl" aria-label="View ${name}">
                                <img 
                                    src="${image}" 
                                    alt="${name}" 
                                    class="w-20 h-20 object-cover rounded-xl border border-zinc-200 bg-zinc-100"
                                    loading="lazy"
                                    decoding="async"
                                    onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' fill=\\'%23f4f4f5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23a1a1aa\\' font-family=\\'sans-serif\\' font-size=\\'12\\'%3ENo Img%3C/text%3E%3C/svg%3E';"
                                >
                            </a>
                            <div class="min-w-0">
                                <span class="inline-block text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-0.5">${category}</span>
                                <h3 class="text-sm font-semibold text-zinc-900 truncate mb-1">
                                    <a href="product.html?id=${encodeURIComponent(product.id)}" class="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-sm">${name}</a>
                                </h3>
                                <p class="text-xs text-zinc-500">${formatPrice(price)} each</p>
                            </div>
                        </div>

                        <!-- Quantity Control & Subtotal Actions -->
                        <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6">
                            <!-- Quantity Selector -->
                            <div class="inline-flex items-center border border-zinc-300 rounded-lg bg-white overflow-shadow shadow-xs" aria-label="Quantity controls">
                                <button 
                                    type="button" 
                                    data-action="decrease" 
                                    data-id="${productId}" 
                                    class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
                                    aria-label="Decrease quantity"
                                >
                                    −
                                </button>
                                <span class="w-10 text-center text-xs font-semibold text-zinc-900" aria-label="Quantity">${quantity}</span>
                                <button 
                                    type="button" 
                                    data-action="increase" 
                                    data-id="${productId}" 
                                    class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
                                    aria-label="Increase quantity"
                                >
                                    +
                                </button>
                            </div>

                            <!-- Subtotal and Remove -->
                            <div class="text-right shrink-0">
                                <p class="text-sm font-bold text-zinc-900 mb-1">${formatPrice(subtotal)}</p>
                                <button 
                                    type="button" 
                                    data-action="remove" 
                                    data-id="${productId}" 
                                    class="text-xs font-medium text-red-600 hover:text-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded-sm cursor-pointer"
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
                    <button type="button" onclick="window.location.reload()" class="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-xs cursor-pointer">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Event Delegation for Cart Actions (Increase, Decrease, Remove)
    cartItemsContainer.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = String(button.dataset.id);
        const action = button.dataset.action;
        const item = cart.find(i => String(i.id) === id);

        if (action === "remove") {
            cart = cart.filter(i => String(i.id) !== id);
        } else if (item && action === "increase") {
            item.quantity = Number(item.quantity || 0) + 1;
        } else if (item && action === "decrease") {
            item.quantity = Number(item.quantity || 1) - 1;
            if (item.quantity <= 0) {
                cart = cart.filter(i => String(i.id) !== id);
            }
        }

        saveCart();
        renderCart();
    });

    // Sync across multiple browser tabs automatically
    window.addEventListener("storage", event => {
        if (event.key === CART_KEY_PRIMARY || event.key === CART_KEY_LEGACY) {
            cart = getCart();
            renderCart();
        }
    });

    // Initial Load
    renderCart();
})();
