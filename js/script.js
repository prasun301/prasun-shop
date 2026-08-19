/**
 * ============================================================================
 * PRASUN SHOP — MAIN SCRIPT (js/script.js)
 * Handles Product Fetching, Rendering, Search, and Cart Integration
 * Optimized for Performance, Memory Management, and Consistent Cart Keys
 * ============================================================================
 */

"use strict";

(function () {
    const CART_KEY = "prasunShopCart"; // Aligned with other modules

    document.addEventListener("DOMContentLoaded", () => {
        initShop();
    });

    async function initShop() {
        const productsContainer = document.getElementById("products-container") || document.querySelector(".products-grid");
        if (!productsContainer) return;

        // Initial load
        await fetchAndRenderProducts();

        // Hook up search input listener with debounce
        const searchInput = document.getElementById("search-input") || document.querySelector("input[type='search'], input[name='keyword']");
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
        const productsContainer = document.getElementById("products-container") || document.querySelector(".products-grid");
        if (!productsContainer) return;

        productsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                <p>Loading products from CJ Dropshipping...</p>
            </div>
        `;

        try {
            let endpoint = "/api/products";
            if (keyword) {
                endpoint += `?keyword=${encodeURIComponent(keyword)}`;
            }

            const response = await fetch(endpoint);
            const data = await response.json();

            // Handle various backend payload structures safely
            const productsList = data.products || data.data?.list || data.list || (Array.isArray(data) ? data : null);

            if (data && (data.success || Array.isArray(productsList)) && Array.isArray(productsList)) {
                renderProducts(productsList);
            } else {
                productsContainer.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #d97706;">
                        <p>No products available right now. Please check back soon!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error("[PRASUN SHOP] Failed to load products:", error);
            productsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #dc2626;">
                    <p>Failed to connect to product server. Please check your network connection.</p>
                </div>
            `;
        }
    }

    function renderProducts(products) {
        const productsContainer = document.getElementById("products-container") || document.querySelector(".products-grid");
        if (!productsContainer) return;

        if (!Array.isArray(products) || products.length === 0) {
            productsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <p>No products matched your search criteria.</p>
                </div>
            `;
            return;
        }

        // Apply clean styling grid layout via innerHTML
        productsContainer.style.display = "grid";
        productsContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(240px, 1fr))";
        productsContainer.style.gap = "20px";

        // Pre-map items for optimal rendering performance
        productsContainer.innerHTML = products.map(productRaw => {
            const rawId = productRaw.pid || productRaw.id || productRaw.sku || "";
            const rawName = productRaw.productNameEn || productRaw.productName || productRaw.title || productRaw.name || "Product";
            const rawPrice = Number(productRaw.sellPrice || productRaw.price || 0);
            const rawImage = productRaw.productImage || productRaw.image || "";

            const safeImage = rawImage ? rawImage : "https://via.placeholder.com/300?text=Prasun+Shop";
            const safePrice = Number.isFinite(rawPrice) ? rawPrice.toFixed(2) : "0.00";
            const safeName = escapeHtml(rawName);
            const safeId = escapeHtml(String(rawId));

            // Wrap card in a anchor or use data attributes to allow clicking through to product detail page if desired
            return `
                <div class="product-card" style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div>
                        <a href="product.html?id=${safeId}" style="text-decoration: none; display: block;">
                            <div style="width: 100%; height: 180px; background: #f9fafb; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                                <img src="${safeImage}" alt="${safeName}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='https://via.placeholder.com/300?text=Image+Unavailable'">
                            </div>
                            <h3 style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 40px;">${safeName}</h3>
                        </a>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">$${safePrice}</div>
                        <button type="button" onclick='window.PrasunShopAddToCart("${safeId}", ${JSON.stringify(rawName)}, ${rawPrice}, ${JSON.stringify(safeImage)})' style="width: 100%; background: #111827; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s;">
                            Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Global Add To Cart handler used by product cards
    window.PrasunShopAddToCart = function(id, name, price, image) {
        let cart = [];

        try {
            const raw = localStorage.getItem(CART_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) cart = parsed;
            }
        } catch (e) {
            console.error("Error reading cart from localStorage:", e);
            cart = [];
        }

        const existingIndex = cart.findIndex(item => String(item.id) === String(id));
        if (existingIndex > -1) {
            cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + 1;
        } else {
            cart.push({ 
                id, 
                name: String(name || "Product"), 
                price: Number(price) || 0, 
                image: String(image || ""), 
                quantity: 1 
            });
        }

        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
        } catch (e) {
            console.error("Error saving cart to localStorage:", e);
        }

        // Dispatch custom event to trigger badge updates across tabs/pages
        window.dispatchEvent(new CustomEvent("prasunCartUpdated"));

        // If compatibility object exists, update badge immediately
        if (window.PrasunShopProducts && typeof window.PrasunShopProducts.updateCartBadge === "function") {
            window.PrasunShopProducts.updateCartBadge();
        }

        // Simple non-intrusive notification feedback (can be swapped with toast notification if desired)
        console.log(`Successfully added "${name}" to your cart!`);
    };

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    const ESCAPE_REGEX = /[&<>"']/g;

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(ESCAPE_REGEX, (match) => ESCAPE_MAP[match]);
    }
})();
