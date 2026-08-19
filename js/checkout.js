/**
 * ============================================================================
 * PRASUN SHOP — CHECKOUT.JS
 * Production Checkout System
 * ============================================================================
 *
 * Compatible with:
 *   - checkout.html
 *   - cart.html
 *   - products.html
 *   - prasun_cart localStorage
 *
 * Features:
 *   ✓ Unified cart storage
 *   ✓ Secure HTML escaping
 *   ✓ Product data from cart
 *   ✓ Quantity handling
 *   ✓ Shipping calculation
 *   ✓ Country selection
 *   ✓ Customer validation
 *   ✓ Order submission
 *   ✓ Cloudflare Worker API support
 *   ✓ Loading / processing states
 *   ✓ Duplicate-submit protection
 *   ✓ Mobile-friendly behavior
 *   ✓ Graceful empty-cart handling
 * ============================================================================
 */

"use strict";

(() => {

  /* ==========================================================================
     CONFIGURATION
     ========================================================================== */

  const CART_KEY = "prasun_cart";

  const LEGACY_CART_KEYS = [
    "prasunShopCart",
    "cart"
  ];

  const API_ENDPOINT =
    "https://prasun-shop-api.prasun301.workers.dev/";

  const SHOP_URL = "index.html";
  const CART_URL = "cart.html";
  const SUCCESS_URL = "order-success.html";

  const SHIPPING_FEE = 5.00;


  /* ==========================================================================
     DOM REFERENCES
     ========================================================================== */

  const summaryContainer =
    document.getElementById("summary-items-container");

  const countryDropdown =
    document.getElementById("country-dropdown");

  const countrySelected =
    document.getElementById("dropdown-selected-text");

  const countryInput =
    document.getElementById("country-input");


  /* ==========================================================================
     CURRENCY
     ========================================================================== */

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });


  function formatPrice(value) {

    const number = Number(value);

    return Number.isFinite(number)
      ? currencyFormatter.format(number)
      : "$0.00";
  }


  /* ==========================================================================
     HTML ESCAPING
     ========================================================================== */

  const ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  const ESCAPE_REGEX = /[&<>"']/g;


  function escapeHTML(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value).replace(
      ESCAPE_REGEX,
      character => ESCAPE_MAP[character]
    );
  }


  /* ==========================================================================
     PRICE NORMALIZATION
     ========================================================================== */

  function parsePrice(value) {

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== "string") {
      return 0;
    }

    const cleaned = value
      .replace(/[^0-9.-]/g, "")
      .trim();

    const number = Number(cleaned);

    return Number.isFinite(number)
      ? number
      : 0;
  }


  /* ==========================================================================
     QUANTITY NORMALIZATION
     ========================================================================== */

  function normalizeQuantity(value) {

    const quantity = Number(value);

    if (!Number.isFinite(quantity)) {
      return 1;
    }

    return Math.max(
      1,
      Math.floor(quantity)
    );
  }


  /* ==========================================================================
     IMAGE FALLBACK
     ========================================================================== */

  const FALLBACK_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f5f5f7'/%3E%3Ctext x='100' y='100' dominant-baseline='middle' text-anchor='middle' fill='%2386868b' font-family='Arial,sans-serif' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";


  /* ==========================================================================
     CART STORAGE
     ========================================================================== */

  function readStorageCart(key) {

    try {

      const stored =
        localStorage.getItem(key);

      if (!stored) {
        return [];
      }

      const parsed =
        JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (error) {

      console.error(
        `Failed to read cart key "${key}":`,
        error
      );

      return [];
    }
  }


  function normalizeCart(cart) {

    if (!Array.isArray(cart)) {
      return [];
    }

    return cart
      .filter(item =>
        item &&
        (
          item.id !== undefined ||
          item.sku !== undefined
        )
      )
      .map(item => {

        const quantity =
          normalizeQuantity(item.quantity);

        const id =
          item.id ??
          item.sku ??
          item.productId ??
          "";

        const name =
          item.name ??
          item.title ??
          "Product";

        const price =
          parsePrice(
            item.price ??
            item.salePrice ??
            item.unitPrice ??
            0
          );

        const image =
          item.image ??
          item.imageUrl ??
          item.productImage ??
          FALLBACK_IMAGE;

        return {

          id: String(id),

          sku:
            item.sku
              ? String(item.sku)
              : "",

          name: String(name),

          title: String(
            item.title ??
            name
          ),

          price,

          quantity,

          image: String(image),

          category:
            item.category
              ? String(item.category)
              : "",

          variant:
            item.variant
              ? String(item.variant)
              : ""
        };

      });
  }


  function getCart() {

    /*
     * Primary storage used by current cart.html
     */
    const primaryCart =
      normalizeCart(
        readStorageCart(CART_KEY)
      );

    if (primaryCart.length > 0) {
      return primaryCart;
    }


    /*
     * Legacy compatibility
     */
    for (const key of LEGACY_CART_KEYS) {

      const legacyCart =
        normalizeCart(
          readStorageCart(key)
        );

      if (legacyCart.length > 0) {

        /*
         * Migrate old cart automatically.
         */
        saveCart(legacyCart);

        return legacyCart;
      }
    }

    return [];
  }


  function saveCart(cart) {

    try {

      const normalized =
        normalizeCart(cart);

      localStorage.setItem(
        CART_KEY,
        JSON.stringify(normalized)
      );

      /*
       * Remove obsolete formats so the
       * application has one source of truth.
       */
      localStorage.removeItem("prasunShopCart");
      localStorage.removeItem("cart");

    } catch (error) {

      console.error(
        "Unable to save cart:",
        error
      );
    }
  }


  /* ==========================================================================
     CART BADGE
     ========================================================================== */

  function updateCartBadge() {

    const cart =
      getCart();

    const totalItems =
      cart.reduce(
        (sum, item) =>
          sum + normalizeQuantity(item.quantity),
        0
      );

    const badge =
      document.getElementById("cart-count");

    if (!badge) {
      return;
    }

    badge.textContent =
      String(totalItems);

    /*
     * Hide badge when cart is empty.
     */
    if (totalItems <= 0) {
      badge.hidden = true;
    } else {
      badge.hidden = false;
    }
  }


  /* ==========================================================================
     ORDER CALCULATION
     ========================================================================== */

  function calculateSubtotal(cart) {

    return cart.reduce(
      (total, item) => {

        const price =
          parsePrice(item.price);

        const quantity =
          normalizeQuantity(item.quantity);

        return total +
          (price * quantity);

      },
      0
    );
  }


  function calculateShipping(cart) {

    if (!cart.length) {
      return 0;
    }

    return SHIPPING_FEE;
  }


  function calculateOrderTotals(cart) {

    const subtotal =
      calculateSubtotal(cart);

    const shipping =
      calculateShipping(cart);

    const total =
      subtotal + shipping;

    return {
      subtotal,
      shipping,
      total
    };
  }


  /* ==========================================================================
     SUMMARY ITEM
     ========================================================================== */

  function createSummaryItem(item) {

    const price =
      parsePrice(item.price);

    const quantity =
      normalizeQuantity(item.quantity);

    const lineTotal =
      price * quantity;

    const image =
      escapeHTML(
        item.image || FALLBACK_IMAGE
      );

    const title =
      escapeHTML(
        item.title ||
        item.name ||
        "Product"
      );

    return `
      <div class="summary-item">

        <img
          src="${image}"
          alt="${title}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
        >

        <div style="min-width:0;flex:1;">

          <h4
            style="
              margin:0 0 .25rem;
              font-size:.95rem;
              font-weight:600;
              line-height:1.35;
              overflow:hidden;
              text-overflow:ellipsis;
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
            "
          >
            ${title}
          </h4>

          <p
            style="
              margin:0;
              font-size:.82rem;
              color:var(--apple-gray);
            "
          >
            Qty: ${quantity}
          </p>

          <p
            style="
              margin:.2rem 0 0;
              font-size:.78rem;
              color:var(--apple-gray);
            "
          >
            ${formatPrice(price)} each
          </p>

        </div>

        <div
          style="
            margin-left:auto;
            font-weight:600;
            font-size:.9rem;
            white-space:nowrap;
          "
        >
          ${formatPrice(lineTotal)}
        </div>

      </div>
    `;
  }


  /* ==========================================================================
     CHECKOUT SUMMARY
     ========================================================================== */

  function renderCheckoutSummary() {

    updateCartBadge();

    const cart =
      getCart();

    if (!summaryContainer) {
      return;
    }


    /* ------------------------------------------------------------------------
       EMPTY CART
       ------------------------------------------------------------------------ */

    if (cart.length === 0) {

      summaryContainer.innerHTML = `

        <div
          style="
            text-align:center;
            padding:1.5rem 0;
          "
        >

          <div
            style="
              width:56px;
              height:56px;
              margin:0 auto 1rem;
              border-radius:50%;
              background:#ffffff;
              border:1px solid var(--apple-border);
              display:flex;
              align-items:center;
              justify-content:center;
              color:var(--apple-gray);
            "
          >

            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>

          </div>

          <p
            style="
              margin:0 0 .25rem;
              font-weight:600;
              color:var(--apple-text);
            "
          >
            Your bag is empty
          </p>

          <p
            style="
              margin:0 0 1.25rem;
              font-size:.85rem;
              color:var(--apple-gray);
            "
          >
            Add products to continue checkout.
          </p>

          <button
            type="button"
            class="btn-place-order"
            id="btn-return-shop"
          >
            Continue Shopping
          </button>

        </div>

      `;

      const returnButton =
        document.getElementById(
          "btn-return-shop"
        );

      if (returnButton) {

        returnButton.addEventListener(
          "click",
          () => {
            window.location.href =
              SHOP_URL;
          }
        );
      }

      return;
    }


    /* ------------------------------------------------------------------------
       POPULATE PRODUCTS
       ------------------------------------------------------------------------ */

    const totals =
      calculateOrderTotals(cart);

    let itemsHTML = "";

    cart.forEach(item => {

      itemsHTML +=
        createSummaryItem(item);

    });


    /* ------------------------------------------------------------------------
       TOTALS
       ------------------------------------------------------------------------ */

    summaryContainer.innerHTML = `

      <div class="summary-items-list">
        ${itemsHTML}
      </div>

      <div
        style="
          border-top:1px solid var(--apple-border);
          padding-top:1.2rem;
          margin-top:.25rem;
        "
      >

        <div class="summary-row">
          <span>Subtotal</span>
          <span>${formatPrice(totals.subtotal)}</span>
        </div>

        <div class="summary-row">
          <span>Shipping</span>
          <span>${formatPrice(totals.shipping)}</span>
        </div>

        <div class="summary-total">
          <span>Total</span>
          <span>${formatPrice(totals.total)}</span>
        </div>

      </div>

      <button
        type="button"
        class="btn-place-order"
        id="btn-place-order"
      >
        Place Order
      </button>

      <p
        style="
          margin:.8rem 0 0;
          text-align:center;
          font-size:.72rem;
          color:var(--apple-gray);
          line-height:1.45;
        "
      >
        By placing your order, you agree to our
        <a
          href="terms.html"
          style="color:inherit;text-decoration:underline;"
        >
          Terms of Service
        </a>.
      </p>

    `;


    const placeOrderButton =
      document.getElementById(
        "btn-place-order"
      );

    if (placeOrderButton) {

      placeOrderButton.addEventListener(
        "click",
        handlePlaceOrder
      );
    }
  }


  /* ==========================================================================
     FORM VALIDATION
     ========================================================================== */

  function getFieldValue(id) {

    const element =
      document.getElementById(id);

    if (!element) {
      return "";
    }

    return String(
      element.value || ""
    ).trim();
  }


  function validateEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);
  }


  function validateCheckoutForm() {

    const email =
      getFieldValueByLabel(
        "Email Address"
      );

    const phone =
      getFieldValueByLabel(
        "Phone Number"
      );

    const firstName =
      getFieldValueByLabel(
        "First Name"
      );

    const lastName =
      getFieldValueByLabel(
        "Last Name"
      );

    const street =
      getFieldValueByLabel(
        "Street Address"
      );

    const city =
      getFieldValueByLabel(
        "City"
      );

    const postal =
      getFieldValueByLabel(
        "Postal / ZIP Code"
      );

    const country =
      countryInput
        ? countryInput.value.trim()
        : "";


    if (!email) {

      alert(
        "Please enter your email address."
      );

      focusFieldByLabel(
        "Email Address"
      );

      return false;
    }


    if (!validateEmail(email)) {

      alert(
        "Please enter a valid email address."
      );

      focusFieldByLabel(
        "Email Address"
      );

      return false;
    }


    if (!phone) {

      alert(
        "Please enter your phone number."
      );

      focusFieldByLabel(
        "Phone Number"
      );

      return false;
    }


    if (!firstName) {

      alert(
        "Please enter your first name."
      );

      focusFieldByLabel(
        "First Name"
      );

      return false;
    }


    if (!lastName) {

      alert(
        "Please enter your last name."
      );

      focusFieldByLabel(
        "Last Name"
      );

      return false;
    }


    if (!street) {

      alert(
        "Please enter your street address."
      );

      focusFieldByLabel(
        "Street Address"
      );

      return false;
    }


    if (!city) {

      alert(
        "Please enter your city."
      );

      focusFieldByLabel(
        "City"
      );

      return false;
    }


    if (!postal) {

      alert(
        "Please enter your postal / ZIP code."
      );

      focusFieldByLabel(
        "Postal / ZIP Code"
      );

      return false;
    }


    if (!country) {

      alert(
        "Please select your country."
      );

      if (countrySelected) {
        countrySelected.focus();
      }

      return false;
    }


    return true;
  }


  /* ==========================================================================
     LABEL-BASED FIELD HELPERS
     ========================================================================== */

  function getFieldByLabel(labelText) {

    const labels =
      document.querySelectorAll(
        ".form-group label"
      );

    for (const label of labels) {

      if (
        label.textContent.trim()
          .toLowerCase() ===
        labelText.toLowerCase()
      ) {

        const group =
          label.closest(".form-group");

        if (!group) {
          continue;
        }

        const input =
          group.querySelector(
            "input:not([type='hidden'])"
          );

        if (input) {
          return input;
        }
      }
    }

    return null;
  }


  function getFieldValueByLabel(labelText) {

    const field =
      getFieldByLabel(labelText);

    return field
      ? String(field.value || "").trim()
      : "";
  }


  function focusFieldByLabel(labelText) {

    const field =
      getFieldByLabel(labelText);

    if (field) {
      field.focus();
      field.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }


  /* ==========================================================================
     CUSTOMER DATA
     ========================================================================== */

  function collectCustomerData() {

    return {

      firstName:
        getFieldValueByLabel(
          "First Name"
        ),

      lastName:
        getFieldValueByLabel(
          "Last Name"
        ),

      customerName:
        [
          getFieldValueByLabel("First Name"),
          getFieldValueByLabel("Last Name")
        ]
        .filter(Boolean)
        .join(" "),

      email:
        getFieldValueByLabel(
          "Email Address"
        ),

      phone:
        getFieldValueByLabel(
          "Phone Number"
        ),

      street:
        getFieldValueByLabel(
          "Street Address"
        ),

      city:
        getFieldValueByLabel(
          "City"
        ),

      postalCode:
        getFieldValueByLabel(
          "Postal / ZIP Code"
        ),

      country:
        countryInput
          ? countryInput.value.trim()
          : "United States"

    };
  }


  /* ==========================================================================
     ADDRESS
     ========================================================================== */

  function buildAddress(customer) {

    return [
      customer.street,
      customer.city,
      customer.postalCode,
      customer.country
    ]
      .filter(Boolean)
      .join(", ");
  }


  /* ==========================================================================
     ORDER ID
     ========================================================================== */

  function generateOrderId() {

    const timestamp =
      Date.now()
        .toString(36)
        .toUpperCase();

    const random =
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    return `PS-${timestamp}-${random}`;
  }


  /* ==========================================================================
     ORDER PAYLOAD
     ========================================================================== */

  function buildOrderPayload(cart, customer) {

    const totals =
      calculateOrderTotals(cart);

    const orderId =
      generateOrderId();


    const enrichedCart =
      cart.map(item => {

        const quantity =
          normalizeQuantity(
            item.quantity
          );

        const price =
          parsePrice(
            item.price
          );

        return {

          id: item.id,

          sku:
            item.sku || "",

          name:
            item.name ||
            item.title ||
            "Product",

          price,

          quantity,

          subtotal:
            Number(
              (price * quantity)
                .toFixed(2)
            ),

          image:
            item.image || "",

          category:
            item.category || "",

          variant:
            item.variant || ""

        };

      });


    return {

      orderId,

      customer: {

        firstName:
          customer.firstName,

        lastName:
          customer.lastName,

        name:
          customer.customerName,

        email:
          customer.email,

        phone:
          customer.phone

      },

      shippingAddress: {

        street:
          customer.street,

        city:
          customer.city,

        postalCode:
          customer.postalCode,

        country:
          customer.country,

        fullAddress:
          buildAddress(customer)

      },

      cart:
        enrichedCart,

      subtotal:
        Number(
          totals.subtotal.toFixed(2)
        ),

      shipping:
        Number(
          totals.shipping.toFixed(2)
        ),

      total:
        Number(
          totals.total.toFixed(2)
        ),

      currency:
        "USD",

      source:
        "PRASUN SHOP",

      createdAt:
        new Date().toISOString()

    };
  }


  /* ==========================================================================
     PLACE ORDER
     ========================================================================== */

  let orderProcessing =
    false;


  async function handlePlaceOrder() {

    if (orderProcessing) {
      return;
    }


    const cart =
      getCart();


    if (!cart.length) {

      alert(
        "Your cart is empty."
      );

      window.location.href =
        CART_URL;

      return;
    }


    if (!validateCheckoutForm()) {
      return;
    }


    const button =
      document.getElementById(
        "btn-place-order"
      );

    if (!button) {
      return;
    }


    orderProcessing = true;


    const originalText =
      button.textContent;


    button.disabled = true;

    button.setAttribute(
      "aria-busy",
      "true"
    );

    button.textContent =
      "Processing Order...";

    button.style.opacity =
      "0.7";

    button.style.cursor =
      "wait";


    try {

      const customer =
        collectCustomerData();

      const payload =
        buildOrderPayload(
          cart,
          customer
        );


      /*
       * Send order to Cloudflare Worker.
       */
      const response =
        await fetch(
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
              JSON.stringify(payload)
          }
        );


      /*
       * Try to parse JSON even when
       * server returns an error.
       */
      let responseData = null;

      try {

        responseData =
          await response.json();

      } catch {

        responseData = null;

      }


      if (!response.ok) {

        const serverMessage =
          responseData &&
          (
            responseData.message ||
            responseData.error
          );

        throw new Error(
          serverMessage ||
          `Server error (${response.status})`
        );
      }


      console.log(
        "PRASUN SHOP order created:",
        responseData
      );


      /*
       * Save order locally before clearing
       * the shopping cart.
       */
      try {

        localStorage.setItem(
          "prasun_last_order",
          JSON.stringify(
            payload
          )
        );

      } catch (storageError) {

        console.warn(
          "Could not save local order copy:",
          storageError
        );
      }


      /*
       * Clear all supported cart keys.
       */
      localStorage.removeItem(
        CART_KEY
      );

      localStorage.removeItem(
        "prasunShopCart"
      );

      localStorage.removeItem(
        "cart"
      );


      /*
       * Store server response separately.
       */
      try {

        localStorage.setItem(
          "prasun_order_response",
          JSON.stringify(
            responseData || {}
          )
        );

      } catch (error) {

        console.warn(
          "Could not save order response:",
          error
        );
      }


      /*
       * Redirect only after successful
       * server response.
       */
      window.location.href =
        `${SUCCESS_URL}?order=${encodeURIComponent(payload.orderId)}`;


    } catch (error) {

      console.error(
        "PRASUN SHOP order submission failed:",
        error
      );


      alert(
        "We couldn't place your order right now.\n\n" +
        "Please check your internet connection and try again."
      );


      button.disabled = false;

      button.removeAttribute(
        "aria-busy"
      );

      button.textContent =
        originalText;

      button.style.opacity =
        "";

      button.style.cursor =
        "";

      orderProcessing = false;
    }

  }


  /* ==========================================================================
     COUNTRY DROPDOWN
     ========================================================================== */

  function initCountryDropdown() {

    if (
      !countryDropdown ||
      !countrySelected ||
      !countryInput
    ) {
      return;
    }


    const list =
      document.getElementById(
        "dropdown-list"
      );

    const search =
      document.getElementById(
        "country-search"
      );

    const options =
      document.getElementById(
        "dropdown-options-list"
      );


    if (!list || !search || !options) {
      return;
    }


    function renderOptions(filter = "") {

      const query =
        String(filter)
          .trim()
          .toLowerCase();


      const optionElements =
        options.querySelectorAll(
          ".dropdown-option"
        );

      optionElements.forEach(
        element =>
          element.remove()
      );


      const countryElements =
        Array.from(
          countriesList()
        )
        .filter(country =>
          country
            .toLowerCase()
            .includes(query)
        );


      if (countryElements.length === 0) {

        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "dropdown-option";

        empty.textContent =
          "No countries found";

        empty.style.cursor =
          "default";

        empty.style.color =
          "var(--apple-gray)";

        options.appendChild(
          empty
        );

        return;
      }


      countryElements.forEach(
        country => {

          const option =
            document.createElement(
              "div"
            );

          option.className =
            "dropdown-option";

          option.textContent =
            country;

          if (
            country ===
            countryInput.value
          ) {

            option.classList.add(
              "selected"
            );
          }


          option.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              countryInput.value =
                country;

              countrySelected.textContent =
                country;

              list.classList.remove(
                "open"
              );

              countrySelected.classList.remove(
                "active"
              );

              renderOptions(
                search.value
              );
            }
          );


          options.appendChild(
            option
          );

        }
      );

    }


    countrySelected.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        const opening =
          !list.classList.contains(
            "open"
          );

        list.classList.toggle(
          "open",
          opening
        );

        countrySelected.classList.toggle(
          "active",
          opening
        );


        if (opening) {

          search.value = "";

          renderOptions();

          setTimeout(
            () => search.focus(),
            50
          );
        }

      }
    );


    search.addEventListener(
      "input",
      () => {

        renderOptions(
          search.value
        );

      }
    );


    search.addEventListener(
      "click",
      event =>
        event.stopPropagation()
    );


    document.addEventListener(
      "click",
      () => {

        list.classList.remove(
          "open"
        );

        countrySelected.classList.remove(
          "active"
        );

      }
    );


    renderOptions();

  }


  /*
   * Countries are obtained from the existing
   * checkout.html dropdown options.
   */
  function countriesList() {

    const options =
      document.querySelectorAll(
        "#dropdown-options-list .dropdown-option"
      );

    /*
     * The HTML already contains the
     * country list through the existing
     * inline checkout implementation.
     *
     * If options have not yet been generated,
     * use the built-in complete list below.
     */

    if (options.length > 0) {

      return Array.from(
        options
      )
      .map(
        option =>
          option.textContent.trim()
      )
      .filter(Boolean);

    }


    return [
      "United States",
      "Afghanistan",
      "Albania",
      "Algeria",
      "Andorra",
      "Angola",
      "Antigua and Barbuda",
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
      "Burkina Faso",
      "Burundi",
      "Cabo Verde",
      "Cambodia",
      "Cameroon",
      "Canada",
      "Central African Republic",
      "Chad",
      "Chile",
      "China",
      "Colombia",
      "Comoros",
      "Congo",
      "Costa Rica",
      "Croatia",
      "Cuba",
      "Cyprus",
      "Czechia",
      "Denmark",
      "Djibouti",
      "Dominica",
      "Dominican Republic",
      "Ecuador",
      "Egypt",
      "El Salvador",
      "Equatorial Guinea",
      "Eritrea",
      "Estonia",
      "Eswatini",
      "Ethiopia",
      "Fiji",
      "Finland",
      "France",
      "Gabon",
      "Gambia",
      "Georgia",
      "Germany",
      "Ghana",
      "Greece",
      "Grenada",
      "Guatemala",
      "Guinea",
      "Guinea-Bissau",
      "Guyana",
      "Haiti",
      "Honduras",
      "Hungary",
      "Iceland",
      "India",
      "Indonesia",
      "Iran",
      "Iraq",
      "Ireland",
      "Israel",
      "Italy",
      "Jamaica",
      "Japan",
      "Jordan",
      "Kazakhstan",
      "Kenya",
      "Kiribati",
      "Kuwait",
      "Kyrgyzstan",
      "Laos",
      "Latvia",
      "Lebanon",
      "Lesotho",
      "Liberia",
      "Libya",
      "Liechtenstein",
      "Lithuania",
      "Luxembourg",
      "Madagascar",
      "Malawi",
      "Malaysia",
      "Maldives",
      "Mali",
      "Malta",
      "Marshall Islands",
      "Mauritania",
      "Mauritius",
      "Mexico",
      "Micronesia",
      "Moldova",
      "Monaco",
      "Mongolia",
      "Montenegro",
      "Morocco",
      "Mozambique",
      "Myanmar",
      "Namibia",
      "Nauru",
      "Nepal",
      "Netherlands",
      "New Zealand",
      "Nicaragua",
      "Niger",
      "Nigeria",
      "North Korea",
      "North Macedonia",
      "Norway",
      "Oman",
      "Pakistan",
      "Palau",
      "Panama",
      "Papua New Guinea",
      "Paraguay",
      "Peru",
      "Philippines",
      "Poland",
      "Portugal",
      "Qatar",
      "Romania",
      "Russia",
      "Rwanda",
      "Saint Kitts and Nevis",
      "Saint Lucia",
      "Saint Vincent and the Grenadines",
      "Samoa",
      "San Marino",
      "Sao Tome and Principe",
      "Saudi Arabia",
      "Senegal",
      "Serbia",
      "Seychelles",
      "Sierra Leone",
      "Singapore",
      "Slovakia",
      "Slovenia",
      "Solomon Islands",
      "Somalia",
      "South Africa",
      "South Korea",
      "South Sudan",
      "Spain",
      "Sri Lanka",
      "Sudan",
      "Suriname",
      "Sweden",
      "Switzerland",
      "Syria",
      "Taiwan",
      "Tajikistan",
      "Tanzania",
      "Thailand",
      "Togo",
      "Tonga",
      "Trinidad and Tobago",
      "Tunisia",
      "Turkey",
      "Turkmenistan",
      "Tuvalu",
      "Uganda",
      "Ukraine",
      "United Arab Emirates",
      "United Kingdom",
      "Uruguay",
      "Uzbekistan",
      "Vanuatu",
      "Vatican City",
      "Venezuela",
      "Vietnam",
      "Yemen",
      "Zambia",
      "Zimbabwe"
    ];
  }


  /* ==========================================================================
     KEYBOARD ACCESSIBILITY
     ========================================================================== */

  function initKeyboardSupport() {

    if (!countrySelected) {
      return;
    }

    countrySelected.setAttribute(
      "tabindex",
      "0"
    );

    countrySelected.setAttribute(
      "role",
      "button"
    );

    countrySelected.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();

          countrySelected.click();

        }

        if (event.key === "Escape") {

          const list =
            document.getElementById(
              "dropdown-list"
            );

          if (list) {
            list.classList.remove(
              "open"
            );
          }

        }

      }
    );

  }


  /* ==========================================================================
     AUTO-REFRESH WHEN CART CHANGES
     ========================================================================== */

  window.addEventListener(
    "storage",
    event => {

      if (
        event.key === CART_KEY ||
        event.key === "prasunShopCart" ||
        event.key === "cart"
      ) {

        renderCheckoutSummary();

      }

    }
  );


  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      /*
       * Ensure primary cart exists.
       */
      const cart =
        getCart();

      if (cart.length > 0) {
        saveCart(cart);
      }


      /*
       * Render summary.
       */
      renderCheckoutSummary();


      /*
       * Initialize country selector.
       */
      initCountryDropdown();


      /*
       * Keyboard support.
       */
      initKeyboardSupport();

    }
  );


})();
