// =====================================
// Prasun Shop - Checkout System
// =====================================

// Load cart
let cart = JSON.parse(localStorage.getItem("cart")) ?? [];

const orderSummary = document.getElementById("order-summary");
let total = 0;
let allProducts = []; // Store products globally for submission

// =====================================
// Display Order Summary
// =====================================

async function loadCheckoutSummary() {
try {
const response = await fetch("data/products.json");
if (!response.ok) {
throw new Error(HTTP error! Status: ${response.status});
}

    allProducts = await response.json();

    if (cart.length === 0) {
        orderSummary.innerHTML = `
        <div class="empty-cart">
            <h3>Your cart is empty</h3>
            <a href="products.html">Continue Shopping</a>
        </div>
        `;
        return;
    }

    let summaryHTML = "";

    cart.forEach(item => {
        const product = allProducts.find(p => p.id === item.id);

        if (product) {
            const subtotal = product.price * item.quantity;
            total += subtotal;

            summaryHTML += `
            <div class="order-item">
                <img
                src="${product.image}"
                alt="${product.name}"
                >
                <div>
                    <h3>${product.name}</h3>
                    <p>Quantity: ${item.quantity}</p>
                    <p>Price: $${product.price.toFixed(2)}</p>
                    <p>Subtotal: $${subtotal.toFixed(2)}</p>
                </div>
            </div>
            `;
        }
    });

    summaryHTML += `
    <div class="order-total">
        <h2>Total: $${total.toFixed(2)}</h2>
    </div>
    `;

    orderSummary.innerHTML = summaryHTML;
} catch (error) {
    console.log("Error loading checkout:", error);
}

}

loadCheckoutSummary();

// =====================================
// Submit Order
// =====================================

document.getElementById("checkout-form").addEventListener("submit", async function(event) {
event.preventDefault();

const customerName = document.getElementById("name").value;

// Enrich cart items with product names so the backend email can use them
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
    const response = await fetch(
        "[https://prasun-shop-api.prasun301.workers.dev/](https://prasun-shop-api.prasun301.workers.dev/)",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                customerName: customerName,
                email: document.getElementById("email").value,
                phone: document.getElementById("phone").value,
                address: document.getElementById("address").value,
                cart: enrichedCart,
                total: total
            })
        }
    );

    const data = await response.json();
    console.log("Order sent:", data);

    // Clear cart after successful order
    localStorage.removeItem("cart");

    window.location.href = "order-success.html";
} catch (error) {
    console.log("Order error:", error);
    alert("Something went wrong. Please try again.");
}

});
