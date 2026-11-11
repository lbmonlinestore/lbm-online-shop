
/* =====================================================
   LBM ONLINE SHOP
   COMPLETE STOREFRONT SYSTEM
   SUPABASE + PRODUCT-SPECIFIC LONG-PRESS SELECTION
   DISTINCT CART VARIANTS + WHATSAPP CHECKOUT
   ORDER CANCELLATION
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

// Each product has its OWN selected image collection.
// Selecting pictures in one product cannot affect another.
const selectedPreviewImages = new Map();

// Long-press handling for thumbnail selection.
let thumbnailPressTimer = null;
let suppressThumbnailClickUntil = 0;
let activeThumbnailButton = null;


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


// A separate cart key for every product-picture combination.
function makeCartKey(productId, imageURL) {

    return String(productId) + "::" +
        encodeURIComponent(String(imageURL));

}


// Calculate the total quantity of all picture variants
// belonging to the same Supabase product.
function getProductCartQuantity(productId) {

    return cart.reduce((total, item) => {

        return String(item.id) === String(productId)
            ? total + Number(item.quantity || 0)
            : total;

    }, 0);

}


// Obtain the selected image set for a particular product.
function getSelectedImages(productId) {

    const id = String(productId);

    if (!selectedPreviewImages.has(id)) {

        selectedPreviewImages.set(id, new Set());

    }

    return selectedPreviewImages.get(id);

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

            console.warn("Product image data could not be parsed:", error);

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

        images.push(getFallbackProductImage(product));

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

        console.log("LBM products loaded:", products.length);

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

        image.alt = product.name + " - picture " + (index + 1);

    }

    if (counter) {

        counter.textContent = (index + 1) + " / " + images.length;

    }

}


/* =====================================================
   14. ADD A SPECIFIC PICTURE TO CART
   ===================================================== */

function addImageVariantToCart(product, imageURL, imageIndex) {

    const stock = getStock(product);

    if (stock < 1) return false;

    const productId = String(product.id);

    const cartKey = makeCartKey(productId, imageURL);

    const existingItem = cart.find(
        item => item.cartKey === cartKey
    );

    const totalQuantity = getProductCartQuantity(productId);

    if (totalQuantity >= stock) {

        return false;

    }

    if (existingItem) {

        existingItem.quantity =
            Number(existingItem.quantity) + 1;

    } else {

        cart.push({

            ...product,

            id: product.id,

            cartKey: cartKey,

            selectedImageUrl: imageURL,

            selectedImageIndex: imageIndex,

            style: "Picture " + (imageIndex + 1),

            quantity: 1

        });

    }

    return true;

}


// Normal product-card Add to Cart uses the first picture.
function addToCart(productId) {

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    const images = getProductImages(product);

    if (!addImageVariantToCart(product, images[0], 0)) {

        alert("Sorry, the available stock for this product has been reached.");

        return;

    }

    saveCart();

    updateCart();

    if (cartSection) {

        cartSection.classList.add("open");

    }

}


/* =====================================================
   15. CHANGE A SPECIFIC CART LINE QUANTITY
   ===================================================== */

