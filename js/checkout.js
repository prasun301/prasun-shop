/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT SYSTEM
 * ============================================================================
 *
 * Canonical cart:
 *     prasun_cart
 *
 * Checkout API:
 *     POST https://prasun-shop-api.prasun301.workers.dev/api/order
 *
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

    const API_ORDER_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/order";

    const API_PRODUCT_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    const MAX_QUANTITY = 99;
    const REQUEST_TIMEOUT_MS = 15000;

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

    const orderSummary =
        document.getElementById(
            "order-summary"
        );

    const checkoutForm =
        document.getElementById(
            "checkout-form"
        );

    let cart = [];

    let submitting = false;

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
        const number =
            Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(
                number
            )
            : "$0.00";
    }

    function cleanString(value) {
        return String(value ?? "").trim();
    }

    function firstNonEmpty(...values) {
        for (const value of values) {
            const result =
                cleanString(value);

            if (result) {
                return result;
            }
        }

        return "";
    }

    function normalizeQuantity(value) {
        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number <= 0
        ) {
            return 1;
        }

        return Math.min(
            MAX_QUANTITY,
            Math.max(
                1,
                Math.floor(number)
            )
        );
    }

    /* =========================================================================
       STORAGE
       ========================================================================= */

    function getCart() {
        try {
            const primary =
                localStorage.getItem(
                    CART_KEY
                );

            if (primary) {
                const parsed =
                    JSON.parse(primary);

                if (
                    Array.isArray(parsed)
                ) {
                    return parsed;
                }
            }

            for (
                const key
                of LEGACY_KEYS
            ) {
                const legacy =
                    localStorage.getItem(
                        key
                    );

                if (!legacy) {
                    continue;
                }

                try {
                    const parsed =
                        JSON.parse(
                            legacy
                        );

                    if (
                        Array.isArray(
                            parsed
                        ) &&
                        parsed.length
                    ) {
                        localStorage.setItem(
                            CART_KEY,
                            JSON.stringify(
                                parsed
                            )
                        );

                        return parsed;
                    }
                } catch (_) {
                    // Ignore malformed legacy carts.
                }
            }

            return [];
        } catch (error) {
            console.error(
                "[PRASUN SHOP] Checkout cart error:",
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

            for (
                const key
                of LEGACY_KEYS
            ) {
                localStorage.removeItem(
                    key
                );
            }
        } catch (error) {
            console.error(
                "[PRASUN SHOP] Cart clear error:",
                error
            );
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
    }

    /* =========================================================================
       CART NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(item) {
        if (
            !item ||
            typeof item !== "object"
        ) {
            return null;
        }

        const name =
            firstNonEmpty(
                item.name,
                item.productName,
                item.title
            );

        const id =
            firstNonEmpty(
                item.cjProductId,
                item.cjPid,
                item.pid,
                item.id
            );

        const sku =
            firstNonEmpty(
                item.cjSku,
                item.cjSKU,
                item.productSku,
                item.sku
            );

        const variantId =
            firstNonEmpty(
                item.variantId,
                item.variantID,
                item.vid,
                item.cjVariantId
            );

        const variantSku =
            firstNonEmpty(
                item.variantSku,
                item.cjVariantSku,
                item.variantSKU
            );

        if (!name && !id && !sku) {
            return null;
        }

        const price =
            Number(item.price);

        return {
            id,
            sku,

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

            variantId,

            variantSku,

            name:
                name ||
                "Product",

            category:
                firstNonEmpty(
                    item.category,
                    item.categoryName
                ),

            price:
                Number.isFinite(price) &&
                price >= 0
                    ? Number(
                        price.toFixed(2)
                    )
                    : 0,

            image:
                firstNonEmpty(
                    item.image,
                    item.imageUrl,
                    item.thumbnail
                ),

            quantity:
                normalizeQuantity(
                    item.quantity
                )
        };
    }

    function normalizeCart(items) {
        if (
            !Array.isArray(items)
        ) {
            return [];
        }

        return items
            .map(normalizeCartItem)
            .filter(Boolean);
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
                () =>
                    controller.abort(),
                timeout
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
                    "The server request timed out. Please try again."
                );
            }

            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    /* =========================================================================
       ERROR UI
       ========================================================================= */

    function showFormError(message) {
        let banner =
            document.getElementById(
                "checkout-error-banner"
            );

        if (
            !banner &&
            checkoutForm
        ) {
            banner =
                document.createElement(
                    "div"
                );

            banner.id =
                "checkout-error-banner";

            banner.className =
                "mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-200";

            banner.setAttribute(
                "role",
                "alert"
            );

            checkoutForm.prepend(
                banner
            );
        }

        if (banner) {
            banner.textContent =
                message;

            banner.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        } else {
            alert(message);
        }
    }

    function hideFormError() {
        const banner =
            document.getElementById(
                "checkout-error-banner"
            );

        if (banner) {
            banner.remove();
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

                <div
                    class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
                    aria-hidden="true"
                >
                    <svg
                        width="28"
                        height="28"
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

                <p class="text-zinc-700 text-sm font-semibold mb-4">
                    Your cart is empty.
                </p>

                <a
                    href="/products.html"
                    class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all"
                >
                    Continue Shopping
                </a>

            </div>
        `;
    }

    /* =========================================================================
       SUMMARY
       ========================================================================= */

    function renderSummary() {
        if (!orderSummary) {
            return;
        }

        if (!cart.length) {
            renderEmptySummary();
            return;
        }

        let total = 0;

        const itemsHTML =
            cart.map(item => {
                const quantity =
                    normalizeQuantity(
                        item.quantity
                    );

                const price =
                    Number(item.price) || 0;

                const subtotal =
                    price * quantity;

                total += subtotal;

                const name =
                    escapeHTML(
                        item.name ||
                        "Product"
                    );

                const image =
                    escapeHTML(
                        item.image ||
                        ""
                    );

                return `
                    <div
                        class="flex items-center gap-4 py-4 border-b border-zinc-100"
                    >

                        ${
                            image
                                ? `
                                    <img
                                        src="${image}"
                                        alt="${name}"
                                        class="w-16 h-16 object-contain rounded-xl border border-zinc-200 bg-zinc-50 shrink-0"
                                        loading="lazy"
                                        decoding="async"
                                    >
                                  `
                                : `
                                    <div
                                        class="w-16 h-16 rounded-xl border border-zinc-200 bg-zinc-50 shrink-0"
                                        aria-hidden="true"
                                    ></div>
                                  `
                        }

                        <div
                            class="flex-grow min-w-0"
                        >
                            <h3
                                class="text-sm font-semibold text-zinc-900"
                            >
                                ${name}
                            </h3>

                            <p
                                class="text-xs text-zinc-500 mt-1"
                            >
                                Qty: ${quantity}
                            </p>
                        </div>

                        <div
                            class="text-right shrink-0"
                        >
                            <p
                                class="text-sm font-bold text-zinc-900"
                            >
                                ${formatPrice(
                                    subtotal
                                )}
                            </p>

                            <p
                                class="text-[11px] text-zinc-400"
                            >
                                ${formatPrice(
                                    price
                                )} each
                            </p>
                        </div>

                    </div>
                `;
            }).join("");

        orderSummary.innerHTML = `
            <div
                class="max-h-80 overflow-y-auto pr-1"
            >
                ${itemsHTML}
            </div>

            <div
                class="pt-4 space-y-2"
            >

                <div
                    class="flex justify-between text-xs text-zinc-500"
                >
                    <span>
                        Subtotal
                    </span>

                    <span
                        class="font-medium text-zinc-900"
                    >
                        ${formatPrice(
                            total
                        )}
                    </span>
                </div>

                <div
                    class="flex justify-between text-xs text-zinc-500"
                >
                    <span>
                        Shipping
                    </span>

                    <span
                        class="text-emerald-600 font-semibold"
                    >
                        Free
                    </span>
                </div>

                <div
                    class="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100"
                >
                    <span>
                        Total
                    </span>

                    <span>
                        ${formatPrice(
                            total
                        )}
                    </span>
                </div>

            </div>
        `;
    }

    /* =========================================================================
       PRODUCT RESOLUTION
       ========================================================================= */

    async function resolveCartItem(item) {
        /*
         * Prefer stable CJ identifiers already stored in the cart.
         */
        const attempts = [];

        if (item.cjProductId) {
            attempts.push(
                `id=${encodeURIComponent(
                    item.cjProductId
                )}`
            );
        }

        if (item.cjSku) {
            attempts.push(
                `sku=${encodeURIComponent(
                    item.cjSku
                )}`
            );
        }

        if (item.variantSku) {
            attempts.push(
                `variantSku=${encodeURIComponent(
                    item.variantSku
                )}`
            );
        }

        /*
         * Last resort: use the internal ID.
         */
        if (
            item.id &&
            !attempts.some(
                value =>
                    value.includes(
                        encodeURIComponent(
                            item.id
                        )
                    )
            )
        ) {
            attempts.push(
                `id=${encodeURIComponent(
                    item.id
                )}`
            );
        }

        for (
            const query
            of attempts
        ) {
            try {
                const response =
                    await fetchWithTimeout(
                        `${API_PRODUCT_ENDPOINT}?${query}`,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            cache: "no-store"
                        }
                    );

                if (
                    response.ok
                ) {
                    const data =
                        await response.json();

                    if (
                        data?.product
                    ) {
                        return data.product;
                    }
                }
            } catch (error) {
                console.warn(
                    "[PRASUN SHOP] Product lookup failed:",
                    error?.message || error
                );
            }
        }

        /*
         * If the Worker cannot resolve by ID/SKU, do one final
         * name lookup.
         */
        if (item.name) {
            try {
                const response =
                    await fetchWithTimeout(
                        `${API_PRODUCT_ENDPOINT}?q=${encodeURIComponent(
                            item.name
                        )}`,
                        {
                            method: "GET",
                            headers: {
                                Accept:
                                    "application/json"
                            },
                            cache: "no-store"
                        }
                    );

                if (
                    response.ok
                ) {
                    const data =
                        await response.json();

                    const products =
                        Array.isArray(
                            data?.products
                        )
                            ? data.products
                            : [];

                    const wanted =
                        item.name
                            .trim()
                            .toLowerCase();

                    const exact =
                        products.find(
                            product =>
                                String(
                                    product.name ||
                                    ""
                                )
                                    .trim()
                                    .toLowerCase() ===
                                wanted
                        );

                    if (exact) {
                        return exact;
                    }

                    if (
                        products.length
                    ) {
                        return products[0];
                    }
                }
            } catch (error) {
                console.warn(
                    "[PRASUN SHOP] Name lookup failed:",
                    error?.message || error
                );
            }
        }

        return null;
    }

    async function buildOrderItems() {
        const result = [];

        for (
            const item
            of cart
        ) {
            const product =
                await resolveCartItem(
                    item
                );

            /*
             * We allow an already-populated cart item
             * to proceed even if the product endpoint is
             * temporarily unavailable.
             */
            const resolved =
                product || item;

            const productId =
                firstNonEmpty(
                    resolved.cjProductId,
                    resolved.pid,
                    resolved.id,
                    item.cjProductId,
                    item.id
                );

            const sku =
                firstNonEmpty(
                    resolved.cjSku,
                    resolved.productSku,
                    resolved.sku,
                    item.cjSku,
                    item.sku
                );

            const variantId =
                firstNonEmpty(
                    item.variantId,
                    resolved.variantId,
                    resolved.vid
                );

            const variantSku =
                firstNonEmpty(
                    item.variantSku,
                    resolved.variantSku
                );

            const name =
                firstNonEmpty(
                    item.name,
                    resolved.name
                );

            if (
                !productId &&
                !sku &&
                !name
            ) {
                throw new Error(
                    "One of the products in your cart has no valid product identifier."
                );
            }

            const price =
                Number(
                    resolved.price ??
                    item.price ??
                    0
                );

            const quantity =
                normalizeQuantity(
                    item.quantity
                );

            result.push({
                id:
                    firstNonEmpty(
                        resolved.id,
                        productId
                    ),

                sku,

                cjProductId:
                    productId,

                cjSku:
                    sku,

                variantId,

                variantSku,

                name:
                    name ||
                    "Product",

                price:
                    Number.isFinite(
                        price
                    )
                        ? Number(
                            price.toFixed(2)
                        )
                        : 0,

                quantity
            });
        }

        return result;
    }

    /* =========================================================================
       VALIDATION
       ========================================================================= */

    function validateCustomer(formData) {
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

        const address =
            String(
                formData.get(
                    "address"
                ) || ""
            ).trim();

        if (!customerName) {
            throw new Error(
                "Please enter your full name."
            );
        }

        if (
            customerName.length <
            2
        ) {
            throw new Error(
                "Please enter a valid full name."
            );
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            !email ||
            !emailRegex.test(
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

        if (!address) {
            throw new Error(
                "Please enter your shipping address."
            );
        }

        return {
            customerName,
            email,
            phone,
            address
        };
    }

    /* =========================================================================
       SUBMIT
       ========================================================================= */

    async function submitOrder(event) {
        event.preventDefault();

        if (submitting) {
            return;
        }

        hideFormError();

        cart =
            normalizeCart(
                getCart()
            );

        if (!cart.length) {
            showFormError(
                "Your cart is empty. Please return to the shop and add a product."
            );

            return;
        }

        const submitButton =
            checkoutForm?.querySelector(
                'button[type="submit"]'
            );

        if (!submitButton) {
            showFormError(
                "Checkout button could not be found."
            );

            return;
        }

        submitting = true;

        const originalText =
            submitButton.textContent;

        submitButton.disabled =
            true;

        submitButton.dataset.processing =
            "true";

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

            const customer =
                validateCustomer(
                    formData
                );

            const orderItems =
                await buildOrderItems();

            if (
                !orderItems.length
            ) {
                throw new Error(
                    "No valid products were found in your cart."
                );
            }

            const total =
                orderItems.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        (
                            Number(
                                item.price
                            ) || 0
                        ) *
                        item.quantity,
                    0
                );

            const payload = {
                customerName:
                    customer.customerName,

                email:
                    customer.email,

                phone:
                    customer.phone,

                address:
                    customer.address,

                cart:
                    orderItems,

                total:
                    Number(
                        total.toFixed(2)
                    )
            };

            console.log(
                "[PRASUN SHOP] Submitting order:",
                {
                    ...payload,
                    /*
                     * Do not log unnecessary customer details.
                     */
                    cart:
                        orderItems
                }
            );

            const response =
                await fetchWithTimeout(
                    API_ORDER_ENDPOINT,
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
            } catch (_) {
                data = null;
            }

            if (
                !response.ok
            ) {
                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Order server returned HTTP ${response.status}`
                );
            }

            if (
                data &&
                data.success === false
            ) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "The order could not be placed."
                );
            }

            console.log(
                "[PRASUN SHOP] Order successfully submitted."
            );

            clearCart();

            window.location.href =
                data?.redirectUrl ||
                "/order-success.html";
        } catch (error) {
            console.error(
                "[PRASUN SHOP] Order submission error:",
                error
            );

            showFormError(
                error?.message ||
                "Something went wrong while placing your order. Please try again."
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

            submitting = false;

            return;
        }
    }

    /* =========================================================================
       EVENTS
       ========================================================================= */

    if (checkoutForm) {
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
                cart =
                    normalizeCart(
                        getCart()
                    );

                renderSummary();
            }
        }
    );

    window.addEventListener(
        "prasunCartUpdated",
        () => {
            cart =
                normalizeCart(
                    getCart()
                );

            renderSummary();
        }
    );

    /* =========================================================================
       INITIALIZE
       ========================================================================= */

    if (orderSummary) {
        orderSummary.setAttribute(
            "aria-live",
            "polite"
        );
    }

    cart =
        normalizeCart(
            getCart()
        );

    renderSummary();

})();
