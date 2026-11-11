
/* =====================================================
   LBM ONLINE SHOP
   COMPLETE STOREFRONT SYSTEM
   SUPABASE + PRODUCT GALLERY + CART
   WHATSAPP CHECKOUT + ORDER CANCELLATION
   ===================================================== */


/* =====================================================
   1. SUPABASE CONNECTION
   ===================================================== */

const SUPABASE_URL = "https://toovotqrcsulhgdrcsmn.supabase.co";

const SUPABASE_KEY = "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

if (!window.supabase) {
    throw new Error("Supabase library has not loaded.");
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =====================================================
   2. SHOP SETTINGS
   ===================================================== */

const WHATSAPP_NUMBER = "260969034955";
const CURRENCY = "ZMW";
const CART_KEY = "lbmShoppingCart";
const BACKGROUND_KEY = "shop_background";

const FALLBACK_IMAGE =
"https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&auto=format&fit=crop";


/* =====================================================
   3. DEFAULT PRODUCT IMAGES
   ===================================================== */

const productPictures = {

    smartShoes:
    "https://images.unsplash.com/photo-1525441451246-3970221d4cbf?w=700&auto=format&fit=crop",

    sneakers:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&auto=format&fit=crop",

    ladiesTop:
    "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=700&auto=format&fit=crop",

    ladiesDress:
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700&auto=format&fit=crop",

    mensSuit:
    "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=700&auto=format&fit=crop",

    mensShirt:
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700&auto=format&fit=crop",

    handbag:
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700&auto=format&fit=crop",

    jeans:
    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=700&auto=format&fit=crop"

};


/* =====================================================
   4. WEBSITE ELEMENTS
   ===================================================== */

const productList = document.getElementById("product-list");

const cartButton = document.getElementById("cart-button");
const cartCount = document.getElementById("cart-count");

const cartSection = document.getElementById("cart-section");
const closeCartButton = document.getElementById("close-cart");

const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");

const checkoutButton = document.getElementById("checkout-button");


/* =====================================================
   5. SHOP DATA
   ===================================================== */

let products = [];
let cart = [];

let productImageIndices = {};

let previewProductId = null;
let previewImageIndex = 0;


/* =====================================================
   6. LOAD SAVED CART
   ===================================================== */

try {

    const savedCart = JSON.parse(
        localStorage.getItem(CART_KEY)
    );

    cart = Array.isArray(savedCart) ? savedCart : [];

} catch (error) {

    console.warn("Saved cart could not be loaded.", error);

    cart = [];

}


/* =====================================================
   7. HELPER FUNCTIONS
   ===================================================== */

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);

}


