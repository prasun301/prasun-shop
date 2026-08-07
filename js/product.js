// =====================================
// Prasun Shop - Product Details (Optimized)
// =====================================

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");
const container = document.getElementById("product-detail");

// =====================================
// Load Product Details
// =====================================
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
        const response = await fetch("data/products.json");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const products = await response.json();
        const product = products.find(item => item.id === productId);

        if (!product) {
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

        // Key Features HTML
        const featuresHTML = product.features?.length 
            ? `
                <div class="mt-6 pt-6 border-t border-zinc-200/80">
                    <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Key Features</h3>
                    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600">
                        ${product.features.map(feature => `
                            <li class="flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"></span>
                                <span>${feature}</span>
                            </li>
                        `).join("")}
                    </ul>
                </div>
            ` 
            : "";

        // Specifications HTML
        const specificationsHTML = product.specifications && Object.keys(product.specifications).length > 0
            ? `
                <div class="mt-6 pt-6 border-t border-zinc-200/80">
                    <h3 class="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3">Specifications</h3>
                    <div class="border border-zinc-200/80 rounded-xl overflow-hidden shadow-xs">
                        <table class="w-full text-left text-xs">
                            <tbody class="divide-y divide-zinc-200/80 bg-white">
                                ${Object.entries(product.specifications).map(([key, value]) => `
                                    <tr>
                                        <td class="px-4 py-3 font-medium text-zinc-500 bg-zinc-50/50 w-1/3">${key}</td>
                                        <td class="px-4 py-3 text-zinc-900">${value}</td>
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
                        src="${product.image}" 
                        alt="${product.name}"
                        class="w-full h-full object-cover"
                    >
                </div>

                <!-- Product Information -->
                <div class="flex flex-col">
                    
                    <!-- Category & Rating Header -->
                    <div class="flex items-center justify-between text-xs text-zinc-500 mb-3">
                        <span class="inline-flex items-center px-2.5 py-1 bg-zinc-100 font-semibold text-zinc-800 rounded-full">
                            ${product.category || "Smart Product"}
                        </span>
                        <span class="flex items-center gap-1 font-medium text-amber-500">
                            ★ <span class="text-zinc-700">${product.rating || "5.0"}</span> / 5.0
                        </span>
                    </div>

                    <!-- Product Title -->
                    <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mb-3">
                        ${product.name}
                    </h1>

                    <!-- SKU & Stock Status -->
                    <div class="flex items-center gap-4 text-xs text-zinc-500 mb-6">
                        <span>SKU: <span class="font-medium text-zinc-700">${product.sku || "N/A"}</span></span>
                        <span class="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                        </span>
                    </div>

                    <!-- Price -->
                    <div class="text-2xl font-bold text-zinc-900 mb-6 pb-6 border-b border-zinc-200/80">
                        $${product.price.toFixed(2)}
                    </div>

                    <!-- Description -->
                    <p class="text-sm text-zinc-600 leading-relaxed mb-6">
                        ${product.description}
                    </p>

                    <!-- Quantity Selector -->
                    <div class="flex items-center gap-4 mb-6">
                        <label for="product-quantity" class="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Quantity</label>
                        <div class="inline-flex items-center border border-zinc-200 rounded-xl bg-white shadow-xs">
                            <button type="button" onclick="decrementQuantity()" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none cursor-pointer">−</button>
                            <input type="number" id="product-quantity" value="1" min="1" max="10" class="w-12 text-center text-sm font-semibold text-zinc-900 bg-transparent focus:outline-none">
                            <button type="button" onclick="incrementQuantity()" class="px-3 py-2 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none cursor-pointer">+</button>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                        <button 
                            onclick="addToCart('${product.id}')"
                            class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold rounded-xl text-sm border border-zinc-300 transition-all shadow-xs active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                            </svg>
                            Add to Cart
                        </button>
                        <button 
                            onclick="buyNow('${product.id}')"
                            class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            Buy Now
                        </button>
                    </div>

                    <!-- Features & Specs Sections -->
                    ${featuresHTML}
                    ${specificationsHTML}

                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error loading product:", error);
        container.innerHTML = `
            <div class="py-16 text-center">
                <p class="text-xs text-red-500 font-medium">Failed to load product details. Please refresh the page.</p>
            </div>
        `;
    }
}

// =====================================
// Quantity Controls
// =====================================
function incrementQuantity() {
    const input = document.getElementById("product-quantity");
    if (input) {
        let current = parseInt(input.value) || 1;
        if (current < 10) input.value = current + 1;
    }
}

function decrementQuantity() {
    const input = document.getElementById("product-quantity");
    if (input) {
        let current = parseInt(input.value) || 1;
        if (current > 1) input.value = current - 1;
    }
}

// =====================================
// Cart Storage Helpers
// =====================================
const getCart = () => JSON.parse(localStorage.getItem("cart")) ?? [];
const saveCart = (cart) => localStorage.setItem("cart", JSON.stringify(cart));
const notifyCartUpdate = () => {
    if (typeof updateCartCount === "function") {
        updateCartCount();
    }
};

// =====================================
// Add To Cart
// =====================================
function addToCart(productId) {
    const quantityInput = document.getElementById("product-quantity");
    const quantityToAdd = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

    const cart = getCart();
    const existingProduct = cart.find(item => item.id === productId);

    if (existingProduct) {
        existingProduct.quantity += quantityToAdd;
    } else {
        cart.push({
            id: productId,
            quantity: quantityToAdd
        });
    }

    saveCart(cart);
    notifyCartUpdate();
    alert(`Successfully added ${quantityToAdd} item(s) to cart!`);
}

// =====================================
// Buy Now
// =====================================
function buyNow(productId) {
    const quantityInput = document.getElementById("product-quantity");
    const quantityToAdd = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

    const cart = getCart();
    const existingProduct = cart.find(item => item.id === productId);

    if (existingProduct) {
        existingProduct.quantity += quantityToAdd;
    } else {
        cart.push({
            id: productId,
            quantity: quantityToAdd
        });
    }

    saveCart(cart);
    notifyCartUpdate();
    window.location.href = "checkout.html";
}

// Initialize Product Details Load
loadProduct();
