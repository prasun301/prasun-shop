// =====================================
// Prasun Shop - Products & Interactivity
// =====================================

let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------
    // Smooth Scrolling
    // -------------------------
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    // -------------------------
    // Global Keyboard Shortcut (⌘K / Ctrl+K)
    // -------------------------
    const searchInput = document.querySelector(".search-input");
    if (searchInput) {
        document.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });

        // Real-time Search Filter Handler
        searchInput.addEventListener("input", function() {
            const keyword = this.value.toLowerCase().trim();
            const filteredProducts = allProducts.filter(product =>
                product.name.toLowerCase().includes(keyword) || 
                (product.description && product.description.toLowerCase().includes(keyword)) ||
                (product.category && product.category.toLowerCase().includes(keyword))
            );
            displayProducts(filteredProducts);
        });
    }

    // -------------------------
    // Load Products & Category Filtering
    // -------------------------
    loadProducts();
});

async function loadProducts() {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    try {
        const response = await fetch("data/products.json");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allProducts = await response.json();

        const params = new URLSearchParams(window.location.search);
        const selectedCategory = params.get("category");

        // Highlight Active Category Pill in Navigation
        if (selectedCategory) {
            document.querySelectorAll(".flex.items-center.gap-2.overflow-x-auto a").forEach(pill => {
                const href = pill.getAttribute("href") || "";
                if (href.toLowerCase().includes(`category=${selectedCategory.toLowerCase()}`)) {
                    pill.className = "px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-xl shadow-xs transition-all shrink-0";
                } else {
                    pill.className = "px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 rounded-xl transition-all shrink-0";
                }
            });

            // Update page heading
            const heading = document.querySelector("h1, h2");
            if (heading) {
                heading.textContent = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
            }
        }

        // Filter products if category is present
        let filteredProducts = allProducts;
        if (selectedCategory) {
            filteredProducts = allProducts.filter(product => 
                product.category && product.category.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        displayProducts(filteredProducts);

    } catch (error) {
        console.error("Error loading products:", error);
        productList.innerHTML = `
            <div class="col-span-full py-16 text-center text-zinc-500 text-sm font-medium">
                Unable to load products at this time. Please try again later.
            </div>
        `;
    }
}

// -------------------------
// Display Products (High-Performance DOM Update)
// -------------------------
function displayProducts(products) {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    if (products.length === 0) {
        productList.innerHTML = `
            <div class="col-span-full py-16 text-center">
                <p class="text-zinc-500 text-sm font-medium">No products found matching your search or category.</p>
            </div>
        `;
        return;
    }

    // Render all cards in a single DOM write operation for high performance
    productList.innerHTML = products.map(product => `
        <div class="group bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col">
            <!-- Product Image Container -->
            <div class="aspect-square bg-zinc-100 overflow-hidden relative">
                <img 
                    src="${product.image}" 
                    alt="${product.name}"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                >
                ${product.category ? `
                    <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-zinc-800 rounded-full shadow-xs">
                        ${product.category}
                    </span>
                ` : ''}
            </div>

            <!-- Product Content Body -->
            <div class="p-5 flex flex-col flex-grow">
                <div class="flex items-center justify-between text-xs text-zinc-500 mb-2">
                    <span class="flex items-center gap-1 font-medium text-amber-500">
                        ★ <span class="text-zinc-700">${product.rating || "5.0"}</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                    </span>
                </div>

                <h3 class="text-base font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors line-clamp-1 mb-1">
                    ${product.name}
                </h3>

                <p class="text-xs text-zinc-500 line-clamp-2 mb-4 flex-grow">
                    ${product.description}
                </p>

                <!-- Footer Action & Price -->
                <div class="flex items-center justify-between pt-4 border-t border-zinc-100 mt-auto">
                    <span class="text-lg font-bold text-zinc-900">$${product.price.toFixed(2)}</span>
                    <button 
                        onclick="window.location.href='product.html?id=${product.id}'"
                        class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                    >
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `).join("");
}
