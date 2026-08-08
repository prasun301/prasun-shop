```javascript
/**
 * ============================================================================
 * PRASUN SHOP — PRODUCTS PAGE
 * ============================================================================
 * Handles:
 * - Product loading
 * - Search
 * - Category filtering
 * - Sorting
 * - Product navigation
 * - Cart integration
 * - Cart badge
 * - Loading / empty / error states
 * - Keyboard shortcuts
 * - Mobile navigation
 * ============================================================================
 */

"use strict";

(() => {
    /* ------------------------------------------------------------------------
       Configuration
       ------------------------------------------------------------------------ */

    const PRODUCTS_URL = "data/products.json";
    const CART_KEY = "prasun_cart";


    /* ------------------------------------------------------------------------
       State
       ------------------------------------------------------------------------ */

    let products = [];
    let currentCategory = "all";
    let currentSearch = "";
    let currentSort = "featured";


    /* ------------------------------------------------------------------------
       DOM
       ------------------------------------------------------------------------ */

    const grid = document.getElementById("product-list");
    const count = document.getElementById("products-count");

    const emptyState = document.getElementById("empty-state");
    const errorState = document.getElementById("products-error");

    const searchForm = document.getElementById("product-search-form");
    const searchInput = document.getElementById("product-search");
    const searchClear = document.getElementById("search-clear");

    const sortSelect = document.getElementById("product-sort");

    const categoryButtons = document.querySelectorAll(
        ".category-pill"
    );

    const resetButton = document.getElementById(
        "empty-reset-btn"
    );

    const retryButton = document.getElementById(
        "products-retry-btn"
    );

    const cartCount = document.getElementById(
        "cart-count"
    );

    const menuToggle = document.getElementById(
        "products-menu-toggle"
    );

    const mobileMenu = document.getElementById(
        "products-mobile-menu"
    );

    const footerYear = document.getElementById(
        "footer-year"
    );


    /* ------------------------------------------------------------------------
       Utilities
       ------------------------------------------------------------------------ */

    function normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function formatPrice(value) {
        const price = Number(value);

        if (!Number.isFinite(price)) {
            return "$0.00";
        }

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(price);
    }


    function productId(product) {
        return String(
            product?.id ??
            product?.productId ??
            ""
        );
    }


    function productName(product) {
        return String(
            product?.name ??
            product?.title ??
            "Untitled Product"
        );
    }


    function productCategory(product) {
        return String(
            product?.category ??
            "Uncategorized"
        );
    }


    function productDescription(product) {
        return String(
            product?.description ??
            product?.shortDescription ??
            ""
        );
    }


    function productImage(product) {
        return String(
            product?.image ??
            product?.imageUrl ??
            product?.thumbnail ??
            ""
        );
    }


    function productPrice(product) {
        const value = Number(product?.price);

        return Number.isFinite(value)
            ? value
            : 0;
    }


    /* ------------------------------------------------------------------------
       Cart
       ------------------------------------------------------------------------ */

    function getCart() {
        try {
            const data = localStorage.getItem(CART_KEY);

            if (!data) {
                return [];
            }

            const cart = JSON.parse(data);

            return Array.isArray(cart)
                ? cart
                : [];

        } catch {
            return [];
        }
    }


    function saveCart(cart) {
        try {
            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );

        } catch (error) {
            console.error(
                "Unable to save cart:",
                error
            );
        }
    }


    function updateCartBadge() {
        if (!cartCount) {
            return;
        }

        const total = getCart().reduce(
            (sum, item) => {

                const quantity = Number(
                    item?.quantity ?? 1
                );

                return sum + (
                    Number.isFinite(quantity)
                        ? Math.max(0, quantity)
                        : 0
                );
            },
            0
        );

        cartCount.textContent =
            total > 99
                ? "99+"
                : String(total);

        cartCount.hidden = total === 0;
    }


    function addToCart(product) {
        const id = productId(product);

        if (!id) {
            return;
        }

        const cart = getCart();

        const existing = cart.find(
            item => String(item.id) === id
        );

        if (existing) {
            existing.quantity =
                Math.max(
                    1,
                    Number(existing.quantity) || 1
                ) + 1;

        } else {
            cart.push({
                id,
                name: productName(product),
                price: productPrice(product),
                image: productImage(product),
                category: productCategory(product),
                quantity: 1
            });
        }

        saveCart(cart);
        updateCartBadge();
    }


    /* ------------------------------------------------------------------------
       Filtering & Sorting
       ------------------------------------------------------------------------ */

    function getVisibleProducts() {
        const query = normalize(currentSearch);
        const category = normalize(currentCategory);

        const visible = products.filter(product => {

            const productCat =
                normalize(productCategory(product));

            const name =
                normalize(productName(product));

            const description =
                normalize(productDescription(product));

            const matchesCategory =
                category === "all" ||
                productCat === category;

            const matchesSearch =
                !query ||
                name.includes(query) ||
                description.includes(query) ||
                productCat.includes(query);

            return (
                matchesCategory &&
                matchesSearch
            );
        });


        if (currentSort === "price-low") {
            visible.sort(
                (a, b) =>
                    productPrice(a) -
                    productPrice(b)
            );
        }

        if (currentSort === "price-high") {
            visible.sort(
                (a, b) =>
                    productPrice(b) -
                    productPrice(a)
            );
        }

        if (currentSort === "name") {
            visible.sort(
                (a, b) =>
                    productName(a).localeCompare(
                        productName(b),
                        undefined,
                        {
                            sensitivity: "base"
                        }
                    )
            );
        }

        return visible;
    }


    /* ------------------------------------------------------------------------
       Product Card
       ------------------------------------------------------------------------ */

    function createProductCard(product) {
        const id = productId(product);
        const name = productName(product);
        const category = productCategory(product);
        const description = productDescription(product);
        const image = productImage(product);
        const price = productPrice(product);


        const article =
            document.createElement("article");

        article.className = "product-card";


        /* Image / Product Link */

        const link =
            document.createElement("a");

        link.className =
            "product-card-link";

        link.href =
            `product.html?id=${encodeURIComponent(id)}`;

        link.setAttribute(
            "aria-label",
            `View ${name}`
        );


        const imageWrap =
            document.createElement("div");

        imageWrap.className =
            "product-image-wrapper";


        const img =
            document.createElement("img");

        img.className =
            "product-image";

        img.src = image;

        img.alt = name;

        img.loading = "lazy";

        img.decoding = "async";


        img.addEventListener(
            "error",
            () => {

                img.removeAttribute("src");

                imageWrap.classList.add(
                    "image-error"
                );

            },
            { once: true }
        );


        imageWrap.appendChild(img);


        if (category) {
            const badge =
                document.createElement("span");

            badge.className =
                "product-category";

            badge.textContent =
                category;

            imageWrap.appendChild(badge);
        }


        link.appendChild(imageWrap);


        /* Product Content */

        const details =
            document.createElement("div");

        details.className =
            "product-details";


        const title =
            document.createElement("h2");

        title.className =
            "product-title";

        title.textContent =
            name;


        details.appendChild(title);


        if (description) {
            const descriptionElement =
                document.createElement("p");

            descriptionElement.className =
                "product-description";

            descriptionElement.textContent =
                description;

            details.appendChild(
                descriptionElement
            );
        }


        /* Product Footer */

        const footer =
            document.createElement("div");

        footer.className =
            "product-card-footer";


        const priceElement =
            document.createElement("span");

        priceElement.className =
            "product-price";

        priceElement.textContent =
            formatPrice(price);


        const cartButton =
            document.createElement("button");

        cartButton.type = "button";

        cartButton.className =
            "product-cart-button";

        cartButton.innerHTML = `
            <span>Add to Cart</span>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/>
                <circle cx="10" cy="20" r="1.3"/>
                <circle cx="18" cy="20" r="1.3"/>
            </svg>
        `;

        cartButton.setAttribute(
            "aria-label",
            `Add ${name} to cart`
        );


        cartButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                addToCart(product);

                cartButton.classList.add(
                    "is-added"
                );

                cartButton.setAttribute(
                    "aria-label",
                    `${name} added to cart`
                );

                cartButton.innerHTML = `
                    <span>Added</span>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 6 9 17l-5-5"/>
                    </svg>
                `;


                window.setTimeout(
                    () => {

                        cartButton.classList.remove(
                            "is-added"
                        );

                        cartButton.setAttribute(
                            "aria-label",
                            `Add ${name} to cart`
                        );

                        cartButton.innerHTML = `
                            <span>Add to Cart</span>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/>
                                <circle cx="10" cy="20" r="1.3"/>
                                <circle cx="18" cy="20" r="1.3"/>
                            </svg>
                        `;

                    },
                    1200
                );
            }
        );


        footer.appendChild(
            priceElement
        );

        footer.appendChild(
            cartButton
        );


        details.appendChild(footer);


        article.appendChild(link);
        article.appendChild(details);


        return article;
    }


    /* ------------------------------------------------------------------------
       Rendering
       ------------------------------------------------------------------------ */

    function renderProducts() {
        if (!grid) {
            return;
        }

        const visible =
            getVisibleProducts();


        grid.innerHTML = "";

        grid.setAttribute(
            "aria-busy",
            "true"
        );


        if (!visible.length) {

            grid.hidden = true;

            if (emptyState) {
                emptyState.hidden = false;
            }

            if (count) {
                count.textContent =
                    "0 products found";
            }

            grid.setAttribute(
                "aria-busy",
                "false"
            );

            return;
        }


        grid.hidden = false;

        if (emptyState) {
            emptyState.hidden = true;
        }


        const fragment =
            document.createDocumentFragment();


        visible.forEach(product => {
            fragment.appendChild(
                createProductCard(product)
            );
        });


        grid.appendChild(fragment);


        if (count) {
            count.textContent =
                visible.length === 1
                    ? "1 product"
                    : `${visible.length} products`;
        }


        grid.setAttribute(
            "aria-busy",
            "false"
        );
    }


    /* ------------------------------------------------------------------------
       Loading States
       ------------------------------------------------------------------------ */

    function setLoadingState() {

        if (grid) {
            grid.hidden = false;

            grid.setAttribute(
                "aria-busy",
                "true"
            );
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        if (errorState) {
            errorState.hidden = true;
        }

        if (count) {
            count.textContent =
                "Loading products…";
        }
    }


    function setErrorState() {

        if (grid) {
            grid.innerHTML = "";

            grid.hidden = true;

            grid.setAttribute(
                "aria-busy",
                "false"
            );
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        if (errorState) {
            errorState.hidden = false;
        }

        if (count) {
            count.textContent =
                "Unable to load products";
        }
    }


    /* ------------------------------------------------------------------------
       Load Products
       ------------------------------------------------------------------------ */

    async function loadProducts() {

        setLoadingState();

        try {

            const response =
                await fetch(PRODUCTS_URL);


            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            if (!Array.isArray(data)) {
                throw new Error(
                    "products.json must contain an array"
                );
            }


            products = data.filter(
                product =>
                    product &&
                    productId(product)
            );


            initializeCategoryFromURL();

            renderProducts();


        } catch (error) {

            console.error(
                "Unable to load products:",
                error
            );

            setErrorState();
        }
    }


    /* ------------------------------------------------------------------------
       URL Category
       ------------------------------------------------------------------------ */

    function initializeCategoryFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const category =
            params.get("category");


        if (!category) {
            return;
        }


        const matchingButton =
            [...categoryButtons].find(
                button =>
                    normalize(
                        button.dataset.category
                    ) === normalize(category)
            );


        if (matchingButton) {

            currentCategory =
                matchingButton.dataset.category;

            updateCategoryButtons();
        }
    }


    function updateCategoryButtons() {

        categoryButtons.forEach(
            button => {

                const active =
                    normalize(
                        button.dataset.category
                    ) === normalize(
                        currentCategory
                    );

                button.classList.toggle(
                    "active",
                    active
                );

                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );
            }
        );
    }


    /* ------------------------------------------------------------------------
       Search
       ------------------------------------------------------------------------ */

    function updateSearchUI() {

        if (!searchClear || !searchInput) {
            return;
        }

        searchClear.hidden =
            !searchInput.value.trim();
    }


    searchInput?.addEventListener(
        "input",
        event => {

            currentSearch =
                event.target.value;

            updateSearchUI();

            renderProducts();
        }
    );


    searchForm?.addEventListener(
        "submit",
        event => {
            event.preventDefault();
        }
    );


    searchClear?.addEventListener(
        "click",
        () => {

            if (!searchInput) {
                return;
            }

            searchInput.value = "";

            currentSearch = "";

            updateSearchUI();

            searchInput.focus();

            renderProducts();
        }
    );


    /* ------------------------------------------------------------------------
       Category Filtering
       ------------------------------------------------------------------------ */

    categoryButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    currentCategory =
                        button.dataset.category ||
                        "all";

                    updateCategoryButtons();

                    renderProducts();
                }
            );
        }
    );


    /* ------------------------------------------------------------------------
       Sorting
       ------------------------------------------------------------------------ */

    sortSelect?.addEventListener(
        "change",
        event => {

            currentSort =
                event.target.value ||
                "featured";

            renderProducts();
        }
    );


    /* ------------------------------------------------------------------------
       Reset Filters
       ------------------------------------------------------------------------ */

    function resetFilters() {

        currentCategory = "all";

        currentSearch = "";

        currentSort = "featured";


        if (searchInput) {
            searchInput.value = "";
        }

        if (sortSelect) {
            sortSelect.value = "featured";
        }


        updateCategoryButtons();

        updateSearchUI();

        renderProducts();
    }


    resetButton?.addEventListener(
        "click",
        resetFilters
    );


    retryButton?.addEventListener(
        "click",
        loadProducts
    );


    /* ------------------------------------------------------------------------
       Keyboard Shortcuts
       ------------------------------------------------------------------------ */

    document.addEventListener(
        "keydown",
        event => {

            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "k"
            ) {

                event.preventDefault();

                searchInput?.focus();

                searchInput?.select();
            }


            if (
                event.key === "Escape" &&
                document.activeElement === searchInput &&
                searchInput?.value
            ) {

                searchClear?.click();
            }
        }
    );


    /* ------------------------------------------------------------------------
       Mobile Navigation
       ------------------------------------------------------------------------ */

    menuToggle?.addEventListener(
        "click",
        () => {

            if (!mobileMenu) {
                return;
            }

            const open =
                menuToggle.getAttribute(
                    "aria-expanded"
                ) === "true";


            menuToggle.setAttribute(
                "aria-expanded",
                String(!open)
            );

            menuToggle.setAttribute(
                "aria-label",
                open
                    ? "Open menu"
                    : "Close menu"
            );

            mobileMenu.hidden = open;
        }
    );


    /* Close mobile menu after navigation */

    mobileMenu?.querySelectorAll("a").forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    if (!menuToggle) {
                        return;
                    }

                    menuToggle.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                    menuToggle.setAttribute(
                        "aria-label",
                        "Open menu"
                    );

                    mobileMenu.hidden = true;
                }
            );
        }
    );


    /* ------------------------------------------------------------------------
       Footer
       ------------------------------------------------------------------------ */

    if (footerYear) {
        footerYear.textContent =
            new Date().getFullYear();
    }


    /* ------------------------------------------------------------------------
       Cart Synchronization
       ------------------------------------------------------------------------ */

    updateCartBadge();


    window.addEventListener(
        "storage",
        event => {

            if (event.key === CART_KEY) {
                updateCartBadge();
            }
        }
    );


    /* ------------------------------------------------------------------------
       Initialize
       ------------------------------------------------------------------------ */

    loadProducts();

})();
```
