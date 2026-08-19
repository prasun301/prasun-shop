/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT SYSTEM
 * ============================================================================
 *
 * Production checkout frontend.
 *
 * Canonical cart:
 *     prasun_cart
 *
 * Product source:
 *     Cloudflare Worker
 *     GET /api/products
 *
 * Order endpoint:
 *     Cloudflare Worker
 *     POST /api/orders
 *
 * Features:
 * - Uses the same canonical cart as cart.js
 * - Supports legacy cart migration
 * - Loads products from Cloudflare Worker
 * - Supports CJ Dropshipping product IDs / SKUs
 * - Handles Worker response format:
 *      { success: true, products: [...] }
 * - Request timeout
 * - Input validation
 * - Accessible error/status messages
 * - Double-submit protection
 * - Cross-tab cart synchronization
 * - Does NOT trust prices supplied by localStorage
 * ============================================================================
 */

"use strict";

(() => {

    /* ========================================================================
       1. CONFIGURATION
       ======================================================================== */

    const CART_KEY = "prasun_cart";

    const LEGACY_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    /*
     * IMPORTANT:
     * Products are loaded from the Cloudflare Worker.
     */
    const PRODUCTS_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/products";

    /*
     * Order submission endpoint.
     */
    const ORDER_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/api/orders";

    const MAX_QUANTITY = 99;

    const REQUEST_TIMEOUT_MS = 15000;


    /* ========================================================================
       2. CURRENCY
       ======================================================================== */

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


    function formatPrice(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "$0.00";
        }

        return currencyFormatter.format(number);
    }


    /* ========================================================================
       3. HTML ESCAPING
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
            character => ESCAPE_MAP[character]
        );
    }


    /* ========================================================================
       4. DOM
       ======================================================================== */

    const orderSummary =
        document.getElementById("order-summary");

    const checkoutForm =
        document.getElementById("checkout-form");


    if (orderSummary) {

        orderSummary.setAttribute(
            "aria-live",
            "polite"
        );

    }


    /* ========================================================================
       5. CART NORMALIZATION
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
                "[PRASUN SHOP] Cart JSON parse error:",
                error
            );

            return [];

        }
    }


    /* ========================================================================
       6. READ CART
       ======================================================================== */

    function getCart() {

        try {

            const primary =
                localStorage.getItem(CART_KEY);

            if (primary) {

                const cart =
                    parseCart(primary);

                if (cart.length) {
                    return cart;
                }

            }


            /*
             * Legacy migration
             */

            for (const legacyKey of LEGACY_KEYS) {

                const legacy =
                    localStorage.getItem(legacyKey);

                if (!legacy) {
                    continue;
                }

                const legacyCart =
                    parseCart(legacy);

                if (legacyCart.length) {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(legacyCart)
                    );

                    return legacyCart;

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


    let cart = getCart();


    /* ========================================================================
       7. CLEAR CART
       ======================================================================== */

    function clearAllCartKeys() {

        try {

            localStorage.removeItem(
                CART_KEY
            );

            for (const key of LEGACY_KEYS) {

                localStorage.removeItem(key);

            }

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Cart clearing error:",
                error
            );

        }

    }


    /* ========================================================================
       8. FETCH WITH TIMEOUT
       ======================================================================== */

    async function fetchWithTimeout(
        resource,
        options = {},
        timeout = REQUEST_TIMEOUT_MS
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                timeout
            );

        try {

            const response =
                await fetch(resource, {

                    ...options,

                    signal:
                        controller.signal

                });

            return response;

        } catch (error) {

            if (
                error &&
                error.name === "AbortError"
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


    /* ========================================================================
       9. PRODUCT CACHE
       ======================================================================== */

    let productMap = new Map();

    let productsFetchPromise = null;


    /* ========================================================================
       10. LOAD PRODUCTS FROM CLOUDFLARE WORKER
       ======================================================================== */

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

                    console.log(
                        "[PRASUN SHOP] Loading products from:",
                        PRODUCTS_ENDPOINT
                    );


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


                    const responseText =
                        await response.text();


                    if (!response.ok) {

                        throw new Error(
                            `Product API returned HTTP ${response.status}`
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
                            "[PRASUN SHOP] Invalid product API JSON:",
                            responseText
                        );

                        throw new Error(
                            "The product server returned invalid JSON."
                        );

                    }


                    /*
                     * Worker returns:
                     *
                     * {
                     *     success: true,
                     *     products: [...]
                     * }
                     */

                    let products = [];


                    if (
                        data &&
                        Array.isArray(
                            data.products
                        )
                    ) {

                        products =
                            data.products;

                    }

                    /*
                     * Also support a raw array for compatibility.
                     */

                    else if (
                        Array.isArray(data)
                    ) {

                        products = data;

                    }


                    if (!products.length) {

                        throw new Error(
                            "The product API returned no products."
                        );

                    }


                    productMap =
                        new Map();


                    for (const product of products) {

                        if (
                            !product ||
                            product.id === undefined ||
                            product.id === null
                        ) {
                            continue;
                        }


                        const normalizedId =
                            String(product.id);


                        productMap.set(
                            normalizedId,
                            product
                        );


                        /*
                         * Also index CJ Product ID.
                         */

                        if (
                            product.cjProductId
                        ) {

                            productMap.set(
                                String(
                                    product.cjProductId
                                ),
                                product
                            );

                        }


                        /*
                         * Also index SKU.
                         */

                        if (
                            product.sku
                        ) {

                            productMap.set(
                                String(
                                    product.sku
                                ),
                                product
                            );

                        }


                        if (
                            product.cjSku
                        ) {

                            productMap.set(
                                String(
                                    product.cjSku
                                ),
                                product
                            );

                        }

                    }


                    console.log(
                        "[PRASUN SHOP] Product cache loaded:",
                        productMap.size
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


    /* ========================================================================
       11. FIND PRODUCT
       ======================================================================== */

    function findProduct(id) {

        const key =
            String(id);

        return (
            productMap.get(key) ||
            productMap.get(key.trim()) ||
            null
        );

    }


    /* ========================================================================
       12. EMPTY SUMMARY
       ======================================================================== */

    function renderEmptySummary() {

        if (!orderSummary) {
            return;
        }


        orderSummary.innerHTML = `

            <div
                class="py-8 text-center"
            >

                <div
                    class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100"
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
                            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"
                        ></path>

                    </svg>

                </div>


                <p
                    class="text-zinc-500 text-sm font-medium mb-4"
                >
                    Your cart is empty.
                </p>


                <a
                    href="/products.html"
                    class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all"
                >
                    Continue Shopping
                </a>

            </div>

        `;

    }


    /* ========================================================================
       13. ERROR BANNER
       ======================================================================== */

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
                document.createElement("div");

            errorBanner.id =
                "checkout-error-banner";

            errorBanner.className =
                "mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-200";


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

            errorBanner.classList.remove(
                "hidden"
            );

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

            errorBanner.classList.add(
                "hidden"
            );

            errorBanner.textContent =
                "";

        }

    }


    /* ========================================================================
       14. RENDER ORDER SUMMARY
       ======================================================================== */

    async function loadCheckoutSummary() {

        if (!orderSummary) {
            return;
        }


        try {

            cart = getCart();


            console.log(
                "[PRASUN SHOP] Checkout cart:",
                cart
            );


            if (!cart.length) {

                renderEmptySummary();

                return;

            }


            /*
             * Load live products from Worker.
             */

            await fetchProducts();


            let total = 0;

            const validItems = [];


            let itemsHTML = `

                <div
                    class="max-h-72 overflow-y-auto space-y-1 pr-1"
                >

            `;


            for (const item of cart) {

                const product =
                    findProduct(item.id);


                if (!product) {

                    console.warn(
                        "[PRASUN SHOP] Product not found for cart item:",
                        item.id
                    );

                    continue;

                }


                const price =
                    Number(product.price);


                if (
                    !Number.isFinite(price) ||
                    price < 0
                ) {

                    console.warn(
                        "[PRASUN SHOP] Invalid product price:",
                        product
                    );

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


                const subtotal =
                    price * quantity;


                total += subtotal;


                validItems.push({

                    id:
                        String(
                            product.id
                        ),

                    sku:
                        String(
                            product.sku ||
                            product.cjSku ||
                            product.id
                        ),

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
                        product.image ||
                        (
                            Array.isArray(
                                product.images
                            )
                                ? product.images[0]
                                : ""
                        ) ||
                        ""
                    );


                const name =
                    escapeHTML(
                        product.name ||
                        "Product"
                    );


                itemsHTML += `

                    <div
                        class="flex items-center gap-4 py-4 border-b border-zinc-100"
                    >

                        ${
                            image
                                ? `
                                    <img
                                        src="${image}"
                                        alt="${name}"
                                        class="w-16 h-16 object-contain rounded-xl border border-zinc-200/60 bg-zinc-100 shrink-0"
                                        loading="lazy"
                                        decoding="async"
                                    >
                                `
                                : `
                                    <div
                                        class="w-16 h-16 rounded-xl border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-400"
                                        aria-hidden="true"
                                    >
                                        <span class="text-xl">🛒</span>
                                    </div>
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
                                class="text-xs text-zinc-500"
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
                                ${formatPrice(subtotal)}
                            </p>


                            <p
                                class="text-[11px] text-zinc-400"
                            >
                                ${formatPrice(price)} each
                            </p>

                        </div>

                    </div>

                `;

            }


            itemsHTML += `
                </div>
            `;


            if (!validItems.length) {

                orderSummary.innerHTML = `

                    <div
                        class="py-8 text-center"
                    >

                        <p
                            class="text-sm text-red-500 font-medium mb-2"
                        >
                            The products in your cart could not be found.
                        </p>

                        <p
                            class="text-xs text-zinc-500 mb-4"
                        >
                            Please return to the shop and add the product again.
                        </p>

                        <a
                            href="/products.html"
                            class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl"
                        >
                            Continue Shopping
                        </a>

                    </div>

                `;

                return;

            }


            itemsHTML += `

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
                            ${formatPrice(total)}
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
                            ${formatPrice(total)}
                        </span>

                    </div>

                </div>

            `;


            orderSummary.innerHTML =
                itemsHTML;


            /*
             * Store validated checkout items in memory.
             */
            window.__PRASUN_CHECKOUT_ITEMS =
                validItems;


            window.__PRASUN_CHECKOUT_TOTAL =
                Number(
                    total.toFixed(2)
                );


        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout summary error:",
                error
            );


            orderSummary.innerHTML = `

                <div
                    class="py-6 text-center"
                >

                    <p
                        class="text-xs text-red-500 font-medium mb-3"
                    >
                        Failed to load order summary.
                    </p>


                    <p
                        class="text-xs text-zinc-500 mb-4"
                    >
                        ${escapeHTML(
                            error?.message ||
                            "Unable to connect to the product server."
                        )}
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


            const retryButton =
                document.getElementById(
                    "retry-summary-btn"
                );


            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    () => {

                        productMap =
                            new Map();

                        productsFetchPromise =
                            null;

                        loadCheckoutSummary();

                    }
                );

            }

        }

    }


    /* ========================================================================
       15. SUBMIT ORDER
       ======================================================================== */

    if (checkoutForm) {

        checkoutForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                hideFormError();


                cart = getCart();


                if (!cart.length) {

                    showFormError(
                        "Your cart is empty. Please return to the shop and add a product."
                    );

                    return;

                }


                const submitButton =
                    checkoutForm.querySelector(
                        'button[type="submit"]'
                    );


                if (
                    !submitButton ||
                    submitButton.dataset.processing === "true"
                ) {

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


                    /* ----------------------------------------------------
                       VALIDATION
                       ---------------------------------------------------- */

                    if (!customerName) {

                        throw new Error(
                            "Please enter your full name."
                        );

                    }


                    const emailRegex =
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


                    if (
                        !email ||
                        !emailRegex.test(email)
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


                    /* ----------------------------------------------------
                       REFRESH PRODUCT DATA
                       ---------------------------------------------------- */

                    productMap =
                        new Map();

                    productsFetchPromise =
                        null;


                    await fetchProducts();


                    const enrichedCart =
                        [];


                    for (const item of cart) {

                        const product =
                            findProduct(item.id);


                        if (!product) {

                            console.warn(
                                "[PRASUN SHOP] Skipping missing product:",
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


                        enrichedCart.push({

                            id:
                                String(
                                    product.id
                                ),

                            cjProductId:
                                String(
                                    product.cjProductId ||
                                    product.id
                                ),

                            sku:
                                String(
                                    product.sku ||
                                    product.cjSku ||
                                    product.id
                                ),

                            cjSku:
                                String(
                                    product.cjSku ||
                                    product.sku ||
                                    product.id
                                ),

                            name:
                                String(
                                    product.name ||
                                    "Product"
                                ),

                            price,

                            quantity

                        });

                    }


                    if (!enrichedCart.length) {

                        throw new Error(
                            "No valid products were found in your cart. Please return to the shop and add the product again."
                        );

                    }


                    const calculatedTotal =
                        enrichedCart.reduce(
                            (
                                sum,
                                item
                            ) =>
                                sum +
                                (
                                    item.price *
                                    item.quantity
                                ),
                            0
                        );


                    const orderPayload = {

                        customerName,

                        email,

                        phone,

                        address,

                        cart:
                            enrichedCart,

                        total:
                            Number(
                                calculatedTotal.toFixed(2)
                            ),

                        currency:
                            "USD",

                        source:
                            "PRASUN SHOP",

                        createdAt:
                            new Date().toISOString()

                    };


                    console.log(
                        "[PRASUN SHOP] Sending order:",
                        orderPayload
                    );


                    /* ----------------------------------------------------
                       SEND ORDER TO CLOUDFLARE WORKER
                       ---------------------------------------------------- */

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
                                        orderPayload
                                    )

                            }
                        );


                    const responseText =
                        await response.text();


                    let responseData =
                        null;


                    try {

                        responseData =
                            responseText
                                ? JSON.parse(
                                    responseText
                                )
                                : null;

                    } catch {

                        responseData =
                            null;

                    }


                    if (!response.ok) {

                        throw new Error(
                            responseData?.error ||
                            responseData?.message ||
                            `Order server returned HTTP ${response.status}`
                        );

                    }


                    if (
                        responseData &&
                        responseData.success === false
                    ) {

                        throw new Error(
                            responseData.error ||
                            responseData.message ||
                            "The order was not accepted."
                        );

                    }


                    console.log(
                        "[PRASUN SHOP] Order successfully submitted:",
                        responseData
                    );


                    /* ----------------------------------------------------
                       CLEAR CART ONLY AFTER SUCCESS
                       ---------------------------------------------------- */

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
                     * Redirect after successful order.
                     */

                    window.location.href =
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

                }

            }
        );

    }


    /* ========================================================================
       16. CROSS-TAB CART SYNCHRONIZATION
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

                productMap =
                    new Map();

                productsFetchPromise =
                    null;

                loadCheckoutSummary();

            }

        }
    );


    /* ========================================================================
       17. CUSTOM CART EVENT
       ======================================================================== */

    window.addEventListener(
        "prasunCartUpdated",
        () => {

            productMap =
                new Map();

            productsFetchPromise =
                null;

            loadCheckoutSummary();

        }
    );


    /* ========================================================================
       18. INITIAL LOAD
       ======================================================================== */

    loadCheckoutSummary();

})();
