// =================================
// Prasun Shop Cart Icon Counter
// =================================


function updateCartCount(){


    let cart = JSON.parse(

        localStorage.getItem("cart")

    ) || [];



    let totalItems = cart.reduce(

        (sum,item)=> sum + item.quantity,

        0

    );



    const cartCount =

    document.getElementById("cart-count");



    if(cartCount){


        cartCount.innerText = totalItems;


    }


}



updateCartCount();
