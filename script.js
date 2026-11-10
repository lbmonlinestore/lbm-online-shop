
/* =====================================
   LBM ONLINE SHOP
   SHOPPING SYSTEM
===================================== */

// YOUR WHATSAPP NUMBER
const WHATSAPP_NUMBER = "260969034955";

// 
// ======================================
// LBM ONLINE SHOP - PRODUCT CATALOGUE
// ======================================

const products = [
    {
        id: 1,
        name: "Classic Men's Shirt",
        description: "Smart casual shirt for everyday wear.",
        price: 450,
        image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 2,
        name: "Ladies Fashion Dress",
        description: "A stylish dress for different occasions.",
        price: 550,
        image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 3,
        name: "Casual T-Shirt",
        description: "Comfortable everyday T-shirt.",
        price: 180,
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 4,
        name: "Ladies Handbag",
        description: "A fashionable accessory for your outfit.",
        price: 450,
        image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 5,
        name: "Men's Sneakers",
        description: "Casual footwear for everyday style.",
        price: 1450,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 6,
        name: "Ladies Top",
        description: "A versatile top for casual outfits.",
        price: 500,
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 7,
        name: "Premium Men's Suit",
        description: "Elegant formal suit for business, weddings and special occasions.",
        price: 1900,
        image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 8,
        name: "Elegant Women's Dress",
        description: "Beautiful and stylish dress for special occasions.",
        price: 650,
        image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80"
    }
];

// SHOPPING CART
let cart = [];

// HTML ELEMENTS
const productList = document.getElementById("product-list");
const cartSection = document.getElementById("cart-section");
const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const checkoutButton = document.getElementById("checkout-button");

// FORMAT PRICE IN KWACHA
function formatPrice(amount) {
    return "K" + amount.toFixed(2);
}

// DISPLAY PRODUCTS
function displayProducts() {

    productList.innerHTML = products.map(product => `
        <article class="product-card">

            <img
                src="${product.image}"
                alt="${product.name}"
                loading="lazy"
            >

            <div class="product-info">

                <h3>${product.name}</h3>

                <p class="product-description">
                    ${product.description}
                </p>

                <p class="product-price">
                    ${formatPrice(product.price)}
                </p>

                <button
                    class="add-button"
                    onclick="addToCart(${product.id})"
                >
                    ADD TO CART
                </button>

            </div>
        </article>
    `).join("");
}

// ADD PRODUCT TO CART
function addToCart(productId) {

    const product = products.find(
        item => item.id === productId
    );

    if (!product) return;

    const existingItem = cart.find(
        item => item.id === productId
    );

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    updateCart();

    cartSection.classList.add("open");

    cartSection.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// CHANGE PRODUCT QUANTITY
function changeQuantity(productId, change) {

    const item = cart.find(
        product => product.id=== productId
    );

    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(
            product => product.id !== productId
        );
    }

    updateCart();
}

// UPDATE SHOPPING CART
function updateCart() {

    const totalItems = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const totalPrice = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    cartCount.textContent = totalItems;

    cartTotal.textContent = formatPrice(totalPrice);

    // EMPTY CART
    if (cart.length === 0) {

        cartItems.innerHTML = `
            <p>Your cart is empty.</p>
        `;

    } else {

        // DISPLAY CART ITEMS
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">

                <div>
                    <strong>${item.name}</strong>

                    <small>
                        ${formatPrice(item.price)} each
                    </small>
                </div>

                <div class="quantity-controls">

                    <button
                        onclick="changeQuantity(${item.id}, -1)"
                    >−</button>

                    <span>${item.quantity}</span>

                    <button
                        onclick="changeQuantity(${item.id}, 1)"
                    >+</button>

                </div>

            </div>
        `).join("");
    }

    checkoutButton.disabled = cart.length === 0;
}

// OPEN SHOPPING CART
document.getElementById("cart-button")
    .addEventListener("click", () => {

        cartSection.classList.add("open");

        cartSection.scrollIntoView({
            behavior: "smooth"
        });
    });

// CLOSE SHOPPING CART
document.getElementById("close-cart")
    .addEventListener("click", () => {

        cartSection.classList.remove("open");
    });

// WHATSAPP CHECKOUT
checkoutButton.addEventListener("click", () => {

    if (cart.length === 0) {
        alert("Your shopping cart is empty.");
        return;
    }

    let message =
        "Hello LBM Online Shop! I would like to place an order:\n\n";

    cart.forEach(item => {

        message +=
            item.name +
            " x " +
            item.quantity +
            " = " +
            formatPrice(item.price * item.quantity) +
            "\n";
    });

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    message += "\nTOTAL: " + formatPrice(total);

    message +=
        "\n\nPlease confirm availability and delivery arrangements.";

    const whatsappLink =
    "https://api.whatsapp.com/send?phone=" +
    WHATSAPP_NUMBER +
    "&text=" +
    encodeURIComponent(message);

window.location.assign(whatsappLink);
});
// AUTOMATIC FOOTER YEAR
document.getElementById("year").textContent =
    new Date().getFullYear();

// START THE ONLINE SHOP
displayProducts();

updateCart();

// ======================================
// LBM WHATSAPP CHECKOUT
// ======================================


checkoutButton.addEventListener("click", function () {

    if (cart.length === 0) {
        alert("Your shopping cart is empty.");
        return;
    }

    const checkoutNumber = "260969034955";

    let totalPrice = 0;

    let message = "HELLO LBM ONLINE SHOP!\n";
    message += "I would like to place an order.\n\n";
    message += "MY ORDER:\n";

    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        totalPrice += subtotal;

        message += item.name + "\n";
        message += "Quantity: " + item.quantity + "\n";
        message += "Price: " + formatPrice(item.price) + "\n";
        message += "Subtotal: " + formatPrice(subtotal) + "\n\n";
    });

    message += "TOTAL: " + formatPrice(totalPrice);
    message += "\n\nPlease confirm my order. Thank you!";

    const whatsappURL =
        "https://api.whatsapp.com/send?phone=" +
        checkoutNumber +
        "&text=" +
        encodeURIComponent(message);

    const newTab = window.open(whatsappURL, "_blank");

    if (!newTab) {
        alert("Please allow pop-ups for this website.");
    }

});
