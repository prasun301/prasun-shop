// Prasun Shop JavaScript


// Smooth scrolling for navigation links

document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", function(e) {

        e.preventDefault();

        const target = document.querySelector(
            this.getAttribute("href")
        );

        if(target){

            target.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});





// Buy Now button action

const buyButtons = document.querySelectorAll(".card button");


buyButtons.forEach(button => {

    button.addEventListener("click", function(){

        alert(
            "Thank you for your interest! Product checkout will be available soon."
        );

    });

});





// Newsletter subscription

const subscribeButton = document.querySelector(".contact button");


if(subscribeButton){

    subscribeButton.addEventListener("click", function(){

        const email = document.querySelector(".contact input").value;


        if(email === ""){

            alert(
                "Please enter your email address."
            );

        }

        else {

            alert(
                "Thank you for subscribing to Prasun Shop!"
            );


            document.querySelector(".contact input").value = "";

        }


    });

}
