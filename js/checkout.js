/**
 * Prasun Shop — Checkout System Module
 * Production-Grade 10/10 Implementation
 */
"use strict";

(function () {
    const CART_KEY = "prasunShopCart";

    // Cart Retrieval & Robust Validation
    function getCart() {
        try {
            let stored = localStorage.getItem(CART_KEY);
            if (!stored) {
                stored = localStorage.getItem("cart");
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
    const orderSummary = document.getElementById("order-summary");
    let total = 0;
    let allProducts = [];

    // Format price cleanly using Intl.NumberFormat
    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

    // Basic HTML escaping helper to prevent XSS / script injection
    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // =====================================
    // Display Order Summary
    // =====================================
    async function loadCheckoutSummary() {
        if (!orderSummary) return;

        try {
            const response = await fetch("data/products.json", { cache: "no-cache" });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format: products.json must contain an array.");
            }

            allProducts = data;

            if (cart.length === 0) {
                orderSummary.innerHTML = `
                    <div class="py-8 text-center">
                        <p class="text-zinc-500 text-sm font-medium mb-4">Your cart is empty.</p>
                        <a href="products.html" class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs">
                            Continue Shopping
                        </a>
                    </div>
                `;
                return;
            }

            total = 0;
            let itemsHTML = '<div class="max-h-72 overflow-y-auto space-y-4 pr-1 divide-y divide-zinc-100">';

            cart.forEach(item => {
                const product = allProducts.find(p => p && String(p.id) === String(item.id));

                if (product) {
                    const price = Number(product.price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const subtotal = price * qty;
                    total += subtotal;

                    itemsHTML += `
                        <div class="flex items-center gap-4 pt-4 first:pt-0 pb-4 border-b border-zinc-100 last:border-0 last:pb-0">
                            <img 
                                src="${escapeHTML(product.image)}" 
                                alt="${escapeHTML(product.name)}" 
                                class="w-16 h-16 object-cover rounded-xl border border-zinc-200/60 bg-zinc-100 shrink-0"
                                loading="lazy"
                                onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' fill=\\'%23f4f4f5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23a1a1aa\\' font-family=\\'sans-serif\\' font-size=\\'12\\'%3ENo Img%3C/text%3E%3C/svg%3E';"
                            >
                            <div class="flex-grow min-w-0">
                                <h3 class="text-sm font-semibold text-zinc-900 truncate">${escapeHTML(product.name)}</h3>
                                <p class="text-xs text-zinc-500">Qty: ${qty}</p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-sm font-bold text-zinc-900">${formatPrice(subtotal)}</p>
                                <p class="text-[11px] text-zinc-400">${formatPrice(price)} each</p>
                            </div>
                        </div>
                    `;
                }
            });

            itemsHTML += '</div>';

            // Summary Totals Section
            itemsHTML += `
                <div class="pt-4 border-t border-zinc-100 space-y-2 mt-4">
                    <div class="flex justify-between text-xs text-zinc-500">
                        <span>Subtotal</span>
                        <span class="font-medium text-zinc-900">${formatPrice(total)}</span>
                    </div>
                    <div class="flex justify-between text-xs text-zinc-500">
                        <span>Shipping</span>
                        <span class="text-emerald-600 font-semibold">Free</span>
                    </div>
                    <div class="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100">
                        <span>Total</span>
                        <span>${formatPrice(total)}</span>
                    </div>
                </div>
            `;

            orderSummary.innerHTML = itemsHTML;

        } catch (error) {
            console.error("Error loading checkout summary:", error);
            orderSummary.innerHTML = `
                <div class="py-6 text-center">
                    <p class="text-xs text-red-500 font-medium mb-3">Failed to load order summary.</p>
                    <button type="button" onclick="window.location.reload()" class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-xs cursor-pointer">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    loadCheckoutSummary();

    // =====================================
    // Submit Order
    // =====================================
    const checkoutForm = document.getElementById("checkout-form");

    if (checkoutForm) {
        checkoutForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            // Refresh cart data from storage prior to transaction
            cart = getCart();
            if (cart.length === 0) {
                alert("Your cart is empty.");
                window.location.href = "cart.html";
                return;
            }

            const submitButton = checkoutForm.querySelector('button[type="submit"]');
            if (!submitButton) return;

            const originalButtonText = submitButton.textContent;
            
            // Set loading state for maximum responsiveness feel
            submitButton.disabled = true;
            submitButton.textContent = "Processing Order...";
            submitButton.classList.add("opacity-75", "cursor-not-allowed");

            const nameInput = document.getElementById("name");
            const emailInput = document.getElementById("email");
            const phoneInput = document.getElementById("phone");
            const addressInput = document.getElementById("address");

            const customerName = nameInput ? nameInput.value.trim() : "";
            const email = emailInput ? emailInput.value.trim() : "";
            const phone = phoneInput ? phoneInput.value.trim() : "";
            const address = addressInput ? addressInput.value.trim() : "";

            // Enrich cart items with product data for backend payload
            const enrichedCart = cart.map(item => {
                const product = allProducts.find(p => p && String(p.id) === String(item.id));
                return {
                    id: item.id,
                    name: product?.name ?? "Unknown Product",
                    price: Number(product?.price) || 0,
                    quantity: Number(item.quantity) || 1
                };
            });

            try {
                const response = await fetch("https://prasun-shop-api.prasun301.workers.dev/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        customerName,
                        email,
                        phone,
                        address,
                        cart: enrichedCart,
                        total
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status ${response.status}`);
                }

                const data = await response.json();
                console.log("Order successfully sent:", data);

                // Clear local storage cart keys cleanly
                localStorage.removeItem(CART_KEY);
                localStorage.removeItem("cart");

                // Redirect to success page
                window.location.href = "order-success.html";

            } catch (error) {
                console.error("Order submission error:", error);
                alert("Something went wrong while placing your order. Please try again.");
                
                // Restore button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                submitButton.classList.remove("opacity-75", "cursor-not-allowed");
            }
        });
    }
})();
