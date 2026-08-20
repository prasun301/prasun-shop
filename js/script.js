/**
 * ============================================================================
 * PRASUN SHOP — CLOUDFLARE WORKER
 * ============================================================================
 *
 * AliExpress-only storefront backend
 *
 * FEATURES
 * --------
 * - Loads products from /products.json
 * - Provides GET /api/products
 * - Provides GET /api/products/:id
 * - Provides POST /api/order
 * - Server-side product/price validation
 * - CORS support
 * - Security headers
 * - Order number generation
 *
 * IMPORTANT
 * ---------
 * This Worker does NOT connect to AliExpress automatically.
 *
 * AliExpress is used as the supplier.
 * Orders received here must be fulfilled manually through AliExpress
 * unless you later add an AliExpress-compatible ordering integration.
 *
 * NO CJ DROPSHIPPING COMPONENTS ARE USED.
 * ============================================================================
 */

"use strict";

/* ============================================================================
   CONFIGURATION
   ============================================================================ */

const CONFIG = {
    SHOP_ORIGIN: "https://shop.prasunbarua.com",

    /*
     * IMPORTANT:
     * Products are loaded from the same storefront origin.
     *
     * If products.json is located at:
     * https://shop.prasunbarua.com/products.json
     *
     * this URL is correct.
     */
    PRODUCTS_URL: "https://shop.prasunbarua.com/products.json",

    MAX_PRODUCTS: 1000,

    MAX_QUANTITY: 99,

    MAX_ORDER_ITEMS: 50,

    MAX_NAME_LENGTH: 100,

    MAX_EMAIL_LENGTH: 150,

    MAX_PHONE_LENGTH: 40,

    MAX_ADDRESS_LENGTH: 500,

    MAX_CITY_LENGTH: 100,

    MAX_PROVINCE_LENGTH: 100,

    MAX_COUNTRY_LENGTH: 100,

    MAX_COUNTRY_CODE_LENGTH: 2,

    MAX_ZIP_LENGTH: 30,

    MAX_NOTE_LENGTH: 1000,

    REQUEST_TIMEOUT_MS: 15000
};


/* ============================================================================
   CORS
   ============================================================================ */

const ALLOWED_ORIGINS = new Set([
    "https://shop.prasunbarua.com"
]);


function getAllowedOrigin(request) {
    const origin = request.headers.get("Origin");

    if (origin && ALLOWED_ORIGINS.has(origin)) {
        return origin;
    }

    return CONFIG.SHOP_ORIGIN;
}


function corsHeaders(request) {
    return {
        "Access-Control-Allow-Origin": getAllowedOrigin(request),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
}


/* ============================================================================
   SECURITY HEADERS
   ============================================================================ */

function securityHeaders() {
    return {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "SAMEORIGIN",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    };
}


/* ============================================================================
   RESPONSE HELPERS
   ============================================================================ */

function jsonResponse(
    data,
    status = 200,
    request = null,
    extraHeaders = {}
) {
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",

        ...(request
            ? corsHeaders(request)
            : {}),

        ...securityHeaders(),

        ...extraHeaders
    };

    return new Response(
        JSON.stringify(data, null, 2),
        {
            status,
            headers
        }
    );
}


function errorResponse(
    message,
    status = 400,
    request = null,
    extra = {}
) {
    return jsonResponse(
        {
            success: false,
            error: message,
            ...extra
        },
        status,
        request
    );
}


/* ============================================================================
   FETCH WITH TIMEOUT
   ============================================================================ */

