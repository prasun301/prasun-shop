// Prasun Shop JavaScript

// -------------------------
// Smooth scrolling
// -------------------------

document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", function(e) {

        e.preventDefault();

        const target = document.querySelector(this.getAttribute("href"));

        if (target) {

            target.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});

// -------------------------
// Load Featured Products
// -------------------------

fetch("data/products.json")
.then(response => response.json())
.then(products => {

    const productList = document.getElementById("product-list");

    if (!productList) return;

    products.forEach(product => {

        productList.innerHTML += `

        <div class="card">

            <img
                src="${product.image}"
                alt="${product.name}"
                width="100%"
            >

            <p class="product-category">${product.category}</p>

<p class="product-rating">
⭐ ${product.rating}
</p>

<h3>${product.name}</h3>

<p>${product.description}</p>

<h4>$${product.price}</h4>

<p class="stock">
✅ In Stock (${product.stock})
</p>

<button onclick="window.location.href='product.html?id=${product.id}'">
    Buy Now
</button>

        </div>

        `;

    });

})
.catch(error => {

    console.error("Error loading products:", error);

});

// -------------------------
// Newsletter
// -------------------------

const subscribeButton = document.querySelector(".contact button");

if (subscribeButton) {

    subscribeButton.addEventListener("click", function() {

        const email = document.querySelector(".contact input").value;

        if (email === "") {

            alert("Please enter your email address.");

        } else {

            alert("Thank you for subscribing to Prasun Shop!");

            document.querySelector(".contact input").value = "";

        }

    });

}
