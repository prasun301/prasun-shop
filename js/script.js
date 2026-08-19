/**
 * Frontend Shop Handling (script.js)
 * Manages loading initial 10 products and live CJ search integration.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Load initial 10 products on page load
  loadProducts(10);

  // 2. Bind search box input to your HTML ID: product-search
  const searchInput = document.getElementById("product-search");
  const clearBtn = document.getElementById("clear-search");

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const keyword = e.target.value.trim();

      // Show or hide clear button
      if (clearBtn) clearBtn.hidden = keyword.length === 0;

      // Debounce search requests to prevent API spam while typing
      debounceTimer = setTimeout(async () => {
        if (keyword.length > 1) {
          await searchLiveCJProducts(keyword);
        } else if (keyword.length === 0) {
          loadProducts(10); // Reset back to default 10 products
        }
      }, 400);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.hidden = true;
        loadProducts(10);
      });
    }
  }
});

async function loadProducts(size = 10) {
  const container = document.getElementById("product-list");
  const countEl = document.getElementById("results-count");
  
  if (countEl) countEl.innerText = "Loading products...";

  try {
    const response = await fetch(`/api/products?size=${size}`);
    const products = await response.json();
    
    renderProducts(products);
    if (countEl) countEl.innerText = `${products.length} products found`;
  } catch (error) {
    console.error("Failed to load products:", error);
    if (countEl) countEl.innerText = "Failed to load products.";
    if (container) {
      container.innerHTML = `
        <div class="products-empty" role="status">
          <h2>Connection Error</h2>
          <p>Could not fetch items from the backend server.</p>
        </div>
      `;
    }
  }
}

async function searchLiveCJProducts(keyword) {
  const countEl = document.getElementById("results-count");
  
  if (countEl) countEl.innerText = `Searching CJ Dropshipping for "${keyword}"...`;

  try {
    const response = await fetch(`/api/products?keyword=${encodeURIComponent(keyword)}&size=20`);
    const products = await response.json();
    
    renderProducts(products);
    if (countEl) countEl.innerText = `${products.length} results for "${keyword}"`;
  } catch (error) {
    console.error("Search error:", error);
    if (countEl) countEl.innerText = "Error searching products.";
  }
}

function renderProducts(products) {
  const container = document.getElementById("product-list");
  if (!container) return;

  if (!Array.isArray(products) || products.length === 0) {
    container.innerHTML = `
      <div class="products-empty" role="status">
        <h2>No products found</h2>
        <p>Try searching for a different keyword.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="product-card" style="border: 1px solid #e1e1e1; padding: 15px; border-radius: 8px; background: #fff; display: flex; flex-direction: column; justify-content: space-between;">
      <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;">
      <div>
        <h3 style="font-size: 15px; margin: 10px 0 5px; line-height: 1.3;">${product.name}</h3>
        <p style="font-weight: bold; color: #111; font-size: 16px; margin: 5px 0;">$${product.price.toFixed(2)}</p>
      </div>
      <a href="product.html?sku=${product.sku}" style="display: block; text-align: center; background: #111; color: #fff; padding: 10px; text-decoration: none; border-radius: 4px; margin-top: 10px; font-size: 14px;">View Product</a>
    </div>
  `).join('');
}/**
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