async function fetchWithTimeout(
    resource,
    options = {},
    timeout = CONFIG.REQUEST_TIMEOUT_MS
) {
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {
        return await fetch(
            resource,
            {
                ...options,
                signal: controller.signal
            }
        );
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(
                "The product catalog request timed out."
            );
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
}


/* ============================================================================
   LOAD PRODUCTS.JSON
   ============================================================================ */

async function loadProducts() {
    const response = await fetchWithTimeout(
        CONFIG.PRODUCTS_URL,
        {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },

            /*
             * Prevent stale catalog data.
             */
            cf: {
                cacheEverything: false
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `products.json returned HTTP ${response.status}.`
        );
    }

    const text = await response.text();

    if (!text.trim()) {
        throw new Error(
            "products.json is empty."
        );
    }

    let products;

    try {
        products = JSON.parse(text);
    } catch (error) {
        throw new Error(
            "products.json contains invalid JSON."
        );
    }

    if (!Array.isArray(products)) {
        throw new Error(
            "products.json must contain a JSON array."
        );
    }

    return products;
}


/* ============================================================================
   PRODUCT NORMALIZATION
   ============================================================================ */

function normalizeProduct(product) {
    if (
        !product ||
        typeof product !== "object"
    ) {
        return null;
    }

    const id = String(
        product.id ?? ""
    ).trim();

    const aliexpressId = String(
        product.aliexpress_id ?? ""
    ).trim();

    const sku = String(
        product.sku ?? ""
    ).trim();

    const name = String(
        product.name ?? ""
    ).trim();

    const category = String(
        product.category ?? "Uncategorized"
    ).trim();

    const description = String(
        product.description ?? ""
    ).trim();

    const image = String(
        product.image ?? ""
    ).trim();

    const price = Number(
        product.price
    );

    const rating = Number(
        product.rating
    );

    /*
     * Required fields
     */
    if (
        !id ||
        !aliexpressId ||
        !sku ||
        !name ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        return null;
    }

    const features = Array.isArray(
        product.features
    )
        ? product.features
            .map(item => String(item).trim())
            .filter(Boolean)
        : [];

    const specifications =
        product.specifications &&
        typeof product.specifications === "object"
            ? product.specifications
            : {};

    return {
        id,

        aliexpress_id:
            aliexpressId,

        sku,

        name,

        category,

        price:
            Number(
                price.toFixed(2)
            ),

        rating:
            Number.isFinite(rating)
                ? Math.min(
                    5,
                    Math.max(
                        0,
                        rating
                    )
                )
                : 0,

        image,

        description,

        features,

        specifications
    };
}


/* ============================================================================
   GET NORMALIZED PRODUCTS
   ============================================================================ */

async function getProducts() {
    const rawProducts = await loadProducts();

    const products = rawProducts
        .map(normalizeProduct)
        .filter(Boolean)
        .slice(0, CONFIG.MAX_PRODUCTS);

    return products;
}


/* ============================================================================
   PRODUCT SEARCH
   ============================================================================ */

function searchProducts(
    products,
    keyword
) {
    const term = String(
        keyword || ""
    )
        .trim()
        .toLowerCase();

    if (!term) {
        return products;
    }

    return products.filter(product => {
        const searchable = [
            product.id,
            product.sku,
            product.aliexpress_id,
            product.name,
            product.category,
            product.description,
            ...(product.features || [])
        ]
            .join(" ")
            .toLowerCase();

        return searchable.includes(term);
    });
}


/* ============================================================================
   PRODUCT ENDPOINT
   ============================================================================ */

async function handleProducts(
    request,
    url
) {
    try {
        let products = await getProducts();

        /*
         * Optional keyword search.
         *
         * Example:
         *
         * /api/products?keyword=solar
         */
        const keyword = url.searchParams.get("keyword");

        if (keyword) {
            products = searchProducts(
                products,
                keyword
            );
        }

        /*
         * GET /api/products/:id
         */
        if (
            url.pathname.startsWith(
                "/api/products/"
            )
        ) {
            const prefix = "/api/products/";

            const productId =
                decodeURIComponent(
                    url.pathname.slice(
                        prefix.length
                    )
                );

            if (!productId) {
                return errorResponse(
                    "Product ID is required.",
                    400,
                    request
                );
            }

            const product =
                products.find(
                    item =>
                        item.id === productId
                );

            if (!product) {
                return errorResponse(
                    "Product not found.",
                    404,
                    request
                );
            }

            return jsonResponse(
                {
                    success: true,
                    product
                },
                200,
                request
            );
        }

        /*
         * GET /api/products
         */
        return jsonResponse(
            {
                success: true,
                count: products.length,
                products
            },
            200,
            request
        );

    } catch (error) {
        console.error(
            "[PRASUN SHOP] Product catalog error:",
            error
        );

        return errorResponse(
            "Unable to load the product catalog.",
            500,
            request,
            {
                details:
                    error?.message ||
                    "Unknown catalog error."
            }
        );
    }
}


/* ============================================================================
   JSON REQUEST BODY
   ============================================================================ */

async function readJsonBody(request) {
    const contentType =
        request.headers.get("Content-Type") || "";

    if (
        !contentType
            .toLowerCase()
            .includes("application/json")
    ) {
        throw new Error(
            "Request must use Content-Type: application/json."
        );
    }

    const text = await request.text();

    if (!text.trim()) {
        throw new Error(
            "Request body is empty."
        );
    }

    if (text.length > 100000) {
        throw new Error(
            "Request body is too large."
        );
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            "Invalid JSON request body."
        );
    }
}


