/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * Canonical cart:
 *
 *     prasun_cart
 *
 * Product API:
 *
 *     Cloudflare Worker /api/products
 *
 * Order API:
 *
 *     Cloudflare Worker /api/orders
 *
 * The CJ API key NEVER appears in this file.
 * ============================================================================
 */

"use strict";

(() => {

    const CART_KEY =
        "prasun_cart";

    const API_BASE =
        "https://prasun-shop-api.prasun301.workers.dev";

    const PRODUCTS_ENDPOINT =
        `${API_BASE}/api/products`;

    const ORDER_ENDPOINT =
        `${API_BASE}/api/orders`;

    const MAX_QUANTITY =
        99;

    const REQUEST_TIMEOUT =
        15000;


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


    let cart = [];

    let products = new Map();

    let submitting =
        false;


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
                character => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                })[character]
            );
    }


    function quantity(value) {

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


    async function fetchWithTimeout(
        url,
        options = {}
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () =>
                    controller.abort(),
                REQUEST_TIMEOUT
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
                error.name ===
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
       CART
       ======================================================================== */

    function readCart() {

        try {

            const raw =
                localStorage.getItem(
                    CART_KEY
                );

            if (!raw) {
                return [];
            }

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
                .filter(Boolean)
                .map(item => ({

                    id:
                        String(
                            item.id ??
                            item.productId ??
                            item.cjProductId ??
                            ""
                        ),

                    cjProductId:
                        String(
                            item.cjProductId ??
                            item.productId ??
                            item.id ??
                            ""
                        ),

                    sku:
                        String(
                            item.sku ??
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

                    variantOptions:
                        String(
                            item.variantOptions ??
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

                    quantity:
                        quantity(
                            item.quantity
                        )
                }))
                .filter(
                    item =>
                        item.id ||
                        item.cjProductId ||
                        item.cjSku ||
                        item.vid
                );

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout cart error:",
                error
            );

            return [];
        }
    }


    /* ========================================================================
       PRODUCT FETCH
       ======================================================================== */

    async function fetchProduct(
        item
    ) {

        /*
         * Try the product ID first.
         */

        const identifiers = [
            item.cjProductId,
            item.id,
            item.cjSku,
            item.variantSku,
            item.sku
        ]
            .map(
                value =>
                    String(
                        value ||
                        ""
                    ).trim()
            )
            .filter(Boolean);


        for (
            const identifier
            of identifiers
        ) {

            try {

                const response =
                    await fetchWithTimeout(
                        `${PRODUCTS_ENDPOINT}?id=${encodeURIComponent(identifier)}`,
                        {
                            method:
                                "GET",

                            headers: {
                                Accept:
                                    "application/json"
                            },

                            cache:
                                "no-store"
                        }
                    );

                if (
                    !response.ok
                ) {
                    continue;
                }

                const data =
                    await response.json();

                if (
                    data?.success &&
                    data?.product
                ) {

                    return data.product;
                }

            } catch (error) {

                console.warn(
                    "[PRASUN SHOP] Product lookup failed:",
                    identifier,
                    error
                );
            }
        }


        /*
         * Last-resort local cart data.
         */

        if (
            item.name ||
            item.price
        ) {

            return {

                id:
                    item.id,

                cjProductId:
                    item.cjProductId,

                sku:
                    item.sku,

                cjSku:
                    item.cjSku,

                name:
                    item.name,

                price:
                    item.price,

                image:
                    item.image,

                category:
                    item.category,

                variants: []
            };
        }

        return null;
    }


    /* ========================================================================
       LOAD PRODUCTS
       ======================================================================== */

    async function loadCheckoutProducts() {

        cart =
            readCart();

        if (!cart.length) {

            renderEmpty();

            return false;
        }


        const resolved =
            [];

        for (
            const item
            of cart
        ) {

            const product =
                await fetchProduct(
                    item
                );

            if (!product) {

                console.warn(
                    "[PRASUN SHOP] Could not resolve cart item:",
                    item
                );

                continue;
            }

            products.set(
                String(
                    product.id
                ),
                product
            );

            resolved.push({
                item,
                product
            });
        }


        if (!resolved.length) {

            renderEmpty();

            showError(
                "The products in your cart could not be loaded. Please return to the shop and add the product again."
            );

            return false;
        }


        renderSummary(
            resolved
        );

        return true;
    }


    /* ========================================================================
       EMPTY STATE
       ======================================================================== */

    function renderEmpty() {

        const summary =
            document.getElementById(
                "order-summary"
            );

        const layout =
            document.getElementById(
                "checkout-layout"
            );

        if (summary) {

            summary.setAttribute(
                "aria-busy",
                "false"
            );

            summary.innerHTML = `

                <div class="empty-checkout">

                    <h2>
                        Your cart is empty
                    </h2>

                    <p>
                        Add a product to your cart before proceeding to checkout.
                    </p>

                    <a href="/">
                        Continue Shopping
                    </a>

                </div>
            `;
        }

        /*
         * Do not show a huge shopping icon.
         */

        if (layout) {

            layout.style.opacity =
                "1";
        }

        const button =
            document.getElementById(
                "place-order-button"
            );

        if (button) {
            button.disabled =
                true;
        }
    }


    /* ========================================================================
       SUMMARY
       ======================================================================== */

    function renderSummary(
        resolved
    ) {

        const summary =
            document.getElementById(
                "order-summary"
            );

        if (!summary) {
            return;
        }


        let total =
            0;

        let count =
            0;

        let html =
            `<div>`;


        resolved.forEach(
            ({
                item,
                product
            }) => {

                const qty =
                    quantity(
                        item.quantity
                    );

                const price =
                    Number(
                        product.price ??
                        item.price
                    ) || 0;

                const subtotal =
                    price *
                    qty;

                total +=
                    subtotal;

                count +=
                    qty;

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

                const variant =
                    escapeHTML(
                        item.variantOptions ||
                        ""
                    );

                html += `

                    <div class="summary-item">

                        <img
                            src="${image}"
                            alt="${name}"
                            class="summary-item-image"
                            loading="lazy"
                            decoding="async"
                        >

                        <div class="summary-item-info">

                            <p class="summary-item-name">
                                ${name}
                            </p>

                            <p class="summary-item-meta">

                                Qty: ${qty}

                                ${
                                    variant
                                        ? ` · ${variant}`
                                        : ""
                                }

                            </p>

                        </div>

                        <div class="summary-item-price">
                            ${money(subtotal)}
                        </div>

                    </div>
                `;
            }
        );


        html += `

                </div>

                <div class="summary-total">

                    <span>
                        Total
                    </span>

                    <strong>
                        ${money(total)}
                    </strong>

                </div>
        `;


        summary.innerHTML =
            html;

        summary.setAttribute(
            "aria-busy",
            "false"
        );

        summary.dataset.total =
            total.toFixed(2);

        summary.dataset.count =
            String(count);
    }


    /* ========================================================================
       ERROR
       ======================================================================== */

    function showError(
        message
    ) {

        const element =
            document.getElementById(
                "checkout-error"
            );

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.classList.add(
            "visible"
        );

        element.scrollIntoView({
            behavior:
                "smooth",
            block:
                "nearest"
        });
    }


    function hideError() {

        const element =
            document.getElementById(
                "checkout-error"
            );

        if (!element) {
            return;
        }

        element.textContent =
            "";

        element.classList.remove(
            "visible"
        );
    }


    /* ========================================================================
       STATUS
       ======================================================================== */

    function setStatus(
        message
    ) {

        const status =
            document.getElementById(
                "checkout-status"
            );

        if (status) {
            status.textContent =
                message;
        }
    }


    /* ========================================================================
       FORM DATA
       ======================================================================== */

    function getFormData() {

        const form =
            document.getElementById(
                "checkout-form"
            );

        if (!form) {

            throw new Error(
                "Checkout form is unavailable."
            );
        }

        const formData =
            new FormData(
                form
            );

        const name =
            String(
                formData.get(
                    "name"
                ) ||
                ""
            ).trim();

        const email =
            String(
                formData.get(
                    "email"
                ) ||
                ""
            ).trim();

        const phone =
            String(
                formData.get(
                    "phone"
                ) ||
                ""
            ).trim();

        const country =
            String(
                formData.get(
                    "country"
                ) ||
                ""
            ).trim();

        const countryCode =
            String(
                formData.get(
                    "countryCode"
                ) ||
                ""
            ).trim()
            .toUpperCase();

        const province =
            String(
                formData.get(
                    "province"
                ) ||
                ""
            ).trim();

        const city =
            String(
                formData.get(
                    "city"
                ) ||
                ""
            ).trim();

        const zip =
            String(
                formData.get(
                    "zip"
                ) ||
                ""
            ).trim();

        const county =
            String(
                formData.get(
                    "county"
                ) ||
                ""
            ).trim();

        const address =
            String(
                formData.get(
                    "address"
                ) ||
                ""
            ).trim();

        const address2 =
            String(
                formData.get(
                    "address2"
                ) ||
                ""
            ).trim();

        const remark =
            String(
                formData.get(
                    "remark"
                ) ||
                ""
            ).trim();


        if (!name) {

            throw new Error(
                "Please enter your full name."
            );
        }

        if (
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {

            throw new Error(
                "Please enter a valid email address."
            );
        }

        if (!phone) {

            throw new Error(
                "Please enter your phone number."
            );
        }

        if (!country) {

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
                "Please enter a valid two-letter country code, such as US, GB, CA or AU."
            );
        }

        if (!province) {

            throw new Error(
                "Please enter your state or province."
            );
        }

        if (!city) {

            throw new Error(
                "Please enter your city."
            );
        }

        if (!address) {

            throw new Error(
                "Please enter your shipping address."
            );
        }


        return {

            customer: {

                name,

                email,

                phone
            },

            shipping: {

                country,

                countryCode,

                province,

                city,

                zip,

                county,

                address,

                address2
            },

            remark
        };
    }


    /* ========================================================================
       PREPARE ORDER CART
       ======================================================================== */

    function prepareCart() {

        if (!cart.length) {

            throw new Error(
                "Your cart is empty."
            );
        }


        return cart.map(
            item => {

                const product =
                    products.get(
                        String(
                            item.cjProductId ||
                            item.id
                        )
                    );


                const price =
                    Number(
                        product?.price ??
                        item.price
                    ) || 0;


                return {

                    id:
                        String(
                            item.id
                        ),

                    cjProductId:
                        String(
                            item.cjProductId ||
                            item.id ||
                            ""
                        ),

                    sku:
                        String(
                            item.sku ||
                            product?.sku ||
                            ""
                        ),

                    cjSku:
                        String(
                            item.cjSku ||
                            item.variantSku ||
                            product?.cjSku ||
                            product?.sku ||
                            ""
                        ),

                    vid:
                        String(
                            item.vid ||
                            item.variantId ||
                            ""
                        ),

                    variantSku:
                        String(
                            item.variantSku ||
                            item.cjSku ||
                            ""
                        ),

                    variantOptions:
                        String(
                            item.variantOptions ||
                            ""
                        ),

                    name:
                        String(
                            product?.name ||
                            item.name ||
                            "Product"
                        ),

                    image:
                        String(
                            product?.image ||
                            item.image ||
                            ""
                        ),

                    price,

                    quantity:
                        quantity(
                            item.quantity
                        )
                };
            }
        );
    }


    /* ========================================================================
       SUBMIT ORDER
       ======================================================================== */

    async function submitOrder(
        event
    ) {

        event.preventDefault();

        if (submitting) {
            return;
        }

        hideError();

        cart =
            readCart();

        if (!cart.length) {

            showError(
                "Your cart is empty."
            );

            return;
        }


        const button =
            document.getElementById(
                "place-order-button"
            );

        if (!button) {
            return;
        }


        submitting =
            true;

        button.disabled =
            true;

        button.textContent =
            "Placing Order...";

        setStatus(
            "Connecting to the secure order service..."
        );


        try {

            const customerAndShipping =
                getFormData();

            const orderCart =
                prepareCart();


            const summary =
                document.getElementById(
                    "order-summary"
                );

            const total =
                Number(
                    summary?.dataset?.total
                ) || 0;


            const payload = {

                customer:
                    customerAndShipping.customer,

                shipping:
                    customerAndShipping.shipping,

                remark:
                    customerAndShipping.remark,

                cart:
                    orderCart,

                total:
                    Number(
                        total.toFixed(2)
                    )
            };


            setStatus(
                "Submitting your order..."
            );


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
                                payload
                            )
                    }
                );


            const text =
                await response.text();

            let data = null;

            try {

                data =
                    text
                        ? JSON.parse(
                            text
                        )
                        : null;

            } catch {

                data = null;
            }


            if (!response.ok) {

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
                    "The order could not be created."
                );
            }


            /*
             * IMPORTANT:
             *
             * Clear cart only after Worker/CJ
             * confirms successful order creation.
             */

            localStorage.removeItem(
                CART_KEY
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


            /*
             * CJ page payment.
             */

            if (
                data.cjPayUrl
            ) {

                setStatus(
                    "Order created. Redirecting to secure payment..."
                );

                window.location.href =
                    data.cjPayUrl;

                return;
            }


            /*
             * No payment URL.
             */

            const params =
                new URLSearchParams();

            if (
                data.orderNumber
            ) {

                params.set(
                    "order",
                    data.orderNumber
                );
            }

            if (
                data.orderId
            ) {

                params.set(
                    "id",
                    data.orderId
                );
            }


            window.location.href =
                `/order-success.html?${params.toString()}`;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout error:",
                error
            );

            showError(
                error?.message ||
                "Something went wrong while placing your order. Please try again."
            );

            setStatus(
                "Order was not submitted."
            );

            button.disabled =
                false;

            button.textContent =
                "Place Order";

            submitting =
                false;
        }
    }


    /* ========================================================================
       STORAGE SYNC
       ======================================================================== */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key ===
                CART_KEY
            ) {

                cart =
                    readCart();

                if (!cart.length) {

                    renderEmpty();

                } else {

                    loadCheckoutProducts();
                }
            }
        }
    );


    window.addEventListener(
        "prasunCartUpdated",
        () => {

            cart =
                readCart();

            if (!cart.length) {

                renderEmpty();

            } else {

                loadCheckoutProducts();
            }
        }
    );


    /* ========================================================================
       INITIALIZE
       ======================================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            const form =
                document.getElementById(
                    "checkout-form"
                );

            if (form) {

                form.addEventListener(
                    "submit",
                    submitOrder
                );
            }

            const hasCart =
                await loadCheckoutProducts();

            if (!hasCart) {
                setStatus(
                    "No products are currently in your cart."
                );
            }
        }
    );

})();
