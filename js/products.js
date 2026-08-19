/**
 * Frontend Product Handling (js/products.js)
 * Manages rendering home products (limit 10) and live searching.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Check if we are on the homepage or products page and load initial 10 items
  const productContainer = document.getElementById("product-grid") || document.getElementById("product-list");
  if (productContainer) {
    loadProducts(10); // Pass 10 for homepage view
  }

  // Bind live search input
  const searchInput = document.querySelector("input[type='search']") || document.getElementById("searchproducts") || document.querySelector(".search-box input");
  
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const keyword = e.target.value.trim();

      debounceTimer = setTimeout(async () => {
        if (keyword.length > 1) {
          await searchLiveCJProducts(keyword);
        } else if (keyword.length === 0) {
          loadProducts(10); // Reset back to default 10 if search is cleared
        }
      }, 400); // 400ms delay to prevent typing spam
    });
  }
});

async function loadProducts(size = 10) {
  const container = document.getElementById("product-grid") || document.getElementById("product-list");
  const loadingEl = document.getElementById("loading") || document.getElementById("status-message");
  
  if (loadingEl) loadingEl.innerText = "Loading products...";

  try {
    const response = await fetch(`/api/products?size=${size}`);
    const products = await response.json();
    
    renderProducts(products);
    if (loadingEl) loadingEl.innerText = "";
  } catch (error) {
    console.error("Failed to load products:", error);
    if (loadingEl) loadingEl.innerText = "Failed to load products.";
  }
}

async function searchLiveCJProducts(keyword) {
  const loadingEl = document.getElementById("loading") || document.getElementById("status-message");
  if (loadingEl) loadingEl.innerText = `Searching CJ Dropshipping for "${keyword}"...`;

  try {
    const response = await fetch(`/api/products?keyword=${encodeURIComponent(keyword)}&size=20`);
    const products = await response.json();
    
    renderProducts(products);
    if (loadingEl) loadingEl.innerText = products.length === 0 ? "No products found." : "";
  } catch (error) {
    console.error("Search error:", error);
    if (loadingEl) loadingEl.innerText = "Error searching products.";
  }
}

function renderProducts(products) {
  const container = document.getElementById("product-grid") || document.getElementById("product-list");
  if (!container) return;

  if (!Array.isArray(products) || products.length === 0) {
    container.innerHTML = "<p>No products available.</p>";
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="product-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px; border-radius: 8px; max-width: 220px; display: inline-block; vertical-align: top; background: #fff;">
      <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 4px;">
      <h4 style="font-size: 14px; margin: 10px 0 5px; height: 40px; overflow: hidden;">${product.name}</h4>
      <p style="font-weight: bold; color: #2c3e50; margin: 5px 0;">$${product.price.toFixed(2)}</p>
      <a href="product.html?sku=${product.sku}" style="display: block; text-align: center; background: #000; color: #fff; padding: 8px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Product</a>
    </div>
  `).join('');
}/**
 * products.js - Prasun Shop Catalog & Live CJ Dropshipping API Manager
 */
(function () {
    "use strict";

    const CONFIG = {
        CART_KEY: "prasun_cart_items",
        API_ENDPOINT: "/api/products", // Connects to your backend server proxying CJ Dropshipping API
        FALLBACK_IMAGE: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'%3ENo CJ Image Available%3C/text%3E%3C/svg%3E"
    };

    let state = {
        searchTimer: null,
        allProducts: []
    };

    const DOM = {
        productList: null,
        searchInput: null,
        resultsCount: null,
        cartBadge: null
    };

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

    // Fetch Live Products from Backend/CJ Dropshipping API
    async function fetchLiveCatalog() {
        if (!DOM.productList) return;

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = "Fetching live products from CJ Dropshipping...";
        }

        try {
            const response = await fetch(CONFIG.API_ENDPOINT);
            if (!response.ok) {
                throw new Error("Failed to load products from API server.");
            }

            const data = await response.json();
            
            // Extract array safely depending on your backend response structure
            const rawList = data.data?.list || data.list || data.data || data;

            if (!Array.isArray(rawList)) {
                throw new Error("Invalid product data format received.");
            }

            // Map data accurately to live properties
            state.allProducts = rawList.map(p => ({
                pid: p.pid || p.id,
                productNameEn: p.productNameEn || p.productName || p.title || "Untitled Product",
                sellPrice: Number(p.sellPrice || p.price || 0),
                description: p.description || p.productDescription || "No description provided.",
                productImage: p.productImage || p.image || ""
            }));

            loadProducts(""); // Render full list initially
        } catch (error) {
            console.error("CJ API Error:", error);
            if (DOM.productList) {
                DOM.productList.innerHTML = `
                    <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <h3>Catalog Temporarily Unavailable</h3>
                        <p>Could not fetch live items from CJ Dropshipping. Please check your backend configuration.</p>
                    </div>
                `;
            }
            if (DOM.resultsCount) {
                DOM.resultsCount.textContent = "Error loading live products";
            }
        }
    }

    // Filter and Render Catalog Items
    function loadProducts(keyword = "") {
        if (!DOM.productList) return;

        const query = keyword.toLowerCase().trim();
        const filtered = query 
            ? state.allProducts.filter(p => 
                p.productNameEn.toLowerCase().includes(query) || 
                p.description.toLowerCase().includes(query)
              )
            : state.allProducts;

        renderProducts(filtered);

        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = `Showing ${filtered.length} of ${state.allProducts.length} live products`;
        }
    }

    function renderProducts(products) {
        if (!DOM.productList) return;

        if (!products || products.length === 0) {
            DOM.productList.innerHTML = `
                <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h3>No Products Found</h3>
                    <p>No live products match your search criteria. Try a different keyword.</p>
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
        fetchLiveCatalog(); // Triggers real API data fetch on page load
    });
})();
