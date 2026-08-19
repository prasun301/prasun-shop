/**
 * products.js - Prasun Shop CJ Catalog Manager
 */
(function () {
    "use strict";

    const CONFIG = {
        CART_KEY: "prasun_cart_items",
        FALLBACK_IMAGE: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENo CJ Image Available%3C/text%3E%3C/svg%3E"
    };

    let state = {
        searchTimer: null
    };

    const DOM = {
        productList: null,
        searchInput: null,
        resultsCount: null,
        cartBadge: null
    };

    // Mock catalog structured with authentic CJ Dropshipping product image URLs
    const mockProductsCatalog = [
        { 
            pid: "1", 
            productNameEn: "Wireless Bluetooth Headphones", 
            sellPrice: 29.99, 
            description: "High-quality wireless headphones sourced directly from CJ.", 
            productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cjf/10000000/238473824732.jpg" // Example CJ CDN structure, falls back cleanly if broken
        },
        { 
            pid: "2", 
            productNameEn: "Ergonomic Desk Chair", 
            sellPrice: 189.00, 
            description: "Comfortable ergonomic office chair designed for long hours.", 
            productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cjf/10000000/chair-sample.jpg" 
        },
        { 
            pid: "3", 
            productNameEn: "Smart Fitness Watch", 
            sellPrice: 45.50, 
            description: "Track your health, step counter, and heart rate seamlessly.", 
            productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cjf/10000000/watch-sample.jpg" 
        },
        { 
            pid: "4", 
            productNameEn: "Portable LED Desk Lamp", 
            sellPrice: 19.99, 
            description: "Adjustable brightness touch-control modern desk lamp.", 
            productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cjf/10000000/lamp-sample.jpg" 
        },
        { 
            pid: "5", 
            productNameEn: "Stainless Steel Water Bottle", 
            sellPrice: 15.00, 
            description: "Double-walled vacuum insulated thermal bottle keeps drinks cold.", 
            productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cjf/10000000/bottle-sample.jpg" 
        }
    ];

    function cacheDOM() {
        DOM.productList = document.getElementById("product-list");
        DOM.searchInput = document.querySelector(".products-search-input");
        DOM.resultsCount = document.querySelector(".products-result-count");
        DOM.cartBadge = document.getElementById("cart-badge");
    }

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
            updateCartBadge();
        } catch (e) {
            console.error("Cart save error:", e);
        }
    }

    function updateCartBadge() {
        if (!DOM.cartBadge) return;
        const cart = getCart();
        const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        DOM.cartBadge.textContent = total;
        DOM.cartBadge.style.display = total > 0 ? "inline-block" : "none";
    }

    function loadProducts(keyword = "") {
        if (!DOM.productList) return;

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = "Loading products...";
        }

        setTimeout(() => {
            const query = keyword.toLowerCase().trim();
            const filtered = query 
                ? mockProductsCatalog.filter(p => 
                    p.productNameEn.toLowerCase().includes(query) || 
                    p.description.toLowerCase().includes(query)
                  )
                : mockProductsCatalog;

            renderProducts(filtered);

            if (DOM.resultsCount) {
                DOM.resultsCount.textContent = `Showing ${filtered.length} of ${mockProductsCatalog.length} products`;
            }
        }, 150);
    }

    function renderProducts(products) {
        if (!DOM.productList) return;

        if (!products || products.length === 0) {
            DOM.productList.innerHTML = `
                <div class="no-results">
                    <h3>No Products Found</h3>
                    <p>No products match your search criteria. Try a different keyword.</p>
                </div>
            `;
            return;
        }

        DOM.productList.innerHTML = products.map(p => {
            // Ensures if a CJ image link returns 404, it immediately drops to the SVG fallback banner
            const imgSrc = p.productImage || CONFIG.FALLBACK_IMAGE;

            return `
                <article class="product-card" data-id="${p.pid}">
                    <div class="product-image-wrapper">
                        <img 
                            src="${imgSrc}" 
                            alt="${p.productNameEn}" 
                            class="product-image" 
                            loading="lazy"
                            onerror="this.onerror=null; this.src='${CONFIG.FALLBACK_IMAGE}'; this.classList.add('is-fallback');"
                        />
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${p.productNameEn}</h3>
                        <p class="product-description">${p.description}</p>
                        <div class="product-bottom">
                            <span class="product-price">$${p.sellPrice.toFixed(2)}</span>
                            <button type="button" class="add-cart-btn" data-action="add-cart" data-id="${p.pid}">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    function handleAddToCart(productId, btnElement) {
        const card = btnElement.closest(".product-card");
        if (!card) return;

        const name = card.querySelector(".product-title")?.textContent || "Product";
        const priceText = card.querySelector(".product-price")?.textContent || "$0.00";
        const price = parseFloat(priceText.replace("$", "")) || 0;
        const image = card.querySelector(".product-image")?.src || "";

        const cart = getCart();
        const existing = cart.find(item => item.id === productId);

        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({ id: productId, name, price, image, quantity: 1 });
        }

        saveCart(cart);

        const originalText = btnElement.textContent;
        btnElement.textContent = "Added!";
        btnElement.disabled = true;
        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.disabled = false;
        }, 1000);
    }

    function initEvents() {
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", (e) => {
                const query = e.target.value;
                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    loadProducts(query);
                }, 250);
            });
        }

        if (DOM.productList) {
            DOM.productList.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action='add-cart']");
                if (!btn) return;
                e.preventDefault();
                handleAddToCart(btn.dataset.id, btn);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheDOM();
        updateCartBadge();
        initEvents();
        loadProducts("");
    });
})();
