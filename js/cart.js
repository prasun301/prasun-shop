/**
 * ============================================================================
 * PRASUN SHOP — CART SYSTEM
 * ============================================================================
 *
 * Canonical localStorage key:
 *
 *     prasun_cart
 *
 * Cart item format:
 *
 * {
 *     id: "CJ product ID / internal ID",
 *     sku: "product SKU",
 *     cjProductId: "CJ product ID",
 *     cjSku: "CJ SKU",
 *     vid: "CJ variant ID",
 *     variantSku: "CJ variant SKU",
 *     name: "Product name",
 *     price: 29.99,
 *     image: "...",
 *     category: "Category",
 *     quantity: 1
 * }
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY =
        "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const API_BASE =
        "https://prasun-shop-api.prasun301.workers.dev";

    const PRODUCTS_ENDPOINT =
        `${API_BASE}/api/products`;

    const MAX_QUANTITY =
        99;

    const currency =
        new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );


    /* ========================================================================
       HELPERS
       ======================================================================== */

    function money(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? currency.format(number)
            : "$0.00";
    }


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(
                /[&<>"']/g,
                char => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                })[char]
            );
    }


    function normalizeQuantity(value) {

        const number =
            Math.floor(
                Number(value)
            );

        if (
            !Number.isFinite(number) ||
            number < 1
        ) {
            return 1;
        }

        return Math.min(
            number,
            MAX_QUANTITY
        );
    }


    /* ========================================================================
       NORMALIZE CART ITEM
       ======================================================================== */

    function normalizeItem(item) {

        if (
            !item ||
            (
                item.id === undefined &&
                item.productId === undefined &&
                item.cjProductId === undefined
            )
        ) {
            return null;
        }

        const id =
            String(
                item.id ??
                item.productId ??
                item.cjProductId
            );

        return {

            id,

            sku:
                String(
                    item.sku ??
                    ""
                ),

            cjProductId:
                String(
                    item.cjProductId ??
                    item.productId ??
                    item.id ??
                    ""
                ),

            cjSku:
                String(
                    item.cjSku ??
                    item.variantSku ??
                    item.sku ??
                    ""
                ),

            vid:
                String(
                    item.vid ??
                    item.variantId ??
                    ""
                ),

            variantSku:
                String(
                    item.variantSku ??
                    item.cjSku ??
                    item.sku ??
                    ""
                ),

            name:
                String(
                    item.name ??
                    "Product"
                ),

            price:
                Number(
                    item.price
                ) || 0,

            image:
                String(
                    item.image ??
                    ""
                ),

            category:
                String(
                    item.category ??
                    ""
                ),

            variantOptions:
                String(
                    item.variantOptions ??
                    ""
                ),

            quantity:
                normalizeQuantity(
                    item.quantity
                )
        };
    }


    /* ========================================================================
       READ CART
       ======================================================================== */

    function readCart() {

        try {

            const primary =
                localStorage.getItem(
                    CART_KEY
                );

            if (primary) {

                const parsed =
                    JSON.parse(
                        primary
                    );

                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    return parsed
                        .map(
                            normalizeItem
                        )
                        .filter(Boolean);
                }
            }

            /*
             * Legacy migration.
             */

            for (
                const key
                of LEGACY_KEYS
            ) {

                const raw =
                    localStorage.getItem(
                        key
                    );

                if (!raw) {
                    continue;
                }

                try {

                    const parsed =
                        JSON.parse(
                            raw
                        );

                    if (
                        Array.isArray(
                            parsed
                        ) &&
                        parsed.length
                    ) {

                        const migrated =
                            parsed
                                .map(
                                    normalizeItem
                                )
                                .filter(Boolean);

                        if (
                            migrated.length
                        ) {

                            saveCart(
                                migrated
                            );

                            return migrated;
                        }
                    }

                } catch {
                    continue;
                }
            }

            return [];

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
        }
    }


    /* ========================================================================
       SAVE CART
       ======================================================================== */

    function saveCart(items) {

        const normalized =
            items
                .map(
                    normalizeItem
                )
                .filter(Boolean);

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(
                    normalized
                )
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );
        }

        updateCartCount();

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: {
                        cart:
                            normalized
                    }
                }
            )
        );

        return normalized;
    }


    /* ========================================================================
       CLEAR LEGACY CARTS
       ======================================================================== */

    function clearLegacyKeys() {

        try {

            LEGACY_KEYS.forEach(
                key => {

                    localStorage.removeItem(
                        key
                    );
                }
            );

        } catch {
            /* Ignore storage errors. */
        }
    }


    /* ========================================================================
       UPDATE HEADER COUNT
       ======================================================================== */

    function updateCartCount() {

        const cart =
            readCart();

        const count =
            cart.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    normalizeQuantity(
                        item.quantity
                    ),
                0
            );

        const elements =
            document.querySelectorAll(
                "#cart-count"
            );

        elements.forEach(
            element => {

                element.textContent =
                    String(count);

                element.setAttribute(
                    "aria-label",
                    `${count} ${
                        count === 1
                            ? "item"
                            : "items"
                    } in cart`
                );

                if (count > 0) {

                    element.hidden =
                        false;

                } else {

                    element.hidden =
                        true;
                }
            }
        );
    }


    /* ========================================================================
       FETCH PRODUCT
       ======================================================================== */

    async function fetchProduct(
        identifier
    ) {

        const response =
            await fetch(
                `${PRODUCTS_ENDPOINT}?id=${encodeURIComponent(identifier)}`,
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    },
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Product API HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data?.success ||
            !data?.product
        ) {

            throw new Error(
                "Product was not found."
            );
        }

        return data.product;
    }


    /* ========================================================================
       UPDATE ITEM
       ======================================================================== */

    function updateItemQuantity(
        index,
        quantity
    ) {

        const cart =
            readCart();

        if (
            !cart[index]
        ) {
            return;
        }

        cart[index].quantity =
            normalizeQuantity(
                quantity
            );

        saveCart(cart);

        renderCart();
    }


    /* ========================================================================
       REMOVE ITEM
       ======================================================================== */

    function removeItem(index) {

        const cart =
            readCart();

        if (
            index < 0 ||
            index >= cart.length
        ) {
            return;
        }

        cart.splice(
            index,
            1
        );

        saveCart(cart);

        renderCart();
    }


    /* ========================================================================
       CLEAR CART
       ======================================================================== */

    function clearCart() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            clearLegacyKeys();

        } catch {
            /* Ignore. */
        }

        window.dispatchEvent(
            new CustomEvent(
                "prasunCartUpdated",
                {
                    detail: {
                        cart: []
                    }
                }
            )
        );

        updateCartCount();

        renderCart();
    }


    /* ========================================================================
       EMPTY STATE
       ======================================================================== */

    function renderEmpty() {

        const container =
            document.getElementById(
                "cart-items"
            );

        if (!container) {
            return;
        }

        container.innerHTML = `

            <div class="cart-empty">

                <div
                    class="cart-empty-icon"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                    >
                        <path
                            d="M3 3h2l2.4 11.5a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6"
                        />

                        <circle
                            cx="10"
                            cy="20"
                            r="1"
                        />

                        <circle
                            cx="18"
                            cy="20"
                            r="1"
                        />
                    </svg>
                </div>

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Add products to your cart before proceeding to checkout.
                </p>

                <a
                    href="/"
                    class="continue-shopping"
                >
                    Continue Shopping
                </a>

            </div>
        `;
    }


    /* ========================================================================
       RENDER CART
       ======================================================================== */

    async function renderCart() {

        const container =
            document.getElementById(
                "cart-items"
            );

        if (!container) {
            return;
        }

        const cart =
            readCart();

        updateCartCount();

        if (!cart.length) {

            renderEmpty();

            updateSummary(
                0,
                0
            );

            return;
        }

        container.setAttribute(
            "aria-busy",
            "true"
        );

        container.innerHTML = `

            <div class="cart-status">
                Loading cart products...
            </div>
        `;

        let total =
            0;

        let itemCount =
            0;

        const resolvedItems = [];

        for (
            let index = 0;
            index < cart.length;
            index++
        ) {

            const item =
                cart[index];

            let product = null;

            try {

                product =
                    await fetchProduct(
                        item.cjProductId ||
                        item.id
                    );

            } catch {

                /*
                 * Use information already stored
                 * in localStorage if API lookup fails.
                 */

                product = {
                    id:
                        item.id,

                    sku:
                        item.sku,

                    cjProductId:
                        item.cjProductId,

                    cjSku:
                        item.cjSku,

                    name:
                        item.name,

                    category:
                        item.category,

                    price:
                        item.price,

                    image:
                        item.image,

                    variants: []
                };
            }

            const quantity =
                normalizeQuantity(
                    item.quantity
                );

            const price =
                Number(
                    product.price ??
                    item.price
                ) || 0;

            const subtotal =
                price *
                quantity;

            total +=
                subtotal;

            itemCount +=
                quantity;

            resolvedItems.push({

                index,

                item,

                product,

                quantity,

                price,

                subtotal
            });
        }


        if (!resolvedItems.length) {

            renderEmpty();

            updateSummary(
                0,
                0
            );

            return;
        }


        let html = "";

        resolvedItems.forEach(
            ({
                index,
                item,
                product,
                quantity,
                price,
                subtotal
            }) => {

                const name =
                    escapeHTML(
                        product.name ||
                        item.name ||
                        "Product"
                    );

                const image =
                    escapeHTML(
                        product.image ||
                        item.image ||
                        ""
                    );

                const category =
                    escapeHTML(
                        product.category ||
                        item.category ||
                        ""
                    );

                html += `

                    <article
                        class="cart-item"
                        data-index="${index}"
                    >

                        <div class="cart-item-product">

                            <a
                                href="/"
                                class="cart-item-image-link"
                                aria-label="${name}"
                            >

                                <img
                                    src="${image}"
                                    alt="${name}"
                                    class="cart-item-image"
                                    loading="lazy"
                                    decoding="async"
                                >

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

                                    <a href="/">
                                        ${name}
                                    </a>

                                </h3>

                                <p class="cart-item-price">
                                    ${money(price)} each
                                </p>

                            </div>

                        </div>


                        <div class="cart-item-controls">

                            <div
                                class="quantity-control"
                                aria-label="Quantity"
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
                                    ${money(subtotal)}
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
        );


        container.innerHTML =
            html;

        container.setAttribute(
            "aria-busy",
            "false"
        );

        updateSummary(
            itemCount,
            total
        );

        /*
         * Store resolved product information back
         * into canonical cart.
         */

        const refreshedCart =
            cart.map(
                (
                    item,
                    index
                ) => {

                    const resolved =
                        resolvedItems.find(
                            entry =>
                                entry.index ===
                                index
                        );

                    if (
                        !resolved
                    ) {
                        return item;
                    }

                    const product =
                        resolved.product;

                    return normalizeItem({
                        ...item,

                        id:
                            item.id ||
                            product.id,

                        sku:
                            product.sku ||
                            item.sku,

                        cjProductId:
                            product.cjProductId ||
                            item.cjProductId ||
                            product.id,

                        cjSku:
                            product.cjSku ||
                            item.cjSku ||
                            product.sku,

                        name:
                            product.name ||
                            item.name,

                        price:
                            Number(
                                product.price
                            ) || item.price,

                        image:
                            product.image ||
                            item.image,

                        category:
                            product.category ||
                            item.category
                    });
                }
            );

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(
                    refreshedCart
                )
            );

        } catch {
            /* Ignore. */
        }
    }


    /* ========================================================================
       SUMMARY
       ======================================================================== */

    function updateSummary(
        itemCount,
        total
    ) {

        const countElement =
            document.getElementById(
                "summary-item-count"
            );

        const subtotalElement =
            document.getElementById(
                "cart-subtotal"
            );

        const totalElement =
            document.getElementById(
                "cart-total"
            );

        const itemsCountElement =
            document.getElementById(
                "cart-items-count"
            );

        const checkoutButton =
            document.getElementById(
                "checkout-button"
            );

        const clearButton =
            document.getElementById(
                "clear-cart-button"
            );

        if (countElement) {

            countElement.textContent =
                String(itemCount);
        }

        if (subtotalElement) {

            subtotalElement.textContent =
                money(total);
        }

        if (totalElement) {

            totalElement.textContent =
                money(total);
        }

        if (itemsCountElement) {

            itemsCountElement.textContent =
                `${itemCount} ${
                    itemCount === 1
                        ? "item"
                        : "items"
                }`;
        }

        if (checkoutButton) {

            checkoutButton.disabled =
                itemCount < 1;

            checkoutButton.setAttribute(
                "aria-disabled",
                itemCount < 1
                    ? "true"
                    : "false"
            );
        }

        if (clearButton) {

            clearButton.disabled =
                itemCount < 1;
        }
    }


    /* ========================================================================
       EVENTS
       ======================================================================== */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            const index =
                Number(
                    button.dataset.index
                );

            if (
                !Number.isInteger(
                    index
                )
            ) {
                return;
            }

            const cart =
                readCart();

            if (
                !cart[index]
            ) {
                return;
            }

            if (
                action ===
                "increase"
            ) {

                updateItemQuantity(
                    index,
                    cart[index].quantity +
                    1
                );

            } else if (
                action ===
                "decrease"
            ) {

                updateItemQuantity(
                    index,
                    cart[index].quantity -
                    1
                );

            } else if (
                action ===
                "remove"
            ) {

                removeItem(
                    index
                );
            }
        }
    );


    document.addEventListener(
        "change",
        event => {

            const input =
                event.target.closest(
                    ".quantity-input"
                );

            if (!input) {
                return;
            }

            const index =
                Number(
                    input.dataset.index
                );

            updateItemQuantity(
                index,
                input.value
            );
        }
    );


    const clearButton =
        document.getElementById(
            "clear-cart-button"
        );

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                if (
                    !readCart().length
                ) {
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


    const checkoutButton =
        document.getElementById(
            "checkout-button"
        );

    if (checkoutButton) {

        checkoutButton.addEventListener(
            "click",
            () => {

                if (
                    !readCart().length
                ) {
                    return;
                }

                window.location.href =
                    "/checkout.html";
            }
        );
    }


    /* ========================================================================
       CROSS-TAB SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                    CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {

                renderCart();
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        () => {

            updateCartCount();

        }
    );


    /* ========================================================================
       PUBLIC API
       ======================================================================== */

    window.PrasunCart = {

        getCart:
            () =>
                readCart(),

        saveCart:
            items =>
                saveCart(items),

        clearCart:
            () =>
                clearCart(),

        updateQuantity:
            (
                index,
                quantity
            ) =>
                updateItemQuantity(
                    index,
                    quantity
                ),

        remove:
            index =>
                removeItem(index),

        count:
            () =>
                readCart()
                    .reduce(
                        (
                            total,
                            item
                        ) =>
                            total +
                            normalizeQuantity(
                                item.quantity
                            ),
                        0
                    )
    };


    /* ========================================================================
       INITIALIZE
       ======================================================================== */

    clearLegacyKeys();

    updateCartCount();

    renderCart();

})();
