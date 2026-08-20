/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * Browser flow:
 *
 * Cart
 *   ↓
 * Checkout
 *   ↓
 * Validate customer information
 *   ↓
 * Send product IDs + quantities
 *   ↓
 * PRASUN SHOP Worker
 *   ↓
 * Server-side catalog validation
 *   ↓
 * CJ shipping calculation
 *   ↓
 * CJ createOrderV2
 *   ↓
 * cjPayUrl
 *   ↓
 * CJ payment page
 *
 * IMPORTANT:
 *
 * The browser NEVER receives the CJ API token.
 *
 * The browser also does NOT send product prices to the Worker.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       CONFIG
       ======================================================================== */

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

    const ORDER_ENDPOINT =
        `${API_BASE}/api/order`;

    const MAX_QUANTITY =
        99;

    const REQUEST_TIMEOUT_MS =
        20000;


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

    const cartCount =
        document.getElementById(
            "cart-count"
        );


    /* ========================================================================
       FORMATTERS
       ======================================================================== */

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


    function formatPrice(
        value
    ) {

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


    /* ========================================================================
       HTML ESCAPING
       ======================================================================== */

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


    function escapeHTML(
        value
    ) {

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


    /* ========================================================================
       REQUEST TIMEOUT
       ======================================================================== */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () =>
                    controller.abort(),
                REQUEST_TIMEOUT_MS
            );


        try {

            return await fetch(
                resource,
                {
                    ...options,

                    signal:
                        controller.signal
                }
            );

        } catch (error) {

            if (
                error?.name ===
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
       CART
       ======================================================================== */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            item.id ===
                undefined ||
            item.id ===
                null
        ) {

            return null;
        }


        const quantity =
            Number(
                item.quantity
            );


        return {

            id:
                String(
                    item.id
                ),

            quantity:
                Number.isInteger(
                    quantity
                ) &&
                quantity > 0
                    ? Math.min(
                        MAX_QUANTITY,
                        quantity
                    )
                    : 1,

            /*
             * Preserve variant metadata.
             * The Worker does not trust CJ identifiers
             * from the browser.
             */

            variantOptions:
                String(
                    item.variantOptions ||
                    ""
                ).slice(
                    0,
                    200
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


            if (
                primary
            ) {

                return parseCart(
                    primary
                );
            }


            for (
                const key
                of LEGACY_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        key
                    );


                if (
                    legacy
                ) {

                    const cart =
                        parseCart(
                            legacy
                        );


                    if (
                        cart.length
                    ) {

                        localStorage.setItem(
                            CART_KEY,
                            JSON.stringify(
                                cart
                            )
                        );


                        return cart;
                    }
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
                "[PRASUN SHOP] Could not clear cart:",
                error
            );
        }
    }


    /* ========================================================================
       CART COUNT
       ======================================================================== */

    function updateCartCount(
        cart
    ) {

        if (
            !cartCount
        ) {

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
       ERROR UI
       ======================================================================== */

    function showError(
        message
    ) {

        if (
            checkoutError
        ) {

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

            return;
        }


        alert(
            message
        );
    }


    function hideError() {

        if (
            checkoutError
        ) {

            checkoutError.textContent =
                "";

            checkoutError.classList.remove(
                "visible"
            );
        }
    }


    function setStatus(
        message
    ) {

        if (
            checkoutStatus
        ) {

            checkoutStatus.textContent =
                message;
        }
    }


    /* ========================================================================
       PRODUCT CACHE
       ======================================================================== */

    let productMap =
        new Map();

    let productFetchPromise =
        null;


    async function fetchProducts() {

        if (
            productMap.size
        ) {

            return productMap;
        }


        if (
            productFetchPromise
        ) {

            return productFetchPromise;
        }


        productFetchPromise =
            (async () => {

                const response =
                    await fetchWithTimeout(
                        PRODUCTS_ENDPOINT,
                        {
                            method:
                                "GET",

                            cache:
                                "no-store",

                            headers: {
                                "Accept":
                                    "application/json"
                            }
                        }
                    );


                const text =
                    await response.text();


                let data;

                try {

                    data =
                        JSON.parse(
                            text
                        );

                } catch {

                    throw new Error(
                        "The product server returned invalid data."
                    );
                }


                if (
                    !response.ok
                ) {

                    throw new Error(
                        data?.error ||
                        `Products server returned HTTP ${response.status}.`
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


                productMap =
                    new Map(
                        products
                            .filter(Boolean)
                            .map(
                                product => [
                                    String(
                                        product.id
                                    ),
                                    product
                                ]
                            )
                    );


                return productMap;

            })()
                .catch(
                    error => {

                        productFetchPromise =
                            null;

                        throw error;
                    }
                );


        return productFetchPromise;
    }


    /* ========================================================================
       EMPTY CART
       ======================================================================== */

    function renderEmptyCheckout() {

        if (
            orderSummary
        ) {

            orderSummary.innerHTML = `

                <div class="empty-checkout">

                    <h2>
                        Your cart is empty
                    </h2>

                    <p>
                        Add products to your cart before continuing to checkout.
                    </p>

                    <a href="/">
                        Continue Shopping
                    </a>

                </div>

            `;
        }


        if (
            checkoutForm
        ) {

            checkoutForm.style.display =
                "none";
        }
    }


    /* ========================================================================
       ORDER SUMMARY
       ======================================================================== */

    async function renderSummary() {

        if (
            !orderSummary
        ) {

            return;
        }


        const cart =
            getCart();


        updateCartCount(
            cart
        );


        if (
            !cart.length
        ) {

            renderEmptyCheckout();

            return;
        }


        try {

            await fetchProducts();


            let total =
                0;

            let validCount =
                0;


            let html = "";


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


                if (
                    !product
                ) {

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
                        MAX_QUANTITY,
                        Math.max(
                            1,
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

                validCount++;


                const image =
                    escapeHTML(
                        product.image ||
                        ""
                    );


                const name =
                    escapeHTML(
                        product.name ||
                        "Product"
                    );


                html += `

                    <div class="summary-item">

                        ${
                            image
                                ? `
                                    <img
                                        class="summary-item-image"
                                        src="${image}"
                                        alt="${name}"
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
                                subtotal
                            )}

                        </div>

                    </div>

                `;
            }


            if (
                !validCount
            ) {

                renderEmptyCheckout();

                return;
            }


            html += `

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

                <div
                    class="checkout-status"
                    style="text-align:left;margin-top:10px;"
                >
                    Final CJ shipping and payable amount are calculated during checkout.
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
                "[PRASUN SHOP] Summary error:",
                error
            );


            orderSummary.innerHTML = `

                <div class="empty-checkout">

                    <h2>
                        Unable to load order
                    </h2>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                    <button
                        type="button"
                        id="retry-summary"
                        style="
                            border:0;
                            border-radius:10px;
                            padding:11px 18px;
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


            const retry =
                document.getElementById(
                    "retry-summary"
                );


            if (
                retry
            ) {

                retry.addEventListener(
                    "click",
                    renderSummary
                );
            }
        }
    }


    /* ========================================================================
       FORM VALIDATION
       ======================================================================== */

    function getFormData() {

        const formData =
            new FormData(
                checkoutForm
            );


        const customerName =
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


        const zip =
            String(
                formData.get(
                    "zip"
                ) || ""
            ).trim();


        const county =
            String(
                formData.get(
                    "county"
                ) || ""
            ).trim();


        const address =
            String(
                formData.get(
                    "address"
                ) || ""
            ).trim();


        const address2 =
            String(
                formData.get(
                    "address2"
                ) || ""
            ).trim();


        const remark =
            String(
                formData.get(
                    "remark"
                ) || ""
            ).trim();


        if (
            !customerName
        ) {

            throw new Error(
                "Please enter your full name."
            );
        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {

            throw new Error(
                "Please enter a valid email address."
            );
        }


        if (
            !phone
        ) {

            throw new Error(
                "Please enter your phone number."
            );
        }


        if (
            !country
        ) {

            throw new Error(
                "Please enter your country."
            );
        }


        if (
            !/^[A-Z]{2}$/.test(
                countryCode
            )
        ) {

            throw new Error(
                "Please enter a valid two-letter country code."
            );
        }


        if (
            !province
        ) {

            throw new Error(
                "Please enter your state/province."
            );
        }


        if (
            !city
        ) {

            throw new Error(
                "Please enter your city."
            );
        }


        if (
            !address
        ) {

            throw new Error(
                "Please enter your shipping address."
            );
        }


        return {

            customerName,

            email,

            phone,

            shippingCountry:
                country,

            shippingCountryCode:
                countryCode,

            shippingProvince:
                province,

            shippingCity:
                city,

            shippingZip:
                zip,

            shippingCounty:
                county,

            address,

            address2,

            remark
        };
    }


    /* ========================================================================
       BUILD SERVER CART
       ======================================================================== */

    function buildServerCart() {

        return getCart().map(
            item => ({

                id:
                    String(
                        item.id
                    ),

                quantity:
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
                    ),

                variantOptions:
                    String(
                        item.variantOptions ||
                        ""
                    ).slice(
                        0,
                        200
                    )
            })
        );
    }


    /* ========================================================================
       SUBMIT ORDER
       ======================================================================== */

    async function submitOrder(
        event
    ) {

        event.preventDefault();

        hideError();


        const cart =
            getCart();


        updateCartCount(
            cart
        );


        if (
            !cart.length
        ) {

            showError(
                "Your cart is empty. Please return to the shop."
            );

            return;
        }


        let form;

        try {

            form =
                getFormData();

        } catch (error) {

            showError(
                error.message
            );

            return;
        }


        const submitButton =
            document.getElementById(
                "place-order-button"
            );


        if (
            !submitButton ||
            submitButton.dataset.processing ===
                "true"
        ) {

            return;
        }


        const originalText =
            submitButton.textContent;


        submitButton.dataset.processing =
            "true";

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Preparing Order...";


        setStatus(
            "Validating your order..."
        );


        try {

            /*
             * Ensure product IDs exist locally.
             */

            await fetchProducts();


            for (
                const item
                of cart
            ) {

                if (
                    !productMap.has(
                        String(
                            item.id
                        )
                    )
                ) {

                    throw new Error(
                        `Product ${item.id} is no longer available.`
                    );
                }
            }


            setStatus(
                "Calculating shipping and creating your CJ order..."
            );


            const requestBody = {

                customerName:
                    form.customerName,

                email:
                    form.email,

                phone:
                    form.phone,

                address:
                    form.address,

                address2:
                    form.address2,

                shippingCity:
                    form.shippingCity,

                shippingProvince:
                    form.shippingProvince,

                shippingCountry:
                    form.shippingCountry,

                shippingCountryCode:
                    form.shippingCountryCode,

                shippingZip:
                    form.shippingZip,

                shippingCounty:
                    form.shippingCounty,

                remark:
                    form.remark,

                /*
                 * Only IDs and quantities are sent.
                 *
                 * Product price/CJ SKU/CJ VID are
                 * resolved by the Worker.
                 */

                cart:
                    buildServerCart()
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

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                requestBody
                            )
                    }
                );


            const text =
                await response.text();


            let data =
                null;


            try {

                data =
                    text
                        ? JSON.parse(
                            text
                        )
                        : null;

            } catch {

                data =
                    null;
            }


            if (
                !response.ok
            ) {

                throw new Error(
                    data?.error ||
                    `Order server returned HTTP ${response.status}.`
                );
            }


            if (
                !data?.success
            ) {

                throw new Error(
                    data?.error ||
                    "CJ could not create the order."
                );
            }


            if (
                !data.cjPayUrl
            ) {

                throw new Error(
                    "CJ created the order but did not return a payment page."
                );
            }


            /*
             * Store temporary order information.
             */

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
                            data.cjOrderAmount ||
                            0,

                        shippingCost:
                            data.shippingCost ||
                            0,

                        shippingMethod:
                            data.shippingMethod ||
                            "",

                        shippingEstimate:
                            data.shippingEstimate ||
                            "",

                        createdAt:
                            Date.now()
                    })
                );

            } catch (error) {

                console.warn(
                    "[PRASUN SHOP] Session storage unavailable:",
                    error
                );
            }


            /*
             * CJ order now exists.
             *
             * Clear the cart only after CJ
             * successfully created the order.
             */

            clearCart();


            updateCartCount(
                []
            );


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
                "Order created. Redirecting to CJ payment..."
            );


            submitButton.textContent =
                "Redirecting to Payment...";


            /*
             * Redirect to CJ.
             */

            window.location.assign(
                data.cjPayUrl
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout error:",
                error
            );


            showError(
                error?.message ||
                "Unable to create the order. Please try again."
            );


            setStatus(
                ""
            );


            submitButton.disabled =
                false;

            submitButton.textContent =
                originalText;

            submitButton.dataset.processing =
                "false";
        }
    }


    /* ========================================================================
       EVENT LISTENERS
       ======================================================================== */

    if (
        checkoutForm
    ) {

        checkoutForm.addEventListener(
            "submit",
            submitOrder
        );
    }


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

                renderSummary();
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        () => {

            renderSummary();
        }
    );


    /* ========================================================================
       INITIALIZE
       ======================================================================== */

    const initialCart =
        getCart();


    updateCartCount(
        initialCart
    );


    renderSummary();

})();
