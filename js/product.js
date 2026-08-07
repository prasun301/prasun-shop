// =================================
// Prasun Shop - Product Details
// =================================

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");
const container = document.getElementById("product-detail");

// =================================
// Load Product
// =================================

async function loadProduct() {
try {
const response = await fetch("data/products.json");
if (!response.ok) {
throw new Error(HTTP error! Status: ${response.status});
}
    const products = await response.json();
    const product = products.find(item => item.id === productId);

    if (!product) {
        container.innerHTML = "<h2>Product not found</h2>";
        return;
    }

    const featuresHTML = product.features?.length 
        ? `
        <div class="product-section">
        <h3>
        Key Features
        </h3>
        <ul>
        ${product.features.map(feature => `<li>✓ ${feature}</li>`).join("")}
        </ul>
        </div>
        ` 
        : "";

    const specificationsHTML = product.specifications && Object.keys(product.specifications).length > 0
        ? `
        <div class="product-section">
        <h3>
        Specifications
        </h3>
        <table class="spec-table">
        ${Object.entries(product.specifications)
            .map(([key, value]) => `
            <tr>
            <td>
            ${key}
            </td>
            <td>
            ${value}
            </td>
            </tr>
            `)
            .join("")}
        </table>
        </div>
        ` 
        : "";

    container.innerHTML = `
    <div class="card product-detail-card">
        <img
        class="product-main-image"
        src="${product.image}"
        alt="${product.name}"
        >
        <p class="product-category">
        Category:
        ${product.category || "Smart Product"}
        </p>
        <p class="product-sku">
        SKU:
        ${product.sku || "N/A"}
        </p>
        <p class="product-rating">
        ⭐ ${product.rating || 5}/5
        </p>
        <h1>
        ${product.name}
        </h1>
        <p class="product-description">
        ${product.description}
        </p>
        ${featuresHTML}
        ${specificationsHTML}
        <h2 class="product-price">
        $${product.price.toFixed(2)}
        </h2>
        <p class="stock">
        ✅ In Stock
        </p>
        <button 
        onclick="addToCart('${product.id}')">
        🛒 Add to Cart
        </button>
        <button 
        onclick="buyNow('${product.id}')">
        ⚡ Buy Now
        </button>
    </div>
    `;
} catch (error) {
    console.log("Error loading product:", error);
}

}

loadProduct();

// =================================
// Cart Storage Helpers
// =================================

const getCart = () => JSON.parse(localStorage.getItem("cart")) ?? [];
const saveCart = (cart) => localStorage.setItem("cart", JSON.stringify(cart));
const notifyCartUpdate = () => {
if (typeof updateCartCount === "function") {
updateCartCount();
}
};

// =================================
// Add To Cart
// =================================

function addToCart(productId) {
const cart = getCart();
const existingProduct = cart.find(item => item.id === productId);

if (existingProduct) {
    existingProduct.quantity += 1;
} else {
    cart.push({
        id: productId,
        quantity: 1
    });
}

saveCart(cart);
notifyCartUpdate();
alert("Product added to cart!");

}

// =================================
// Buy Now
// =================================

function buyNow(productId) {
const cart = getCart();
const existingProduct = cart.find(item => item.id === productId);

if (!existingProduct) {
    cart.push({
        id: productId,
        quantity: 1
    });
}

saveCart(cart);
notifyCartUpdate();
window.location.href = "checkout.html";

}
