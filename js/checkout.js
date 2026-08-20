/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * CURRENT ARCHITECTURE
 *
 * Storefront:
 *     https://shop.prasunbarua.com
 *
 * Worker API:
 *     GET  /api/products
 *     GET  /api/products/:id
 *     GET  /api/health
 *     POST /api/order
 *
 * Supplier:
 *     ALIEXPRESS ONLY
 *
 * IMPORTANT:
 *     - No CJ Dropshipping
 *     - No CJ API
 *     - No CJ credentials
 *     - No supplier credentials in browser
 *     - Browser only submits the customer order to the Worker
 *     - Worker validates product information before recording the order
 *
 * CART:
 *     Canonical localStorage key:
 *         prasun_cart
 *
 * Basic cart item structure:
 *     {
 *         id,
 *         quantity
 *     }
 *
 * Richer cart fields such as SKU and variants are also supported.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

    const CONFIG = {

        API_BASE:
            "https://shop.prasunbarua.com",

        PRODUCTS_ENDPOINT:
            "/api/products",

        ORDER_ENDPOINT:
            "/api/order",

        CART_KEY:
            "prasun_cart",

        LEGACY_CART_KEYS: [
            "prasunShopCart",
            "store_cart",
            "ae_dropship_cart",
            "cart",
            "prasun_cart_items"
        ],

        MAX_QUANTITY:
            99,

        REQUEST_TIMEOUT:
            15000

    };


    /* =========================================================================
       DOM
       ========================================================================= */

    const elements = {

        checkoutForm:
            document.getElementById(
                "checkout-form"
            ),

        orderSummary:
            document.getElementById(
                "order-summary"
            ),

        checkoutError:
            document.getElementById(
                "checkout-error"
            ),

        checkoutSuccess:
            document.getElementById(
                "checkout-success"
            ),

        checkoutStatus:
            document.getElementById(
                "checkout-status"
            ),

        checkoutLayout:
            document.getElementById(
                "checkout-layout"
            ),

        placeOrderButton:
            document.getElementById(
                "place-order-button"
            ),

        orderConfirmation:
            document.getElementById(
                "order-confirmation"
            ),

        confirmationOrderNumber:
            document.getElementById(
                "confirmation-order-number"
            ),

        cartCount:
            document.getElementById(
                "cart-count"
            )

    };


    /* =========================================================================
       STATE
       ========================================================================= */

    let productMap =
        new Map();

    let productsPromise =
        null;


    /* =========================================================================
       FORMATTERS
       ========================================================================= */

    const currencyFormatter =
        new Intl.NumberFormat(
            "en-US",
            {
                style:
                    "currency",

                currency:
                    "USD",

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2
            }
        );


    function formatPrice(value) {

        const number =
            Number(value);


        return Number.isFinite(
            number
        )

            ? currencyFormatter.format(
                number
            )

            : "$0.00";

    }


    /* =========================================================================
       HTML ESCAPING
       ========================================================================= */

    const ESCAPE_MAP = {

        "&":
            "&amp;",

        "<":
            "&lt;",

        ">":
            "&gt;",

        '"':
            "&quot;",

        "'":
            "&#039;"

    };


    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(
            value
        ).replace(
            /[&<>"']/g,
            character =>
                ESCAPE_MAP[
                    character
                ]
        );

    }


    /* =========================================================================
       CART
       ========================================================================= */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            item.id === undefined ||
            item.id === null
        ) {

            return null;

        }


        const quantity =
            Number(
                item.quantity
            );


        const normalizedQuantity =
            Number.isFinite(
                quantity
            ) &&
            quantity > 0

                ? Math.min(
                    CONFIG.MAX_QUANTITY,
                    Math.floor(
                        quantity
                    )
                )

                : 1;


        return {

            id:
                String(
                    item.id
                ),

            quantity:
                normalizedQuantity,

            sku:
                String(
                    item.sku ||
                    ""
                ),

            aliexpress_id:
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


    function parseCart(
        raw
    ) {

        if (!raw) {
            return [];
        }


        try {

            const parsed =
                JSON.parse(
                    raw
                );


            if (
                !Array.isArray(
                    parsed
                )
            ) {

                return [];

            }


            return parsed
                .map(
                    normalizeCartItem
                )
                .filter(
                    Boolean
                );

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

            /*
             * Canonical cart.
             */

            const primary =
                localStorage.getItem(
                    CONFIG.CART_KEY
                );


            if (primary) {

                const cart =
                    parseCart(
                        primary
                    );


                if (cart.length) {

                    return cart;

                }

            }


            /*
             * Legacy compatibility.
             */

            for (
                const key of
                CONFIG.LEGACY_CART_KEYS
            ) {

                if (
                    key ===
                    CONFIG.CART_KEY
                ) {

                    continue;

                }


                const raw =
                    localStorage.getItem(
                        key
                    );


                if (!raw) {
                    continue;
                }


                const cart =
                    parseCart(
                        raw
                    );


                if (
                    cart.length
                ) {

                    /*
                     * Migrate to canonical
                     * prasun_cart.
                     */

                    localStorage.setItem(
                        CONFIG.CART_KEY,
                        JSON.stringify(
                            cart
                        )
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
                CONFIG.CART_KEY
            );


            CONFIG.LEGACY_CART_KEYS.forEach(
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


    /* =========================================================================
       CART COUNT
       ========================================================================= */

    function updateCartCount() {

        if (
            !elements.cartCount
        ) {

            return;

        }


        const cart =
            getCart();


        const count =
            cart.reduce(
                (
                    total,
                    item
                ) => {

                    return (
                        total +
                        Math.max(
                            1,
                            Number(
                                item.quantity
                            ) || 1
                        )
                    );

                },
                0
            );


        elements.cartCount.textContent =
            String(
                count
            );


        elements.cartCount.hidden =
            count <= 0;

    }


    /* =========================================================================
       FETCH WITH TIMEOUT
       ========================================================================= */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const controller =
            new AbortController();


        const timeout =
            Number(
                options.timeout ||
                CONFIG.REQUEST_TIMEOUT
            );


        const timer =
            setTimeout(
                () => {

                    controller.abort();

                },
                timeout
            );


        try {

            const fetchOptions =
                {
                    ...options
                };


            delete fetchOptions.timeout;


            fetchOptions.signal =
                controller.signal;


            return await fetch(
                resource,
                fetchOptions
            );

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

            clearTimeout(
                timer
            );

        }

    }


    /* =========================================================================
       LOAD PRODUCTS
       ========================================================================= */

    async function fetchProducts() {

        if (
            productMap.size > 0
        ) {

            return productMap;

        }


        if (
            productsPromise
        ) {

            return productsPromise;

        }


        const endpoint =
            new URL(
                CONFIG.PRODUCTS_ENDPOINT,
                CONFIG.API_BASE
            );


        endpoint.searchParams.set(
            "limit",
            "100"
        );


        productsPromise =
            (async () => {

                try {

                    console.log(
                        "[PRASUN SHOP] Loading products:",
                        endpoint.toString()
                    );


                    const response =
                        await fetchWithTimeout(
                            endpoint.toString(),
                            {
                                method:
                                    "GET",

                                cache:
                                    "no-store",

                                headers: {
                                    Accept:
                                        "application/json"
                                }
                            }
                        );


                    const responseText =
                        await response.text();


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `Products API returned HTTP ${response.status}.`
                        );

                    }


                    if (
                        !responseText.trim()
                    ) {

                        throw new Error(
                            "Products API returned an empty response."
                        );

                    }


                    let data;


                    try {

                        data =
                            JSON.parse(
                                responseText
                            );

                    } catch (error) {

                        console.error(
                            "[PRASUN SHOP] Products API invalid JSON:",
                            responseText.slice(
                                0,
                                500
                            )
                        );

                        throw new Error(
                            "Products API returned invalid JSON."
                        );

                    }


                    /*
                     * Current Worker format:
                     *
                     * {
                     *     success: true,
                     *     products: [...]
                     * }
                     */

                    if (
                        data &&
                        typeof data ===
                            "object" &&
                        data.success === false
                    ) {

                        throw new Error(
                            data.error ||
                            "Products API returned success=false."
                        );

                    }


                    const products =
                        Array.isArray(
                            data
                        )

                            ? data

                            : Array.isArray(
                                data?.products
                            )

                                ? data.products

                                : [];


                    if (
                        !products.length
                    ) {

                        throw new Error(
                            "No products were returned by the Products API."
                        );

                    }


                    productMap =
                        new Map();


                    products
                        .filter(
                            Boolean
                        )
                        .forEach(
                            product => {

                                if (
                                    product.id ===
                                    undefined ||
                                    product.id ===
                                    null
                                ) {

                                    return;

                                }


                                productMap.set(
                                    String(
                                        product.id
                                    ),
                                    product
                                );

                            }
                        );


                    console.log(
                        "[PRASUN SHOP] Products loaded:",
                        productMap.size
                    );


                    return productMap;

                } catch (error) {

                    productsPromise =
                        null;

                    throw error;

                }

            })();


        return productsPromise;

    }


    /* =========================================================================
       UI STATUS
       ========================================================================= */

    function showError(
        message
    ) {

        if (
            !elements.checkoutError
        ) {

            alert(
                message
            );

            return;

        }


        elements.checkoutError.textContent =
            message;


        elements.checkoutError.classList.add(
            "visible"
        );


        elements.checkoutError.scrollIntoView({
            behavior:
                "smooth",

            block:
                "nearest"
        });

    }


    function hideError() {

        if (
            !elements.checkoutError
        ) {

            return;

        }


        elements.checkoutError.textContent =
            "";


        elements.checkoutError.classList.remove(
            "visible"
        );

    }


    function showSuccess(
        message
    ) {

        if (
            !elements.checkoutSuccess
        ) {

            return;

        }


        elements.checkoutSuccess.textContent =
            message;


        elements.checkoutSuccess.classList.add(
            "visible"
        );

    }


    function hideSuccess() {

        if (
            !elements.checkoutSuccess
        ) {

            return;

        }


        elements.checkoutSuccess.textContent =
            "";


        elements.checkoutSuccess.classList.remove(
            "visible"
        );

    }


    function setStatus(
        message
    ) {

        if (
            !elements.checkoutStatus
        ) {

            return;

        }


        elements.checkoutStatus.textContent =
            message || "";

    }


    /* =========================================================================
       FORM HELPERS
       ========================================================================= */

    function getField(
        id
    ) {

        return document.getElementById(
            id
        );

    }


    function markInvalid(
        field
    ) {

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


    function clearInvalid(
        field
    ) {

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


    /* =========================================================================
       FORM VALIDATION
       ========================================================================= */

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
        ].forEach(
            clearInvalid
        );


        const nameValue =
            name?.value.trim() ||
            "";


        const emailValue =
            email?.value.trim() ||
            "";


        const phoneValue =
            phone?.value.trim() ||
            "";


        const countryValue =
            country?.value.trim() ||
            "";


        const countryCodeValue =
            countryCode?.value
                .trim()
                .toUpperCase() ||
            "";


        const provinceValue =
            province?.value.trim() ||
            "";


        const cityValue =
            city?.value.trim() ||
            "";


        const addressValue =
            address?.value.trim() ||
            "";


        if (
            !nameValue
        ) {

            markInvalid(
                name
            );

            name?.focus();

            throw new Error(
                "Please enter your full name."
            );

        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
                    emailValue
                )
        ) {

            markInvalid(
                email
            );

            email?.focus();

            throw new Error(
                "Please enter a valid email address."
            );

        }


        if (
            phoneValue.length < 5
        ) {

            markInvalid(
                phone
            );

            phone?.focus();

            throw new Error(
                "Please enter a valid phone number."
            );

        }


        if (
            !countryValue
        ) {

            markInvalid(
                country
            );

            country?.focus();

            throw new Error(
                "Please enter your country."
            );

        }


        if (
            !/^[A-Z]{2}$/
                .test(
                    countryCodeValue
                )
        ) {

            markInvalid(
                countryCode
            );

            countryCode?.focus();

            throw new Error(
                "Please enter a valid two-letter country code, such as US."
            );

        }


        if (
            !provinceValue
        ) {

            markInvalid(
                province
            );

            province?.focus();

            throw new Error(
                "Please enter your state or province."
            );

        }


        if (
            !cityValue
        ) {

            markInvalid(
                city
            );

            city?.focus();

            throw new Error(
                "Please enter your city."
            );

        }


        if (
            !addressValue
        ) {

            markInvalid(
                address
            );

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
                )?.value.trim() ||
                "",

            county:
                getField(
                    "shipping-county"
                )?.value.trim() ||
                "",

            address:
                addressValue,

            address2:
                getField(
                    "shipping-address2"
                )?.value.trim() ||
                "",

            remark:
                getField(
                    "order-note"
                )?.value.trim() ||
                ""

        };

    }


    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function renderEmptySummary() {

        if (
            !elements.orderSummary
        ) {

            return;

        }


        elements.orderSummary.setAttribute(
            "aria-busy",
            "false"
        );


        elements.orderSummary.innerHTML = `

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


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                true;

        }

    }


    /* =========================================================================
       CHECKOUT SUMMARY
       ========================================================================= */

    async function loadCheckoutSummary() {

        if (
            !elements.orderSummary
        ) {

            return;

        }


        elements.orderSummary.setAttribute(
            "aria-busy",
            "true"
        );


        const cart =
            getCart();


        if (
            !cart.length
        ) {

            renderEmptySummary();

            return;

        }


        try {

            await fetchProducts();


            let subtotal =
                0;


            const validItems =
                [];


            for (
                const item of cart
            ) {

                const product =
                    productMap.get(
                        String(
                            item.id
                        )
                    );


                if (
                    !product
                ) {

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
                    !Number.isFinite(
                        price
                    ) ||
                    price < 0
                ) {

                    continue;

                }


                const quantity =
                    Math.min(
                        CONFIG.MAX_QUANTITY,

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
                    price *
                    quantity;


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


            if (
                !validItems.length
            ) {

                renderEmptySummary();

                return;

            }


            if (
                elements.placeOrderButton
            ) {

                elements.placeOrderButton.disabled =
                    false;

            }


            let html =
                "";


            validItems.forEach(
                ({
                    product,
                    quantity,
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


            elements.orderSummary.innerHTML =
                html;


            elements.orderSummary.setAttribute(
                "aria-busy",
                "false"
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout summary error:",
                error
            );


            elements.orderSummary.setAttribute(
                "aria-busy",
                "false"
            );


            elements.orderSummary.innerHTML = `

                <div class="empty-checkout">

                    <p>
                        Unable to load your order summary.
                    </p>

                    <button
                        type="button"
                        id="retry-summary-button"
                    >
                        Retry
                    </button>

                </div>

            `;


            document
                .getElementById(
                    "retry-summary-button"
                )
                ?.addEventListener(
                    "click",
                    () => {

                        loadCheckoutSummary();

                    }
                );

        }

    }


    /* =========================================================================
       BUILD ORDER ITEMS
       ========================================================================= */

    async function buildOrderItems() {

        await fetchProducts();


        const cart =
            getCart();


        if (
            !cart.length
        ) {

            throw new Error(
                "Your cart is empty."
            );

        }


        const items =
            [];


        for (
            const cartItem of cart
        ) {

            const product =
                productMap.get(
                    String(
                        cartItem.id
                    )
                );


            if (
                !product
            ) {

                throw new Error(
                    `Product "${cartItem.id}" is no longer available.`
                );

            }


            const price =
                Number(
                    product.price
                );


            if (
                !Number.isFinite(
                    price
                ) ||
                price < 0
            ) {

                throw new Error(
                    `Invalid price for "${product.name}".`
                );

            }


            const quantity =
                Math.min(
                    CONFIG.MAX_QUANTITY,

                    Math.max(
                        1,
                        Math.floor(
                            Number(
                                cartItem.quantity
                            ) || 1
                        )
                    )
                );


            items.push({

                id:
                    String(
                        product.id
                    ),

                sku:
                    String(
                        product.sku ||
                        cartItem.sku ||
                        ""
                    ),

                aliexpress_id:
                    String(
                        product.aliexpress_id ||
                        product.aliexpressId ||
                        cartItem.aliexpress_id ||
                        ""
                    ),

                name:
                    String(
                        product.name ||
                        "Product"
                    ),

                price:
                    price,

                quantity:
                    quantity,

                image:
                    String(
                        product.image ||
                        ""
                    ),

                variantSku:
                    String(
                        cartItem.variantSku ||
                        ""
                    ),

                variantOptions:
                    String(
                        cartItem.variantOptions ||
                        ""
                    )

            });

        }


        if (
            !items.length
        ) {

            throw new Error(
                "No valid products were found in your cart."
            );

        }


        return items;

    }


    /* =========================================================================
       SUBMIT ORDER
       ========================================================================= */

    async function submitOrder() {

        hideError();

        hideSuccess();

        setStatus(
            ""
        );


        if (
            !elements.checkoutForm ||
            !elements.placeOrderButton
        ) {

            return;

        }


        if (
            elements.placeOrderButton.dataset.processing ===
            "true"
        ) {

            return;

        }


        const cart =
            getCart();


        if (
            !cart.length
        ) {

            showError(
                "Your cart is empty. Please return to the shop."
            );

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
            elements.placeOrderButton.textContent;


        elements.placeOrderButton.dataset.processing =
            "true";


        elements.placeOrderButton.disabled =
            true;


        elements.placeOrderButton.textContent =
            "Preparing Order...";


        try {

            /*
             * Re-fetch products immediately before
             * order submission.
             *
             * This prevents stale browser prices from
             * becoming the basis of the order.
             */

            productMap =
                new Map();

            productsPromise =
                null;


            const items =
                await buildOrderItems();


            const subtotal =
                items.reduce(
                    (
                        total,
                        item
                    ) => {

                        return (
                            total +
                            (
                                Number(
                                    item.price
                                ) *
                                Number(
                                    item.quantity
                                )
                            )
                        );

                    },
                    0
                );


            /*
             * Compatibility cart.
             *
             * The canonical cart baseline is:
             *
             *     { id, quantity }
             *
             * Additional product references are included
             * where available.
             */

            const cartItems =
                items.map(
                    item => ({

                        id:
                            item.id,

                        quantity:
                            item.quantity,

                        sku:
                            item.sku,

                        aliexpress_id:
                            item.aliexpress_id,

                        variantSku:
                            item.variantSku,

                        variantOptions:
                            item.variantOptions

                    })
                );


            /*
             * Current Worker order payload.
             *
             * The Worker MUST remain authoritative for:
             *
             *     - product existence
             *     - price
             *     - quantity limits
             *     - subtotal
             *     - order number
             *
             * The browser subtotal is informational only.
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


                /*
                 * Preferred current structure.
                 */

                items:


                    items,


                /*
                 * Compatibility structure for the
                 * current Worker/order handling.
                 */

                cart:


                    cartItems,


                /*
                 * Informational only.
                 *
                 * Worker must recalculate.
                 */

                subtotal:


                    Number(
                        subtotal.toFixed(
                            2
                        )
                    ),


                currency:
                    "USD",

                source:
                    "PRASUN SHOP"

            };


            console.log(
                "[PRASUN SHOP] Submitting order:",
                {
                    itemCount:
                        items.length,

                    subtotal:
                        payload.subtotal
                }
            );


            setStatus(
                "Submitting your order..."
            );


            const orderURL =
                new URL(
                    CONFIG.ORDER_ENDPOINT,
                    CONFIG.API_BASE
                );


            const response =
                await fetchWithTimeout(
                    orderURL.toString(),
                    {

                        method:
                            "POST",

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


            let data =
                null;


            try {

                data =
                    responseText
                        ? JSON.parse(
                            responseText
                        )
                        : null;

            } catch (error) {

                console.error(
                    "[PRASUN SHOP] Order API invalid JSON:",
                    responseText.slice(
                        0,
                        500
                    )
                );

            }


            if (
                !response.ok
            ) {

                throw new Error(
                    data?.error ||
                    `Order API returned HTTP ${response.status}.`
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
             * Worker may return either:
             *
             * orderNumber
             *
             * or
             *
             * orderId
             */

            const orderNumber =
                String(
                    data.orderNumber ||
                    data.orderId ||
                    "Order received"
                );


            /*
             * Store only non-sensitive confirmation
             * information.
             */

            try {

                sessionStorage.setItem(
                    "prasun_order_confirmation",

                    JSON.stringify({

                        orderNumber:
                            orderNumber,

                        createdAt:
                            Date.now()

                    })
                );

            } catch (_) {}


            /*
             * Order successfully accepted.
             *
             * Only now clear the cart.
             */

            clearCart();


            updateCartCount();


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


            /*
             * Show order number.
             */

            if (
                elements.confirmationOrderNumber
            ) {

                elements.confirmationOrderNumber.textContent =
                    `Order #: ${orderNumber}`;

            }


            /*
             * Hide checkout form.
             */

            elements.checkoutForm.style.display =
                "none";


            /*
             * Hide checkout layout if
             * the page contains one.
             */

            if (
                elements.checkoutLayout
            ) {

                elements.checkoutLayout.style.display =
                    "none";

            }


            /*
             * Show confirmation.
             */

            if (
                elements.orderConfirmation
            ) {

                elements.orderConfirmation.classList.add(
                    "visible"
                );

            }


            showSuccess(
                "Your order has been successfully received."
            );


            setStatus(
                ""
            );


            /*
             * Prevent duplicate submission.
             */

            elements.placeOrderButton.dataset.processing =
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


            elements.placeOrderButton.disabled =
                false;


            elements.placeOrderButton.textContent =
                originalText;


            elements.placeOrderButton.dataset.processing =
                "false";


            setStatus(
                ""
            );

        }

    }


    /* =========================================================================
       FORM EVENTS
       ========================================================================= */

    if (
        elements.checkoutForm
    ) {

        elements.checkoutForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                submitOrder();

            }
        );


        elements.checkoutForm
            .querySelectorAll(
                "input, select, textarea"
            )
            .forEach(
                field => {

                    field.addEventListener(
                        "input",
                        () => {

                            clearInvalid(
                                field
                            );

                            hideError();

                        }
                    );


                    field.addEventListener(
                        "change",
                        () => {

                            clearInvalid(
                                field
                            );

                        }
                    );

                }
            );

    }


    /* =========================================================================
       COUNTRY CODE NORMALIZATION
       ========================================================================= */

    const countryCodeInput =
        document.getElementById(
            "shipping-country-code"
        );


    if (
        countryCodeInput
    ) {

        countryCodeInput.addEventListener(
            "input",
            () => {

                countryCodeInput.value =
                    countryCodeInput.value
                        .replace(
                            /[^a-zA-Z]/g,
                            ""
                        )
                        .slice(
                            0,
                            2
                        )
                        .toUpperCase();

            }
        );

    }


    /* =========================================================================
       STORAGE / CART EVENTS
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                    CONFIG.CART_KEY ||

                CONFIG.LEGACY_CART_KEYS.includes(
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


    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    updateCartCount();

    loadCheckoutSummary();


})();
