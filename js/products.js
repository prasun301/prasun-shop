/**
 * Prasun Shop — Products Page Module
 * Production-grade implementation combining filtering, search, sorting,
 * URL synchronization, cart management, and enterprise error handling.
 */
"use strict";

(function () {
    // DOM Elements
    const productGrid = document.getElementById("product-list");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("product-search");
    const searchForm = document.getElementById("product-search-form");
    const productTemplate = document.getElementById("product-card-template");
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

    // URL & Category Handling
    function getCategoryFromURL() {
        const params = new URLSearchParams(window.location.search);
        const cat = params.get("category");
        if (!cat) return "all";
        const normalizedCat = normalize(cat);
        const validCategories = Array.from(categoryLinks)
            .map(link => {
                const href = link.getAttribute("href") || "";
                const linkParams = new URLSearchParams(href.split("?")[1] || "");
                return normalize(linkParams.get("category") || link.dataset.category || "all");
            })
            .filter(c => c && c !== "all");
        if (normalizedCat === "all" || validCategories.includes(normalizedCat)) {
            return normalizedCat;
        }
        return "all";
    }

    currentCategory = getCategoryFromURL();

    function updateActiveCategory() {
        categoryLinks.forEach(link => {
            const href = link.getAttribute("href") || "";
            const linkParams = new URLSearchParams(href.split("?")[1] || "");
            const cat = normalize(linkParams.get("category") || link.dataset.category || "all");
            const active = cat === normalize(currentCategory);
            link.classList.toggle("active", active);
            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    // Mobile Menu
    menuToggle?.addEventListener("click", () => {
        const isOpen = mobileMenu?.classList.toggle("open") || false;
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    });

    mobileMenu?.addEventListener("click", event => {
        if (event.target.tagName === "A") {
            mobileMenu.classList.remove("open");
            menuToggle?.setAttribute("aria-expanded", "false");
            menuToggle?.setAttribute("aria-label", "Open navigation menu");
        }
    });

    // Cart Architecture
    function getCart() {
        try {
            const stored = localStorage.getItem(CART_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Unable to read cart from localStorage:", error);
            return [];
        }
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
        } catch (error) {
            console.error("Unable to save cart to localStorage:", error);
        }
    }

    function updateCartCount() {
        if (!cartCount) return;
        const cart = getCart();
        const total = cart.reduce((sum, item) => {
            const qty = Number(item?.quantity);
            return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
        }, 0);
        cartCount.textContent = String(total);
        if (cartCount.hasAttribute("hidden")) {
            cartCount.hidden = total === 0;
        }
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
            existing.quantity = Number(existing.quantity || 1) + 1;
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
        saveCart(cart);
        updateCartCount();
        showCartFeedback(product.id);
        window.dispatchEvent(new Event("storage"));
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
        productGrid.innerHTML = `
            <article class="product-skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </article>
            <article class="product-skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </article>
            <article class="product-skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </article>
            <article class="product-skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </article>
        `;
    }

    function showEmptyState() {
        if (emptyState) emptyState.classList.remove("hidden");
    }

    function hideEmptyState() {
        if (emptyState) emptyState.classList.add("hidden");
    }

    function createErrorState() {
        let errEl = document.getElementById("error-state");
        if (!errEl && emptyState) {
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
            errEl.querySelector("#retry-button")?.addEventListener("click", loadProducts);
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
        const errEl = document.getElementById("error-state") || createErrorState();
        errEl?.classList.remove("hidden");
    }

    function hideErrorState() {
        const errEl = document.getElementById("error-state");
        if (errEl) errEl.classList.add("hidden");
    }

    // Product Card Construction
    function createProductCard(product) {
        const fragment = productTemplate.content.cloneNode(true);
        const article = fragment.querySelector(".product-card");
        const link = fragment.querySelector(".product-card-link");
        const image = fragment.querySelector("img");
        const category = fragment.querySelector(".product-category");
        const title = fragment.querySelector(".product-title");
        const description = fragment.querySelector(".product-description");
        const price = fragment.querySelector(".product-price");
        const button = fragment.querySelector(".product-cart-button");

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

    // Filtering & Sorting
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
            result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        } else if (currentSort === "price-high") {
            result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        } else if (currentSort === "name") {
            result.sort((a, b) =>
                String(a.name || "").localeCompare(String(b.name || ""))
            );
        } else if (currentSort === "featured") {
            // Preserves original fetched order from products.json
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

    // Event Listeners for Filters & Navigation
    categoryContainer?.addEventListener("click", event => {
        const pill = event.target.closest(".category-pill");
        if (!pill) return;
        event.preventDefault();

        const href = pill.getAttribute("href") || "";
        const linkParams = new URLSearchParams(href.split("?")[1] || "");
        const category = linkParams.get("category") || pill.dataset.category || "all";
        currentCategory = normalize(category);

        const newUrl =
            currentCategory === "all"
                ? "products.html"
                : `products.html?category=${encodeURIComponent(currentCategory)}`;
        history.pushState({ category: currentCategory }, "", newUrl);

        updateActiveCategory();
        renderProducts();
    });

    window.addEventListener("popstate", () => {
        currentCategory = getCategoryFromURL();
        updateActiveCategory();
        renderProducts();
    });

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

    searchInput?.addEventListener("input", handleSearchInput);

    searchForm?.addEventListener("submit", event => {
        event.preventDefault();
    });

    emptyResetBtn?.addEventListener("click", event => {
        event.preventDefault();
        currentCategory = "all";
        currentSearch = "";
        if (searchInput) searchInput.value = "";
        history.pushState({ category: "all" }, "", "products.html");
        updateActiveCategory();
        renderProducts();
    });

    productSort?.addEventListener("change", event => {
        currentSort = event.target.value;
        renderProducts();
    });

    document.addEventListener("keydown", event => {
        const isShortcut =
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k";
        if (!isShortcut) return;
        event.preventDefault();
        searchInput?.focus();
        searchInput?.select();
    });

    productGrid?.addEventListener("click", event => {
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

    window.addEventListener("storage", event => {
        if (!event.key || event.key === CART_KEY) {
            updateCartCount();
        }
    });

    // Load Products
    async function loadProducts() {
        try {
            showSkeletons();
            hideErrorState();
            const response = await fetch("data/products.json", {
                cache: "no-cache"
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("products.json must contain an array.");
            }

            products = data.filter(p =>
                p &&
                (p.id !== undefined && p.id !== null && p.id !== "") &&
                typeof p.name === "string" &&
                p.name.trim() !== "" &&
                !isNaN(Number(p.price))
            );

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