/* ============================================================================
   STRING CLEANING
   ============================================================================ */

function cleanString(
    value,
    maxLength
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}


/* ============================================================================
   VALIDATION
   ============================================================================ */

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}


function isValidCountryCode(code) {
    return /^[A-Z]{2}$/.test(
        code
    );
}


function isValidPhone(phone) {
    return /^[0-9+()\-\s]{7,40}$/.test(
        phone
    );
}


/* ============================================================================
   CUSTOMER VALIDATION
   ============================================================================ */

function validateCustomer(body) {
    const customerName = cleanString(
        body.customerName ?? body.name,
        CONFIG.MAX_NAME_LENGTH
    );

    const email = cleanString(
        body.email,
        CONFIG.MAX_EMAIL_LENGTH
    ).toLowerCase();

    const phone = cleanString(
        body.phone,
        CONFIG.MAX_PHONE_LENGTH
    );

    const address = cleanString(
        body.address,
        CONFIG.MAX_ADDRESS_LENGTH
    );

    const address2 = cleanString(
        body.address2,
        CONFIG.MAX_ADDRESS_LENGTH
    );

    const city = cleanString(
        body.shippingCity ??
        body.city,
        CONFIG.MAX_CITY_LENGTH
    );

    const province = cleanString(
        body.shippingProvince ??
        body.province ??
        body.state,
        CONFIG.MAX_PROVINCE_LENGTH
    );

    const country = cleanString(
        body.shippingCountry ??
        body.country,
        CONFIG.MAX_COUNTRY_LENGTH
    );

    const countryCode = cleanString(
        body.shippingCountryCode ??
        body.countryCode,
        CONFIG.MAX_COUNTRY_CODE_LENGTH
    ).toUpperCase();

    const zip = cleanString(
        body.shippingZip ??
        body.zip ??
        body.postalCode,
        CONFIG.MAX_ZIP_LENGTH
    );

    const remark = cleanString(
        body.remark ??
        body.orderNote ??
        body.note,
        CONFIG.MAX_NOTE_LENGTH
    );

    if (!customerName) {
        throw new Error(
            "Full name is required."
        );
    }

    if (
        !email ||
        !isValidEmail(email)
    ) {
        throw new Error(
            "A valid email address is required."
        );
    }

    if (
        !phone ||
        !isValidPhone(phone)
    ) {
        throw new Error(
            "A valid phone number is required."
        );
    }

    if (!address) {
        throw new Error(
            "Shipping address is required."
        );
    }

    if (!city) {
        throw new Error(
            "City is required."
        );
    }

    if (!province) {
        throw new Error(
            "State / Province is required."
        );
    }

    if (!country) {
        throw new Error(
            "Country is required."
        );
    }

    if (
        !countryCode ||
        !isValidCountryCode(countryCode)
    ) {
        throw new Error(
            "A valid two-letter country code is required."
        );
    }

    return {
        customerName,
        email,
        phone,
        address,
        address2,
        shippingCity: city,
        shippingProvince: province,
        shippingCountry: country,
        shippingCountryCode: countryCode,
        shippingZip: zip,
        remark
    };
}


/* ============================================================================
   ORDER ITEM NORMALIZATION
   ============================================================================ */

