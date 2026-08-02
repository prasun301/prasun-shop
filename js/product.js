// Load single product


const urlParams = new URLSearchParams(
    window.location.search
);


const productId = urlParams.get("id");



fetch("data/products.json")


.then(response => response.json())


.then(products => {


    const product = products.find(
        item => item.id === productId
    );


    const container =
    document.getElementById("product-detail");



    if(product){


        container.innerHTML = `


        <div class="card">


            <img
            src="${product.image}"
            alt="${product.name}"
            width="100%"
            >


            <h1>
            ${product.name}
            </h1>


            <p>
            ${product.description}
            </p>


            <h2>
            $${product.price}
            </h2>


            <button onclick="addToCart('${product.id}')">

            Add to Cart

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
        "Error:",
        error
    );

});





// Add to cart function


function addToCart(productId){


    let cart =
    JSON.parse(
        localStorage.getItem("cart")
    ) || [];



    cart.push(productId);



    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );



    alert(
        "Product added to cart!"
    );


}
