/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT SYSTEM
 * ============================================================================
 *
 * Production-oriented checkout controller.
 *
 * Responsibilities:
 * - Canonical cart: prasun_cart
 * - Legacy cart migration
 * - Cross-tab cart synchronization
 * - Product/catalog loading
 * - Secure rendering / HTML escaping
 * - Checkout form validation
 * - Country selector
 * - Payment-method UI
 * - Order summary calculation
 * - Cloudflare Worker order submission
 * - Double-submit protection
 * - Accessible status/error messages
 *
 * IMPORTANT:
 * This file intentionally does NOT send raw card numbers, CVV/CVC,
 * or other payment credentials to the PRASUN SHOP Worker.
 *
 * A real payment processor should tokenize/process card information.
 * ============================================================================
 */

"use strict";

(() => {
    /* =========================================================================
       CONFIGURATION
       ========================================================================= */

    const CART_KEY = "prasun_cart";

    const LEGACY_CART_KEYS = [
        "prasunShopCart",
        "cart",
        "prasun_cart_items"
    ];

    /*
     * Your Cloudflare Worker.
     *
     * GET  -> product/catalog data
     * POST -> order submission
     */
    const API_ENDPOINT =
        "https://prasun-shop-api.prasun301.workers.dev/";

    /*
     * Local fallback.
     *
     * Used only when the Worker catalog cannot be loaded.
     */
    const LOCAL_PRODUCTS_ENDPOINT =
        "data/products.json";

    const MAX_QUANTITY = 99;

    const REQUEST_TIMEOUT_MS = 10000;

    /*
     * Do NOT hard-code an 8% tax into the checkout unless this is actually
     * your business/tax rule for every customer.
     *
     * The current checkout therefore displays tax as "Calculated at checkout"
     * unless your backend returns a tax amount.
     */
    const DEFAULT_TAX_RATE = 0;

    const SHIPPING_COST = 0;

    /* =========================================================================
       COUNTRY DATA
       ========================================================================= */

    const COUNTRIES = [
        "Afghanistan",
        "Albania",
        "Algeria",
        "Andorra",
        "Angola",
        "Argentina",
        "Armenia",
        "Australia",
        "Austria",
        "Azerbaijan",
        "Bahamas",
        "Bahrain",
        "Bangladesh",
        "Barbados",
        "Belarus",
        "Belgium",
        "Belize",
        "Benin",
        "Bhutan",
        "Bolivia",
        "Bosnia and Herzegovina",
        "Botswana",
        "Brazil",
        "Brunei",
        "Bulgaria",
        "Cambodia",
        "Cameroon",
        "Canada",
        "Chile",
        "China",
        "Colombia",
        "Costa Rica",
        "Croatia",
        "Cyprus",
        "Czech Republic",
        "Denmark",
        "Dominican Republic",
        "Ecuador",
        "Egypt",
        "El Salvador",
        "Estonia",
        "Ethiopia",
        "Fiji",
        "Finland",
        "France",
        "Georgia",
        "Germany",
        "Ghana",
        "Greece",
        "Guatemala",
        "Honduras",
        "Hong Kong",
        "Hungary",
        "Iceland",
        "India",
        "Indonesia",
        "Ireland",
        "Israel",
        "Italy",
        "Jamaica",
        "Japan",
        "Jordan",
        "Kazakhstan",
        "Kenya",
        "Kuwait",
        "Latvia",
        "Lebanon",
        "Lithuania",
        "Luxembourg",
        "Malaysia",
        "Maldives",
        "Malta",
        "Mauritius",
        "Mexico",
        "Moldova",
        "Monaco",
        "Mongolia",
        "Montenegro",
        "Morocco",
        "Myanmar",
        "Namibia",
        "Nepal",
        "Netherlands",
        "New Zealand",
        "Nicaragua",
        "Nigeria",
        "North Macedonia",
        "Norway",
        "Oman",
        "Pakistan",
        "Panama",
        "Paraguay",
        "Peru",
        "Philippines",
        "Poland",
        "Portugal",
        "Qatar",
        "Romania",
        "Rwanda",
        "Saudi Arabia",
        "Senegal",
        "Serbia",
        "Singapore",
        "Slovakia",
        "Slovenia",
        "South Africa",
        "South Korea",
        "Spain",
        "Sri Lanka",
        "Sweden",
        "Switzerland",
        "Taiwan",
        "Thailand",
        "Tunisia",
        "Turkey",
        "Ukraine",
        "United Arab Emirates",
        "United Kingdom",
        "United States",
        "Uruguay",
        "Uzbekistan",
        "Venezuela",
        "Vietnam",
        "Zambia",
        "Zimbabwe"
    ];

    /* =========================================================================
       DOM
       ========================================================================= */

    const checkoutMain =
        document.getElementById("checkout-main");

    const emptyCart =
        document.getElementById("empty-cart");

    const checkoutForm =
        document.getElementById("checkout-form");

    const cartCount =
        document.getElementById("cart-count");

    const summaryItems =
        document.getElementById("summary-items");

    const summaryCount =
        document.getElementById("summary-count");

    const summarySubtotal =
        document.getElementById("summary-subtotal");

    const summaryShipping =
        document.getElementById("summary-shipping");

    const summaryTax =
        document.getElementById("summary-tax");

    const summaryTotal =
        document.getElementById("summary-total-price");

    const placeOrderButton =
        document.getElementById("btn-place-order");

    const buttonText =
        document.getElementById("btn-text");

    const buttonSpinner =
        document.getElementById("btn-spinner");

    const cardFields =
        document.getElementById("card-fields");

    const paymentRadios =
        document.querySelectorAll(
            'input[name="paymentMethod"]'
        );

    const countryDropdown =
        document.getElementById("country-dropdown");

    const countryTrigger =
        document.getElementById("country-trigger");

    const countryMenu =
        document.getElementById("country-menu");

    const countrySearch =
        document.getElementById("country-search");

    const countryOptions =
        document.getElementById("country-options");

    const countrySelected =
        document.getElementById("country-selected");

    const countryInput =
        document.getElementById("country");

    /* =========================================================================
       STATE
       ========================================================================= */

    let cart = [];

    let productMap = new Map();

    let productsPromise = null;

    let isSubmitting = false;

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
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "$0.00";
        }

        return currencyFormatter.format(amount);
    }

    /* =========================================================================
       SECURITY / HTML ESCAPING
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

        return String(value).replace(
            /[&<>"']/g,
            character => ESCAPE_MAP[character]
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
                localStorage.getItem(
                    CART_KEY
                );

            if (primary) {
                return parseCart(primary);
            }

            for (
                const legacyKey
                of LEGACY_CART_KEYS
            ) {

                const legacy =
                    localStorage.getItem(
                        legacyKey
                    );

                if (!legacy) {
                    continue;
                }

                const migrated =
                    parseCart(legacy);

                if (migrated.length) {

                    localStorage.setItem(
                        CART_KEY,
                        JSON.stringify(migrated)
                    );

                    return migrated;
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

            LEGACY_CART_KEYS.forEach(key => {
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
       REQUEST TIMEOUT
       ========================================================================= */

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

            clearTimeout(timer);

            return response;

        } catch (error) {

            clearTimeout(timer);

            if (
                error &&
                error.name === "AbortError"
            ) {
                throw new Error(
                    "The request timed out. Please check your internet connection and try again."
                );
            }

            throw error;
        }
    }

    /* =========================================================================
       PRODUCT RESPONSE NORMALIZATION
       ========================================================================= */

    function extractProducts(data) {

        if (Array.isArray(data)) {
            return data;
        }

        if (
            data &&
            Array.isArray(data.products)
        ) {
            return data.products;
        }

        if (
            data &&
            Array.isArray(data.data)
        ) {
            return data.data;
        }

        if (
            data &&
            data.data &&
            Array.isArray(data.data.products)
        ) {
            return data.data.products;
        }

        return [];
    }

    /* =========================================================================
       PRODUCT LOADING
       ========================================================================= */

    async function requestProducts(
        endpoint
    ) {

        const response =
            await fetchWithTimeout(
                endpoint,
                {
                    method: "GET",
                    cache: "no-cache",
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

        const products =
            extractProducts(data);

        if (!products.length) {
            throw new Error(
                "No products were returned by the catalog."
            );
        }

        return products;
    }

    async function fetchProducts() {

        if (productMap.size > 0) {
            return productMap;
        }

        if (productsPromise) {
            return productsPromise;
        }

        productsPromise =
            (async () => {

                try {

                    let products = [];

                    /*
                     * First attempt:
                     * Cloudflare Worker / live catalog.
                     */
                    try {

                        products =
                            await requestProducts(
                                API_ENDPOINT
                            );

                    } catch (workerError) {

                        console.warn(
                            "[PRASUN SHOP] Worker catalog unavailable. Trying local catalog.",
                            workerError
                        );

                        /*
                         * Fallback:
                         * local products.json
                         */
                        products =
                            await requestProducts(
                                LOCAL_PRODUCTS_ENDPOINT
                            );
                    }

                    productMap =
                        new Map();

                    products.forEach(
                        product => {

                            if (
                                !product ||
                                product.id ===
                                    undefined ||
                                product.id ===
                                    null
                            ) {
                                return;
                            }

                            productMap.set(
                                String(product.id),
                                product
                            );
                        }
                    );

                    return productMap;

                } catch (error) {

                    productsPromise = null;

                    throw error;
                }
            })();

        return productsPromise;
    }

    /* =========================================================================
       PRODUCT DATA HELPERS
       ========================================================================= */

    function getProductPrice(product) {

        if (!product) {
            return 0;
        }

        const possiblePrices = [
            product.price,
            product.salePrice,
            product.sellingPrice,
            product.minPrice
        ];

        for (
            const candidate
            of possiblePrices
        ) {

            const value =
                Number(candidate);

            if (
                Number.isFinite(value) &&
                value >= 0
            ) {
                return value;
            }
        }

        return 0;
    }

    function getProductName(product) {

        if (!product) {
            return "Product";
        }

        return (
            product.name ||
            product.title ||
            product.productName ||
            "Product"
        );
    }

    function getProductImage(product) {

        if (!product) {
            return "";
        }

        if (
            typeof product.image ===
                "string" &&
            product.image
        ) {
            return product.image;
        }

        if (
            typeof product.imageUrl ===
                "string" &&
            product.imageUrl
        ) {
            return product.imageUrl;
        }

        if (
            Array.isArray(product.images) &&
            product.images.length
        ) {

            const first =
                product.images[0];

            if (
                typeof first === "string"
            ) {
                return first;
            }

            if (
                first &&
                typeof first.url ===
                    "string"
            ) {
                return first.url;
            }
        }

        return "";
    }

    /* =========================================================================
       CART TOTALS
       ========================================================================= */

    function calculateTotals() {

        let subtotal = 0;

        const validItems = [];

        cart.forEach(item => {

            const product =
                productMap.get(
                    String(item.id)
                );

            if (!product) {
                return;
            }

            const price =
                getProductPrice(product);

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

            const lineTotal =
                price * quantity;

            subtotal += lineTotal;

            validItems.push({
                id: String(item.id),
                sku: String(
                    product.sku ||
                    product.id ||
                    item.id
                ),
                name: getProductName(
                    product
                ),
                image: getProductImage(
                    product
                ),
                price,
                quantity,
                subtotal: lineTotal
            });
        });

        const tax =
            subtotal * DEFAULT_TAX_RATE;

        const total =
            subtotal +
            SHIPPING_COST +
            tax;

        return {
            items: validItems,
            subtotal,
            shipping: SHIPPING_COST,
            tax,
            total
        };
    }

    /* =========================================================================
       CART COUNT
       ========================================================================= */

    function updateCartCount() {

        if (!cartCount) {
            return;
        }

        const count =
            cart.reduce(
                (total, item) =>
                    total +
                    Number(
                        item.quantity
                    ),
                0
            );

        if (count > 0) {

            cartCount.textContent =
                String(count);

            cartCount.hidden = false;

        } else {

            cartCount.hidden = true;
        }
    }

    /* =========================================================================
       EMPTY CART
       ========================================================================= */

    function showEmptyCart() {

        if (checkoutMain) {
            checkoutMain.style.display =
                "none";
        }

        if (emptyCart) {
            emptyCart.hidden = false;
        }

        updateCartCount();
    }

    function showCheckout() {

        if (emptyCart) {
            emptyCart.hidden = true;
        }

        if (checkoutMain) {
            checkoutMain.style.display =
                "grid";
        }
    }

    /* =========================================================================
       ORDER SUMMARY
       ========================================================================= */

    function renderSummary() {

        updateCartCount();

        if (!cart.length) {
            showEmptyCart();
            return;
        }

        showCheckout();

        if (!summaryItems) {
            return;
        }

        const totals =
            calculateTotals();

        if (!totals.items.length) {

            summaryItems.innerHTML = `
                <div style="
                    padding:24px 0;
                    text-align:center;
                    color:#64748b;
                    font-size:13px;
                ">
                    Your cart items could not be found.
                </div>
            `;

            if (summaryCount) {
                summaryCount.textContent =
                    "0 Items";
            }

            if (summarySubtotal) {
                summarySubtotal.textContent =
                    "$0.00";
            }

            if (summaryShipping) {
                summaryShipping.textContent =
                    "Free";
            }

            if (summaryTax) {
                summaryTax.textContent =
                    "$0.00";
            }

            if (summaryTotal) {
                summaryTotal.textContent =
                    "$0.00";
            }

            return;
        }

        summaryItems.innerHTML =
            totals.items.map(item => {

                const image =
                    escapeHTML(
                        item.image
                    );

                const name =
                    escapeHTML(
                        item.name
                    );

                return `
                    <div class="summary-item">

                        <div class="summary-image">

                            ${
                                image
                                    ? `
                                        <img
                                            src="${image}"
                                            alt="${name}"
                                            loading="lazy"
                                            decoding="async"
                                        >
                                      `
                                    : `
                                        <div
                                            aria-hidden="true"
                                            style="
                                                color:#94a3b8;
                                                font-size:11px;
                                                text-align:center;
                                            "
                                        >
                                            No image
                                        </div>
                                      `
                            }

                        </div>

                        <div>

                            <p class="summary-product-title">
                                ${name}
                            </p>

                            <p class="summary-product-meta">
                                Qty: ${item.quantity}
                                · ${formatPrice(item.price)} each
                            </p>

                        </div>

                        <div class="summary-item-price">
                            ${formatPrice(item.subtotal)}
                        </div>

                    </div>
                `;
            }).join("");

        if (summaryCount) {

            const count =
                totals.items.reduce(
                    (sum, item) =>
                        sum + item.quantity,
                    0
                );

            summaryCount.textContent =
                `${count} ${count === 1 ? "Item" : "Items"}`;
        }

        if (summarySubtotal) {
            summarySubtotal.textContent =
                formatPrice(
                    totals.subtotal
                );
        }

        if (summaryShipping) {
            summaryShipping.textContent =
                SHIPPING_COST === 0
                    ? "Free"
                    : formatPrice(
                        SHIPPING_COST
                    );
        }

        if (summaryTax) {

            if (DEFAULT_TAX_RATE > 0) {

                summaryTax.textContent =
                    formatPrice(
                        totals.tax
                    );

            } else {

                summaryTax.textContent =
                    "Calculated at checkout";
            }
        }

        if (summaryTotal) {
            summaryTotal.textContent =
                formatPrice(
                    totals.total
                );
        }
    }

    /* =========================================================================
       COUNTRY DROPDOWN
       ========================================================================= */

    function populateCountries(
        filter = ""
    ) {

        if (!countryOptions) {
            return;
        }

        const search =
            String(filter)
                .trim()
                .toLowerCase();

        const filtered =
            COUNTRIES.filter(
                country =>
                    country
                        .toLowerCase()
                        .includes(search)
            );

        if (!filtered.length) {

            countryOptions.innerHTML = `
                <div class="country-no-results">
                    No countries found
                </div>
            `;

            return;
        }

        countryOptions.innerHTML =
            filtered.map(country => {

                const selected =
                    country ===
                    countryInput?.value;

                return `
                    <button
                        type="button"
                        class="country-option ${
                            selected
                                ? "selected"
                                : ""
                        }"
                        data-value="${escapeHTML(country)}"
                        role="option"
                        aria-selected="${
                            selected
                                ? "true"
                                : "false"
                        }"
                    >
                        ${escapeHTML(country)}
                    </button>
                `;
            }).join("");

        countryOptions
            .querySelectorAll(
                ".country-option"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const value =
                            button.dataset.value;

                        if (countryInput) {
                            countryInput.value =
                                value;
                        }

                        if (countrySelected) {
                            countrySelected.textContent =
                                value;
                        }

                        closeCountryDropdown();
                    }
                );
            });
    }

    function openCountryDropdown() {

        if (
            !countryMenu ||
            !countryTrigger
        ) {
            return;
        }

        countryMenu.classList.add("open");

        countryTrigger.classList.add(
            "open"
        );

        countryTrigger.setAttribute(
            "aria-expanded",
            "true"
        );

        if (countrySearch) {
            countrySearch.value = "";
            populateCountries();
            countrySearch.focus();
        }
    }

    function closeCountryDropdown() {

        if (
            !countryMenu ||
            !countryTrigger
        ) {
            return;
        }

        countryMenu.classList.remove(
            "open"
        );

        countryTrigger.classList.remove(
            "open"
        );

        countryTrigger.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function setupCountryDropdown() {

        if (!countryTrigger) {
            return;
        }

        populateCountries();

        countryTrigger.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const open =
                    countryMenu &&
                    countryMenu.classList.contains(
                        "open"
                    );

                if (open) {
                    closeCountryDropdown();
                } else {
                    openCountryDropdown();
                }
            }
        );

        if (countrySearch) {

            countrySearch.addEventListener(
                "input",
                event => {
                    populateCountries(
                        event.target.value
                    );
                }
            );
        }

        document.addEventListener(
            "click",
            event => {

                if (
                    countryDropdown &&
                    !countryDropdown.contains(
                        event.target
                    )
                ) {
                    closeCountryDropdown();
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {
                    closeCountryDropdown();
                }
            }
        );
    }

    /* =========================================================================
       PAYMENT METHOD UI
       ========================================================================= */

    function updatePaymentUI() {

        const selected =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            );

        if (!selected) {
            return;
        }

        /*
         * Card fields remain visible for now because the visual checkout
         * contains them.
         *
         * IMPORTANT:
         * They are NOT read or transmitted by this script.
         *
         * A production payment integration should replace these fields with
         * the payment processor's secure hosted/tokenized UI.
         */
        if (cardFields) {

            if (
                selected.value ===
                "card"
            ) {

                cardFields.style.display =
                    "grid";

            } else {

                cardFields.style.display =
                    "none";
            }
        }
    }

    function setupPaymentMethods() {

        paymentRadios.forEach(
            radio => {

                radio.addEventListener(
                    "change",
                    updatePaymentUI
                );
            }
        );

        updatePaymentUI();
    }

    /* =========================================================================
       INPUT FORMATTING
       ========================================================================= */

    function setupCardFormatting() {

        const cardNumber =
            document.getElementById(
                "card-number"
            );

        const cardExpiry =
            document.getElementById(
                "card-exp"
            );

        const cardCVC =
            document.getElementById(
                "card-cvc"
            );

        /*
         * Formatting only.
         *
         * These values are intentionally never submitted to the Worker.
         */

        if (cardNumber) {

            cardNumber.addEventListener(
                "input",
                event => {

                    let value =
                        event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 16);

                    event.target.value =
                        value.replace(
                            /(.{4})/g,
                            "$1 "
                        ).trim();
                }
            );
        }

        if (cardExpiry) {

            cardExpiry.addEventListener(
                "input",
                event => {

                    let value =
                        event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);

                    if (
                        value.length > 2
                    ) {

                        value =
                            `${value.slice(0, 2)} / ${value.slice(2)}`;
                    }

                    event.target.value =
                        value;
                }
            );
        }

        if (cardCVC) {

            cardCVC.addEventListener(
                "input",
                event => {

                    event.target.value =
                        event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);
                }
            );
        }
    }

    /* =========================================================================
       ERROR HANDLING
       ========================================================================= */

    function showFormError(
        message
    ) {

        let banner =
            document.getElementById(
                "checkout-error-banner"
            );

        if (!banner && checkoutForm) {

            banner =
                document.createElement(
                    "div"
                );

            banner.id =
                "checkout-error-banner";

            banner.setAttribute(
                "role",
                "alert"
            );

            banner.setAttribute(
                "aria-live",
                "assertive"
            );

            banner.style.cssText = `
                margin-bottom:20px;
                padding:13px 14px;
                border:1px solid #fecaca;
                border-radius:10px;
                background:#fef2f2;
                color:#b91c1c;
                font-size:13px;
                font-weight:600;
            `;

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
       FIELD VALIDATION
       ========================================================================= */

    function clearFieldError(
        input
    ) {

        if (!input) {
            return;
        }

        input.classList.remove(
            "invalid"
        );

        const error =
            document.getElementById(
                `${input.id}-error`
            );

        if (error) {
            error.classList.remove(
                "show"
            );
        }
    }

    function markFieldInvalid(
        input
    ) {

        if (!input) {
            return;
        }

        input.classList.add(
            "invalid"
        );

        const error =
            document.getElementById(
                `${input.id}-error`
            );

        if (error) {
            error.classList.add(
                "show"
            );
        }
    }

    function validateRequiredField(
        id,
        message
    ) {

        const input =
            document.getElementById(id);

        if (!input) {
            return true;
        }

        const valid =
            input.value.trim().length > 0;

        if (!valid) {

            markFieldInvalid(
                input
            );

            if (
                message
            ) {
                const error =
                    document.getElementById(
                        `${id}-error`
                    );

                if (error) {
                    error.textContent =
                        message;
                }
            }

        } else {

            clearFieldError(
                input
            );
        }

        return valid;
    }

    function validateEmail() {

        const input =
            document.getElementById(
                "email"
            );

        if (!input) {
            return true;
        }

        const value =
            input.value.trim();

        const valid =
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
                .test(value);

        if (!valid) {
            markFieldInvalid(
                input
            );
        } else {
            clearFieldError(
                input
            );
        }

        return valid;
    }

    function validatePhone() {

        const input =
            document.getElementById(
                "phone"
            );

        if (!input) {
            return true;
        }

        const digits =
            input.value.replace(
                /\D/g,
                ""
            );

        const valid =
            digits.length >= 7 &&
            digits.length <= 15;

        if (!valid) {
            markFieldInvalid(
                input
            );
        } else {
            clearFieldError(
                input
            );
        }

        return valid;
    }

    function validateCountry() {

        if (!countryInput) {
            return true;
        }

        const valid =
            countryInput.value.trim()
                .length > 0;

        if (
            !valid &&
            countryTrigger
        ) {

            countryTrigger.classList.add(
                "invalid"
            );

        } else if (
            countryTrigger
        ) {

            countryTrigger.classList.remove(
                "invalid"
            );
        }

        return valid;
    }

    function validateForm() {

        let valid = true;

        hideFormError();

        if (
            !validateEmail()
        ) {
            valid = false;
        }

        if (
            !validatePhone()
        ) {
            valid = false;
        }

        const requiredFields = [
            [
                "first-name",
                "Please enter your first name."
            ],
            [
                "last-name",
                "Please enter your last name."
            ],
            [
                "address",
                "Please enter your street address."
            ],
            [
                "city",
                "Please enter your city."
            ],
            [
                "postal-code",
                "Please enter your postal or ZIP code."
            ]
        ];

        requiredFields.forEach(
            ([id, message]) => {

                if (
                    !validateRequiredField(
                        id,
                        message
                    )
                ) {
                    valid = false;
                }
            }
        );

        if (
            !validateCountry()
        ) {
            valid = false;
        }

        /*
         * We intentionally do NOT validate or transmit raw card details here.
         *
         * Payment processor integration must be implemented separately.
         */

        return valid;
    }

    /* =========================================================================
       FIELD ERROR CLEARING
       ========================================================================= */

    function setupFieldListeners() {

        if (!checkoutForm) {
            return;
        }

        checkoutForm
            .querySelectorAll(
                ".form-input"
            )
            .forEach(input => {

                input.addEventListener(
                    "input",
                    () => {
                        clearFieldError(
                            input
                        );
                        hideFormError();
                    }
                );
            });
    }

    /* =========================================================================
       SUBMIT BUTTON STATE
       ========================================================================= */

    function setSubmitting(
        submitting
    ) {

        isSubmitting =
            submitting;

        if (!placeOrderButton) {
            return;
        }

        placeOrderButton.disabled =
            submitting;

        if (submitting) {

            if (buttonText) {
                buttonText.textContent =
                    "Processing Order...";
            }

            if (buttonSpinner) {
                buttonSpinner.hidden =
                    false;
            }

        } else {

            if (buttonText) {
                buttonText.textContent =
                    "Place Order";
            }

            if (buttonSpinner) {
                buttonSpinner.hidden =
                    true;
            }
        }
    }

    /* =========================================================================
       ORDER PAYLOAD
       ========================================================================= */

    function buildOrderPayload(
        totals
    ) {

        const firstName =
            String(
                document.getElementById(
                    "first-name"
                )?.value || ""
            ).trim();

        const lastName =
            String(
                document.getElementById(
                    "last-name"
                )?.value || ""
            ).trim();

        const email =
            String(
                document.getElementById(
                    "email"
                )?.value || ""
            ).trim();

        const phone =
            String(
                document.getElementById(
                    "phone"
                )?.value || ""
            ).trim();

        const address =
            String(
                document.getElementById(
                    "address"
                )?.value || ""
            ).trim();

        const city =
            String(
                document.getElementById(
                    "city"
                )?.value || ""
            ).trim();

        const postalCode =
            String(
                document.getElementById(
                    "postal-code"
                )?.value || ""
            ).trim();

        const country =
            String(
                countryInput?.value || ""
            ).trim();

        const paymentMethod =
            String(
                document.querySelector(
                    'input[name="paymentMethod"]:checked'
                )?.value || ""
            );

        const customerName =
            `${firstName} ${lastName}`
                .replace(/\s+/g, " ")
                .trim();

        /*
         * This is the safe order payload.
         *
         * No card number.
         * No CVC.
         * No CVV.
         */

        return {
            customerName,

            firstName,
            lastName,

            email,
            phone,

            shippingAddress: {
                address,
                city,
                postalCode,
                country
            },

            /*
             * Keep "address" at top level as well for compatibility with
             * an existing Worker that expects the older structure.
             */
            address,
            city,
            postalCode,
            country,

            paymentMethod,

            cart: totals.items.map(
                item => ({
                    id: item.id,
                    sku: item.sku,
                    name: item.name,
                    price: Number(
                        item.price.toFixed(2)
                    ),
                    quantity: item.quantity
                })
            ),

            subtotal: Number(
                totals.subtotal.toFixed(2)
            ),

            shipping: Number(
                totals.shipping.toFixed(2)
            ),

            tax: Number(
                totals.tax.toFixed(2)
            ),

            total: Number(
                totals.total.toFixed(2)
            ),

            currency: "USD"
        };
    }

    /* =========================================================================
       ORDER SUBMISSION
       ========================================================================= */

    async function submitOrder() {

        if (isSubmitting) {
            return;
        }

        cart = getCart();

        if (!cart.length) {

            showFormError(
                "Your cart is empty."
            );

            setTimeout(() => {
                window.location.href =
                    "cart.html";
            }, 1200);

            return;
        }

        if (!validateForm()) {

            const firstInvalid =
                document.querySelector(
                    ".form-input.invalid"
                );

            if (firstInvalid) {

                firstInvalid.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                firstInvalid.focus();
            }

            return;
        }

        setSubmitting(true);

        try {

            await fetchProducts();

            /*
             * Re-read cart immediately before submission.
             * This prevents submitting stale cart data.
             */
            cart = getCart();

            if (!cart.length) {
                throw new Error(
                    "Your cart is empty."
                );
            }

            const totals =
                calculateTotals();

            if (!totals.items.length) {

                throw new Error(
                    "No valid products were found in your cart."
                );
            }

            const payload =
                buildOrderPayload(
                    totals
                );

            console.log(
                "[PRASUN SHOP] Submitting order:",
                {
                    ...payload,
                    /*
                     * Nothing sensitive should be here.
                     */
                }
            );

            const response =
                await fetchWithTimeout(
                    API_ENDPOINT,
                    {
                        method: "POST",

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

            const responseText =
                await response.text();

            let responseData = null;

            try {

                responseData =
                    responseText
                        ? JSON.parse(
                            responseText
                        )
                        : null;

            } catch (_) {

                responseData = null;
            }

            if (!response.ok) {

                const serverMessage =
                    responseData &&
                    (
                        responseData.error ||
                        responseData.message
                    );

                throw new Error(
                    serverMessage ||
                    `Order server returned HTTP ${response.status}.`
                );
            }

            /*
             * If your Worker explicitly returns:
             *
             * { success: false, ... }
             *
             * do not clear the cart.
             */
            if (
                responseData &&
                responseData.success === false
            ) {

                throw new Error(
                    responseData.message ||
                    responseData.error ||
                    "The order could not be completed."
                );
            }

            console.log(
                "[PRASUN SHOP] Order submitted successfully:",
                responseData
            );

            /*
             * Store order information for the success page.
             *
             * Do not store payment credentials.
             */
            try {

                sessionStorage.setItem(
                    "prasun_last_order",
                    JSON.stringify({
                        orderId:
                            responseData?.orderId ||
                            responseData?.id ||
                            "",

                        customerName:
                            payload.customerName,

                        email:
                            payload.email,

                        total:
                            payload.total,

                        currency:
                            payload.currency
                    })
                );

            } catch (storageError) {

                console.warn(
                    "[PRASUN SHOP] Could not save order session:",
                    storageError
                );
            }

            /*
             * Clear cart only after the Worker confirms success.
             */
            clearCart();

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

            window.location.href =
                "order-success.html";

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Order submission failed:",
                error
            );

            showFormError(
                error?.message ||
                "Something went wrong while placing your order. Please try again."
            );

            setSubmitting(false);
        }
    }

    /* =========================================================================
       PLACE ORDER BUTTON
       ========================================================================= */

    function setupPlaceOrderButton() {

        if (!placeOrderButton) {
            return;
        }

        placeOrderButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                submitOrder();
            }
        );
    }

    /* =========================================================================
       FORM SUBMIT FALLBACK
       ========================================================================= */

    function setupFormSubmit() {

        if (!checkoutForm) {
            return;
        }

        checkoutForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                submitOrder();
            }
        );
    }

    /* =========================================================================
       CROSS-TAB SYNCHRONIZATION
       ========================================================================= */

    window.addEventListener(
        "storage",
        event => {

            if (
                event.key === CART_KEY ||
                LEGACY_CART_KEYS.includes(
                    event.key
                )
            ) {

                cart = getCart();

                /*
                 * Re-render using the existing product map if possible.
                 */
                if (
                    productMap.size > 0
                ) {

                    renderSummary();

                } else {

                    loadCheckout();
                }
            }
        }
    );

    /* =========================================================================
       CUSTOM CART EVENT
       ========================================================================= */

    window.addEventListener(
        "prasunCartUpdated",
        () => {

            cart = getCart();

            loadCheckout();
        }
    );

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    async function loadCheckout() {

        cart = getCart();

        updateCartCount();

        if (!cart.length) {

            showEmptyCart();

            return;
        }

        try {

            await fetchProducts();

            renderSummary();

        } catch (error) {

            console.error(
                "[PRASUN SHOP] Checkout initialization error:",
                error
            );

            showFormError(
                "We could not load your cart products. Please refresh the page and try again."
            );

            /*
             * Keep checkout visible so the user can retry.
             */
            showCheckout();
        }
    }

    function initialize() {

        setupCountryDropdown();

        setupPaymentMethods();

        setupCardFormatting();

        setupFieldListeners();

        setupPlaceOrderButton();

        setupFormSubmit();

        loadCheckout();
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
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();
