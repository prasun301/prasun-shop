/**
 * Prasun Shop — Products & Interactivity Module
 * Production-Grade 10/10 Implementation
 */
"use strict";

(function () {
    let allProducts = [];

    // Format price cleanly
    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

    // Basic HTML escaping helper to prevent script injection / XSS
    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    document.addEventListener("DOMContentLoaded", () => {
        // -------------------------
        // Smooth Scrolling
        // -------------------------
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener("click", function (e) {
                const targetId = this.getAttribute("href");
                if (targetId && targetId !== "#") {
                    const target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: "smooth" });
                    }
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

            // Debounced Real-time Search Filter Handler for High Performance
            let searchTimeout;
            searchInput.addEventListener("input", function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const keyword = this.value.toLowerCase().trim();
                    const filteredProducts = allProducts.filter(product => {
                        const name = product.name ? product.name.toLowerCase() : "";
                        const desc = product.description ? product.description.toLowerCase() : "";
                        const cat = product.category ? product.category.toLowerCase() : "";
                        return name.includes(keyword) || desc.includes(keyword) || cat.includes(keyword);
                    });
                    displayProducts(filteredProducts);
                }, 150);
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
            const response = await fetch("data/products.json", { cache: "no-cache" });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format: products.json must contain an array.");
            }

            allProducts = data.map(item => ({
                id: item.id,
                name: String(item.name || "Unnamed Product"),
                price: Number(item.price) || 0,
                image: String(item.image || ""),
                category: String(item.category || ""),
                rating: item.rating || "5.0",
                description: String(item.description || "")
            }));

            const params = new URLSearchParams(window.location.search);
            const selectedCategory = params.get("category");

            // Highlight Active Category Pill in Navigation
            if (selectedCategory) {
                const normalizedSelectedCat = selectedCategory.toLowerCase();
                document.querySelectorAll(".flex.items-center.gap-2.overflow-x-auto a").forEach(pill => {
                    const href = pill.getAttribute("href") || "";
                    if (href.toLowerCase().includes(`category=${normalizedSelectedCat}`)) {
                        pill.className = "px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-xl shadow-xs transition-all shrink-0";
                    } else {
                        pill.className = "px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 rounded-xl transition-all shrink-0";
                    }
                });

                // Update page heading safely
                const heading = document.querySelector("h1, h2");
                if (heading) {
                    heading.textContent = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
                }
            }

            // Filter products if category is present
            let filteredProducts = allProducts;
            if (selectedCategory) {
                const normalizedSelectedCat = selectedCategory.toLowerCase();
                filteredProducts = allProducts.filter(product => 
                    product.category && product.category.toLowerCase() === normalizedSelectedCat
                );
            }

            displayProducts(filteredProducts);

        } catch (error) {
            console.error("Error loading products:", error);
            productList.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <p class="text-zinc-500 text-sm font-medium mb-4">Unable to load products at this time. Please try again later.</p>
                    <button type="button" onclick="window.location.reload()" class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-xs cursor-pointer">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // -------------------------
    // Display Products (High-Performance DOM Update & Safe Escaping)
    // -------------------------
    function displayProducts(products) {
        const productList = document.getElementById("product-list");
        if (!productList) return;

        if (!Array.isArray(products) || products.length === 0) {
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
                        src="${escapeHTML(product.image)}" 
                        alt="${escapeHTML(product.name)}"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                        onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'400\\' viewBox=\\'0 0 400 400\\'%3E%3Crect width=\\'400\\' height=\\'400\\' fill=\\'%23f4f4f5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23a1a1aa\\' font-family=\\'sans-serif\\' font-size=\\'16\\'%3ENo Image%3C/text%3E%3C/svg%3E';"
                    >
                    ${product.category ? `
                        <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-zinc-800 rounded-full shadow-xs">
                            ${escapeHTML(product.category)}
                        </span>
                    ` : ''}
                </div>

                <!-- Product Content Body -->
                <div class="p-5 flex flex-col flex-grow">
                    <div class="flex items-center justify-between text-xs text-zinc-500 mb-2">
                        <span class="flex items-center gap-1 font-medium text-amber-500">
                            ★ <span class="text-zinc-700">${escapeHTML(product.rating)}</span>
                        </span>
                        <span class="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock
                        </span>
                    </div>

                    <h3 class="text-base font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors line-clamp-1 mb-1">
                        ${escapeHTML(product.name)}
                    </h3>

                    <p class="text-xs text-zinc-500 line-clamp-2 mb-4 flex-grow">
                        ${escapeHTML(product.description)}
                    </p>

                    <!-- Footer Action & Price -->
                    <div class="flex items-center justify-between pt-4 border-t border-zinc-100 mt-auto">
                        <span class="text-lg font-bold text-zinc-900">${formatPrice(product.price)}</span>
                        <a 
                            href="product.html?id=${escapeHTML(product.id)}"
                            class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                        >
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        `).join("");
    }
})();
