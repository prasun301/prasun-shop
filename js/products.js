/**
 * PRASUN SHOP — Products Manager (js/products.js)
 * Handles API product fetching, dynamic rendering, live searching, 
 * category filtering, sorting, and cart integration.
 */

const CONFIG = {
  API_BASE: "https://prasun-shop-api.prasunbarua-dev.workers.dev"
};

// Store State
const state = {
  products: [],
  filteredProducts: [],
  activeCategory: "all",
  searchQuery: "",
  sortBy: "featured"
};

// Cached Elements
let elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDOMElements();
  initEventListeners();
  loadProducts();
});

function cacheDOMElements() {
  elements = {
    productList: document.getElementById("product-list"),
    resultsCount: document.getElementById("results-count"),
    searchInput: document.getElementById("product-search"),
    clearSearchBtn: document.getElementById("clear-search"),
    sortSelect: document.getElementById("product-sort"),
    categoriesNav: document.getElementById("products-categories"),
    pageHeading: document.getElementById("page-heading"),
    liveRegion: document.getElementById("aria-live-region")
  };
}

function initEventListeners() {
  // Search Input Handler
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      toggleClearSearchBtn();
      applyFiltersAndRender();
    });
  }

  // Clear Search Button Handler
  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener("click", () => {
      if (elements.searchInput) {
        elements.searchInput.value = "";
        elements.searchInput.focus();
      }
      state.searchQuery = "";
      toggleClearSearchBtn();
      applyFiltersAndRender();
    });
  }

  // Sort Selector Handler
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      applyFiltersAndRender();
    });
  }
}

function toggleClearSearchBtn() {
  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.hidden = state.searchQuery.length === 0;
  }
}

async function loadProducts() {
  try {
    setLoadingState(true);
    const response = await fetch(`${CONFIG.API_BASE}/api/products`);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    
    // Support either direct array or object payload with products key
    state.products = Array.isArray(data) ? data : (data.products || []);

    if (state.products.length === 0) {
      renderEmptyState("No products are currently available.");
      return;
    }

    renderCategoryPills();
    applyFiltersAndRender();

  } catch (error) {
    console.error("[PRASUN SHOP] Failed to fetch products:", error);
    renderErrorState("Unable to load store products. Please check your network connection and try again.");
  } finally {
    setLoadingState(false);
  }
}

