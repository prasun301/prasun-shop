/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * CUSTOMER FLOW
 *
 * Cart
 *   ↓
 * Checkout
 *   ↓
 * Customer enters shipping information
 *   ↓
 * Browser sends order request to PRASUN SHOP Worker
 *   ↓
 * Worker validates cart
 *   ↓
 * Worker creates CJ order
 *   ↓
 * CJ returns payment URL
 *   ↓
 * Browser redirects customer to CJ payment page
 *
 * IMPORTANT
 *
 * The CJ API key is NEVER exposed to the browser.
 *
 * ============================================================================ */

"use strict";

(() => {

    /* ========================================================================
       CONFIGURATION
       ======================================================================== */

    const CART_KEY =
        "prasun_cart";

    const LEGACY_CART_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const API_BASE =
        "https://prasun-shop-api.prasun301.workers.dev";

    const PRODUCTS_ENDPOINT =
        `${API_BASE}/api/products`;

    const ORDER_ENDPOINT =
        `${API_BASE}/api/order`;

    const MAX_QUANTITY =
        99;

    const REQUEST_TIMEOUT_MS =
        15000;


    /* ========================================================================
       DOM
       ======================================================================== */

    const checkoutForm =
        document.getElementById(
            "checkout-form"
        );

    const orderSummary =
        document.getElementById(
            "order-summary"
        );

    const checkoutError =
        document.getElementById(
            "checkout-error"
        );

    const checkoutStatus =
        document.getElementById(
            "checkout-status"
        );

    const placeOrderButton =
        document.getElementById(
            "place-order-button"
        );

    const cartCount =
        document.getElementById(
            "cart-count"
        );


    /* ========================================================================
       STATE
       ======================================================================== */

    let cart = [];

    let productMap =
        new Map();

    let productsFetchPromise =
        null;

    let checkoutProcessing =
        false;


    /* ========================================================================
       CURRENCY
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

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return "$0.00";
        }

        return currencyFormatter.format(
            number
        );
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
            char =>
                ESCAPE_MAP[char]
        );
    }


    /* ========================================================================
       URL VALIDATION
       ======================================================================== */

    function isValidHttpUrl(
        value
    ) {

        if (!value) {
            return false;
        }

        try {

            const url =
                new URL(
                    value
                );

            return (
                url.protocol ===
                    "https:" ||
                url.protocol ===
                    "http:"
            );

        } catch {

            return false;
        }
    }


    /* ========================================================================
       CART NORMALIZATION
       ======================================================================== */

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


        const numericQuantity =
            Number(
                item.quantity
            );


        const quantity =
            Number.isFinite(
                numericQuantity
            ) &&
            numericQuantity > 0

                ? Math.min(
                    MAX_QUANTITY,
                    Math.floor(
                        numericQuantity
                    )
                )

                : 1;


        return {

            id:
                String(
                    item.id
                ),

            quantity,

            sku:
                String(
                    item.sku ||
                    ""
                ),

            cjSku:
                String(
                    item.cjSku ||
                    item.sku ||
                    ""
                ),

            variantSku:
                String(
                    item.variantSku ||
                    ""
                ),

            vid:
                String(
                    item.vid ||
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
                .filter(Boolean);

        } catch (
            error
        ) {

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
                const key
                of LEGACY_CART_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        key
                    );


                if (!legacy) {
                    continue;
                }


                const legacyCart =
                    parseCart(
                        legacy
                    );


                if (
                    legacyCart.length > 0
                ) {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(
                            legacyCart
                        )
                    );


                    return legacyCart;
                }
            }


            return [];

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Cart read error:",
                error
            );

            return [];
        }
    }


    function clearAllCartKeys() {

        try {

            localStorage.removeItem(
                CART_KEY
            );


            LEGACY_CART_KEYS.forEach(
                key => {

                    localStorage.removeItem(
                        key
                    );

                }
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Cart clear error:",
                error
            );
        }
    }


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount() {

        if (!cartCount) {
            return;
        }


        const count =
            cart.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    (
                        Number(
                            item.quantity
                        ) || 0
                    ),
                0
            );


        cartCount.textContent =
            String(
                count
            );


        cartCount.hidden =
            count <= 0;
    }


    /* ========================================================================
       FETCH WITH TIMEOUT
       ======================================================================== */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const timeout =
            Number(
                options.timeout
            ) ||
            REQUEST_TIMEOUT_MS;


        const controller =
            new AbortController();


        const timer =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );


        try {

            const fetchOptions = {
                ...options,
                signal:
                    controller.signal
            };


            delete fetchOptions.timeout;


            return await fetch(
                resource,
                fetchOptions
            );

        } catch (
            error
        ) {

            if (
                error &&
                error.name ===
                    "AbortError"
            ) {

                throw new Error(
                    "The request timed out. Please check your connection and try again."
                );
            }


            throw error;

        } finally {

            clearTimeout(
                timer
            );
        }
    }


    /* ========================================================================
       FETCH PRODUCTS
       ======================================================================== */

    async function fetchProducts() {

        if (
            productMap.size > 0
        ) {

            return productMap;
        }


        if (
            productsFetchPromise
        ) {

            return productsFetchPromise;
        }


        productsFetchPromise =
            (async () => {

                try {

                    const response =
                        await fetchWithTimeout(
                            PRODUCTS_ENDPOINT,
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


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `Products request failed with HTTP ${response.status}.`
                        );
                    }


                    const data =
                        await response.json();


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


                    const nextMap =
                        new Map();


                    for (
                        const product
                        of products
                    ) {

                        if (
                            !product ||
                            product.id ===
                                undefined ||
                            product.id ===
                                null
                        ) {

                            continue;
                        }


                        nextMap.set(
                            String(
                                product.id
                            ),
                            product
                        );
                    }


                    productMap =
                        nextMap;


                    if (
                        productMap.size ===
                            0
                    ) {

                        throw new Error(
                            "The product API returned no products."
                        );
                    }


                    return productMap;

                } catch (
                    error
                ) {

                    productsFetchPromise =
                        null;

                    throw error;
                }

            })();


        return productsFetchPromise;
    }


    /* ========================================================================
       UI ERROR
       ======================================================================== */

    function showFormError(
        message
    ) {

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
            behavior:
                "smooth",
            block:
                "nearest"
        });
    }


    function hideFormError() {

        if (!checkoutError) {
            return;
        }


        checkoutError.textContent =
            "";


        checkoutError.classList.remove(
            "visible"
        );
    }


    /* ========================================================================
       STATUS
       ======================================================================== */

    function setStatus(
        message
    ) {

        if (!checkoutStatus) {
            return;
        }


        checkoutStatus.textContent =
            message || "";
    }


    /* ========================================================================
       EMPTY CHECKOUT
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


        if (placeOrderButton) {

            placeOrderButton.disabled =
                true;

        }
    }


    /* ========================================================================
       CHECKOUT SUMMARY
       ======================================================================== */

    async function loadCheckoutSummary() {

        if (!orderSummary) {
            return;
        }


        orderSummary.setAttribute(
            "aria-busy",
            "true"
        );


        try {

            cart =
                getCart();


            updateCartCount();


            if (
                !cart.length
            ) {

                renderEmptySummary();

                return;
            }


            if (placeOrderButton) {

                placeOrderButton.disabled =
                    false;
            }


            await fetchProducts();


            let total =
                0;


            const validItems =
                [];


            for (
                const item
                of cart
            ) {

                const product =
                    productMap.get(
                        String(
                            item.id
                        )
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
                    !Number.isFinite(
                        price
                    ) ||
                    price < 0
                ) {

                    console.warn(
                        "[PRASUN SHOP] Invalid product price:",
                        product.id
                    );

                    continue;
                }


                const quantity =
                    Math.max(
                        1,
                        Math.min(
                            MAX_QUANTITY,
                            Number(
                                item.quantity
                            ) || 1
                        )
                    );


                const subtotal =
                    price *
                    quantity;


                total +=
                    subtotal;


                validItems.push({

                    id:
                        String(
                            product.id
                        ),

                    sku:
                        String(
                            product.sku ||
                            item.sku ||
                            ""
                        ),

                    cjSku:
                        String(
                            product.cjSku ||
                            product.sku ||
                            item.cjSku ||
                            item.sku ||
                            ""
                        ),

                    variantSku:
                        String(
                            item.variantSku ||
                            ""
                        ),

                    vid:
                        String(
                            item.vid ||
                            ""
                        ),

                    variantOptions:
                        String(
                            item.variantOptions ||
                            ""
                        ),

                    name:
                        String(
                            product.name ||
                            "Product"
                        ),

                    image:
                        String(
                            product.image ||
                            ""
                        ),

                    price,

                    quantity,

                    subtotal

                });
            }


            if (
                validItems.length ===
                    0
            ) {

                renderEmptySummary();

                showFormError(
                    "The products in your cart could not be found. Please return to the shop and add the products again."
                );

                return;
            }


            let html = `

                <div class="summary-list">

            `;


            for (
                const item
                of validItems
            ) {

                const image =
                    escapeHTML(
                        item.image
                    );


                const name =
                    escapeHTML(
                        item.name
                    );


                html += `

                    <div class="summary-item">

                        <img
                            class="summary-item-image"
                            src="${image}"
                            alt="${name}"
                            loading="lazy"
                            decoding="async"
                        >


                        <div class="summary-item-info">

                            <p class="summary-item-name">
                                ${name}
                            </p>

                            <p class="summary-item-meta">
                                Qty: ${item.quantity}
                            </p>

                        </div>


                        <div class="summary-item-price">

                            ${formatPrice(
                                item.subtotal
                            )}

                            <div class="summary-item-unit">
                                ${formatPrice(
                                    item.price
                                )} each
                            </div>

                        </div>

                    </div>

                `;
            }


            html += `
                </div>
            `;


            html += `

                <div class="summary-shipping">

                    <span>
                        Shipping
                    </span>

                    <span class="summary-shipping-value">
                        Calculated by CJ
                    </span>

                </div>


                <div class="summary-total">

                    <span>
                        Store Total
                    </span>

                    <span>
                        ${formatPrice(
                            total
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


        } catch (
            error
        ) {

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

                    <h2>
                        Unable to load order
                    </h2>

                    <p>
                        We could not load your cart information.
                    </p>

                    <button
                        type="button"
                        id="retry-summary-button"
                        style="
                            min-height:44px;
                            padding:0 18px;
                            border:0;
                            border-radius:10px;
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


            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    () => {

                        hideFormError();

                        loadCheckoutSummary();

                    }
                );
            }


            showFormError(
                error?.message ||
                "Unable to load your order."
            );
        }
    }


    /* ========================================================================
       FORM VALIDATION
       ======================================================================== */

    function clearInvalidFields() {

        if (!checkoutForm) {
            return;
        }


        checkoutForm
            .querySelectorAll(
                ".invalid"
            )
            .forEach(
                element => {

                    element.classList.remove(
                        "invalid"
                    );

                }
            );
    }


    function markInvalid(
        element
    ) {

        if (!element) {
            return;
        }


        element.classList.add(
            "invalid"
        );


        try {

            element.focus();

        } catch (_) {}
    }


    function validateForm(
        formData
    ) {

        clearInvalidFields();


        const nameField =
            document.getElementById(
                "customer-name"
            );

        const emailField =
            document.getElementById(
                "customer-email"
            );

        const phoneField =
            document.getElementById(
                "customer-phone"
            );

        const addressField =
            document.getElementById(
                "shipping-address"
            );

        const countryField =
            document.getElementById(
                "shipping-country"
            );

        const countryCodeField =
            document.getElementById(
                "shipping-country-code"
            );

        const provinceField =
            document.getElementById(
                "shipping-province"
            );

        const cityField =
            document.getElementById(
                "shipping-city"
            );


        const name =
            String(
                formData.get(
                    "name"
                ) || ""
            ).trim();


        const email =
            String(
                formData.get(
                    "email"
                ) || ""
            ).trim();


        const phone =
            String(
                formData.get(
                    "phone"
                ) || ""
            ).trim();


        const address =
            String(
                formData.get(
                    "address"
                ) || ""
            ).trim();


        const country =
            String(
                formData.get(
                    "country"
                ) || ""
            ).trim();


        const countryCode =
            String(
                formData.get(
                    "countryCode"
                ) || ""
            )
                .trim()
                .toUpperCase();


        const province =
            String(
                formData.get(
                    "province"
                ) || ""
            ).trim();


        const city =
            String(
                formData.get(
                    "city"
                ) || ""
            ).trim();


        if (
            name.length < 2
        ) {

            markInvalid(
                nameField
            );

            throw new Error(
                "Please enter your full name."
            );
        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {

            markInvalid(
                emailField
            );

            throw new Error(
                "Please enter a valid email address."
            );
        }


        const phoneDigits =
            phone.replace(
                /[^\d]/g,
                ""
            );


        if (
            phoneDigits.length < 7 ||
            phoneDigits.length > 15
        ) {

            markInvalid(
                phoneField
            );

            throw new Error(
                "Please enter a valid phone number."
            );
        }


        if (
            !address
        ) {

            markInvalid(
                addressField
            );

            throw new Error(
                "Please enter your shipping address."
            );
        }


        if (
            !country
        ) {

            markInvalid(
                countryField
            );

            throw new Error(
                "Please enter your country."
            );
        }


        if (
            !/^[A-Z]{2}$/.test(
                countryCode
            )
        ) {

            markInvalid(
                countryCodeField
            );

            throw new Error(
                "Please enter a valid two-letter country code, such as US."
            );
        }


        if (
            !province
        ) {

            markInvalid(
                provinceField
            );

            throw new Error(
                "Please enter your state or province."
            );
        }


        if (
            !city
        ) {

            markInvalid(
                cityField
            );

            throw new Error(
                "Please enter your city."
            );
        }


        return {

            name,

            email,

            phone,

            address,

            address2:
                String(
                    formData.get(
                        "address2"
                    ) || ""
                ).trim(),

            city,

            province,

            country,

            countryCode,

            zip:
                String(
                    formData.get(
                        "zip"
                    ) || ""
                ).trim(),

            county:
                String(
                    formData.get(
                        "county"
                    ) || ""
                ).trim(),

            remark:
                String(
                    formData.get(
                        "remark"
                    ) || ""
                ).trim()

        };
    }


    /* ========================================================================
       ENRICH CART
       ======================================================================== */

    function buildEnrichedCart() {

        const currentCart =
            getCart();


        if (
            !currentCart.length
        ) {

            throw new Error(
                "Your cart is empty. Please return to the shop."
            );
        }


        const enrichedCart =
            [];


        for (
            const item
            of currentCart
        ) {

            const product =
                productMap.get(
                    String(
                        item.id
                    )
                );


            if (!product) {

                throw new Error(
                    `Could not find product "${item.id}". Please return to the shop and add it again.`
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


            enrichedCart.push({

                id:
                    String(
                        product.id
                    ),

                sku:
                    String(
                        product.sku ||
                        item.sku ||
                        ""
                    ),

                cjSku:
                    String(
                        product.cjSku ||
                        product.sku ||
                        item.cjSku ||
                        item.sku ||
                        ""
                    ),

                variantSku:
                    String(
                        item.variantSku ||
                        ""
                    ),

                vid:
                    String(
                        item.vid ||
                        ""
                    ),

                name:
                    String(
                        product.name ||
                        "Product"
                    ),

                image:
                    String(
                        product.image ||
                        ""
                    ),

                variantOptions:
                    String(
                        item.variantOptions ||
                        ""
                    ),

                quantity

            });
        }


        return enrichedCart;
    }


    /* ========================================================================
       SAVE PENDING ORDER
       ======================================================================== */

    function savePendingOrder(
        data
    ) {

        try {

            sessionStorage.setItem(
                "prasun_pending_cj_order",
                JSON.stringify({

                    orderNumber:
                        data.orderNumber ||
                        "",

                    cjOrderId:
                        data.cjOrderId ||
                        "",

                    shipmentOrderId:
                        data.shipmentOrderId ||
                        "",

                    cjOrderAmount:
                        Number(
                            data.cjOrderAmount
                        ) || 0,

                    createdAt:
                        Date.now()

                })
            );

        } catch (
            error
        ) {

            console.warn(
                "[PRASUN SHOP] Could not save pending CJ order:",
                error
            );
        }
    }


    /* ========================================================================
       SUBMIT CHECKOUT
       ======================================================================== */

    async function submitCheckout(
        event
    ) {

        event.preventDefault();


        if (
            checkoutProcessing
        ) {

            return;
        }


        hideFormError();

        setStatus("");


        cart =
            getCart();


        updateCartCount();


        if (
            !cart.length
        ) {

            showFormError(
                "Your cart is empty. Please return to the shop."
            );

            return;
        }


        if (
            !checkoutForm
        ) {

            return;
        }


        const formData =
            new FormData(
                checkoutForm
            );


        let customer;


        try {

            customer =
                validateForm(
                    formData
                );

        } catch (
            error
        ) {

            showFormError(
                error?.message ||
                "Please check your shipping information."
            );

            return;
        }


        if (
            !placeOrderButton
        ) {

            return;
        }


        checkoutProcessing =
            true;


        const originalText =
            placeOrderButton.textContent;


        placeOrderButton.disabled =
            true;


        placeOrderButton.classList.add(
            "checkout-processing"
        );


        placeOrderButton.textContent =
            "Preparing order...";


        try {

            /*
             * Always refresh products before creating
             * the order so the Worker receives current
             * product/SKU information.
             */

            await fetchProducts();


            const enrichedCart =
                buildEnrichedCart();


            setStatus(
                "Creating your CJ order securely..."
            );


            placeOrderButton.textContent =
                "Creating CJ Order...";


            const requestBody = {

                customerName:
                    customer.name,

                email:
                    customer.email,

                phone:
                    customer.phone,

                address:
                    customer.address,

                address2:
                    customer.address2,

                shippingCity:
                    customer.city,

                shippingProvince:
                    customer.province,

                shippingCountry:
                    customer.country,

                shippingCountryCode:
                    customer.countryCode,

                shippingZip:
                    customer.zip,

                shippingCounty:
                    customer.county,

                remark:
                    customer.remark,

                cart:
                    enrichedCart

            };


            const response =
                await fetchWithTimeout(
                    ORDER_ENDPOINT,
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
                                requestBody
                            )
                    }
                );


            const responseText =
                await response.text();


            let data =
                null;


            if (
                responseText
            ) {

                try {

                    data =
                        JSON.parse(
                            responseText
                        );

                } catch (
                    error
                ) {

                    console.error(
                        "[PRASUN SHOP] Invalid Worker JSON:",
                        responseText
                    );

                    throw new Error(
                        "The order server returned an invalid response."
                    );
                }
            }


            if (
                !response.ok
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Order server returned HTTP ${response.status}.`
                );
            }


            if (
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "CJ could not create the order."
                );
            }


            const cjPayUrl =
                String(
                    data.cjPayUrl ||
                    ""
                ).trim();


            if (
                !cjPayUrl
            ) {

                throw new Error(
                    "CJ created the order, but no payment URL was returned."
                );
            }


            if (
                !isValidHttpUrl(
                    cjPayUrl
                )
            ) {

                throw new Error(
                    "CJ returned an invalid payment URL."
                );
            }


            /*
             * Save the CJ order information before redirect.
             */

            savePendingOrder(
                data
            );


            /*
             * IMPORTANT:
             *
             * At this point the Worker has confirmed that
             * CJ accepted/created the order.
             *
             * We can safely clear the browser cart.
             */

            clearAllCartKeys();


            cart = [];


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


            setStatus(
                "Order created. Redirecting to secure CJ payment..."
            );


            placeOrderButton.textContent =
                "Redirecting to Payment...";


            /*
             * Small delay allows the status text to be
             * rendered before navigation.
             */

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        250
                    )
            );


            window.location.assign(
                cjPayUrl
            );


        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Checkout error:",
                error
            );


            showFormError(
                error?.message ||
                "Unable to create your order. Please try again."
            );


            setStatus("");


            placeOrderButton.disabled =
                false;


            placeOrderButton.textContent =
                originalText;


            placeOrderButton.classList.remove(
                "checkout-processing"
            );


            checkoutProcessing =
                false;

        }

    }


    /* ========================================================================
       CART STORAGE SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                    CART_KEY ||
                LEGACY_CART_KEYS.includes(
                    event.key
                )
            ) {

                cart =
                    getCart();

                updateCartCount();

                loadCheckoutSummary();

            }

        }
    );


    /* ========================================================================
       CUSTOM CART SYNC
       ======================================================================== */

    window.addEventListener(
        "prasunCartUpdated",
        () => {

            cart =
                getCart();

            updateCartCount();

            loadCheckoutSummary();

        }
    );


    /* ========================================================================
       FORM INPUT ERROR RESET
       ======================================================================== */

    if (checkoutForm) {

        checkoutForm
            .querySelectorAll(
                "input, textarea, select"
            )
            .forEach(
                field => {

                    field.addEventListener(
                        "input",
                        () => {

                            field.classList.remove(
                                "invalid"
                            );

                            hideFormError();

                        }
                    );

                }
            );


        checkoutForm.addEventListener(
            "submit",
            submitCheckout
        );
    }


    /* ========================================================================
       COUNTRY CODE NORMALIZATION
       ======================================================================== */

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


    /* ========================================================================
       INITIALIZATION
       ======================================================================== */

    cart =
        getCart();


    updateCartCount();


    loadCheckoutSummary();

})();
