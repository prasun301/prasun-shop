/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT
 * ============================================================================
 *
 * CUSTOMER FLOW:
 *
 * Cart
 *   ↓
 * Checkout
 *   ↓
 * Enter shipping information
 *   ↓
 * Place Order
 *   ↓
 * PRASUN SHOP Worker
 *   ↓
 * CJ createOrderV2
 *   ↓
 * CJ creates REAL order
 *   ↓
 * CJ returns cjPayUrl
 *   ↓
 * Customer redirected to CJ
 *   ↓
 * Customer pays using CJ payment page
 *   ↓
 * CJ processes the order
 *
 * IMPORTANT:
 *
 * The browser NEVER receives the CJ API key.
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

    const API_ORDER_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/order";

    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    const MAX_QUANTITY =
        99;

    const REQUEST_TIMEOUT_MS =
        15000;


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

        const number =
            Number(value);

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
            char =>
                ESCAPE_MAP[char]
        );
    }


    /* ========================================================================
       CART NORMALIZATION
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
            Number(
                item.quantity
            );


        return {

            id:
                String(item.id),

            quantity:
                Number.isFinite(
                    quantity
                ) &&
                quantity > 0
                    ? Math.min(
                        MAX_QUANTITY,
                        Math.floor(
                            quantity
                        )
                    )
                    : 1,

            /*
             * Preserve optional CJ information if
             * cart.js already stores it.
             */

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


    function parseCart(raw) {

        if (!raw) {
            return [];
        }


        try {

            const parsed =
                JSON.parse(raw);


            if (
                !Array.isArray(parsed)
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
                const key of LEGACY_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        key
                    );


                if (legacy) {

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

            LEGACY_KEYS.forEach(
                key =>
                    localStorage.removeItem(
                        key
                    )
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
       DOM
       ======================================================================== */

    const orderSummary =
        document.getElementById(
            "order-summary"
        );

    const checkoutForm =
        document.getElementById(
            "checkout-form"
        );


    if (orderSummary) {

        orderSummary.setAttribute(
            "aria-live",
            "polite"
        );
    }


    /* ========================================================================
       PRODUCT CACHE
       ======================================================================== */

    let productMap =
        new Map();

    let productsFetchPromise =
        null;


    /* ========================================================================
       FETCH TIMEOUT
       ======================================================================== */

    async function fetchWithTimeout(
        resource,
        options = {}
    ) {

        const timeout =
            options.timeout ||
            REQUEST_TIMEOUT_MS;

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () =>
                    controller.abort(),
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

        } catch (
            error
        ) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timed out. Please check your connection and try again."
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
                                method: "GET",

                                cache:
                                    "no-store",

                                headers: {
                                    "Accept":
                                        "application/json"
                                }
                            }
                        );


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `Products HTTP ${response.status}`
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
       ERROR UI
       ======================================================================== */

    function showFormError(
        message
    ) {

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
                "mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-200";

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

            banner.classList.remove(
                "hidden"
            );

            banner.scrollIntoView({
                behavior:
                    "smooth",
                block:
                    "nearest"
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

            banner.classList.add(
                "hidden"
            );

            banner.textContent =
                "";
        }
    }


    /* ========================================================================
       EMPTY SUMMARY
       ======================================================================== */

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


    /* ========================================================================
       CHECKOUT SUMMARY
       ======================================================================== */

    async function loadCheckoutSummary() {

        if (!orderSummary) {
            return;
        }


        try {

            cart =
                getCart();


            if (!cart.length) {

                renderEmptySummary();

                return;
            }


            await fetchProducts();


            let total =
                0;


            const validItems =
                [];


            let itemsHTML = `

                <div class="max-h-72 overflow-y-auto space-y-4 pr-1">

            `;


            for (
                const item of cart
            ) {

                const product =
                    productMap.get(
                        String(
                            item.id
                        )
                    );


                if (!product) {
                    continue;
                }


                const price =
                    Number(
                        product.price
                    ) || 0;


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

                    ...item,

                    id:
                        String(
                            product.id
                        ),

                    name:
                        String(
                            product.name ||
                            "Product"
                        ),

                    price,

                    image:
                        String(
                            product.image ||
                            ""
                        )
                });


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
                                ${formatPrice(
                                    subtotal
                                )}
                            </p>

                            <p class="text-[11px] text-zinc-400">
                                ${formatPrice(
                                    price
                                )} each
                            </p>

                        </div>

                    </div>

                `;
            }


            itemsHTML +=
                "</div>";


            if (
                !validItems.length
            ) {

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
                            ${formatPrice(
                                total
                            )}
                        </span>

                    </div>


                    <div class="flex justify-between text-xs text-zinc-500">

                        <span>
                            Shipping
                        </span>

                        <span class="text-emerald-600 font-semibold">
                            Calculated by CJ
                        </span>

                    </div>


                    <div class="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100">

                        <span>
                            Store Total
                        </span>

                        <span>
                            ${formatPrice(
                                total
                            )}
                        </span>

                    </div>

                </div>

            `;


            orderSummary.innerHTML =
                itemsHTML;


        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Checkout summary error:",
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
                        class="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        Retry
                    </button>

                </div>

            `;


            const retry =
                document.getElementById(
                    "retry-summary-btn"
                );


            if (retry) {

                retry.addEventListener(
                    "click",
                    () =>
                        loadCheckoutSummary()
                );
            }
        }
    }


    /* ========================================================================
       SUBMIT CHECKOUT
       ======================================================================== */

    if (checkoutForm) {

        checkoutForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                hideFormError();


                cart =
                    getCart();


                if (!cart.length) {

                    showFormError(
                        "Your cart is empty. Please return to the shop."
                    );

                    return;
                }


                const submitButton =
                    checkoutForm.querySelector(
                        'button[type="submit"]'
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
                    "Connecting to CJ...";

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


                    const address2 =
                        String(
                            formData.get(
                                "address2"
                            ) || ""
                        ).trim();


                    /*
                     * These names should match your checkout HTML.
                     *
                     * The fallback names allow slightly different
                     * checkout form implementations.
                     */

                    const city =
                        String(
                            formData.get(
                                "city"
                            ) ||
                            formData.get(
                                "shippingCity"
                            ) ||
                            ""
                        ).trim();


                    const province =
                        String(
                            formData.get(
                                "province"
                            ) ||
                            formData.get(
                                "state"
                            ) ||
                            formData.get(
                                "shippingProvince"
                            ) ||
                            ""
                        ).trim();


                    const country =
                        String(
                            formData.get(
                                "country"
                            ) ||
                            formData.get(
                                "shippingCountry"
                            ) ||
                            ""
                        ).trim();


                    const countryCode =
                        String(
                            formData.get(
                                "countryCode"
                            ) ||
                            formData.get(
                                "shippingCountryCode"
                            ) ||
                            ""
                        ).trim()
                        .toUpperCase();


                    const zip =
                        String(
                            formData.get(
                                "zip"
                            ) ||
                            formData.get(
                                "postalCode"
                            ) ||
                            formData.get(
                                "shippingZip"
                            ) ||
                            ""
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
                        !address
                    ) {

                        throw new Error(
                            "Please enter your shipping address."
                        );
                    }


                    if (
                        !countryCode
                    ) {

                        throw new Error(
                            "Please select your country."
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


                    /*
                     * Make sure product information is current.
                     */

                    await fetchProducts();


                    const enrichedCart =
                        cart.map(
                            item => {

                                const product =
                                    productMap.get(
                                        String(
                                            item.id
                                        )
                                    );


                                if (
                                    !product
                                ) {

                                    throw new Error(
                                        `Could not resolve product "${item.name || item.id}".`
                                    );
                                }


                                return {

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
                            }
                        );


                    if (
                        !enrichedCart.length
                    ) {

                        throw new Error(
                            "No valid products were found in your cart."
                        );
                    }


                    /*
                     * IMPORTANT:
                     *
                     * The Worker, not the browser,
                     * creates the CJ order.
                     *
                     * We intentionally do NOT send the
                     * customer-facing store total as CJ's
                     * order amount.
                     *
                     * CJ calculates its own payable amount.
                     */

                    submitButton.textContent =
                        "Creating CJ Order...";


                    const response =
                        await fetchWithTimeout(
                            API_ORDER_ENDPOINT,
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
                                    JSON.stringify({

                                        customerName,

                                        email,

                                        phone,

                                        address,

                                        address2,

                                        shippingCity:
                                            city,

                                        shippingProvince:
                                            province,

                                        shippingCountry:
                                            country,

                                        shippingCountryCode:
                                            countryCode,

                                        shippingZip:
                                            zip,

                                        cart:
                                            enrichedCart
                                    })
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


                    const cjPayUrl =
                        data.cjPayUrl;


                    if (
                        !cjPayUrl
                    ) {

                        throw new Error(
                            "CJ created the order but did not provide a payment page."
                        );
                    }


                    /*
                     * Save order information temporarily.
                     *
                     * Useful for order-success.html.
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

                                createdAt:
                                    Date.now()
                            })
                        );

                    } catch (_) {}


                    /*
                     * VERY IMPORTANT:
                     *
                     * The order exists in CJ now.
                     *
                     * Customer has NOT necessarily paid yet.
                     *
                     * Redirect to CJ payment.
                     */

                    submitButton.textContent =
                        "Redirecting to CJ Payment...";


                    /*
                     * Clear local cart only after CJ has
                     * successfully created the order.
                     *
                     * Do NOT clear it before this point.
                     */

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


                    /*
                     * Redirect customer directly to CJ.
                     */

                    window.location.assign(
                        cjPayUrl
                    );


                } catch (
                    error
                ) {

                    console.error(
                        "[PRASUN SHOP] CJ checkout error:",
                        error
                    );


                    showFormError(
                        error?.message ||
                        "Unable to create the CJ order. Please try again."
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


    /* ========================================================================
       CROSS-TAB CART SYNC
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

            loadCheckoutSummary();
        }
    );


    /* ========================================================================
       INITIALIZE
       ======================================================================== */

    let cart =
        getCart();


    loadCheckoutSummary();

})();
