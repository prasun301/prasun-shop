/**
 * ============================================================================
 * PRASUN SHOP — CJ-AWARE CHECKOUT
 * ============================================================================
 *
 * js/checkout.js
 *
 * FRONTEND ONLY
 *
 * Storefront:
 *     https://shop.prasunbarua.com
 *
 * Cloudflare Worker:
 *     https://prasun-shop-api.prasun301.workers.dev
 *
 * Worker routes:
 *
 *     GET  /api/health
 *     GET  /api/products
 *     GET  /api/products?pid=XXXX
 *     POST /api/order
 *
 * Supplier:
 *     CJ Dropshipping
 *
 * DESIGN:
 *
 *     - No Material Symbols dependency
 *     - No emoji
 *     - Inline SVG icons only
 *     - Clean responsive checkout
 *     - Browser prices are display-only
 *     - Worker remains authoritative
 *
 * IMPORTANT:
 *
 *     - No CJ credentials are stored in the browser.
 *     - Browser never calls CJ directly.
 *     - Product / price / stock / variant data is refreshed before order.
 *     - Worker must validate everything again before creating the order.
 *
 * ============================================================================
 */

"use strict";

(() => {

    /* =========================================================================
       1. CONFIGURATION
       ========================================================================= */

    const CONFIG = {

        WORKER_BASE:
            "https://prasun-shop-api.prasun301.workers.dev",

        PRODUCTS_ENDPOINT:
            "/api/products",

        ORDER_ENDPOINT:
            "/api/order",

        HEALTH_ENDPOINT:
            "/api/health",

        CART_KEY:
            "prasun_cart",

        CHECKOUT_SNAPSHOT_KEY:
            "prasun_checkout_snapshot",

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
            15000,

        LOAD_RETRY_DELAY:
            250

    };


    /* =========================================================================
       2. DOM ELEMENTS
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

        summaryTotals:
            document.getElementById(
                "summary-totals"
            ),

        summaryItemCount:
            document.getElementById(
                "summary-item-count"
            ),

        summarySubtotal:
            document.getElementById(
                "summary-subtotal"
            ),

        summaryShipping:
            document.getElementById(
                "summary-shipping"
            ),

        orderTotal:
            document.getElementById(
                "order-total"
            ),

        checkoutError:
            document.getElementById(
                "checkout-error"
            ),

        checkoutErrorMessage:
            document.getElementById(
                "checkout-error-message"
            ),

        checkoutSuccess:
            document.getElementById(
                "checkout-success"
            ),

        checkoutSuccessMessage:
            document.getElementById(
                "checkout-success-message"
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
       3. STATE
       ========================================================================= */

    const state = {

        cart:
            [],

        products:
            new Map(),

        refreshedItems:
            [],

        loading:
            false,

        submitting:
            false,

        initialized:
            false,

        loadSequence:
            0

    };


    /* =========================================================================
       4. CURRENCY
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


    function formatPrice(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return "$0.00";

        }

        return currencyFormatter.format(
            number
        );

    }


    /* =========================================================================
       5. GENERAL HELPERS
       ========================================================================= */

    function cleanString(
        value
    ) {

        return String(
            value ?? ""
        ).trim();

    }


    function escapeHTML(
        value
    ) {

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


    function normalizePrice(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            ) ||
            number < 0
        ) {

            return 0;

        }

        return Number(
            number.toFixed(
                2
            )
        );

    }


    function normalizeQuantity(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            ) ||
            number <= 0
        ) {

            return 1;

        }

        return Math.min(
            CONFIG.MAX_QUANTITY,
            Math.max(
                1,
                Math.floor(
                    number
                )
            )
        );

    }


    function getWorkerURL(
        endpoint
    ) {

        return `${CONFIG.WORKER_BASE}${endpoint}`;

    }


    /* =========================================================================
       6. INLINE SVG ICON SYSTEM
       =========================================================================
       
       SVG icons are used instead of Material Symbols so the checkout page
       does not depend on an external icon font or ligature rendering.
       ========================================================================= */

    function svgIcon(
        name,
        className = "checkout-icon"
    ) {

        const safeClass =
            escapeHTML(
                className
            );


        const icons = {

            cart: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="9" cy="20" r="1.4"></circle>
                    <circle cx="18" cy="20" r="1.4"></circle>
                    <path d="M3 4h2l2.3 11a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 1.9-1.5L21 8H6"></path>
                </svg>
            `,

            package: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"></path>
                    <path d="M12 12v9"></path>
                    <path d="m4.5 7.5 7.5 4.2 7.5-4.2"></path>
                    <path d="M8 5.2 16 9.5"></path>
                </svg>
            `,

            tune: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M4 7h16"></path>
                    <path d="M4 17h16"></path>
                    <circle cx="9" cy="7" r="2"></circle>
                    <circle cx="15" cy="17" r="2"></circle>
                </svg>
            `,

            sync: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M20 7v5h-5"></path>
                    <path d="M4 17v-5h5"></path>
                    <path d="M6.2 9a6.5 6.5 0 0 1 10.9-2"></path>
                    <path d="M17.8 15a6.5 6.5 0 0 1-10.9 2"></path>
                </svg>
            `,

            error: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 8v5"></path>
                    <path d="M12 16h.01"></path>
                </svg>
            `,

            refresh: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M20 11a8 8 0 1 0 1 4"></path>
                    <path d="M20 4v7h-7"></path>
                </svg>
            `,

            receipt: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path>
                    <path d="M9 8h6"></path>
                    <path d="M9 12h6"></path>
                    <path d="M9 16h3"></path>
                </svg>
            `,

            payment: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                    ></rect>
                    <path d="M3 10h18"></path>
                    <path d="M7 15h3"></path>
                </svg>
            `,

            check: `
                <svg
                    class="${safeClass}"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="m5 12 4 4L19 6"></path>
                </svg>
            `

        };


        return (
            icons[name] ||
            icons.package
        );

    }


    /* =========================================================================
       7. STORAGE
       ========================================================================= */

    function readStorage(
        key
    ) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] localStorage read error:",
                error
            );

            return null;

        }

    }


    function writeStorage(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                value
            );

            return true;

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] localStorage write error:",
                error
            );

            return false;

        }

    }


    function removeStorage(
        key
    ) {

        try {

            localStorage.removeItem(
                key
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] localStorage remove error:",
                error
            );

        }

    }


    /* =========================================================================
       8. CART NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            typeof item !== "object"
        ) {

            return null;

        }


        const id =
            cleanString(
                item.id ||
                item.pid ||
                ""
            );


        if (
            !id
        ) {

            return null;

        }


        return {

            id,

            pid:
                cleanString(
                    item.pid ||
                    id
                ),

            cj_id:
                cleanString(
                    item.cj_id ||
                    item.cjId ||
                    item.pid ||
                    id
                ),

            sku:
                cleanString(
                    item.sku
                ),

            variantId:
                cleanString(
                    item.variantId ||
                    item.vid
                ),

            vid:
                cleanString(
                    item.vid ||
                    item.variantId
                ),

            variantSku:
                cleanString(
                    item.variantSku
                ),

            variantOptions:
                cleanString(
                    item.variantOptions
                ),

            name:
                cleanString(
                    item.name ||
                    item.title ||
                    "CJ Product"
                ),

            title:
                cleanString(
                    item.title ||
                    item.name ||
                    "CJ Product"
                ),

            category:
                cleanString(
                    item.category
                ),

            price:
                normalizePrice(
                    item.price
                ),

            image:
                cleanString(
                    item.image
                ),

            originalImage:
                cleanString(
                    item.originalImage
                ),

            quantity:
                normalizeQuantity(
                    item.quantity
                )

        };

    }


    function parseCart(
        raw
    ) {

        if (
            !raw
        ) {

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
                "[PRASUN SHOP] Cart parsing error:",
                error
            );

            return [];

        }

    }


    function getCart() {

        const primary =
            readStorage(
                CONFIG.CART_KEY
            );


        if (
            primary
        ) {

            const cart =
                parseCart(
                    primary
                );


            if (
                cart.length
            ) {

                return cart;

            }

        }


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
                readStorage(
                    key
                );


            if (
                !raw
            ) {

                continue;

            }


            const migrated =
                parseCart(
                    raw
                );


            if (
                migrated.length
            ) {

                writeStorage(
                    CONFIG.CART_KEY,
                    JSON.stringify(
                        migrated
                    )
                );


                return migrated;

            }

        }


        return [];

    }


    function clearCart() {

        removeStorage(
            CONFIG.CART_KEY
        );


        removeStorage(
            CONFIG.CHECKOUT_SNAPSHOT_KEY
        );


        for (
            const key of
            CONFIG.LEGACY_CART_KEYS
        ) {

            removeStorage(
                key
            );

        }

    }


    /* =========================================================================
       9. CART COUNT
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
                        normalizeQuantity(
                            item.quantity
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


        elements.cartCount.setAttribute(
            "aria-label",
            `${count} ${
                count === 1
                    ? "item"
                    : "items"
            } in cart`
        );

    }


    /* =========================================================================
       10. FETCH
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
            window.setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );


        try {

            const fetchOptions = {
                ...options
            };


            delete fetchOptions.timeout;


            fetchOptions.signal =
                controller.signal;


            return await fetch(
                resource,
                fetchOptions
            );

        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "The request timed out. Please try again."
                );

            }


            throw error;

        } finally {

            clearTimeout(
                timer
            );

        }

    }


    async function parseJSONResponse(
        response
    ) {

        const text =
            await response.text();


        if (
            !text.trim()
        ) {

            return null;

        }


        try {

            return JSON.parse(
                text
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Invalid JSON response:",
                text.slice(
                    0,
                    800
                )
            );


            throw new Error(
                "The service returned an invalid response."
            );

        }

    }


    /* =========================================================================
       11. ERROR / STATUS UI
       ========================================================================= */

    function showError(
        message
    ) {

        const text =
            cleanString(
                message
            ) ||
            "Unable to complete your request.";


        if (
            elements.checkoutErrorMessage
        ) {

            elements.checkoutErrorMessage.textContent =
                text;

        } else if (
            elements.checkoutError
        ) {

            elements.checkoutError.textContent =
                text;

        }


        if (
            elements.checkoutError
        ) {

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


        if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.classList.remove(
                "visible"
            );

        }

    }


    function hideError() {

        if (
            elements.checkoutError
        ) {

            elements.checkoutError.classList.remove(
                "visible"
            );

        }


        if (
            elements.checkoutErrorMessage
        ) {

            elements.checkoutErrorMessage.textContent =
                "";

        }

    }


    function showSuccess(
        message
    ) {

        const text =
            cleanString(
                message
            );


        if (
            elements.checkoutSuccessMessage
        ) {

            elements.checkoutSuccessMessage.textContent =
                text;

        } else if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.textContent =
                text;

        }


        if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.classList.add(
                "visible"
            );

        }


        if (
            elements.checkoutError
        ) {

            elements.checkoutError.classList.remove(
                "visible"
            );

        }

    }


    function hideSuccess() {

        if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.classList.remove(
                "visible"
            );

        }


        if (
            elements.checkoutSuccessMessage
        ) {

            elements.checkoutSuccessMessage.textContent =
                "";

        }

    }


    function setStatus(
        message,
        loading = false
    ) {

        if (
            !elements.checkoutStatus
        ) {

            return;

        }


        const text =
            escapeHTML(
                message || ""
            );


        if (
            loading
        ) {

            elements.checkoutStatus.innerHTML = `

                <span
                    class="checkout-status-icon"
                    aria-hidden="true"
                >
                    ${svgIcon(
                        "sync",
                        "status-svg-icon"
                    )}
                </span>

                <span>
                    ${text}
                </span>

            `;

            return;

        }


        elements.checkoutStatus.textContent =
            message || "";

    }


    /* =========================================================================
       12. FORM HELPERS
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

        if (
            !field
        ) {

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

        if (
            !field
        ) {

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
       13. FORM VALIDATION
       ========================================================================= */

    function validateForm() {

        const fields = {

            name:
                getField(
                    "customer-name"
                ),

            email:
                getField(
                    "customer-email"
                ),

            phone:
                getField(
                    "customer-phone"
                ),

            country:
                getField(
                    "shipping-country"
                ),

            countryCode:
                getField(
                    "shipping-country-code"
                ),

            province:
                getField(
                    "shipping-province"
                ),

            city:
                getField(
                    "shipping-city"
                ),

            zip:
                getField(
                    "shipping-zip"
                ),

            county:
                getField(
                    "shipping-county"
                ),

            address:
                getField(
                    "shipping-address"
                ),

            address2:
                getField(
                    "shipping-address2"
                ),

            remark:
                getField(
                    "order-note"
                )

        };


        Object.values(
            fields
        ).forEach(
            clearInvalid
        );


        const name =
            cleanString(
                fields.name?.value
            );


        const email =
            cleanString(
                fields.email?.value
            );


        const phone =
            cleanString(
                fields.phone?.value
            );


        const country =
            cleanString(
                fields.country?.value
            );


        const countryCode =
            cleanString(
                fields.countryCode?.value
            ).toUpperCase();


        const province =
            cleanString(
                fields.province?.value
            );


        const city =
            cleanString(
                fields.city?.value
            );


        const zip =
            cleanString(
                fields.zip?.value
            );


        const county =
            cleanString(
                fields.county?.value
            );


        const address =
            cleanString(
                fields.address?.value
            );


        const address2 =
            cleanString(
                fields.address2?.value
            );


        const remark =
            cleanString(
                fields.remark?.value
            );


        if (
            !name
        ) {

            markInvalid(
                fields.name
            );

            fields.name?.focus();

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
                fields.email
            );

            fields.email?.focus();

            throw new Error(
                "Please enter a valid email address."
            );

        }


        if (
            phone.replace(
                /\D/g,
                ""
            ).length < 6
        ) {

            markInvalid(
                fields.phone
            );

            fields.phone?.focus();

            throw new Error(
                "Please enter a valid phone number."
            );

        }


        if (
            !country
        ) {

            markInvalid(
                fields.country
            );

            fields.country?.focus();

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
                fields.countryCode
            );

            fields.countryCode?.focus();

            throw new Error(
                "Please enter a valid two-letter country code."
            );

        }


        if (
            !province
        ) {

            markInvalid(
                fields.province
            );

            fields.province?.focus();

            throw new Error(
                "Please enter your state or province."
            );

        }


        if (
            !city
        ) {

            markInvalid(
                fields.city
            );

            fields.city?.focus();

            throw new Error(
                "Please enter your city."
            );

        }


        if (
            !address
        ) {

            markInvalid(
                fields.address
            );

            fields.address?.focus();

            throw new Error(
                "Please enter your shipping address."
            );

        }


        return {

            name,
            email,
            phone,
            country,
            countryCode,
            province,
            city,
            zip,
            county,
            address,
            address2,
            remark

        };

    }


    /* =========================================================================
       14. PRODUCT FETCH
       ========================================================================= */

    async function fetchProductById(
        pid
    ) {

        const cleanPid =
            cleanString(
                pid
            );


        if (
            !cleanPid
        ) {

            throw new Error(
                "Missing product ID."
            );

        }


        const endpoint =
            new URL(
                CONFIG.PRODUCTS_ENDPOINT,
                CONFIG.WORKER_BASE
            );


        endpoint.searchParams.set(
            "pid",
            cleanPid
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


        const data =
            await parseJSONResponse(
                response
            );


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                `Product service returned HTTP ${response.status}.`
            );

        }


        if (
            data?.success !== true ||
            !data?.product
        ) {

            throw new Error(
                data?.error ||
                "Product is no longer available."
            );

        }


        return data.product;

    }


    /* =========================================================================
       15. REFRESH CART PRODUCTS
       ========================================================================= */

    async function refreshCartProducts() {

        const cart =
            getCart();


        if (
            !cart.length
        ) {

            return [];

        }


        const refreshed = [];


        for (
            const cartItem
            of cart
        ) {

            const pid =
                cleanString(
                    cartItem.pid ||
                    cartItem.cj_id ||
                    cartItem.id
                );


            const product =
                await fetchProductById(
                    pid
                );


            if (
                !product
            ) {

                throw new Error(
                    `${cartItem.name || "A product"} is no longer available.`
                );

            }


            const normalizedProduct = {

                ...product,

                id:
                    cleanString(
                        product.id ||
                        product.pid ||
                        pid
                    ),

                pid:
                    cleanString(
                        product.pid ||
                        product.id ||
                        pid
                    ),

                title:
                    cleanString(
                        product.title ||
                        product.name ||
                        cartItem.name
                    ),

                name:
                    cleanString(
                        product.name ||
                        product.title ||
                        cartItem.name
                    ),

                price:
                    normalizePrice(
                        product.price
                    ),

                image:
                    cleanString(
                        product.image ||
                        cartItem.image
                    ),

                originalImage:
                    cleanString(
                        product.originalImage ||
                        cartItem.originalImage
                    ),

                quantity:
                    Number(
                        product.quantity ||
                        0
                    ),

                variants:
                    Array.isArray(
                        product.variants
                    )
                        ? product.variants
                        : []

            };


            let selectedVariant =
                null;


            const selectedVid =
                cleanString(
                    cartItem.vid ||
                    cartItem.variantId
                );


            const selectedVariantSku =
                cleanString(
                    cartItem.variantSku
                );


            if (
                selectedVid
            ) {

                selectedVariant =
                    normalizedProduct
                        .variants
                        .find(
                            variant =>
                                String(
                                    variant?.vid ||
                                    ""
                                ) ===
                                String(
                                    selectedVid
                                )
                        ) ||
                    null;

            }


            if (
                !selectedVariant &&
                selectedVariantSku
            ) {

                selectedVariant =
                    normalizedProduct
                        .variants
                        .find(
                            variant =>
                                String(
                                    variant?.sku ||
                                    ""
                                )
                                    .toLowerCase() ===
                                selectedVariantSku
                                    .toLowerCase()
                        ) ||
                    null;

            }


            if (
                (
                    selectedVid ||
                    selectedVariantSku
                ) &&
                !selectedVariant
            ) {

                throw new Error(
                    `${normalizedProduct.name} no longer has the selected variant.`
                );

            }


            let effectivePrice =
                normalizedProduct.price;


            if (
                selectedVariant
            ) {

                effectivePrice =
                    normalizePrice(
                        selectedVariant.price
                    );

            }


            const requestedQuantity =
                normalizeQuantity(
                    cartItem.quantity
                );


            const currentInventory =
                Number(
                    normalizedProduct.quantity
                );


            if (
                Number.isFinite(
                    currentInventory
                ) &&
                currentInventory > 0 &&
                requestedQuantity >
                    currentInventory
            ) {

                throw new Error(
                    `${normalizedProduct.name} has only ${currentInventory} unit${
                        currentInventory === 1
                            ? ""
                            : "s"
                    } available.`
                );

            }


            refreshed.push({

                cartItem,

                product:
                    normalizedProduct,

                quantity:
                    requestedQuantity,

                price:
                    effectivePrice,

                variant:
                    selectedVariant

            });

        }


        return refreshed;

    }


    /* =========================================================================
       16. SUMMARY RENDERING
       ========================================================================= */

    function renderOrderSummary(
        items
    ) {

        if (
            !elements.orderSummary
        ) {

            return;

        }


        if (
            !items.length
        ) {

            renderEmptySummary();

            return;

        }


        let subtotal =
            0;


        let totalQuantity =
            0;


        const html =
            items.map(
                entry => {

                    const product =
                        entry.product;


                    const quantity =
                        entry.quantity;


                    const lineTotal =
                        Number(
                            (
                                entry.price *
                                quantity
                            ).toFixed(
                                2
                            )
                        );


                    subtotal +=
                        lineTotal;


                    totalQuantity +=
                        quantity;


                    const name =
                        escapeHTML(
                            product.name ||
                            product.title ||
                            "CJ Product"
                        );


                    const image =
                        escapeHTML(
                            product.image ||
                            product.originalImage ||
                            ""
                        );


                    const variantText =
                        cleanString(
                            entry.cartItem.variantOptions
                        ) ||
                        cleanString(
                            entry.cartItem.variantSku
                        );


                    return `

                        <div class="summary-item">

                            <div class="summary-item-image-wrap">

                                ${
                                    image

                                        ? `

                                            <img
                                                src="${image}"
                                                alt="${name}"
                                                class="summary-item-image"
                                                loading="lazy"
                                                decoding="async"
                                                referrerpolicy="no-referrer"
                                            >

                                        `

                                        : `

                                            <div
                                                class="summary-item-image summary-item-image-placeholder"
                                                aria-hidden="true"
                                            >
                                                ${svgIcon(
                                                    "package",
                                                    "summary-placeholder-icon"
                                                )}
                                            </div>

                                        `
                                }


                                <span
                                    class="summary-item-quantity"
                                    aria-label="Quantity ${quantity}"
                                >
                                    ${quantity}
                                </span>

                            </div>


                            <div class="summary-item-info">

                                <p class="summary-item-name">
                                    ${name}
                                </p>


                                <div class="summary-item-meta">

                                    <span>
                                        ${formatPrice(
                                            entry.price
                                        )}
                                    </span>

                                    ${
                                        variantText

                                            ? `

                                                <span class="summary-variant">
                                                    ${svgIcon(
                                                        "tune",
                                                        "summary-meta-icon"
                                                    )}
                                                    <span>
                                                        ${escapeHTML(
                                                            variantText
                                                        )}
                                                    </span>
                                                </span>

                                            `

                                            : ""
                                    }

                                </div>

                            </div>


                            <div class="summary-item-price">
                                ${formatPrice(
                                    lineTotal
                                )}
                            </div>

                        </div>

                    `;

                }
            ).join("");


        elements.orderSummary.innerHTML =
            html;


        elements.orderSummary.setAttribute(
            "aria-busy",
            "false"
        );


        if (
            elements.summaryItemCount
        ) {

            elements.summaryItemCount.textContent =
                String(
                    totalQuantity
                );

        }


        if (
            elements.summarySubtotal
        ) {

            elements.summarySubtotal.textContent =
                formatPrice(
                    subtotal
                );

        }


        if (
            elements.summaryShipping
        ) {

            elements.summaryShipping.textContent =
                "Calculated during order processing";

        }


        if (
            elements.orderTotal
        ) {

            elements.orderTotal.textContent =
                formatPrice(
                    subtotal
                );

        }


        if (
            elements.summaryTotals
        ) {

            elements.summaryTotals.hidden =
                false;

        }


        return {

            subtotal:
                Number(
                    subtotal.toFixed(
                        2
                    )
                ),

            quantity:
                totalQuantity

        };

    }


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

            <div
                class="summary-empty"
                role="status"
            >

                <div
                    class="summary-empty-icon"
                    aria-hidden="true"
                >
                    ${svgIcon(
                        "cart",
                        "summary-empty-svg"
                    )}
                </div>


                <strong>
                    Your cart is empty
                </strong>


                <p>
                    Add products before continuing to checkout.
                </p>

            </div>

        `;


        if (
            elements.summaryTotals
        ) {

            elements.summaryTotals.hidden =
                true;

        }


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                true;

        }

    }


    /* =========================================================================
       17. LOAD CHECKOUT
       ========================================================================= */

    async function loadCheckout() {

        if (
            state.loading
        ) {

            return;

        }


        const requestId =
            ++state.loadSequence;


        state.loading =
            true;


        const cart =
            getCart();


        state.cart =
            cart;


        if (
            !cart.length
        ) {

            renderEmptySummary();

            state.loading =
                false;

            return;

        }


        if (
            elements.orderSummary
        ) {

            elements.orderSummary.setAttribute(
                "aria-busy",
                "true"
            );


            elements.orderSummary.innerHTML = `

                <div
                    class="summary-empty"
                    role="status"
                >

                    <div
                        class="summary-loading"
                        aria-hidden="true"
                    >
                        ${svgIcon(
                            "sync",
                            "summary-loading-svg"
                        )}
                    </div>

                    <p>
                        Loading your order...
                    </p>

                </div>

            `;

        }


        try {

            const refreshedItems =
                await refreshCartProducts();


            if (
                requestId !==
                state.loadSequence
            ) {

                return;

            }


            state.refreshedItems =
                refreshedItems;


            renderOrderSummary(
                refreshedItems
            );


            if (
                elements.placeOrderButton
            ) {

                elements.placeOrderButton.disabled =
                    refreshedItems.length ===
                    0;

            }


            setStatus(
                ""
            );


        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Checkout load error:",
                error
            );


            if (
                requestId !==
                state.loadSequence
            ) {

                return;

            }


            showError(
                error?.message ||
                "Unable to load your cart."
            );


            if (
                elements.orderSummary
            ) {

                elements.orderSummary.innerHTML = `

                    <div
                        class="summary-empty"
                        role="alert"
                    >

                        <div
                            class="summary-empty-icon"
                            aria-hidden="true"
                        >
                            ${svgIcon(
                                "error",
                                "summary-error-svg"
                            )}
                        </div>


                        <strong>
                            Unable to load order
                        </strong>


                        <p>
                            Unable to load current product information.
                        </p>


                        <button
                            type="button"
                            id="retry-checkout-button"
                            class="continue-shopping"
                        >

                            ${svgIcon(
                                "refresh",
                                "button-svg-icon"
                            )}

                            <span>
                                Try Again
                            </span>

                        </button>

                    </div>

                `;


                document
                    .getElementById(
                        "retry-checkout-button"
                    )
                    ?.addEventListener(
                        "click",
                        () => {

                            hideError();

                            loadCheckout();

                        },
                        {
                            once:
                                true
                        }
                    );

            }

        } finally {

            if (
                requestId ===
                state.loadSequence
            ) {

                state.loading =
                    false;

            }

        }

    }


    /* =========================================================================
       18. VALIDATE CHECKOUT ITEMS AGAIN
       ========================================================================= */

    async function validateCheckoutItems() {

        const refreshed =
            await refreshCartProducts();


        if (
            !refreshed.length
        ) {

            throw new Error(
                "Your cart is empty."
            );

        }


        state.refreshedItems =
            refreshed;


        renderOrderSummary(
            refreshed
        );


        return refreshed;

    }


    /* =========================================================================
       19. BUILD ORDER PAYLOAD
       ========================================================================= */

    function buildOrderPayload(
        customer,
        refreshedItems
    ) {

        const items =
            refreshedItems.map(
                entry => {

                    const product =
                        entry.product;


                    const cartItem =
                        entry.cartItem;


                    const variant =
                        entry.variant;


                    const vid =
                        cleanString(
                            variant?.vid ||
                            cartItem.vid ||
                            cartItem.variantId
                        );


                    const variantSku =
                        cleanString(
                            variant?.sku ||
                            cartItem.variantSku
                        );


                    return {

                        id:
                            String(
                                product.id ||
                                product.pid
                            ),

                        pid:
                            String(
                                product.pid ||
                                product.id
                            ),

                        cj_id:
                            String(
                                product.pid ||
                                product.id
                            ),

                        sku:
                            String(
                                variantSku ||
                                product.sku ||
                                cartItem.sku ||
                                ""
                            ),

                        vid,

                        variantId:
                            vid,

                        variantSku,

                        variantOptions:
                            cleanString(
                                cartItem.variantOptions
                            ),

                        name:
                            String(
                                product.name ||
                                product.title ||
                                "CJ Product"
                            ),

                        title:
                            String(
                                product.title ||
                                product.name ||
                                "CJ Product"
                            ),

                        image:
                            String(
                                product.image ||
                                product.originalImage ||
                                ""
                            ),

                        quantity:
                            normalizeQuantity(
                                entry.quantity
                            )

                    };

                }
            );


        if (
            !items.length
        ) {

            throw new Error(
                "No valid products were found."
            );

        }


        return {

            customer: {

                name:
                    customer.name,

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


            cart:
                items.map(
                    item => ({

                        id:
                            item.id,

                        pid:
                            item.pid,

                        sku:
                            item.sku,

                        vid:
                            item.vid,

                        variantSku:
                            item.variantSku,

                        variantOptions:
                            item.variantOptions,

                        quantity:
                            item.quantity

                    })
                ),


            currency:
                "USD",


            source:
                "PRASUN SHOP"

        };

    }


    /* =========================================================================
       20. PLACE ORDER
       ========================================================================= */

    async function submitOrder() {

        if (
            state.submitting
        ) {

            return;

        }


        hideError();
        hideSuccess();


        if (
            !elements.checkoutForm
        ) {

            return;

        }


        let customer;


        try {

            customer =
                validateForm();

        } catch (
            error
        ) {

            showError(
                error?.message ||
                "Please check your information."
            );

            return;

        }


        const cart =
            getCart();


        if (
            !cart.length
        ) {

            showError(
                "Your cart is empty."
            );

            return;

        }


        state.submitting =
            true;


        if (
            elements.placeOrderButton
        ) {

            elements.placeOrderButton.disabled =
                true;


            elements.placeOrderButton.dataset.processing =
                "true";


            elements.placeOrderButton.innerHTML = `

                ${svgIcon(
                    "sync",
                    "button-svg-icon"
                )}

                <span>
                    Validating Order
                </span>

            `;

        }


        try {

            setStatus(
                "Checking current product availability and prices...",
                true
            );


            const refreshedItems =
                await validateCheckoutItems();


            const payload =
                buildOrderPayload(
                    customer,
                    refreshedItems
                );


            writeStorage(
                CONFIG.CHECKOUT_SNAPSHOT_KEY,
                JSON.stringify(
                    {
                        version:
                            1,

                        createdAt:
                            new Date().toISOString(),

                        items:
                            payload.items
                    }
                )
            );


            setStatus(
                "Submitting your order...",
                true
            );


            const response =
                await fetchWithTimeout(
                    getWorkerURL(
                        CONFIG.ORDER_ENDPOINT
                    ),
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


            const data =
                await parseJSONResponse(
                    response
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Order service returned HTTP ${response.status}.`
                );

            }


            if (
                data?.success !== true
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "The order was not accepted."
                );

            }


            const orderNumber =
                cleanString(

                    data.orderNumber ||
                    data.orderId ||
                    data.orderCode ||
                    data.order?.orderNumber ||
                    data.order?.orderCode ||
                    ""

                );


            const cjOrderNumber =
                cleanString(

                    data.cjOrderNumber ||
                    data.cjOrderCode ||
                    data.cjOrder?.orderNumber ||
                    data.cjOrder?.orderCode ||
                    ""

                );


            const paymentURL =
                cleanString(

                    data.cjPayUrl ||
                    data.paymentUrl ||
                    data.payUrl ||
                    data.order?.cjPayUrl ||
                    ""

                );


            try {

                sessionStorage.setItem(
                    "prasun_order_confirmation",
                    JSON.stringify(
                        {

                            orderNumber,
                            cjOrderNumber,

                            createdAt:
                                Date.now()

                        }
                    )
                );

            } catch (
                error
            ) {

                console.warn(
                    "[PRASUN SHOP] Unable to store confirmation:",
                    error
                );

            }


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


            if (
                elements.confirmationOrderNumber
            ) {

                const displayNumber =
                    orderNumber ||
                    cjOrderNumber ||
                    "Order received";


                elements.confirmationOrderNumber.innerHTML = `

                    ${svgIcon(
                        "receipt",
                        "confirmation-svg-icon"
                    )}

                    <span>
                        Order #${escapeHTML(
                            displayNumber
                        )}
                    </span>

                `;

            }


            if (
                elements.checkoutLayout
            ) {

                elements.checkoutLayout.style.display =
                    "none";

            }


            if (
                elements.orderConfirmation
            ) {

                elements.orderConfirmation.classList.add(
                    "visible"
                );

            }


            if (
                paymentURL
            ) {

                showSuccess(
                    "Your order was created successfully. Continue to the payment page."
                );


                const confirmation =
                    elements.orderConfirmation;


                if (
                    confirmation
                ) {

                    const existingContinue =
                        confirmation.querySelector(
                            ".continue-shopping"
                        );


                    if (
                        existingContinue
                    ) {

                        existingContinue.href =
                            paymentURL;

                        existingContinue.target =
                            "_self";

                        existingContinue.innerHTML = `

                            ${svgIcon(
                                "payment",
                                "button-svg-icon"
                            )}

                            <span>
                                Continue to Payment
                            </span>

                        `;

                    }

                }

            } else {

                showSuccess(
                    "Your order has been successfully received."
                );

            }


            setStatus(
                ""
            );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Order submission failed:",
                error
            );


            showError(
                error?.message ||
                "Unable to submit your order."
            );


            setStatus(
                ""
            );

        } finally {

            state.submitting =
                false;


            if (
                elements.placeOrderButton
            ) {

                elements.placeOrderButton.dataset.processing =
                    "false";


                const confirmationVisible =
                    elements.orderConfirmation
                        ?.classList.contains(
                            "visible"
                        );


                if (
                    !confirmationVisible
                ) {

                    elements.placeOrderButton.disabled =
                        false;


                    elements.placeOrderButton.innerHTML = `

                        ${svgIcon(
                            "cart",
                            "button-svg-icon"
                        )}

                        <span>
                            Place Order
                        </span>

                    `;

                }

            }

        }

    }


    /* =========================================================================
       21. COUNTRY CODE
       ========================================================================= */

    function bindCountryCode() {

        const input =
            getField(
                "shipping-country-code"
            );


        if (
            !input
        ) {

            return;

        }


        input.addEventListener(
            "input",
            () => {

                input.value =
                    input.value
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
       22. FORM EVENTS
       ========================================================================= */

    function bindFormEvents() {

        if (
            !elements.checkoutForm
        ) {

            return;

        }


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
       23. CART EVENTS
       ========================================================================= */

    function bindCartEvents() {

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
                    loadCheckout();

                }

            }
        );


        window.addEventListener(
            "prasunCartUpdated",
            () => {

                updateCartCount();
                loadCheckout();

            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updateCartCount();
                    loadCheckout();

                }

            }
        );

    }


    /* =========================================================================
       24. INITIALIZATION
       ========================================================================= */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;

        }


        state.initialized =
            true;


        updateCartCount();

        bindCountryCode();
        bindFormEvents();
        bindCartEvents();

        if (
            elements.placeOrderButton
        ) {

            /*
             * Make sure the original button is readable even before
             * JavaScript starts loading dynamic state.
             */

            if (
                !elements.placeOrderButton.textContent.trim()
            ) {

                elements.placeOrderButton.innerHTML = `

                    ${svgIcon(
                        "cart",
                        "button-svg-icon"
                    )}

                    <span>
                        Place Order
                    </span>

                `;

            }

        }


        await loadCheckout();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();

    }

})();