function formatPrice(amount) {

    return "K" + Number(amount || 0).toLocaleString("en-ZM", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}


function saveCart() {

    try {

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error("Could not save shopping cart:", error);

    }

}


function isValidImageURL(url) {

    if (typeof url !== "string") return false;

    try {

        const parsed = new URL(url.trim());

        return parsed.protocol === "https:" ||
               parsed.protocol === "http:";

    } catch (error) {

        return false;

    }

}


function getStock(product) {

    const stock = Number(product?.stock);

    return Number.isFinite(stock) && stock > 0
        ? Math.floor(stock)
        : 0;

}


/* =====================================================
   8. DEFAULT IMAGE SELECTION
   ===================================================== */

function getFallbackProductImage(product) {

    const name = String(product.name || "").toLowerCase();

    const category = String(product.category || "").toLowerCase();

    const searchText = name + " " + category;

    if (
        searchText.includes("smart shoe") ||
        searchText.includes("formal shoe") ||
        searchText.includes("oxford shoe") ||
        searchText.includes("dress shoe")
    ) {
        return productPictures.smartShoes;
    }

    if (
        searchText.includes("sneaker") ||
        searchText.includes("trainer") ||
        searchText.includes("sports shoe")
    ) {
        return productPictures.sneakers;
    }

    if (
        searchText.includes("ladies top") ||
        searchText.includes("women top") ||
        searchText.includes("blouse")
    ) {
        return productPictures.ladiesTop;
    }

    if (
        searchText.includes("dress") ||
        searchText.includes("gown")
    ) {
        return productPictures.ladiesDress;
    }

    if (searchText.includes("suit")) {
        return productPictures.mensSuit;
    }

    if (searchText.includes("shirt")) {
        return productPictures.mensShirt;
    }

    if (
        searchText.includes("handbag") ||
        searchText.includes("hand bag") ||
        searchText.includes("purse")
    ) {
        return productPictures.handbag;
    }

    if (searchText.includes("jeans")) {
        return productPictures.jeans;
    }

    return FALLBACK_IMAGE;

}


/* =====================================================
   9. MULTIPLE PRODUCT IMAGE SUPPORT
   ===================================================== */

function getProductImages(product) {

    let images = [];

    if (Array.isArray(product.images)) {

        images = product.images;

    } else if (typeof product.images === "string") {

        try {

            const parsed = JSON.parse(product.images);

            if (Array.isArray(parsed)) {
                images = parsed;
            }

        } catch (error) {

            console.warn(
                "Product image data could not be parsed:",
                error
            );

        }

    }

    const mainImage = product.image;

    if (
        isValidImageURL(mainImage) &&
        !images.includes(mainImage)
    ) {

        images.unshift(mainImage);

    }

    images = [...new Set(

        images
            .filter(isValidImageURL)
            .map(url => url.trim())

    )];

    if (images.length === 0) {

        images.push(
            getFallbackProductImage(product)
        );

    }

    return images;

}


function getProductImage(product) {

    return getProductImages(product)[0];

}


/* =====================================================
   10. LOAD WEBSITE BACKGROUND
   ===================================================== */

async function loadBackground() {

    const hero = document.querySelector(".hero");

    if (!hero) return;

    try {

        const { data, error } = await supabaseClient
            .from("site_settings")
            .select("setting_value")
            .eq("setting_key", BACKGROUND_KEY)
            .maybeSingle();

        if (error) throw error;

        if (!data?.setting_value) return;

        const backgroundURL = data.setting_value.trim();

        if (!isValidImageURL(backgroundURL)) return;

        hero.style.backgroundImage =
            `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${backgroundURL.replace(/["\\]/g, "")}")`;

        hero.style.backgroundSize = "cover";
        hero.style.backgroundPosition = "center center";
        hero.style.backgroundRepeat = "no-repeat";

        console.log("LBM background loaded.");

    } catch (error) {

        console.error("Background loading error:", error);

    }

}


/* =====================================================
   11. LOAD PRODUCTS FROM SUPABASE
   ===================================================== */

async function loadProducts() {

    if (!productList) {

        console.error("Product list element not found.");

        return;

    }

    productList.innerHTML = "<p>Loading products...</p>";

    try {

        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        products = data || [];

        productImageIndices = {};

        if (products.length === 0) {

            productList.innerHTML =
                "<p>No products are currently available.</p>";

            updateCart();

            return;

        }

        displayProducts();

        updateCart();

        console.log(
            "LBM products loaded:",
            products.length
        );

    } catch (error) {

        console.error("Product loading error:", error);

        productList.innerHTML =
            "<p>Products could not be loaded. Please refresh the page.</p>";

    }

}


/* =====================================================
   12. DISPLAY PRODUCTS
   ===================================================== */

function displayProducts() {

    if (!productList) return;

    productList.innerHTML = products.map(product => {

        const images = getProductImages(product);

        const image = images[0];

        const stock = getStock(product);

        const available = stock > 0;

        const id = String(product.id);

        productImageIndices[id] = 0;

        return `

            <article class="product-card">

                <div class="product-image-container">

                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(product.name)}"
                        class="product-image"
                        loading="lazy"
                        data-action="preview-image"
                        data-id="${escapeHTML(id)}"
                    >

                    ${
                        images.length > 1
                        ? `

                            <button
                                type="button"
                                class="lbm-gallery-arrow lbm-gallery-prev"
                                data-action="gallery-prev"
                                data-id="${escapeHTML(id)}"
                                aria-label="Previous picture"
                            >‹</button>

                            <button
                                type="button"
                                class="lbm-gallery-arrow lbm-gallery-next"
                                data-action="gallery-next"
                                data-id="${escapeHTML(id)}"
                                aria-label="Next picture"
                            >›</button>

                            <span class="lbm-image-counter">
                                1 / ${images.length}
                            </span>

                        `
                        : ""
                    }

                </div>

                <div class="product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p class="product-description">
                        ${escapeHTML(product.description || "")}
                    </p>

                    <p class="product-category">
                        ${escapeHTML(product.category || "")}
                    </p>

                    <p class="product-price">
                        ${formatPrice(product.price)}
                    </p>

                    <p class="stock-label">
                        ${available ? stock + " in stock" : "Out of stock"}
                    </p>

                    <button
                        type="button"
                        class="add-button"
                        data-action="add"
                        data-id="${escapeHTML(id)}"
                        ${available ? "" : "disabled"}
                    >
                        ${available ? "Add to Cart" : "Out of Stock"}
                    </button>

                </div>

            </article>

        `;

    }).join("");

    // Prevent broken image icons.

    productList.querySelectorAll(".product-image").forEach(image => {

        image.addEventListener("error", function() {

            this.onerror = null;
            this.src = FALLBACK_IMAGE;

        });

    });

}


/* =====================================================
   13. CHANGE PRODUCT CARD IMAGE
   ===================================================== */

function changeProductImage(productId, direction) {

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    const images = getProductImages(product);

    if (images.length <= 1) return;

    const id = String(productId);

    let index = productImageIndices[id] || 0;

    index = (index + direction + images.length) % images.length;

    productImageIndices[id] = index;

    const card = [...productList.querySelectorAll(".product-card")]
        .find(element => {

            const button = element.querySelector('[data-action="add"]');

            return button && String(button.dataset.id) === id;

        });

    if (!card) return;

    const image = card.querySelector(".product-image");

    const counter = card.querySelector(".lbm-image-counter");

    if (image) {

        image.onerror = function() {
            this.onerror = null;
            this.src = FALLBACK_IMAGE;
        };

        image.src = images[index];

        image.alt =
            product.name + " - picture " + (index + 1);

    }

    if (counter) {

        counter.textContent =
            (index + 1) + " / " + images.length;

    }

}


/* =====================================================
   14. ADD TO CART
   ===================================================== */

function addToCart(productId) {

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    const stock = getStock(product);

    if (stock < 1) {

        alert("This product is out of stock.");

        return;

    }

    const existingItem = cart.find(
        item => String(item.id) === String(productId)
    );

    if (existingItem) {

        if (Number(existingItem.quantity) >= stock) {

            alert("Sorry, there is no more stock available.");

            return;

        }

        existingItem.quantity =
            Number(existingItem.quantity) + 1;

    } else {

        cart.push({

            ...product,

            quantity: 1

        });

    }

    saveCart();

    updateCart();

    if (cartSection) {

        cartSection.classList.add("open");

    }

}


/* =====================================================
   15. CHANGE CART QUANTITY
   ===================================================== */

function changeQuantity(productId, change) {

    const item = cart.find(
        product => String(product.id) === String(productId)
    );

    if (!item) return;

    const product = products.find(
        product => String(product.id) === String(productId)
    );

    if (!product) return;

    const maximumStock = getStock(product);

    const newQuantity =
        Number(item.quantity) + Number(change);

    if (newQuantity > maximumStock) {

        alert("You have reached the available stock.");

        return;

    }

    if (newQuantity <= 0) {

        cart = cart.filter(
            product => String(product.id) !== String(productId)
        );

    } else {

        item.quantity = newQuantity;

    }

    saveCart();

    updateCart();

}


/* =====================================================
   16. UPDATE SHOPPING CART
   ===================================================== */

function updateCart() {

    if (!cartItems || !cartTotal) return;

    // Remove products no longer available.

    cart = cart.filter(item => {

        const currentProduct = products.find(
            product => String(product.id) === String(item.id)
        );

        return currentProduct && getStock(currentProduct) > 0;

    });

    // Refresh current product information.

    cart = cart.map(item => {

        const currentProduct = products.find(
            product => String(product.id) === String(item.id)
        );

        if (!currentProduct) return item;

        const quantity = Math.min(
            Math.max(1, Number(item.quantity) || 1),
            getStock(currentProduct)
        );

        return {

            ...currentProduct,

            quantity

        };

    });

    const totalQuantity = cart.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
    );

    const totalPrice = cart.reduce(
        (sum, item) =>
            sum + Number(item.price) * Number(item.quantity),
        0
    );

    if (cartCount) {

        cartCount.textContent = totalQuantity;

    }

    if (cart.length === 0) {

        cartItems.innerHTML =
            "<p>Your shopping cart is empty.</p>";

    } else {

        cartItems.innerHTML = cart.map(item => {

            return `

                <div class="cart-item">

                    <img
                        src="${escapeHTML(getProductImage(item))}"
                        alt="${escapeHTML(item.name)}"
                        class="cart-product-image"
                    >

                    <div class="cart-item-details">

                        <h4>${escapeHTML(item.name)}</h4>

                        <p>${formatPrice(item.price)}</p>

                        <div class="quantity-controls">

                            <button
                                type="button"
                                data-action="decrease"
                                data-id="${escapeHTML(item.id)}"
                                aria-label="Decrease quantity"
                            >−</button>

                            <span>${item.quantity}</span>

                            <button
                                type="button"
                                data-action="increase"
                                data-id="${escapeHTML(item.id)}"
                                aria-label="Increase quantity"
                            >+</button>

                        </div>

                    </div>

                    <strong>
                        ${formatPrice(
                            Number(item.price) * Number(item.quantity)
                        )}
                    </strong>

                </div>

            `;

        }).join("");

    }

    // Handle broken cart images.

    cartItems.querySelectorAll("img").forEach(image => {

        image.addEventListener("error", function() {

            this.onerror = null;
            this.src = FALLBACK_IMAGE;

        });

    });

    cartTotal.textContent = formatPrice(totalPrice);

    if (checkoutButton) {

        checkoutButton.disabled = cart.length === 0;

    }

    saveCart();

}


