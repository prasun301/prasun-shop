/**
 * Frontend Shop Handling (script.js)
 * Clean version using stylesheet classes instead of conflicting inline styles.
 */

document.addEventListener("DOMContentLoaded", () => {
  loadProducts(10);

  const searchInput = document.getElementById("product-search");
  const clearBtn = document.getElementById("clear-search");

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const keyword = e.target.value.trim();

      if (clearBtn) clearBtn.hidden = keyword.length === 0;

      debounceTimer = setTimeout(async () => {
        if (keyword.length > 1) {
          await searchLiveCJProducts(keyword);
        } else if (keyword.length === 0) {
          loadProducts(10);
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
  }
}

async function searchLiveCJProducts(keyword) {
  const countEl = document.getElementById("results-count");
  if (countEl) countEl.innerText = `Searching products for "${keyword}"...`;

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

  // Uses clean structural HTML matching your stylesheet class names
  container.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-card-inner">
        <a href="product.html?sku=${product.sku}" class="product-card-link">
          <div class="product-card-image">
            <span class="product-category">${product.category || 'General'}</span>
            <img src="${product.image}" alt="${product.name}">
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
          <button class="btn-add-to-cart" onclick="location.href='product.html?sku=${product.sku}'">View Product</button>
        </div>
      </div>
    </div>
  `).join('');
}
