// =====================================
// Prasun Shop - Checkout System (Optimized)
// =====================================

let cart = JSON.parse(localStorage.getItem("cart")) ?? [];
const orderSummary = document.getElementById("order-summary");
let total = 0;
let allProducts = [];

// =====================================
// Display Order Summary
// =====================================
async function loadCheckoutSummary() {
    if (!orderSummary) return;

    try {
        const response = await fetch("data/products.json");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allProducts = await response.json();

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
        let itemsHTML = '<div class="max-h-72 overflow-y-auto space-y-4 pr-1 divider-y divide-zinc-100">';

        cart.forEach(item => {
            const product = allProducts.find(p => p.id === item.id);

            if (product) {
                const subtotal = product.price * item.quantity;
                total += subtotal;

                itemsHTML += `
                    <div class="flex items-center gap-4 pb-4 border-b border-zinc-100 last:border-0 last:pb-0">
                        <img 
                            src="${product.image}" 
                            alt="${product.name}" 
                            class="w-16 h-16 object-cover rounded-xl border border-zinc-200/60 bg-zinc-100 shrink-0"
                        >
                        <div class="flex-grow min-w-0">
                            <h3 class="text-sm font-semibold text-zinc-900 truncate">${product.name}</h3>
                            <p class="text-xs text-zinc-500">Qty: ${item.quantity}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-sm font-bold text-zinc-900">$${subtotal.toFixed(2)}</p>
                            <p class="text-[11px] text-zinc-400">$${product.price.toFixed(2)} each</p>
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
                    <span class="font-medium text-zinc-900">$${total.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-xs text-zinc-500">
                    <span>Shipping</span>
                    <span class="text-emerald-600 font-semibold">Free</span>
                </div>
                <div class="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100">
                    <span>Total</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
            </div>
        `;

        orderSummary.innerHTML = itemsHTML;

    } catch (error) {
        console.error("Error loading checkout summary:", error);
        orderSummary.innerHTML = `
            <p class="text-xs text-red-500 text-center py-4">Failed to load order summary. Please refresh the page.</p>
        `;
    }
}

loadCheckoutSummary();

// =====================================
// Submit Order
// =====================================
const checkoutForm = document.getElementById("checkout-form");

if (checkoutForm) {
    checkoutForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        if (cart.length === 0) {
            alert("Your cart is empty.");
            return;
        }

        const submitButton = checkoutForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        
        // Set loading state for maximum responsiveness feel
        submitButton.disabled = true;
        submitButton.textContent = "Processing Order...";
        submitButton.classList.add("opacity-75", "cursor-not-allowed");

        const customerName = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const address = document.getElementById("address").value.trim();

        // Enrich cart items with product names for the backend
        const enrichedCart = cart.map(item => {
            const product = allProducts.find(p => p.id === item.id);
            return {
                id: item.id,
                name: product?.name ?? "Unknown Product",
                price: product?.price ?? 0,
                quantity: item.quantity
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

            // Clear local cart storage after successful order
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