/* =====================================================
   17. IMAGE PREVIEW MODAL
   ===================================================== */

function createImagePreview() {

    let modal = document.getElementById("lbm-image-preview");

    if (modal) return modal;

    modal = document.createElement("div");

    modal.id = "lbm-image-preview";

    modal.innerHTML = `

        <div class="lbm-preview-content">

            <button
                type="button"
                id="lbm-preview-close"
                aria-label="Close gallery"
            >×</button>

            <div class="lbm-preview-image-area">

                <button
                    type="button"
                    id="lbm-preview-prev"
                    class="lbm-preview-arrow"
                    aria-label="Previous picture"
                >‹</button>

                <img id="lbm-preview-image" alt="">

                <button
                    type="button"
                    id="lbm-preview-next"
                    class="lbm-preview-arrow"
                    aria-label="Next picture"
                >›</button>

            </div>

            <p id="lbm-preview-counter"></p>

            <div id="lbm-preview-thumbnails"></div>

            <h3 id="lbm-preview-title"></h3>

            <p id="lbm-preview-price"></p>

        </div>

    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {

        if (
            event.target === modal ||
            event.target.id === "lbm-preview-close"
        ) {

            closeImagePreview();

        }

    });

    document.getElementById("lbm-preview-prev")
        .addEventListener("click", () => {
            changePreviewImage(-1);
        });

    document.getElementById("lbm-preview-next")
        .addEventListener("click", () => {
            changePreviewImage(1);
        });

    document.getElementById("lbm-preview-thumbnails")
        .addEventListener("click", event => {

            const thumbnail = event.target.closest(
                "[data-preview-index]"
            );

            if (!thumbnail) return;

            previewImageIndex = Number(
                thumbnail.dataset.previewIndex
            );

            productImageIndices[previewProductId] =
                previewImageIndex;

            renderPreviewGallery();

        });

    return modal;

}


/* =====================================================
   18. OPEN PRODUCT IMAGE PREVIEW
   ===================================================== */

function previewProductImage(productId) {

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    previewProductId = String(productId);

    previewImageIndex =
        productImageIndices[previewProductId] || 0;

    createImagePreview();

    document.getElementById("lbm-preview-title").textContent =
        product.name;

    document.getElementById("lbm-preview-price").textContent =
        formatPrice(product.price);

    renderPreviewGallery();

    document.getElementById("lbm-image-preview").style.display =
        "flex";

    document.body.style.overflow = "hidden";

}


/* =====================================================
   19. RENDER PREVIEW GALLERY
   ===================================================== */

function renderPreviewGallery() {

    const product = products.find(
        item => String(item.id) === previewProductId
    );

    if (!product) return;

    const images = getProductImages(product);

    previewImageIndex =
        ((previewImageIndex % images.length) + images.length)
        % images.length;

    const image = document.getElementById("lbm-preview-image");

    const counter = document.getElementById("lbm-preview-counter");

    const thumbnails =
        document.getElementById("lbm-preview-thumbnails");

    const previousButton =
        document.getElementById("lbm-preview-prev");

    const nextButton =
        document.getElementById("lbm-preview-next");

    image.onerror = function() {

        this.onerror = null;
        this.src = FALLBACK_IMAGE;

    };

    image.src = images[previewImageIndex];

    image.alt =
        product.name + " - picture " + (previewImageIndex + 1);

    counter.textContent =
        "Picture " + (previewImageIndex + 1) +
        " of " + images.length;

    const hasMultiple = images.length > 1;

    previousButton.style.display =
        hasMultiple ? "block" : "none";

    nextButton.style.display =
        hasMultiple ? "block" : "none";

    thumbnails.innerHTML = hasMultiple
        ? images.map((url, index) => `

            <button
                type="button"
                class="lbm-preview-thumbnail ${
                    index === previewImageIndex ? "active" : ""
                }"
                data-preview-index="${index}"
                aria-label="View picture ${index + 1}"
            >

                <img src="${escapeHTML(url)}" alt="">

            </button>

        `).join("")
        : "";

    thumbnails.querySelectorAll("img").forEach(thumb => {

        thumb.addEventListener("error", function() {

            this.onerror = null;
            this.src = FALLBACK_IMAGE;

        });

    });

}


/* =====================================================
   20. CHANGE PREVIEW IMAGE
   ===================================================== */

function changePreviewImage(direction) {

    const product = products.find(
        item => String(item.id) === previewProductId
    );

    if (!product) return;

    const images = getProductImages(product);

    if (images.length <= 1) return;

    previewImageIndex =
        (previewImageIndex + direction + images.length)
        % images.length;

    productImageIndices[previewProductId] =
        previewImageIndex;

    renderPreviewGallery();

}


/* =====================================================
   21. CLOSE IMAGE PREVIEW
   ===================================================== */

function closeImagePreview() {

    const modal = document.getElementById("lbm-image-preview");

    if (modal) {

        modal.style.display = "none";

    }

    document.body.style.overflow = "";

    previewProductId = null;

}


/* =====================================================
   22. PREVIEW KEYBOARD CONTROLS
   ===================================================== */

document.addEventListener("keydown", event => {

    const modal = document.getElementById("lbm-image-preview");

    if (!modal || modal.style.display !== "flex") return;

    if (event.key === "Escape") {

        closeImagePreview();

    }

    if (event.key === "ArrowLeft") {

        changePreviewImage(-1);

    }

    if (event.key === "ArrowRight") {

        changePreviewImage(1);

    }

});


/* =====================================================
   23. IMAGE GALLERY STYLES
   ===================================================== */

const previewStyles = document.createElement("style");

previewStyles.textContent = `

