// Prasun Shop JavaScript

let allProducts = [];


// -------------------------
// Smooth scrolling
// -------------------------

document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", function(e) {

        e.preventDefault();

        const target = document.querySelector(
            this.getAttribute("href")
        );

        if(target){

            target.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});


// -------------------------
// Load Products
// -------------------------

fetch("data/products.json")

.then(response => response.json())

.then(products => {

    allProducts = products;

    displayProducts(products);

})

.catch(error => {

    console.log(
        "Error loading products:",
        error
    );

});


// -------------------------
// Display Products
// -------------------------

function displayProducts(products){

    const productList = document.getElementById("product-list");

    if(!productList) return;


    productList.innerHTML = "";


    products.forEach(product => {


        productList.innerHTML += `


        <div class="card">


            <img 
            src="${product.image}" 
            alt="${product.name}"
            width="100%"
            >


            <p class="product-category">
            ${product.category || ""}
            </p>


            <p class="product-rating">
            ⭐ ${product.rating || "5"}
            </p>


            <h3>
            ${product.name}
            </h3>


            <p>
            ${product.description}
            </p>


            <h4>
            $${product.price}
            </h4>


            <p class="stock">
            ✅ In Stock
            </p>


            <button onclick="window.location.href='product.html?id=${product.id}'">

            Buy Now

            </button>


        </div>


        `;


    });


}


// -------------------------
// Product Search
// -------------------------

const searchInput = document.getElementById("searchInput");


if(searchInput){


    searchInput.addEventListener("input", function(){


        const keyword = this.value.toLowerCase();


        const filteredProducts = allProducts.filter(product =>


            product.name.toLowerCase().includes(keyword)


        );


        displayProducts(filteredProducts);


    });


}


// -------------------------
// Newsletter
// -------------------------

const subscribeButton = document.querySelector(".contact button");


if(subscribeButton){

    subscribeButton.addEventListener("click", function(){


        const email = document.querySelector(".contact input").value;


        if(email === ""){


            alert(
                "Please enter your email address."
            );


        }

        else {


            alert(
                "Thank you for subscribing to Prasun Shop!"
            );


            document.querySelector(".contact input").value = "";


        }


    });


}
