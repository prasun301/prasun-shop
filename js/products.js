"use strict";

/**

* ============================================================================
* PRASUN SHOP — Products Page
* ============================================================================
* Responsibilities:
* * Load products from data/products.json
* * Search
* * Category filtering
* * Sorting
* * Product navigation
* * Cart integration
* * Cart badge synchronization
* * Loading / empty / error states
* * Keyboard search shortcut
* ============================================================================
  */

document.addEventListener("DOMContentLoaded", () => {

```
/* ------------------------------------------------------------------------
   Configuration
   ------------------------------------------------------------------------ */

const PRODUCTS_URL = "data/products.json";
const CART_KEY = "prasun_cart";


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
   State
   ------------------------------------------------------------------------ */

let products = [];

let currentCategory = "all";
let currentSearch = "";
let currentSort = "featured";


/* ------------------------------------------------------------------------
   Utilities
   ------------------------------------------------------------------------ */

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
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


function getProductId(product) {
    return product?.id ?? product?.productId ?? "";
}


function getProductName(product) {
    return (
        product?.name ??
        product?.title ??
        "Untitled Product"
    );
}


function getProductCategory(product) {
    return (
        product?.category ??
        "Uncategorized"
    );
}


function getProductDescription(product) {
    return (
        product?.description ??
        product?.shortDescription ??
        ""
    );
}


function getProductImage(product) {
    return (
        product?.image ??
        product?.imageUrl ??
        product?.thumbnail ??
        ""
    );
}


function getProductPrice(product) {
    const price = Number(
        product?.price ?? 0
    );

    return Number.isFinite(price)
        ? price
        : 0;
}


/* ------------------------------------------------------------------------
   Cart
   ------------------------------------------------------------------------ */

function getCart() {
    try {
        const stored = localStorage.getItem(CART_KEY);

        if (!stored) {
            return [];
        }

        const cart = JSON.parse(stored);

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

    const cart = getCart();

    const totalItems = cart.reduce(
        (total, item) => {
            const quantity = Number(
                item?.quantity ?? 1
            );

            return total +
                (Number.isFinite(quantity)
                    ? Math.max(quantity, 0)
                    : 0);
        },
        0
    );

    cartCount.textContent =
        totalItems > 99
            ? "99+"
            : String(totalItems);

    cartCount.hidden = totalItems === 0;
}


function addToCart(product) {
    const cart = getCart();

    const productId = getProductId(product);

    const existing = cart.find(
        item =>
            String(item.id) ===
            String(productId)
    );

    if (existing) {
        existing.quantity =
            Number(existing.quantity || 1) + 1;

    } else {
        cart.push({
            ...product,
            id: productId,
            quantity: 1
        });
    }

    saveCart(cart);
    updateCartBadge();
}


/* ------------------------------------------------------------------------
   Product Filtering
   ------------------------------------------------------------------------ */

function getFilteredProducts() {

    const query = normalize(
        currentSearch
    );

    let filtered = products.filter(product => {

        const category =
            normalize(
                getProductCategory(product)
            );

        const name =
            normalize(
                getProductName(product)
            );

        const description =
            normalize(
                getProductDescription(product)
            );

        const matchesCategory =
            currentCategory === "all" ||
            category === normalize(
                currentCategory
            );

        const matchesSearch =
            !query ||
            name.includes(query) ||
            description.includes(query) ||
            category.includes(query);

        return (
            matchesCategory &&
            matchesSearch
        );
    });


    /* --------------------------------------------------------------------
       Sorting
       -------------------------------------------------------------------- */

    switch (currentSort) {

        case "price-low":
            filtered.sort(
                (a, b) =>
                    getProductPrice(a) -
                    getProductPrice(b)
            );
            break;

        case "price-high":
            filtered.sort(
                (a, b) =>
                    getProductPrice(b) -
                    getProductPrice(a)
            );
            break;

        case "name":
            filtered.sort(
                (a, b) =>
                    getProductName(a).localeCompare(
                        getProductName(b),
                        undefined,
                        {
                            sensitivity: "base"
                        }
                    )
            );
            break;

        case "featured":
        default:
            /*
             * Preserve the original JSON order.
             */
            break;
    }

    return filtered;
}


/* ------------------------------------------------------------------------
   Product Card
   ------------------------------------------------------------------------ */

function createProductCard(product) {

    const id = getProductId(product);
    const name = getProductName(product);
    const category = getProductCategory(product);
    const description =
        getProductDescription(product);

    const image =
        getProductImage(product);

    const price =
        getProductPrice(product);


    const article =
        document.createElement("article");

    article.className = "product-card";


    /* Product link */

    const link =
        document.createElement("a");

    link.className = "product-card-link";

    link.href =
        `product-detail.html?id=${encodeURIComponent(id)}`;

    link.setAttribute(
        "aria-label",
        `View ${name}`
    );


    /* Image */

    const imageWrap =
        document.createElement("div");

    imageWrap.className =
        "product-card-image";


    const img =
        document.createElement("img");

    img.alt = name;

    img.loading = "lazy";

    img.decoding = "async";

    img.src = image;

    img.addEventListener(
        "error",
        () => {
            imageWrap.classList.add(
                "image-error"
            );
        },
        { once: true }
    );


    /* Category badge */

    const categoryBadge =
        document.createElement("span");

    categoryBadge.className =
        "product-category";

    categoryBadge.textContent =
        category;


    imageWrap.appendChild(img);
    imageWrap.appendChild(categoryBadge);

    link.appendChild(imageWrap);


    /* Body */

    const body =
        document.createElement("div");

    body.className =
        "product-card-body";


    const title =
        document.createElement("h2");

    title.className =
        "product-title";

    title.textContent =
        name;


    const descriptionElement =
        document.createElement("p");

    descriptionElement.className =
        "product-description";

    descriptionElement.textContent =
        description;


    const bottom =
        document.createElement("div");

    bottom.className =
        "product-bottom";


    const priceElement =
        document.createElement("p");

    priceElement.className =
        "product-price";

    priceElement.textContent =
        formatPrice(price);


    const cartButton =
        document.createElement("button");

    cartButton.type = "button";

    cartButton.className =
        "product-cart-button";

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


    /* Add to cart */

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


    bottom.appendChild(
        priceElement
    );

    bottom.appendChild(
        cartButton
    );


    body.appendChild(title);

    if (description) {
        body.appendChild(
            descriptionElement
        );
    }

    body.appendChild(bottom);


    article.appendChild(link);
    article.appendChild(body);


    return article;
}


/* ------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------ */

function renderProducts() {

    const filtered =
        getFilteredProducts();


    grid.innerHTML = "";

    grid.setAttribute(
        "aria-busy",
        "true"
    );


    if (!filtered.length) {

        grid.hidden = true;

        emptyState.hidden = false;

        count.textContent =
            "0 products found";

        grid.setAttribute(
            "aria-busy",
            "false"
        );

        return;
    }


    emptyState.hidden = true;

    grid.hidden = false;


    const fragment =
        document.createDocumentFragment();


    filtered.forEach(product => {

        fragment.appendChild(
            createProductCard(product)
        );

    });


    grid.appendChild(fragment);


    count.textContent =
        filtered.length === 1
            ? "Showing 1 product"
            : `Showing ${filtered.length} products`;


    grid.setAttribute(
        "aria-busy",
        "false"
    );
}


/* ------------------------------------------------------------------------
   Loading
   ------------------------------------------------------------------------ */

function setLoadingState() {

    grid.hidden = false;

    emptyState.hidden = true;

    errorState.hidden = true;

    grid.setAttribute(
        "aria-busy",
        "true"
    );

    count.textContent =
        "Loading products…";
}


function setErrorState() {

    grid.innerHTML = "";

    grid.hidden = true;

    emptyState.hidden = true;

    errorState.hidden = false;

    count.textContent =
        "Unable to load products";

    grid.setAttribute(
        "aria-busy",
        "false"
    );
}


async function loadProducts() {

    setLoadingState();

    try {

        const response =
            await fetch(
                PRODUCTS_URL,
                {
                    cache: "no-store"
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
                "products.json must contain an array"
            );
        }


        products = data;


        renderProducts();


    } catch (error) {

        console.error(
            "Products loading failed:",
            error
        );

        setErrorState();
    }
}


/* ------------------------------------------------------------------------
   Search
   ------------------------------------------------------------------------ */

function updateSearchUI() {

    if (!searchClear) {
        return;
    }

    searchClear.hidden =
        searchInput.value.length === 0;
}


searchInput?.addEventListener(
    "input",
    event => {

        currentSearch =
            event.target.value.trim();

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

        searchInput.value = "";

        currentSearch = "";

        updateSearchUI();

        searchInput.focus();

        renderProducts();
    }
);


/* ------------------------------------------------------------------------
   Category
   ------------------------------------------------------------------------ */

categoryButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            currentCategory =
                button.dataset.category ||
                "all";


            categoryButtons.forEach(
                item => {

                    const active =
                        item === button;

                    item.classList.toggle(
                        "active",
                        active
                    );

                    item.setAttribute(
                        "aria-pressed",
                        String(active)
                    );
                }
            );


            renderProducts();
        }
    );
});


/* ------------------------------------------------------------------------
   Sorting
   ------------------------------------------------------------------------ */

sortSelect?.addEventListener(
    "change",
    event => {

        currentSort =
            event.target.value;

        renderProducts();
    }
);


/* ------------------------------------------------------------------------
   Reset
   ------------------------------------------------------------------------ */

function resetFilters() {

    currentCategory = "all";

    currentSearch = "";

    currentSort = "featured";


    searchInput.value = "";

    sortSelect.value = "featured";


    categoryButtons.forEach(
        button => {

            const active =
                button.dataset.category === "all";

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
   Keyboard Shortcut
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
            searchInput.value
        ) {

            searchClear?.click();
        }
    }
);


/* ------------------------------------------------------------------------
   Mobile Menu
   ------------------------------------------------------------------------ */

menuToggle?.addEventListener(
    "click",
    () => {

        const isOpen =
            menuToggle.getAttribute(
                "aria-expanded"
            ) === "true";


        menuToggle.setAttribute(
            "aria-expanded",
            String(!isOpen)
        );


        if (mobileMenu) {
            mobileMenu.hidden = isOpen;
        }
    }
);


/* ------------------------------------------------------------------------
   Footer Year
   ------------------------------------------------------------------------ */

if (footerYear) {
    footerYear.textContent =
        new Date().getFullYear();
}


/* ------------------------------------------------------------------------
   Initial Cart State
   ------------------------------------------------------------------------ */

updateCartBadge();


/* ------------------------------------------------------------------------
   Cross-tab cart synchronization
   ------------------------------------------------------------------------ */

window.addEventListener(
    "storage",
    event => {

        if (event.key === CART_KEY) {
            updateCartBadge();
        }
    }
);


/* ------------------------------------------------------------------------
   Start
   ------------------------------------------------------------------------ */

loadProducts();
```

});