function changeCartLineQuantity(cartKey, change) {

    const item = cart.find(
        product => product.cartKey === cartKey
    );

    if (!item) return;

    const product = products.find(
        product => String(product.id) === String(item.id)
    );

    if (!product) return;

    const newQuantity =
        Number(item.quantity) + Number(change);

    if (newQuantity > Number(item.quantity)) {

        const totalQuantity = getProductCartQuantity(item.id);

        if (totalQuantity + 1 > getStock(product)) {

            alert("You have reached the available stock for this product.");

            return;

        }

    }

    if (newQuantity <= 0) {

        cart = cart.filter(
            product => product.cartKey !== cartKey
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

    // Do not discard saved cart items before products load.
    if (products.length > 0) {

        cart = cart.filter(item => {

            const currentProduct = products.find(
                product => String(product.id) === String(item.id)
            );

            return currentProduct && getStock(currentProduct) > 0;

        });

        // Refresh product details while preserving each exact picture.
        cart = cart.map(item => {

            const currentProduct = products.find(
                product => String(product.id) === String(item.id)
            );

            if (!currentProduct) return item;

            const images = getProductImages(currentProduct);

            let imageURL =
                item.selectedImageUrl ||
                item.image_url ||
                item.image ||
                images[0];

            if (!isValidImageURL(imageURL)) {
                imageURL = images[0];
            }

            let imageIndex = Number(item.selectedImageIndex);

            if (!Number.isInteger(imageIndex) || imageIndex < 0) {

                imageIndex = images.indexOf(imageURL);

            }

            if (imageIndex < 0) {

                imageIndex = images.indexOf(imageURL);

            }

            if (imageIndex < 0) imageIndex = 0;

            const cartKey = makeCartKey(
                currentProduct.id,
                imageURL
            );

            return {

                ...currentProduct,

                quantity: Math.max(
                    1,
                    Math.floor(Number(item.quantity) || 1)
                ),

                cartKey: cartKey,

                selectedImageUrl: imageURL,

                selectedImageIndex: imageIndex,

                style: "Picture " + (imageIndex + 1)

            };

        });

        // Merge duplicate product-picture lines safely.
        const merged = new Map();

        cart.forEach(item => {

            if (merged.has(item.cartKey)) {

                merged.get(item.cartKey).quantity +=
                    Number(item.quantity);

            } else {

                merged.set(item.cartKey, item);

            }

        });

        cart = [...merged.values()];

    }

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

            const product = products.find(
                p => String(p.id) === String(item.id)
            );

            const overStock = product &&
                getProductCartQuantity(item.id) > getStock(product);

            return `

                <div class="cart-item">

                    <img
                        src="${escapeHTML(item.selectedImageUrl || getProductImage(item))}"
                        alt="${escapeHTML(item.name)} - ${escapeHTML(item.style || "Selected picture")}"
                        class="cart-product-image"
                    >

                    <div class="cart-item-details">

                        <h4>${escapeHTML(item.name)}</h4>

                        <p class="lbm-cart-style">
                            ${escapeHTML(item.style || "Selected picture")}
                        </p>

                        <p>${formatPrice(item.price)}</p>

                        ${
                            overStock
                            ? `<p class="lbm-stock-warning">
                                Stock has changed. Please reduce your quantity.
                               </p>`
                            : ""
                        }

                        <div class="quantity-controls">

                            <button
                                type="button"
                                data-action="decrease"
                                data-key="${escapeHTML(item.cartKey)}"
                                aria-label="Decrease quantity"
                            >−</button>

                            <span>${item.quantity}</span>

                            <button
                                type="button"
                                data-action="increase"
                                data-key="${escapeHTML(item.cartKey)}"
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

    cartItems.querySelectorAll("img").forEach(image => {

        image.addEventListener("error", function() {

            this.onerror = null;
            this.src = FALLBACK_IMAGE;

        });

    });

    cartTotal.textContent = formatPrice(totalPrice);

    // Checkout is also blocked if any product exceeds current stock.
    const stockExceeded = products.some(product => {

        return getProductCartQuantity(product.id) > getStock(product);

    });

    if (checkoutButton) {

        checkoutButton.disabled =
            cart.length === 0 || stockExceeded;

    }

    saveCart();

}


/* =====================================================
   17. IMAGE PREVIEW MODAL
   PRODUCT-SPECIFIC LONG-PRESS SELECTION
   ===================================================== */

function createImagePreview() {

    let modal = document.getElementById("lbm-image-preview");

    if (
        modal &&
        modal.dataset.version !== "long-press-selection-v2"
    ) {

        modal.remove();

        modal = null;

    }

    if (modal) return modal;

    modal = document.createElement("div");

    modal.id = "lbm-image-preview";

    modal.dataset.version = "long-press-selection-v2";

    modal.innerHTML = `

        <div class="lbm-preview-content">

            <button
                type="button"
                id="lbm-preview-close"
                aria-label="Close gallery"
            >×</button>

            <h3 id="lbm-preview-title"></h3>

            <p id="lbm-preview-price"></p>

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

            <div class="lbm-preview-product-selection">

                <h3>Select Your Pictures</h3>

                <p>
                    Tap a thumbnail briefly to preview it.
                    Press and hold a thumbnail to select or
                    unselect that picture.
                </p>

                <p class="lbm-preview-selection-hint">
                    You can select several pictures, but only
                    from this product.
                </p>

                <p
                    id="lbm-preview-selected-count"
                    class="lbm-preview-selected-count"
                >
                    0 pictures selected
                </p>

                <button
                    type="button"
                    id="lbm-preview-add-selected"
                    disabled
                >
                    ADD SELECTED PICTURES TO CART
                </button>

            </div>

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


    /* ---------------------------------------------
       THUMBNAIL SHORT TAP AND LONG-PRESS HANDLING
       --------------------------------------------- */

    const thumbnailContainer = document.getElementById(
        "lbm-preview-thumbnails"
    );


    function clearThumbnailPress() {

        if (thumbnailPressTimer !== null) {

            clearTimeout(thumbnailPressTimer);

            thumbnailPressTimer = null;

        }

        activeThumbnailButton = null;

    }


    thumbnailContainer.addEventListener("pointerdown", event => {

        const thumbnail = event.target.closest(
            "[data-preview-index]"
        );

        if (!thumbnail) return;

        // Ignore right-click and non-primary mouse buttons.
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        clearThumbnailPress();

        activeThumbnailButton = thumbnail;

        const pressedButton = thumbnail;

        const pressedProductId = previewProductId;

        const imageIndex = Number(
            thumbnail.dataset.previewIndex
        );

        // 500 milliseconds is the long-press threshold.
        thumbnailPressTimer = setTimeout(() => {

            thumbnailPressTimer = null;

            // Ensure the same product and thumbnail are still active.
            if (
                previewProductId !== pressedProductId ||
                !pressedButton.isConnected
            ) {

                return;

            }

            suppressThumbnailClickUntil =
                Date.now() + 800;

            // Select or unselect this thumbnail only.
            togglePictureSelection(imageIndex);

        }, 500);

    });


    thumbnailContainer.addEventListener("pointerup", () => {

        // If the long press has not fired, this is a normal tap.
        clearThumbnailPress();

    });


    thumbnailContainer.addEventListener("pointercancel", () => {

        clearThumbnailPress();

    });


    thumbnailContainer.addEventListener("pointerleave", () => {

        clearThumbnailPress();

    });


    thumbnailContainer.addEventListener("contextmenu", event => {

        if (event.target.closest("[data-preview-index]")) {

            event.preventDefault();

        }

    });


    thumbnailContainer.addEventListener("click", event => {

        const thumbnail = event.target.closest(
            "[data-preview-index]"
        );

        if (!thumbnail) return;

        // A long-press already selected the picture.
        // Do not also treat the resulting click as a preview tap.
        if (Date.now() < suppressThumbnailClickUntil) {

            event.preventDefault();

            event.stopPropagation();

            return;

        }

        // Normal short tap changes the large preview only.
        previewImageIndex = Number(
            thumbnail.dataset.previewIndex
        );

        productImageIndices[previewProductId] =
            previewImageIndex;

        renderPreviewGallery();

    });


    document.getElementById("lbm-preview-add-selected")
        .addEventListener("click", addSelectedPicturesToCart);

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

    previewProductId = String(product.id);

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
   19. TOGGLE A PARTICULAR THUMBNAIL SELECTION
   ===================================================== */

function togglePictureSelection(imageIndex) {

    if (!previewProductId) return;

    const product = products.find(
        item => String(item.id) === previewProductId
    );

    if (!product) return;

    if (getStock(product) < 1) {

        alert("This product is out of stock.");

        return;

    }

    const images = getProductImages(product);

    if (
        !Number.isInteger(imageIndex) ||
        imageIndex < 0 ||
        imageIndex >= images.length
    ) {

        return;

    }

    const imageURL = images[imageIndex];

    // This selection set belongs ONLY to the open product.
    const selected = getSelectedImages(previewProductId);

    if (selected.has(imageURL)) {

        selected.delete(imageURL);

    } else {

        selected.add(imageURL);

    }

    renderPreviewGallery();

}


/* =====================================================
   20. ADD ALL SELECTED PICTURES TO CART
   ===================================================== */

function addSelectedPicturesToCart() {

    if (!previewProductId) return;

    const product = products.find(
        item => String(item.id) === previewProductId
    );

    if (!product) return;

    const images = getProductImages(product);

    const selected = getSelectedImages(previewProductId);

    const selectedURLs = [...selected];

    if (selectedURLs.length === 0) {

        alert("Please long-press at least one picture to select it.");

        return;

    }

    const stock = getStock(product);

    const currentQuantity =
        getProductCartQuantity(product.id);

    // Each selected picture adds one unit.
    // Validate combined stock before adding anything.
    if (currentQuantity + selectedURLs.length > stock) {

        alert(
            "You selected " + selectedURLs.length +
            " pictures, but only " +
            Math.max(0, stock - currentQuantity) +
            " additional units are available."
        );

        return;

    }

    selectedURLs.forEach(imageURL => {

        const imageIndex = images.indexOf(imageURL);

        addImageVariantToCart(
            product,
            imageURL,
            imageIndex >= 0 ? imageIndex : 0
        );

    });

    // Clear only this product's selection.
    // Other products' selections remain untouched.
    selected.clear();

    saveCart();

    updateCart();

    closeImagePreview();

    if (cartSection) {

        cartSection.classList.add("open");

    }

}


/* =====================================================
   21. RENDER PRODUCT GALLERY + SELECTION STATUS
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

    const addButton =
        document.getElementById("lbm-preview-add-selected");

    const selectedCount =
        document.getElementById("lbm-preview-selected-count");

    if (
        !image ||
        !counter ||
        !thumbnails ||
        !addButton ||
        !selectedCount
    ) return;

    const selected = getSelectedImages(previewProductId);

    const currentURL = images[previewImageIndex];

    image.onerror = function() {

        this.onerror = null;
        this.src = FALLBACK_IMAGE;

    };

    image.src = currentURL;

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
        ? images.map((url, index) => {

            const chosen = selected.has(url);

            return `

                <button
                    type="button"
                    class="lbm-preview-thumbnail
                        ${index === previewImageIndex ? "active" : ""}
                        ${chosen ? "selected" : ""}"
                    data-preview-index="${index}"
                    aria-label="Picture ${index + 1}. ${
                        chosen ? "Selected" : "Not selected"
                    }. Tap to preview or long-press to select."
                    aria-pressed="${chosen}"
                >

                    <img
                        src="${escapeHTML(url)}"
                        alt=""
                        draggable="false"
                    >

                    ${chosen ? `<span class="lbm-thumbnail-tick">✓</span>` : ""}

                </button>

            `;

        }).join("")
        : "";

    thumbnails.querySelectorAll("img").forEach(thumb => {

        thumb.addEventListener("error", function() {

            this.onerror = null;
            this.src = FALLBACK_IMAGE;

        });

    });

    const available = getStock(product) > 0;

    selectedCount.textContent =
        selected.size + (
            selected.size === 1
                ? " picture selected"
                : " pictures selected"
        );

    addButton.disabled =
        !available || selected.size === 0;

    addButton.textContent =
        selected.size > 0
            ? "ADD " + selected.size + " SELECTED PICTURE(S) TO CART"
            : "LONG-PRESS THUMBNAILS TO SELECT";

}


/* =====================================================
   22. CHANGE PREVIEW IMAGE
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
   23. CLOSE IMAGE PREVIEW
   ===================================================== */

function closeImagePreview() {

    if (thumbnailPressTimer !== null) {

        clearTimeout(thumbnailPressTimer);

        thumbnailPressTimer = null;

    }

    activeThumbnailButton = null;

    const modal = document.getElementById("lbm-image-preview");

    if (modal) {

        modal.style.display = "none";

    }

    document.body.style.overflow = "";

    previewProductId = null;

}


/* =====================================================
   24. PREVIEW KEYBOARD CONTROLS
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
   25. IMAGE GALLERY + SELECTION STYLES
   ===================================================== */

document.getElementById("lbm-gallery-styles")?.remove();

const previewStyles = document.createElement("style");

previewStyles.id = "lbm-gallery-styles";

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
    gap: 9px;
    margin: 12px 0;
}

.lbm-preview-thumbnail {
    width: 58px;
    height: 58px;
    padding: 2px;
    border: 2px solid #ddd;
    border-radius: 5px;
    background: white;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;

    /* Allow vertical scrolling while supporting long-press. */
    touch-action: pan-y;

    /* Prevent the browser's image dragging and text selection. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}

.lbm-preview-thumbnail.active {
    border-color: #c9a44c;
}

.lbm-preview-thumbnail.selected {
    border: 3px solid #159447;
    background: #e9f8ef;
}

.lbm-preview-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    -webkit-user-drag: none;
}

.lbm-thumbnail-tick {
    position: absolute;
    top: -7px;
    right: -7px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #159447;
    color: white;
    font-weight: bold;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
}

.lbm-preview-product-selection {
    margin-top: 18px;
    padding: 15px;
    border: 1px solid #d1b15a;
    border-radius: 8px;
    background: #171717;
    color: white;
}

.lbm-preview-product-selection h3 {
    color: #d1b15a;
    margin: 5px 0 8px;
}

.lbm-preview-product-selection p {
    font-size: 13px;
    line-height: 1.5;
    color: #eee;
}

.lbm-preview-selection-hint {
    color: #d1b15a !important;
    font-weight: 600;
}

.lbm-preview-selected-count {
    color: #d1b15a !important;
    font-weight: bold;
    font-size: 15px !important;
}

#lbm-preview-add-selected {
    display: block;
    width: 100%;
    padding: 14px 10px;
    margin-top: 12px;
    border: none;
    border-radius: 5px;
    background: #c9a44c;
    color: #111;
    font-weight: bold;
    font-size: 13px;
    cursor: pointer;
}

#lbm-preview-add-selected:hover {
    filter: brightness(1.08);
}

#lbm-preview-add-selected:disabled {
    background: #777;
    color: white;
    cursor: not-allowed;
    opacity: .7;
}

.lbm-cart-style {
    color: #a17b26;
    font-size: 12px;
    font-weight: bold;
    margin: 4px 0;
}

.lbm-stock-warning {
    color: #c0392b;
    font-size: 12px;
    font-weight: bold;
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

    .lbm-preview-thumbnail {
        width: 55px;
        height: 55px;
    }

}

`;

document.head.appendChild(previewStyles);


/* =====================================================
   26. WHATSAPP CHECKOUT + SUPABASE ORDER SAVING
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

    // Validate aggregate stock across every picture variant.
    for (const product of products) {

        const quantity = getProductCartQuantity(product.id);

        if (quantity > getStock(product)) {

            alert(
                product.name +
                " has only " + getStock(product) +
                " units available, but your cart contains " +
                quantity + ". Please adjust your cart."
            );

            return;

        }

    }

    for (const item of cart) {

        const product = products.find(
            p => String(p.id) === String(item.id)
        );

        if (!product) {

            alert("A product is no longer available. Please refresh.");

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

            alert(product.name + " has insufficient stock.");

            return;

        }

        const imageURL =
            item.selectedImageUrl || getProductImage(product);

        const imageIndex =
            Number(item.selectedImageIndex) + 1;

        const style =
            item.style || ("Picture " + imageIndex);

        const subtotal = price * quantity;

        total += subtotal;

        orderItems.push({

            product_id: product.id,

            name: product.name,

            price: price,

            quantity: quantity,

            subtotal: subtotal,

            image_url: imageURL,

            image_index: imageIndex,

            style: style

        });

    }

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

        // Keep the existing RPC name and parameter names.
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

        let message = "NEW LBM ONLINE SHOP ORDER\n\n";

        message += "ORDER REFERENCE: LBM-" + orderId + "\n";

        message += "Customer: " + customerName.trim() + "\n";

        message += "Phone: " + phone.trim() + "\n";

        message += "Address: " + address.trim() + "\n\n";

        message += "ORDER DETAILS:\n\n";

        orderItems.forEach(item => {

            message +=
                item.name + "\n" +
                "Selected style: " + item.style + "\n" +
                "Quantity: " + item.quantity + "\n" +
                "Price: " + formatPrice(item.price) + "\n" +
                "Subtotal: " + formatPrice(item.subtotal) + "\n" +
                "Picture: " + item.image_url + "\n\n";

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

        // Clear the cart only after Supabase confirms the order.
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
   27. CUSTOMER ORDER CANCELLATION
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

            let result = Array.isArray(data) ? data[0] : data;

            if (
                typeof result === "string" &&
                result.trim().startsWith("{")
            ) {

                try {

                    result = JSON.parse(result);

                } catch (parseError) {

                    // Keep the original result.

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
   28. CANCELLATION STYLES
   ===================================================== */

document.getElementById("lbm-cancellation-styles")?.remove();

const orderToolsStyles = document.createElement("style");

orderToolsStyles.id = "lbm-cancellation-styles";

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
   29. INSTALL ORDER CANCELLATION
   ===================================================== */

installOrderCancellation();


/* =====================================================
   30. ALL STOREFRONT BUTTON EVENTS
   ===================================================== */

document.addEventListener("click", function(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;

    const id = button.dataset.id;

    const key = button.dataset.key;

    if (action === "add") {

        addToCart(id);

    }

    else if (action === "increase") {

        changeCartLineQuantity(key, 1);

    }

    else if (action === "decrease") {

        changeCartLineQuantity(key, -1);

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
   31. OPEN AND CLOSE SHOPPING CART
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
   32. CHECKOUT BUTTON
   ===================================================== */

if (checkoutButton) {

    checkoutButton.addEventListener(
        "click",
        checkoutWhatsApp
    );

}


/* =====================================================
   33. FOOTER YEAR
   ===================================================== */

const yearElement = document.getElementById("year");

if (yearElement) {

    yearElement.textContent = new Date().getFullYear();

}


/* =====================================================
   34. START LBM ONLINE SHOP
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
