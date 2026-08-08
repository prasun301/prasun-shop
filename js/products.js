"use strict";

/* ==========================================================================
   PRASUN SHOP — PRODUCTS PAGE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* ----------------------------------------------------------------------
       DOM
    ---------------------------------------------------------------------- */

    const productGrid = document.getElementById("product-list");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("product-search");

    const productTemplate =
        document.getElementById("product-card-template");

    const skeletonTemplate =
        document.getElementById("skeleton-template");

    const categoryLinks =
        document.querySelectorAll(".category-pill");

    const cartCount =
        document.getElementById("cart-count");


    /* ----------------------------------------------------------------------
       State
    ---------------------------------------------------------------------- */

    let products = [];
    let currentCategory = "all";
    let currentSearch = "";


    /* ----------------------------------------------------------------------
       URL
    ---------------------------------------------------------------------- */

    const params =
        new URLSearchParams(window.location.search);

    currentCategory =
        (params.get("category") || "all").toLowerCase();


    /* ----------------------------------------------------------------------
       CART STORAGE
    ---------------------------------------------------------------------- */

    const CART_KEY = "prasunShopCart";


    function getCart() {

        try {

            const stored =
                localStorage.getItem(CART_KEY);

            if (!stored) {
                return [];
            }

            const cart = JSON.parse(stored);

            return Array.isArray(cart) ? cart : [];

        } catch (error) {

            console.error(
                "Unable to read cart:",
                error
            );

            return [];
        }
    }


    function saveCart(cart) {

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

    }


    function updateCartCount() {

        const cart = getCart();

        const count = cart.reduce(
            (total, item) =>
                total + Number(item.quantity || 1),
            0
        );

        if (cartCount) {

            cartCount.textContent = count;

            cartCount.hidden = count === 0;

        }

    }


    /* ----------------------------------------------------------------------
       ADD TO CART
    ---------------------------------------------------------------------- */

    function addToCart(productId) {

        const product =
            products.find(
                item => String(item.id) === String(productId)
            );

        if (!product) {

            console.error(
                "Product not found:",
                productId
            );

            return;
        }


        const cart = getCart();


        const existing =
            cart.find(
                item =>
                    String(item.id) === String(product.id)
            );


        if (existing) {

            existing.quantity =
                Number(existing.quantity || 1) + 1;

        } else {

            cart.push({

                id: product.id,

                name: product.name,

                price: Number(product.price),

                image: product.image,

                category: product.category,

                quantity: 1

            });

        }


        saveCart(cart);

        updateCartCount();

        showCartFeedback(product.name);

    }


    /* ----------------------------------------------------------------------
       CART FEEDBACK
    ---------------------------------------------------------------------- */

    function showCartFeedback(productName) {

        const buttons =
            productGrid.querySelectorAll(
                '[data-action="cart"]'
            );


        buttons.forEach(button => {

            if (
                String(button.dataset.id) !==
                String(
                    products.find(
                        product =>
                            product.name === productName
                    )?.id
                )
            ) {
                return;
            }


            const originalText =
                button.textContent;


            button.textContent =
                "Added ✓";

            button.classList.add(
                "is-added"
            );

            button.disabled = true;


            setTimeout(() => {

                button.textContent =
                    originalText;

                button.classList.remove(
                    "is-added"
                );

                button.disabled = false;

            }, 1200);

        });

    }


    /* ----------------------------------------------------------------------
       SKELETONS
    ---------------------------------------------------------------------- */

    function showSkeletons(count = 8) {

        if (!productGrid || !skeletonTemplate) {
            return;
        }

        productGrid.innerHTML = "";

        productGrid.setAttribute(
            "aria-busy",
            "true"
        );


        for (let i = 0; i < count; i++) {

            productGrid.appendChild(
                skeletonTemplate.content.cloneNode(true)
            );

        }

    }


    function hideSkeletons() {

        if (!productGrid) {
            return;
        }

        productGrid.setAttribute(
            "aria-busy",
            "false"
        );

    }


    /* ----------------------------------------------------------------------
       EMPTY STATE
    ---------------------------------------------------------------------- */

    function showEmptyState() {

        productGrid.innerHTML = "";

        if (emptyState) {
            emptyState.classList.remove("hidden");
        }

    }


    function hideEmptyState() {

        if (emptyState) {
            emptyState.classList.add("hidden");
        }

    }


    /* ----------------------------------------------------------------------
       PRODUCT CARD
    ---------------------------------------------------------------------- */

    function createProductCard(product) {

        const card =
            productTemplate.content.cloneNode(true);


        const article =
            card.querySelector("article");

        const link =
            card.querySelector("a");

        const image =
            card.querySelector("img");

        const category =
            card.querySelector(".product-category");

        const title =
            card.querySelector(".product-title");

        const description =
            card.querySelector(".product-description");

        const price =
            card.querySelector(".product-price");

        const button =
            card.querySelector('[data-action="cart"]');


        /* Product link */

        if (link) {

            link.href =
                `product.html?id=${encodeURIComponent(product.id)}`;

        }


        /* Image */

        if (image) {

            image.src = product.image;

            image.alt = product.name;

            image.loading = "lazy";

            image.decoding = "async";

        }


        /* Text */

        if (category) {
            category.textContent =
                product.category;
        }

        if (title) {
            title.textContent =
                product.name;
        }

        if (description) {
            description.textContent =
                product.description;
        }

        if (price) {
            price.textContent =
                `$${Number(product.price).toFixed(2)}`;
        }


        /* Cart */

        if (button) {

            button.type = "button";

            button.dataset.id =
                product.id;

            button.dataset.action =
                "cart";

            button.setAttribute(
                "aria-label",
                `Add ${product.name} to cart`
            );

        }


        /* Metadata */

        if (article) {

            article.dataset.id =
                product.id;

            article.dataset.category =
                product.category;

        }


        return card;

    }


    /* ----------------------------------------------------------------------
       FILTER
    ---------------------------------------------------------------------- */

    function getFilteredProducts() {

        const search =
            currentSearch
                .trim()
                .toLowerCase();


        return products.filter(product => {

            const categoryMatch =
                currentCategory === "all" ||
                String(product.category)
                    .toLowerCase() ===
                    currentCategory;


            const searchMatch =
                !search ||
                String(product.name)
                    .toLowerCase()
                    .includes(search) ||
                String(product.description)
                    .toLowerCase()
                    .includes(search) ||
                String(product.category)
                    .toLowerCase()
                    .includes(search);


            return categoryMatch && searchMatch;

        });

    }


    /* ----------------------------------------------------------------------
       RENDER
    ---------------------------------------------------------------------- */

    function renderProducts() {

        hideSkeletons();

        hideEmptyState();

        const filtered =
            getFilteredProducts();


        productGrid.innerHTML = "";


        if (!filtered.length) {

            showEmptyState();

            return;

        }


        const fragment =
            document.createDocumentFragment();


        filtered.forEach(product => {

            fragment.appendChild(
                createProductCard(product)
            );

        });


        productGrid.appendChild(
            fragment
        );

    }


    /* ----------------------------------------------------------------------
       CATEGORY STATE
    ---------------------------------------------------------------------- */

    function updateCategoryUI() {

        categoryLinks.forEach(link => {

            const href =
                link.getAttribute("href") || "";

            const linkParams =
                new URLSearchParams(
                    href.split("?")[1] || ""
                );

            const category =
                (
                    linkParams.get("category") ||
                    "all"
                ).toLowerCase();


            const active =
                category === currentCategory;


            link.classList.toggle(
                "active",
                active
            );


            if (active) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        });

    }


    /* ----------------------------------------------------------------------
       SEARCH
    ---------------------------------------------------------------------- */

    searchInput?.addEventListener(
        "input",
        event => {

            currentSearch =
                event.target.value;

            renderProducts();

        }
    );


    /* ----------------------------------------------------------------------
       CATEGORY LINKS
    ---------------------------------------------------------------------- */

    categoryLinks.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                const href =
                    link.getAttribute("href") || "";

                const query =
                    href.split("?")[1] || "";

                const linkParams =
                    new URLSearchParams(query);


                currentCategory =
                    (
                        linkParams.get("category") ||
                        "all"
                    ).toLowerCase();

            }
        );

    });


    /* ----------------------------------------------------------------------
       ADD TO CART — EVENT DELEGATION
    ---------------------------------------------------------------------- */

    productGrid?.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    '[data-action="cart"]'
                );


            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const productId =
                button.dataset.id;


            if (!productId) {

                console.error(
                    "Add to Cart button has no product ID."
                );

                return;

            }


            addToCart(productId);

        }
    );


    /* ----------------------------------------------------------------------
       LOAD PRODUCTS
    ---------------------------------------------------------------------- */

    async function loadProducts() {

        try {

            showSkeletons();


            const response =
                await fetch(
                    "data/products.json",
                    {
                        cache: "no-cache"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const data =
                await response.json();


            if (!Array.isArray(data)) {

                throw new Error(
                    "products.json must contain an array."
                );

            }


            products = data;


            updateCategoryUI();

            renderProducts();

            updateCartCount();


        } catch (error) {

            console.error(
                "Product loading error:",
                error
            );


            if (productGrid) {

                productGrid.innerHTML = `
                    <div class="products-error">
                        <h3>Unable to load products</h3>
                        <p>
                            Please refresh the page and try again.
                        </p>
                        <button
                            type="button"
                            class="btn btn-primary"
                            onclick="location.reload()">
                            Try Again
                        </button>
                    </div>
                `;

            }

        }

    }


    /* ----------------------------------------------------------------------
       INITIALIZE
    ---------------------------------------------------------------------- */

    updateCartCount();

    loadProducts();

});
