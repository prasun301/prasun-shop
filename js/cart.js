// Load shopping cart


let cart =
JSON.parse(
    localStorage.getItem("cart")
) || [];



const cartItems =
document.getElementById("cart-items");


const cartTotal =
document.getElementById("cart-total");



let total = 0;



fetch("data/products.json")


.then(response => response.json())


.then(products => {



    if(cart.length === 0){


        cartItems.innerHTML =
        "<p>Your cart is empty.</p>";

        return;


    }



    cart.forEach(item => {



        let product =
        products.find(
            product => product.id === item.id
        );



        if(product){



            let itemTotal =
            product.price * item.quantity;



            total += itemTotal;



            cartItems.innerHTML += `


            <div class="card">


                <img
                src="${product.image}"
                width="200"
                >


                <h3>
                ${product.name}
                </h3>


                <p>
                Quantity:
                ${item.quantity}
                </p>


                <p>
                Price:
                $${product.price}
                </p>


                <button onclick="removeFromCart('${product.id}')">

                Remove

                </button>


            </div>


            `;


        }



    });



    cartTotal.innerHTML =
    "Total: $" + total.toFixed(2);



})

.catch(error => {


console.log(
"Cart error:",
error
);


});





// Remove product


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
