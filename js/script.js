/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT SCRIPT
 * ============================================================================
 *
 * Handles:
 *
 * - Cart loading from localStorage
 * - Checkout order summary
 * - Customer/shipping form validation
 * - Quantity-safe totals
 * - POST /api/order
 * - Loading / error / success states
 * - Order confirmation
 * - Cart count
 * - Duplicate-submit protection
 *
 * API:
 *
 * GET  https://shop.prasunbarua.com/api/products
 * POST https://shop.prasunbarua.com/api/order
 *
 * Cart storage:
 *
 * localStorage["prasun_shop_cart"]
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIG
       ========================================================================= */

    const CONFIG = {

        API_BASE:
            "https://shop.prasunbarua.com",

        ORDER_ENDPOINT:
            "/api/order",

        CART_STORAGE_KEY:
            "prasun_shop_cart",

        REQUEST_TIMEOUT:
            20000

    };


    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {

        cart: [],

        submitting: false,

        orderPlaced: false

    };


    /* =========================================================================
       DOM
       ========================================================================= */

    const elements = {

        checkoutLayout:
            document.getElementById(
                "checkout-layout"
            ),

        checkoutForm:
            document.getElementById(
                "checkout-form"
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

        orderSummary:
            document.getElementById(
                "order-summary"
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
       HELPERS
       ========================================================================= */

    function escapeHtml(value) {

        return String(
            value ?? ""
        )

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }


    function formatPrice(value) {

        const price =
            Number(value);


        if (
            !Number.isFinite(price)
        ) {

            return "$0.00";

        }


        return new Intl.NumberFormat(
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
        ).format(price);

    }


    function normalizeQuantity(value) {

        const quantity =
            Number(value);


        if (
            !Number.isFinite(quantity) ||
            quantity < 1
        ) {

            return 1;

        }


        return Math.max(
            1,
            Math.floor(quantity)
        );

    }


    function getItemPrice(item) {

        const price =
            Number(
                item?.price
            );


        return Number.isFinite(price)
            ? price
            : 0;

    }


    function getItemQuantity(item) {

        return normalizeQuantity(
            item?.quantity
        );

    }


    function getItemTotal(item) {

        return (
            getItemPrice(item) *
            getItemQuantity(item)
        );

    }


    function getCartSubtotal() {

        return state.cart.reduce(
            (
                total,
                item
            ) => {

                return (
                    total +
                    getItemTotal(item)
                );

            },
            0
        );

    }


    function getCartQuantity() {

        return state.cart.reduce(
            (
                total,
                item
            ) => {

                return (
                    total +
                    getItemQuantity(item)
                );

            },
            0
        );

    }


    /* =========================================================================
       CART
       ========================================================================= */

    function loadCart() {

        try {

            const raw =
                localStorage.getItem(
                    CONFIG.CART_STORAGE_KEY
                );


            if (
                !raw
            ) {

                state.cart = [];

                return;

            }


            const parsed =
                JSON.parse(
                    raw
                );


            if (
                !Array.isArray(parsed)
            ) {

                state.cart = [];

                return;

            }


            state.cart =
                parsed
                    .filter(
                        item =>
                            item &&
                            typeof item ===
                                "object"
                    )
                    .map(
                        item => ({

                            ...item,

                            quantity:
                                getItemQuantity(
                                    item
                                ),

                            price:
                                getItemPrice(
                                    item
                                )

                        })
                    )
                    .filter(
                        item =>
                            item.id ||
                            item.sku
                    );


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart parsing error:",
                error
            );


            state.cart = [];

        }

    }


    function saveCart() {

        try {

            localStorage.setItem(
                CONFIG.CART_STORAGE_KEY,
                JSON.stringify(
                    state.cart
                )
            );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Unable to save cart:",
                error
            );

        }

    }


    function updateCartCount() {

        if (
            !elements.cartCount
        ) {

            return;

        }


        const count =
            getCartQuantity();


        elements.cartCount.textContent =
            String(count);


        elements.cartCount.hidden =
            count <= 0;

    }


    /* =========================================================================
       MESSAGES
       ========================================================================= */

    function showError(message) {

        if (
            !elements.checkoutError
        ) {

            return;

        }


        elements.checkoutError.textContent =
            message;


        elements.checkoutError.classList.add(
            "visible"
        );

    }


    function hideError() {

        if (
            elements.checkoutError
        ) {

            elements.checkoutError.textContent =
                "";

            elements.checkoutError.classList.remove(
                "visible"
            );

        }

    }


    function showSuccess(message) {

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
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.textContent =
                "";

            elements.checkoutSuccess.classList.remove(
                "visible"
            );

        }

    }


    function setStatus(message) {

        if (
            elements.checkoutStatus
        ) {

            elements.checkoutStatus.textContent =
                message || "";

        }

    }


    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function renderEmptyCart() {

        if (
            !elements.orderSummary
        ) {

            return;

        }


        elements.orderSummary.innerHTML = `

            <div class="empty-checkout">

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Add products to your cart before proceeding
                    to checkout.
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


        setStatus(
            "Your cart is empty."
        );

    }


    /* =========================================================================
       ORDER SUMMARY
       ========================================================================= */

    function renderOrderSummary() {

        if (
            !elements.orderSummary
        ) {

            return;

        }


        if (
            !state.cart.length
        ) {

            renderEmptyCart();

            return;

        }


        const subtotal =
            getCartSubtotal();


        const shipping =
            0;


        const total =
            subtotal +
            shipping;


        const itemsHtml =
            state.cart
                .map(
                    item => {

                        const name =
                            item.name ||
                            item.title ||
                            "Product";


                        const image =
                            String(
                                item.image ||
                                ""
                            ).trim();


                        const quantity =
                            getItemQuantity(
                                item
                            );


                        const price =
                            getItemPrice(
                                item
                            );


                        return `

                            <div class="summary-item">

                                ${
                                    image

                                        ? `

                                            <img
                                                class="summary-item-image"
                                                src="${escapeHtml(image)}"
                                                alt="${escapeHtml(name)}"
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

                                        ${escapeHtml(name)}

                                    </p>


                                    <div class="summary-item-meta">

                                        Qty:
                                        ${quantity}

                                        ×

                                        ${formatPrice(price)}

                                    </div>

                                </div>


                                <div class="summary-item-price">

                                    ${formatPrice(
                                        price *
                                        quantity
                                    )}

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");


        elements.orderSummary.innerHTML = `

            <div class="summary-items">

                ${itemsHtml}

            </div>


            <div class="summary-row">

                <span>
                    Subtotal
                </span>

                <strong>
                    ${formatPrice(subtotal)}
                </strong>

            </div>


            <div class="summary-row">

                <span>
                    Shipping
                </span>

                <strong>
                    ${
                        shipping > 0
                            ? formatPrice(shipping)
                            : "Free"
                    }
                </strong>

            </div>


            <div class="summary-total">

                <span>
                    Total
                </span>

                <strong>
                    ${formatPrice(total)}
                </strong>

            </div>

        `;


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                false;

        }


        elements.orderSummary.setAttribute(
            "aria-busy",
            "false"
        );

    }


    /* =========================================================================
       FORM VALIDATION
       ========================================================================= */

    function clearInvalidFields() {

        if (
            !elements.checkoutForm
        ) {

            return;

        }


        elements.checkoutForm
            .querySelectorAll(
                ".invalid"
            )
            .forEach(
                field => {

                    field.classList.remove(
                        "invalid"
                    );

                }
            );

    }


    function markInvalid(
        element
    ) {

        if (
            element
        ) {

            element.classList.add(
                "invalid"
            );

        }

    }


    function validateEmail(
        email
    ) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                email
            );

    }


    function validateForm() {

        if (
            !elements.checkoutForm
        ) {

            return false;

        }


        clearInvalidFields();


        const form =
            elements.checkoutForm;


        const name =
            form.elements.name?.value.trim() ||
            "";


        const email =
            form.elements.email?.value.trim() ||
            "";


        const phone =
            form.elements.phone?.value.trim() ||
            "";


        const country =
            form.elements.country?.value.trim() ||
            "";


        const countryCode =
            form.elements.countryCode?.value.trim() ||
            "";


        const province =
            form.elements.province?.value.trim() ||
            "";


        const city =
            form.elements.city?.value.trim() ||
            "";


        const address =
            form.elements.address?.value.trim() ||
            "";


        if (
            name.length < 2
        ) {

            markInvalid(
                form.elements.name
            );

            showError(
                "Please enter your full name."
            );

            form.elements.name?.focus();

            return false;

        }


        if (
            !validateEmail(email)
        ) {

            markInvalid(
                form.elements.email
            );

            showError(
                "Please enter a valid email address."
            );

            form.elements.email?.focus();

            return false;

        }


        if (
            phone.length < 5
        ) {

            markInvalid(
                form.elements.phone
            );

            showError(
                "Please enter a valid phone number."
            );

            form.elements.phone?.focus();

            return false;

        }


        if (
            !country
        ) {

            markInvalid(
                form.elements.country
            );

            showError(
                "Please enter your country."
            );

            form.elements.country?.focus();

            return false;

        }


        if (
            !/^[A-Za-z]{2}$/.test(
                countryCode
            )
        ) {

            markInvalid(
                form.elements.countryCode
            );

            showError(
                "Country Code must contain exactly two letters, for example US."
            );

            form.elements.countryCode?.focus();

            return false;

        }


        if (
            !province
        ) {

            markInvalid(
                form.elements.province
            );

            showError(
                "Please enter your state or province."
            );

            form.elements.province?.focus();

            return false;

        }


        if (
            !city
        ) {

            markInvalid(
                form.elements.city
            );

            showError(
                "Please enter your city."
            );

            form.elements.city?.focus();

            return false;

        }


        if (
            !address
        ) {

            markInvalid(
                form.elements.address
            );

            showError(
                "Please enter your delivery address."
            );

            form.elements.address?.focus();

            return false;

        }


        return true;

    }


    /* =========================================================================
       REQUEST WITH TIMEOUT
       ========================================================================= */

    async function fetchWithTimeout(
        url,
        options = {},
        timeout = CONFIG.REQUEST_TIMEOUT
    ) {

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

            return await fetch(
                url,
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
                    "The order request timed out. Please try again."
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
       BUILD ORDER PAYLOAD
       ========================================================================= */

    function buildOrderPayload() {

        const form =
            elements.checkoutForm;


        const data =
            new FormData(
                form
            );


        const items =
            state.cart.map(
                item => ({

                    id:
                        item.id ??
                        null,

                    pid:
                        item.pid ??
                        null,

                    sku:
                        item.sku ??
                        null,

                    name:
                        item.name ||
                        item.title ||
                        "",

                    price:
                        getItemPrice(
                            item
                        ),

                    quantity:
                        getItemQuantity(
                            item
                        ),

                    image:
                        item.image ||
                        ""

                })
            );


        return {

            customer: {

                name:
                    String(
                        data.get("name") ||
                        ""
                    ).trim(),

                email:
                    String(
                        data.get("email") ||
                        ""
                    ).trim(),

                phone:
                    String(
                        data.get("phone") ||
                        ""
                    ).trim()

            },


            shippingAddress: {

                country:
                    String(
                        data.get("country") ||
                        ""
                    ).trim(),

                countryCode:
                    String(
                        data.get("countryCode") ||
                        ""
                    ).trim()
                    .toUpperCase(),

                province:
                    String(
                        data.get("province") ||
                        ""
                    ).trim(),

                city:
                    String(
                        data.get("city") ||
                        ""
                    ).trim(),

                zip:
                    String(
                        data.get("zip") ||
                        ""
                    ).trim(),

                county:
                    String(
                        data.get("county") ||
                        ""
                    ).trim(),

                address:
                    String(
                        data.get("address") ||
                        ""
                    ).trim(),

                address2:
                    String(
                        data.get("address2") ||
                        ""
                    ).trim()

            },


            remark:
                String(
                    data.get("remark") ||
                    ""
                ).trim(),

            items

        };

    }


    /* =========================================================================
       SUBMIT ORDER
       ========================================================================= */

    async function submitOrder(
        event
    ) {

        event.preventDefault();


        if (
            state.submitting ||
            state.orderPlaced
        ) {

            return;

        }


        hideError();
        hideSuccess();


        if (
            !state.cart.length
        ) {

            showError(
                "Your cart is empty. Please add a product before placing an order."
            );

            renderEmptyCart();

            return;

        }


        if (
            !validateForm()
        ) {

            return;

        }


        state.submitting =
            true;


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                true;

            elements.placeOrderButton.textContent =
                "Placing Order...";

        }


        setStatus(
            "Submitting your order securely..."
        );


        try {

            const payload =
                buildOrderPayload();


            console.log(
                "[PRASUN SHOP] Submitting order:",
                payload
            );


            const response =
                await fetchWithTimeout(

                    new URL(
                        CONFIG.ORDER_ENDPOINT,
                        CONFIG.API_BASE
                    ).toString(),

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
                                payload
                            )

                    }

                );


            const text =
                await response.text();


            console.log(
                "[PRASUN SHOP] Order API status:",
                response.status
            );


            console.log(
                "[PRASUN SHOP] Order API response:",
                text.slice(
                    0,
                    1000
                )
            );


            let result = null;


            if (
                text.trim()
            ) {

                try {

                    result =
                        JSON.parse(
                            text
                        );

                } catch {

                    throw new Error(
                        "The order API returned invalid JSON."
                    );

                }

            }


            if (
                !response.ok
            ) {

                throw new Error(

                    result?.error ||
                    result?.message ||
                    `Order request failed with HTTP ${response.status}.`

                );

            }


            if (
                result &&
                result.success === false
            ) {

                throw new Error(

                    result.error ||
                    result.message ||
                    "The order could not be created."

                );

            }


            /*
             * Accept common order-number field names
             * from the Worker.
             */

            const orderNumber =
                result?.orderNumber ||
                result?.orderId ||
                result?.order_id ||
                result?.id ||
                "Order submitted";


            handleOrderSuccess(
                orderNumber
            );


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Order submission error:",
                error
            );


            showError(
                error?.message ||
                "Unable to place the order. Please try again."
            );


            setStatus(
                "Please check your information and try again."
            );


        } finally {

            state.submitting =
                false;


            if (
                !state.orderPlaced &&
                elements.placeOrderButton
            ) {

                elements.placeOrderButton.disabled =
                    false;

                elements.placeOrderButton.textContent =
                    "Place Order";

            }

        }

    }


    /* =========================================================================
       SUCCESS
       ========================================================================= */

    function handleOrderSuccess(
        orderNumber
    ) {

        state.orderPlaced =
            true;


        /*
         * Clear the cart only after the Worker
         * successfully accepts the order.
         */

        state.cart = [];


        try {

            localStorage.removeItem(
                CONFIG.CART_STORAGE_KEY
            );

        } catch (error) {

            console.warn(
                "[PRASUN SHOP] Unable to clear cart:",
                error
            );

        }


        updateCartCount();


        hideError();


        showSuccess(
            "Your order has been received successfully."
        );


        setStatus(
            ""
        );


        if (
            elements.checkoutForm
        ) {

            elements.checkoutForm.style.display =
                "none";

        }


        if (
            elements.orderSummary
        ) {

            elements.orderSummary.innerHTML = `

                <div class="checkout-status">

                    Order submitted successfully.

                </div>

            `;

        }


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                true;

        }


        if (
            elements.confirmationOrderNumber
        ) {

            elements.confirmationOrderNumber.textContent =
                `Order #${orderNumber}`;

        }


        if (
            elements.orderConfirmation
        ) {

            elements.orderConfirmation.classList.add(
                "visible"
            );

        }


        if (
            elements.checkoutLayout
        ) {

            elements.checkoutLayout.scrollIntoView(
                {
                    behavior:
                        "smooth",

                    block:
                        "start"
                }
            );

        }

    }


    /* =========================================================================
       FIELD EVENTS
       ========================================================================= */

    function bindFieldValidation() {

        if (
            !elements.checkoutForm
        ) {

            return;

        }


        elements.checkoutForm
            .querySelectorAll(
                "input, select, textarea"
            )
            .forEach(
                field => {

                    field.addEventListener(
                        "input",
                        () => {

                            field.classList.remove(
                                "invalid"
                            );


                            if (
                                elements.checkoutError
                            ) {

                                elements.checkoutError.classList.remove(
                                    "visible"
                                );

                            }

                        }
                    );

                }
            );

    }


    /* =========================================================================
       INIT
       ========================================================================= */

    function init() {

        loadCart();

        updateCartCount();

        renderOrderSummary();

        bindFieldValidation();


        if (
            elements.checkoutForm
        ) {

            elements.checkoutForm.addEventListener(
                "submit",
                submitOrder
            );

        }


        if (
            !state.cart.length
        ) {

            console.log(
                "[PRASUN SHOP] Checkout initialized with empty cart."
            );

        } else {

            console.log(
                "[PRASUN SHOP] Checkout initialized:",
                {
                    items:
                        state.cart.length,

                    quantity:
                        getCartQuantity(),

                    subtotal:
                        getCartSubtotal()
                }
            );

        }

    }


    /* =========================================================================
       START
       ========================================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();

    }

})();
