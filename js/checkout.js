// Load checkout information


let cart =
JSON.parse(
    localStorage.getItem("cart")
) || [];



const orderSummary =
document.getElementById("order-summary");



let total = 0;



fetch("data/products.json")


.then(response => response.json())


.then(products => {



    if(cart.length === 0){


        orderSummary.innerHTML =
        "<p>Your cart is empty.</p>";

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



            orderSummary.innerHTML += `


            <div class="card">


            <h3>
            ${product.name}
            </h3>


            <p>
            Quantity:
            ${item.quantity}
            </p>


            <p>
            Subtotal:
            $${subtotal.toFixed(2)}
            </p>


            </div>


            `;


        }


    });



    orderSummary.innerHTML += `


    <h3>
    Total:
    $${total.toFixed(2)}
    </h3>


    `;



});





// Place order


document
.getElementById("checkout-form")
.addEventListener(
"submit",
function(event){


    event.preventDefault();



    let name =
    document.getElementById("name").value;



    fetch("https://prasun-shop-api.prasun301.workers.dev/", {


    method: "POST",


    headers: {

        "Content-Type": "application/json"

    },


    body: JSON.stringify({

        customerName: name,

        email:
        document.getElementById("email").value,


        phone:
        document.getElementById("phone").value,


        address:
        document.getElementById("address").value,


        cart: cart,

        total: total


    })


})


.then(response => response.json())


.then(data => {


    console.log(
        "Order sent:",
        data
    );


    localStorage.removeItem("cart");


    window.location.href =
    "order-success.html";


})


.catch(error => {


    console.log(
        "Order error:",
        error
    );


});


});
