/**
 * ============================================================================
 * PRASUN SHOP — PRODUCT DETAIL SCRIPT
 * ============================================================================
 *
 * Production storefront product-detail controller.
 *
 * Responsibilities:
 *
 * - Load a single product from the PRASUN SHOP Worker API
 * - Render product information
 * - Render product image
 * - Render specifications
 * - Quantity control
 * - Add product to cart
 * - Buy Now → cart → checkout
 * - Maintain cart count
 *
 * IMPORTANT
 * ---------------------------------------------------------------------------
 * The product page does NOT create an order directly.
 *
 * Customer information is collected on checkout.html.
 *
 * API:
 *
 * GET
 * https://shop.prasunbarua.com/api/products?id=<product-id>
 *
 * POST
 * https://shop.prasunbarua.com/api/order
 *
 * Cart:
 *
 * localStorage key:
 *     prasun_shop_cart
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

        PRODUCTS_ENDPOINT:
            "/api/products",

        CHECKOUT_URL:
            "/checkout.html",

        CART_URL:
            "/cart.html",

        CART_STORAGE_KEY:
            "prasun_shop_cart",

        REQUEST_TIMEOUT:
            15000,

        DEFAULT_CURRENCY:
            "USD",

        DEFAULT_QUANTITY:
            1,

        MIN_QUANTITY:
            1,

        MAX_QUANTITY:
            99

    };


    /* =========================================================================
       STATE
       ========================================================================= */

    const state = {

        product:
            null,

        quantity:
            CONFIG.DEFAULT_QUANTITY,

        imageIndex:
            0,

        loading:
            false

    };


    /* =========================================================================
       DOM
       ========================================================================= */

    const elements = {

        detailContainer:
            document.getElementById(
                "product-detail-container"
            ),

        productTabs:
            document.getElementById(
                "product-tabs"
            ),

        specTable:
            document.getElementById(
                "spec-table"
            ),

        relatedSection:
            document.getElementById(
                "related-products-section"
            ),

        relatedGrid:
            document.getElementById(
                "related-products-grid"
            ),

        cartCount:
            document.getElementById(
                "cart-count-badge"
            ),

        liveRegion:
            document.getElementById(
                "aria-live-region"
            )

    };


    /* =========================================================================
       HELPERS
       ========================================================================= */

    function getQueryParam(
        name
    ) {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get(
            name
        );

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


    function formatPrice(
        value
    ) {

        const amount =
            Number(
                value
            );


        if (
            !Number.isFinite(
                amount
            )
        ) {

            return "$0.00";

        }


        return new Intl.NumberFormat(
            "en-US",
            {

                style:
                    "currency",

                currency:
                    CONFIG.DEFAULT_CURRENCY,

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2

            }
        ).format(
            amount
        );

    }


    function announce(
        message
    ) {

        if (
            elements.liveRegion
        ) {

            elements.liveRegion.textContent =
                message;

        }

    }


    function getProductImage(
        product
    ) {

        const image =
            String(
                product?.image ||
                ""
            ).trim();


        if (
            image &&
            !image.startsWith(
                "PASTE_IMAGE_ADDRESS"
            )
        ) {

            return image;

        }


        return "";

    }


    function getProductImages(
        product
    ) {

        const images = [];


        /*
         * Primary image.
         */

        const primary =
            getProductImage(
                product
            );


        if (
            primary
        ) {

            images.push(
                primary
            );

        }


        /*
         * Support optional image arrays
         * from future Worker responses.
         */

        const possibleArrays = [

            product?.images,

            product?.imageList,

            product?.gallery

        ];


        for (
            const source of possibleArrays
        ) {

            if (
                !Array.isArray(
                    source
                )
            ) {

                continue;

            }


            for (
                const item of source
            ) {

                const image =
                    typeof item ===
                        "string"

                        ? item

                        : item?.url ||
                          item?.image ||
                          "";


                if (
                    image &&
                    !images.includes(
                        image
                    )
                ) {

                    images.push(
                        image
                    );

                }

            }

        }


        return images;

    }


    function getProductId() {

        return (

            getQueryParam(
                "id"
            ) ||

            getQueryParam(
                "productId"
            ) ||

            getQueryParam(
                "pid"
            )

        );

    }


    /* =========================================================================
       FETCH WITH TIMEOUT
       ========================================================================= */

    async function fetchWithTimeout(
        url,
        timeout = CONFIG.REQUEST_TIMEOUT
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
                url,
                {

                    method:
                        "GET",

                    headers: {

                        Accept:
                            "application/json"

                    },

                    cache:
                        "no-store",

                    signal:
                        controller.signal

                }
            );

        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Product request timed out."
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
       API
       ========================================================================= */

    async function fetchProduct(
        productId
    ) {

        const url =
            new URL(
                CONFIG.PRODUCTS_ENDPOINT,
                CONFIG.API_BASE
            );


        url.searchParams.set(
            "id",
            String(
                productId
            )
        );


        console.log(
            "[PRASUN SHOP] Loading product:",
            url.toString()
        );


        const response =
            await fetchWithTimeout(
                url.toString()
            );


        const text =
            await response.text();


        console.log(
            "[PRASUN SHOP] Product API status:",
            response.status
        );


        if (
            !response.ok
        ) {

            throw new Error(

                `Product API returned HTTP ${response.status}.`

            );

        }


        if (
            !text.trim()
        ) {

            throw new Error(
                "Product API returned an empty response."
            );

        }


        let data;


        try {

            data =
                JSON.parse(
                    text
                );

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Product JSON error:",
                error
            );


            throw new Error(
                "Product API returned invalid JSON."
            );

        }


        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Invalid product API response."
            );

        }


        if (
            data.success === false
        ) {

            throw new Error(

                data.error ||
                "Product could not be found."

            );

        }


        /*
         * Expected Worker response:
         *
         * {
         *     success: true,
         *     products: [...]
         * }
         *
         * Also tolerate:
         *
         * {
         *     success: true,
         *     product: {...}
         * }
         */

        if (
            data.product &&
            typeof data.product === "object"
        ) {

            return data.product;

        }


        if (
            Array.isArray(
                data.products
            )
        ) {

            const product =
                data.products[0];


            if (
                product
            ) {

                return product;

            }

        }


        /*
         * Additional compatibility.
         */

        if (
            data.result &&
            typeof data.result === "object"
        ) {

            return data.result;

        }


        throw new Error(
            "Product was not found in the API response."
        );

    }


    /* =========================================================================
       NORMALIZE PRODUCT
       ========================================================================= */

    function normalizeProduct(
        product
    ) {

        if (
            !product ||
            typeof product !== "object"
        ) {

            return null;

        }


        const normalized = {

            ...product,

            id:
                String(
                    product.id ??
                    product.pid ??
                    product.productId ??
                    ""
                ),

            sku:
                String(
                    product.sku ??
                    ""
                ),

            name:
                String(
                    product.name ??
                    product.title ??
                    "Unnamed Product"
                ),

            description:
                String(
                    product.description ??
                    ""
                ),

            category:
                String(
                    product.category ??
                    "General"
                ),

            price:
                Number(
                    product.price
                ) || 0,

            image:
                getProductImage(
                    product
                )

        };


        if (
            !normalized.id
        ) {

            return null;

        }


        return normalized;

    }


    /* =========================================================================
       RENDER PRODUCT
       ========================================================================= */

    function renderProduct(
        product
    ) {

        if (
            !elements.detailContainer ||
            !product
        ) {

            return;

        }


        const images =
            getProductImages(
                product
            );


        const firstImage =
            images[0] ||
            "";


        const rating =
            Number(
                product.rating ||
                0
            );


        const roundedRating =
            Math.max(
                0,
                Math.min(
                    5,
                    Math.round(
                        rating
                    )
                )
            );


        const stars =
            "★".repeat(
                roundedRating
            );


        const features =
            Array.isArray(
                product.features
            )
                ? product.features
                : [];


        elements.detailContainer.innerHTML = `

            <div class="product-layout">

                <!-- =========================================================
                     PRODUCT GALLERY
                     ========================================================= -->

                <div class="product-gallery">

                    <div class="main-image-wrapper">

                        ${
                            firstImage

                                ? `

                                    <img
                                        id="main-product-image"
                                        class="main-product-image"
                                        src="${escapeHTML(firstImage)}"
                                        alt="${escapeHTML(product.name)}"
                                        decoding="async"
                                    >

                                `

                                : `

                                    <div
                                        class="product-image-placeholder"
                                        role="img"
                                        aria-label="Product image unavailable"
                                    >
                                        No Image
                                    </div>

                                `
                        }

                    </div>


                    ${
                        images.length > 1

                            ? `

                                <div
                                    class="product-thumbnails"
                                    id="product-thumbnails"
                                    aria-label="Product images"
                                >

                                    ${images.map(
                                        (
                                            image,
                                            index
                                        ) => `

                                            <button
                                                type="button"
                                                class="product-thumbnail ${
                                                    index === 0
                                                        ? "active"
                                                        : ""
                                                }"
                                                data-image-index="${index}"
                                                aria-label="View product image ${index + 1}"
                                            >

                                                <img
                                                    src="${escapeHTML(image)}"
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                >

                                            </button>

                                        `
                                    ).join("")}

                                </div>

                            `

                            : ""

                    }

                </div>


                <!-- =========================================================
                     PRODUCT INFORMATION
                     ========================================================= -->

                <div class="product-details">

                    <div class="product-category">
                        ${escapeHTML(
                            product.category
                        )}
                    </div>


                    <h1 class="product-title">
                        ${escapeHTML(
                            product.name
                        )}
                    </h1>


                    <div class="product-meta">

                        ${
                            product.sku

                                ? `

                                    <span class="sku-label">
                                        SKU:
                                        ${escapeHTML(
                                            product.sku
                                        )}
                                    </span>

                                `

                                : ""

                        }


                        ${
                            rating > 0

                                ? `

                                    <span
                                        class="product-rating"
                                        aria-label="${rating.toFixed(1)} out of 5 stars"
                                    >

                                        <span>
                                            ${stars}
                                        </span>

                                        <span>
                                            ${rating.toFixed(1)}
                                        </span>

                                    </span>

                                `

                                : ""

                        }

                    </div>


                    <div class="product-pricing">

                        <span
                            class="current-price"
                            id="display-price"
                        >
                            ${formatPrice(
                                product.price
                            )}
                        </span>

                    </div>


                    <!-- =====================================================
                         DESCRIPTION
                         ===================================================== -->

                    <div class="product-description-short">

                        <h2>
                            Overview
                        </h2>

                        <p>
                            ${escapeHTML(
                                product.description ||
                                "No description provided."
                            )}
                        </p>

                    </div>


                    <!-- =====================================================
                         FEATURES
                         ===================================================== -->

                    ${
                        features.length

                            ? `

                                <div class="product-features">

                                    <h2>
                                        Features
                                    </h2>

                                    <ul>

                                        ${features.map(
                                            feature => `

                                                <li>
                                                    ${escapeHTML(
                                                        feature
                                                    )}
                                                </li>

                                            `
                                        ).join("")}

                                    </ul>

                                </div>

                            `

                            : ""

                    }


                    <!-- =====================================================
                         QUANTITY / CART
                         ===================================================== -->

                    <div class="product-actions">

                        <div
                            class="quantity-selector"
                            aria-label="Quantity"
                        >

                            <button
                                type="button"
                                class="qty-btn"
                                id="qty-minus"
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>


                            <input
                                type="number"
                                id="qty-input"
                                value="1"
                                min="${CONFIG.MIN_QUANTITY}"
                                max="${CONFIG.MAX_QUANTITY}"
                                inputmode="numeric"
                                aria-label="Product quantity"
                            >


                            <button
                                type="button"
                                class="qty-btn"
                                id="qty-plus"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>

                        </div>


                        <button
                            type="button"
                            class="btn btn-primary"
                            id="add-to-cart-btn"
                        >
                            Add to Cart
                        </button>


                        <button
                            type="button"
                            class="btn btn-secondary"
                            id="buy-now-btn"
                        >
                            Buy Now
                        </button>

                    </div>


                    <p
                        id="product-action-status"
                        class="product-action-status"
                        aria-live="polite"
                    ></p>

                </div>

            </div>

        `;


        renderSpecifications(
            product
        );


        bindGalleryEvents(
            images
        );


        setupQuantityControls();


        setupCartHandlers();

    }


    /* =========================================================================
       GALLERY
       ========================================================================= */

    function bindGalleryEvents(
        images
    ) {

        const thumbnails =
            document.getElementById(
                "product-thumbnails"
            );


        const mainImage =
            document.getElementById(
                "main-product-image"
            );


        if (
            !thumbnails ||
            !mainImage
        ) {

            return;

        }


        thumbnails.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-image-index]"
                    );


                if (
                    !button
                ) {

                    return;

                }


                const index =
                    Number(
                        button.dataset.imageIndex
                    );


                if (
                    !Number.isInteger(
                        index
                    ) ||
                    !images[index]
                ) {

                    return;

                }


                state.imageIndex =
                    index;


                mainImage.src =
                    images[index];


                mainImage.alt =
                    `${state.product.name} image ${index + 1}`;


                thumbnails
                    .querySelectorAll(
                        ".product-thumbnail"
                    )
                    .forEach(
                        (
                            item,
                            itemIndex
                        ) => {

                            item.classList.toggle(
                                "active",
                                itemIndex ===
                                    index
                            );

                        }
                    );

            }
        );

    }


    /* =========================================================================
       QUANTITY
       ========================================================================= */

    function setupQuantityControls() {

        const input =
            document.getElementById(
                "qty-input"
            );


        const minus =
            document.getElementById(
                "qty-minus"
            );


        const plus =
            document.getElementById(
                "qty-plus"
            );


        if (
            !input
        ) {

            return;

        }


        function setQuantity(
            value
        ) {

            const quantity =
                Number.parseInt(
                    value,
                    10
                );


            state.quantity =
                Math.max(
                    CONFIG.MIN_QUANTITY,
                    Math.min(
                        CONFIG.MAX_QUANTITY,
                        Number.isFinite(
                            quantity
                        )
                            ? quantity
                            : CONFIG.DEFAULT_QUANTITY
                    )
                );


            input.value =
                String(
                    state.quantity
                );

        }


        if (
            minus
        ) {

            minus.addEventListener(
                "click",
                () => {

                    setQuantity(
                        state.quantity - 1
                    );

                }
            );

        }


        if (
            plus
        ) {

            plus.addEventListener(
                "click",
                () => {

                    setQuantity(
                        state.quantity + 1
                    );

                }
            );

        }


        input.addEventListener(
            "input",
            event => {

                setQuantity(
                    event.target.value
                );

            }
        );


        input.addEventListener(
            "blur",
            () => {

                setQuantity(
                    state.quantity
                );

            }
        );

    }


    /* =========================================================================
       CART
       ========================================================================= */

    function getCart() {

        try {

            const raw =
                localStorage.getItem(
                    CONFIG.CART_STORAGE_KEY
                );


            if (
                !raw
            ) {

                return [];

            }


            const cart =
                JSON.parse(
                    raw
                );


            if (
                !Array.isArray(
                    cart
                )
            ) {

                return [];

            }


            return cart;

        } catch (
            error
        ) {

            console.warn(
                "[PRASUN SHOP] Cart read error:",
                error
            );


            return [];

        }

    }


    function saveCart(
        cart
    ) {

        try {

            localStorage.setItem(
                CONFIG.CART_STORAGE_KEY,
                JSON.stringify(
                    cart
                )
            );


            updateCartCount();


            return true;

        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Cart save error:",
                error
            );


            return false;

        }

    }


    function createCartItem() {

        const product =
            state.product;


        return {

            id:
                String(
                    product.id
                ),

            sku:
                String(
                    product.sku ||
                    ""
                ),

            name:
                String(
                    product.name
                ),

            image:
                String(
                    product.image ||
                    ""
                ),

            price:
                Number(
                    product.price
                ) || 0,

            unitPrice:
                Number(
                    product.price
                ) || 0,

            quantity:
                state.quantity,

            subtotal:
                Number(
                    (
                        (
                            Number(
                                product.price
                            ) || 0
                        ) *
                        state.quantity
                    ).toFixed(
                        2
                    )
                ),

            category:
                String(
                    product.category ||
                    ""
                )

        };

    }


    function addToCart() {

        if (
            !state.product
        ) {

            return false;

        }


        const cart =
            getCart();


        const item =
            createCartItem();


        const existingIndex =
            cart.findIndex(
                existing =>
                    String(
                        existing.id
                    ) ===
                    String(
                        item.id
                    )
            );


        if (
            existingIndex >= 0
        ) {

            const existing =
                cart[
                    existingIndex
                ];


            const oldQuantity =
                Number(
                    existing.quantity
                ) || 0;


            existing.quantity =
                Math.min(
                    CONFIG.MAX_QUANTITY,
                    oldQuantity +
                    item.quantity
                );


            existing.price =
                item.price;


            existing.unitPrice =
                item.unitPrice;


            existing.subtotal =
                Number(
                    (
                        existing.unitPrice *
                        existing.quantity
                    ).toFixed(
                        2
                    )
                );


        } else {

            cart.push(
                item
            );

        }


        return saveCart(
            cart
        );

    }


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

                    const quantity =
                        Number(
                            item.quantity
                        );


                    return total +
                        (
                            Number.isFinite(
                                quantity
                            )
                                ? Math.max(
                                    0,
                                    quantity
                                )
                                : 0
                        );

                },
                0
            );


        elements.cartCount.textContent =
            String(
                count
            );


        /*
         * Some designs use hidden attribute,
         * others rely on CSS.
         */

        if (
            count <= 0
        ) {

            elements.cartCount.hidden =
                true;

        } else {

            elements.cartCount.hidden =
                false;

        }

    }


    /* =========================================================================
       CART HANDLERS
       ========================================================================= */

    function setupCartHandlers() {

        const addButton =
            document.getElementById(
                "add-to-cart-btn"
            );


        const buyButton =
            document.getElementById(
                "buy-now-btn"
            );


        const status =
            document.getElementById(
                "product-action-status"
            );


        if (
            addButton
        ) {

            addButton.addEventListener(
                "click",
                () => {

                    if (
                        !state.product
                    ) {

                        return;

                    }


                    const saved =
                        addToCart();


                    if (
                        !saved
                    ) {

                        if (
                            status
                        ) {

                            status.textContent =
                                "Unable to save your cart. Please try again.";

                        }

                        return;

                    }


                    addButton.textContent =
                        "Added to Cart ✓";


                    if (
                        status
                    ) {

                        status.textContent =
                            `${state.quantity} item${
                                state.quantity === 1
                                    ? ""
                                    : "s"
                            } added to your cart.`;

                    }


                    announce(
                        "Product added to cart."
                    );


                    setTimeout(
                        () => {

                            if (
                                addButton
                            ) {

                                addButton.textContent =
                                    "Add to Cart";

                            }

                        },
                        1600
                    );

                }
            );

        }


        if (
            buyButton
        ) {

            buyButton.addEventListener(
                "click",
                () => {

                    if (
                        !state.product
                    ) {

                        return;

                    }


                    const saved =
                        addToCart();


                    if (
                        !saved
                    ) {

                        if (
                            status
                        ) {

                            status.textContent =
                                "Unable to save your cart. Please try again.";

                        }

                        return;

                    }


                    window.location.href =
                        CONFIG.CHECKOUT_URL;

                }
            );

        }

    }


    /* =========================================================================
       SPECIFICATIONS
       ========================================================================= */

    function renderSpecifications(
        product
    ) {

        if (
            !elements.specTable
        ) {

            return;

        }


        const specifications =
            product?.specifications;


        if (
            !specifications ||
            typeof specifications !==
                "object" ||
            Array.isArray(
                specifications
            )
        ) {

            elements.specTable.innerHTML = `

                <tr>

                    <td colspan="2">
                        No specifications available.
                    </td>

                </tr>

            `;

            return;

        }


        const entries =
            Object.entries(
                specifications
            );


        if (
            !entries.length
        ) {

            elements.specTable.innerHTML = `

                <tr>

                    <td colspan="2">
                        No specifications available.
                    </td>

                </tr>

            `;

            return;

        }


        elements.specTable.innerHTML =
            entries
                .map(
                    (
                        [
                            key,
                            value
                        ]
                    ) => `

                        <tr>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        key
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    formatSpecificationValue(
                                        value
                                    )
                                )}
                            </td>

                        </tr>

                    `
                )
                .join(
                    ""
                );

    }


    function formatSpecificationValue(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        if (
            Array.isArray(
                value
            )
        ) {

            return value.join(
                ", "
            );

        }


        if (
            typeof value ===
            "object"
        ) {

            return Object.entries(
                value
            )
                .map(
                    (
                        [
                            key,
                            item
                        ]
                    ) =>
                        `${key}: ${item}`
                )
                .join(
                    ", "
                );

        }


        return String(
            value
        );

    }


    /* =========================================================================
       ERROR
       ========================================================================= */

    function renderError(
        message
    ) {

        if (
            !elements.detailContainer
        ) {

            return;

        }


        elements.detailContainer.innerHTML = `

            <div class="product-error">

                <h2>
                    Product Unavailable
                </h2>

                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>

                <a
                    href="/"
                    class="btn btn-primary"
                >
                    Return to Catalog
                </a>

            </div>

        `;

    }


    /* =========================================================================
       LOADING
       ========================================================================= */

    function renderLoading() {

        if (
            !elements.detailContainer
        ) {

            return;

        }


        elements.detailContainer.innerHTML = `

            <div class="products-loading">

                <div
                    class="loading-spinner"
                    aria-hidden="true"
                ></div>

                <p>
                    Loading product...
                </p>

            </div>

        `;

    }


    /* =========================================================================
       INITIALIZATION
       ========================================================================= */

    async function init() {

        updateCartCount();


        const productId =
            getProductId();


        if (
            !productId
        ) {

            renderError(
                "No product ID was specified in the URL."
            );

            return;

        }


        state.loading =
            true;


        renderLoading();


        try {

            const rawProduct =
                await fetchProduct(
                    productId
                );


            const product =
                normalizeProduct(
                    rawProduct
                );


            if (
                !product
            ) {

                throw new Error(
                    "The product data is invalid."
                );

            }


            state.product =
                product;


            state.quantity =
                CONFIG.DEFAULT_QUANTITY;


            state.imageIndex =
                0;


            renderProduct(
                product
            );


            announce(
                `${product.name} loaded.`
            );


        } catch (
            error
        ) {

            console.error(
                "[PRASUN SHOP] Product loading error:",
                error
            );


            renderError(
                error?.message ||
                "Failed to retrieve product data."
            );


            announce(
                "Unable to load product."
            );

        } finally {

            state.loading =
                false;

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
