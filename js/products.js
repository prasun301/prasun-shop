/**
 * products.js - Prasun Shop Catalog Manager
 */
(function () {
    "use strict";

    const CONFIG = {
        CART_KEY: "prasun_cart_items",
        FALLBACK_IMAGE: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENo Image Available%3C/text%3E%3C/svg%3E"
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

    // Full 10-product catalog with reliable image URLs
    const mockProductsCatalog = [
        { pid: "1", productNameEn: "Wireless Bluetooth Headphones", sellPrice: 29.99, description: "High-quality wireless headphones with active noise cancellation.", productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80" },
        { pid: "2", productNameEn: "Ergonomic Desk Chair", sellPrice: 189.00, description: "Comfortable ergonomic office chair designed for long hours.", productImage: "https://images.unsplash.com/photo-1580481077494-e3299acae58d?auto=format&fit=crop&w=600&q=80" },
        { pid: "3", productNameEn: "Smart Fitness Watch", sellPrice: 45.50, description: "Track your health, daily step counter, and heart rate seamlessly.", productImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80" },
        { pid: "4", productNameEn: "Portable LED Desk Lamp", sellPrice: 19.99, description: "Adjustable brightness touch-control modern desk lamp.", productImage: "https://images.unsplash.com/photo-1534349762230-e8cadf3afbac?auto=format&fit=crop&w=600&q=80" },
        { pid: "5", productNameEn: "Stainless Steel Water Bottle", sellPrice: 15.00, description: "Double-walled vacuum insulated thermal bottle keeps drinks cold.", productImage: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80" },
        { pid: "6", productNameEn: "Minimalist Leather Wallet", sellPrice: 24.99, description: "Slim RFID-blocking genuine leather wallet for everyday carry.", productImage: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80" },
        { pid: "7", productNameEn: "Mechanical Gaming Keyboard", sellPrice: 79.99, description: "RGB backlit mechanical keyboard with tactile blue switches.", productImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80" },
        { pid: "8", productNameEn: "HD Security Web Camera", sellPrice: 39.99, description: "1080p webcam with built-in microphone for streaming and calls.", productImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80" },
        { pid: "9", productNameEn: "Running Sports Sneakers", sellPrice: 65.00, description: "Lightweight breathable athletic shoes designed for peak comfort.", productImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80" },
        { pid: "10", productNameEn: "Travel Laptop Backpack", sellPrice: 49.99, description: "Water-resistant business backpack with USB charging port.", productImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80" }
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
        }, 100);
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
            return `
                <article class="product-card" data-id="${p.pid}">
                    <div class="product-image-wrapper">
                        <img 
                            src="${p.productImage || CONFIG.FALLBACK_IMAGE}" 
                            alt="${p.productNameEn}" 
                            class="product-image" 
                            loading="lazy"
                            onerror="this.onerror=null; this.src='${CONFIG.FALLBACK_IMAGE}';"
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

        // Visual confirmation feedback
        const originalText = btnElement.textContent;
        btnElement.textContent = "Added ✓";
        btnElement.style.backgroundColor = "#16a34a";
        btnElement.disabled = true;
        
        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.style.backgroundColor = "";
            btnElement.disabled = false;
        }, 1200);
    }

    function initEvents() {
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", (e) => {
                const query = e.target.value;
                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    loadProducts(query);
                }, 200);
            });
        }

        // Global event delegation for "Add to Cart" button clicks
        if (DOM.productList) {
            DOM.productList.addEventListener("click", (e) => {
                const btn = e.target.closest("button[data-action='add-cart']");
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
