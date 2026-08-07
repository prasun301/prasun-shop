// Load all products
fetch("data/products.json")
.then(response => response.json())
.then(products => {
const productList = document.getElementById("product-list");
    // Load all products
fetch("data/products.json")
.then(response => response.json())
.then(products => {
const productList = document.getElementById("product-list");
    
    // Read category from URL
    const params = new URLSearchParams(window.location.search);
    const selectedCategory = params.get("category");
    console.log("URL:", window.location.href);
    console.log("Category:", selectedCategory);
    console.log(products);

    // Filter products if category exists
    let filteredProducts = products;

    if (selectedCategory) {
        filteredProducts = products.filter(product => {
            console.log(product.category, "==", selectedCategory);
            return product.category === selectedCategory;
        });

        // Change page heading
        const heading = document.querySelector("h2");
        if (heading) {
            heading.textContent = selectedCategory;
        }
    }

    // Show message if no products
    if (filteredProducts.length === 0) {
        productList.innerHTML = `
            <p style="text-align:center;grid-column:1/-1;">
                No products found in this category.
            </p>
        `;
        return;
    }

    // Display products with high-performance single-pass rendering
    productList.innerHTML = filteredProducts.map(product => `
        <div class="card">
            <img
                src="${product.image}"
                alt="${product.name}"
                width="100%">

            <p class="product-category">
                ${product.category}
            </p>

            <h3>${product.name}</h3>

            <p>${product.description}</p>

            <h4>$${product.price}</h4>

            <a href="product.html?id=${product.id}">
                <button>View Product</button>
            </a>
        </div>
    `).join("");
})
.catch(error => {
    console.log("Error loading products:", error);
});

```
