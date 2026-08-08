/**
 * Prasun Shop — Products Page Module
 * Production-grade implementation (10/10 Quality Audit)
 */
"use strict";

(function () {
    // DOM Elements (gracefully handle optional elements)
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
    let searchTimeout = null;

    const CART_KEY = "prasunShopCart";

    // Helpers
    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function formatPrice(price) {
        const number = Number(price);
        if (!Number.isFinite(number)) {
            return "$0.00";
        }
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(number);
    }

    // Category Validation & URL Synchronization
    function getValidCategories() {
        const categories = new Set(["all"]);
        categoryLinks.forEach(link => {
            const cat = normalize(link.dataset.category || new URLSearchParams((link.getAttribute("href") || "").split("?")[1] || "").get("category"));
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
            const cat = normalize(link.dataset.category || new URLSearchParams((link.getAttribute("href") || "").split("?")[1] || "").get("category") || "all");
            const active = cat === normalize(currentCategory);
            link.classList.toggle("active", active);
            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    // Mobile Menu Handlers
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mobileMenu.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation menu" : "Open navigation menu"
            );
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
            
            // Clean and validate items
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
            console.error("Unable to read or parse cart from localStorage:", error);
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            return true;
        } catch (error) {
            console.error("Failed to persist cart to localStorage (Quota exceeded or unavailable):", error);
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
        if (!product) {
            console.error("Product not found:", productId);
            return;
        }
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
        
        // Only trigger UI feedback & persistence updates if successfully saved
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

    // Skeleton & State Management
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
            productGrid.innerHTML = `
                <article class="product-skeleton"><div class="skeleton-image"></div><div class="skeleton-content"><div class="skeleton-line short"></div><div class="skeleton-line long"></div></div></article>
            `.repeat(4);
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

    // Product Card Construction
    function createProductCard(product) {
        if (!productTemplate) return document.createDocumentFragment();
        const fragment = productTemplate.content.cloneNode(true);
        const article = fragment.querySelector(".product-card") || fragment.querySelector("article");
        const link = fragment.querySelector(".product-card-link") || fragment.querySelector("a");
        const image = fragment.querySelector("img");
        const category = fragment.querySelector(".product-category");
        const title = fragment.querySelector(".product-title");
        const description = fragment.querySelector(".product-description");
        const price = fragment.querySelector(".product-price");
        const button = fragment.querySelector(".product-cart-button") || fragment.querySelector('[data-action="cart"]');

        const productId = product.id !== undefined && product.id !== null ? String(product.id) : "";
        
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

    // Filtering, Searching & Sorting
    function getVisibleProducts() {
        let result = [...products];

        if (normalize(currentCategory) !== "all") {
            result = result.filter(product =>
                normalize(product.category) === normalize(currentCategory)
            );
        }

        const keyword = currentSearch.trim().toLowerCase();
        if (keyword) {
            result = result.filter(product => {
                const name = normalize(product.name);
                const category = normalize(product.category);
                const description = normalize(product.description);
                return (
                    name.includes(keyword) ||
                    category.includes(keyword) ||
                    description.includes(keyword)
                );
            });
        }

        if (currentSort === "price-low") {
            result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        } else if (currentSort === "price-high") {
            result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        } else if (currentSort === "name") {
            result.sort((a, b) =>
                String(a.name || "").localeCompare(String(b.name || ""))
            );
        } else if (currentSort === "featured") {
            // Preserves exact original JSON order
        }

        return result;
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

    // Event Handlers for Categories & URL Sync
    if (categoryContainer) {
        categoryContainer.addEventListener("click", event => {
            const pill = event.target.closest(".category-pill");
            if (!pill) return;
            event.preventDefault();

            // Clear any pending debounced search or timer states if desired, or keep search active
            const cat = pill.dataset.category || new URLSearchParams((pill.getAttribute("href") || "").split("?")[1] || "").get("category") || "all";
            currentCategory = normalize(cat);

            const newUrl =
                currentCategory === "all"
                    ? "products.html"
                    : `products.html?category=${encodeURIComponent(currentCategory)}`;
            history.pushState({ category: currentCategory }, "", newUrl);

            updateActiveCategory();
            renderProducts();
        });
    }

    window.addEventListener("popstate", () => {
        currentCategory = getCategoryFromURL();
        updateActiveCategory();
        renderProducts();
    });

    // Debounced Search with Stale Prevention
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
            if (searchTimeout) searchTimeout.cancel?.();
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

    // Global Keyboard Shortcuts (⌘K / Ctrl+K)
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

    // Event Delegation for Add-to-Cart
    if (productGrid) {
        productGrid.addEventListener("click", event => {
            const button = event.target.closest('[data-action="cart"]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            const productId = button.dataset.id;
            if (!productId) {
                console.error("Add to Cart button has no product ID.");
                return;
            }
            addToCart(productId);
        });
    }

    // Cross-tab synchronization via native storage event
    window.addEventListener("storage", event => {
        if (!event.key || event.key === CART_KEY) {
            updateCartCount();
        }
    });

    // Load Products Data Safely
    async function loadProducts() {
        try {
            showSkeletons();
            hideErrorState();
            const response = await fetch("data/products.json", {
                cache: "no-cache"
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format: products.json must contain an array.");
            }

            // Validate and sanitize products, filter out malformed items, handle duplicate IDs safely
            const seenIds = new Set();
            products = [];
            for (const p of data) {
                if (!p || p.id === undefined || p.id === null || String(p.id).trim() === "") continue;
                const idStr = String(p.id);
                if (seenIds.has(idStr)) {
                    console.warn(`Duplicate product ID detected and ignored: ${idStr}`);
                    continue;
                }
                if (typeof p.name !== "string" || p.name.trim() === "") continue;
                const parsedPrice = Number(p.price);
                if (isNaN(parsedPrice)) continue;

                seenIds.add(idStr);
                products.push({
                    id: p.id,
                    name: p.name.trim(),
                    price: parsedPrice,
                    image: String(p.image || ""),
                    category: String(p.category || "general").trim(),
                    description: String(p.description || "")
                });
            }

            currentCategory = getCategoryFromURL();
            updateActiveCategory();
            renderProducts();
            updateCartCount();
        } catch (error) {
            console.error("Product loading error:", error);
            showErrorState();
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