.product-image-container {
    position: relative;
}

.product-image {
    cursor: zoom-in;
}

.lbm-gallery-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 34px;
    height: 38px;
    border: none;
    border-radius: 5px;
    background: rgba(17,17,17,.72);
    color: white;
    font-size: 27px;
    line-height: 1;
    cursor: pointer;
    z-index: 5;
}

.lbm-gallery-prev {
    left: 7px;
}

.lbm-gallery-next {
    right: 7px;
}

.lbm-image-counter {
    position: absolute;
    bottom: 9px;
    right: 9px;
    padding: 5px 9px;
    border-radius: 20px;
    background: rgba(17,17,17,.75);
    color: white;
    font-size: 11px;
}

#lbm-image-preview {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,.88);
    align-items: center;
    justify-content: center;
    padding: 15px;
}

.lbm-preview-content {
    background: white;
    color: #111;
    padding: 15px;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 95vh;
    overflow-y: auto;
    text-align: center;
    position: relative;
}

.lbm-preview-content h3 {
    margin: 12px 0 5px;
}

.lbm-preview-content p {
    margin: 7px 0;
}

.lbm-preview-image-area {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f3ef;
    border-radius: 8px;
    min-height: 180px;
}

.lbm-preview-content img#lbm-preview-image {
    width: 100%;
    max-height: 58vh;
    object-fit: contain;
    border-radius: 8px;
}

