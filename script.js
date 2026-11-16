
/* =====================================================
   LBM ONLINE SHOP
   COMPLETE STOREFRONT SYSTEM
   SUPABASE + LAY-BAY STYLE PICTURE CHECKBOX SELECTION
   DISTINCT CART VARIANTS + WHATSAPP CHECKOUT
   ORDER CANCELLATION
   DYNAMIC SOCIAL MEDIA LINKS
   LIVE PRODUCT SEARCH
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

let productSearchTerm = "";

const selectedPreviewImages = new Map();
const selectedPictureOptions = new Map();



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


function normaliseOptionList(value) {
    if (Array.isArray(value)) return [...new Set(value.map(item => String(item).trim()).filter(Boolean))];
    if (typeof value !== "string" || !value.trim()) return [];
    const raw = value.trim();
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return [...new Set(parsed.map(item => String(item).trim()).filter(Boolean))];
    } catch (error) {}
    return [...new Set(raw.split(/[,;\n]/).map(item => item.trim()).filter(Boolean))];
}
function getProductSizes(product) { return normaliseOptionList(product?.available_sizes); }
function getProductColours(product) { return normaliseOptionList(product?.available_colours); }
function getCardVariantSelection(productId) {
    const card = [...document.querySelectorAll(".product-card")].find(element => {
        const button = element.querySelector('[data-action="add"]');
        return button && String(button.dataset.id) === String(productId);
    });
    return {
        size: card?.querySelector('[data-variant="size"]')?.value || "",
        colour: card?.querySelector('[data-variant="colour"]')?.value || ""
    };
}
function makeCartKey(productId, imageIndex, size = "", colour = "") {
    return String(productId) + "::picture-" + String(imageIndex) + "::" +
        encodeURIComponent(String(size || "")) + "::" + encodeURIComponent(String(colour || ""));
}


function getProductCartQuantity(productId) {

    return cart.reduce((total, item) => {

        return String(item.id) === String(productId)
            ? total + Number(item.quantity || 0)
            : total;

    }, 0);

}


function getSelectedImages(productId) {

    const id = String(productId);

    if (!selectedPreviewImages.has(id)) {

        selectedPreviewImages.set(id, new Set());

    }

    return selectedPreviewImages.get(id);

}


function getPictureOptionsMap(productId) {

    const id = String(productId);

    if (!selectedPictureOptions.has(id)) {
        selectedPictureOptions.set(id, new Map());
    }

    return selectedPictureOptions.get(id);

}


function getPictureVariantOptions(product, imageIndex) {

    const options = getPictureOptionsMap(product.id);
    const key = Number(imageIndex);

    if (!options.has(key)) {

        const cardSelection = getCardVariantSelection(product.id);

        options.set(key, {
            size: cardSelection.size || "",
            colour: cardSelection.colour || "",
            quantity: 1
        });

    }

    return options.get(key);

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

    const hero = document.querySelector(".hero:not(.hero-fresh)");

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
   10A. LOAD SOCIAL MEDIA LINKS FROM SUPABASE
   ===================================================== */

