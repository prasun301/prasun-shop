/**
 * products.js - CJ Dropshipping Live Search & Catalog Manager
 */
(function () {
    "use strict";

    const CONFIG = {
        API_URL: "/api/cj-products", // Points to your backend proxy route
        CART_KEY: "prasun_cart_items",
        DEBOUNCE_DELAY_MS: 400,
        FALLBACK_IMAGE: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENo CJ Image Available%3C/text%3E%3C/svg%3E"
    };

    let state = {
        keyword: "",
        pageNum: 1,
        pageSize: 20,
        searchTimer: null
    };

    const DOM = {
        productList: null,
        searchInput: null,
        searchClearBtn: null,
        resultsCount: null,
        cartBadge: null
    };

    function cacheDOM() {
        DOM.productList = document.getElementById("product-list");
        DOM.searchInput = document.querySelector(".products-search-input");
        DOM.searchClearBtn = document.querySelector(".search-clear");
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

    async function fetchCJProducts(keyword = "", page = 1) {
        if (!DOM.productList) return;

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = "Loading products...";
        }

        DOM.productList.innerHTML = `
            <div class="no-results">
                <h3>Searching CJ Dropshipping...</h3>
                <p>Fetching the latest catalog items matching your request.</p>
            </div>
        `;

        try {
            const endpoint = `${CONFIG.API_URL}?productName=${encodeURIComponent(keyword)}&pageNum=${page}&pageSize=${state.pageSize}`;
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }

            const data = await response.json();
            const productsList = data?.data?.list || data?.list || (Array.isArray(data) ? data : []);
            const totalCount = data?.data?.total || productsList.length;

            renderProducts(productsList);

            if (DOM.resultsCount) {
                DOM.resultsCount.textContent = `Showing ${productsList.length} of ${totalCount} products`;
            }
        } catch (error) {
            console.warn("API request failed or using fallback mode:", error);
            renderErrorState("Unable to reach CJ Dropshipping API server. Please check your backend proxy configuration.");
        }
    }

    function renderProducts(products) {
        if (!DOM.productList) return;

        if (!products || products.length === 0) {
            renderErrorState("No CJ products found matching your search term.");
            return;
        }

        DOM.productList.innerHTML = products.map(p => {
            const id = p.pid || p.id || Math.random().toString(36).substring(2);
            const name = p.productNameEn || p.productName || p.name || "CJ Product";
            const price = Number(p.sellPrice || p.price || 0);
            let image = p.productImage || p.image || "";
            if (image && image.startsWith("//")) image = "https:" + image;
            const description = p.description || p.entryName || "Quality dropshipped product from CJ Dropshipping.";
            const available = p.quantity !== 0 && p.available !== false;

            return `
                <article class="product-card ${!available ? 'is-disabled' : ''}" data-id="${id}">
                    <div class="product-image-wrapper">
                        <img 
                            src="${image || CONFIG.FALLBACK_IMAGE}" 
                            alt="${name}" 
                            class="product-image" 
                            loading="lazy"
                            onerror="this.onerror=null; this.src='${CONFIG.FALLBACK_IMAGE}'; this.classList.add('is-fallback');"
                        />
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${name}</h3>
                        <p class="product-description">${description}</p>
                        <div class="product-bottom">
                            <span class="product-price">$${price.toFixed(2)}</span>
                            <button 
                                type="button"
                                class="add-cart-btn" 
                                data-action="add-cart" 
                                data-id="${id}"
                                ${!available ? 'disabled' : ''}>
                                ${available ? 'Add to Cart' : 'Out of Stock'}
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    function renderErrorState(message) {
        if (!DOM.productList) return;
        if (DOM.resultsCount) DOM.resultsCount.textContent = "0 products found";
        
        DOM.productList.innerHTML = `
            <div class="no-results">
                <h3>Catalog Notice</h3>
                <p>${message}</p>
            </div>
        `;
    }

    function handleAddToCart(productId, btnElement) {
        // Find product card element info or store it globally if desired
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
        }, 1200);
    }

    function initEvents() {
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener("input", (e) => {
                const query = e.target.value.trim();
                if (DOM.searchClearBtn) {
                    DOM.searchClearBtn.style.display = query ? "block" : "none";
                }

                clearTimeout(state.searchTimer);
                state.searchTimer = setTimeout(() => {
                    state.keyword = query;
                    state.pageNum = 1;
                    fetchCJProducts(query, state.pageNum);
                }, CONFIG.DEBOUNCE_DELAY_MS);
            });
        }

        if (DOM.searchClearBtn) {
            DOM.searchClearBtn.addEventListener("click", () => {
                clearTimeout(state.searchTimer);
                if (DOM.searchInput) DOM.searchInput.value = "";
                DOM.searchClearBtn.style.display = "none";
                state.keyword = "";
                state.pageNum = 1;
                fetchCJProducts("", state.pageNum);
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
        fetchCJProducts("", state.pageNum);
    });
})();
