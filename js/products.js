// Load products from database

fetch("data/products.json")

.then(response => response.json())

.then(products => {


    const productList = document.getElementById("product-list");


    products.forEach(product => {


        productList.innerHTML += `

        <div class="card">


            <img 
            src="${product.image}" 
            alt="${product.name}"
            width="100%"
            >


            <h3>
            ${product.name}
            </h3>


            <p>
            ${product.description}
            </p>


            <h4>
            $${product.price}
            </h4>


            <a href="product.html?id=${product.id}">

                <button>
                View Product
                </button>

            </a>


        </div>

        `;


    });


})

.catch(error => {

console.log(
"Error loading products:",
error
);

});
