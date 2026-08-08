/**
 * Prasun Shop — Products & Interactivity Module
 * Updated to use Custom CSS Design System & LocalStorage Only
 */
"use strict";

(function () {
    let allProducts = [];
    let currentCategory = null;
    let currentKeyword = "";

    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

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
        const searchInput = document.querySelector(".product-search input, .products-search input");
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener("input", function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentKeyword = this.value.toLowerCase().trim();
                    applyFilters();
                }, 150);
            });
        }

        loadProducts();
    });

    function loadProducts() {
        const productList = document.getElementById("product-list");
        if (!productList) return;

        try {
            // Load only products added by you from localStorage
            const savedData = localStorage.getItem("products") || localStorage.getItem("prasun_products");
            const data = savedData ? JSON.parse(savedData) : [];

            if (!Array.isArray(data)) {
                throw new Error("Invalid data format in localStorage.");
            }

            allProducts = data.map(item => ({
                id: item.id || Date.now(),
                name: String(item.name || "Unnamed Product"),
                price: Number(item.price) || 0,
                image: String(item.image || ""),
                category: String(item.category || ""),
                rating: item.rating || "5.0",
                description: String(item.description || "")
            }));

            const params = new URLSearchParams(window.location.search);
            currentCategory = params.get("category");

            applyFilters();

        } catch (error) {
            console.error("Error loading products:", error);
            productList.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 64px 0; text-align: center;">
                    <p style="color: var(--color-gray-500); font-size: var(--text-sm);">No custom products found in storage.</p>
                </div>
            `;
        }
    }

    function applyFilters() {
        let filtered = allProducts;

        if (currentCategory) {
            const normalizedCat = currentCategory.toLowerCase();
            filtered = filtered.filter(product => 
                product.category && product.category.toLowerCase() === normalizedCat
            );
        }

        if (currentKeyword) {
            filtered = filtered.filter(product => {
                const name = product.name.toLowerCase();
                const desc = product.description.toLowerCase();
                const cat = product.category.toLowerCase();
                return name.includes(currentKeyword) || desc.includes(currentKeyword) || cat.includes(currentKeyword);
            });
        }

        displayProducts(filtered);
    }

    function displayProducts(products) {
        const productList = document.getElementById("product-list");
        if (!productList) return;

        if (!Array.isArray(products) || products.length === 0) {
            productList.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 64px 0; text-align: center;">
                    <p style="color: var(--color-gray-500); font-size: var(--text-sm);">You haven't added any products yet.</p>
                </div>
            `;
            return;
        }

        // Render cards using the exact class names from your CSS Design System
        productList.innerHTML = products.map(product => `
            <div class="product-card">
                <div class="product-image-wrap">
                    <img 
                        src="${escapeHTML(product.image)}" 
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                        decoding="async"
                        onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'400\\' viewBox=\\'0 0 400 400\\'%3E%3Crect width=\\'400\\' height=\\'400\\' fill=\\'%23f4f4f5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23a1a1aa\\' font-family=\\'sans-serif\\' font-size=\\'16\\'%3ENo Image%3C/text%3E%3C/svg%3E';"
                    >
                    ${product.category ? `<span class="product-category">${escapeHTML(product.category)}</span>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${escapeHTML(product.name)}</h3>
                    <p class="product-description">${escapeHTML(product.description)}</p>
                    <div class="product-bottom">
                        <span class="product-price">${formatPrice(product.price)}</span>
                        <a href="product.html?id=${encodeURIComponent(product.id)}" class="product-add-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: auto; padding: 8px 16px; margin: 0;">
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        `).join("");
    }
})();
