/**
 * product.js - E-commerce Storefront with AliExpress Dropshipping Integration
 * Handles product fetching, variant/SKU selection, real-time shipping calculation,
 * DOM rendering, and dropship order relay to the fulfillment API backend.
 */

(function () {
    "use strict";

    /* ========================================================================
       CONFIG & STATE MANAGEMENT
       ======================================================================== */

    const CONFIG = {
        // Updated to use your live Cloudflare Worker API endpoints
        API_ENDPOINTS: {
            GET_PRODUCT: "https://prasun-shop-api.prasun301.workers.dev/api/products",
            GET_SHIPPING: "https://prasun-shop-api.prasun301.workers.dev/api/shipping",
            CREATE_ORDER: "https://prasun-shop-api.prasun301.workers.dev/api/order"
        },
        CART_STORAGE_KEYS: ["store_cart", "ae_dropship_cart"],
        DEFAULT_CURRENCY: "USD",
        SHIPPING_COUNTRY_DEFAULT: "US"
    };

    let currentProduct = null;
    let selectedSku = null;
    let selectedSkuAttr = {};
    let selectedShipping = null;
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
            // Updated to fetch using REST path structure: /api/products/:id
            const response = await fetch(`${CONFIG.API_ENDPOINTS.GET_PRODUCT}/${encodeURIComponent(productId)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.product || data.result || data;
        } catch (error) {
            console.error("Failed to fetch product:", error);
            return null;
        }
    }

    async function fetchShippingOptions(productId, countryCode, count = 1, skuId = null) {
        try {
            const query = new URLSearchParams({
                productId,
                country: countryCode,
                quantity: count,
                ...(skuId && { skuId })
            });
            const response = await fetch(`${CONFIG.API_ENDPOINTS.GET_SHIPPING}?${query.toString()}`);
            if (!response.ok) throw new Error("Shipping lookup failed");
            const data = await response.json();
            return data.freightOptions || [];
        } catch (error) {
            console.error("Error fetching shipping rates:", error);
            return [];
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
            console.error("Error creating dropshipping order:", error);
            return { success: false, message: "Network error processing fulfillment." };
        }
    }

    /* ========================================================================
       RENDER ENGINE
       ======================================================================== */

    function renderProduct(product) {
        if (!detailContainer || !product) return;

        // Auto-select initial SKU variant
        if (product.skus && product.skus.length > 0) {
            selectedSku = product.skus[0];
        }

        const activePrice = selectedSku ? selectedSku.price : product.price;
        const activeStock = selectedSku ? selectedSku.stock : product.stock;
        const inStock = activeStock > 0;

        detailContainer.innerHTML = `
            <div class="product-layout">
                <!-- Gallery Section -->
                <div class="product-gallery">
                    <div class="main-image-wrapper">
                        <img id="main-product-image" src="${escapeHTML(product.images[0])}" alt="${escapeHTML(product.title)}" />
                    </div>
                    <div class="gallery-thumbnails" id="gallery-thumbnails">
                        ${product.images.map((img, idx) => `
                            <button type="button" class="thumb-btn ${idx === 0 ? "active" : ""}" data-image-index="${idx}">
                                <img src="${escapeHTML(img)}" alt="Thumbnail ${idx + 1}" />
                            </button>
                        `).join("")}
                    </div>
                </div>

                <!-- Product Info Section -->
                <div class="product-details">
                    <h1 class="product-title">${escapeHTML(product.title)}</h1>
                    <div class="product-meta">
                        <span class="sku-label">Item ID: ${escapeHTML(product.id)}</span>
                        <span class="stock-status ${inStock ? "in-stock" : "out-of-stock"}">
                            ${inStock ? `In Stock (${activeStock} available)` : "Out of Stock"}
                        </span>
                    </div>

                    <div class="product-pricing" id="product-pricing">
                        <span class="current-price" id="display-price">${formatPrice(activePrice)}</span>
                        ${product.originalPrice ? `<span class="original-price">${formatPrice(product.originalPrice)}</span>` : ""}
                    </div>

                    <!-- SKU Variants -->
                    <div class="product-variants" id="product-variants">
                        ${renderVariants(product.attributes)}
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
                            <p class="loading-text">Calculating shipping options...</p>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="product-actions">
                        <div class="quantity-selector">
                            <button type="button" class="qty-btn" id="qty-minus">-</button>
                            <input type="number" id="qty-input" value="1" min="1" max="${activeStock}">
                            <button type="button" class="qty-btn" id="qty-plus">+</button>
                        </div>

                        <button type="button" class="btn btn-primary" id="add-to-cart-btn" ${!inStock ? "disabled" : ""}>
                            ${inStock ? "Add to Cart" : "Out of Stock"}
                        </button>
                        <button type="button" class="btn btn-secondary" id="buy-now-btn" ${!inStock ? "disabled" : ""}>
                            Buy Now
                        </button>
                    </div>

                    <div class="product-description-short">
                        <h3>Overview</h3>
                        <p>${escapeHTML(product.description || "No description provided.")}</p>
                    </div>
                </div>
            </div>
        `;

        setupGallery();
        setupVariantSelection();
        setupQuantityControls();
        setupShippingCalculator();
        setupCartHandlers();
        renderSpecifications(product);
        renderRelatedProducts(product);
    }

    function renderVariants(attributes) {
        if (!attributes || !attributes.length) return "";

        return attributes.map(attr => `
            <div class="variant-group" data-attr-id="${escapeHTML(attr.id)}">
                <label class="variant-label">${escapeHTML(attr.name)}:</label>
                <div class="variant-options">
                    ${attr.values.map((val, idx) => `
                        <button type="button" 
                                class="variant-opt-btn ${idx === 0 ? "selected" : ""}" 
                                data-attr-id="${escapeHTML(attr.id)}" 
                                data-val-id="${escapeHTML(val.id)}">
                            ${val.image ? `<img src="${escapeHTML(val.image)}" class="variant-thumb" />` : ""}
                            <span>${escapeHTML(val.name)}</span>
                        </button>
                    `).join("")}
                </div>
            </div>
        `).join("");
    }

    /* ========================================================================
       EVENT HANDLERS & LOGIC
       ======================================================================== */

    function setupGallery() {
        const mainImg = document.getElementById("main-product-image");
        const thumbContainer = document.getElementById("gallery-thumbnails");
        if (!mainImg || !thumbContainer) return;

        thumbContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".thumb-btn");
            if (!btn) return;

            const index = Number(btn.dataset.imageIndex);
            if (isNaN(index) || !currentProduct.images[index]) return;

            currentImageIndex = index;
            mainImg.src = currentProduct.images[index];
            thumbContainer.querySelectorAll(".thumb-btn").forEach((el, i) => {
                el.classList.toggle("active", i === index);
            });
        });
    }

    function setupVariantSelection() {
        const variantContainer = document.getElementById("product-variants");
        if (!variantContainer) return;

        currentProduct.attributes?.forEach(attr => {
            if (attr.values.length > 0) {
                selectedSkuAttr[attr.id] = attr.values[0].id;
            }
        });

        variantContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".variant-opt-btn");
            if (!btn) return;

            const attrId = btn.dataset.attrId;
            const valId = btn.dataset.valId;

            const parent = btn.closest(".variant-options");
            parent.querySelectorAll(".variant-opt-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            selectedSkuAttr[attrId] = valId;
            matchSku();
        });
    }

    function matchSku() {
        if (!currentProduct.skus) return;

        const matched = currentProduct.skus.find(sku => {
            return Object.entries(selectedSkuAttr).every(([attrId, valId]) => {
                return sku.attributes[attrId] === valId;
            });
        });

        if (matched) {
            selectedSku = matched;
            const priceDisplay = document.getElementById("display-price");
            if (priceDisplay) priceDisplay.textContent = formatPrice(matched.price);

            const qtyInput = document.getElementById("qty-input");
            if (qtyInput) qtyInput.max = matched.stock;

            loadShippingRates();
        }
    }

    function setupQuantityControls() {
        const qtyInput = document.getElementById("qty-input");
        const minusBtn = document.getElementById("qty-minus");
        const plusBtn = document.getElementById("qty-plus");

        if (!qtyInput) return;

        const updateQty = (val) => {
            const maxStock = selectedSku ? selectedSku.stock : (currentProduct.stock || 999);
            currentQuantity = Math.max(1, Math.min(maxStock, parseInt(val, 10) || 1));
            qtyInput.value = currentQuantity;
            loadShippingRates();
        };

        if (minusBtn) minusBtn.addEventListener("click", () => updateQty(currentQuantity - 1));
        if (plusBtn) plusBtn.addEventListener("click", () => updateQty(currentQuantity + 1));
        qtyInput.addEventListener("change", (e) => updateQty(e.target.value));
    }

    async function loadShippingRates() {
        const container = document.getElementById("shipping-methods-container");
        const countrySelect = document.getElementById("shipping-country-select");
        if (!container || !countrySelect) return;

        const country = countrySelect.value;
        container.innerHTML = `<p class="loading-text">Fetching live shipping rates...</p>`;

        const options = await fetchShippingOptions(
            currentProduct.id,
            country,
            currentQuantity,
            selectedSku ? selectedSku.id : null
        );

        if (!options.length) {
            container.innerHTML = `<p class="error-text">No shipping available for selected destination.</p>`;
            selectedShipping = null;
            return;
        }

        selectedShipping = options[0];

        container.innerHTML = `
            <select id="shipping-method-select" class="form-control">
                ${options.map(opt => `
                    <option value="${escapeHTML(opt.company)}" data-price="${opt.amount}">
                        ${escapeHTML(opt.company)} - ${formatPrice(opt.amount)} (${escapeHTML(opt.estimatedDays)} days)
                    </option>
                `).join("")}
            </select>
        `;

        document.getElementById("shipping-method-select")?.addEventListener("change", (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            selectedShipping = {
                company: e.target.value,
                amount: parseFloat(selectedOpt.dataset.price)
            };
        });
    }

    function setupShippingCalculator() {
        const countrySelect = document.getElementById("shipping-country-select");
        if (countrySelect) {
            countrySelect.addEventListener("change", () => loadShippingRates());
        }
        loadShippingRates();
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
            productId: currentProduct.id,
            skuId: selectedSku ? selectedSku.id : null,
            title: currentProduct.title,
            image: currentProduct.images[0],
            attributes: selectedSkuAttr,
            quantity: currentQuantity,
            unitPrice: selectedSku ? selectedSku.price : currentProduct.price,
            shippingMethod: selectedShipping
        };
    }

    function setupCartHandlers() {
        const addBtn = document.getElementById("add-to-cart-btn");
        const buyBtn = document.getElementById("buy-now-btn");

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                const cart = getCart();
                const item = buildOrderItem();
                
                const existingIndex = cart.findIndex(i => i.productId === item.productId && i.skuId === item.skuId);
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
                
                const payload = {
                    items: [buildOrderItem()],
                    destinationCountry: document.getElementById("shipping-country-select")?.value || CONFIG.SHIPPING_COUNTRY_DEFAULT
                };

                const response = await sendDropshipOrderToBackend(payload);
                if (response.success && response.redirectUrl) {
                    window.location.href = response.redirectUrl;
                } else {
                    alert(response.message || "Unable to process direct dropship order.");
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
       TABS, SPECS & AUXILIARY RENDERING
       ======================================================================== */

    function setupTabs() {
        if (!productTabs) return;
        productTabs.addEventListener("click", (e) => {
            const btn = e.target.closest(".tab-btn");
            if (!btn) return;

            const targetTab = btn.dataset.tab;
            productTabs.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const content = document.getElementById(`tab-${targetTab}`);
            if (content) content.classList.add("active");
        });
    }

    function renderSpecifications(product) {
        if (!specTable || !product.specifications) return;
        specTable.innerHTML = Object.entries(product.specifications).map(([key, val]) => `
            <tr>
                <td><strong>${escapeHTML(key)}</strong></td>
                <td>${escapeHTML(val)}</td>
            </tr>
        `).join("");
    }

    function renderRelatedProducts(product) {
        if (!relatedGrid || !relatedSection || !product.related) return;
        if (!product.related.length) {
            relatedSection.style.display = "none";
            return;
        }

        relatedSection.style.display = "block";
        relatedGrid.innerHTML = product.related.map(item => `
            <div class="product-card">
                <a href="?id=${encodeURIComponent(item.id)}">
                    <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy">
                    <h3>${escapeHTML(item.title)}</h3>
                    <p class="price">${formatPrice(item.price)}</p>
                </a>
            </div>
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
        setupTabs();

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
