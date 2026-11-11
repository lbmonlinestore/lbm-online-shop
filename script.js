
/* =========================================================
   LBM ONLINE SHOP - PUBLIC STOREFRONT
   SUPABASE PRODUCTS + MULTIPLE IMAGE GALLERY
   SHOPPING CART + WHATSAPP CHECKOUT
   ========================================================= */

(() => {
  "use strict";

  // SUPABASE CONNECTION
  const SUPABASE_URL =
    "https://toovotqrcsulhgdrcsmn.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

  const WHATSAPP_NUMBER = "260969034955";
  const CART_STORAGE_KEY = "lbm_public_cart_v1";

  const $ = (id) => document.getElementById(id);

  const productList = $("product-list");
  const cartSection = $("cart-section");
  const cartItemsElement = $("cart-items");
  const cartCountElement = $("cart-count");
  const cartTotalElement = $("cart-total");
  const checkoutButton = $("checkout-button");

  let supabaseClient = null;
  let products = [];
  let cart = loadCart();

  // SAFE HTML
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // CURRENCY
  function money(value) {
    return "K" + Number(value || 0).toLocaleString("en-ZM", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // SAFE IMAGE URL
  function safeImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";

    try {
      const url = new URL(value, window.location.href);

      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : "";

    } catch (_) {
      return "";
    }
  }

  // MULTIPLE PRODUCT IMAGES
  function getProductImages(product) {
    const images = Array.isArray(product.images)
      ? product.images.map(safeImageUrl).filter(Boolean)
      : [];

    const primary = safeImageUrl(product.image);

    if (primary && !images.includes(primary)) {
      images.unshift(primary);
    }

    return [...new Set(images)];
  }

  // CART STORAGE
  function loadCart() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(CART_STORAGE_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? saved.filter(item => item && item.id != null)
        : [];

    } catch (_) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
      );

    } catch (error) {
      console.warn("LBM cart could not be saved:", error);
    }
  }

  function getCartProduct(productId) {
    return products.find(
      product => String(product.id) === String(productId)
    );
  }

  // DISPLAY PRODUCTS
  function renderProducts() {
    if (!productList) return;

    if (!products.length) {
      productList.innerHTML =
        '<p class="product-load-message">No products are currently available. Please check again soon.</p>';

      return;
    }

    productList.innerHTML = products.map(product => {
      const images = getProductImages(product);
      const image = images[0] || "";

      const stock = Number(product.stock ?? 0);
      const outOfStock = stock <= 0;

      const description = String(
        product.description || ""
      ).trim();

      const category = String(
        product.category || "Fashion"
      ).trim();

      return `
        <article class="product-card"
          data-product-id="${escapeHTML(product.id)}">

          <div class="product-gallery"
            data-gallery-id="${escapeHTML(product.id)}">

            ${image
              ? `<img class="product-image"
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(product.name || "LBM product")}"
                  loading="lazy">`
              : '<div class="product-image product-image-placeholder">LBM</div>'}

            ${images.length > 1 ? `
              <button class="gallery-prev"
                type="button"
                aria-label="Previous photo"
                data-gallery-action="prev"
                data-product-id="${escapeHTML(product.id)}">‹</button>

              <button class="gallery-next"
                type="button"
                aria-label="Next photo"
                data-gallery-action="next"
                data-product-id="${escapeHTML(product.id)}">›</button>

              <span class="gallery-count">1 / ${images.length}</span>
            ` : ""}

          </div>

          <div class="product-info">

            <p class="product-category">
              ${escapeHTML(category)}
            </p>

            <h3>${escapeHTML(product.name || "LBM Product")}</h3>

            <p class="product-description">
              ${escapeHTML(description)}
            </p>

            <p class="product-price">
              ${money(product.price)}
            </p>

            <p class="product-stock">
              ${outOfStock ? "Out of stock" : `${stock} available`}
            </p>

            <button class="add-button"
              type="button"
              data-add-product="${escapeHTML(product.id)}"
              ${outOfStock ? "disabled" : ""}>
              ${outOfStock ? "OUT OF STOCK" : "ADD TO CART"}
            </button>

          </div>
        </article>
      `;
    }).join("");
  }

  // DISPLAY CART
  function renderCart() {
    if (!cartItemsElement) return;

    cart = cart.filter(
      item => getCartProduct(item.id)
    );

    let totalQuantity = 0;
    let total = 0;

    if (!cart.length) {
      cartItemsElement.innerHTML =
        "<p>Your cart is empty.</p>";

    } else {

      cartItemsElement.innerHTML = cart.map(item => {
        const product = getCartProduct(item.id);

        if (!product) return "";

        const quantity = Math.max(
          1,
          Number(item.quantity) || 1
        );

        const price = Number(product.price) || 0;
        const images = getProductImages(product);

        totalQuantity += quantity;
        total += price * quantity;

        return `
          <div class="cart-item"
            data-cart-id="${escapeHTML(product.id)}">

            ${images[0]
              ? `<img src="${escapeHTML(images[0])}"
                  alt="${escapeHTML(product.name)}">`
              : ""}

            <div class="cart-item-details">

              <strong>${escapeHTML(product.name)}</strong>

              <small>${money(price)} each</small>

              <div class="quantity-controls">

                <button type="button"
                  data-cart-action="decrease"
                  data-product-id="${escapeHTML(product.id)}"
                  aria-label="Decrease quantity">−</button>

                <span>${quantity}</span>

                <button type="button"
                  data-cart-action="increase"
                  data-product-id="${escapeHTML(product.id)}"
                  aria-label="Increase quantity">+</button>

              </div>

            </div>

            <strong>${money(price * quantity)}</strong>

          </div>
        `;
      }).join("");
    }

    if (cartCountElement) {
      cartCountElement.textContent = String(totalQuantity);
    }

    if (cartTotalElement) {
      cartTotalElement.textContent = money(total);
    }

    if (checkoutButton) {
      checkoutButton.disabled = cart.length === 0;
    }

    saveCart();
  }

  // ADD TO CART
  function addToCart(productId) {
    const product = getCartProduct(productId);

    if (!product) return;

    const stock = Number(product.stock ?? 0);

    if (stock <= 0) return;

    const existing = cart.find(
      item => String(item.id) === String(productId)
    );

    if (existing) {

      if (Number(existing.quantity) >= stock) {
        alert(
          "Sorry, only " + stock +
          " item(s) are currently available."
        );

        return;
      }

      existing.quantity = Number(existing.quantity) + 1;

    } else {

      cart.push({
        id: product.id,
        quantity: 1
      });
    }

    saveCart();
    renderCart();
  }

  // CHANGE CART QUANTITY
  function changeQuantity(productId, change) {
    const item = cart.find(
      entry => String(entry.id) === String(productId)
    );

    const product = getCartProduct(productId);

    if (!item || !product) return;

    const next = Number(item.quantity) + change;
    const stock = Number(product.stock ?? 0);

    if (next <= 0) {

      cart = cart.filter(
        entry => String(entry.id) !== String(productId)
      );

    } else if (next > stock) {

      alert(
        "Sorry, only " + stock +
        " item(s) are currently available."
      );

    } else {

      item.quantity = next;
    }

    saveCart();
    renderCart();
  }

  // WHATSAPP CHECKOUT
  function checkoutWhatsApp() {
    if (!cart.length) return;

    const lines = [
      "Hello LBM Online Shop, I would like to place this order:",
      ""
    ];

    let total = 0;

    cart.forEach(item => {
      const product = getCartProduct(item.id);

      if (!product) return;

      const quantity = Number(item.quantity) || 1;

      const subtotal =
        Number(product.price || 0) * quantity;

      total += subtotal;

      lines.push(
        `${product.name} x ${quantity} - ${money(subtotal)}`
      );
    });

    lines.push(
      "",
      `TOTAL: ${money(total)}`,
      "",
      "Please advise me on payment and delivery."
    );

    const url =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  // LOAD PRODUCTS FROM SUPABASE
  async function loadProducts() {
    if (!productList) return;

    productList.innerHTML =
      '<p class="product-load-message">Loading products...</p>';

    try {

      if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
      ) {
        throw new Error(
          "The Supabase library did not load. Please refresh the page."
        );
      }

      if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );
      }

      const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, description, category, price, stock, image, images")
        .order("id", { ascending: false });

      if (error) throw error;

      products = Array.isArray(data) ? data : [];

      renderProducts();
      renderCart();

    } catch (error) {

      console.error(
        "LBM product loading error:",
        error
      );

      productList.innerHTML = `
        <div class="product-load-error">

          <strong>Products could not be loaded.</strong>

          <p>
            ${escapeHTML(error.message || "Please try again later.")}
          </p>

          <button type="button"
            id="retry-products"
            class="add-button">
            TRY AGAIN
          </button>

        </div>
      `;
    }
  }

  // LOAD SHOP SETTINGS
  async function loadSiteSettings() {
    try {

      if (!supabaseClient) {
        if (!window.supabase) return;

        supabaseClient = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );
      }

      const { data, error } = await supabaseClient
        .from("site_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "shop_background",
          "social_facebook",
          "social_instagram",
          "social_whatsapp"
        ]);

      if (error) throw error;

      const settings = Object.fromEntries(
        (data || []).map(row => [
          row.setting_key,
          row.setting_value
        ])
      );

      const hero = document.querySelector(".hero");

      const background = safeImageUrl(
        settings.shop_background
      );

      if (hero && background) {

        hero.style.backgroundImage =
          `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.66)), url("${background.replace(/["\\]/g, "")}")`;

        hero.style.backgroundSize = "cover";
        hero.style.backgroundPosition = "center";
      }

      const socialMap = [
        ["facebookLink", settings.social_facebook],
        ["instagramLink", settings.social_instagram],
        ["whatsappLink", settings.social_whatsapp]
      ];

      socialMap.forEach(([id, value]) => {

        const link = $(id);

        if (!link) return;

        const url = safeImageUrl(value);

        if (url) {

          link.href = url;
          link.hidden = false;

        } else if (id !== "whatsappLink") {

          link.hidden = true;
        }
      });

    } catch (error) {

      console.warn(
        "LBM optional site settings were not loaded:",
        error.message
      );
    }
  }

  // PRODUCT BUTTONS AND IMAGE GALLERY
  if (productList) {

    productList.addEventListener("click", (event) => {

      const addButton = event.target.closest(
        "[data-add-product]"
      );

      if (addButton) {

        addToCart(addButton.dataset.addProduct);
        return;
      }

      const galleryButton = event.target.closest(
        "[data-gallery-action]"
      );

      if (galleryButton) {

        const product = products.find(
          p => String(p.id) ===
          String(galleryButton.dataset.productId)
        );

        if (!product) return;

        const images = getProductImages(product);

        if (images.length < 2) return;

        const card = galleryButton.closest(".product-card");

        const imageElement =
          card && card.querySelector(".product-image");

        const countElement =
          card && card.querySelector(".gallery-count");

        if (!imageElement) return;

        let index = Number(card.dataset.imageIndex || 0);

        index =
          galleryButton.dataset.galleryAction === "next"
            ? (index + 1) % images.length
            : (index - 1 + images.length) % images.length;

        card.dataset.imageIndex = String(index);

        imageElement.src = images[index];

        if (countElement) {
          countElement.textContent =
            `${index + 1} / ${images.length}`;
        }
      }
    });
  }

  // OPEN CART
  if ($("cart-button") && cartSection) {

    $("cart-button").addEventListener("click", () => {

      cartSection.classList.toggle("open");

      if (cartSection.classList.contains("open")) {

        cartSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  }

  // CLOSE CART
  if ($("close-cart") && cartSection) {

    $("close-cart").addEventListener("click", () => {
      cartSection.classList.remove("open");
    });
  }

  // CART QUANTITY BUTTONS
  if (cartItemsElement) {

    cartItemsElement.addEventListener("click", (event) => {

      const button = event.target.closest(
        "[data-cart-action]"
      );

      if (!button) return;

      changeQuantity(
        button.dataset.productId,
        button.dataset.cartAction === "increase" ? 1 : -1
      );
    });
  }

  // CHECKOUT BUTTON
  if (checkoutButton) {
    checkoutButton.addEventListener(
      "click",
      checkoutWhatsApp
    );
  }

  // RETRY PRODUCT LOADING
  if (productList) {

    productList.addEventListener("click", (event) => {

      if (event.target.closest("#retry-products")) {
        loadProducts();
      }
    });
  }

  // AUTOMATIC COPYRIGHT YEAR
  const year = $("year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // IMPORTANT:
  // Load products before reconciling saved cart entries.
  // This prevents the saved cart from being cleared
  // before the Supabase catalogue has loaded.

  loadProducts();
  loadSiteSettings();

})();