#lbm-preview-close {
    position: absolute;
    right: 8px;
    top: 5px;
    border: 0;
    background: white;
    color: #111;
    font-size: 30px;
    cursor: pointer;
    z-index: 10;
    width: 35px;
    height: 35px;
    border-radius: 50%;
}

.lbm-preview-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 42px;
    border: none;
    border-radius: 5px;
    background: rgba(0,0,0,.72);
    color: white;
    font-size: 28px;
    cursor: pointer;
    z-index: 5;
}

#lbm-preview-prev {
    left: 7px;
}

#lbm-preview-next {
    right: 7px;
}

#lbm-preview-counter {
    color: #666;
    font-size: 12px;
}

#lbm-preview-thumbnails {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 7px;
    margin: 12px 0;
}

.lbm-preview-thumbnail {
    width: 55px;
    height: 55px;
    padding: 2px;
    border: 2px solid #ddd;
    border-radius: 5px;
    background: white;
    cursor: pointer;
}

.lbm-preview-thumbnail.active {
    border-color: #c9a44c;
}

.lbm-preview-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

@media(max-width:450px) {

    .lbm-preview-content {
        padding: 10px;
    }

    .lbm-preview-content img#lbm-preview-image {
        max-height: 55vh;
    }

    .lbm-gallery-arrow {
        width: 30px;
        height: 34px;
    }

}

