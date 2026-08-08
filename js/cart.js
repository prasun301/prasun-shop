// ============================================================
// PRASUN SHOP — CART PAGE
// ============================================================

(() => {

  "use strict";


  // ----------------------------------------------------------
  // Elements
  // ----------------------------------------------------------

  const cartItems =
    document.getElementById("cart-items");

  const cartTotal =
    document.getElementById("cart-total");

  const cartCount =
    document.getElementById("cart-count");


  if (!cartItems) {
    return;
  }


  // ----------------------------------------------------------
  // Cart Storage
  // ----------------------------------------------------------

  let cart =
    JSON.parse(
      localStorage.getItem("cart") || "[]"
    );


  // ----------------------------------------------------------
  // Save Cart
  // ----------------------------------------------------------

  function saveCart() {

    localStorage.setItem(
      "cart",
      JSON.stringify(cart)
    );

  }


  // ----------------------------------------------------------
  // Update Header Cart Badge
  // ----------------------------------------------------------

  function updateCartCount() {

    if (!cartCount) {
      return;
    }


    const count =
      cart.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );


    cartCount.textContent = count;


    if (count > 0) {

      cartCount.hidden = false;

    } else {

      cartCount.hidden = true;

    }

  }


  // ----------------------------------------------------------
  // Escape HTML
  // ----------------------------------------------------------

  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  // ----------------------------------------------------------
  // Empty Cart
  // ----------------------------------------------------------

  function renderEmptyCart() {

    cartItems.innerHTML = `

      <div class="empty-cart">

        <div
          class="empty-cart-icon"
          aria-hidden="true"
        >

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
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


    if (cartTotal) {
      cartTotal.textContent = "$0.00";
    }

  }


  // ----------------------------------------------------------
  // Render Cart
  // ----------------------------------------------------------

  async function renderCart() {

    updateCartCount();


    if (!cart.length) {

      renderEmptyCart();

      return;

    }


    try {

      const response =
        await fetch("data/products.json");


      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const products =
        await response.json();


      let total = 0;

      let html = "";


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
            Number(item.quantity) || 1
          );


        const price =
          Number(product.price) || 0;


        const subtotal =
          price * quantity;


        total += subtotal;


        const image =
          escapeHTML(product.image);


        const name =
          escapeHTML(product.name);


        const category =
          escapeHTML(
            product.category || "Product"
          );


        html += `

          <article
            class="cart-item"
            data-product-id="${escapeHTML(product.id)}"
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
                loading="lazy"
                decoding="async"
              >

            </a>


            <!-- Product Content -->

            <div class="cart-item-content">


              <div class="cart-item-main">

                <div>

                  <h2 class="cart-item-title">
                    ${name}
                  </h2>

                  <p class="cart-item-category">
                    ${category}
                  </p>

                </div>


                <strong class="cart-item-price">
                  $${price.toFixed(2)}
                </strong>

              </div>



              <div class="cart-item-bottom">


                <!-- Quantity -->

                <div
                  class="quantity-control"
                  aria-label="Quantity controls"
                >

                  <button
                    type="button"
                    data-action="decrease"
                    data-id="${escapeHTML(product.id)}"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>


                  <span
                    aria-label="Quantity"
                  >
                    ${quantity}
                  </span>


                  <button
                    type="button"
                    data-action="increase"
                    data-id="${escapeHTML(product.id)}"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>

                </div>


                <!-- Subtotal / Remove -->

                <div class="cart-item-actions">

                  <strong class="cart-item-subtotal">
                    $${subtotal.toFixed(2)}
                  </strong>


                  <button
                    type="button"
                    class="remove-btn"
                    data-action="remove"
                    data-id="${escapeHTML(product.id)}"
                  >
                    Remove
                  </button>

                </div>

              </div>

            </div>

          </article>

        `;

      });


      if (!html) {

        renderEmptyCart();

        return;

      }


      cartItems.innerHTML = html;


      if (cartTotal) {

        cartTotal.textContent =
          `$${total.toFixed(2)}`;

      }


    } catch (error) {

      console.error(
        "Error loading cart:",
        error
      );


      cartItems.innerHTML = `

        <div class="cart-error">

          <h3>
            Unable to load your cart
          </h3>

          <p>
            Please refresh the page and try again.
          </p>

          <button
            type="button"
            onclick="location.reload()"
          >
            Try Again
          </button>

        </div>

      `;

    }

  }


  // ----------------------------------------------------------
  // Quantity / Remove Actions
  // ----------------------------------------------------------

  cartItems.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "button[data-action]"
        );


      if (!button) {
        return;
      }


      const id =
        String(button.dataset.id);


      const action =
        button.dataset.action;


      const item =
        cart.find(
          item =>
            String(item.id) === id
        );


      if (action === "remove") {

        cart =
          cart.filter(
            item =>
              String(item.id) !== id
          );

      }


      else if (
        item &&
        action === "increase"
      ) {

        item.quantity =
          Number(item.quantity || 0) + 1;

      }


      else if (
        item &&
        action === "decrease"
      ) {

        item.quantity =
          Number(item.quantity || 1) - 1;


        if (item.quantity <= 0) {

          cart =
            cart.filter(
              item =>
                String(item.id) !== id
            );

        }

      }


      saveCart();

      renderCart();

    }
  );


  // ----------------------------------------------------------
  // Initial Render
  // ----------------------------------------------------------

  renderCart();

})();
