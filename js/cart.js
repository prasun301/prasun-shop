// =================================
// Prasun Shop Cart System
// =================================


// Load cart from browser storage

let cart = JSON.parse(
    localStorage.getItem("cart")
) || [];


// Cart page elements

const cartItems =
document.getElementById("cart-items");


const cartTotal =
document.getElementById("cart-total");



// =================================
// Update Cart Icon Number
// =================================

function updateCartCount(){

    const cartCount =
    document.getElementById("cart-count");


    if(cartCount){

        let totalItems = cart.reduce(
            (sum,item)=> sum + item.quantity,
            0
        );


        cartCount.innerText = totalItems;

    }

}


updateCartCount();




// =================================
// Load Cart Products
// =================================


if(cartItems){


fetch("data/products.json")


.then(response => response.json())


.then(products => {


    let total = 0;


    // Empty cart

    if(cart.length === 0){


        cartItems.innerHTML = `

        <div class="empty-cart">

        <h3>
        Your cart is empty.
        </h3>

        <p>
        Add some smart products from Prasun Shop.
        </p>

        <a href="index.html">
        Continue Shopping
        </a>

        </div>

        `;


        cartTotal.innerHTML =
        "Total: $0.00";


        return;


    }




    // Display products


    cart.forEach(item => {



        const product =
        products.find(
            p => p.id === item.id
        );



        if(product){


            let subtotal =
            product.price * item.quantity;



            total += subtotal;



            cartItems.innerHTML += `


            <div class="cart-card">


            <img 
            src="${product.image}"
            alt="${product.name}"
            >



            <div class="cart-details">


            <h3>
            ${product.name}
            </h3>


            <p>
            Category:
            ${product.category || "Product"}
            </p>


            <p>
            Price:
            $${product.price}
            </p>



            <div class="quantity-box">


            <button onclick="changeQuantity('${product.id}', -1)">
            -
            </button>


            <span>
            ${item.quantity}
            </span>


            <button onclick="changeQuantity('${product.id}', 1)">
            +
            </button>


            </div>



            <p>
            Subtotal:
            $${subtotal.toFixed(2)}
            </p>



            <button 
            class="remove-btn"
            onclick="removeFromCart('${product.id}')">

            Remove

            </button>



            </div>


            </div>


            `;


        }


    });



    cartTotal.innerHTML =
    "Total: $" + total.toFixed(2);



})


.catch(error=>{


console.log(
"Cart loading error:",
error
);


});


}



// =================================
// Change Quantity
// =================================


function changeQuantity(id, change){



    let item =
    cart.find(
        product => product.id === id
    );



    if(item){


        item.quantity += change;



        if(item.quantity <= 0){


            cart =
            cart.filter(
                product => product.id !== id
            );


        }


    }



    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );



    location.reload();


}




// =================================
// Remove Product
// =================================


function removeFromCart(id){



    cart =
    cart.filter(
        item => item.id !== id
    );



    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );



    location.reload();


}