async function loadSocialLinks() {

    const socialAccounts = [

        {
            id: "facebookLink",
            key: "social_facebook",
            hosts: [
                "facebook.com",
                "www.facebook.com",
                "m.facebook.com",
                "fb.com",
                "www.fb.com"
            ]
        },

        {
            id: "instagramLink",
            key: "social_instagram",
            hosts: [
                "instagram.com",
                "www.instagram.com"
            ]
        },

        {
            id: "whatsappLink",
            key: "social_whatsapp",
            hosts: [
                "wa.me",
                "api.whatsapp.com",
                "whatsapp.com",
                "www.whatsapp.com"
            ]
        }

    ];


    socialAccounts.forEach(account => {

        const element = document.getElementById(account.id);

        if (element) {

            element.hidden = true;

            element.removeAttribute("href");

        }

    });


    try {

        const { data, error } = await supabaseClient
            .from("site_settings")
            .select("setting_key, setting_value")
            .in(
                "setting_key",
                socialAccounts.map(account => account.key)
            );

        if (error) throw error;


        const settings = new Map(

            (data || []).map(item => [

                item.setting_key,

                item.setting_value

            ])

        );


        socialAccounts.forEach(account => {

            const element = document.getElementById(account.id);

            if (!element) return;

            let savedURL = settings.get(account.key);

            if (typeof savedURL !== "string") return;

            savedURL = savedURL.trim();

            if (!savedURL) return;


            if (!/^https?:\/\//i.test(savedURL)) {

                savedURL = "https://" + savedURL;

            }


            try {

                const parsedURL = new URL(savedURL);

                if (parsedURL.protocol !== "https:") return;

                if (
                    !account.hosts.includes(
                        parsedURL.hostname.toLowerCase()
                    )
                ) {

                    return;

                }

                element.href = parsedURL.href;

                element.hidden = false;


            } catch (urlError) {

                console.warn(
                    "Invalid social media URL:",
                    account.key
                );

            }

        });


        console.log("LBM social media links loaded.");


    } catch (error) {

        console.error(
            "Social media links loading error:",
            error
        );

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

            updateSearchResults(0, "");

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
   12. PRODUCT SEARCH
   ===================================================== */

function normaliseSearchText(value) {

    return String(value ?? "")
        .toLowerCase()
        .trim();

}


function searchProducts(searchTerm) {

    const query = normaliseSearchText(searchTerm);

    if (!query) return products;

    return products.filter(product => {

        const searchableFields = [

            product.name,
            product.brand,
            product.category,
            product.description,
            product.sku

        ];

        const searchableText = searchableFields
            .filter(value => value !== null && value !== undefined)
            .map(value => String(value))
            .join(" ")
            .toLowerCase();

        return searchableText.includes(query);

    });

}


function updateSearchResults(resultCount, searchTerm) {

    const results = document.getElementById(
        "lbm-search-results"
    );

    if (!results) return;

    if (!searchTerm.trim()) {

        results.textContent =
            "Showing all " + resultCount + " products";

        return;

    }

    if (resultCount === 0) {

        results.textContent =
            'No products found for "' + searchTerm.trim() + '"';

        return;

    }

    results.textContent =
        "Found " + resultCount +
        (resultCount === 1
            ? " matching product"
            : " matching products");

}


function filterProducts() {

    const filteredProducts = searchProducts(productSearchTerm);

    displayProducts(filteredProducts);

    updateSearchResults(
        filteredProducts.length,
        productSearchTerm
    );

}


function installProductSearch() {

    const searchInput = document.getElementById(
        "lbm-product-search"
    );

    const clearButton = document.getElementById(
        "lbm-clear-search"
    );

    if (!searchInput || !clearButton) {

        console.warn("Product search elements were not found.");

        return;

    }

    if (searchInput.dataset.searchInstalled === "true") return;

    searchInput.dataset.searchInstalled = "true";


    searchInput.addEventListener("input", function() {

        productSearchTerm = this.value;

        clearButton.hidden = !productSearchTerm.trim();

        filterProducts();

    });


    clearButton.addEventListener("click", function() {

        searchInput.value = "";

        productSearchTerm = "";

        clearButton.hidden = true;

        filterProducts();

        searchInput.focus();

    });

}


/* =====================================================
   13. DISPLAY PRODUCTS
   ===================================================== */

function displayProducts(productArray = products) {

    if (!productList) return;

    if (!productArray.length) {
        const hasSearch = productSearchTerm.trim().length > 0;
        productList.innerHTML = `
            <div class="lbm-no-search-results">
                <div class="lbm-no-search-icon" aria-hidden="true">⌕</div>
                <h3>${hasSearch ? "No products found" : "No products available"}</h3>
                <p>${hasSearch ? "Try another product name, brand or category." : "Please check back later for new products."}</p>
            </div>`;
        return;
    }

    productList.innerHTML = productArray.map(product => {
        const images = getProductImages(product);
        const image = images[0];
        const stock = getStock(product);
        const available = stock > 0;
        const id = String(product.id);
        const sizes = getProductSizes(product);
        const colours = getProductColours(product);
        const category = String(product.category || "Fashion").trim();
        const description = String(product.description || "").trim();
        const sizeControl = sizes.length ? `
            <label class="product-option">
                <span>Size</span>
                <select data-variant="size" aria-label="Choose size for ${escapeHTML(product.name)}">
                    <option value="">Choose size</option>
                    ${sizes.map(size => `<option value="${escapeHTML(size)}">${escapeHTML(size)}</option>`).join("")}
                </select>
            </label>` : "";
        const colourControl = colours.length ? `
            <label class="product-option">
                <span>Colour</span>
                <select data-variant="colour" aria-label="Choose colour for ${escapeHTML(product.name)}">
                    <option value="">Choose colour</option>
                    ${colours.map(colour => `<option value="${escapeHTML(colour)}">${escapeHTML(colour)}</option>`).join("")}
                </select>
            </label>` : "";

        productImageIndices[id] = 0;

        return `
            <article class="product-card lbm-retail-card">
                <div class="product-image-container lbm-retail-image">
                    <img src="${escapeHTML(image)}"
                         alt="${escapeHTML(product.name)}"
                         class="product-image"
                         loading="lazy"
                         data-action="preview-image"
                         data-id="${escapeHTML(id)}"
                         aria-label="View ${escapeHTML(product.name)} pictures">
                    <span class="product-category-tag">${escapeHTML(category)}</span>
                    ${images.length > 1 ? `
                        <button type="button" class="gallery-arrow gallery-prev"
                                data-action="gallery-prev" data-id="${escapeHTML(id)}"
                                aria-label="Previous product picture">‹</button>
                        <span class="lbm-image-counter">1 / ${images.length}</span>
                        <button type="button" class="gallery-arrow gallery-next"
                                data-action="gallery-next" data-id="${escapeHTML(id)}"
                                aria-label="Next product picture">›</button>` : ""}
                </div>

                <div class="product-info lbm-retail-info">
                    <p class="product-eyebrow">${escapeHTML(category)}</p>
                    <h3 class="product-card-title" data-action="preview-image"
                        data-id="${escapeHTML(id)}" role="button" tabindex="0">
                        ${escapeHTML(product.name)}
                    </h3>
                    ${description ? `<p class="product-description lbm-card-description">${escapeHTML(description)}</p>` : ""}
                    <div class="lbm-price-stock-row">
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <span class="stock-label ${available ? "in-stock" : "out-of-stock"}">
                            ${available ? stock + " available" : "Out of stock"}
                        </span>
                    </div>
                    ${sizeControl || colourControl ? `
                        <div class="product-options-row">${sizeControl}${colourControl}</div>` : ""}
                    <button type="button" class="add-button lbm-card-add"
                            data-action="add" data-id="${escapeHTML(id)}"
                            ${available ? "" : "disabled"}>
                        ${available ? "ADD TO CART" : "CURRENTLY UNAVAILABLE"}
                    </button>
                    <button type="button" class="lbm-view-details"
                            data-action="preview-image" data-id="${escapeHTML(id)}">
                        View product pictures and details
                    </button>
                </div>
            </article>`;
    }).join("");

    productList.querySelectorAll(".product-image").forEach(image => {
        image.addEventListener("error", function() {
            this.onerror = null;
            this.src = FALLBACK_IMAGE;
        });
    });
}


/* =====================================================
   14. CHANGE PRODUCT CARD IMAGE
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
   15. ADD A SPECIFIC PICTURE TO CART
   ===================================================== */

function addImageVariantToCart(product, imageURL, imageIndex, selectedSize = "", selectedColour = "", requestedQuantity = 1) {

    const stock = getStock(product);

    if (stock < 1) return false;

    const productId = String(product.id);
    const sizes = getProductSizes(product);
    const colours = getProductColours(product);
    if (sizes.length && !sizes.includes(selectedSize)) {
        alert("Please select an available size for " + product.name + ".");
        return false;
    }
    if (colours.length && !colours.includes(selectedColour)) {
        alert("Please select an available colour for " + product.name + ".");
        return false;
    }
    const quantity = Number(requestedQuantity);

    if (!Number.isInteger(quantity) || quantity < 1) return false;

    const cartKey = makeCartKey(productId, imageIndex, selectedSize, selectedColour);

    const existingItem = cart.find(
        item => item.cartKey === cartKey
    );

    const totalQuantity = getProductCartQuantity(productId);

    if (totalQuantity + quantity > stock) {

        return false;

    }

    if (existingItem) {

        existingItem.quantity =
            Number(existingItem.quantity) + quantity;

    } else {

        cart.push({

            ...product,

            id: product.id,

            cartKey: cartKey,

            selectedImageUrl: imageURL,

            selectedImageIndex: imageIndex,
            selectedSize: selectedSize,
            selectedColour: selectedColour,

            style: "Picture " + (imageIndex + 1),

            quantity: quantity

        });

    }

    return true;

}


function addToCart(productId) {

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    const images = getProductImages(product);
    const selection = getCardVariantSelection(productId);
    const selectedImageIndex = Math.min(
        Math.max(0, Number(productImageIndices[String(productId)]) || 0),
        images.length - 1
    );

    if (!addImageVariantToCart(product, images[selectedImageIndex], selectedImageIndex, selection.size, selection.colour)) {

        alert("Sorry, the available stock for this product has been reached.");

        return;

    }

    saveCart();

    updateCart();

    const cartStatus = document.getElementById("cart-status");
    if (cartStatus) {
        cartStatus.textContent =
            "Product added to your cart! Your item has been saved. You're not finished ordering yet.";
    }

    if (cartSection) {
        cartSection.classList.add("open");
        cartSection.setAttribute("aria-label", "Shopping cart. Product added successfully.");
        cartButton?.setAttribute("aria-expanded", "true");
        cartSection.scrollTop = 0;
    }

}


/* =====================================================
   16. CHANGE A SPECIFIC CART LINE QUANTITY
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
   17. UPDATE SHOPPING CART
   ===================================================== */

function updateCart() {

    if (!cartItems || !cartTotal) return;

    if (products.length > 0) {

        cart = cart.filter(item => {

            const currentProduct = products.find(
                product => String(product.id) === String(item.id)
            );

            return currentProduct && getStock(currentProduct) > 0;

        });


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

            const selectedSize = item.selectedSize || item.selected_size || "";
            const selectedColour = item.selectedColour || item.selected_colour || "";
            const validSizes = getProductSizes(currentProduct);
            const validColours = getProductColours(currentProduct);
            const safeSize = validSizes.includes(selectedSize) ? selectedSize : "";
            const safeColour = validColours.includes(selectedColour) ? selectedColour : "";
            const cartKey = makeCartKey(currentProduct.id, imageIndex, safeSize, safeColour);

            return {

                ...currentProduct,

                quantity: Math.max(
                    1,
                    Math.floor(Number(item.quantity) || 1)
                ),

                cartKey: cartKey,

                selectedImageUrl: imageURL,

                selectedImageIndex: imageIndex,
                selectedSize: safeSize,
                selectedColour: safeColour,

                style: "Picture " + (imageIndex + 1)

            };

        });


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
                            ${item.selectedSize ? " · Size: " + escapeHTML(item.selectedSize) : ""}
                            ${item.selectedColour ? " · Colour: " + escapeHTML(item.selectedColour) : ""}
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
   18. IMAGE PREVIEW MODAL
   LAY-BAY STYLE TAP + CHECKBOX SELECTION
   ===================================================== */

function createImagePreview() {

    let modal = document.getElementById("lbm-image-preview");

    if (modal && modal.dataset.version !== "lay-bay-checkbox-v1") {
        modal.remove();
        modal = null;
    }

    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "lbm-image-preview";
    modal.dataset.version = "lay-bay-checkbox-v1";

    modal.innerHTML = `

        <div class="lbm-preview-content">

            <button type="button" id="lbm-preview-close"
                aria-label="Close gallery">×</button>

            <h3 id="lbm-preview-title"></h3>
            <p id="lbm-preview-price"></p>
            <p id="lbm-preview-category" class="lbm-preview-category"></p>
            <p id="lbm-preview-description" class="lbm-preview-description"></p>

            <div class="lbm-preview-image-area">
                <button type="button" id="lbm-preview-prev"
                    class="lbm-preview-arrow" aria-label="Previous picture">‹</button>
                <img id="lbm-preview-image" alt="">
                <button type="button" id="lbm-preview-next"
                    class="lbm-preview-arrow" aria-label="Next picture">›</button>
            </div>

            <p id="lbm-preview-counter"></p>
            <div id="lbm-preview-thumbnails"></div>
            <div id="lbm-preview-variant-options"></div>

            <div class="lbm-preview-product-selection">
                <h3>Select Your Pictures</h3>
                <p>Tap a picture to preview it. Use its checkbox to select or unselect it, just like LBM Lay-Bay.</p>
                <p class="lbm-preview-selection-hint">
                    Select several pictures from this product. Each selected picture has its own size, colour and quantity.
                </p>
                <p id="lbm-preview-selected-count"
                    class="lbm-preview-selected-count">0 pictures selected</p>
                <button type="button" id="lbm-preview-add-selected" disabled>
                    ADD SELECTED PICTURES TO CART
                </button>
            </div>

        </div>

    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
        if (event.target === modal || event.target.id === "lbm-preview-close") {
            closeImagePreview();
        }
    });

    document.getElementById("lbm-preview-prev")
        .addEventListener("click", () => changePreviewImage(-1));

    document.getElementById("lbm-preview-next")
        .addEventListener("click", () => changePreviewImage(1));

    document.getElementById("lbm-preview-thumbnails")
        .addEventListener("click", event => {
            if (event.target.closest("[data-picture-select]")) return;
            const thumbnail = event.target.closest("[data-preview-index]");
            if (!thumbnail) return;
            const imageIndex = Number(thumbnail.dataset.previewIndex);
            if (!Number.isInteger(imageIndex)) return;
            previewImageIndex = imageIndex;
            productImageIndices[previewProductId] = imageIndex;
            renderPreviewGallery();
        });

    document.getElementById("lbm-preview-thumbnails")
        .addEventListener("change", event => {
            const checkbox = event.target.closest("[data-picture-select]");
            if (!checkbox) return;

            const imageIndex = Number(checkbox.dataset.pictureSelect);
            if (!Number.isInteger(imageIndex)) return;

            togglePictureSelection(imageIndex);
        });

    document.getElementById("lbm-preview-add-selected")
        .addEventListener("click", addSelectedPicturesToCart);

    document.getElementById("lbm-preview-variant-options")
        .addEventListener("change", event => {

            const control = event.target.closest("[data-picture-option]");
            if (!control || !previewProductId) return;

            const imageIndex = Number(control.dataset.imageIndex);
            const optionName = control.dataset.pictureOption;
            const product = products.find(
                item => String(item.id) === previewProductId
            );

            if (!product || !Number.isInteger(imageIndex)) return;

            const pictureOptions = getPictureVariantOptions(product, imageIndex);

            if (optionName === "quantity") {
                const quantity = Number(control.value);
                pictureOptions.quantity =
                    Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
            } else if (optionName === "size") {
                pictureOptions.size = control.value;
            } else if (optionName === "colour") {
                pictureOptions.colour = control.value;
            }

            renderPreviewGallery();
        });

    return modal;
}


/* =====================================================
   19. OPEN PRODUCT IMAGE PREVIEW
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

    document.getElementById("lbm-preview-category").textContent =
        product.category ? "Category: " + product.category : "";

    document.getElementById("lbm-preview-description").textContent =
        product.description || "More product details will be provided by LBM Online Shop.";

    renderPreviewGallery();

    document.getElementById("lbm-image-preview").style.display =
        "flex";

    document.body.style.overflow = "hidden";

}


/* =====================================================
   20. TOGGLE A PARTICULAR THUMBNAIL SELECTION
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

    const selected = getSelectedImages(previewProductId);

    if (selected.has(imageIndex)) {

        selected.delete(imageIndex);
        getPictureOptionsMap(previewProductId).delete(imageIndex);

    } else {

        selected.add(imageIndex);
        getPictureVariantOptions(product, imageIndex);

    }

    renderPreviewGallery();

}


/* =====================================================
   21. ADD ALL SELECTED PICTURES TO CART
   ===================================================== */

function addSelectedPicturesToCart() {

    if (!previewProductId) return;

    const product = products.find(
        item => String(item.id) === previewProductId
    );

    if (!product) return;

    const images = getProductImages(product);

    const selected = getSelectedImages(previewProductId);

    const selectedIndexes = [...selected];

    if (selectedIndexes.length === 0) {

        alert("Please select at least one picture.");

        return;

    }

    const sizes = getProductSizes(product);
    const colours = getProductColours(product);
    const pictureOptions = getPictureOptionsMap(product.id);

    const preparedLines = selectedIndexes.map(imageIndex => ({
        imageIndex,
        imageURL: images[imageIndex],
        options: getPictureVariantOptions(product, imageIndex)
    }));

    for (const line of preparedLines) {

        if (sizes.length && !sizes.includes(line.options.size)) {
            alert("Please choose a size for every selected picture of " + product.name + ".");
            return;
        }

        if (colours.length && !colours.includes(line.options.colour)) {
            alert("Please choose a colour for every selected picture of " + product.name + ".");
            return;
        }

        if (!Number.isInteger(Number(line.options.quantity)) || Number(line.options.quantity) < 1) {
            alert("Please enter a valid quantity for every selected picture.");
            return;
        }

    }

    const requestedQuantity = preparedLines.reduce(
        (total, line) => total + Number(line.options.quantity),
        0
    );

    const stock = getStock(product);
    const currentQuantity = getProductCartQuantity(product.id);

    if (currentQuantity + requestedQuantity > stock) {

        alert(
            "Your selected picture quantities total " + requestedQuantity +
            ", but only " + Math.max(0, stock - currentQuantity) +
            " additional units are available."
        );

        return;

    }

    for (const line of preparedLines) {

        const imageIndex = images.indexOf(line.imageURL);
        const added = addImageVariantToCart(
            product,
            line.imageURL,
            imageIndex >= 0 ? imageIndex : 0,
            line.options.size,
            line.options.colour,
            Number(line.options.quantity)
        );

        if (!added) {
            alert("We could not add one of the selected picture options. Please review your cart and try again.");
            return;
        }

    }

    selected.clear();
    pictureOptions.clear();

    saveCart();

    updateCart();

    closeImagePreview();

    if (cartSection) {

        cartSection.classList.add("open");

    }

}


/* =====================================================
   22. RENDER PRODUCT GALLERY + SELECTION STATUS
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

    const variantOptionsContainer =
        document.getElementById("lbm-preview-variant-options");

    if (
        !image ||
        !counter ||
        !thumbnails ||
        !addButton ||
        !selectedCount ||
        !variantOptionsContainer
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
            const chosen = selected.has(index);
            return `
                <label
                    class="lbm-preview-thumbnail ${index === previewImageIndex ? "active" : ""} ${chosen ? "selected" : ""}"
                    data-preview-index="${index}"
                >
                    <img src="${escapeHTML(url)}" alt="Preview picture ${index + 1}" draggable="false">
                    <input type="checkbox" data-picture-select="${index}"
                        aria-label="Select picture ${index + 1}" ${chosen ? "checked" : ""}>
                </label>
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
    const availableSizes = getProductSizes(product);
    const availableColours = getProductColours(product);

    variantOptionsContainer.innerHTML = selected.size
        ? [...selected].map((imageIndex, selectedIndex) => {

            const imageURL = images[imageIndex];
            const pictureOptions = getPictureVariantOptions(product, imageIndex);
            const safeURL = escapeHTML(imageURL);

            const sizeControl = availableSizes.length
                ? `
                    <label class="lbm-picture-option-label">
                        Size
                        <select class="lbm-picture-option-control"
                            data-picture-option="size"
                            data-image-index="${imageIndex}">
                            <option value="">Choose size</option>
                            ${availableSizes.map(size => `
                                <option value="${escapeHTML(size)}"
                                    ${pictureOptions.size === size ? "selected" : ""}>
                                    ${escapeHTML(size)}
                                </option>
                            `).join("")}
                        </select>
                    </label>
                `
                : "";

            const colourControl = availableColours.length
                ? `
                    <label class="lbm-picture-option-label">
                        Colour
                        <select class="lbm-picture-option-control"
                            data-picture-option="colour"
                            data-image-index="${imageIndex}">
                            <option value="">Choose colour</option>
                            ${availableColours.map(colour => `
                                <option value="${escapeHTML(colour)}"
                                    ${pictureOptions.colour === colour ? "selected" : ""}>
                                    ${escapeHTML(colour)}
                                </option>
                            `).join("")}
                        </select>
                    </label>
                `
                : "";

            return `
                <div class="lbm-picture-variant-card">
                    <div class="lbm-picture-variant-heading">
                        <img src="${safeURL}" alt="">
                        <strong>Picture ${imageIndex >= 0 ? imageIndex + 1 : selectedIndex + 1}</strong>
                    </div>
                    <div class="lbm-picture-variant-fields">
                        ${sizeControl}
                        ${colourControl}
                        <label class="lbm-picture-option-label">
                            Quantity
                            <input class="lbm-picture-option-control"
                                type="number" min="1" step="1"
                                data-picture-option="quantity"
                                data-image-index="${imageIndex}"
                                value="${Math.max(1, Number(pictureOptions.quantity) || 1)}">
                        </label>
                    </div>
                </div>
            `;

        }).join("")
        : "";

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
            : "SELECT PICTURES TO ADD TO CART";

}


/* =====================================================
   23. CHANGE PREVIEW IMAGE
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
   24. CLOSE IMAGE PREVIEW
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
   25. PREVIEW KEYBOARD CONTROLS
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
   26. IMAGE GALLERY + SELECTION STYLES
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
    width: 64px;
    min-height: 76px;
    padding: 4px;
    border: 2px solid #ddd;
    border-radius: 5px;
    background: white;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
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

.lbm-variant-label {
    display: block;
    margin: 10px 0 5px;
    font-size: 13px;
    font-weight: 700;
}
.lbm-variant-select {
    display: block;
    width: 100%;
    min-height: 40px;
    margin: 0 0 8px;
    padding: 8px 10px;
    border: 1px solid #c9a44c;
    border-radius: 5px;
    background: #fff;
    color: #222;
    font-size: 14px;
}

.lbm-picture-variant-card {
    margin: 10px 0;
    padding: 11px;
    border: 1px solid rgba(212,175,55,.55);
    border-radius: 8px;
    background: #222;
    text-align: left;
}
.lbm-picture-variant-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 9px;
    color: #e5c76b;
}
.lbm-picture-variant-heading img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 5px;
}
.lbm-picture-variant-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
}
.lbm-picture-option-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #eee;
    font-size: 12px;
    font-weight: 700;
}
.lbm-picture-option-control {
    width: 100%;
    min-width: 0;
    min-height: 38px;
    padding: 7px;
    border: 1px solid #c9a44c;
    border-radius: 5px;
    background: #fff;
    color: #222;
    font-size: 13px;
}
@media (max-width: 420px) {
    .lbm-picture-variant-fields {
        grid-template-columns: 1fr;
    }
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
   27. WHATSAPP CHECKOUT + SUPABASE ORDER SAVING
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

        const sizes = getProductSizes(product);
        const colours = getProductColours(product);
        if (sizes.length && !sizes.includes(item.selectedSize || "")) {
            alert("Please choose a valid size for " + product.name + ".");
            return;
        }
        if (colours.length && !colours.includes(item.selectedColour || "")) {
            alert("Please choose a valid colour for " + product.name + ".");
            return;
        }

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

            style: style,
            selected_size: item.selectedSize || null,
            selected_colour: item.selectedColour || null

        });

    }

    const confirmationLines = orderItems.map(item =>
        item.name + " — " + item.style +
        (item.selected_size ? ", Size: " + item.selected_size : "") +
        (item.selected_colour ? ", Colour: " + item.selected_colour : "") +
        ", Qty: " + item.quantity +
        ", Subtotal: " + formatPrice(item.subtotal)
    );

    const confirmed = window.confirm(
        "PLEASE CONFIRM YOUR LBM ONLINE SHOP ORDER\\n\\n" +
        confirmationLines.join("\\n") +
        "\\n\\nTOTAL: " + formatPrice(total) +
        "\\n\\nSubmit this order?"
    );

    if (!confirmed) return;

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
                (item.selected_size ? "Size: " + item.selected_size + "\n" : "") +
                (item.selected_colour ? "Colour: " + item.selected_colour + "\n" : "") +
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
   28. CUSTOMER ORDER CANCELLATION
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
   29. CANCELLATION STYLES
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
   30. INSTALL ORDER CANCELLATION
   ===================================================== */

installOrderCancellation();


/* =====================================================
   31. ALL STOREFRONT BUTTON EVENTS
   ===================================================== */

document.addEventListener("keydown", function(event) {
    const title = event.target.closest(".product-card-title[data-action='preview-image']");
    if (!title || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    previewProductImage(title.dataset.id);
});


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
   32. OPEN AND CLOSE SHOPPING CART
   ===================================================== */

if (cartButton && cartSection) {

    cartButton.addEventListener("click", function() {

        cartSection.classList.toggle("open");
        cartButton.setAttribute("aria-expanded", String(cartSection.classList.contains("open")));

    });

}


if (closeCartButton && cartSection) {

    closeCartButton.addEventListener("click", function() {

        cartSection.classList.remove("open");
        cartButton?.setAttribute("aria-expanded", "false");

    });

}


/* =====================================================
   33. CHECKOUT BUTTON
   ===================================================== */

if (checkoutButton) {

    checkoutButton.addEventListener(
        "click",
        checkoutWhatsApp
    );

}


/* =====================================================
   34. FOOTER YEAR
   ===================================================== */

const yearElement = document.getElementById("year");

if (yearElement) {

    yearElement.textContent = new Date().getFullYear();

}


/* =====================================================
   35. START LBM ONLINE SHOP
   ===================================================== */

async function startShop() {

    console.log("Starting LBM Online Shop...");

    installProductSearch();

    await Promise.all([

        loadProducts(),

        loadBackground(),

        loadSocialLinks()

    ]);

    filterProducts();

    updateCart();

    console.log("LBM Online Shop is ready.");

}


startShop().catch(error => {

    console.error(
        "LBM Shop startup error:",
        error
    );

});
