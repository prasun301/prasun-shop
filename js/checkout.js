/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * SUPPLIER:
 *     ALIEXPRESS ONLY
 *
 * IMPORTANT:
 *     - No CJ Dropshipping
 *     - No CJ API
 *     - No CJ payment URL
 *     - No CJ order creation
 *     - No CJ credentials in browser
 *
 * FLOW:
 *
 *     Cart
 *       ↓
 *     Checkout
 *       ↓
 *     Customer enters shipping information
 *       ↓
 *     PRASUN SHOP Worker
 *       ↓
 *     Order is recorded
 *       ↓
 *     Customer sees order confirmation
 *
 * AliExpress supplier fulfillment is handled separately.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    const ORDER_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/order";

    const MAX_QUANTITY = 99;

    const REQUEST_TIMEOUT_MS = 15000;


    /* ========================================================================
       DOM
       ======================================================================== */

    const checkoutForm =
        document.getElementById("checkout-form");

    const orderSummary =
        document.getElementById("order-summary");

    const checkoutError =
        document.getElementById("checkout-error");

    const checkoutSuccess =
        document.getElementById("checkout-success");

    const checkoutStatus =
        document.getElementById("checkout-status");

    const checkoutLayout =
        document.getElementById("checkout-layout");

    const placeOrderButton =
        document.getElementById("place-order-button");

    const orderConfirmation =
        document.getElementById("order-confirmation");

    const confirmationOrderNumber =
        document.getElementById(
            "confirmation-order-number"
        );


    /* ========================================================================
       FORMATTERS
       ======================================================================== */

    const currencyFormatter =
        new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );


    function formatPrice(value) {

        const number = Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }


    /* ========================================================================
       HTML ESCAPING
       ======================================================================== */

    const ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).replace(
            /[&<>"']/g,
            character =>
                ESCAPE_MAP[character]
        );
    }


    /* ========================================================================
       CART
       ======================================================================== */

    function normalizeCartItem(item) {

        if (
            !item ||
            item.id === undefined ||
            item.id === null
        ) {
            return null;
        }

        const quantity =
            Number(item.quantity);

        return {

            id:
                String(item.id),

            quantity:
                Number.isFinite(quantity) &&
                quantity > 0
                    ? Math.min(
                        MAX_QUANTITY,
                        Math.floor(quantity)
                    )
                    : 1,

            sku:
                String(item.sku || ""),

            aliexpressId:
                String(
                    item.aliexpress_id ||
                    item.aliexpressId ||
                    ""
                ),

            variantSku:
                String(
                    item.variantSku ||
                    ""
                ),

            variantOptions:
                String(
                    item.variantOptions ||
                    ""
                )
        };
    }


    function parseCart(raw) {

        if (!raw) {
            return [];
        }

        try {

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .map(normalizeCartItem)
                .filter(Boolean);

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart parse error:",
                error
            );

            return [];
        }
    }


    function getCart() {

        try {

            const primary =
                localStorage.getItem(
                    CART_KEY
                );

            if (primary) {

                return parseCart(
                    primary
                );
            }


            for (
                const key of LEGACY_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        key
                    );

                if (!legacy) {
                    continue;
                }

                const cart =
                    parseCart(
                        legacy
                    );

                if (cart.length) {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(cart)
                    );

                    return cart;
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


    function clearCart() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            LEGACY_KEYS.forEach(
                key => {
                    localStorage.removeItem(
                        key
                    );
                }
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart clear error:",
                error
            );
        }
    }


    /* ========================================================================
       PRODUCT CACHE
       ======================================================================== */

    let productMap = new Map();

    let productsPromise = null;


    /* ========================================================================
       FETCH WITH TIMEOUT
       ======================================================================== */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const controller =
            new AbortController();

        const timeout =
            Number(
                options.timeout ||
                REQUEST_TIMEOUT_MS
            );

        const timer =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );

        try {

            const response =
                await fetch(
                    resource,
                    {
                        ...options,
                        signal:
                            controller.signal
                    }
                );

            return response;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "The request timed out. Please check your internet connection and try again."
                );
            }

            throw error;

        } finally {

            clearTimeout(timer);
        }
    }


    /* ========================================================================
       LOAD PRODUCTS
       ======================================================================== */

    async function fetchProducts() {

        if (productMap.size > 0) {
            return productMap;
        }

        if (productsPromise) {
            return productsPromise;
        }


        productsPromise =
            (async () => {

                try {

                    const response =
                        await fetchWithTimeout(
                            PRODUCTS_ENDPOINT,
                            {
                                method: "GET",
                                cache: "no-store",
                                headers: {
                                    Accept:
                                        "application/json"
                                }
                            }
                        );


                    if (!response.ok) {

                        throw new Error(
                            `Products server returned HTTP ${response.status}.`
                        );
                    }


                    const data =
                        await response.json();


                    const products =
                        Array.isArray(data)
                            ? data
                            : Array.isArray(
                                data?.products
                            )
                                ? data.products
                                : [];


                    productMap =
                        new Map();


                    products
                        .filter(Boolean)
                        .forEach(product => {

                            if (
                                product.id ===
                                undefined
                            ) {
                                return;
                            }

                            productMap.set(
                                String(product.id),
                                product
                            );
                        });


                    return productMap;

                } catch (error) {

                    productsPromise =
                        null;

                    throw error;
                }

            })();


        return productsPromise;
    }


    /* ========================================================================
       ERROR / STATUS UI
       ======================================================================== */

    function showError(message) {

        if (!checkoutError) {
            alert(message);
            return;
        }

        checkoutError.textContent =
            message;

        checkoutError.classList.add(
            "visible"
        );

        checkoutError.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }


    function hideError() {

        if (!checkoutError) {
            return;
        }

        checkoutError.textContent = "";

        checkoutError.classList.remove(
            "visible"
        );
    }


    function showSuccess(message) {

        if (!checkoutSuccess) {
            return;
        }

        checkoutSuccess.textContent =
            message;

        checkoutSuccess.classList.add(
            "visible"
        );
    }


    function hideSuccess() {

        if (!checkoutSuccess) {
            return;
        }

        checkoutSuccess.textContent = "";

        checkoutSuccess.classList.remove(
            "visible"
        );
    }


    function setStatus(message) {

        if (!checkoutStatus) {
            return;
        }

        checkoutStatus.textContent =
            message || "";
    }


    /* ========================================================================
       FORM VALIDATION
       ======================================================================== */

    function getField(id) {

        return document.getElementById(id);
    }


    function markInvalid(field) {

        if (!field) {
            return;
        }

        field.classList.add(
            "invalid"
        );

        field.setAttribute(
            "aria-invalid",
            "true"
        );
    }


    function clearInvalid(field) {

        if (!field) {
            return;
        }

        field.classList.remove(
            "invalid"
        );

        field.removeAttribute(
            "aria-invalid"
        );
    }


    function validateForm() {

        const name =
            getField(
                "customer-name"
            );

        const email =
            getField(
                "customer-email"
            );

        const phone =
            getField(
                "customer-phone"
            );

        const country =
            getField(
                "shipping-country"
            );

        const countryCode =
            getField(
                "shipping-country-code"
            );

        const province =
            getField(
                "shipping-province"
            );

        const city =
            getField(
                "shipping-city"
            );

        const address =
            getField(
                "shipping-address"
            );


        [
            name,
            email,
            phone,
            country,
            countryCode,
            province,
            city,
            address
        ].forEach(clearInvalid);


        const nameValue =
            name?.value.trim() || "";

        const emailValue =
            email?.value.trim() || "";

        const phoneValue =
            phone?.value.trim() || "";

        const countryValue =
            country?.value.trim() || "";

        const countryCodeValue =
            countryCode?.value
                .trim()
                .toUpperCase() || "";

        const provinceValue =
            province?.value.trim() || "";

        const cityValue =
            city?.value.trim() || "";

        const addressValue =
            address?.value.trim() || "";


        if (!nameValue) {

            markInvalid(name);

            name?.focus();

            throw new Error(
                "Please enter your full name."
            );
        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(emailValue)
        ) {

            markInvalid(email);

            email?.focus();

            throw new Error(
                "Please enter a valid email address."
            );
        }


        if (
            phoneValue.length < 5
        ) {

            markInvalid(phone);

            phone?.focus();

            throw new Error(
                "Please enter a valid phone number."
            );
        }


        if (!countryValue) {

            markInvalid(country);

            country?.focus();

            throw new Error(
                "Please enter your country."
            );
        }


        if (
            !/^[A-Z]{2}$/
                .test(countryCodeValue)
        ) {

            markInvalid(countryCode);

            countryCode?.focus();

            throw new Error(
                "Please enter a valid two-letter country code, such as US."
            );
        }


        if (!provinceValue) {

            markInvalid(province);

            province?.focus();

            throw new Error(
                "Please enter your state or province."
            );
        }


        if (!cityValue) {

            markInvalid(city);

            city?.focus();

            throw new Error(
                "Please enter your city."
            );
        }


        if (!addressValue) {

            markInvalid(address);

            address?.focus();

            throw new Error(
                "Please enter your shipping address."
            );
        }


        return {

            customerName:
                nameValue,

            email:
                emailValue,

            phone:
                phoneValue,

            country:
                countryValue,

            countryCode:
                countryCodeValue,

            province:
                provinceValue,

            city:
                cityValue,

            zip:
                getField(
                    "shipping-zip"
                )?.value.trim() || "",

            county:
                getField(
                    "shipping-county"
                )?.value.trim() || "",

            address:
                addressValue,

            address2:
                getField(
                    "shipping-address2"
                )?.value.trim() || "",

            remark:
                getField(
                    "order-note"
                )?.value.trim() || ""
        };
    }


    /* ========================================================================
       RENDER EMPTY CART
       ======================================================================== */

    function renderEmptySummary() {

        if (!orderSummary) {
            return;
        }

        orderSummary.setAttribute(
            "aria-busy",
            "false"
        );

        orderSummary.innerHTML = `

            <div class="empty-checkout">

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Add products to your cart before checking out.
                </p>

                <a href="/">
                    Continue Shopping
                </a>

            </div>

        `;
    }


    /* ========================================================================
       RENDER ORDER SUMMARY
       ======================================================================== */

    async function loadCheckoutSummary() {

        if (!orderSummary) {
            return;
        }


        orderSummary.setAttribute(
            "aria-busy",
            "true"
        );


        const cart =
            getCart();


        if (!cart.length) {

            renderEmptySummary();

            if (placeOrderButton) {
                placeOrderButton.disabled =
                    true;
            }

            return;
        }


        try {

            await fetchProducts();


            let subtotal = 0;

            const validItems = [];


            for (
                const item of cart
            ) {

                const product =
                    productMap.get(
                        String(item.id)
                    );


                if (!product) {
                    console.warn(
                        "[PRASUN SHOP] Product not found:",
                        item.id
                    );

                    continue;
                }


                const price =
                    Number(
                        product.price
                    );


                if (
                    !Number.isFinite(price) ||
                    price < 0
                ) {
                    continue;
                }


                const quantity =
                    Math.min(
                        MAX_QUANTITY,
                        Math.max(
                            1,
                            Math.floor(
                                Number(
                                    item.quantity
                                ) || 1
                            )
                        )
                    );


                const lineTotal =
                    price * quantity;


                subtotal +=
                    lineTotal;


                validItems.push({

                    item,

                    product,

                    quantity,

                    price,

                    lineTotal
                });
            }


            if (!validItems.length) {

                renderEmptySummary();

                if (placeOrderButton) {
                    placeOrderButton.disabled =
                        true;
                }

                return;
            }


            if (placeOrderButton) {
                placeOrderButton.disabled =
                    false;
            }


            let html = "";


            validItems.forEach(
                ({
                    item,
                    product,
                    quantity,
                    price,
                    lineTotal
                }) => {

                    const name =
                        escapeHTML(
                            product.name ||
                            "Product"
                        );


                    const image =
                        escapeHTML(
                            product.image ||
                            ""
                        );


                    html += `

                        <div class="summary-item">

                            ${
                                image
                                    ? `
                                        <img
                                            src="${image}"
                                            alt="${name}"
                                            class="summary-item-image"
                                            loading="lazy"
                                            decoding="async"
                                        >
                                      `
                                    : `
                                        <div
                                            class="summary-item-image"
                                            aria-hidden="true"
                                        ></div>
                                      `
                            }


                            <div class="summary-item-info">

                                <p class="summary-item-name">
                                    ${name}
                                </p>

                                <p class="summary-item-meta">
                                    Qty: ${quantity}
                                </p>

                            </div>


                            <div class="summary-item-price">
                                ${formatPrice(
                                    lineTotal
                                )}
                            </div>

                        </div>

                    `;
                }
            );


            html += `

                <div class="summary-row">
                    <span>
                        Subtotal
                    </span>

                    <strong>
                        ${formatPrice(
                            subtotal
                        )}
                    </strong>
                </div>


                <div class="summary-row">
                    <span>
                        Shipping
                    </span>

                    <strong>
                        Calculated after order
                    </strong>
                </div>


                <div class="summary-total">
                    <span>
                        Store Total
                    </span>

                    <span>
                        ${formatPrice(
                            subtotal
                        )}
                    </span>
                </div>

            `;


            orderSummary.innerHTML =
                html;


            orderSummary.setAttribute(
                "aria-busy",
                "false"
            );


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout summary error:",
                error
            );


            orderSummary.setAttribute(
                "aria-busy",
                "false"
            );


            orderSummary.innerHTML = `

                <div class="empty-checkout">

                    <p>
                        Unable to load your order summary.
                    </p>

                    <button
                        type="button"
                        id="retry-summary-button"
                        style="
                            border:0;
                            padding:10px 16px;
                            border-radius:9px;
                            background:#2563eb;
                            color:#fff;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        Retry
                    </button>

                </div>

            `;


            const retryButton =
                document.getElementById(
                    "retry-summary-button"
                );


            retryButton?.addEventListener(
                "click",
                () => {
                    loadCheckoutSummary();
                }
            );
        }
    }


    /* ========================================================================
       BUILD ORDER ITEMS
       ======================================================================== */

    async function buildOrderItems() {

        await fetchProducts();


        const cart =
            getCart();


        if (!cart.length) {

            throw new Error(
                "Your cart is empty."
            );
        }


        const items = [];


        for (
            const item of cart
        ) {

            const product =
                productMap.get(
                    String(item.id)
                );


            if (!product) {

                throw new Error(
                    `Product "${item.id}" is no longer available.`
                );
            }


            const quantity =
                Math.min(
                    MAX_QUANTITY,
                    Math.max(
                        1,
                        Math.floor(
                            Number(
                                item.quantity
                            ) || 1
                        )
                    )
                );


            const price =
                Number(
                    product.price
                );


            if (
                !Number.isFinite(price) ||
                price < 0
            ) {

                throw new Error(
                    `Invalid price for "${product.name}".`
                );
            }


            items.push({

                id:
                    String(product.id),

                sku:
                    String(
                        product.sku ||
                        ""
                    ),

                aliexpress_id:
                    String(
                        product.aliexpress_id ||
                        product.aliexpressId ||
                        item.aliexpressId ||
                        ""
                    ),

                name:
                    String(
                        product.name ||
                        "Product"
                    ),

                price,

                quantity,

                image:
                    String(
                        product.image ||
                        ""
                    ),

                variantSku:
                    String(
                        item.variantSku ||
                        ""
                    ),

                variantOptions:
                    String(
                        item.variantOptions ||
                        ""
                    )
            });
        }


        if (!items.length) {

            throw new Error(
                "No valid products were found in your cart."
            );
        }


        return items;
    }


    /* ========================================================================
       SUBMIT ORDER
       ======================================================================== */

    async function submitOrder() {

        hideError();
        hideSuccess();
        setStatus("");


        if (
            !checkoutForm ||
            !placeOrderButton
        ) {
            return;
        }


        const cart =
            getCart();


        if (!cart.length) {

            showError(
                "Your cart is empty. Please return to the shop."
            );

            return;
        }


        if (
            placeOrderButton.dataset.processing ===
            "true"
        ) {
            return;
        }


        let customer;


        try {

            customer =
                validateForm();

        } catch (error) {

            showError(
                error?.message ||
                "Please check your information."
            );

            return;
        }


        const originalText =
            placeOrderButton.textContent;


        placeOrderButton.dataset.processing =
            "true";

        placeOrderButton.disabled =
            true;

        placeOrderButton.textContent =
            "Preparing Order...";


        try {

            const items =
                await buildOrderItems();


            const subtotal =
                items.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        (
                            Number(
                                item.price
                            ) *
                            Number(
                                item.quantity
                            )
                        ),
                    0
                );


            setStatus(
                "Submitting your order..."
            );


            /*
             * IMPORTANT:
             *
             * The browser sends product IDs and product
             * references only.
             *
             * The Worker should validate prices and product
             * data again before storing the order.
             *
             * Never trust the browser's subtotal or price
             * as the authoritative value.
             */

            const payload = {

                customer: {

                    name:
                        customer.customerName,

                    email:
                        customer.email,

                    phone:
                        customer.phone
                },


                shipping: {

                    country:
                        customer.country,

                    countryCode:
                        customer.countryCode,

                    province:
                        customer.province,

                    city:
                        customer.city,

                    zip:
                        customer.zip,

                    county:
                        customer.county,

                    address:
                        customer.address,

                    address2:
                        customer.address2
                },


                remark:
                    customer.remark,


                items,


                /*
                 * Informational browser-side subtotal.
                 *
                 * Worker MUST recalculate this.
                 */

                subtotal
            };


            const response =
                await fetchWithTimeout(
                    ORDER_ENDPOINT,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Accept:
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


            const responseText =
                await response.text();


            let data = null;


            try {

                data =
                    responseText
                        ? JSON.parse(
                            responseText
                        )
                        : null;

            } catch (error) {

                console.warn(
                    "[PRASUN SHOP] Invalid JSON response:",
                    error
                );
            }


            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    `Order server returned HTTP ${response.status}.`
                );
            }


            if (
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    data?.error ||
                    "The order could not be completed."
                );
            }


            /*
             * Store only non-sensitive confirmation
             * information in sessionStorage.
             */

            try {

                sessionStorage.setItem(
                    "prasun_order_confirmation",
                    JSON.stringify({

                        orderNumber:
                            data.orderNumber ||
                            data.orderId ||
                            "",

                        createdAt:
                            Date.now()
                    })
                );

            } catch (_) {}


            /*
             * Order has been accepted by the Worker.
             */

            clearCart();


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


            const orderNumber =
                String(
                    data.orderNumber ||
                    data.orderId ||
                    "Order received"
                );


            if (
                confirmationOrderNumber
            ) {

                confirmationOrderNumber.textContent =
                    `Order #: ${orderNumber}`;
            }


            if (
                checkoutForm
            ) {

                checkoutForm.style.display =
                    "none";
            }


            if (
                orderConfirmation
            ) {

                orderConfirmation.classList.add(
                    "visible"
                );
            }


            if (
                checkoutSuccess
            ) {

                showSuccess(
                    "Your order has been successfully received."
                );
            }


            setStatus(
                ""
            );


            /*
             * Prevent accidental second submission.
             */

            placeOrderButton.dataset.processing =
                "false";


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Order submission error:",
                error
            );


            showError(
                error?.message ||
                "Unable to place your order. Please try again."
            );


            placeOrderButton.disabled =
                false;

            placeOrderButton.textContent =
                originalText;

            placeOrderButton.dataset.processing =
                "false";


            setStatus(
                ""
            );
        }
    }


    /* ========================================================================
       FORM EVENTS
       ======================================================================== */

    if (checkoutForm) {

        checkoutForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                submitOrder();
            }
        );


        checkoutForm
            .querySelectorAll(
                "input, select, textarea"
            )
            .forEach(field => {

                field.addEventListener(
                    "input",
                    () => {
                        clearInvalid(field);
                        hideError();
                    }
                );

                field.addEventListener(
                    "change",
                    () => {
                        clearInvalid(field);
                    }
                );
            });
    }


    /* ========================================================================
       COUNTRY CODE NORMALIZATION
       ======================================================================== */

    const countryCodeInput =
        document.getElementById(
            "shipping-country-code"
        );


    if (countryCodeInput) {

        countryCodeInput.addEventListener(
            "input",
            () => {

                countryCodeInput.value =
                    countryCodeInput.value
                        .replace(
                            /[^a-zA-Z]/g,
                            ""
                        )
                        .slice(0, 2)
                        .toUpperCase();
            }
        );
    }


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount() {

        const countElement =
            document.getElementById(
                "cart-count"
            );


        if (!countElement) {
            return;
        }


        const cart =
            getCart();


        const count =
            cart.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Math.max(
                        1,
                        Number(
                            item.quantity
                        ) || 1
                    ),
                0
            );


        countElement.textContent =
            String(count);


        countElement.hidden =
            count <= 0;
    }


    /* ========================================================================
       STORAGE SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {

                updateCartCount();

                loadCheckoutSummary();
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        () => {

            updateCartCount();

            loadCheckoutSummary();
        }
    );


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    updateCartCount();

    loadCheckoutSummary();

})();
