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



        let featuresHTML = "";



        if(product.features){


            featuresHTML = `


            <div class="product-section">


            <h3>
            Key Features
            </h3>


            <ul>


            ${
                product.features.map(
                    
                    feature =>

                    `<li>✓ ${feature}</li>`

                ).join("")
            }


            </ul>


            </div>


            `;


        }






        let specificationsHTML = "";



        if(product.specifications){


            specificationsHTML = `


            <div class="product-section">


            <h3>
            Specifications
            </h3>



            <table class="spec-table">


            ${
                Object.entries(product.specifications)

                .map(

                    ([key,value]) =>


                    `

                    <tr>

                    <td>
                    ${key}
                    </td>


                    <td>
                    ${value}
                    </td>


                    </tr>


                    `


                )

                .join("")
            }



            </table>


            </div>


            `;


        }







        container.innerHTML = `



        <div class="card product-detail-card">





            <img

            class="product-main-image"

            src="${product.image}"

            alt="${product.name}"

            >





            <p class="product-category">

            Category:
            ${product.category || "Smart Product"}

            </p>





            <p class="product-sku">

            SKU:
            ${product.sku || "N/A"}

            </p>






            <p class="product-rating">

            ⭐ ${product.rating || 5}/5

            </p>






            <h1>

            ${product.name}

            </h1>






            <p class="product-description">

            ${product.description}

            </p>







            ${featuresHTML}





            ${specificationsHTML}








            <h2 class="product-price">

            $${product.price.toFixed(2)}

            </h2>







            <p class="stock">

            ✅ In Stock

            </p>








            <button 

            onclick="addToCart('${product.id}')">

            🛒 Add to Cart

            </button>






            <button 

            onclick="buyNow('${product.id}')">

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





    let existingProduct = cart.find(

        item => item.id === productId

    );






    if(existingProduct){



        existingProduct.quantity += 1;



    }


    else {



        cart.push({


            id: productId,


            quantity:1


        });



    }







    localStorage.setItem(

        "cart",

        JSON.stringify(cart)

    );








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



    let cart = JSON.parse(

        localStorage.getItem("cart")

    ) || [];





    let existingProduct = cart.find(

        item => item.id === productId

    );






    if(!existingProduct){



        cart.push({


            id:productId,


            quantity:1


        });



    }






    localStorage.setItem(

        "cart",

        JSON.stringify(cart)

    );







    if(typeof updateCartCount === "function"){


        updateCartCount();


    }







    window.location.href =

    "checkout.html";



}
