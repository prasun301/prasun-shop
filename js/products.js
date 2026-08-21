/**
 * PRASUN SHOP Frontend - products.js
 * Architecture: Curated Snapshot Consumer
 */

const API_BASE = "https://prasun-shop-api.prasun301.workers.dev";
let allLoadedProducts = [];

// DOM Elements
const productGrid = document.getElementById("product-grid");
const categoryLinks = document.querySelectorAll(".category-link");
const searchInput = document.getElementById("search-input");
const loadingIndicator = document.getElementById("loading-indicator");

document.addEventListener("DOMContentLoaded", () => {
  initCatalog();
});

async function initCatalog() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/api/products`);
    const data = await response.json();

    if (!data.success) {
      if (data.code === "CATALOG_EMPTY") {
        renderError(`Store catalog is currently empty. Backend diagnostic: ${data.message}`);
      } else {
        renderError("Failed to load products from server.");
      }
      return;
    }

    allLoadedProducts = data.products || [];
    
    // Initial render - All Products
    renderProducts(allLoadedProducts, "All Products");
    setupEventListeners();

  } catch (error) {
    console.error("Catalog initialization error:", error);
    renderError("A network error occurred while loading the catalog.");
  } finally {
    showLoading(false);
  }
}

function setupEventListeners() {
  // Category clicks
  categoryLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Update active state
      categoryLinks.forEach(l => l.classList.remove("active"));
      e.target.classList.add("active");
      
      const selectedCategory = e.target.dataset.category; // e.g., "solar-lights", "all"
      const categoryName = e.target.innerText;
      
      filterByCategory(selectedCategory, categoryName);
    });
  });

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = allLoadedProducts.filter(p => 
        (p.productName || "").toLowerCase().includes(query) ||
        (p.categoryName || "").toLowerCase().includes(query)
      );
      renderProducts(filtered, query ? `Search results for "${query}"` : "All Products");
    });
  }
}

function filterByCategory(categoryId, categoryName) {
  if (categoryId === "all" || !categoryId) {
    renderProducts(allLoadedProducts, "All Products");
    return;
  }

  // The backend already categorized the products into p.storeCategories array
  const filtered = allLoadedProducts.filter(p => 
    p.storeCategories && p.storeCategories.includes(categoryId)
  );

  renderProducts(filtered, categoryName);
}

function renderProducts(productsArray, contextText = "") {
  if (!productGrid) return;

  productGrid.innerHTML = "";

  if (productsArray.length === 0) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <h3>No products found for ${contextText}</h3>
        <p>Please try a different category or search term.</p>
      </div>`;
    return;
  }

  productsArray.forEach(product => {
    const id = product.pid || product.id;
    const title = product.productName || "Unknown Product";
    const price = parseFloat(product.sellPrice || product.price || 0).toFixed(2);
    
    // Route image through our Worker proxy
    const rawImg = product.productImage || "";
    const imgUrl = rawImg ? `${API_BASE}/api/image-proxy?url=${encodeURIComponent(rawImg)}` : "/placeholder.png";

    const card = document.createElement("div");
    card.className = "product-card";
    
    // Sanitize title for HTML insertion
    const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${imgUrl}" alt="${safeTitle}" loading="lazy" />
      </div>
      <div class="product-info">
        <h4 class="product-title" title="${safeTitle}">${safeTitle}</h4>
        <div class="product-price">$${price}</div>
        <button class="btn-add-cart" onclick="addToCart('${id}')">View Details</button>
      </div>
    `;
    
    productGrid.appendChild(card);
  });
}

function showLoading(isVisible) {
  if (loadingIndicator) {
    loadingIndicator.style.display = isVisible ? "block" : "none";
  }
}

function renderError(message) {
  if (productGrid) {
    productGrid.innerHTML = `<div class="error-state"><h3>Error</h3><p>${message}</p></div>`;
  }
}

// Keeping addToCart stub for existing integration
window.addToCart = window.addToCart || function(productId) {
  console.log("Existing addToCart logic triggered for:", productId);
  // Modal / order logic continues here
};
