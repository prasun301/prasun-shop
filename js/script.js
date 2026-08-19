/**
 * ============================================================================
 * PRASUN SHOP — MAIN SCRIPT (script.js)
 * Aligned with index.html IDs and elements
 * ============================================================================
 */

"use strict";

(function () {
    const CART_KEY = "prasunShopCart";

    document.addEventListener("DOMContentLoaded", () => {
        initShop();
    });

    async function initShop() {
        const productList = document.getElementById("product-list");
        if (!productList) return;

        // Initial load
        await fetchAndRenderProducts();

        // Hook up search input listener with debounce
        const searchInput = document.getElementById("product-search");
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener("input", (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    fetchAndRenderProducts(e.target.value.trim());
                }, 350);
            });
        }
    }

    async function fetchAndRenderProducts(keyword = "") {
        const productList = document.getElementById("product-list");
        const resultsCount = document.getElementById("results-count");
        
        if (!productList) return;

        if (resultsCount) resultsCount.innerText = "Loading products...";

        productList.innerHTML = `
            <div class="products-empty" role="status" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <h2>Loading products...</h2>
                <p>Please wait while products are loaded from CJ Dropshipping.</p>
            </div>
        `;

        try {
            let endpoint = "/api/products";
            if (keyword) {
                endpoint += `?keyword=${encodeURIComponent(keyword)}`;
            }

            const response = await fetch(endpoint);
            const data = await response.json();

            const productsList = data.products || data.data?.list || data.list || (Array.isArray(data) ? data : null);

            if (data && (data.success || Array.isArray(productsList)) && Array.isArray(productsList)) {
                if (resultsCount) resultsCount.innerText = `${productsList.length} products found`;
                renderProducts(productsList);
            } else {
                if (resultsCount) resultsCount.innerText = "0 products found";
                productList.innerHTML = `
                    <div class="products-empty" role="status" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <h2>No products available</h2>
                        <p>Please check back soon!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error("[PRASUN SHOP] Failed to load products:", error);
            if (resultsCount) resultsCount.innerText = "Error loading";
            productList.innerHTML = `
                <div class="products-empty" role="status" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #dc2626;">
                    <h2>Connection Error</h2>
                    <p>Failed to connect to product server. Please check your network connection.</p>
                </div>
            `;
        }
    }

    function renderProducts(products) {
        const productList = document.getElementById("product-list");
        if (!productList) return;

        if (!Array.isArray(products) || products.length === 0) {
            productList.innerHTML = `
                <div class="products-empty" role="status" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <h2>No products found</h2>
                    <p>No products matched your search criteria.</p>
                </div>
            `;
            return;
        }

        productList.innerHTML = products.map(productRaw => {
            const rawId = productRaw.pid || productRaw.id || productRaw.sku || "";
            const rawName = productRaw.productNameEn || productRaw.productName || productRaw.title || productRaw.name || "Product";
            const rawPrice = Number(productRaw.sellPrice || productRaw.price || 0);
            const rawImage = productRaw.productImage || productRaw.image || "";
            const rawCategory = productRaw.categoryName || productRaw.category || "General";

            const safeImage = rawImage ? rawImage : "https://via.placeholder.com/300?text=Prasun+Shop";
            const safePrice = Number.isFinite(rawPrice) ? rawPrice.toFixed(2) : "0.00";
            const safeName = escapeHtml(rawName);
            const safeId = escapeHtml(String(rawId));
            const safeCategory = escapeHtml(rawCategory);

            return `
                <article class="product-card">
                    <div class="product-card-inner">
                        <a href="product.html?id=${safeId}" class="product-card-link">
                            <div class="product-card-image">
                                <span class="product-category">${safeCategory}</span>
                                <img src="${safeImage}" alt="${safeName}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Image+Unavailable'">
                            </div>
                            <div class="product-card-body">
                                <span class="product-rating">★ 4.8</span>
                                <h3 class="product-title">${safeName}</h3>
                                <p class="product-description">High quality item available now at PRASUN SHOP.</p>
                                <div class="product-bottom">
                                    <span class="product-price">$${safePrice}</span>
                                    <span class="product-view-button">View Details &rarr;</span>
                                </div>
                            </div>
                        </a>
                        <div class="product-card-actions">
                            <button type="button" class="btn-add-to-cart" onclick='window.PrasunShopAddToCart("${safeId}", ${JSON.stringify(rawName)}, ${rawPrice}, ${JSON.stringify(safeImage)})'>
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    window.PrasunShopAddToCart = function(id, name, price, image) {
        let cart = [];
        try {
            const raw = localStorage.getItem(CART_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) cart = parsed;
            }
        } catch (e) {
            cart = [];
        }

        const existingIndex = cart.findIndex(item => String(item.id) === String(id));
        if (existingIndex > -1) {
            cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + 1;
        } else {
            cart.push({ id, name: String(name || "Product"), price: Number(price) || 0, image: String(image || ""), quantity: 1 });
        }

        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("prasunCartUpdated"));
        
        // Update badge count directly if element exists
        const badge = document.getElementById("cart-count");
        if (badge) {
            const totalCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
            badge.innerText = totalCount;
            badge.hidden = totalCount === 0;
        }

        console.log(`Added "${name}" to cart successfully!`);
    };

    const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    const ESCAPE_REGEX = /[&<>"']/g;

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(ESCAPE_REGEX, (match) => ESCAPE_MAP[match]);
    }
})();
