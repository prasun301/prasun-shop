/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT SYSTEM
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       CONFIG
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    const API_ORDER_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/order";

    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/products";

    const MAX_QUANTITY = 99;

    const REQUEST_TIMEOUT_MS = 15000;

    /* =========================================================================
       ELEMENTS
       ========================================================================= */

    const checkoutForm =
        document.getElementById("checkout-form");

    const orderSummary =
        document.getElementById("order-summary");

    /* =========================================================================
       CURRENCY
       ========================================================================= */

    const currencyFormatter =
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    function formatPrice(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "$0.00";
    }

    /* =========================================================================
       HTML ESCAPE
       ========================================================================= */

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

        return String(value)
            .replace(
                /[&<>"']/g,
                char => ESCAPE_MAP[char]
            );
    }

    /* =========================================================================
       CART NORMALIZATION
       ========================================================================= */

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
            id: String(item.id),

            quantity:
                Number.isFinite(quantity) &&
                quantity > 0
                    ? Math.min(
                        MAX_QUANTITY,
                        Math.floor(quantity)
                    )
                    : 1
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
                localStorage.getItem(CART_KEY);

            if (primary) {
                return parseCart(primary);
            }

            for (const legacyKey of LEGACY_KEYS) {

                const legacy =
                    localStorage.getItem(
                        legacyKey
                    );

                if (legacy) {

                    const cart =
                        parseCart(legacy);

                    if (cart.length) {

                        localStorage.setItem(
                            CART_KEY,
                            JSON.stringify(cart)
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

    function clearAllCartKeys() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            LEGACY_KEYS.forEach(key => {
                localStorage.removeItem(key);
            });

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart clear error:",
                error
            );
        }
    }

    /* =========================================================================
       FETCH WITH TIMEOUT
       ========================================================================= */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const {
            timeout = REQUEST_TIMEOUT_MS
        } = options;

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
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
                error &&
                error.name ===
                    "AbortError"
            ) {

                throw new Error(
                    "The server request timed out. Please try again."
                );
            }

            throw error;

        } finally {

            clearTimeout(timer);
        }
    }

    /* =========================================================================
       PRODUCT LOADING
       ========================================================================= */

    let productMap = new Map();

    let productsFetchPromise = null;

    async function fetchProducts() {

        if (productMap.size > 0) {
            return productMap;
        }

        if (productsFetchPromise) {
            return productsFetchPromise;
        }

        productsFetchPromise =
            (async () => {

                try {

                    const response =
                        await fetchWithTimeout(
                            PRODUCTS_ENDPOINT,
                            {
                                method: "GET",
                                cache: "no-store",
                                headers: {
                                    "Accept":
                                        "application/json"
                                }
                            }
                        );

                    if (!response.ok) {

                        throw new Error(
                            `Product server returned HTTP ${response.status}.`
                        );
                    }

                    const data =
                        await response.json();

                    if (
                        !data ||
                        !Array.isArray(
                            data.products
                        )
                    ) {

                        throw new Error(
                            "Invalid product API response."
                        );
                    }

                    productMap =
                        new Map(
                            data.products
                                .filter(Boolean)
                                .map(
                                    product => [
                                        String(product.id),
                                        product
                                    ]
                                )
                        );

                    return productMap;

                } catch (error) {

                    productsFetchPromise =
                        null;

                    throw error;
                }
            })();

        return productsFetchPromise;
    }

    /* =========================================================================
       ERROR BANNER
       ========================================================================= */

    function showFormError(message) {

        let errorBanner =
            document.getElementById(
                "checkout-error-banner"
            );

        if (
            !errorBanner &&
            checkoutForm
        ) {

            errorBanner =
                document.createElement(
                    "div"
                );

            errorBanner.id =
                "checkout-error-banner";

            errorBanner.className =
                "mb-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-200";

            errorBanner.setAttribute(
                "role",
                "alert"
            );

            checkoutForm.prepend(
                errorBanner
            );
        }

        if (errorBanner) {

            errorBanner.textContent =
                message;

            errorBanner.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });

        } else {

            alert(message);
        }
    }

    function hideFormError() {

        const errorBanner =
            document.getElementById(
                "checkout-error-banner"
            );

        if (errorBanner) {

            errorBanner.textContent =
                "";

            errorBanner.classList.add(
                "hidden"
            );
        }
    }

    /* =========================================================================
       EMPTY SUMMARY
       ========================================================================= */

    function renderEmptySummary() {

        if (!orderSummary) {
            return;
        }

        orderSummary.innerHTML = `
            <div class="py-8 text-center">

                <p class="text-zinc-500 text-sm font-medium mb-4">
                    Your cart is empty.
                </p>

                <a
                    href="products.html"
                    class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all"
                >
                    Continue Shopping
                </a>

            </div>
        `;
    }

    /* =========================================================================
       CHECKOUT SUMMARY
       ========================================================================= */

    async function loadCheckoutSummary() {

        if (!orderSummary) {
            return;
        }

        try {

            cart = getCart();

            if (!cart.length) {

                renderEmptySummary();

                return;
            }

            await fetchProducts();

            let total = 0;

            const validItems = [];

            let itemsHTML = `
                <div class="max-h-72 overflow-y-auto space-y-4 pr-1">
            `;

            cart.forEach(item => {

                const product =
                    productMap.get(
                        String(item.id)
                    );

                if (!product) {
                    return;
                }

                const price =
                    Number(product.price) || 0;

                const quantity =
                    Number(item.quantity) || 1;

                const subtotal =
                    price * quantity;

                total += subtotal;

                validItems.push({
                    id:
                        String(product.id),

                    name:
                        String(
                            product.name ||
                            "Product"
                        ),

                    price,

                    quantity
                });

                const image =
                    escapeHTML(
                        product.image || ""
                    );

                const name =
                    escapeHTML(
                        product.name ||
                        "Product"
                    );

                itemsHTML += `
                    <div class="flex items-center gap-4 py-4 border-b border-zinc-100">

                        <img
                            src="${image}"
                            alt="${name}"
                            class="w-16 h-16 object-contain rounded-xl border border-zinc-200/60 bg-zinc-100 shrink-0"
                            loading="lazy"
                            decoding="async"
                        >

                        <div class="flex-grow min-w-0">

                            <h3 class="text-sm font-semibold text-zinc-900 truncate">
                                ${name}
                            </h3>

                            <p class="text-xs text-zinc-500">
                                Qty: ${quantity}
                            </p>

                        </div>

                        <div class="text-right shrink-0">

                            <p class="text-sm font-bold text-zinc-900">
                                ${formatPrice(subtotal)}
                            </p>

                            <p class="text-[11px] text-zinc-400">
                                ${formatPrice(price)} each
                            </p>

                        </div>

                    </div>
                `;
            });

            itemsHTML += `
                </div>
            `;

            if (!validItems.length) {

                renderEmptySummary();

                return;
            }

            itemsHTML += `
                <div class="pt-4 space-y-2">

                    <div class="flex justify-between text-xs text-zinc-500">

                        <span>
                            Subtotal
                        </span>

                        <span class="font-medium text-zinc-900">
                            ${formatPrice(total)}
                        </span>

                    </div>

                    <div class="flex justify-between text-xs text-zinc-500">

                        <span>
                            Shipping
                        </span>

                        <span class="text-emerald-600 font-semibold">
                            Free
                        </span>

                    </div>

                    <div class="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100">

                        <span>
                            Total
                        </span>

                        <span>
                            ${formatPrice(total)}
                        </span>

                    </div>

                </div>
            `;

            orderSummary.innerHTML =
                itemsHTML;

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Summary error:",
                error
            );

            orderSummary.innerHTML = `
                <div class="py-6 text-center">

                    <p class="text-xs text-red-500 font-medium mb-3">
                        Failed to load order summary.
                    </p>

                    <button
                        type="button"
                        id="retry-summary-btn"
                        class="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800"
                    >
                        Retry
                    </button>

                </div>
            `;

            const retryButton =
                document.getElementById(
                    "retry-summary-btn"
                );

            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    loadCheckoutSummary
                );
            }
        }
    }

    /* =========================================================================
       PARSE SERVER RESPONSE
       ========================================================================= */

    async function parseServerResponse(
        response
    ) {

        const text =
            await response.text();

        let data = null;

        try {

            data =
                text
                    ? JSON.parse(text)
                    : null;

        } catch {

            data = null;
        }

        if (!response.ok) {

            const message =
                data?.error ||
                data?.message ||
                `Order server returned HTTP ${response.status}.`;

            throw new Error(message);
        }

        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.error ||
                "The order could not be created."
            );
        }

        return data;
    }

    /* =========================================================================
       SUBMIT ORDER
       ========================================================================= */

    if (checkoutForm) {

        checkoutForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                hideFormError();

                let submitButton =
                    checkoutForm.querySelector(
                        'button[type="submit"]'
                    );

                if (!submitButton) {
                    return;
                }

                if (
                    submitButton.dataset.processing ===
                    "true"
                ) {
                    return;
                }

                cart = getCart();

                if (!cart.length) {

                    showFormError(
                        "Your cart is empty. Please add a product before checking out."
                    );

                    return;
                }

                submitButton.dataset.processing =
                    "true";

                const originalText =
                    submitButton.textContent;

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Processing Order...";

                submitButton.classList.add(
                    "opacity-75",
                    "cursor-not-allowed"
                );

                try {

                    const formData =
                        new FormData(
                            checkoutForm
                        );

                    const customerName =
                        String(
                            formData.get("name") ||
                            formData.get("customerName") ||
                            ""
                        ).trim();

                    const email =
                        String(
                            formData.get("email") ||
                            ""
                        ).trim();

                    const phone =
                        String(
                            formData.get("phone") ||
                            ""
                        ).trim();

                    const address =
                        String(
                            formData.get("address") ||
                            ""
                        ).trim();

                    const city =
                        String(
                            formData.get("city") ||
                            ""
                        ).trim();

                    const province =
                        String(
                            formData.get("province") ||
                            formData.get("state") ||
                            ""
                        ).trim();

                    const country =
                        String(
                            formData.get("country") ||
                            ""
                        ).trim();

                    const countryCode =
                        String(
                            formData.get(
                                "countryCode"
                            ) ||
                            "US"
                        ).trim()
                            .toUpperCase();

                    const postalCode =
                        String(
                            formData.get(
                                "postalCode"
                            ) ||
                            formData.get(
                                "zip"
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

                    /* ---------------------------------------------------------
                       VALIDATION
                       --------------------------------------------------------- */

                    if (!customerName) {

                        throw new Error(
                            "Please enter your full name."
                        );
                    }

                    if (
                        !email ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                            .test(email)
                    ) {

                        throw new Error(
                            "Please enter a valid email address."
                        );
                    }

                    if (!address) {

                        throw new Error(
                            "Please enter your shipping address."
                        );
                    }

                    if (!city) {

                        throw new Error(
                            "Please enter your city."
                        );
                    }

                    if (!province) {

                        throw new Error(
                            "Please enter your state/province."
                        );
                    }

                    if (
                        !countryCode ||
                        countryCode.length !== 2
                    ) {

                        throw new Error(
                            "Please select a valid country."
                        );
                    }

                    /* ---------------------------------------------------------
                       CONFIRM PRODUCTS
                       --------------------------------------------------------- */

                    await fetchProducts();

                    const enrichedCart =
                        cart
                            .map(item => {

                                const product =
                                    productMap.get(
                                        String(item.id)
                                    );

                                if (!product) {
                                    return null;
                                }

                                return {
                                    id:
                                        String(
                                            product.id
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
                                        )
                                };

                            })
                            .filter(Boolean);

                    if (
                        !enrichedCart.length
                    ) {

                        throw new Error(
                            "No valid products were found in your cart."
                        );
                    }

                    /* ---------------------------------------------------------
                       SEND TO CLOUDFLARE WORKER
                       --------------------------------------------------------- */

                    const response =
                        await fetchWithTimeout(
                            API_ORDER_ENDPOINT,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        customerName,
                                        email,
                                        phone,
                                        address,
                                        city,
                                        province,
                                        country,
                                        countryCode,
                                        postalCode,
                                        remark,
                                        cart:
                                            enrichedCart
                                    })
                            }
                        );

                    const responseData =
                        await parseServerResponse(
                            response
                        );

                    console.log(
                        "[PRASUN SHOP] Order created:",
                        responseData
                    );

                    /* ---------------------------------------------------------
                       ONLY CLEAR CART AFTER SUCCESS
                       --------------------------------------------------------- */

                    clearAllCartKeys();

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

                    /* ---------------------------------------------------------
                       SAVE ORDER RESULT FOR SUCCESS PAGE
                       --------------------------------------------------------- */

                    try {

                        sessionStorage.setItem(
                            "prasun_last_order",
                            JSON.stringify({
                                orderNumber:
                                    responseData.orderNumber ||
                                    "",

                                customerName,

                                email
                            })
                        );

                    } catch (_) {
                        /* Ignore storage failure */
                    }

                    /* ---------------------------------------------------------
                       SUCCESS
                       --------------------------------------------------------- */

                    window.location.href =
                        "order-success.html";

                } catch (error) {

                    console.error(
                        "[PRASUN SHOP] Order submission error:",
                        error
                    );

                    showFormError(
                        error?.message ||
                        "Something went wrong while placing your order."
                    );

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        originalText;

                    submitButton.classList.remove(
                        "opacity-75",
                        "cursor-not-allowed"
                    );

                    submitButton.dataset.processing =
                        "false";
                }
            }
        );
    }

    /* =========================================================================
       CROSS-TAB CART SYNC
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_KEYS.includes(
                    event.key
                )
            ) {

                loadCheckoutSummary();
            }
        }
    );

    /* =========================================================================
       CART EVENT SYNC
       ========================================================================= */

    window.addEventListener(
        "prasunCartUpdated",
        () => {
            loadCheckoutSummary();
        }
    );

    /* =========================================================================
       INITIAL LOAD
       ========================================================================= */

    let cart = getCart();

    loadCheckoutSummary();

})();