`;

document.head.appendChild(previewStyles);


/* =====================================================
   24. WHATSAPP CHECKOUT + SUPABASE ORDER SAVING
   ===================================================== */

async function checkoutWhatsApp() {

    if (cart.length === 0) {

        alert("Your shopping cart is empty.");

        return;

    }

    const customerName = prompt(
        "Please enter your full name:"
    );

    if (!customerName || !customerName.trim()) return;

    const phone = prompt(
        "Please enter your phone number:"
    );

    if (!phone || !phone.trim()) return;

    const address = prompt(
        "Enter your delivery address or pickup location:"
    );

    if (address === null || !address.trim()) {

        alert("Please enter your delivery address or pickup location.");

        return;

    }

    const orderItems = [];

    let total = 0;

    for (const item of cart) {

        const product = products.find(
            p => String(p.id) === String(item.id)
        );

        if (!product) {

            alert(
                "A product is no longer available. Please refresh."
            );

            return;

        }

        const quantity = Number(item.quantity);

        const price = Number(product.price);

        const stock = getStock(product);

        if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            !Number.isFinite(price) ||
            price < 0
        ) {

            alert("Invalid product information.");

            return;

        }

        if (quantity > stock) {

            alert(
                product.name + " has only " +
                stock + " available."
            );

            return;

        }

        const subtotal = price * quantity;

        total += subtotal;

        orderItems.push({

            product_id: product.id,

            name: product.name,

            image_url: getProductImage(product),

            price: price,

            quantity: quantity,

            subtotal: subtotal

        });

    }

    // Open a window before awaiting Supabase.
    // This helps prevent browser popup blocking.

    const whatsappWindow = window.open(
        "about:blank",
        "_blank"
    );

    const originalButtonText = checkoutButton
        ? checkoutButton.textContent
        : "";

    if (checkoutButton) {

        checkoutButton.disabled = true;

        checkoutButton.textContent = "SUBMITTING ORDER...";

    }

    try {

        // Save the order using the existing Supabase RPC.

        const { data, error } = await supabaseClient.rpc(
            "place_lbm_order",
            {

                p_customer_name: customerName.trim(),

                p_phone: phone.trim(),

                p_address: address.trim(),

                p_items: orderItems,

                p_total: total,

                p_payment_method: "Cash on Delivery"

            }
        );

        if (error) throw error;

        // Accept a scalar ID or common object/array responses.

        let orderId = data;

        if (Array.isArray(data)) {

            orderId = data[0];

        }

        if (orderId && typeof orderId === "object") {

            orderId =
                orderId.order_id ??
                orderId.id ??
                orderId.place_lbm_order;

        }

        if (
            orderId === null ||
            orderId === undefined ||
            orderId === ""
        ) {

            throw new Error(
                "Supabase did not return an order reference."
            );

        }

        // Build WhatsApp message.

        let message = "NEW LBM ONLINE SHOP ORDER\n\n";

        message += "ORDER REFERENCE: LBM-" + orderId + "\n";

        message += "Customer: " + customerName.trim() + "\n";

        message += "Phone: " + phone.trim() + "\n";

        message += "Address: " + address.trim() + "\n\n";

        message += "ORDER DETAILS:\n\n";

        orderItems.forEach(item => {

            message +=
                item.name + "\n" +
                "Quantity: " + item.quantity + "\n" +
                "Price: " + formatPrice(item.price) + "\n" +
                "Subtotal: " + formatPrice(item.subtotal) + "\n" +
                (item.image_url ? "Product image: " + item.image_url + "\n" : "") +
                "\n";

        });

        message += "TOTAL: " + formatPrice(total) + "\n\n";

        message += "Order Reference: LBM-" + orderId + "\n";

        message +=
            "Please confirm availability and delivery.";

        const whatsappURL =
            "https://wa.me/" +
            WHATSAPP_NUMBER +
            "?text=" +
            encodeURIComponent(message);

        // Clear cart only after successful database submission.

        cart = [];

        saveCart();

        updateCart();

        alert(
            "ORDER SUBMITTED SUCCESSFULLY!\n\n" +
            "Your order reference is:\n" +
            "LBM-" + orderId +
            "\n\nKeep this reference if you need to request cancellation."
        );

        if (cartSection) {

            cartSection.classList.remove("open");

        }

        if (whatsappWindow && !whatsappWindow.closed) {

            whatsappWindow.location.href = whatsappURL;

        } else {

            window.location.href = whatsappURL;

        }

    } catch (error) {

        console.error("Checkout error:", error);

        if (whatsappWindow && !whatsappWindow.closed) {

            whatsappWindow.close();

        }

        alert(
            "ORDER SUBMISSION FAILED.\n\n" +
            (error.message || "Unknown error") +
            "\n\nYour cart has been preserved. Please try again."
        );

    } finally {

        if (checkoutButton) {

            checkoutButton.disabled = cart.length === 0;

            checkoutButton.textContent =
                originalButtonText || "CHECKOUT VIA WHATSAPP";

        }

    }

}


/* =====================================================
   25. CUSTOMER ORDER CANCELLATION
   ===================================================== */

function installOrderCancellation() {

    if (!cartSection) {

        console.error("Cart section not found.");

        return;

    }

    if (document.getElementById("lbm-cancel-order-panel")) {

        return;

    }

    const panel = document.createElement("div");

    panel.id = "lbm-cancel-order-panel";

    panel.innerHTML = `

        <div class="lbm-order-tools">

            <h3>Already placed an order?</h3>

            <p>
                You can request cancellation of an order
                that has not yet been processed.
            </p>

            <button
                type="button"
                id="lbm-show-cancel-form"
            >
                CANCEL ORDER
            </button>

            <form id="lbm-cancel-form" style="display:none;">

                <label for="lbm-cancel-reference">
                    Order Reference
                </label>

                <input
                    type="text"
                    id="lbm-cancel-reference"
                    placeholder="Example: LBM-125"
                    required
                >

                <label for="lbm-cancel-phone">
                    Phone Number Used When Ordering
                </label>

                <input
                    type="tel"
                    id="lbm-cancel-phone"
                    placeholder="Enter your phone number"
                    required
                >

                <button
                    type="submit"
                    id="lbm-confirm-cancel"
                >
                    CONFIRM CANCELLATION
                </button>

                <p
                    id="lbm-cancel-message"
                    role="status"
                    aria-live="polite"
                ></p>

            </form>

        </div>

    `;

    cartSection.appendChild(panel);

    const showButton = document.getElementById(
        "lbm-show-cancel-form"
    );

    const form = document.getElementById(
        "lbm-cancel-form"
    );

    const message = document.getElementById(
        "lbm-cancel-message"
    );

    const confirmButton = document.getElementById(
        "lbm-confirm-cancel"
    );

    showButton.addEventListener("click", () => {

        form.style.display =
            form.style.display === "none" ? "block" : "none";

    });

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const reference = document.getElementById(
            "lbm-cancel-reference"
        ).value.trim();

        const phone = document.getElementById(
            "lbm-cancel-phone"
        ).value.trim();

        const orderId = reference.replace(/^LBM-/i, "");

        if (!/^\d+$/.test(orderId)) {

            message.textContent =
                "Please enter a valid order reference.";

            message.style.color = "red";

            return;

        }

        if (!phone) {

            message.textContent =
                "Please enter your phone number.";

            message.style.color = "red";

            return;

        }

        const confirmed = confirm(
            "Are you sure you want to request cancellation of order LBM-" +
            orderId + "?"
        );

        if (!confirmed) return;

        confirmButton.disabled = true;

        confirmButton.textContent = "PROCESSING...";

        message.textContent = "Processing your cancellation request...";

        message.style.color = "white";

        try {

            const { data, error } = await supabaseClient.rpc(
                "cancel_lbm_order",
                {

                    p_order_id: Number(orderId),

                    p_phone: phone

                }
            );

            if (error) throw error;

            // Support either an object or an array response.

            let result = Array.isArray(data) ? data[0] : data;

            if (
                typeof result === "string" &&
                result.trim().startsWith("{")
            ) {

                try {

                    result = JSON.parse(result);

                } catch (parseError) {

                    // Leave the original result unchanged.

                }

            }

            const success =
                result === true ||
                result?.success === true ||
                result?.cancelled === true;

            if (!success) {

                throw new Error(
                    result?.message ||
                    "Cancellation could not be completed. Check your order reference and phone number."
                );

            }

            message.textContent =
                "SUCCESS: Order LBM-" + orderId +
                " has been cancelled.";

            message.style.color = "green";

            form.reset();

        } catch (error) {

            console.error("Cancellation error:", error);

            message.textContent =
                error.message || "Cancellation failed.";

            message.style.color = "red";

        } finally {

            confirmButton.disabled = false;

            confirmButton.textContent =
                "CONFIRM CANCELLATION";

        }

    });

}


/* =====================================================
   26. CANCELLATION STYLES
   ===================================================== */

const orderToolsStyles = document.createElement("style");

orderToolsStyles.textContent = `

