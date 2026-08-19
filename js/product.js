/**
 * ============================================================================
 * PRASUN SHOP — PRODUCT DETAILS
 * ============================================================================
 */

"use strict";

(() => {
    // Change this line in product.js
    const API_ENDPOINT = "https://prasun-shop-api.prasun301.workers.dev/api/products";
    const CART_KEY = "prasun_cart";
    const CART_EVENT_NAME = "prasunCartUpdated";
    const MAX_QUANTITY = 10;

    const container = document.getElementById("product-detail");
    if (!container) return;

    const breadcrumb = document.getElementById("breadcrumb-title");
    const cartCount = document.getElementById("cart-count");
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");

    /* ========================================================================
       CURRENCY & FORMATTING
       ======================================================================== */
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function formatPrice(value) {
        const number = Number(value);
        return Number.isFinite(number) ? currencyFormatter.format(number) : "$0.00";
    }

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    const FALLBACK_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
            <rect width="600" height="600" fill="#f4f4f5"/>
            <text x="300" y="300" text-anchor="middle" dominant-baseline="middle" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="22">
                Image unavailable
            </text>
        </svg>
    `);

    /* ========================================================================
       CART MANAGEMENT
       ======================================================================== */
    function readCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));

            window.dispatchEvent(
                new CustomEvent(CART_EVENT_NAME, { detail: { cart } })
            );

            updateCartBadge(cart);
            return true;
        } catch (error) {
            console.error("[PRASUN SHOP] Cart save error:", error);
            return false;
        }
    }

    function updateCartBadge(suppliedCart = null) {
        if (!cartCount) return;

        const cart = suppliedCart || readCart();
        const total = cart.reduce((sum, item) => {
            const quantity = Number(item?.quantity);
            return sum + (Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1);
        }, 0);

        cartCount.textContent = String(total);
        cartCount.hidden = total === 0;

        const link = cartCount.closest("a");
        if (link) {
            link.setAttribute(
                "aria-label",
                total > 0
                    ? `View Shopping Cart, ${total} ${total === 1 ? "item" : "items"}`
                    : "View Shopping Cart"
            );
        }
    }

    function addProductToCart(product, quantity) {
        const cart = readCart();
        const id = String(product.id);
        const safeQuantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 1)));

        const existing = cart.find(item => String(item.id) === id);

        if (existing) {
            existing.quantity = Math.min(
                MAX_QUANTITY,
                (Number(existing.quantity) || 0) + safeQuantity
            );
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : (product.image || ""),
                category: product.category || "",
                description: product.description || "",
                rating: Number(product.rating) || 5,
                sku: product.sku || product.id,
                quantity: safeQuantity
            });
        }

        return saveCart(cart);
    }

    /* ========================================================================
       UI RENDERING & TOAST FEEDBACK
       ======================================================================== */
    function showToast(message) {
        let toast = document.getElementById("prasun-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "prasun-toast";
            toast.className = "prasun-toast";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
    }

    function renderError(title, message) {
        container.innerHTML = `
            <div class="product-error">
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(message)}</p>
                <a href="products.html" class="back-button">Back to Products</a>
            </div>
        `;
    }

    function renderLoading() {
        container.innerHTML = `
            <div class="product-loading">
                <div class="loading-spinner" aria-hidden="true"></div>
                <p>Loading product details...</p>
            </div>
        `;
    }

    function renderFeatures(features) {
        if (!Array.isArray(features) || !features.length) return "";

        return `
            <section class="product-extra-section">
                <h2 class="product-extra-title">Key Features</h2>
                <ul class="feature-list">
                    ${features
                        .filter(Boolean)
                        .map(
                            feature => `
                                <li>
                                    <span class="feature-dot" aria-hidden="true"></span>
                                    <span>${escapeHTML(feature)}</span>
                                </li>
                            `
                        )
                        .join("")}
                </ul>
            </section>
        `;
    }

    function renderSpecifications(specifications) {
        if (!specifications || typeof specifications !== "object") return "";

        const keys = Object.keys(specifications);
        if (!keys.length) return "";

        return `
            <section class="product-extra-section">
                <h2 class="product-extra-title">Specifications</h2>
                <table class="spec-table">
                    <tbody>
                        ${keys
                            .map(
                                key => `
                                    <tr>
                                        <td>${escapeHTML(key)}</td>
                                        <td>${escapeHTML(specifications[key])}</td>
                                    </tr>
                                `
                            )
                            .join("")}
                    </tbody>
                </table>
            </section>
        `;
    }

    function renderGallery(product) {
        const images = Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : [product.image || FALLBACK_IMAGE];

        const mainImageSrc = images[0];

        const thumbnails = images.length > 1
            ? `
                <div class="product-thumbnails" role="tablist" aria-label="Product Image Thumbnails">
                    ${images
                        .map(
                            (img, idx) => `
                                <button type="button" 
                                    class="thumbnail-btn ${idx === 0 ? "active" : ""}" 
                                    data-src="${escapeHTML(img)}" 
                                    aria-label="View product image ${idx + 1}"
                                    aria-selected="${idx === 0}">
                                    <img src="${escapeHTML(img)}" alt="" loading="lazy" />
                                </button>
                            `
                        )
                        .join("")}
                </div>
            `
            : "";

        return `
            <div class="product-gallery">
                <div class="product-image-container">
                    <img id="product-main-image"
                         src="${escapeHTML(mainImageSrc)}"
                         alt="${escapeHTML(product.name)}"
                         loading="eager"
                         decoding="async">
                </div>
                ${thumbnails}
            </div>
        `;
    }

    /* ========================================================================
       RENDER PRODUCT
       ======================================================================== */
    function renderProduct(product) {
        if (!product || !product.id) {
            renderError("Product Not Found", "This product could not be found.");
            return;
        }

        document.title = `${product.name} — PRASUN SHOP`;

        if (breadcrumb) {
            breadcrumb.textContent = product.name;
        }

        const rating = Number.isFinite(Number(product.rating))
            ? Number(product.rating).toFixed(1)
            : "5.0";

        const inStock = product.inStock !== false && (product.stock === undefined || product.stock > 0);

        container.innerHTML = `
            <div class="product-grid">
                ${renderGallery(product)}

                <div class="product-details">
                    <div class="product-category-row">
                        <span class="product-category">
                            ${escapeHTML(product.category || "Product")}
                        </span>
                        <span class="product-rating" aria-label="Rated ${rating} out of 5 stars">
                            <span class="product-rating-star" aria-hidden="true">★</span>
                            ${rating} / 5.0
                        </span>
                    </div>

                    <h1 class="product-title">${escapeHTML(product.name)}</h1>

                    <div class="product-meta">
                        <span>
                            SKU: <strong>${escapeHTML(product.sku || product.id)}</strong>
                        </span>
                        <span class="product-stock ${inStock ? 'in-stock' : 'out-of-stock'}">
                            <span class="stock-dot" aria-hidden="true"></span>
                            ${inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                    </div>

                    <div class="product-price">${formatPrice(product.price)}</div>

                    <p class="product-description">
                        ${escapeHTML(product.description || "No detailed product description provided.")}
                    </p>

                    ${inStock ? `
                        <div class="quantity-row">
                            <label class="quantity-label" for="product-quantity">Quantity</label>
                            <div class="quantity-control" role="group" aria-label="Product quantity">
                                <button type="button" id="qty-decrement" aria-label="Decrease quantity">−</button>
                                <input id="product-quantity"
                                       type="number"
                                       min="1"
                                       max="${MAX_QUANTITY}"
                                       step="1"
                                       value="1"
                                       inputmode="numeric">
                                <button type="button" id="qty-increment" aria-label="Increase quantity">+</button>
                            </div>
                        </div>

                        <div class="button-group">
                            <button type="button" id="add-to-cart-btn" class="product-button product-button-secondary">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                                <span>Add to Cart</span>
                            </button>

                            <button type="button" id="buy-now-btn" class="product-button product-button-primary">
                                <span>Buy Now</span>
                            </button>
                        </div>
                    ` : `
                        <div class="out-of-stock-notice">
                            <p>This item is currently out of stock.</p>
                        </div>
                    `}

                    ${renderFeatures(product.features)}
                    ${renderSpecifications(product.specifications)}
                </div>
            </div>
        `;

        /* ================================================================
           EVENT LISTENERS & BINDINGS
           ================================================================ */

        // Main Image Error Handling
        const imageElement = document.getElementById("product-main-image");
        if (imageElement) {
            imageElement.addEventListener("error", () => {
                if (imageElement.dataset.fallbackApplied) return;
                imageElement.dataset.fallbackApplied = "true";
                imageElement.src = FALLBACK_IMAGE;
            });
        }

        // Thumbnail Switching
        const thumbnailBtns = container.querySelectorAll(".thumbnail-btn");
        thumbnailBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                thumbnailBtns.forEach(b => {
                    b.classList.remove("active");
                    b.setAttribute("aria-selected", "false");
                });
                btn.classList.add("active");
                btn.setAttribute("aria-selected", "true");
                const newSrc = btn.getAttribute("data-src");
                if (imageElement && newSrc) {
                    imageElement.src = newSrc;
                }
            });
        });

        // Quantity Controls (only if in stock)
        if (inStock) {
            const quantityInput = document.getElementById("product-quantity");
            const decrementButton = document.getElementById("qty-decrement");
            const incrementButton = document.getElementById("qty-increment");
            const addButton = document.getElementById("add-to-cart-btn");
            const buyButton = document.getElementById("buy-now-btn");

            function sanitizeQuantity() {
                let value = parseInt(quantityInput.value, 10);
                if (!Number.isFinite(value) || value < 1) value = 1;
                value = Math.min(MAX_QUANTITY, value);
                quantityInput.value = String(value);
                return value;
            }

            decrementButton.addEventListener("click", () => {
                const current = sanitizeQuantity();
                quantityInput.value = String(Math.max(1, current - 1));
            });

            incrementButton.addEventListener("click", () => {
                const current = sanitizeQuantity();
                quantityInput.value = String(Math.min(MAX_QUANTITY, current + 1));
            });

            quantityInput.addEventListener("change", sanitizeQuantity);
            quantityInput.addEventListener("blur", sanitizeQuantity);

            // Add to Cart Action
            addButton.addEventListener("click", () => {
                const quantity = sanitizeQuantity();
                if (addProductToCart(product, quantity)) {
                    const span = addButton.querySelector("span");
                    const originalText = span.textContent;

                    span.textContent = "Added ✓";
                    addButton.disabled = true;

                    showToast(`Added ${quantity} × ${product.name} to your cart.`);

                    setTimeout(() => {
                        span.textContent = originalText;
                        addButton.disabled = false;
                    }, 1200);
                }
            });

            // Buy Now Action
            buyButton.addEventListener("click", () => {
                const quantity = sanitizeQuantity();
                if (addProductToCart(product, quantity)) {
                    window.location.href = "cart.html";
                }
            });
        }
    }

    /* ========================================================================
       LOAD PRODUCT DATA
       ======================================================================== */
    async function loadProduct() {
        updateCartBadge();

        if (!productId) {
            renderError(
                "No Product Selected",
                "Please return to the shop and select a product."
            );
            return;
        }

        renderLoading();

        try {
            const url = `${API_ENDPOINT}?id=${encodeURIComponent(productId)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            let response;
            try {
                response = await fetch(url, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Extract product object with multiple API schema fallbacks
            let product = data?.product || data?.data || null;

            if (!product && Array.isArray(data)) {
                product = data.find(
                    item => String(item.id ?? item.pid) === String(productId)
                );
            }

            if (!product) {
                throw new Error("Product data was not found.");
            }

            renderProduct(product);

        } catch (error) {
            console.error("[PRASUN SHOP] Failed to load product:", error);
            const msg = error.name === "AbortError"
                ? "The server took too long to respond. Please try again."
                : "Unable to load product details at this time.";

            renderError("Unable to Load Product", msg);
        }
    }

    /* ========================================================================
       GLOBAL EVENT LISTENERS
       ======================================================================== */
    // Synchronize cart count across open browser tabs
    window.addEventListener("storage", (e) => {
        if (e.key === CART_KEY) {
            updateCartBadge();
        }
    });

    // Custom internal cart update events
    window.addEventListener(CART_EVENT_NAME, (e) => {
        updateCartBadge(e.detail?.cart);
    });

    // Initialize application
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadProduct);
    } else {
        loadProduct();
    }
})();
