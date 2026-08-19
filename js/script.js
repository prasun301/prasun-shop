/**
 * PRASUN SHOP - Frontend Logic (script.js)
 * Fully compatible with your enhanced index.html structure.
 */

let allProducts = [];
let currentCategory = "all";
let currentSearch = "";
let currentSort = "featured";

document.addEventListener("DOMContentLoaded", () => {
  initShop();
});

async function initShop() {
  await fetchProducts();
  setupEventListeners();
}

async function fetchProducts(keyword = "") {
  const container = document.getElementById("product-list");
  const countEl = document.getElementById("results-count");
  
  if (countEl) countEl.innerText = "Loading products...";

  try {
    const url = keyword ? `/api/products?keyword=${encodeURIComponent(keyword)}&size=20` : `/api/products?size=20`;
    const response = await fetch(url);
    const data = await response.json();
    
    allProducts = Array.isArray(data) ? data : [];
    filterAndRenderProducts();
  } catch (error) {
    console.error("Failed to load products:", error);
    if (countEl) countEl.innerText = "Failed to load products.";
    if (container) {
      container.innerHTML = `
        <div class="products-empty" role="status">
          <h2>Connection Error</h2>
          <p>Could not load items from the server. Please check your connection.</p>
        </div>
      `;
    }
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById("product-search");
  const clearBtn = document.getElementById("clear-search");
  const sortSelect = document.getElementById("product-sort");
  const categoryPills = document.querySelectorAll(".category-pill");

  // Search input handling with debounce
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      currentSearch = e.target.value.trim();

      if (clearBtn) {
        clearBtn.hidden = currentSearch.length === 0;
        clearBtn.setAttribute("aria-hidden", currentSearch.length === 0 ? "true" : "false");
      }

      debounceTimer = setTimeout(async () => {
        if (currentSearch.length > 1) {
          await fetchProducts(currentSearch);
        } else if (currentSearch.length === 0) {
          await fetchProducts();
        }
      }, 400);
    });
  }

  // Clear search button
  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", async () => {
      searchInput.value = "";
      currentSearch = "";
      clearBtn.hidden = true;
      clearBtn.setAttribute("aria-hidden", "true");
      await fetchProducts();
    });
  }

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      filterAndRenderProducts();
    });
  }

  // Category filter pills
  categoryPills.forEach(pill => {
    pill.addEventListener("click", (e) => {
      categoryPills.forEach(p => {
        p.classList.remove("active");
        p.setAttribute("aria-pressed", "false");
      });
      
      const target = e.currentTarget;
      target.classList.add("active");
      target.setAttribute("aria-pressed", "true");

      currentCategory = target.getAttribute("data-category") || "all";
      
      // Update heading text
      const pageHeading = document.getElementById("page-heading");
      if (pageHeading) {
        pageHeading.innerText = currentCategory === "all" ? "All Products" : currentCategory;
      }

      filterAndRenderProducts();
    });
  });
}

function filterAndRenderProducts() {
  let filtered = [...allProducts];

  // Filter by category
  if (currentCategory !== "all") {
    filtered = filtered.filter(p => 
      p.category && p.category.toLowerCase() === currentCategory.toLowerCase()
    );
  }

  // Sort products
  filtered.sort((a, b) => {
    if (currentSort === "price-low") return a.price - b.price;
    if (currentSort === "price-high") return b.price - a.price;
    if (currentSort === "rating") return (b.rating || 5) - (a.rating || 5);
    if (currentSort === "name") return a.name.localeCompare(b.name);
    return 0; // "featured" default order
  });

  renderProductGrid(filtered);
}

function renderProductGrid(products) {
  const container = document.getElementById("product-list");
  const countEl = document.getElementById("results-count");
  const liveRegion = document.getElementById("aria-live-region");

  if (countEl) {
    const countText = `${products.length} products found`;
    countEl.innerText = countText;
    if (liveRegion) liveRegion.innerText = countText;
  }

  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="products-empty" role="status">
        <h2>No products found</h2>
        <p>Try selecting a different category or search term.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-card-inner">
        <a href="product.html?sku=${product.sku}" class="product-card-link">
          <div class="product-card-image">
            <span class="product-category">${product.category || 'General'}</span>
            <img src="${product.image}" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-card-body">
            <span class="product-rating">★ ${product.rating || '5.0'}</span>
            <h3 class="product-title">${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            <div class="product-bottom">
              <span class="product-price">$${product.price.toFixed(2)}</span>
              <span class="product-view-button">View Details &rarr;</span>
            </div>
          </div>
        </a>
        <div class="product-card-actions">
          <button class="btn-add-to-cart" type="button" onclick="location.href='product.html?sku=${product.sku}'">View Product</button>
        </div>
      </div>
    </div>
  `).join('');
  
  container.removeAttribute("aria-busy");
}
