/**
 * product.js - E-commerce Storefront with AliExpress Dropshipping Integration
 */

(function () {
    "use strict";

    /* ========================================================================
       CONFIG & STATE MANAGEMENT
       ======================================================================== */

    const CONFIG = {
        API_ENDPOINTS: {
            GET_PRODUCT: "https://prasun-shop-api.prasun301.workers.dev/api/products",
            CREATE_ORDER: "https://prasun-shop-api.prasun301.workers.dev/api/order"
        },
        CART_STORAGE_KEYS: ["store_cart", "ae_dropship_cart"],
        DEFAULT_CURRENCY: "USD",
        SHIPPING_COUNTRY_DEFAULT: "US"
    };

    let currentProduct = null;
    let selectedSku = null;
    let selectedSkuAttr = {};
    let selectedShipping = { company: "Standard Free Shipping", amount: 0 };
    let currentQuantity = 1;
    let currentImageIndex = 0;

    // DOM References
    const detailContainer = document.getElementById("product-detail-container");
    const productTabs = document.getElementById("product-tabs");
    const specTable = document.getElementById("spec-table");
    const relatedSection = document.getElementById("related-products-section");
    const relatedGrid = document.getElementById("related-products-grid");
    const cartCount = document.getElementById("cart-count-badge");

    /* ========================================================================
       UTILITIES
       ======================================================================== */

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatPrice(amount, currency = CONFIG.DEFAULT_CURRENCY) {
        const num = parseFloat(amount);
        if (isNaN(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency
        }).format(num);
    }

    /* ========================================================================
       API INTEGRATION LAYER
       ======================================================================== */

    async function fetchAliExpressProduct(productId) {
        try {
            const response = await fetch(`${CONFIG.API_ENDPOINTS.GET_PRODUCT}/${encodeURIComponent(productId)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.product || data.result || data;
        } catch (error) {
            console.error("Failed to fetch product:", error);
            return null;
        }
    }

    async function sendDropshipOrderToBackend(orderPayload) {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.CREATE_ORDER, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderPayload)
            });
            return await response.json();
        } catch (error) {
            console.error("Error creating order:", error);
            return { success: false, error: "Network error processing fulfillment." };
        }
    }

    /* ========================================================================
       RENDER ENGINE
       ======================================================================== */

    function renderProduct(product) {
        if (!detailContainer || !product) return;

        const activePrice = product.price;
        const inStock = true; // Default since worker catalog items are available

        // Ensure images array exists
        const images = product.image ? [product.image] : ["https://via.placeholder.com/600"];

        detailContainer.innerHTML = `
            <div class="product-layout">
                <!-- Gallery Section -->
                <div class="product-gallery">
                    <div class="main-image-wrapper">
                        <img id="main-product-image" src="${escapeHTML(images[0])}" alt="${escapeHTML(product.name)}" />
                    </div>
                </div>

                <!-- Product Info Section -->
                <div class="product-details">
                    <h1 class="product-title">${escapeHTML(product.name)}</h1>
                    <div class="product-meta">
                        <span class="sku-label">SKU: ${escapeHTML(product.sku)}</span>
                        <span class="stock-status in-stock">In Stock</span>
                    </div>

                    <div class="product-pricing" id="product-pricing">
                        <span class="current-price" id="display-price">${formatPrice(activePrice)}</span>
                    </div>

                    <!-- Shipping Calculation Box -->
                    <div class="shipping-calculator">
                        <label for="shipping-country-select">Ship To:</label>
                        <select id="shipping-country-select" class="form-control">
                            <option value="US" selected>United States</option>
                            <option value="CA">Canada</option>
                            <option value="GB">United Kingdom</option>
                            <option value="AU">Australia</option>
                        </select>
                        <div id="shipping-methods-container" class="shipping-methods">
                            <p class="success-text">Standard Free Shipping (Estimated 7-15 days) - $0.00</p>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="product-actions">
                        <div class="quantity-selector">
                            <button type="button" class="qty-btn" id="qty-minus">-</button>
                            <input type="number" id="qty-input" value="1" min="1" max="99">
                            <button type="button" class="qty-btn" id="qty-plus">+</button>
                        </div>

                        <button type="button" class="btn btn-primary" id="add-to-cart-btn">Add to Cart</button>
                        <button type="button" class="btn btn-secondary" id="buy-now-btn">Buy Now</button>
                    </div>

                    <div class="product-description-short">
                        <h3>Overview</h3>
                        <p>${escapeHTML(product.description || "No description provided.")}</p>
                    </div>
                </div>
            </div>
        `;

        setupQuantityControls();
        setupCartHandlers();
        renderSpecifications(product);
    }

    /* ========================================================================
       EVENT HANDLERS & LOGIC
       ======================================================================== */

    function setupQuantityControls() {
        const qtyInput = document.getElementById("qty-input");
        const minusBtn = document.getElementById("qty-minus");
        const plusBtn = document.getElementById("qty-plus");

        if (!qtyInput) return;

        const updateQty = (val) => {
            currentQuantity = Math.max(1, Math.min(99, parseInt(val, 10) || 1));
            qtyInput.value = currentQuantity;
        };

        if (minusBtn) minusBtn.addEventListener("click", () => updateQty(currentQuantity - 1));
        if (plusBtn) plusBtn.addEventListener("click", () => updateQty(currentQuantity + 1));
        qtyInput.addEventListener("change", (e) => updateQty(e.target.value));
    }

    /* ========================================================================
       CART & FULFILLMENT HANDLERS
       ======================================================================== */

    function getCart() {
        for (const key of CONFIG.CART_STORAGE_KEYS) {
            try {
                const data = localStorage.getItem(key);
                if (data) return JSON.parse(data);
            } catch (err) {
                console.warn(`Error reading ${key}`, err);
            }
        }
        return [];
    }

    function saveCart(cart) {
        CONFIG.CART_STORAGE_KEYS.forEach(key => {
            try {
                localStorage.setItem(key, JSON.stringify(cart));
            } catch (err) {
                console.warn(`Error writing ${key}`, err);
            }
        });
        updateCartCount();
    }

    function buildOrderItem() {
        return {
            id: currentProduct.id,
            sku: currentProduct.sku,
            name: currentProduct.name,
            image: currentProduct.image,
            quantity: currentQuantity,
            unitPrice: currentProduct.price,
            subtotal: Number((currentProduct.price * currentQuantity).toFixed(2))
        };
    }

    function setupCartHandlers() {
        const addBtn = document.getElementById("add-to-cart-btn");
        const buyBtn = document.getElementById("buy-now-btn");

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                const cart = getCart();
                const item = buildOrderItem();
                
                const existingIndex = cart.findIndex(i => i.id === item.id);
                if (existingIndex > -1) {
                    cart[existingIndex].quantity += item.quantity;
                } else {
                    cart.push(item);
                }

                saveCart(cart);
                addBtn.textContent = "Added to Cart!";
                setTimeout(() => { addBtn.textContent = "Add to Cart"; }, 1500);
            });
        }

        if (buyBtn) {
            buyBtn.addEventListener("click", async () => {
                buyBtn.disabled = true;
                buyBtn.textContent = "Processing...";
                
                // Payload structure matched precisely to your worker's buildOrder expectations
                const payload = {
                    customerName: "Guest Customer",
                    email: "customer@example.com",
                    phone: "+15555555555",
                    address: "123 Main St",
                    shippingCity: "New York",
                    shippingProvince: "NY",
                    shippingCountry: "United States",
                    shippingCountryCode: document.getElementById("shipping-country-select")?.value || "US",
                    shippingZip: "10001",
                    cart: [buildOrderItem()]
                };

                const response = await sendDropshipOrderToBackend(payload);
                if (response.success) {
                    alert(`Order placed successfully! Order Number: ${response.orderNumber}`);
                    localStorage.removeItem("store_cart");
                    window.location.reload();
                } else {
                    alert(response.error || "Unable to process order.");
                    buyBtn.disabled = false;
                    buyBtn.textContent = "Buy Now";
                }
            });
        }
    }

    function updateCartCount() {
        if (!cartCount) return;
        const cart = getCart();
        const total = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
        cartCount.textContent = total;
    }

    /* ========================================================================
       SPECS & AUXILIARY RENDERING
       ======================================================================== */

    function renderSpecifications(product) {
        if (!specTable || !product.specifications) return;
        specTable.innerHTML = Object.entries(product.specifications).map(([key, val]) => `
            <tr>
                <td><strong>${escapeHTML(key)}</strong></td>
                <td>${escapeHTML(val)}</td>
            </tr>
        `).join("");
    }

    function renderError(message) {
        if (!detailContainer) return;
        detailContainer.innerHTML = `
            <div class="product-error">
                <h2>Product Unavailable</h2>
                <p>${escapeHTML(message)}</p>
                <a href="/" class="btn btn-primary">Return to Catalog</a>
            </div>
        `;
    }

    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    async function init() {
        updateCartCount();

        const productId = getQueryParam("id") || getQueryParam("productId");
        if (!productId) {
            renderError("No product ID specified in request URL.");
            return;
        }

        currentProduct = await fetchAliExpressProduct(productId);
        if (currentProduct) {
            renderProduct(currentProduct);
        } else {
            renderError("Failed to retrieve product data from backend.");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
