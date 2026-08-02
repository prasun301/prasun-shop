// Load cart


let cart = JSON.parse(
    localStorage.getItem("cart")
) || [];


const cartItems =
document.getElementById("cart-items");


const cartTotal =
document.getElementById("cart-total");



if(cart.length === 0){

    cartItems.innerHTML =
    "<p>Your cart is empty.</p>";

    cartTotal.innerHTML =
    "Total: $0.00";

}


else {


fetch("data/products.json")


.then(response => response.json())


.then(products => {


    let total = 0;


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
"Error loading cart:",
error
);

});


}



// Remove item


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
