/**
 * ============================================================================
 * PRASUN SHOP — CART SYSTEM
 * ============================================================================
 *
 * Canonical localStorage key:
 *     prasun_cart
 *
 * Cart item structure:
 *
 * {
 *   id: "CJ_PRODUCT_ID_OR_INTERNAL_ID",
 *   sku: "CJ_PRODUCT_SKU",
 *   cjProductId: "CJ_PRODUCT_ID",
 *   cjSku: "CJ_PRODUCT_SKU",
 *   variantId: "CJ_VARIANT_ID",
 *   variantSku: "CJ_VARIANT_SKU",
 *   name: "Product name",
 *   category: "Category",
 *   price: 29.99,
 *   image: "https://...",
 *   quantity: 1
 * }
 *
 * ============================================================================
 */

"use strict";

(() => {
    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    const MAX_QUANTITY = 99;
    const REQUEST_TIMEOUT_MS = 12000;

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const cartItemsElement =
        document.getElementById("cart-items");

    const cartCountElement =
        document.getElementById("cart-count");

    const cartItemsCountElement =
        document.getElementById("cart-items-count");

    const summaryItemCountElement =
        document.getElementById("summary-item-count");

    const cartSubtotalElement =
        document.getElementById("cart-subtotal");

    const cartTotalElement =
        document.getElementById("cart-total");

    const checkoutButton =
        document.getElementById("checkout-button");

    const clearCartButton =
        document.getElementById("clear-cart-button");

    const liveRegion =
        document.getElementById("cart-live-region");

    let cart = [];

    let productCache = new Map();

    let productFetchPromise = null;

    /* =========================================================================
       HELPERS
       ========================================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatPrice(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }

    function normalizeQuantity(value) {
        const number = Number(value);

        if (!Number.isFinite(number) || number <= 0) {
            return 1;
        }

        return Math.min(
            MAX_QUANTITY,
            Math.max(1, Math.floor(number))
        );
    }

    function cleanString(value) {
        return String(value ?? "").trim();
    }

    function firstNonEmpty(...values) {
        for (const value of values) {
            const cleaned = cleanString(value);

            if (cleaned) {
                return cleaned;
            }
        }

        return "";
    }

    /* =========================================================================
       PRODUCT IDENTITY
       ========================================================================= */

    function getProductIdentity(item) {
        return firstNonEmpty(
            item.cjProductId,
            item.cjPid,
            item.pid,
            item.id
        );
    }

    function getVariantIdentity(item) {
        return firstNonEmpty(
            item.variantId,
            item.variantID,
            item.vid,
            item.cjVariantId
        );
    }

    function getSKU(item) {
        return firstNonEmpty(
            item.cjSku,
            item.cjSKU,
            item.productSku,
            item.sku
        );
    }

    function getVariantSKU(item) {
        return firstNonEmpty(
            item.variantSku,
            item.cjVariantSku,
            item.variantSKU
        );
    }

    /* =========================================================================
       CART NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(item) {
        if (!item || typeof item !== "object") {
            return null;
        }

        const id = getProductIdentity(item);

        /*
         * A product name must NOT become the permanent product ID.
         * However, legacy carts may contain a name in `id`.
         *
         * We temporarily preserve the value and allow the checkout/lookup
         * system to resolve it when necessary.
         */
        const name = firstNonEmpty(
            item.name,
            item.productName,
            item.title,
            typeof item.id === "string" &&
                !item.id.startsWith("CJ")
                ? item.id
                : ""
        );

        if (!id && !name) {
            return null;
        }

        const price = Number(item.price);

        return {
            id: id || "",
            sku: getSKU(item),

            cjProductId:
                firstNonEmpty(
                    item.cjProductId,
                    item.cjPid,
                    item.pid,
                    item.id
                ),

            cjSku:
                firstNonEmpty(
                    item.cjSku,
                    item.cjSKU,
                    item.productSku,
                    item.sku
                ),

            variantId:
                getVariantIdentity(item),

            variantSku:
                getVariantSKU(item),

            name:
                name ||
                "Product",

            category:
                firstNonEmpty(
                    item.category,
                    item.categoryName
                ),

            price:
                Number.isFinite(price) && price >= 0
                    ? Number(price.toFixed(2))
                    : 0,

            image:
                firstNonEmpty(
                    item.image,
                    item.imageUrl,
                    item.thumbnail
                ),

            quantity:
                normalizeQuantity(item.quantity)
        };
    }

    function normalizeCartArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        const normalized = [];

        for (const item of value) {
            const normalizedItem =
                normalizeCartItem(item);

            if (normalizedItem) {
                normalized.push(normalizedItem);
            }
        }

        return normalized;
    }

    /* =========================================================================
       STORAGE
       ========================================================================= */

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error(
                "[PRASUN SHOP] localStorage read error:",
                error
            );

            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error(
                "[PRASUN SHOP] localStorage write error:",
                error
            );

            return false;
        }
    }

    function readCartFromStorage() {
        const primary = readStorage(CART_KEY);

        if (primary) {
            try {
                const parsed = JSON.parse(primary);

                if (Array.isArray(parsed)) {
                    return normalizeCartArray(parsed);
                }
            } catch (error) {
                console.error(
                    "[PRASUN SHOP] Invalid primary cart:",
                    error
                );
            }
        }

        /*
         * Legacy migration
         */
        for (const key of LEGACY_KEYS) {
            const raw = readStorage(key);

            if (!raw) {
                continue;
            }

            try {
                const parsed = JSON.parse(raw);

                if (!Array.isArray(parsed)) {
                    continue;
                }

                const migrated =
                    normalizeCartArray(parsed);

                if (migrated.length) {
                    saveCart(migrated);
                    return migrated;
                }
            } catch (error) {
                console.error(
                    "[PRASUN SHOP] Legacy cart migration error:",
                    error
                );
            }
        }

        return [];
    }

    function saveCart(nextCart) {
        cart = normalizeCartArray(nextCart);

        writeStorage(
            CART_KEY,
            JSON.stringify(cart)
        );

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: {
                        cart: cart.map(item => ({ ...item }))
                    }
                }
            )
        );

        return cart;
    }

    function clearAllCartStorage() {
        try {
            localStorage.removeItem(CART_KEY);

            for (const key of LEGACY_KEYS) {
                localStorage.removeItem(key);
            }
        } catch (error) {
            console.error(
                "[PRASUN SHOP] Cart clearing error:",
                error
            );
        }
    }

    /* =========================================================================
       FETCH
       ========================================================================= */

    async function fetchWithTimeout(
        resource,
        options = {},
        timeout = REQUEST_TIMEOUT_MS
    ) {
        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                timeout
            );

        try {
            return await fetch(
                resource,
                {
                    ...options,
                    signal: controller.signal
                }
            );
        } catch (error) {
            if (error?.name === "AbortError") {
                throw new Error(
                    "Product request timed out."
                );
            }

            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchProducts() {
        if (productCache.size > 0) {
            return productCache;
        }

        if (productFetchPromise) {
            return productFetchPromise;
        }

        productFetchPromise = (async () => {
            try {
                const response =
                    await fetchWithTimeout(
                        PRODUCTS_ENDPOINT,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            cache: "no-store"
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `Product API HTTP ${response.status}`
                    );
                }

                const data =
                    await response.json();

                const products =
                    Array.isArray(data)
                        ? data
                        : Array.isArray(data?.products)
                            ? data.products
                            : data?.product
                                ? [data.product]
                                : [];

                for (const product of products) {
                    if (!product) {
                        continue;
                    }

                    const keys = [
                        product.id,
                        product.pid,
                        product.productId,
                        product.sku,
                        product.productSku,
                        product.productSkuEn
                    ];

                    for (const key of keys) {
                        if (
                            key !== undefined &&
                            key !== null &&
                            String(key).trim()
                        ) {
                            productCache.set(
                                String(key),
                                product
                            );
                        }
                    }
                }

                return productCache;
            } finally {
                productFetchPromise = null;
            }
        })();

        return productFetchPromise;
    }

    /* =========================================================================
       PRODUCT RESOLUTION
       ========================================================================= */

    function findCachedProduct(item) {
        const keys = [
            item.id,
            item.cjProductId,
            item.sku,
            item.cjSku,
            item.variantId,
            item.variantSku
        ];

        for (const key of keys) {
            if (!key) {
                continue;
            }

            const product =
                productCache.get(
                    String(key)
                );

            if (product) {
                return product;
            }
        }

        return null;
    }

    /* =========================================================================
       CART MERGING
       ========================================================================= */

    function sameCartProduct(a, b) {
        const aVariant =
            getVariantIdentity(a);

        const bVariant =
            getVariantIdentity(b);

        if (aVariant || bVariant) {
            return (
                aVariant &&
                bVariant &&
                aVariant === bVariant
            );
        }

        const aId =
            getProductIdentity(a);

        const bId =
            getProductIdentity(b);

        if (aId && bId) {
            return aId === bId;
        }

        const aSku =
            getSKU(a);

        const bSku =
            getSKU(b);

        if (aSku && bSku) {
            return aSku === bSku;
        }

        return (
            cleanString(a.name).toLowerCase() ===
            cleanString(b.name).toLowerCase()
        );
    }

    function addProduct(product, quantity = 1) {
        if (!product || typeof product !== "object") {
            return false;
        }

        const normalized =
            normalizeCartItem({
                ...product,
                quantity
            });

        if (!normalized) {
            console.error(
                "[PRASUN SHOP] Invalid product:",
                product
            );

            return false;
        }

        const existingIndex =
            cart.findIndex(
                item =>
                    sameCartProduct(
                        item,
                        normalized
                    )
            );

        if (existingIndex >= 0) {
            cart[existingIndex].quantity =
                normalizeQuantity(
                    cart[existingIndex].quantity +
                    normalized.quantity
                );

            /*
             * Refresh metadata from latest product.
             */
            cart[existingIndex] = {
                ...cart[existingIndex],
                ...normalized,
                quantity:
                    cart[existingIndex].quantity
            };
        } else {
            cart.push(normalized);
        }

        saveCart(cart);
        renderCart();

        announce(
            `${normalized.name} added to cart.`
        );

        return true;
    }

    function updateQuantity(index, quantity) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        const normalized =
            normalizeQuantity(quantity);

        cart[index].quantity =
            normalized;

        saveCart(cart);
        renderCart();

        announce(
            `${cart[index].name} quantity updated to ${normalized}.`
        );
    }

    function removeItem(index) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        const removed =
            cart[index];

        cart.splice(index, 1);

        saveCart(cart);
        renderCart();

        announce(
            `${removed.name} removed from cart.`
        );
    }

    function clearCart() {
        cart = [];

        clearAllCartStorage();

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: { cart: [] }
                }
            )
        );

        renderCart();

        announce(
            "Cart cleared."
        );
    }

    /* =========================================================================
       RENDER
       ========================================================================= */

    function updateHeaderCount() {
        const totalQuantity =
            cart.reduce(
                (sum, item) =>
                    sum +
                    normalizeQuantity(
                        item.quantity
                    ),
                0
            );

        if (cartCountElement) {
            cartCountElement.textContent =
                String(totalQuantity);

            cartCountElement.hidden =
                totalQuantity <= 0;

            cartCountElement.setAttribute(
                "aria-label",
                `${totalQuantity} items in cart`
            );
        }

        if (cartItemsCountElement) {
            cartItemsCountElement.textContent =
                `${totalQuantity} ${
                    totalQuantity === 1
                        ? "item"
                        : "items"
                }`;
        }

        if (summaryItemCountElement) {
            summaryItemCountElement.textContent =
                String(totalQuantity);
        }
    }

    function renderEmptyCart() {
        if (!cartItemsElement) {
            return;
        }

        cartItemsElement.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon"
                     aria-hidden="true">

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle
                            cx="9"
                            cy="20"
                            r="1"
                        ></circle>

                        <circle
                            cx="19"
                            cy="20"
                            r="1"
                        ></circle>

                        <path
                            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"
                        ></path>
                    </svg>

                </div>

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Browse our products and add something
                    to your cart to continue shopping.
                </p>

                <a
                    href="/products.html"
                    class="continue-shopping"
                >
                    Continue Shopping
                </a>
            </div>
        `;
    }

    function renderCart() {
        cart =
            readCartFromStorage();

        updateHeaderCount();

        if (
            !cartItemsElement
        ) {
            return;
        }

        if (!cart.length) {
            renderEmptyCart();

            if (cartSubtotalElement) {
                cartSubtotalElement.textContent =
                    "$0.00";
            }

            if (cartTotalElement) {
                cartTotalElement.textContent =
                    "$0.00";
            }

            if (checkoutButton) {
                checkoutButton.disabled =
                    true;

                checkoutButton.setAttribute(
                    "aria-disabled",
                    "true"
                );
            }

            if (clearCartButton) {
                clearCartButton.disabled =
                    true;
            }

            return;
        }

        let subtotal = 0;

        const html =
            cart.map(
                (item, index) => {
                    const quantity =
                        normalizeQuantity(
                            item.quantity
                        );

                    const price =
                        Number(item.price) || 0;

                    const itemSubtotal =
                        price * quantity;

                    subtotal +=
                        itemSubtotal;

                    const image =
                        escapeHTML(
                            item.image ||
                            ""
                        );

                    const name =
                        escapeHTML(
                            item.name ||
                            "Product"
                        );

                    const category =
                        escapeHTML(
                            item.category ||
                            ""
                        );

                    return `
                        <article
                            class="cart-item"
                            data-cart-index="${index}"
                        >

                            <div class="cart-item-product">

                                <a
                                    href="/products.html"
                                    class="cart-item-image-link"
                                    aria-label="${name}"
                                >
                                    ${
                                        image
                                            ? `
                                                <img
                                                    src="${image}"
                                                    alt="${name}"
                                                    class="cart-item-image"
                                                    loading="lazy"
                                                    decoding="async"
                                                >
                                              `
                                            : `
                                                <div
                                                    class="cart-item-image"
                                                    aria-hidden="true"
                                                ></div>
                                              `
                                    }
                                </a>

                                <div class="cart-item-info">

                                    ${
                                        category
                                            ? `
                                                <span class="cart-item-category">
                                                    ${category}
                                                </span>
                                              `
                                            : ""
                                    }

                                    <h3 class="cart-item-title">
                                        <a href="/products.html">
                                            ${name}
                                        </a>
                                    </h3>

                                    <p class="cart-item-price">
                                        ${formatPrice(price)} each
                                    </p>

                                </div>

                            </div>

                            <div class="cart-item-controls">

                                <div
                                    class="quantity-control"
                                    aria-label="Quantity controls"
                                >

                                    <button
                                        type="button"
                                        data-action="decrease"
                                        data-index="${index}"
                                        aria-label="Decrease quantity"
                                    >
                                        −
                                    </button>

                                    <input
                                        class="quantity-input"
                                        type="number"
                                        min="1"
                                        max="${MAX_QUANTITY}"
                                        value="${quantity}"
                                        data-action="quantity"
                                        data-index="${index}"
                                        aria-label="Quantity for ${name}"
                                    >

                                    <button
                                        type="button"
                                        data-action="increase"
                                        data-index="${index}"
                                        aria-label="Increase quantity"
                                    >
                                        +
                                    </button>

                                </div>

                                <div class="cart-item-subtotal">

                                    <strong>
                                        ${formatPrice(itemSubtotal)}
                                    </strong>

                                    <button
                                        type="button"
                                        class="cart-remove-button"
                                        data-action="remove"
                                        data-index="${index}"
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </article>
                    `;
                }
            ).join("");

        cartItemsElement.innerHTML =
            html;

        if (cartSubtotalElement) {
            cartSubtotalElement.textContent =
                formatPrice(subtotal);
        }

        if (cartTotalElement) {
            cartTotalElement.textContent =
                formatPrice(subtotal);
        }

        if (checkoutButton) {
            checkoutButton.disabled =
                false;

            checkoutButton.setAttribute(
                "aria-disabled",
                "false"
            );
        }

        if (clearCartButton) {
            clearCartButton.disabled =
                false;
        }
    }

    /* =========================================================================
       EVENTS
       ========================================================================= */

    function announce(message) {
        if (!liveRegion) {
            return;
        }

        liveRegion.textContent = "";

        setTimeout(() => {
            liveRegion.textContent =
                message;
        }, 20);
    }

    if (cartItemsElement) {
        cartItemsElement.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "button[data-action]"
                    );

                if (!button) {
                    return;
                }

                const index =
                    Number(
                        button.dataset.index
                    );

                const action =
                    button.dataset.action;

                if (
                    !Number.isInteger(index)
                ) {
                    return;
                }

                if (
                    action ===
                    "increase"
                ) {
                    updateQuantity(
                        index,
                        cart[index].quantity + 1
                    );
                }

                if (
                    action ===
                    "decrease"
                ) {
                    updateQuantity(
                        index,
                        cart[index].quantity - 1
                    );
                }

                if (
                    action ===
                    "remove"
                ) {
                    removeItem(index);
                }
            }
        );

        cartItemsElement.addEventListener(
            "change",
            event => {
                const input =
                    event.target.closest(
                        'input[data-action="quantity"]'
                    );

                if (!input) {
                    return;
                }

                const index =
                    Number(
                        input.dataset.index
                    );

                updateQuantity(
                    index,
                    Number(input.value)
                );
            }
        );
    }

    if (checkoutButton) {
        checkoutButton.addEventListener(
            "click",
            () => {
                if (!cart.length) {
                    return;
                }

                window.location.href =
                    "/checkout.html";
            }
        );
    }

    if (clearCartButton) {
        clearCartButton.addEventListener(
            "click",
            () => {
                if (!cart.length) {
                    return;
                }

                if (
                    window.confirm(
                        "Are you sure you want to clear your cart?"
                    )
                ) {
                    clearCart();
                }
            }
        );
    }

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {
                cart =
                    readCartFromStorage();

                renderCart();
            }
        }
    );

    window.addEventListener(
        "prasunCartUpdated",
        () => {
            cart =
                readCartFromStorage();

            renderCart();
        }
    );

    /*
     * Public API for products.html / script.js.
     */
    window.PrasunCart = {
        getCart: () =>
            readCartFromStorage(),

        add: addProduct,

        addProduct,

        updateQuantity,

        removeItem,

        clear: clearCart,

        clearCart,

        save: saveCart,

        render: renderCart
    };

    /* =========================================================================
       INITIALIZE
       ========================================================================= */

    cart =
        readCartFromStorage();

    renderCart();

    /*
     * Attempt to enrich old cart entries with product data.
     */
    if (cart.length) {
        fetchProducts()
            .then(() => {
                let changed = false;

                cart =
                    cart.map(item => {
                        const product =
                            findCachedProduct(
                                item
                            );

                        if (!product) {
                            return item;
                        }

                        changed = true;

                        return {
                            ...item,

                            id:
                                firstNonEmpty(
                                    product.id,
                                    product.pid,
                                    item.id
                                ),

                            sku:
                                firstNonEmpty(
                                    product.sku,
                                    product.productSku,
                                    item.sku
                                ),

                            cjProductId:
                                firstNonEmpty(
                                    product.cjProductId,
                                    product.pid,
                                    product.id,
                                    item.cjProductId
                                ),

                            cjSku:
                                firstNonEmpty(
                                    product.cjSku,
                                    product.productSku,
                                    product.sku,
                                    item.cjSku
                                ),

                            name:
                                firstNonEmpty(
                                    item.name,
                                    product.name
                                ),

                            category:
                                firstNonEmpty(
                                    item.category,
                                    product.category
                                ),

                            image:
                                firstNonEmpty(
                                    item.image,
                                    product.image
                                ),

                            price:
                                Number.isFinite(
                                    Number(item.price)
                                ) &&
                                Number(item.price) > 0
                                    ? Number(item.price)
                                    : Number(product.price) || 0
                        };
                    });

                if (changed) {
                    saveCart(cart);
                    renderCart();
                }
            })
            .catch(error => {
                console.warn(
                    "[PRASUN SHOP] Cart enrichment skipped:",
                    error?.message || error
                );
            });
    }
})();
