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
 * Worker routes used:
 *
 *     GET  /api/health
 *     GET  /api/products
 *     GET  /api/products?pid=XXXX
 *     POST /api/order
 *
 * Supplier:
 *     CJ Dropshipping
 *
 * IMPORTANT:
 * - No CJ API credentials are stored in this file.
 * - Browser never calls CJ directly.
 * - Browser prices are display values only.
 * - Worker must validate price, stock, variant and supplier data again.
 * - CJ order creation happens server-side.
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
            15000

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

        cart: [],

        products: new Map(),

        loading:
            false,

        submitting:
            false,

        initialized:
            false

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
            value ??
            ""
        ).trim();

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ??
            ""
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


    function getMaterialIcon(
        name,
        className = "icon-sm"
    ) {

        return `

            <span
                class="material-symbols-rounded ${className}"
                aria-hidden="true"
            >
                ${escapeHTML(
                    name
                )}
            </span>

        `;

    }


    function getWorkerURL(
        endpoint
    ) {

        return (
            `${CONFIG.WORKER_BASE}${endpoint}`
        );

    }


    /* =========================================================================
       6. STORAGE
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
       7. CART NORMALIZATION
       ========================================================================= */

    function normalizeCartItem(
        item
    ) {

        if (
            !item ||
            typeof item !==
                "object"
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
            const key
            of CONFIG.LEGACY_CART_KEYS
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
            const key
            of CONFIG.LEGACY_CART_KEYS
        ) {

            removeStorage(
                key
            );

        }

    }


    /* =========================================================================
       8. CART COUNT
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
            count <=
            0;


        elements.cartCount.setAttribute(
            "aria-label",
            `${count} ${
                count ===
                    1
                    ? "item"
                    : "items"
            } in cart`
        );

    }


    /* =========================================================================
       9. FETCH WITH TIMEOUT
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
       10. ERROR / STATUS UI
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

        }


        if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.classList.remove(
                "visible"
            );

        }


        if (
            elements.checkoutError
        ) {

            elements.checkoutError.scrollIntoView(
                {
                    behavior:
                        "smooth",

                    block:
                        "nearest"
                }
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

        if (
            elements.checkoutSuccessMessage
        ) {

            elements.checkoutSuccessMessage.textContent =
                cleanString(
                    message
                );

        } else if (
            elements.checkoutSuccess
        ) {

            elements.checkoutSuccess.textContent =
                message;

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


        elements.checkoutStatus.innerHTML =
            loading

                ? `

                    ${getMaterialIcon(
                        "progress_activity",
                        "icon-sm"
                    )}

                    <span>
                        ${escapeHTML(
                            message ||
                            ""
                        )}
                    </span>

                `

                : escapeHTML(
                    message ||
                    ""
                );

    }


    /* =========================================================================
       11. FORM HELPERS
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
       12. FORM VALIDATION
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
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
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
            !/^[A-Z]{2}$/
                .test(
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
       13. PRODUCT FETCH
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
            data?.success !==
                true ||
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
       14. REFRESH CART PRODUCTS
       ========================================================================= */

    async function refreshCartProducts() {

        const cart =
            getCart();


        if (
            !cart.length
        ) {

            return [];

        }


        const refreshed =
            [];


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


            let selectedVariant = null;


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
                    normalizedProduct.variants
                        .find(
                            variant =>
                                String(
                                    variant.vid
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
                    normalizedProduct.variants
                        .find(
                            variant =>
                                String(
                                    variant.sku ||
                                    ""
                                ).toLowerCase() ===
                                selectedVariantSku
                                    .toLowerCase()
                        ) ||
                    null;

            }


            /*
             * If cart has a selected variant but it is no longer
             * present, do not silently change it to another variant.
             */

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


            /*
             * Prefer fresh variant price when selected.
             */

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


            /*
             * Quantity validation.
             */

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
                        currentInventory ===
                            1
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
       15. SUMMARY RENDERING
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
                (
                    entry
                ) => {

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
                            entry.cartItem
                                .variantOptions
                        ) ||
                        cleanString(
                            entry.cartItem
                                .variantSku
                        );


                    return `

                        <div
                            class="summary-item"
                        >

                            <div
                                class="summary-item-image-wrap"
                            >

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
                                                class="summary-item-image"
                                                aria-hidden="true"
                                            ></div>

                                        `
                                }


                                <span
                                    class="summary-item-quantity"
                                    aria-label="Quantity ${quantity}"
                                >
                                    ${quantity}
                                </span>

                            </div>


                            <div
                                class="summary-item-info"
                            >

                                <p
                                    class="summary-item-name"
                                >
                                    ${name}
                                </p>


                                <div
                                    class="summary-item-meta"
                                >

                                    <span>
                                        ${getMaterialIcon(
                                            "inventory_2",
                                            "icon-xs"
                                        )}
                                        ${formatPrice(
                                            entry.price
                                        )}
                                    </span>

                                    ${
                                        variantText

                                            ? `

                                                <span>
                                                    ${getMaterialIcon(
                                                        "tune",
                                                        "icon-xs"
                                                    )}
                                                    ${escapeHTML(
                                                        variantText
                                                    )}
                                                </span>

                                            `

                                            : ""
                                    }

                                </div>

                            </div>


                            <div
                                class="summary-item-price"
                            >
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

                <span
                    class="summary-empty-icon"
                    aria-hidden="true"
                >

                    ${getMaterialIcon(
                        "shopping_cart",
                        "icon-xl"
                    )}

                </span>


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
       16. LOAD CHECKOUT
       ========================================================================= */

    async function loadCheckout() {

        if (
            state.loading
        ) {

            return;

        }


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

                    ${getMaterialIcon(
                        "progress_activity",
                        "icon-xl"
                    )}

                    <p>
                        Loading your order...
                    </p>

                </div>

            `;

        }


        try {

            const refreshedItems =
                await refreshCartProducts();


            state.refreshedItems =
                refreshedItems;


            renderOrderSummary(
                refreshedItems
            );


            if (
                elements.placeOrderButton
            ) {

                elements.placeOrderButton.disabled =
                    false;

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

                        ${getMaterialIcon(
                            "error",
                            "icon-xl"
                        )}

                        <p>
                            Unable to load current product information.
                        </p>

                        <button
                            type="button"
                            id="retry-checkout-button"
                            class="continue-shopping"
                        >
                            ${getMaterialIcon(
                                "refresh",
                                "icon-sm"
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

                        }
                    );

            }


        } finally {

            state.loading =
                false;

        }

    }


    /* =========================================================================
       17. VALIDATE CHECKOUT ITEMS AGAIN
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
       18. BUILD ORDER PAYLOAD
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


                    /*
                     * Preserve the CJ VID when available.
                     */

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

                        /*
                         * Storefront product identifiers
                         */

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


                        /*
                         * CJ identification
                         */

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

                        vid:

                            vid,


                        variantId:
                            vid,


                        variantSku:
                            variantSku,


                        variantOptions:
                            cleanString(
                                cartItem.variantOptions
                            ),


                        /*
                         * Display/reference information
                         */

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


                        /*
                         * Quantity only.
                         * Worker remains authoritative for price.
                         */

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


            items:


                items,


            /*
             * Backward compatibility.
             * The Worker can ignore this if the new items
             * array is its canonical source.
             */

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
       19. PLACE ORDER
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

                ${getMaterialIcon(
                    "progress_activity",
                    "icon-md"
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


            /*
             * Re-fetch products immediately before submission.
             */

            const refreshedItems =
                await validateCheckoutItems();


            /*
             * Build a clean server-side order payload.
             */

            const payload =
                buildOrderPayload(
                    customer,
                    refreshedItems
                );


            /*
             * Save a local checkout snapshot.
             *
             * This contains no CJ credentials.
             */

            writeStorage(
                CONFIG.CHECKOUT_SNAPSHOT_KEY,
                JSON.stringify(
                    {
                        version:
                            1,

                        createdAt:
                            new Date()
                                .toISOString(),

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
                data?.success !==
                    true
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    "The order was not accepted."
                );

            }


            /*
             * The Worker may return different identifiers
             * depending on the CJ order flow.
             */

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


            /*
             * Store minimal confirmation information.
             */

            try {

                sessionStorage.setItem(

                    "prasun_order_confirmation",

                    JSON.stringify(
                        {

                            orderNumber:
                                orderNumber,

                            cjOrderNumber:
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
                    "[PRASUN SHOP] Unable to store order confirmation:",
                    error
                );

            }


            /*
             * Clear cart only after Worker accepts the order.
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
             * Confirmation number
             */

            if (
                elements.confirmationOrderNumber
            ) {

                const displayNumber =
                    orderNumber ||
                    cjOrderNumber ||
                    "Order received";


                elements.confirmationOrderNumber.innerHTML = `

                    ${getMaterialIcon(
                        "receipt_long",
                        "icon-sm"
                    )}

                    <span>
                        Order #${escapeHTML(
                            displayNumber
                        )}
                    </span>

                `;

            }


            /*
             * Hide layout and show confirmation.
             */

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


                /*
                 * Replace the confirmation shopping button
                 * with a payment link without exposing credentials.
                 */

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

                        existingContinue.innerHTML = `

                            ${getMaterialIcon(
                                "payments",
                                "icon-sm"
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


                /*
                 * Do not re-enable if confirmation is being shown.
                 */

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

                        ${getMaterialIcon(
                            "shopping_cart_checkout",
                            "icon-md"
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
       20. COUNTRY CODE
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
       21. FORM FIELD EVENTS
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
       22. CART EVENTS
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
       23. INITIALIZATION
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