function renderCategoryPills() {
  if (!elements.categoriesNav) return;

  // Extract unique categories from product payload
  const categories = ["all"];
  state.products.forEach(product => {
    if (product.category && !categories.includes(product.category.toLowerCase())) {
      categories.push(product.category.toLowerCase());
    }
  });

  elements.categoriesNav.innerHTML = categories.map(cat => {
    const isSelected = cat === state.activeCategory;
    const label = cat === "all" ? "All" : capitalize(cat);
    return `
      <button
        type="button"
        class="category-pill ${isSelected ? 'active' : ''}"
        data-category="${escapeHtml(cat)}"
        aria-pressed="${isSelected}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }).join("");

  // Event delegation for category pill clicks
  elements.categoriesNav.onclick = (e) => {
    const pill = e.target.closest(".category-pill");
    if (!pill) return;

    const category = pill.dataset.category;
    if (category && category !== state.activeCategory) {
      state.activeCategory = category;

      // Update pill classes and ARIA states
      elements.categoriesNav.querySelectorAll(".category-pill").forEach(btn => {
        const active = btn.dataset.category === state.activeCategory;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });

      if (elements.pageHeading) {
        elements.pageHeading.textContent = category === "all" ? "All Products" : capitalize(category);
      }

      applyFiltersAndRender();
    }
  };
}

function applyFiltersAndRender() {
  let result = [...state.products];

  // 1. Filter by Category
  if (state.activeCategory !== "all") {
    result = result.filter(p => (p.category || "").toLowerCase() === state.activeCategory);
  }

  // 2. Filter by Search Input
  if (state.searchQuery) {
    result = result.filter(p => {
      const title = (p.title || p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      return title.includes(state.searchQuery) || desc.includes(state.searchQuery) || cat.includes(state.searchQuery);
    });
  }

  // 3. Sort Results
  result.sort((a, b) => {
    const priceA = parseFloat(a.price) || 0;
    const priceB = parseFloat(b.price) || 0;
    const nameA = (a.title || a.name || "").toLowerCase();
    const nameB = (b.title || b.name || "").toLowerCase();
    const ratingA = typeof a.rating === 'object' ? (a.rating?.rate || 0) : (parseFloat(a.rating) || 0);
    const ratingB = typeof b.rating === 'object' ? (b.rating?.rate || 0) : (parseFloat(b.rating) || 0);

    switch (state.sortBy) {
      case "price-low":
        return priceA - priceB;
      case "price-high":
        return priceB - priceA;
      case "rating":
        return ratingB - ratingA;
      case "name-az":
        return nameA.localeCompare(nameB);
      case "featured":
      default:
        return 0;
    }
  });

  state.filteredProducts = result;
  renderProductGrid();
  updateResultsCount();
}

function renderProductGrid() {
  if (!elements.productList) return;

  if (state.filteredProducts.length === 0) {
    renderEmptyState("No products match your criteria.");
    return;
  }

  elements.productList.innerHTML = state.filteredProducts.map(product => renderProductCard(product)).join("");
}

function renderProductCard(product) {
  const id = escapeHtml(String(product.id));
  const title = escapeHtml(product.title || product.name || "Product");
  const price = formatPrice(product.price);
  const image = escapeHtml(product.image || "/images/placeholder.webp");
  const rating = typeof product.rating === 'object' ? (product.rating?.rate || 0) : (parseFloat(product.rating) || 0);

  return `
    <article class="product-card" data-id="${id}">
      <div class="product-card-image">
        <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='/images/placeholder.webp'">
      </div>
      <div class="product-card-body">
        <span class="product-category">${escapeHtml(product.category || 'General')}</span>
        <h3 class="product-title">${title}</h3>
        ${rating > 0 ? `<div class="product-rating" aria-label="Rating: ${rating} out of 5">★ ${rating.toFixed(1)}</div>` : ''}
        <div class="product-card-footer">
          <span class="product-price">${price}</span>
          <button
            type="button"
            class="button button-primary add-to-cart-btn"
            onclick="handleAddToCart('${id}')"
            aria-label="Add ${title} to cart"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `;
}

function updateResultsCount() {
  const count = state.filteredProducts.length;
  const countText = `${count} ${count === 1 ? 'product' : 'products'} found`;

  if (elements.resultsCount) {
    elements.resultsCount.textContent = countText;
  }

  announceToScreenReader(countText);
}

function setLoadingState(isLoading) {
  if (elements.productList) {
    elements.productList.setAttribute("aria-busy", isLoading ? "true" : "false");
  }
}

function renderEmptyState(message) {
  if (!elements.productList) return;

  elements.productList.innerHTML = `
    <div class="product-status-card products-empty" role="status">
      <h3>No Products Found</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  if (elements.resultsCount) {
    elements.resultsCount.textContent = "0 products";
  }

  announceToScreenReader(message);
}

function renderErrorState(message) {
  if (!elements.productList) return;

  elements.productList.innerHTML = `
    <div class="product-status-card products-error" role="alert">
      <h3>Error Loading Store</h3>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="button" onclick="loadProducts()">Try Again</button>
    </div>
  `;

  if (elements.resultsCount) {
    elements.resultsCount.textContent = "Error";
  }

  announceToScreenReader("Error loading products");
}

// Global hook triggered by 'Add to Cart' buttons
window.handleAddToCart = function(productId) {
  const product = state.products.find(p => String(p.id) === String(productId));
  if (!product) return;

  if (typeof window.addToCart === "function") {
    window.addToCart(product);
  } else {
    document.dispatchEvent(new CustomEvent("cart:add", { detail: product }));
  }

  announceToScreenReader(`Added ${product.title || product.name} to cart`);
};

// Utilities
function formatPrice(amount) {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(val);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function announceToScreenReader(message) {
  if (elements.liveRegion) {
    elements.liveRegion.textContent = message;
  }
}
