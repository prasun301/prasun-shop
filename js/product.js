// =================================
// Prasun Shop - Product Details
// =================================


// Get product ID from URL

const urlParams = new URLSearchParams(
    window.location.search
);


const productId = urlParams.get("id");



const container =
document.getElementById("product-detail");




// =================================
// Load Product
// =================================


fetch("data/products.json")


.then(response => response.json())


.then(products => {


    const product = products.find(

        item => item.id === productId

    );



    if(product){



        container.innerHTML = `


        <div class="card product-detail-card">


            <img

            src="${product.image}"

            alt="${product.name}"

            >



            <p class="product-category">

            ${product.category || "Smart Product"}

            </p>



            <p class="product-rating">

            ⭐ ${product.rating || "5"}

            </p>




            <h1>

            ${product.name}

            </h1>




            <p>

            ${product.description}

            </p>




            <h2>

            $${product.price.toFixed(2)}

            </h2>



            <p class="stock">

            ✅ In Stock

            </p>





            <button onclick="addToCart('${product.id}')">

            🛒 Add to Cart

            </button>



            <button onclick="buyNow('${product.id}')">

            ⚡ Buy Now

            </button>



        </div>


        `;


    }


    else {


        container.innerHTML =

        "<h2>Product not found</h2>";


    }


})



.catch(error => {


console.log(

"Error loading product:",

error

);


});







// =================================
// Add To Cart
// =================================


function addToCart(productId){



    let cart = JSON.parse(

        localStorage.getItem("cart")

    ) || [];




    let existingProduct =

    cart.find(

        item => item.id === productId

    );





    if(existingProduct){


        existingProduct.quantity += 1;


    }


    else {


        cart.push({

            id: productId,

            quantity: 1

        });


    }





    localStorage.setItem(

        "cart",

        JSON.stringify(cart)

    );




    // Update cart number immediately

    if(typeof updateCartCount === "function"){

        updateCartCount();

    }



    alert(

        "Product added to cart!"

    );



}







// =================================
// Buy Now
// =================================


function buyNow(productId){


    addToCart(productId);



    setTimeout(()=>{


        window.location.href =

        "checkout.html";


    },500);



}
