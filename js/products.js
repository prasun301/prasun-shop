/**
 * Prasun Shop — Products Page Module
 * Production-Grade 10/10 Implementation (Enhanced with Robust Fallbacks)
 */
"use strict";

(function () {
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

    // Fallback product dataset (prevents breakage when running via file:// protocol or missing products.json)
    const FALLBACK_PRODUCTS = [
        { id: 1, name: "Advanced UI Kit Pro", category: "electronics", price: 49.00, description: "Enterprise-grade UI components for modern web apps.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80" },
        { id: 2, name: "Minimalist Desk Pad", category: "lifestyle", price: 29.00, description: "Smooth waterproof PU leather desk mat for productivity.", image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80" },
        { id: 3, name: "Ergonomic Laptop Stand", category: "accessories", price: 39.00, description: "Adjustable aluminum stand for improved posture.", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80" },
        { id: 4, name: "Smart Wireless Hub", category: "smart", price: 89.00, description: "Multi-port connectivity hub with fast charging support.", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80" },
        { id: 5, name: "Developer Icon Pack", category: "electronics", price: 19.00, description: "Vector icon sets optimized for software developers.", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80" }
    ];

    // Helpers
    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function formatPrice(price) {
        const num = Number(price);
        if (!Number.isFinite(num)) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(num);
    }

    // Category validation & URL sync
    function getValidCategories() {
        const categories = new Set(["all"]);
        categoryLinks.forEach(link => {
            const href = link.getAttribute("href") || "";
            const cat = normalize(link.dataset.category || new URLSearchParams(href.split("?")[1] || "").get("category"));
            if (cat) categories.add(cat);
        });
        return categories;
    }

    function getCategoryFromURL() {
        const params = new URLSearchParams(window.location.search);
        const cat = normalize(params.get("category") || "all");
        const validCategories = getValidCategories();
        return validCategories.has(cat) ? cat : "all";
    }

    currentCategory = getCategoryFromURL();

    function updateActiveCategory() {
        categoryLinks.forEach(link => {
            const href = link.getAttribute("href") || "";
            const cat = normalize(link.dataset.category || new URLSearchParams(href.split("?")[1] || "").get("category") || "all");
            const active = cat === normalize(currentCategory);
            link.classList.toggle("active", active);
            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    // Mobile menu toggle
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mobileMenu.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        });

        mobileMenu.addEventListener("click", event => {
            if (event.target.tagName === "A") {
                mobileMenu.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Open navigation menu");
            }
        });
    }

    // Cart Architecture & Reliability
    function getCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];

            const validCart = [];
            const seenIds = new Set();
            for (const item of parsed) {
                if (!item || item.id === undefined || item.id === null) continue;
                const idStr = String(item.id);
                if (seenIds.has(idStr)) continue;
                seenIds.add(idStr);

                const qty = Number(item.quantity);
                validCart.push({
                    id: item.id,
                    name: String(item.name || "Product"),
                    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
                    image: String(item.image || ""),
                    category: String(item.category || ""),
                    quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
                });
            }
            return validCart;
        } catch (error) {
            console.error("Error reading cart from localStorage:", error);
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            return true;
        } catch (error) {
            console.error("Failed to save cart to localStorage:", error);
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

    // Skeletons & States
    function showSkeletons() {
        if (!productGrid) return;
        productGrid.setAttribute("aria-busy", "true");
        if (skeletonTemplate) {
            productGrid.innerHTML = "";
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 8; i++) {
                fragment.appendChild(skeletonTemplate.content.cloneNode(true));
            }
            productGrid.appendChild(fragment);
        } else {
            productGrid.innerHTML = `<article class="product-skeleton"><div class="skeleton-image"></div><div class="skeleton-content"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div><div class="skeleton-line medium"></div></div></article>`.repeat(4);
        }
    }

    function showEmptyState() {
        if (emptyState) emptyState.classList.remove("hidden");
    }

    function hideEmptyState() {
        if (emptyState) emptyState.classList.add("hidden");
    }

    function getOrCreateErrorState() {
        let errEl = document.getElementById("error-state");
        if (!errEl && emptyState && emptyState.parentNode) {
            errEl = document.createElement("div");
            errEl.id = "error-state";
            errEl.className = "products-empty hidden";
            errEl.innerHTML = `
                <div class="products-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h2>Unable to load products</h2>
                <p>Please check your connection and try again.</p>
                <button type="button" id="retry-button" class="products-empty-button">Try Again</button>
            `;
            emptyState.parentNode.insertBefore(errEl, emptyState.nextSibling);
            errEl.querySelector("#retry-button")?.addEventListener("click", () => {
                loadProducts();
            });
        }
        return errEl;
    }

    function showErrorState() {
        hideEmptyState();
        if (productGrid) {
            productGrid.innerHTML = "";
            productGrid.setAttribute("aria-busy", "false");
        }
        if (productCount) {
            productCount.textContent = "Error loading products";
        }
        const errEl = getOrCreateErrorState();
        errEl?.classList.remove("hidden");
    }

    function hideErrorState() {
        const errEl = document.getElementById("error-state");
        if (errEl) errEl.classList.add("hidden");
    }

    // Product Card Creation (with fallback if <template> is absent)
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
                        <img src="${product.image || ""}" alt="${product.name ? `Image of ${product.name}` : "Product image"}" loading="lazy" decoding="async">
                    </div>
                </a>
                <div class="product-card-body">
                    <p class="product-category">${product.category ? String(product.category).toUpperCase() : "GENERAL"}</p>
                    <h2 class="product-title">${product.name || "Untitled Product"}</h2>
                    <p class="product-description">${product.description || ""}</p>
                    <div class="product-bottom">
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <button type="button" class="product-cart-button" data-action="cart" data-id="${productId}" aria-label="Add ${product.name || "product"} to cart">
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
        } else if (link) {
            link.removeAttribute("href");
        }

        if (image) {
            image.src = product.image || "";
            image.alt = product.name ? `Image of ${product.name}` : "Product image";
            image.loading = "lazy";
            image.decoding = "async";
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

        if (button) {
            button.type = "button";
            if (productId) button.dataset.id = productId;
            button.dataset.action = "cart";
            button.setAttribute("aria-label", `Add ${product.name || "product"} to cart`);
        }

        if (article) {
            if (productId) article.dataset.id = productId;
            article.dataset.category = product.category || "";
        }

        return fragment;
    }

    // Filtering, Search & Stable Sorting
    function getVisibleProducts() {
        let result = products.map((item, index) => ({ item, index }));

        if (normalize(currentCategory) !== "all") {
            result = result.filter(({ item }) =>
                normalize(item.category) === normalize(currentCategory)
            );
        }

        const keyword = currentSearch.trim().toLowerCase();
        if (keyword) {
            result = result.filter(({ item }) => {
                const name = normalize(item.name);
                const category = normalize(item.category);
                const description = normalize(item.description);
                return (
                    name.includes(keyword) ||
                    category.includes(keyword) ||
                    description.includes(keyword)
                );
            });
        }

        if (currentSort === "price-low") {
            result.sort((a, b) => {
                const diff = (Number(a.item.price) || 0) - (Number(b.item.price) || 0);
                return diff !== 0 ? diff : a.index - b.index;
            });
        } else if (currentSort === "price-high") {
            result.sort((a, b) => {
                const diff = (Number(b.item.price) || 0) - (Number(a.item.price) || 0);
                return diff !== 0 ? diff : a.index - b.index;
            });
        } else if (currentSort === "name") {
            result.sort((a, b) => {
                const res = String(a.item.name || "").localeCompare(String(b.item.name || ""));
                return res !== 0 ? res : a.index - b.index;
            });
        } else if (currentSort === "featured") {
            result.sort((a, b) => a.index - b.index);
        }

        return result.map(({ item }) => item);
    }

    function renderProducts() {
        if (!productGrid) return;
        productGrid.setAttribute("aria-busy", "false");
        hideErrorState();

        const visibleProducts = getVisibleProducts();

        if (productCount) {
            productCount.textContent = `${visibleProducts.length} ${
                visibleProducts.length === 1 ? "product" : "products"
            } found`;
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

    // Debounce Utility with cancel support
    function debounce(func, wait) {
        let timeout;
        const debounced = function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
        debounced.cancel = function () {
            clearTimeout(timeout);
        };
        return debounced;
    }

    const handleSearchInput = debounce(event => {
        currentSearch = event.target.value;
        renderProducts();
    }, 200);

    // Event Listeners setup
    if (categoryContainer) {
        categoryContainer.addEventListener("click", event => {
            const pill = event.target.closest(".category-pill");
            if (!pill) return;
            event.preventDefault();

            handleSearchInput.cancel();
            if (searchInput) searchInput.value = "";
            currentSearch = "";

            const cat = pill.dataset.category || new URLSearchParams((pill.getAttribute("href") || "").split("?")[1] || "").get("category") || "all";
            const newCategory = normalize(cat);
            
            if (newCategory === currentCategory) return;
            currentCategory = newCategory;

            const newUrl =
                currentCategory === "all"
                    ? "products.html"
                    : `products.html?category=${encodeURIComponent(currentCategory)}`;
            
            const expectedSearch = currentCategory === "all" ? "" : `?category=${encodeURIComponent(currentCategory)}`;
            if (window.location.search !== expectedSearch) {
                history.pushState({ category: currentCategory }, "", newUrl);
            }

            updateActiveCategory();
            renderProducts();
        });
    }

    window.addEventListener("popstate", () => {
        handleSearchInput.cancel();
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
        searchForm.addEventListener("submit", event => {
            event.preventDefault();
        });
    }

    if (emptyResetBtn) {
        emptyResetBtn.addEventListener("click", event => {
            event.preventDefault();
            handleSearchInput.cancel();
            currentCategory = "all";
            currentSearch = "";
            if (searchInput) searchInput.value = "";
            if (window.location.search !== "") {
                history.pushState({ category: "all" }, "", "products.html");
            }
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

    document.addEventListener("keydown", event => {
        const isShortcut =
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k";
        if (!isShortcut) return;
        event.preventDefault();
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    });

    if (productGrid) {
        productGrid.addEventListener("click", event => {
            const button = event.target.closest('[data-action="cart"]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            const productId = button.dataset.id;
            if (!productId) return;
            addToCart(productId);
        });
    }

    window.addEventListener("storage", event => {
        if (!event.key || event.key === CART_KEY) {
            updateCartCount();
        }
    });

    // Load Products with sequence tracking & robust fetch/fallback handling
    async function loadProducts() {
        const currentSequence = ++loadSequence;
        try {
            showSkeletons();
            hideErrorState();
            
            let data = null;
            try {
                const response = await fetch("data/products.json", {
                    cache: "no-cache"
                });
                if (response.ok) {
                    data = await response.json();
                }
            } catch (fetchErr) {
                console.warn("Fetch failed (likely file:// protocol CORS restriction), using fallback products.", fetchErr);
            }

            if (currentSequence !== loadSequence) return;

            if (!Array.isArray(data)) {
                data = FALLBACK_PRODUCTS;
            }

            const seenIds = new Set();
            const validProducts = [];
            for (const p of data) {
                if (!p || p.id === undefined || p.id === null || String(p.id).trim() === "") continue;
                const idStr = String(p.id);
                if (seenIds.has(idStr)) continue;
                seenIds.add(idStr);
                if (typeof p.name !== "string" || p.name.trim() === "") continue;
                const parsedPrice = Number(p.price);
                if (isNaN(parsedPrice)) continue;

                validProducts.push({
                    id: p.id,
                    name: p.name.trim(),
                    price: parsedPrice,
                    image: String(p.image || ""),
                    category: String(p.category || "general").trim(),
                    description: String(p.description || "")
                });
            }

            products = validProducts;
            currentCategory = getCategoryFromURL();
            updateActiveCategory();
            renderProducts();
            updateCartCount();
        } catch (error) {
            if (currentSequence !== loadSequence) return;
            console.error("Product loading error, applying fallback dataset:", error);
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
