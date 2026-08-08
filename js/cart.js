/* ==========================================================================
   PRASUN SHOP — CART SYSTEM
   ========================================================================== */

(() => {
  "use strict";


  /* ------------------------------------------------------------------------
     CONFIGURATION
     ------------------------------------------------------------------------ */

  const CART_STORAGE_KEY = "cart";
  const PRODUCTS_URL = "data/products.json";


  /* ------------------------------------------------------------------------
     DOM ELEMENTS
     ------------------------------------------------------------------------ */

  const cartItemsElement =
    document.getElementById("cart-items");

  const cartTotalElement =
    document.getElementById("cart-total");

  const checkoutButton =
    document.getElementById("checkout-button");

  const cartCountElement =
    document.getElementById("cart-count");

  const mobileCartCountElement =
    document.getElementById("mobile-cart-count");

  const mobileMenuButton =
    document.getElementById("mobile-menu-button");

  const mobileNavigation =
    document.getElementById("mobile-navigation");


  /* ------------------------------------------------------------------------
     STATE
     ------------------------------------------------------------------------ */

  let cart = loadCart();

  let products = [];


  /* ------------------------------------------------------------------------
     INITIALIZE
     ------------------------------------------------------------------------ */

  init();


  async function init() {

    setupMobileNavigation();

    updateCartCount();

    renderLoadingState();

    try {

      products = await loadProducts();

      cleanInvalidCartItems();

      renderCart();

    } catch (error) {

      console.error(
        "Prasun Shop: Unable to load products.",
        error
      );

      renderErrorState();

    }

  }


  /* ------------------------------------------------------------------------
     LOAD CART
     ------------------------------------------------------------------------ */

  function loadCart() {

    try {

      const storedCart =
        localStorage.getItem(CART_STORAGE_KEY);

      if (!storedCart) {
        return [];
      }

      const parsedCart =
        JSON.parse(storedCart);

      if (!Array.isArray(parsedCart)) {
        return [];
      }

      return parsedCart
        .filter(item =>
          item &&
          item.id !== undefined &&
          Number.isFinite(Number(item.quantity)) &&
          Number(item.quantity) > 0
        )
        .map(item => ({
          id: String(item.id),
          quantity: Math.max(
            1,
            Math.floor(Number(item.quantity))
          )
        }));

    } catch (error) {

      console.warn(
        "Prasun Shop: Invalid cart data.",
        error
      );

      return [];

    }

  }


  /* ------------------------------------------------------------------------
     SAVE CART
     ------------------------------------------------------------------------ */

  function saveCart() {

    try {

      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
      );

    } catch (error) {

      console.error(
        "Prasun Shop: Unable to save cart.",
        error
      );

    }

  }


  /* ------------------------------------------------------------------------
     LOAD PRODUCTS
     ------------------------------------------------------------------------ */

  async function loadProducts() {

    const response =
      await fetch(PRODUCTS_URL, {
        cache: "no-cache"
      });

    if (!response.ok) {

      throw new Error(
        `Products request failed: ${response.status}`
      );

    }

    const data =
      await response.json();

    if (!Array.isArray(data)) {

      throw new Error(
        "products.json must contain an array."
      );

    }

    return data;

  }


  /* ------------------------------------------------------------------------
     REMOVE INVALID / DELETED PRODUCTS
     ------------------------------------------------------------------------ */

  function cleanInvalidCartItems() {

    const validProductIds =
      new Set(
        products.map(product =>
          String(product.id)
        )
      );

    const originalLength =
      cart.length;

    cart =
      cart.filter(item =>
        validProductIds.has(String(item.id))
      );

    if (cart.length !== originalLength) {
      saveCart();
    }

  }


  /* ------------------------------------------------------------------------
     RENDER CART
     ------------------------------------------------------------------------ */

  function renderCart() {

    if (!cartItemsElement) {
      return;
    }

    cartItemsElement.setAttribute(
      "aria-busy",
      "false"
    );


    /* Empty Cart */

    if (cart.length === 0) {

      cartItemsElement.innerHTML = `
        <div class="empty-cart">

          <div class="empty-cart-icon" aria-hidden="true">

            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 6h15l-1.5 9h-12z"/>
              <path d="M6 6 5 3H2"/>
              <circle cx="9" cy="20" r="1"/>
              <circle cx="18" cy="20" r="1"/>
            </svg>

          </div>

          <h2>
            Your cart is empty
          </h2>

          <p>
            Discover our products and add something you love.
          </p>

          <a
            href="products.html"
            class="empty-cart-button"
          >
            Continue Shopping
          </a>

        </div>
      `;

      updateSummary(0);

      return;

    }


    /* Render Products */

    let total = 0;

    const fragments = [];


    cart.forEach(item => {

      const product =
        products.find(
          product =>
            String(product.id) === String(item.id)
        );

      if (!product) {
        return;
      }


      const quantity =
        Math.max(
          1,
          Math.floor(Number(item.quantity))
        );


      const price =
        Number(product.price) || 0;


      const subtotal =
        price * quantity;


      total += subtotal;


      const name =
        escapeHTML(
          product.name || "Product"
        );


      const category =
        escapeHTML(
          product.category || "Product"
        );


      const image =
        escapeHTML(
          product.image || ""
        );


      const productId =
        escapeHTML(
          String(product.id)
        );


      fragments.push(`

        <article
          class="cart-item"
          data-product-id="${productId}"
        >

          <!-- Product Image -->

          <a
            href="product.html?id=${encodeURIComponent(product.id)}"
            class="cart-item-image"
            aria-label="View ${name}"
          >

            <img
              src="${image}"
              alt="${name}"
              width="80"
              height="80"
              loading="lazy"
              decoding="async"
            >

          </a>


          <!-- Product Content -->

          <div class="cart-item-content">


            <!-- Product Information -->

            <div class="cart-item-main">

              <div class="cart-item-info">

                <a
                  href="product.html?id=${encodeURIComponent(product.id)}"
                  class="cart-item-title"
                >
                  ${name}
                </a>

                <p class="cart-item-category">
                  ${category}
                </p>

                <p class="cart-item-price">
                  ${formatCurrency(price)}
                </p>

              </div>


              <!-- Desktop Subtotal -->

              <strong class="cart-item-subtotal cart-item-subtotal-desktop">
                ${formatCurrency(subtotal)}
              </strong>

            </div>


            <!-- Bottom Controls -->

            <div class="cart-item-bottom">


              <!-- Quantity -->

              <div
                class="quantity-control"
                aria-label="Quantity controls for ${name}"
              >

                <button
                  type="button"
                  class="quantity-button"
                  data-action="decrease"
                  data-id="${productId}"
                  aria-label="Decrease quantity of ${name}"
                >
                  −
                </button>


                <span
                  class="quantity-value"
                  aria-label="Quantity ${quantity}"
                >
                  ${quantity}
                </span>


                <button
                  type="button"
                  class="quantity-button"
                  data-action="increase"
                  data-id="${productId}"
                  aria-label="Increase quantity of ${name}"
                >
                  +
                </button>

              </div>


              <!-- Actions -->

              <div class="cart-item-actions">

                <strong class="cart-item-subtotal cart-item-subtotal-mobile">
                  ${formatCurrency(subtotal)}
                </strong>

                <button
                  type="button"
                  class="remove-btn"
                  data-action="remove"
                  data-id="${productId}"
                  aria-label="Remove ${name} from cart"
                >
                  Remove
                </button>

              </div>

            </div>

          </div>

        </article>

      `);

    });


    cartItemsElement.innerHTML =
      fragments.join("");


    updateSummary(total);

    updateCartCount();

  }


  /* ------------------------------------------------------------------------
     UPDATE QUANTITY
     ------------------------------------------------------------------------ */

  function changeQuantity(id, change) {

    const item =
      cart.find(
        item =>
          String(item.id) === String(id)
      );

    if (!item) {
      return;
    }


    item.quantity += change;


    if (item.quantity <= 0) {

      cart =
        cart.filter(
          item =>
            String(item.id) !== String(id)
        );

    }


    saveCart();

    renderCart();

  }


  /* ------------------------------------------------------------------------
     REMOVE ITEM
     ------------------------------------------------------------------------ */

  function removeFromCart(id) {

    cart =
      cart.filter(
        item =>
          String(item.id) !== String(id)
      );


    saveCart();

    renderCart();

  }


  /* ------------------------------------------------------------------------
     CART EVENT DELEGATION
     ------------------------------------------------------------------------ */

  if (cartItemsElement) {

    cartItemsElement.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) {
          return;
        }


        const action =
          button.dataset.action;

        const id =
          button.dataset.id;


        if (!id) {
          return;
        }


        if (action === "increase") {

          changeQuantity(id, 1);

        }


        if (action === "decrease") {

          changeQuantity(id, -1);

        }


        if (action === "remove") {

          removeFromCart(id);

        }

      }
    );

  }


  /* ------------------------------------------------------------------------
     UPDATE SUMMARY
     ------------------------------------------------------------------------ */

  function updateSummary(total) {

    if (!cartTotalElement) {
      return;
    }


    cartTotalElement.textContent =
      formatCurrency(total);


    if (checkoutButton) {

      const hasItems =
        cart.length > 0;

      checkoutButton.disabled =
        !hasItems;

      checkoutButton.setAttribute(
        "aria-disabled",
        String(!hasItems)
      );

    }

  }


  /* ------------------------------------------------------------------------
     UPDATE CART BADGE
     ------------------------------------------------------------------------ */

  function updateCartCount() {

    const quantity =
      cart.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );


    updateBadge(
      cartCountElement,
      quantity
    );

    updateBadge(
      mobileCartCountElement,
      quantity
    );

  }


  function updateBadge(element, quantity) {

    if (!element) {
      return;
    }


    element.textContent =
      quantity > 99
        ? "99+"
        : String(quantity);


    element.setAttribute(
      "aria-label",
      `${quantity} ${quantity === 1 ? "item" : "items"} in cart`
    );


    element.hidden =
      quantity === 0;

  }


  /* ------------------------------------------------------------------------
     MOBILE NAVIGATION
     ------------------------------------------------------------------------ */

  function setupMobileNavigation() {

    if (
      !mobileMenuButton ||
      !mobileNavigation
    ) {
      return;
    }


    mobileMenuButton.addEventListener(
      "click",
      () => {

        const isOpen =
          mobileMenuButton.getAttribute(
            "aria-expanded"
          ) === "true";


        mobileMenuButton.setAttribute(
          "aria-expanded",
          String(!isOpen)
        );


        mobileMenuButton.setAttribute(
          "aria-label",
          isOpen
            ? "Open navigation menu"
            : "Close navigation menu"
        );


        mobileNavigation.hidden =
          isOpen;


        mobileNavigation.classList.toggle(
          "is-open",
          !isOpen
        );

      }
    );


    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape" &&
          !mobileNavigation.hidden
        ) {

          mobileNavigation.hidden = true;

          mobileNavigation.classList.remove(
            "is-open"
          );

          mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
          );

          mobileMenuButton.setAttribute(
            "aria-label",
            "Open navigation menu"
          );

          mobileMenuButton.focus();

        }

      }
    );

  }


  /* ------------------------------------------------------------------------
     LOADING STATE
     ------------------------------------------------------------------------ */

  function renderLoadingState() {

    if (!cartItemsElement) {
      return;
    }

    cartItemsElement.setAttribute(
      "aria-busy",
      "true"
    );

  }


  /* ------------------------------------------------------------------------
     ERROR STATE
     ------------------------------------------------------------------------ */

  function renderErrorState() {

    if (!cartItemsElement) {
      return;
    }


    cartItemsElement.setAttribute(
      "aria-busy",
      "false"
    );


    cartItemsElement.innerHTML = `

      <div class="cart-error">

        <div class="empty-cart-icon" aria-hidden="true">

          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4"/>
            <path d="M12 16h.01"/>
          </svg>

        </div>

        <h3>
          Unable to load your cart
        </h3>

        <p>
          Please refresh the page and try again.
        </p>

        <button
          type="button"
          onclick="window.location.reload()"
        >
          Try Again
        </button>

      </div>

    `;

  }


  /* ------------------------------------------------------------------------
     CURRENCY
     ------------------------------------------------------------------------ */

  function formatCurrency(value) {

    const amount =
      Number(value) || 0;

    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(amount);

  }


  /* ------------------------------------------------------------------------
     HTML ESCAPING
     ------------------------------------------------------------------------ */

  function escapeHTML(value) {

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }

})();