function normalizeOrderItem(item) {
    if (
        !item ||
        typeof item !== "object"
    ) {
        return null;
    }

    const id = cleanString(
        item.id,
        100
    );

    const quantityNumber =
        Number(item.quantity);

    if (
        !id ||
        !Number.isFinite(quantityNumber)
    ) {
        return null;
    }

    if (
        quantityNumber < 1
    ) {
        return null;
    }

    if (
        quantityNumber > CONFIG.MAX_QUANTITY
    ) {
        return null;
    }

    const quantity = Math.floor(
        quantityNumber
    );

    return {
        id,
        quantity
    };
}


/* ============================================================================
   ORDER NUMBER
   ============================================================================ */

function generateOrderNumber() {
    const now = new Date();

    const year =
        now.getUTCFullYear();

    const month =
        String(
            now.getUTCMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getUTCDate()
        ).padStart(2, "0");

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let random = "";

    for (
        let i = 0;
        i < 6;
        i++
    ) {
        random += characters[
            Math.floor(
                Math.random() *
                characters.length
            )
        ];
    }

    return `PS-${year}${month}${day}-${random}`;
}


/* ============================================================================
   BUILD ORDER
   ============================================================================ */

async function buildOrder(body) {
    const customer =
        validateCustomer(body);

    if (
        !Array.isArray(body.cart)
    ) {
        throw new Error(
            "Cart is missing."
        );
    }

    if (
        body.cart.length === 0
    ) {
        throw new Error(
            "Your cart is empty."
        );
    }

    if (
        body.cart.length >
        CONFIG.MAX_ORDER_ITEMS
    ) {
        throw new Error(
            `You can order a maximum of ${CONFIG.MAX_ORDER_ITEMS} different products at once.`
        );
    }

    const normalizedItems =
        body.cart.map(
            normalizeOrderItem
        );

    if (
        normalizedItems.some(
            item => !item
        )
    ) {
        throw new Error(
            "One or more cart items are invalid."
        );
    }

    /*
     * Prevent duplicate product IDs.
     */
    const ids = normalizedItems.map(
        item => item.id
    );

    if (
        new Set(ids).size !== ids.length
    ) {
        throw new Error(
            "Duplicate products are not allowed in the cart."
        );
    }

    /*
     * Load authoritative products.json.
     */
    const products =
        await getProducts();

    const productMap =
        new Map(
            products.map(
                product => [
                    product.id,
                    product
                ]
            )
        );

    const orderItems = [];

    let subtotal = 0;

    for (
        const cartItem of normalizedItems
    ) {
        const product =
            productMap.get(
                cartItem.id
            );

        if (!product) {
            throw new Error(
                `Product ${cartItem.id} is no longer available.`
            );
        }

        /*
         * NEVER trust browser price.
         *
         * Price always comes from products.json.
         */
        const unitPrice =
            Number(product.price);

        const quantity =
            cartItem.quantity;

        const itemSubtotal =
            Number(
                (
                    unitPrice *
                    quantity
                ).toFixed(2)
            );

        subtotal =
            Number(
                (
                    subtotal +
                    itemSubtotal
                ).toFixed(2)
            );

        orderItems.push({
            id: product.id,
            sku: product.sku,
            aliexpress_id:
                product.aliexpress_id,
            name: product.name,
            category: product.category,
            image: product.image,
            quantity,
            unitPrice,
            subtotal: itemSubtotal
        });
    }

    /*
     * Shipping is currently zero.
     *
     * You can add a shipping table later.
     */
    const shipping = 0;

    const total =
        Number(
            (
                subtotal +
                shipping
            ).toFixed(2)
        );

    return {
        success: true,

        orderNumber:
            generateOrderNumber(),

        status: "pending",

        source: "aliexpress",

        createdAt:
            new Date().toISOString(),

        customer,

        items: orderItems,

        subtotal,

        shipping,

        total,

        currency: "USD"
    };
}


/* ============================================================================
   HANDLE ORDER
   ============================================================================ */

