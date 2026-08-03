// =====================================
// Prasun Shop - Checkout System
// =====================================

// Load cart
let cart = JSON.parse(
    localStorage.getItem("cart")
) || [];

const orderSummary = document.getElementById("order-summary");
let total = 0;
let allProducts = []; // Store products globally for submission

// =====================================
// Display Order Summary
// =====================================

fetch("data/products.json")
.then(response => response.json())
.then(products => {
    allProducts = products; // Save products data

    if(cart.length === 0){
        orderSummary.innerHTML = `
        <div class="empty-cart">
            <h3>Your cart is empty</h3>
            <a href="products.html">Continue Shopping</a>
        </div>
        `;
        return;
    }

    cart.forEach(item => {
        const product = products.find(
            p => p.id === item.id
        );

        if(product){
            const subtotal = product.price * item.quantity;
            total += subtotal;

            orderSummary.innerHTML += `
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

    orderSummary.innerHTML += `
    <div class="order-total">
        <h2>Total: $${total.toFixed(2)}</h2>
    </div>
    `;
})
.catch(error => {
    console.log("Error loading checkout:", error);
});


// =====================================
// Submit Order
// =====================================

document.getElementById("checkout-form").addEventListener("submit", function(event){
    event.preventDefault();

    const customerName = document.getElementById("name").value;

    // Enrich cart items with product names so the backend email can use them
    const enrichedCart = cart.map(item => {
        const product = allProducts.find(p => p.id === item.id);
        return {
            id: item.id,
            name: product ? product.name : "Unknown Product",
            price: product ? product.price : 0,
            quantity: item.quantity
        };
    });

    fetch(
        "https://prasun-shop-api.prasun301.workers.dev/",
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
                cart: enrichedCart, // Send the cart with names included
                total: total
            })
        }
    )
    .then(response => response.json())
    .then(data => {
        console.log("Order sent:", data);

        // Clear cart after successful order
        localStorage.removeItem("cart");

        window.location.href = "order-success.html";
    })
    .catch(error => {
        console.log("Order error:", error);
        alert("Something went wrong. Please try again.");
    });
});
