let cart =
JSON.parse(
    localStorage.getItem("cart")
) || [];


const cartItems =
document.getElementById("cart-items");


const cartTotal =
document.getElementById("cart-total");



fetch("data/products.json")


.then(response => response.json())


.then(products => {


    let total = 0;


    if(cart.length === 0){


        cartItems.innerHTML =
        "<p>Your cart is empty.</p>";

        cartTotal.innerHTML =
        "Total: $0.00";

        return;

    }



    cart.forEach(item => {



        let product =
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
            Price: $${product.price}
            </p>


            <button onclick="changeQuantity('${product.id}', -1)">
            -
            </button>


            <span>
            ${item.quantity}
            </span>


            <button onclick="changeQuantity('${product.id}', 1)">
            +
            </button>


            <p>
            Subtotal:
            $${subtotal.toFixed(2)}
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



});





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