async function handleOrder(request) {
    try {
        const body =
            await readJsonBody(
                request
            );

        const order =
            await buildOrder(
                body
            );

        console.log(
            "[PRASUN SHOP] AliExpress order received:",
            JSON.stringify({
                orderNumber:
                    order.orderNumber,
                total:
                    order.total,
                itemCount:
                    order.items.length
            })
        );

        /*
         * IMPORTANT:
         *
         * This does NOT place the order on AliExpress.
         *
         * It only validates and accepts the storefront order.
         */

        return jsonResponse(
            {
                success: true,

                message:
                    "Your order has been received successfully.",

                orderNumber:
                    order.orderNumber,

                status:
                    order.status,

                source:
                    order.source,

                subtotal:
                    order.subtotal,

                shipping:
                    order.shipping,

                total:
                    order.total,

                currency:
                    order.currency,

                paymentUrl:
                    null,

                items:
                    order.items.map(
                        item => ({
                            id:
                                item.id,

                            sku:
                                item.sku,

                            aliexpress_id:
                                item.aliexpress_id,

                            name:
                                item.name,

                            quantity:
                                item.quantity,

                            unitPrice:
                                item.unitPrice,

                            subtotal:
                                item.subtotal
                        })
                    )
            },
            201,
            request
        );

    } catch (error) {
        console.error(
            "[PRASUN SHOP] Order error:",
            error
        );

        return errorResponse(
            error?.message ||
            "Unable to process your order.",
            400,
            request
        );
    }
}


/* ============================================================================
   HEALTH CHECK
   ============================================================================ */

function handleHealth(request) {
    return jsonResponse(
        {
            success: true,

            service:
                "PRASUN SHOP API",

            status:
                "online",

            supplier:
                "AliExpress",

            cj:
                false,

            timestamp:
                new Date().toISOString()
        },
        200,
        request
    );
}


/* ============================================================================
   MAIN REQUEST ROUTER
   ============================================================================ */

async function handleRequest(request) {
    const url =
        new URL(request.url);

    /*
     * ------------------------------------------------------------------------
     * OPTIONS / CORS PREFLIGHT
     * ------------------------------------------------------------------------
     */

    if (
        request.method === "OPTIONS"
    ) {
        return new Response(
            null,
            {
                status: 204,

                headers: {
                    ...corsHeaders(
                        request
                    ),

                    ...securityHeaders()
                }
            }
        );
    }


    /*
     * ------------------------------------------------------------------------
     * HEALTH
     * ------------------------------------------------------------------------
     */

    if (
        request.method === "GET" &&
        (
            url.pathname === "/" ||
            url.pathname === "/health" ||
            url.pathname === "/api/health"
        )
    ) {
        return handleHealth(
            request
        );
    }


    /*
     * ------------------------------------------------------------------------
     * PRODUCTS
     * ------------------------------------------------------------------------
     */

    if (
        request.method === "GET" &&
        (
            url.pathname === "/api/products" ||
            url.pathname.startsWith(
                "/api/products/"
            )
        )
    ) {
        return handleProducts(
            request,
            url
        );
    }


    /*
     * ------------------------------------------------------------------------
     * CREATE ORDER
     * ------------------------------------------------------------------------
     */

    if (
        request.method === "POST" &&
        url.pathname === "/api/order"
    ) {
        return handleOrder(
            request
        );
    }


    /*
     * ------------------------------------------------------------------------
     * ORDER METHOD NOT ALLOWED
     * ------------------------------------------------------------------------
     */

    if (
        url.pathname === "/api/order"
    ) {
        return errorResponse(
            "Method not allowed. Use POST.",
            405,
            request,
            {
                Allow:
                    "POST, OPTIONS"
            }
        );
    }


    /*
     * ------------------------------------------------------------------------
     * 404
     * ------------------------------------------------------------------------
     */

    return errorResponse(
        "API endpoint not found.",
        404,
        request
    );
}


/* ============================================================================
   CLOUDFLARE WORKER ENTRY POINT
   ============================================================================ */

export default {
    async fetch(
        request,
        env,
        ctx
    ) {
        try {
            return await handleRequest(
                request
            );

        } catch (error) {
            console.error(
                "[PRASUN SHOP] Unhandled Worker error:",
                error
            );

            return errorResponse(
                "Internal server error.",
                500,
                request
            );
        }
    }
};
