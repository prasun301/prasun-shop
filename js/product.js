/**
 * Prasun Shop — Product Details Module
 * Performance & Memory Optimized Implementation
 */
"use strict";

(function () {
    const container = document.getElementById("product-detail");
    if (!container) return;

    const CART_KEY = "prasunShopCart";
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    // 1. Module-scoped cached Formatter (avoids instantiation on every price format)
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    function formatPrice(price) {
        const num = Number(price);
        return Number.isFinite(num) ? currencyFormatter.format(num) : "$0.00";
    }

    // 2. Single-pass HTML Escaping via lookup map
    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    const ESCAPE_REGEX = /[&<>"']/g;

    function escapeHTML(str) {
        if (!str) return "";
        return String(str).replace(ESCAPE_REGEX, (match) => ESCAPE_MAP[match]);
    }

    // 3. In-Memory Cart State (prevents repetitive localStorage parsing on clicks)
    let cachedCart = null;

    function getCart() {
        if (cachedCart !== null) return cachedCart;

        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) {
                cachedCart = [];
                return cachedCart;
            }

            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                cachedCart = [];
                return cachedCart;
            }

            const validCart = [];
            const seenIds = new Set();

            for (let i = 0; i < parsed.length; i++) {
                const item = parsed[i];
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

            cachedCart = validCart;
            return cachedCart;
        } catch (error) {
            console.error("Error reading cart:", error);
            cachedCart = [];
            return cachedCart;
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            cachedCart = cart;
            return true;
        } catch (error) {
            console.error("Failed to save cart:", error);
            return false;
        }
    }

    // 4. Centralized Cart Add Logic
    function addProductToCart(product, quantityToAdd) {
        const cart = getCart();
        const productIdStr = String(product.id);
        const existing = cart.find((item) => String(item.id) === productIdStr);

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
            if (typeof updateCartCount === "function") {
                updateCartCount();
            }
            return true;
        }
        return false;
    }

    // Button feedback state helper
    function showButtonFeedback(button, successText) {
        if (!button) return;
        const textSpan = button.querySelector("span:not(.w-4)") || button;
        const originalContent = textSpan.textContent;

        button.disabled = true;
        button.classList.add("opacity-75");
        textSpan.textContent = successText;

        setTimeout(() => {
            textSpan.textContent = originalContent;
            button.disabled = false;
            button.classList.remove("opacity-75");
        }, 1200);
    }

    // Render Blank State
    function renderNotFound(message, submessage) {
        container.innerHTML = `
            <div class="py-16 text-center">
                <h2 class="text-xl font-semibold text-zinc-900 mb-2">${escapeHTML(message)}</h2>
                <p class="text-zinc-500 text-sm font-medium mb-6">${escapeHTML(submessage)}</p>
                <a href="products.html" class="inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs">
                    Back to Products
                </a>
            </div>
        `;
    }

    // Main Fetch & Render Logic
    async function loadProduct() {
        if (!productId) {
            renderNotFound("No Product Specified", "Please select a valid product from the catalog.");
            return;
        }

        try {
            // Standard browser fetch (uses browser HTTP cache when possible)
            const response = await fetch("data/products.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Invalid format");

            const productRaw = data.find((item) => item && String(item.id) === String(productId));

            if (!productRaw || !productRaw.name || productRaw.price === undefined) {
                renderNotFound("Product Not Found", "The product you're looking for doesn't exist or has been removed.");
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

            // Pre-build HTML fragments efficiently
            const featuresHTML = product.features.length
                ? `
                    <div class="mt-6 pt-6 border-t border-zinc-200/80">
                        <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Key Features</h3>
                        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600">
                            ${product.features.map((f) => `
                                <li class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"></span>
                                    <span>${escapeHTML(f)}</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                `
                : "";

            const specKeys = Object.keys(product.specifications);
            const specificationsHTML = specKeys.length > 0
                ? `
                    <div class="mt-6 pt-6 border-t border-zinc-200/80">
                        <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Specifications</h3>
                        <div class="border border-zinc-200/80 rounded-xl overflow-hidden shadow-xs">
                            <table class="w-full text-left text-xs">
                                <tbody class="divide-y divide-zinc-200/80 bg-white">
                                    ${specKeys.map((k) => `
                                        <tr>
                                            <td class="px-4 py-3 font-medium text-zinc-500 bg-zinc-50/50 w-1/3">${escapeHTML(k)}</td>
                                            <td class="px-4 py-3 text-zinc-900">${escapeHTML(product.specifications[k])}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `
                : "";

            // Single innerHTML write to update DOM
            container.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
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

                    <div class="flex flex-col">
                        <div class="flex items-center justify-between text-xs text-zinc-500 mb-3">
                            <span class="inline-flex items-center px-2.5 py-1 bg-zinc-100 font-semibold text-zinc-800 rounded-full">
                                ${escapeHTML(product.category)}
                            </span>
                            <span class="flex items-center gap-1 font-medium text-amber-500">
                                ★ <span class="text-zinc-700">${escapeHTML(product.rating)}</span> / 5.0
                            </span>
                        </div>

                        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mb-3">
                            ${escapeHTML(product.name)}
                        </h1>

                        <div class="flex items-center gap-4 text-xs text-zinc-500 mb-6">
                            <span>SKU: <span class="font-medium text-zinc-700">${escapeHTML(product.sku)}</span></span>
                            <span class="flex items-center gap-1.5 text-emerald-600 font-medium">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                            </span>
                        </div>

                        <div class="text-2xl font-bold text-zinc-900 mb-6 pb-6 border-b border-zinc-200/80">
                            ${formatPrice(product.price)}
                        </div>

                        <p class="text-sm text-zinc-600 leading-relaxed mb-6">
                            ${escapeHTML(product.description)}
                        </p>

                        <div class="flex items-center gap-4 mb-6">
                            <label for="product-quantity" class="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Quantity</label>
                            <div class="inline-flex items-center border border-zinc-200 rounded-xl bg-white shadow-xs">
                                <button type="button" id="qty-decrement" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer" aria-label="Decrease quantity">−</button>
                                <input type="number" id="product-quantity" value="1" min="1" max="10" class="w-12 text-center text-sm font-semibold text-zinc-900 bg-transparent focus:outline-none" aria-label="Product quantity">
                                <button type="button" id="qty-increment" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer" aria-label="Increase quantity">+</button>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-3 pt-2">
                            <button 
                                type="button"
                                id="add-to-cart-btn"
                                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold rounded-xl text-sm border border-zinc-300 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                                </svg>
                                <span>Add to Cart</span>
                            </button>
                            <button 
                                type="button"
                                id="buy-now-btn"
                                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                <span>Buy Now</span>
                            </button>
                        </div>

                        ${featuresHTML}
                        ${specificationsHTML}
                    </div>
                </div>
            `;

            // 5. Setup single Event Delegation Listener
            setupEventDelegation(product);

        } catch (error) {
            console.error("Error loading product:", error);
            renderNotFound("Failed to load details", "Please refresh the page to try again.");
        }
    }

    // 6. Single Event Delegation Listener (Replaces multiple individual element bindings)
    function setupEventDelegation(product) {
        container.addEventListener("click", (e) => {
            const target = e.target.closest("button");
            if (!target) return;

            const qtyInput = document.getElementById("product-quantity");
            const getQty = () => {
                let v = parseInt(qtyInput?.value, 10) || 1;
                return Math.max(1, Math.min(10, v));
            };

            if (target.id === "qty-decrement") {
                if (qtyInput) qtyInput.value = Math.max(1, getQty() - 1);
                return;
            }

            if (target.id === "qty-increment") {
                if (qtyInput) qtyInput.value = Math.min(10, getQty() + 1);
                return;
            }

            if (target.id === "add-to-cart-btn") {
                if (addProductToCart(product, getQty())) {
                    showButtonFeedback(target, "Added ✓");
                }
                return;
            }

            if (target.id === "buy-now-btn") {
                if (addProductToCart(product, getQty())) {
                    window.location.href = "cart.html";
                }
                return;
            }
        });

        // Quantity input boundaries on change
        container.addEventListener("change", (e) => {
            if (e.target && e.target.id === "product-quantity") {
                let val = parseInt(e.target.value, 10) || 1;
                e.target.value = Math.max(1, Math.min(10, val));
            }
        });
    }

    loadProduct();
})();
