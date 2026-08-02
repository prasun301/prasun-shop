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



    alert(
        "Thank you " + name +
        "! Your order has been received."
    );



    localStorage.removeItem("cart");



    window.location.href =
    "index.html";


});
