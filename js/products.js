/**
 * Prasun Shop — Products Page Module
 * Production-Grade Implementation with User Products & Google-Style Search
 */
"use strict";

(function () {
    // Inject custom styles for Google-style search box, font inheritance, and layout cleanup
    const styleId = "prasun-custom-overrides";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            /* Inherit exact home page font */
            body, .product-card, .products-header, .products-categories, .product-search-container {
                font-family: inherit !important;
            }

            /* Google-style search box enhancement */
            .product-search-container, #product-search-form {
                max-width: 600px;
                margin: 0 auto 2rem auto;
                width: 100%;
            }

            #product-search-form {
                display: flex;
                align-items: center;
                background: #ffffff;
                border: 1px solid #dfe1e5;
                border-radius: 24px;
                padding: 4px 16px;
                box-shadow: 0 1px 6px rgba(32, 33, 36, 0.08);
                transition: all 0.2s ease;
            }

            #product-search-form:hover, #product-search-form:focus-within {
                box-shadow: 0 2px 12px rgba(32, 33, 36, 0.16);
                border-color: rgba(223, 225, 229, 0);
            }

            #product-search-form svg, #product-search-form .search-icon {
                width: 20px;
                height: 20px;
                color: #5f6368;
                margin-right: 12px;
                flex-shrink: 0;
            }

            #product-search {
                border: none !important;
                outline: none !important;
                background: transparent !important;
                font-size: 16px;
                width: 100%;
                padding: 10px 0;
                color: #202124;
                box-shadow: none !important;
            }

            #product-search::placeholder {
                color: #80868b;
            }

            .search-shortcut-badge {
                background: #f1f3f4;
                color: #5f6368;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                border: 1px solid #dadce0;
                margin-left: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // Remove unwanted subtitle text if present in DOM
    document.addEventListener("DOMContentLoaded", () => {
        const headerSubtitles = document.querySelectorAll(".products-header p, .products-subtitle");
        headerSubtitles.forEach(el => {
            if (el.textContent.includes("Discover premium digital products")) {
                el.remove();
            }
        });
    });

    // DOM Elements
    const productGrid = document.getElementById("product-list");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("product-search");
    const searchForm = document.getElementById("product-search-form");
    const productTemplate = document.getElementById("product-card-template");
    const skeletonTemplate = document.getElementById("skeleton-template");
    const categoryContainer = document.querySelector(".products-categories");
    const categoryLinks = document.querySelectorAll(".category-pill");
    const productCount = document.getElementById("products-count");
    const productSort = document.getElementById("product-sort");
    const cartCount = document.getElementById("cart-count");
    const menuToggle = document.getElementById("products-menu-toggle");
    const mobileMenu = document.getElementById("products-mobile-menu");
    const emptyResetBtn = document.getElementById("empty-reset-btn");

    // State
    let products = [];
    let currentCategory = "all";
    let currentSearch = "";
    let currentSort = "featured";
    let loadSequence = 0;

    const CART_KEY = "prasunShopCart";

    // Your exact products dataset as the primary/fallback dataset
    const FALLBACK_PRODUCTS = [
        {
            id: "001",
            sku: "CJSN188416414NM",
            name: "G-Shaped Smart LED Atmosphere Lamp with Bluetooth Speaker & Wireless Charger",
            category: "Smart Lighting",
            price: 29.99,
            image: "images/products/10_57d942b5-c025-425a-a8a4-d87c6a612631.png",
            description: "Upgrade your living space with this multifunctional G-shaped Smart LED Atmosphere Lamp. It combines stylish lighting, Bluetooth music, wireless charging, alarm clock, and smart control features in one modern device.",
            features: [
                "15W fast wireless charging",
                "Built-in Bluetooth speaker",
                "RGB atmosphere lighting",
                "APP, voice, remote and button control"
            ],
            specifications: {
                "Material": "Plastic",
                "Product Type": "Electronic Smart Lamp",
                "Wireless Charging": "15W"
            },
            rating: 5
        },
        {
            id: "002",
            sku: "CJCD135893009IR",
            name: "Mini 5000mAh Magnetic Wireless Power Bank Fast Charging Portable Battery",
            category: "Power & Charging",
            price: 39.99,
            image: "images/products/1_d000e27d-654f-42a9-a69e-fa741145c989.jpg",
            description: "Stay powered wherever you go with this compact 5000mAh Magnetic Wireless Power Bank. Designed with strong magnetic attachment and fast charging capability.",
            features: [
                "5000mAh battery capacity",
                "Strong magnetic wireless charging",
                "LED battery display",
                "Compact and travel-friendly design"
            ],
            specifications: {
                "Material": "Plastic",
                "Capacity": "5000mAh",
                "Wireless Charging": "5W"
            },
            rating: 5
        },
        {
            id: "003",
            sku: "CJYP270967903CX",
            name: "High-Quality Noise Cancelling Wireless Bluetooth Sports Earbuds",
            category: "Audio",
            price: 49.99,
            image: "images/products/1_6c876bad-b1e0-4d44-9c62-e7c1d9daadb1_trans.jpeg",
            description: "Experience clear and immersive sound with these stylish Noise Cancelling Wireless Bluetooth Sports Earbuds designed for sports, travel, and everyday listening.",
            features: [
                "Noise cancellation technology",
                "Bluetooth wireless connection",
                "Water-resistant design",
                "Low-latency gaming mode"
            ],
            specifications: {
                "Material": "PC + ABS",
                "Battery Life": "4-8 hours"
            },
            rating: 5
        }
    ];

    // Helpers
    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function slugifyCategory(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

    function getCategoryFromURL() {
        const params = new URLSearchParams(window.location.search);
        return normalize(params.get("category") || "all");
    }

    currentCategory = getCategoryFromURL();

    function updateActiveCategory() {
        categoryLinks.forEach(link => {
            const href = link.getAttribute("href") || "";
            const cat = normalize(link.dataset.category || new URLSearchParams(href.split("?")[1] || "").get("category") || "all");
            const active = cat === normalize(currentCategory) || slugifyCategory(cat) === slugifyCategory(currentCategory);
            link.classList.toggle("active", active);
            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    // Cart Architecture
    function getCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            return true;
        } catch (error) {
            return false;
        }
    }

    function updateCartCount() {
        if (!cartCount) return;
        const cart = getCart();
        const total = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
        cartCount.textContent = String(total);
        cartCount.hidden = total === 0;
    }

    function addToCart(productId) {
        const product = products.find(item => String(item.id) === String(productId));
        if (!product) return;

        const cart = getCart();
        const existing = cart.find(item => String(item.id) === String(product.id));
        if (existing) {
            existing.quantity = (Number(existing.quantity) || 1) + 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                image: product.image || "",
                category: product.category || "",
                quantity: 1
            });
        }

        if (saveCart(cart)) {
            updateCartCount();
            showCartFeedback(product.id);
        }
    }

    function showCartFeedback(productId) {
        if (!productGrid) return;
        const buttons = productGrid.querySelectorAll('[data-action="cart"]');
        buttons.forEach(button => {
            if (String(button.dataset.id) !== String(productId)) return;
            const span = button.querySelector("span") || button;
            const originalText = span.textContent;
            span.textContent = "Added ✓";
            button.classList.add("is-added");
            button.disabled = true;
            setTimeout(() => {
                span.textContent = originalText;
                button.classList.remove("is-added");
                button.disabled = false;
            }, 1200);
        });
    }

    function showSkeletons() {
        if (!productGrid) return;
        productGrid.setAttribute("aria-busy", "true");
        if (skeletonTemplate) {
            productGrid.innerHTML = "";
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 3; i++) {
                fragment.appendChild(skeletonTemplate.content.cloneNode(true));
            }
            productGrid.appendChild(fragment);
        }
    }

    function showEmptyState() {
        if (emptyState) emptyState.classList.remove("hidden");
    }

    function hideEmptyState() {
        if (emptyState) emptyState.classList.add("hidden");
    }

    function hideErrorState() {
        const errEl = document.getElementById("error-state");
        if (errEl) errEl.classList.add("hidden");
    }

    // Product Card Creation
    function createProductCard(product) {
        const productId = product.id !== undefined && product.id !== null ? String(product.id) : "";

        if (!productTemplate) {
            const article = document.createElement("article");
            article.className = "product-card";
            if (productId) article.dataset.id = productId;
            article.dataset.category = product.category || "";

            article.innerHTML = `
                <a class="product-card-link" href="product.html?id=${encodeURIComponent(productId)}">
                    <div class="product-card-image">
                        <img src="${product.image || ""}" alt="${product.name ? `Image of ${product.name}` : "Product image"}" loading="lazy">
                    </div>
                </a>
                <div class="product-card-body">
                    <p class="product-category">${product.category ? String(product.category).toUpperCase() : "GENERAL"}</p>
                    <h2 class="product-title">${product.name || "Untitled Product"}</h2>
                    <p class="product-description">${product.description || ""}</p>
                    <div class="product-bottom">
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <button type="button" class="product-cart-button" data-action="cart" data-id="${productId}" aria-label="Add to cart">
                            <span>Add to Cart</span>
                        </button>
                    </div>
                </div>
            `;
            return article;
        }

        const fragment = productTemplate.content.cloneNode(true);
        const article = fragment.querySelector(".product-card") || fragment.querySelector("article");
        const link = fragment.querySelector(".product-card-link") || fragment.querySelector("a");
        const image = fragment.querySelector("img");
        const category = fragment.querySelector(".product-category");
        const title = fragment.querySelector(".product-title");
        const description = fragment.querySelector(".product-description");
        const price = fragment.querySelector(".product-price");
        const button = fragment.querySelector(".product-cart-button") || fragment.querySelector('[data-action="cart"]');

        if (link && productId) {
            link.href = `product.html?id=${encodeURIComponent(productId)}`;
        }

        if (image) {
            image.src = product.image || "";
            image.alt = product.name ? `Image of ${product.name}` : "Product image";
            image.loading = "lazy";
            image.onerror = function () {
                this.onerror = null;
                this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180' viewBox='0 0 240 180'%3E%3Crect width='240' height='180' fill='%23f4f4f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23a1a1aa' font-family='sans-serif' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
            };
        }

        if (category) {
            category.textContent = product.category ? String(product.category).toUpperCase() : "GENERAL";
        }
        if (title) {
            title.textContent = product.name || "Untitled Product";
        }
        if (description) {
            description.textContent = product.description || "";
        }
        if (price) {
            price.textContent = formatPrice(product.price);
        }

        if (button && productId) {
            button.dataset.id = productId;
            button.dataset.action = "cart";
        }

        return fragment;
    }

    // Filtering, Search & Sorting
    function getVisibleProducts() {
        let result = products.map((item, index) => ({ item, index }));

        if (normalize(currentCategory) !== "all") {
            result = result.filter(({ item }) => {
                const itemCatSlug = slugifyCategory(item.category);
                const currentCatSlug = slugifyCategory(currentCategory);
                return itemCatSlug === currentCatSlug || normalize(item.category) === normalize(currentCategory);
            });
        }

        const keyword = currentSearch.trim().toLowerCase();
        if (keyword) {
            result = result.filter(({ item }) => {
                const name = normalize(item.name);
                const category = normalize(item.category);
                const description = normalize(item.description);
                return name.includes(keyword) || category.includes(keyword) || description.includes(keyword);
            });
        }

        if (currentSort === "price-low") {
            result.sort((a, b) => (Number(a.item.price) || 0) - (Number(b.item.price) || 0));
        } else if (currentSort === "price-high") {
            result.sort((a, b) => (Number(b.item.price) || 0) - (Number(a.item.price) || 0));
        } else if (currentSort === "name") {
            result.sort((a, b) => String(a.item.name || "").localeCompare(String(b.item.name || "")));
        }

        return result.map(({ item }) => item);
    }

    function renderProducts() {
        if (!productGrid) return;
        productGrid.setAttribute("aria-busy", "false");
        hideErrorState();

        const visibleProducts = getVisibleProducts();

        if (productCount) {
            productCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "product" : "products"} found`;
        }

        if (!visibleProducts.length) {
            productGrid.innerHTML = "";
            showEmptyState();
            return;
        }

        hideEmptyState();
        productGrid.innerHTML = "";

        const fragment = document.createDocumentFragment();
        visibleProducts.forEach(product => {
            fragment.appendChild(createProductCard(product));
        });
        productGrid.appendChild(fragment);
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const handleSearchInput = debounce(event => {
        currentSearch = event.target.value;
        renderProducts();
    }, 200);

    // Event Listeners
    if (categoryContainer) {
        categoryContainer.addEventListener("click", event => {
            const pill = event.target.closest(".category-pill");
            if (!pill) return;
            event.preventDefault();

            if (searchInput) searchInput.value = "";
            currentSearch = "";

            const cat = pill.dataset.category || new URLSearchParams((pill.getAttribute("href") || "").split("?")[1] || "").get("category") || "all";
            currentCategory = normalize(cat);

            const newUrl = currentCategory === "all" ? "products.html" : `products.html?category=${encodeURIComponent(currentCategory)}`;
            history.pushState({ category: currentCategory }, "", newUrl);

            updateActiveCategory();
            renderProducts();
        });
    }

    window.addEventListener("popstate", () => {
        if (searchInput) searchInput.value = "";
        currentSearch = "";
        currentCategory = getCategoryFromURL();
        updateActiveCategory();
        renderProducts();
    });

    if (searchInput) {
        searchInput.addEventListener("input", handleSearchInput);
    }

    if (searchForm) {
        searchForm.addEventListener("submit", event => event.preventDefault());
    }

    if (emptyResetBtn) {
        emptyResetBtn.addEventListener("click", event => {
            event.preventDefault();
            currentCategory = "all";
            currentSearch = "";
            if (searchInput) searchInput.value = "";
            history.pushState({ category: "all" }, "", "products.html");
            updateActiveCategory();
            renderProducts();
        });
    }

    if (productSort) {
        productSort.addEventListener("change", event => {
            currentSort = event.target.value;
            renderProducts();
        });
    }

    if (productGrid) {
        productGrid.addEventListener("click", event => {
            const button = event.target.closest('[data-action="cart"]');
            if (!button) return;
            event.preventDefault();
            const productId = button.dataset.id;
            if (productId) addToCart(productId);
        });
    }

    // Load Products
    async function loadProducts() {
        const currentSequence = ++loadSequence;
        try {
            showSkeletons();
            hideErrorState();

            let data = null;
            const pathsToTry = ["data/products.json", "products.json"];

            for (const path of pathsToTry) {
                try {
                    const response = await fetch(path, { cache: "no-cache" });
                    if (response.ok) {
                        data = await response.json();
                        break;
                    }
                } catch (e) {
                    // Try next path
                }
            }

            if (currentSequence !== loadSequence) return;

            if (!Array.isArray(data) || data.length === 0) {
                data = FALLBACK_PRODUCTS;
            }

            products = data;
            currentCategory = getCategoryFromURL();
            updateActiveCategory();
            renderProducts();
            updateCartCount();
        } catch (error) {
            if (currentSequence !== loadSequence) return;
            products = FALLBACK_PRODUCTS;
            currentCategory = getCategoryFromURL();
            updateActiveCategory();
            renderProducts();
            updateCartCount();
        }
    }

    // Initialization
    updateCartCount();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadProducts);
    } else {
        loadProducts();
    }
})();