#lbm-cancel-order-panel {
    margin-top: 25px;
    padding: 18px;
    border-top: 1px solid #d1b15a;
    background: #171717;
    color: white;
    border-radius: 8px;
}

.lbm-order-tools h3 {
    margin-bottom: 8px;
    color: #d1b15a;
}

.lbm-order-tools p {
    font-size: 13px;
    margin-bottom: 12px;
}

.lbm-order-tools label {
    display: block;
    margin: 12px 0 5px;
}

.lbm-order-tools input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 15px;
}

.lbm-order-tools button {
    width: 100%;
    padding: 12px;
    margin-top: 12px;
    border: none;
    border-radius: 5px;
    background: #c9a44c;
    color: #111;
    font-weight: bold;
    cursor: pointer;
}

.lbm-order-tools button:disabled {
    opacity: .6;
    cursor: not-allowed;
}

`;

document.head.appendChild(orderToolsStyles);


/* =====================================================
   27. INSTALL ORDER CANCELLATION
   ===================================================== */

installOrderCancellation();


/* =====================================================
   28. ALL STOREFRONT BUTTON EVENTS
   ===================================================== */

document.addEventListener("click", function(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;

    const id = button.dataset.id;

    if (action === "add") {

        addToCart(id);

    }

    else if (action === "increase") {

        changeQuantity(id, 1);

    }

    else if (action === "decrease") {

        changeQuantity(id, -1);

    }

    else if (action === "preview-image") {

        previewProductImage(id);

    }

    else if (action === "gallery-next") {

        changeProductImage(id, 1);

    }

    else if (action === "gallery-prev") {

        changeProductImage(id, -1);

    }

});


/* =====================================================
   29. OPEN AND CLOSE SHOPPING CART
   ===================================================== */

if (cartButton && cartSection) {

    cartButton.addEventListener("click", function() {

        cartSection.classList.toggle("open");

    });

}


if (closeCartButton && cartSection) {

    closeCartButton.addEventListener("click", function() {

        cartSection.classList.remove("open");

    });

}


/* =====================================================
   30. CHECKOUT BUTTON
   ===================================================== */

if (checkoutButton) {

    checkoutButton.addEventListener(
        "click",
        checkoutWhatsApp
    );

}


/* =====================================================
   31. FOOTER YEAR
   ===================================================== */

const yearElement = document.getElementById("year");

if (yearElement) {

    yearElement.textContent = new Date().getFullYear();

}


/* =====================================================
   32. START LBM ONLINE SHOP
   ===================================================== */

async function startShop() {

    console.log("Starting LBM Online Shop...");

    await Promise.all([

        loadProducts(),

        loadBackground()

    ]);

    updateCart();

    console.log("LBM Online Shop is ready.");

}


startShop().catch(error => {

    console.error(
        "LBM Shop startup error:",
        error
    );

});
