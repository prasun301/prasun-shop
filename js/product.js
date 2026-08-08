/**
 * Prasun Shop — Product Details Module
 * Production-Grade 10/10 Implementation
 */
"use strict";

(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");
    const container = document.getElementById("product-detail");

    const CART_KEY = "prasunShopCart";

    // Format price cleanly
    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

    // Cart Architecture & Reliability
    function getCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];

            const validCart = [];
            const seenIds = new Set();
            for (const item of parsed) {
                if (!item || item.id === undefined || item.id === null) continue;
                const idStr = String(item.id);
                if (seenIds.has(idStr)) continue;
                seenIds.add(idStr);

                const qty = Number(item.quantity);
                validCart.push({
                    id: item.id,
                    name: String(item.name || "Product"),
                    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
                    image: String(item.image || ""),
                    category: String(item.category || ""),
                    quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
                });
            }
            return validCart;
        } catch (error) {
            console.error("Error reading cart from localStorage:", error);
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            return true;
        } catch (error) {
            console.error("Failed to save cart to localStorage:", error);
            return false;
        }
    }

    function notifyCartUpdate() {
        if (typeof updateCartCount === "function") {
            updateCartCount();
        }
    }

    // Feedback visual states for buttons
    function showButtonFeedback(button, successText) {
        if (!button) return;
        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.classList.add("opacity-75");
        
        // Find first text node or span inside button, or fallback
        const textSpan = button.querySelector("span:not(.w-4)") || button;
        const originalContent = textSpan.textContent;
        textSpan.textContent = successText;

        setTimeout(() => {
            textSpan.textContent = originalContent;
            button.disabled = false;
            button.classList.remove("opacity-75");
        }, 1200);
    }

    // Load Product Details Logic
    async function loadProduct() {
        if (!container) return;

        if (!productId) {
            container.innerHTML = `
                <div class="py-16 text-center">
                    <p class="text-zinc-500 text-sm font-medium mb-4">No product specified.</p>
                    <a href="products.html" class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs">
                        Browse Products
                    </a>
                </div>
            `;
            return;
        }

        try {
            const response = await fetch("data/products.json", { cache: "no-cache" });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format: products.json must contain an array.");
            }

            const productRaw = data.find(item => item && String(item.id) === String(productId));

            if (!productRaw || !productRaw.name || productRaw.price === undefined) {
                container.innerHTML = `
                    <div class="py-16 text-center">
                        <h2 class="text-xl font-semibold text-zinc-900 mb-2">Product Not Found</h2>
                        <p class="text-zinc-500 text-sm font-medium mb-6">The product you're looking for doesn't exist or has been removed.</p>
                        <a href="products.html" class="inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs">
                            Back to Products
                        </a>
                    </div>
                `;
                return;
            }

            const product = {
                id: productRaw.id,
                name: String(productRaw.name),
                price: Number(productRaw.price) || 0,
                image: String(productRaw.image || ""),
                category: String(productRaw.category || "Smart Product"),
                rating: productRaw.rating || "5.0",
                sku: productRaw.sku || "N/A",
                description: String(productRaw.description || ""),
                features: Array.isArray(productRaw.features) ? productRaw.features : [],
                specifications: productRaw.specifications && typeof productRaw.specifications === "object" ? productRaw.specifications : {}
            };

            // Key Features HTML
            const featuresHTML = product.features.length
                ? `
                    <div class="mt-6 pt-6 border-t border-zinc-200/80">
                        <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Key Features</h3>
                        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600">
                            ${product.features.map(feature => `
                                <li class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"></span>
                                    <span>${escapeHTML(feature)}</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                `
                : "";

            // Specifications HTML
            const specificationsHTML = Object.keys(product.specifications).length > 0
                ? `
                    <div class="mt-6 pt-6 border-t border-zinc-200/80">
                        <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Specifications</h3>
                        <div class="border border-zinc-200/80 rounded-xl overflow-hidden shadow-xs">
                            <table class="w-full text-left text-xs">
                                <tbody class="divide-y divide-zinc-200/80 bg-white">
                                    ${Object.entries(product.specifications).map(([key, value]) => `
                                        <tr>
                                            <td class="px-4 py-3 font-medium text-zinc-500 bg-zinc-50/50 w-1/3">${escapeHTML(key)}</td>
                                            <td class="px-4 py-3 text-zinc-900">${escapeHTML(value)}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `
                : "";

            // Render Main Product Details Layout
            container.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
                    
                    <!-- Product Image Container -->
                    <div class="aspect-square bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200/80 shadow-xs lg:sticky lg:top-24">
                        <img 
                            src="${escapeHTML(product.image)}" 
                            alt="${escapeHTML(product.name)}"
                            class="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                            onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'400\\' viewBox=\\'0 0 400 400\\'%3E%3Crect width=\\'400\\' height=\\'400\\' fill=\\'%23f4f4f5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23a1a1aa\\' font-family=\\'sans-serif\\' font-size=\\'16\\'%3ENo Image%3C/text%3E%3C/svg%3E';"
                        >
                    </div>

                    <!-- Product Information -->
                    <div class="flex flex-col">
                        
                        <!-- Category & Rating Header -->
                        <div class="flex items-center justify-between text-xs text-zinc-500 mb-3">
                            <span class="inline-flex items-center px-2.5 py-1 bg-zinc-100 font-semibold text-zinc-800 rounded-full">
                                ${escapeHTML(product.category)}
                            </span>
                            <span class="flex items-center gap-1 font-medium text-amber-500">
                                ★ <span class="text-zinc-700">${escapeHTML(product.rating)}</span> / 5.0
                            </span>
                        </div>

                        <!-- Product Title -->
                        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mb-3">
                            ${escapeHTML(product.name)}
                        </h1>

                        <!-- SKU & Stock Status -->
                        <div class="flex items-center gap-4 text-xs text-zinc-500 mb-6">
                            <span>SKU: <span class="font-medium text-zinc-700">${escapeHTML(product.sku)}</span></span>
                            <span class="flex items-center gap-1.5 text-emerald-600 font-medium">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                            </span>
                        </div>

                        <!-- Price -->
                        <div class="text-2xl font-bold text-zinc-900 mb-6 pb-6 border-b border-zinc-200/80">
                            ${formatPrice(product.price)}
                        </div>

                        <!-- Description -->
                        <p class="text-sm text-zinc-600 leading-relaxed mb-6">
                            ${escapeHTML(product.description)}
                        </p>

                        <!-- Quantity Selector -->
                        <div class="flex items-center gap-4 mb-6">
                            <label for="product-quantity" class="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Quantity</label>
                            <div class="inline-flex items-center border border-zinc-200 rounded-xl bg-white shadow-xs">
                                <button type="button" id="qty-decrement" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none cursor-pointer" aria-label="Decrease quantity">−</button>
                                <input type="number" id="product-quantity" value="1" min="1" max="10" class="w-12 text-center text-sm font-semibold text-zinc-900 bg-transparent focus:outline-none" aria-label="Product quantity">
                                <button type="button" id="qty-increment" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none cursor-pointer" aria-label="Increase quantity">+</button>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex flex-col sm:flex-row gap-3 pt-2">
                            <button 
                                type="button"
                                id="add-to-cart-btn"
                                data-id="${escapeHTML(product.id)}"
                                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold rounded-xl text-sm border border-zinc-300 transition-all shadow-xs active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                                </svg>
                                <span>Add to Cart</span>
                            </button>
                            <button 
                                type="button"
                                id="buy-now-btn"
                                data-id="${escapeHTML(product.id)}"
                                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                <span>Buy Now</span>
                            </button>
                        </div>

                        <!-- Features & Specs Sections -->
                        ${featuresHTML}
                        ${specificationsHTML}

                    </div>
                </div>
            `;

            setupDynamicListeners(product);

        } catch (error) {
            console.error("Error loading product:", error);
            container.innerHTML = `
                <div class="py-16 text-center">
                    <p class="text-xs text-red-500 font-medium mb-4">Failed to load product details. Please refresh the page.</p>
                    <button type="button" onclick="window.location.reload()" class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Basic HTML escaping helper to prevent script injection
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Attach listeners to dynamically rendered elements cleanly without inline onclick handlers
    function setupDynamicListeners(product) {
        const qtyInput = document.getElementById("product-quantity");
        const decBtn = document.getElementById("qty-decrement");
        const incBtn = document.getElementById("qty-increment");
        const addToCartBtn = document.getElementById("add-to-cart-btn");
        const buyNowBtn = document.getElementById("buy-now-btn");

        if (decBtn && qtyInput) {
            decBtn.addEventListener("click", () => {
                let current = parseInt(qtyInput.value) || 1;
                if (current > 1) qtyInput.value = current - 1;
            });
        }

        if (incBtn && qtyInput) {
            incBtn.addEventListener("click", () => {
                let current = parseInt(qtyInput.value) || 1;
                if (current < 10) qtyInput.value = current + 1;
            });
        }

        if (qtyInput) {
            qtyInput.addEventListener("change", () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val < 1) val = 1;
                if (val > 10) val = 10;
                qtyInput.value = val;
            });
        }

        if (addToCartBtn) {
            addToCartBtn.addEventListener("click", () => {
                const quantityToAdd = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
                const cart = getCart();
                const existing = cart.find(item => String(item.id) === String(product.id));

                if (existing) {
                    existing.quantity = (Number(existing.quantity) || 1) + quantityToAdd;
                } else {
                    cart.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        category: product.category,
                        quantity: quantityToAdd
                    });
                }

                if (saveCart(cart)) {
                    notifyCartUpdate();
                    showButtonFeedback(addToCartBtn, "Added ✓");
                }
            });
        }

        if (buyNowBtn) {
            buyNowBtn.addEventListener("click", () => {
                const quantityToAdd = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
                const cart = getCart();
                const existing = cart.find(item => String(item.id) === String(product.id));

                if (existing) {
                    existing.quantity = (Number(existing.quantity) || 1) + quantityToAdd;
                } else {
                    cart.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        category: product.category,
                        quantity: quantityToAdd
                    });
                }

                if (saveCart(cart)) {
                    notifyCartUpdate();
                    window.location.href = "cart.html";
                }
            });
        }
    }

    // Initialize Product Details Load
    loadProduct();
})();
