<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Shopping Cart | Prasun Shop</title>

<meta
  name="description"
  content="Review your selected products and proceed securely to checkout at Prasun Shop."
>

<link rel="stylesheet" href="css/style.css">

</head>


<body>


<!-- =====================================
     Header
===================================== -->

<header>

<div class="container nav">

<a href="index.html" class="logo" aria-label="Prasun Shop Home">

Prasun Shop<span>.</span>

</a>


<nav aria-label="Main navigation">

<a href="index.html">
Home
</a>


<a href="products.html">
Products
</a>


<a
href="cart.html"
class="cart-icon"
aria-label="Shopping Cart"
>

<svg
width="20"
height="20"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
stroke-width="1.8"
aria-hidden="true"
>

<path d="M6 6h15l-1.5 9h-12z"/>

<path d="M6 6 5 3H2"/>

<circle cx="9" cy="20" r="1"/>

<circle cx="18" cy="20" r="1"/>

</svg>


<span
id="cart-count"
aria-label="Items in cart"
>
0
</span>

</a>

</nav>

</div>

</header>



<!-- =====================================
     Cart Page
===================================== -->

<main class="cart-page">

<div class="container">


<!-- Breadcrumb -->

<nav
class="cart-breadcrumb"
aria-label="Breadcrumb"
>

<a href="index.html">
Home
</a>

<span aria-hidden="true">
/
</span>

<span aria-current="page">
Cart
</span>

</nav>



<!-- Page Header -->

<div class="cart-header">

<div>

<h1>
Your Shopping Cart
</h1>

<p>
Review your selected products before checkout.
</p>

</div>

</div>



<!-- Cart Layout -->

<div class="cart-layout">


<!-- Cart Items -->

<section
class="cart-products"
aria-label="Cart items"
>

<div id="cart-items">

<!-- cart.js renders products here -->

</div>

</section>



<!-- Order Summary -->

<aside
class="cart-summary"
aria-label="Order summary"
>

<div class="cart-summary-inner">

<h2>
Order Summary
</h2>


<div class="cart-summary-row">

<span>
Subtotal
</span>

<strong id="cart-total">
$0.00
</strong>

</div>


<p class="cart-summary-note">

Taxes and payment details are calculated at checkout.

</p>


<button
type="button"
class="checkout-button"
onclick="window.location.href='checkout.html'"
>

Proceed to Checkout

</button>


<a
href="products.html"
class="continue-shopping"
>

Continue Shopping

</a>

</div>

</aside>


</div>

</div>

</main>



<script src="js/cart.js"></script>

<script src="js/cart-count.js"></script>


</body>

</html>
