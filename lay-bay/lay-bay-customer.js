/* =========================================================
   LBM LAY-BAY — CUSTOMER DASHBOARD
   Integrated main-store catalogue
   Administrator-configured Lay-Bay pricing
   Products | Savings | Deposits | Receipts | Refunds
   Customer Profile Pictures | Product Variants
   LIVE INTEGRATION BUILD
========================================================= */

(function () {
  "use strict";

  // =======================================================
  // 1. SUPABASE CONFIGURATION
  // =======================================================

  const SUPABASE_URL =
    "https://toovotqrcsulhgdrcsmn.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

  const AVATAR_BUCKET = "customer-avatars";
  const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

  if (!window.supabase) {
    document.body.textContent =
      "Supabase could not load. Please check your internet connection.";
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  window.LBM_CUSTOMER_DB = db;

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let products = [];
  let plans = [];
  let deposits = [];
  let balances = [];
  let receipts = [];
  let refunds = [];
// Customer's temporary Lay-Bay selection basket
  // Customer's temporary Lay-Bay selection basket
let layBaySelectionCart = [];
  let avatarObjectUrl = null;
  let avatarSignedUrl = null;

  // =======================================================
  // 2. GENERAL HELPERS
  // =======================================================

  function money(value) {
    return "K" + (Number(value) || 0).toLocaleString("en-ZM", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function message(id, text, success = true) {
    const element = $(id);
    if (!element) return;

    element.textContent = text;
    element.style.color = success ? "#D4AF37" : "#ff7777";
  }

  function dateText(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString("en-ZM", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function updateDiagnostic(text) {
    const box = $("lbDiagnostic");
    if (box) box.textContent += "\n" + text;
  }

  function setButton(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;
    button.textContent = text;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  // =======================================================
  // 3. EXTRA SECTIONS
  // =======================================================

  function ensureExtraSections() {
    const main = document.querySelector("main");
    if (!main) return;

    if (!$("receiptsSection")) {
      const section = createElement("section", "lb-panel");
      section.id = "receiptsSection";

      const heading = createElement("h2", "", "My Payment Receipts");
      const status = createElement("div", "lb-message");
      status.id = "receiptsMessage";

      const list = createElement("div");
      list.id = "receiptsList";

      section.append(heading, status, list);

      const history = $("depositHistory");

      if (history && history.closest("section")) {
        history.closest("section").after(section);
      } else {
        main.appendChild(section);
      }
    }

    if (!$("refundsSection")) {
      const section = createElement("section", "lb-panel");
      section.id = "refundsSection";

      const heading = createElement("h2", "", "My Refund Requests");
      const status = createElement("div", "lb-message");
      status.id = "refundsMessage";

      const list = createElement("div");
      list.id = "refundsList";

      section.append(heading, status, list);

      const receiptSection = $("receiptsSection");

      if (receiptSection) {
        receiptSection.after(section);
      } else {
        main.appendChild(section);
      }
    }
  }

  // =======================================================
  // 4. PRODUCT HELPERS
  // =======================================================

  function productPrice(product) {
    const normal = Number(product.price);
    const layBay = Number(product.lay_bay_price);

    if (
      !Number.isFinite(normal) ||
      normal <= 0 ||
      !Number.isFinite(layBay) ||
      layBay <= normal
    ) return 0;

    return Number(layBay.toFixed(2));
  }

  function productEnabled(product) {
    return product.lay_bay_enabled === true;
  }

  function productImages(product) {
    let urls = [];

    [
      product.images,
      product.image_urls,
      product.image_url,
      product.image
    ].forEach(value => {
      if (Array.isArray(value)) {
        urls.push(...value);
      } else if (typeof value === "string" && value.trim()) {
        try {
          const parsed = JSON.parse(value);

          if (Array.isArray(parsed)) {
            urls.push(...parsed);
          } else {
            urls.push(value);
          }
        } catch (_) {
          urls.push(value);
        }
      }
    });

    return [...new Set(
      urls.filter(url =>
        typeof url === "string" &&
        /^https?:\/\//i.test(url)
      )
    )];
  }

  function productEligible(product) {
    return productEnabled(product) &&
      Number(product.stock) > 0 &&
      productPrice(product) > Number(product.price);
  }

  function productAvailability(product) {
    if (Number(product.stock) <= 0) {
      return { label: "Out of stock", available: false };
    }

    if (Number(product.price) <= 0) {
      return { label: "Normal price unavailable", available: false };
    }

    if (productPrice(product) <= Number(product.price)) {
      return { label: "Lay-Bay price not configured", available: false };
    }

    if (!productEnabled(product)) {
      return { label: "Not yet available", available: false };
    }

    return { label: "Available for Lay-Bay", available: true };
  }

  function balanceFor(planId) {
    return balances.find(row =>
      String(row.plan_id) === String(planId)
    );
  }

  // =======================================================
  // 5. PRODUCT SIZE AND COLOUR OPTIONS
  // =======================================================

  function readJsonArray(value) {
    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    return [];
  }

  function productSizes(product) {
    const raw = readJsonArray(product.available_sizes)
      .map(value => String(value).trim())
      .filter(Boolean);

    const upper = raw.map(value => value.toUpperCase());

    // SMALL _ 4XL
    if (
      upper.length === 3 &&
      upper[0] === "SMALL" &&
      upper[1] === "_" &&
      upper[2] === "4XL"
    ) {
      return [
        "SMALL", "MEDIUM", "LARGE",
        "XL", "2XL", "3XL", "4XL"
      ];
    }

    // MEDIUM TO 3XL
    if (
      upper.length === 3 &&
      upper[0] === "MEDIUM" &&
      upper[1] === "TO" &&
      upper[2] === "3XL"
    ) {
      return [
        "MEDIUM", "LARGE", "XL", "2XL", "3XL"
      ];
    }

    // M TO 3XL
    if (
      upper.length === 3 &&
      upper[0] === "M" &&
      upper[1] === "TO" &&
      upper[2] === "3XL"
    ) {
      return ["M", "L", "XL", "2XL", "3XL"];
    }

    // Keep descriptive size information out of selectors.
    const descriptive = [
      "TO", "_", "FOR", "THE", "CHILDREN",
      "AGES", "FIVE", "THIRTEEN", "YEARS"
    ];

    return raw.filter(value =>
      !descriptive.includes(value.toUpperCase())
    );
  }

  function productColours(product) {
    return readJsonArray(product.available_colours)
      .map(value => String(value).trim())
      .filter(value =>
        value &&
        value.toLowerCase() !== "as seen in pictures"
      );
  }

  // =======================================================
  // 6. CUSTOMER PROFILE PICTURE
  // =======================================================

  function createProfileStyles() {
    if ($("lbProfileStyles")) return;

    const style = document.createElement("style");
    style.id = "lbProfileStyles";

    style.textContent = `
      .lb-profile-panel {
        display:flex;
        align-items:center;
        gap:18px;
        flex-wrap:wrap;
        margin:15px 0 22px;
        padding:18px;
        border:1px solid #D4AF37;
        border-radius:12px;
        background:#111;
      }

      .lb-avatar {
        width:92px;
        height:92px;
        border-radius:50%;
        object-fit:cover;
        border:3px solid #D4AF37;
        background:#222;
      }

      .lb-avatar-actions {
        display:flex;
        flex-direction:column;
        gap:9px;
      }

      .lb-avatar-actions button {
        padding:9px 13px;
        border:1px solid #D4AF37;
        border-radius:6px;
        background:#D4AF37;
        color:#080808;
        font-weight:bold;
        cursor:pointer;
      }

      .lb-avatar-actions button:disabled {
        opacity:.5;
      }

      .lb-avatar-note {
        font-size:12px;
        color:#aaa;
      }

      .lb-variant-box {
        margin:12px 0;
        padding:12px;
        border:1px solid #8a7029;
        border-radius:8px;
      }

      .lb-variant-box label {
        display:block;
        margin:8px 0 5px;
        color:#D4AF37;
      }

      .lb-variant-box select {
        width:100%;
        padding:11px;
        border-radius:6px;
        border:1px solid #777;
        background:#171717;
        color:white;
      }

      .lb-plan-variant {
        color:#D4AF37;
        font-weight:bold;
      }
    `;

    style.textContent += `
      .lb-profile-editor { width:100%; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid #51451f; }
      .lb-profile-editor label { display:block; margin:9px 0 5px; color:#ddd; }
      .lb-profile-editor input { width:100%; box-sizing:border-box; padding:11px; background:#080808; color:#fff; border:1px solid #777; border-radius:7px; }
      .lb-profile-editor button { margin-top:9px; }
    `;
    document.head.appendChild(style);
  }

  function createProfilePanel() {
    createProfileStyles();

    if ($("lbProfilePanel")) return;

    const panel = createElement("section", "lb-profile-panel");
    panel.id = "lbProfilePanel";

    const avatar = createElement("img", "lb-avatar");
    avatar.id = "lbCustomerAvatar";
    avatar.alt = "Customer profile picture";

    const details = createElement("div", "lb-avatar-actions");

    const heading = createElement("strong", "", "My Profile Picture");

    const profileEditor = createElement("div", "lb-profile-editor");
    const profileHeading = createElement("strong", "", "Edit Profile");
    const nameLabel = createElement("label", "", "Full name");
    nameLabel.htmlFor = "lbProfileName";
    const nameInput = createElement("input");
    nameInput.type = "text";
    nameInput.id = "lbProfileName";
    nameInput.autocomplete = "name";
    nameInput.maxLength = 80;
    nameInput.placeholder = "Enter your full name";
    const saveProfile = createElement("button", "", "Save Profile");
    saveProfile.type = "button";
    const profileStatus = createElement("div", "lb-avatar-note");
    profileStatus.id = "lbProfileMessage";
    profileEditor.append(profileHeading, nameLabel, nameInput, saveProfile, profileStatus);

    saveProfile.addEventListener("click", saveCustomerProfile);

    const file = createElement("input");
    file.type = "file";
    file.id = "lbAvatarFile";
    file.accept = "image/jpeg,image/png,image/webp";
    file.hidden = true;

    const upload = createElement("button", "", "Choose Picture");
    upload.type = "button";

    const remove = createElement("button", "", "Remove Picture");
    remove.type = "button";
    remove.id = "lbRemoveAvatar";

    const status = createElement("div", "lb-avatar-note");
    status.id = "lbAvatarMessage";

    const note = createElement(
      "small",
      "lb-avatar-note",
      "JPG, PNG or WEBP. Maximum 5 MB."
    );

    upload.addEventListener("click", () => file.click());

    file.addEventListener("change", previewAvatar);

    remove.addEventListener("click", removeAvatar);

    details.append(profileEditor, heading, upload, remove, note, status, file);
    panel.append(avatar, details);

    const customerName = $("customerEmail");

    if (customerName && customerName.parentElement) {
      customerName.parentElement.after(panel);
    } else {
      const main = document.querySelector("main");
      if (main) main.prepend(panel);
    }

    avatar.src = avatarPlaceholder();
    nameInput.value =
      currentUser?.user_metadata?.full_name ||
      currentUser?.user_metadata?.name ||
      "";
  }

  async function saveCustomerProfile() {
    const input = $("lbProfileName");
    const status = $("lbProfileMessage");
    const saveButton = $("lbProfilePanel")?.querySelector("button");
    const fullName = String(input?.value || "").trim();

    if (!fullName) {
      message("lbProfileMessage", "Please enter your name.", false);
      return;
    }
    if (fullName.length > 80) {
      message("lbProfileMessage", "Your name must be 80 characters or fewer.", false);
      return;
    }

    if (saveButton) saveButton.disabled = true;
    message("lbProfileMessage", "Saving your profile...");

    try {
      const { data, error } = await db.auth.updateUser({
        data: {
          ...(currentUser?.user_metadata || {}),
          full_name: fullName,
          name: fullName
        }
      });
      if (error) throw error;

      currentUser = data.user || currentUser;
      if ($("customerEmail")) $("customerEmail").textContent = fullName;
      message("lbProfileMessage", "Your profile name has been updated.");
    } catch (error) {
      message(
        "lbProfileMessage",
        error.message || "Could not update your profile.",
        false
      );
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }


  // =======================================================
  // 6. CUSTOMER-CONTROLLED ACCOUNT DELETION
  // Email reauthentication + explicit confirmation
  // =======================================================

  function createAccountDeletionPanel() {
    if ($("lbAccountDeletionPanel")) return;

    const panel = createElement("section", "lb-profile-panel");
    panel.id = "lbAccountDeletionPanel";
    panel.style.display = "block";
    panel.style.marginTop = "18px";
    panel.style.padding = "18px";

    const heading = createElement("h2", "", "Before you delete your account");
    heading.style.color = "#D4AF37";

    const explanation = createElement(
      "p",
      "",
      "You may request permanent deletion of your Lay-Bay sign-in account when all your plans and payments are settled. Active plans, pending deposits, unresolved refunds or pending extension requests must be resolved first."
    );

    const recordsNote = createElement(
      "p",
      "lb-avatar-note",
      "For accounting, legal and dispute-resolution purposes, LBM may retain transaction records that it is required to keep. Your sign-in account and eligible profile information will be deleted. Download any receipts you wish to keep before proceeding."
    );

    const sendCode = createElement("button", "", "Send email verification code");
    sendCode.type = "button";

    const otpArea = createElement("div");
    otpArea.id = "lbDeletionOtpArea";
    otpArea.style.display = "none";

    const otpLabel = createElement("label", "", "Verification code sent to your account email");
    otpLabel.style.display = "block";
    otpLabel.style.margin = "12px 0 6px";

    const otpInput = createElement("input");
    otpInput.id = "lbDeletionOtp";
    otpInput.type = "text";
    otpInput.inputMode = "numeric";
    otpInput.autocomplete = "one-time-code";
    otpInput.maxLength = 10;
    otpInput.placeholder = "Enter email verification code";
    otpInput.style.cssText = "width:100%;box-sizing:border-box;padding:12px;border-radius:7px;margin-bottom:10px;";

    const verifyCode = createElement("button", "", "Verify code");
    verifyCode.type = "button";

    const finalArea = createElement("div");
    finalArea.id = "lbDeletionFinalArea";
    finalArea.style.display = "none";
    finalArea.style.marginTop = "14px";

    const finalNote = createElement(
      "p",
      "",
      "This action is permanent. Type DELETE MY ACCOUNT exactly below to confirm."
    );

    const phrase = createElement("input");
    phrase.id = "lbDeletionPhrase";
    phrase.type = "text";
    phrase.autocomplete = "off";
    phrase.placeholder = "DELETE MY ACCOUNT";
    phrase.style.cssText = "width:100%;box-sizing:border-box;padding:12px;border-radius:7px;margin-bottom:10px;";

    const deleteButton = createElement("button", "", "Permanently Delete My Account");
    deleteButton.type = "button";
    deleteButton.style.background = "#8b1e1e";
    deleteButton.style.color = "#fff";

    const status = createElement("p", "lb-avatar-note");
    status.id = "lbDeletionMessage";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    sendCode.addEventListener("click", async () => {
      if (!currentUser || !currentUser.email) {
        message("lbDeletionMessage", "We could not find an email address for this account. Please contact LBM support.", false);
        return;
      }

      setButton(sendCode, true, "Sending code...");
      try {
        const { error } = await db.auth.reauthenticate();
        if (error) throw error;
        otpArea.style.display = "block";
        message("lbDeletionMessage", "A verification code has been sent to your account email. Check your inbox and spam folder.");
      } catch (error) {
        message("lbDeletionMessage", error.message || "Could not send the verification code.", false);
      } finally {
        setButton(sendCode, false, "Resend verification code");
      }
    });

    verifyCode.addEventListener("click", async () => {
      const token = otpInput.value.trim();
      if (!token) {
        message("lbDeletionMessage", "Enter the verification code first.", false);
        return;
      }

      setButton(verifyCode, true, "Verifying...");
      try {
        const { data, error } = await db.auth.verifyOtp({
          email: currentUser.email,
          token,
          type: "reauthentication"
        });
        if (error) throw error;
        if (data.user) currentUser = data.user;
        finalArea.style.display = "block";
        otpInput.disabled = true;
        setButton(verifyCode, true, "Email verified");
        message("lbDeletionMessage", "Email verification successful. You may now confirm account deletion.");
      } catch (error) {
        message("lbDeletionMessage", error.message || "The verification code is invalid or expired.", false);
        setButton(verifyCode, false, "Verify code");
      }
    });

    deleteButton.addEventListener("click", async () => {
      if (phrase.value.trim() !== "DELETE MY ACCOUNT") {
        message("lbDeletionMessage", "Type DELETE MY ACCOUNT exactly to confirm.", false);
        return;
      }

      if (!window.confirm("This permanently deletes your Lay-Bay sign-in account. Transaction records required by LBM may be retained. Continue?")) {
        return;
      }

      setButton(deleteButton, true, "Deleting account...");
      try {
        const { data, error } = await db.functions.invoke("delete-lay-bay-account", {
          body: { confirmation: "DELETE MY ACCOUNT" }
        });

        if (error) {
          let detail = error.message || "Account deletion could not be completed.";
          try {
            const response = error.context && await error.context.json();
            if (response && response.error) detail = response.error;
          } catch (_) {}
          throw new Error(detail);
        }

        if (data && data.error) throw new Error(data.error);

        message("lbDeletionMessage", "Your Lay-Bay account has been deleted. Signing out...");
        await db.auth.signOut({ scope: "local" });
        window.location.replace("index.html");
      } catch (error) {
        message("lbDeletionMessage", error.message || "Account deletion could not be completed. Please contact LBM support.", false);
        setButton(deleteButton, false, "Permanently Delete My Account");
      }
    });

    otpArea.append(otpLabel, otpInput, verifyCode);
    finalArea.append(finalNote, phrase, deleteButton);
    panel.append(heading, explanation, recordsNote, sendCode, otpArea, finalArea, status);

    const mount = $("lbAccountDeletionContent");
    if (mount) {
      mount.innerHTML = "";
      mount.appendChild(panel);
    } else {
      const profile = $("lbProfilePanel");
      if (profile && profile.parentNode) {
        profile.after(panel);
      } else {
        const main = document.querySelector("main");
        if (main) main.appendChild(panel);
      }
    }
  }

  function avatarPlaceholder() {
    return "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
        '<rect width="100%" height="100%" fill="#222"/>' +
        '<circle cx="50" cy="36" r="19" fill="#D4AF37"/>' +
        '<path d="M15 100 Q18 62 50 62 Q82 62 85 100" fill="#D4AF37"/>' +
        "</svg>"
      );
  }

  function previewAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(file.type)) {
      message("lbAvatarMessage", "Choose a JPG, PNG or WEBP image.", false);
      event.target.value = "";
      return;
    }

    if (file.size > AVATAR_MAX_SIZE) {
      message("lbAvatarMessage", "Image must not exceed 5 MB.", false);
      event.target.value = "";
      return;
    }

    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
    }

    avatarObjectUrl = URL.createObjectURL(file);

    $("lbCustomerAvatar").src = avatarObjectUrl;

    uploadAvatar(file);
  }

  async function loadAvatar() {
    if (!currentUser) return;

    createProfilePanel();

    const path = currentUser.user_metadata?.avatar_path;

    if (!path) {
      $("lbCustomerAvatar").src = avatarPlaceholder();
      return;
    }

    const { data, error } = await db.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 3600);

    if (error) {
      message(
        "lbAvatarMessage",
        "Could not load profile picture: " + error.message,
        false
      );
      return;
    }

    avatarSignedUrl = data.signedUrl;
    $("lbCustomerAvatar").src = avatarSignedUrl;
  }

  async function uploadAvatar(file) {
    if (!currentUser) return;

    const button = $("lbProfilePanel")
      ?.querySelector("button");

    if (button) setButton(button, true, "Uploading...");

    message("lbAvatarMessage", "Uploading your picture...");

    const extension = file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

    const path =
      currentUser.id +
      "/avatar-" +
      Date.now() +
      "." +
      extension;

    try {
      const { error: uploadError } = await db.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const oldPath = currentUser.user_metadata?.avatar_path;

      const { data, error: metadataError } =
        await db.auth.updateUser({
          data: {
            avatar_path: path
          }
        });

      if (metadataError) {
        await db.storage.from(AVATAR_BUCKET).remove([path]);
        throw metadataError;
      }

      currentUser = data.user || currentUser;

      if (oldPath && oldPath !== path) {
        await db.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }

      if (avatarObjectUrl) {
        URL.revokeObjectURL(avatarObjectUrl);
        avatarObjectUrl = null;
      }

      await loadAvatar();

      message("lbAvatarMessage", "Profile picture updated successfully.");

    } catch (error) {
      message(
        "lbAvatarMessage",
        error.message || "Could not upload profile picture.",
        false
      );

      await loadAvatar();

    } finally {
      if (button) setButton(button, false, "Choose Picture");
      if ($("lbAvatarFile")) $("lbAvatarFile").value = "";
    }
  }

  async function removeAvatar() {
    if (!currentUser) return;

    const path = currentUser.user_metadata?.avatar_path;

    if (!path) {
      message("lbAvatarMessage", "You do not have a profile picture.");
      return;
    }

    if (!window.confirm("Remove your profile picture?")) return;

    const button = $("lbRemoveAvatar");
    setButton(button, true, "Removing...");

    try {
      const { error: deleteError } = await db.storage
        .from(AVATAR_BUCKET)
        .remove([path]);

      if (deleteError) throw deleteError;

      const { data, error: metadataError } =
        await db.auth.updateUser({
          data: { avatar_path: null }
        });

      if (metadataError) throw metadataError;

      currentUser = data.user || currentUser;

      $("lbCustomerAvatar").src = avatarPlaceholder();

      message("lbAvatarMessage", "Profile picture removed.");

    } catch (error) {
      message(
        "lbAvatarMessage",
        error.message || "Could not remove profile picture.",
        false
      );

    } finally {
      setButton(button, false, "Remove Picture");
    }
  }

        
  // =======================================================
  // 7. INTERACTIVE PRODUCT IMAGE GALLERY
  // Multiple pictures with independent size, colour
  // and quantity selections
  // =======================================================

  let productGallery = null;
  let galleryImages = [];
  let galleryIndex = 0;
  let galleryProduct = null;

  // Multiple selected pictures
  let gallerySelectedImageIndexes = [];

  // Independent options for each selected picture
  let galleryImageOptions = {};

  function createProductGallery() {
    if (productGallery) return;

    const style = document.createElement("style");
    style.id = "lbInteractiveGalleryStyles";

    style.textContent = `
      .lb-gallery-overlay {
        position:fixed;
        inset:0;
        z-index:99999;
        background:rgba(0,0,0,.96);
        display:none;
        align-items:flex-start;
        justify-content:center;
        padding:55px 12px 20px;
        overflow-y:auto;
      }

      .lb-gallery-overlay.open {
        display:flex;
      }

      .lb-gallery-content {
        position:relative;
        width:100%;
        max-width:850px;
        text-align:center;
        padding-bottom:20px;
      }

      .lb-gallery-close {
        position:fixed;
        top:10px;
        right:12px;
        width:42px;
        height:42px;
        border-radius:50%;
        border:0;
        font-size:26px;
        background:#D4AF37;
        color:#080808;
        z-index:2;
      }

      .lb-gallery-title {
        color:#D4AF37;
        margin:0 45px 14px;
      }

      .lb-gallery-image-wrap {
        position:relative;
        width:100%;
      }

      .lb-gallery-image {
        display:block;
        width:100%;
        height:min(58vh,580px);
        object-fit:contain;
        background:#080808;
        border-radius:10px;
      }

      .lb-gallery-current-select {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        padding:10px 15px;
        margin:12px 0 5px;
        border:1px solid #D4AF37;
        border-radius:25px;
        color:#fff;
        background:#191919;
        cursor:pointer;
      }

      .lb-gallery-current-select input {
        width:21px;
        height:21px;
        accent-color:#D4AF37;
      }

      .lb-gallery-controls {
        display:flex;
        justify-content:center;
        align-items:center;
        gap:14px;
        margin-top:12px;
      }

      .lb-gallery-count {
        color:#D4AF37;
        font-weight:bold;
      }

      .lb-gallery-thumbnails {
        display:flex;
        justify-content:flex-start;
        align-items:center;
        gap:10px;
        flex-wrap:nowrap;
        overflow-x:auto;
        overflow-y:hidden;
        width:100%;
        padding:8px 4px 14px;
        margin:15px 0 22px;
        box-sizing:border-box;
        -webkit-overflow-scrolling:touch;
        scroll-behavior:smooth;
        scroll-snap-type:x mandatory;
      }

      .lb-gallery-thumb-option {
        position:relative;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:5px;
        flex:0 0 75px;
        width:75px;
        padding:5px;
        border:2px solid #555;
        border-radius:8px;
        background:#171717;
        cursor:pointer;
        scroll-snap-align:center;
      }

      .lb-gallery-thumb-option.active {
        border-color:#D4AF37;
      }

      .lb-gallery-thumb-option.selected {
        border-color:#25a56a;
      }

      .lb-gallery-thumb-option img {
        width:60px;
        height:60px;
        object-fit:cover;
        border-radius:5px;
      }

      .lb-gallery-thumb-option input {
        width:20px;
        height:20px;
        accent-color:#D4AF37;
      }

      .lb-gallery-selection {
        text-align:left;
        margin:20px 0;
        padding:16px;
        border:1px solid #8a7029;
        border-radius:10px;
        background:#111;
      }

      .lb-gallery-selection h3 {
        color:#D4AF37;
        margin-top:0;
      }

      .lb-gallery-selection-message {
        color:#D4AF37;
        font-size:14px;
        min-height:20px;
      }

      .lb-gallery-selected-note {
        color:#D4AF37;
        font-size:13px;
      }

      .lb-gallery-picture-options {
        border:1px solid #665522;
        border-radius:9px;
        padding:12px;
        margin:13px 0;
        background:#191919;
      }

      .lb-gallery-picture-options h4 {
        color:#D4AF37;
        margin:5px 0 12px;
      }

      .lb-gallery-picture-options img {
        width:75px;
        height:75px;
        object-fit:contain;
        background:#080808;
        border-radius:7px;
      }

      .lb-gallery-picture-options label {
        display:block;
        color:#D4AF37;
        margin:12px 0 6px;
      }

      .lb-gallery-picture-options select,
      .lb-gallery-picture-options input[type="number"] {
        display:block;
        width:100%;
        box-sizing:border-box;
        padding:11px;
        border:1px solid #777;
        border-radius:6px;
        background:#1a1a1a;
        color:#fff;
      }

      .lb-gallery-picture-heading {
        display:flex;
        align-items:center;
        gap:12px;
      }

      .lb-gallery-picture-heading strong {
        color:#fff;
      }

      @media(max-width:480px) {
        .lb-gallery-overlay {
          padding-left:9px;
          padding-right:9px;
        }

        .lb-gallery-image {
          height:48vh;
        }

        .lb-gallery-controls {
          gap:7px;
        }

        .lb-gallery-controls button {
          padding:9px 10px;
          font-size:12px;
        }
      }
    `;

    document.head.appendChild(style);

    const overlay = createElement(
      "div",
      "lb-gallery-overlay"
    );

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const content = createElement(
      "div",
      "lb-gallery-content"
    );

    const close = createElement(
      "button",
      "lb-gallery-close",
      "×"
    );

    close.type = "button";
    close.setAttribute(
      "aria-label",
      "Close product gallery"
    );

    const title = createElement(
      "h2",
      "lb-gallery-title"
    );

    const image = createElement(
      "img",
      "lb-gallery-image"
    );

    image.alt = "Product picture";

    const currentSelectLabel = createElement(
      "label",
      "lb-gallery-current-select"
    );

    const currentSelect = createElement("input");
    currentSelect.type = "checkbox";

    const currentSelectText = createElement(
      "span",
      "",
      "Select this exact picture"
    );

    currentSelectLabel.append(
      currentSelect,
      currentSelectText
    );

    const count = createElement(
      "span",
      "lb-gallery-count"
    );

    const previous = createElement(
      "button",
      "",
      "❮ Previous"
    );

    previous.type = "button";

    const next = createElement(
      "button",
      "",
      "Next ❯"
    );

    next.type = "button";

    const controls = createElement(
      "div",
      "lb-gallery-controls"
    );

    controls.append(previous, count, next);

    const thumbnails = createElement(
      "div",
      "lb-gallery-thumbnails"
    );

    const selection = createElement(
      "div",
      "lb-gallery-selection"
    );

    const galleryDescription = createElement("p", "lb-gallery-description");
    const galleryPrice = createElement("p", "lb-gallery-price");

    const selectionHeading = createElement(
      "h3",
      "",
      "Choose Your Options"
    );

    const selectionNote = createElement(
      "p",
      "lb-gallery-selected-note",
      "Select one or more pictures. Each picture will have its own size, colour and quantity."
    );

    const pictureOptions = createElement("div");
    pictureOptions.className = "lb-gallery-picture-options-list";

    const selectionMessage = createElement(
      "p",
      "lb-gallery-selection-message"
    );

    const addButton = createElement(
      "button",
      "",
      "Add All Configured Pictures to Lay-Bay Basket"
    );

    addButton.type = "button";

    selection.append(
      selectionHeading,
      selectionNote,
      pictureOptions,
      addButton,
      selectionMessage
    );

    content.append(
      close,
      title,
      galleryDescription,
      galleryPrice,
      image,
      currentSelectLabel,
      controls,
      thumbnails,
      selection
    );

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    productGallery = {
      overlay,
      content,
      title,
      image,
      count,
      thumbnails,
      previous,
      next,
      close,
      currentSelect,
      galleryDescription,
      galleryPrice,
      pictureOptions,
      addButton,
      selectionMessage
    };

    close.addEventListener(
      "click",
      closeProductGallery
    );

    previous.addEventListener("click", () =>
      showGalleryImage(galleryIndex - 1)
    );

    next.addEventListener("click", () =>
      showGalleryImage(galleryIndex + 1)
    );

    currentSelect.addEventListener("change", () => {
      setGalleryImageSelected(
        galleryIndex,
        currentSelect.checked
      );
    });

    addButton.addEventListener(
      "click",
      addGallerySelectionToBasket
    );

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeProductGallery();
      }
    });

    document.addEventListener("keydown", event => {
      if (!productGallery.overlay.classList.contains("open")) {
        return;
      }

      if (event.key === "Escape") {
        closeProductGallery();
      }

      if (event.key === "ArrowLeft") {
        showGalleryImage(galleryIndex - 1);
      }

      if (event.key === "ArrowRight") {
        showGalleryImage(galleryIndex + 1);
      }
    });

    let touchStartX = 0;

    image.addEventListener("touchstart", event => {
      touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });

    image.addEventListener("touchend", event => {
      const difference =
        event.changedTouches[0].screenX - touchStartX;

      if (Math.abs(difference) < 45) return;

      showGalleryImage(
        galleryIndex + (difference < 0 ? 1 : -1)
      );
    }, { passive: true });
  }

  function openProductGallery(
    images,
    index = 0,
    product = null
  ) {
    if (!images || !images.length) return;

    createProductGallery();

    galleryImages = images;
    galleryIndex = index;
    galleryProduct = product;

    gallerySelectedImageIndexes = [];
    galleryImageOptions = {};

    productGallery.overlay.classList.add("open");

    document.body.style.overflow = "hidden";

    productGallery.title.textContent =
      product?.name || "Product Pictures";

    productGallery.galleryDescription.textContent =
      product?.description ||
      product?.details ||
      product?.product_description ||
      "No additional product description is available.";

    productGallery.galleryPrice.textContent =
      "Normal price: " + money(product?.price) +
      " | Lay-Bay price: " + money(productPrice(product));

    productGallery.selectionMessage.textContent =
      "Select the pictures you want using the checkboxes.";

    productGallery.pictureOptions.innerHTML = "";

    showGalleryImage(index);
  }

  // -------------------------------------------------------
  // 7.1 SELECT OR DESELECT AN INDIVIDUAL PICTURE
  // -------------------------------------------------------

  function setGalleryImageSelected(index, selected) {
    if (selected) {
      if (!gallerySelectedImageIndexes.includes(index)) {
        gallerySelectedImageIndexes.push(index);
      }

      if (!galleryImageOptions[index]) {
        galleryImageOptions[index] = {
          size: "",
          colour: "",
          quantity: 1
        };
      }

    } else {
      gallerySelectedImageIndexes =
        gallerySelectedImageIndexes.filter(
          item => item !== index
        );

      delete galleryImageOptions[index];
    }

    renderGalleryThumbnails();
    renderGalleryPictureOptions();
    updateGallerySelectionDisplay();
  }

  // -------------------------------------------------------
  // 7.2 BUILD OPTIONS FOR EACH SELECTED PICTURE
  // -------------------------------------------------------

  function renderGalleryPictureOptions() {
    if (!productGallery || !galleryProduct) return;

    const container = productGallery.pictureOptions;

    container.innerHTML = "";

    const product = galleryProduct;
    const sizes = productSizes(product);
    const colours = productColours(product);

    if (!gallerySelectedImageIndexes.length) {
      container.textContent =
        "No pictures selected. Select a picture above to configure it.";

      return;
    }

    gallerySelectedImageIndexes.forEach(index => {
      const settings = galleryImageOptions[index];

      if (!settings) return;

      const card = createElement(
        "div",
        "lb-gallery-picture-options"
      );

      const heading = createElement(
        "div",
        "lb-gallery-picture-heading"
      );

      const preview = createElement("img");
      preview.src = galleryImages[index];
      preview.alt = "Selected product picture " + (index + 1);

      const pictureTitle = createElement(
        "strong",
        "",
        "Picture " + (index + 1)
      );

      heading.append(preview, pictureTitle);
      card.appendChild(heading);

      // Size selector
      if (sizes.length) {
        const sizeLabel = createElement(
          "label",
          "",
          "Size for Picture " + (index + 1)
        );

        const sizeSelect = createElement("select");

        const sizePlaceholder = document.createElement("option");
        sizePlaceholder.value = "";
        sizePlaceholder.textContent = "Choose a size";

        sizeSelect.appendChild(sizePlaceholder);

        sizes.forEach(size => {
          const option = document.createElement("option");
          option.value = size;
          option.textContent = size;
          sizeSelect.appendChild(option);
        });

        sizeSelect.value = settings.size || "";

        sizeSelect.addEventListener("change", () => {
          settings.size = sizeSelect.value;
        });

        card.append(sizeLabel, sizeSelect);
      }

      // Colour selector
      if (colours.length) {
        const colourLabel = createElement(
          "label",
          "",
          "Colour for Picture " + (index + 1)
        );

        const colourSelect = createElement("select");

        const colourPlaceholder = document.createElement("option");
        colourPlaceholder.value = "";
        colourPlaceholder.textContent = "Choose a colour";

        colourSelect.appendChild(colourPlaceholder);

        colours.forEach(colour => {
          const option = document.createElement("option");
          option.value = colour;
          option.textContent = colour;
          colourSelect.appendChild(option);
        });

        colourSelect.value = settings.colour || "";

        colourSelect.addEventListener("change", () => {
          settings.colour = colourSelect.value;
        });

        card.append(colourLabel, colourSelect);
      }

      // Independent quantity
      const quantityLabel = createElement(
        "label",
        "",
        "Quantity for Picture " + (index + 1)
      );

      const quantityInput = createElement("input");

      quantityInput.type = "number";
      quantityInput.min = "1";
      quantityInput.step = "1";
      quantityInput.max = String(
        Math.max(1, Number(product.stock) || 1)
      );

      quantityInput.value = String(
        settings.quantity || 1
      );

      quantityInput.addEventListener("input", () => {
        settings.quantity = quantityInput.value;
      });

      card.append(quantityLabel, quantityInput);

      container.appendChild(card);
    });
  }

  // -------------------------------------------------------
  // 7.3 OPEN A PICTURE IN THE MAIN PREVIEW
  // -------------------------------------------------------

  function showGalleryImage(index) {
    if (
      !galleryImages.length ||
      !productGallery
    ) return;

    galleryIndex =
      (index + galleryImages.length) % galleryImages.length;

    productGallery.image.src =
      galleryImages[galleryIndex];

    productGallery.count.textContent =
      (galleryIndex + 1) +
      " / " +
      galleryImages.length;

    productGallery.currentSelect.checked =
      gallerySelectedImageIndexes.includes(galleryIndex);

    const multiple = galleryImages.length > 1;

    productGallery.previous.style.display =
      multiple ? "inline-block" : "none";

    productGallery.next.style.display =
      multiple ? "inline-block" : "none";

    renderGalleryThumbnails();
    updateGallerySelectionDisplay();
  }

  // -------------------------------------------------------
  // 7.4 DISPLAY THE HORIZONTAL PICTURE THUMBNAILS
  // -------------------------------------------------------

  function renderGalleryThumbnails() {
    if (!productGallery) return;

    const container = productGallery.thumbnails;

    container.innerHTML = "";

    galleryImages.forEach((url, index) => {
      const option = createElement(
        "label",
        "lb-gallery-thumb-option"
      );

      if (index === galleryIndex) {
        option.classList.add("active");
      }

      if (gallerySelectedImageIndexes.includes(index)) {
        option.classList.add("selected");
      }

      const image = createElement("img");

      image.src = url;
      image.alt = "Product picture " + (index + 1);

      const checkbox = createElement("input");

      checkbox.type = "checkbox";

      checkbox.checked =
        gallerySelectedImageIndexes.includes(index);

      checkbox.setAttribute(
        "aria-label",
        "Select product picture " + (index + 1)
      );

      checkbox.addEventListener("click", event => {
        event.stopPropagation();
      });

      checkbox.addEventListener("change", () => {
        galleryIndex = index;

        setGalleryImageSelected(
          index,
          checkbox.checked
        );

        showGalleryImage(index);
      });

      image.addEventListener("click", event => {
        event.preventDefault();

        galleryIndex = index;
        showGalleryImage(index);
      });

      option.append(image, checkbox);

      container.appendChild(option);
    });

    const activeThumbnail =
      container.querySelector(
        ".lb-gallery-thumb-option.active"
      );

    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }

  // -------------------------------------------------------
  // 7.5 UPDATE THE SELECTION MESSAGE
  // -------------------------------------------------------

  function updateGallerySelectionDisplay() {
    if (!productGallery) return;

    const count = gallerySelectedImageIndexes.length;

    productGallery.currentSelect.checked =
      gallerySelectedImageIndexes.includes(galleryIndex);

    if (count === 0) {
      productGallery.selectionMessage.textContent =
        "No pictures selected yet. Select one or more pictures.";

    } else {
      productGallery.selectionMessage.textContent =
        count + " picture(s) selected. Configure each picture below.";
    }
  }

  // -------------------------------------------------------
  // 7.6 ADD ALL CONFIGURED PICTURES TO THE BASKET
  // -------------------------------------------------------

  function addGallerySelectionToBasket() {
    const product = galleryProduct;

    if (!product) {
      productGallery.selectionMessage.textContent =
        "Product information is unavailable. Close and reopen the gallery.";
      return;
    }

    if (!productEligible(product)) {
      productGallery.selectionMessage.textContent =
        "This product is not currently available for Lay-Bay.";
      return;
    }

    if (!gallerySelectedImageIndexes.length) {
      productGallery.selectionMessage.textContent =
        "Please select at least one picture.";
      return;
    }

    const sizes = productSizes(product);
    const colours = productColours(product);
    const stock = Number(product.stock);

    const configuredItems = [];
    let totalNewQuantity = 0;

    // Validate every selected picture before adding anything.
    for (const index of gallerySelectedImageIndexes) {
      const settings = galleryImageOptions[index];

      if (!settings) {
        productGallery.selectionMessage.textContent =
          "Please configure every selected picture.";
        return;
      }

      const size = settings.size || null;
      const colour = settings.colour || null;
      const quantity = Number(settings.quantity);

      if (sizes.length && !size) {
        productGallery.selectionMessage.textContent =
          "Please choose a size for Picture " + (index + 1) + ".";
        return;
      }

      if (colours.length && !colour) {
        productGallery.selectionMessage.textContent =
          "Please choose a colour for Picture " + (index + 1) + ".";
        return;
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        productGallery.selectionMessage.textContent =
          "Enter a valid whole-number quantity for Picture " +
          (index + 1) + ".";
        return;
      }

      totalNewQuantity += quantity;

      configuredItems.push({
        index,
        size,
        colour,
        quantity,
        image_url: galleryImages[index]
      });
    }

    // Include quantities already in the basket for this product.
    const existingProductQuantity =
      layBaySelectionCart
        .filter(item =>
          String(item.product_id) === String(product.id)
        )
        .reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );

    if (existingProductQuantity + totalNewQuantity > stock) {
      productGallery.selectionMessage.textContent =
        "The combined quantity exceeds available stock for this product.";
      return;
    }

    // All selections passed validation. Add them individually.
    configuredItems.forEach(item => {
      const existing = layBaySelectionCart.find(entry =>
        String(entry.product_id) === String(product.id) &&
        Number(entry.image_index) === Number(item.index) &&
        String(entry.size || "") === String(item.size || "") &&
        String(entry.colour || "") === String(item.colour || "")
      );

      if (existing) {
        existing.quantity += item.quantity;

      } else {
        layBaySelectionCart.push({
          product_id: product.id,
          product_name: product.name || "LBM Product",
          image_url: item.image_url,
          image_index: item.index,
          size: item.size,
          colour: item.colour,
          quantity: item.quantity,
          unit_price: productPrice(product)
        });
      }
    });

    renderSelectionBasket();

    productGallery.selectionMessage.textContent =
      configuredItems.length +
      " picture(s) added successfully. Each picture has its own options.";

    // Close the higher-layer picture picker before opening the basket.
    // Its z-index otherwise covers the basket until the customer taps Back.
    closeProductGallery();
    openSelectionBasket();
  }

  // -------------------------------------------------------
  // 7.7 CLOSE THE PRODUCT GALLERY
  // -------------------------------------------------------

  function closeProductGallery() {
    if (!productGallery) return;

    productGallery.overlay.classList.remove("open");

    productGallery.image.removeAttribute("src");

    document.body.style.overflow = "";

    galleryImages = [];
    galleryIndex = 0;
    galleryProduct = null;

    gallerySelectedImageIndexes = [];
    galleryImageOptions = {};

    productGallery.pictureOptions.innerHTML = "";
  }

    
  // =======================================================
  // 8. CUSTOMER AUTHENTICATION
  // =======================================================

  async function requireSession() {
    message("pageMessage", "Checking customer account...");

    const { data, error } = await db.auth.getSession();

    if (error) {
      updateDiagnostic("Customer session ERROR: " + error.message);
      message("pageMessage", error.message, false);
      return false;
    }

    if (!data.session) {
      message(
        "pageMessage",
        "No active customer session. Redirecting to login...",
        false
      );

      window.location.replace("login.html");
      return false;
    }

    currentUser = data.session.user;

    const customerName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email ||
      currentUser.phone ||
      "Customer";

    if ($("customerEmail")) {
      $("customerEmail").textContent = customerName;
    }

    updateDiagnostic("Customer session: ACTIVE");

    message("pageMessage", "Welcome. Your customer account is connected.");

    createProfilePanel();
    createAccountDeletionPanel();
    await loadAvatar();

    return true;
  }

  // =======================================================
  // 9. LOAD COMPLETE MAIN-STORE CATALOGUE
  // =======================================================

  async function loadProducts() {
    message("productsMessage", "Loading the complete LBM catalogue...");

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      message(
        "productsMessage",
        "Could not load products: " + error.message,
        false
      );

      updateDiagnostic("Product catalogue ERROR: " + error.message);
      return;
    }

    products = data || [];

    updateDiagnostic(
      "Product catalogue: " + products.length + " products loaded."
    );

    renderProducts();
  }


  // =======================================================
  // 10. PRODUCT VARIANT SELECTOR — INDEPENDENT CIRCLES
  // =======================================================

  function createSelectionStyles() {
    if ($("lbSelectionStyles")) return;

    const style = document.createElement("style");
    style.id = "lbSelectionStyles";

    style.textContent = `
      /* Compact two-column Lay-Bay product catalogue */
      #productsList { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; align-items:start; }
      #productsList > .lb-product { width:100%; min-width:0; margin:0; padding:10px; overflow:hidden; }
      #productsList > .lb-product > img { width:100%; height:clamp(112px,28vw,190px); object-fit:cover; border-radius:8px; }
      #productsList > .lb-product > h3 { font-size:clamp(13px,3.5vw,17px); line-height:1.25; margin:8px 0 6px; overflow-wrap:anywhere; }
      #productsList > .lb-product > p { font-size:12px; line-height:1.35; margin:4px 0; }
      .lb-product-photo-hint { color:#D4AF37; font-size:11px; text-align:center; margin:3px 0 7px; }
      .lb-gallery-description { color:#ddd; text-align:left; line-height:1.5; margin:8px 0 14px; }
      .lb-gallery-price { color:#D4AF37; font-weight:800; text-align:left; margin:6px 0; }
      .lb-selection-panel { margin:8px 0 2px; padding:9px; border:1px solid #665522; border-radius:9px; background:#101010; }
      .lb-option-details { margin:7px 0; border:1px solid #51451f; border-radius:7px; background:#171717; }
      .lb-option-details summary { cursor:pointer; list-style:none; padding:10px 12px; color:#D4AF37; font-weight:700; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .lb-option-details summary::-webkit-details-marker { display:none; }
      .lb-option-details summary::after { content:"＋"; font-size:17px; }
      .lb-option-details[open] summary::after { content:"−"; }
      .lb-option-details .lb-circle-options { padding:0 10px 10px; gap:7px; }
      .lb-option-details .lb-circle-option { min-width:0; min-height:34px; padding:6px 9px; gap:5px; font-size:13px; }
      .lb-option-details .lb-selection-heading { display:none; }
      .lb-product .lb-selection-panel .lb-product-choice { margin:4px 0 8px; padding:8px 10px; }
      .lb-product .lb-selection-panel .lb-selection-actions { margin-top:9px; }
      .lb-product .lb-selection-panel .lb-selection-actions button { padding:9px 10px; font-size:13px; }

      .lb-selection-heading {
        color: #D4AF37;
        font-weight: bold;
        margin: 14px 0 9px;
      }

      .lb-circle-options {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .lb-circle-option {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-width: 62px;
        min-height: 42px;
        padding: 8px 12px;
        border: 1px solid #62552c;
        border-radius: 25px;
        background: #1a1a1a;
        color: #eee;
        cursor: pointer;
        margin: 0;
      }

      .lb-circle-option input {
        width: 19px;
        height: 19px;
        margin: 0;
        accent-color: #D4AF37;
        flex-shrink: 0;
      }

      .lb-product-choice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border: 1px solid #D4AF37;
        border-radius: 8px;
        margin: 12px 0;
        background: #201c10;
        font-weight: bold;
      }

      .lb-product-choice input {
        width: 22px;
        height: 22px;
        margin: 0;
        accent-color: #D4AF37;
      }

      .lb-combination {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 75px 95px;
        align-items: center;
        gap: 8px;
        padding: 11px 5px;
        border-bottom: 1px solid #393327;
      }

      .lb-combination input[type="checkbox"] {
        width: 19px;
        height: 19px;
        accent-color: #D4AF37;
      }

      .lb-combination input[type="number"] {
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: 8px;
      }

      .lb-combination label {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .lb-combination-heading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 75px 95px;
        gap: 8px;
        color: #D4AF37;
        font-size: 12px;
        padding: 8px 5px;
      }

      .lb-selection-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 14px;
      }

      .lb-selection-actions button {
        flex: 1;
        min-width: 145px;
      }

      .lb-basket-card {
        border: 1px solid #665522;
        border-radius: 9px;
        padding: 12px;
        margin: 10px 0;
        background: #111;
      }

      .lb-basket-card p {
        margin: 6px 0;
      }

      .lb-basket-total {
        color: #D4AF37;
        font-size: 19px;
        font-weight: bold;
      }
      .lb-basket-launcher { position:fixed; left:14px; bottom:14px; z-index:99980; display:none; padding:12px 16px; border:1px solid #080808; border-radius:28px; background:#D4AF37; color:#080808; font-weight:800; box-shadow:0 5px 20px rgba(0,0,0,.45); }
      .lb-basket-launcher.visible { display:block; }
      .lb-basket-backdrop { position:fixed; inset:0; z-index:99990; background:rgba(0,0,0,.72); display:none; }
      .lb-basket-backdrop.open { display:block; }
      #layBaySelectionBasket.lb-basket-drawer { position:fixed; z-index:99991; top:0; right:0; bottom:0; width:min(520px,100vw); max-height:100vh; max-height:100dvh; overflow-y:auto; overscroll-behavior:contain; margin:0; padding:22px; background:#151515; border:1px solid #D4AF37; border-radius:12px 0 0 12px; box-shadow:0 0 0 100vmax rgba(0,0,0,.62),-12px 0 38px rgba(0,0,0,.28); display:none; }
      #layBaySelectionBasket.lb-basket-drawer.open { display:block; }
      .lb-basket-drawer-head { position:sticky; top:-18px; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 0 12px; background:#151515; border-bottom:1px solid #51451f; }
      .lb-basket-drawer-head h2 { margin:4px 0; }
      .lb-basket-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:14px; }
      .lb-basket-actions button { flex:1 1 180px; }
      .lb-basket-plan-note { padding:12px; margin:12px 0; border:1px solid #665522; border-radius:9px; background:#201c10; line-height:1.5; }
      @media(max-width:600px) { #productsList { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; } #productsList > .lb-product { padding:8px; } #productsList > .lb-product > img { height:clamp(100px,30vw,145px); } #layBaySelectionBasket.lb-basket-drawer { top:auto; right:0; bottom:0; left:0; width:100%; max-height:min(82vh,82dvh); border-radius:16px 16px 0 0; border-bottom:0; padding:18px 14px calc(18px + env(safe-area-inset-bottom)); box-shadow:0 -10px 36px rgba(0,0,0,.35),0 0 0 100vmax rgba(0,0,0,.62); } .lb-basket-drawer-head { top:-14px; } }

      @media(max-width: 420px) {
        .lb-combination,
        .lb-combination-heading {
          grid-template-columns: minmax(0, 1fr) 52px 75px;
          gap: 5px;
        }

        .lb-combination {
          font-size: 13px;
        }

        .lb-combination input[type="number"] {
          padding: 7px 4px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createVariantSelector(product) {
    createSelectionStyles();

    const sizes = productSizes(product);
    const colours = productColours(product);

    const wrapper = createElement(
      "div",
      "lb-selection-panel"
    );

    const productChoice = createElement(
      "label",
      "lb-product-choice"
    );

    const productCheckbox = createElement("input");
    productCheckbox.type = "checkbox";
    productCheckbox.setAttribute(
      "aria-label",
      "Select this product"
    );

    const productLabel = createElement(
      "span",
      "",
      "Select this product"
    );

    productChoice.append(productCheckbox, productLabel);

    wrapper.appendChild(productChoice);

    const sizeInputs = [];
    const colourInputs = [];

    if (sizes.length) {
      const sizeDetails = createElement("details", "lb-option-details");
      const sizeSummary = createElement("summary", "", "Choose sizes (" + sizes.length + ")");
      sizeDetails.appendChild(sizeSummary);

      const sizeContainer = createElement(
        "div",
        "lb-circle-options"
      );

      sizes.forEach(size => {
        const label = createElement(
          "label",
          "lb-circle-option"
        );

        const checkbox = createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = size;

        const text = createElement("span", "", size);

        label.append(checkbox, text);
        sizeContainer.appendChild(label);

        sizeInputs.push(checkbox);
      });

      sizeDetails.appendChild(sizeContainer);
      wrapper.appendChild(sizeDetails);
    }

    if (colours.length) {
      const colourDetails = createElement("details", "lb-option-details");
      const colourSummary = createElement("summary", "", "Choose colours (" + colours.length + ")");
      colourDetails.appendChild(colourSummary);

      const colourContainer = createElement(
        "div",
        "lb-circle-options"
      );

      colours.forEach(colour => {
        const label = createElement(
          "label",
          "lb-circle-option"
        );

        const checkbox = createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = colour;

        const text = createElement("span", "", colour);

        label.append(checkbox, text);
        colourContainer.appendChild(label);

        colourInputs.push(checkbox);
      });

      colourDetails.appendChild(colourContainer);
      wrapper.appendChild(colourDetails);
    }

    const combinationArea = createElement("div");
    combinationArea.className = "lb-combinations-area";

    wrapper.appendChild(combinationArea);

    const selectionMessage = createElement(
      "p",
      "lb-muted"
    );

    wrapper.appendChild(selectionMessage);

    const addButton = createElement(
      "button",
      "",
      "Add Selected Options to Basket"
    );

    addButton.type = "button";

    const actions = createElement(
      "div",
      "lb-selection-actions"
    );

    actions.appendChild(addButton);
    wrapper.appendChild(actions);

    let combinations = [];

    function checkedValues(inputs) {
      return inputs
        .filter(input => input.checked)
        .map(input => input.value);
    }

    function getSelectedCombinations() {
      return combinations.filter(item =>
        item.checkbox.checked
      );
    }

    function renderCombinations() {
      combinationArea.innerHTML = "";
      combinations = [];

      const selectedSizes = checkedValues(sizeInputs);
      const selectedColours = checkedValues(colourInputs);

      if (
        (sizes.length && !selectedSizes.length) ||
        (colours.length && !selectedColours.length)
      ) {
        selectionMessage.textContent =
          "Choose at least one available size and one available colour to see the combinations.";

        return;
      }

      const finalSizes = sizes.length
        ? selectedSizes
        : [null];

      const finalColours = colours.length
        ? selectedColours
        : [null];

      combinationArea.appendChild(
        createElement(
          "div",
          "lb-selection-heading",
          "Choose exact combinations and quantities"
        )
      );

      const headings = createElement(
        "div",
        "lb-combination-heading"
      );

      headings.append(
        createElement("strong", "", "Combination"),
        createElement("strong", "", "Select"),
        createElement("strong", "", "Quantity")
      );

      combinationArea.appendChild(headings);

      finalSizes.forEach(size => {
        finalColours.forEach(colour => {
          const row = createElement(
            "div",
            "lb-combination"
          );

          const description = [
            size ? "Size: " + size : "",
            colour ? "Colour: " + colour : ""
          ].filter(Boolean).join(" / ") || "Standard product";

          const name = createElement(
            "span",
            "",
            description
          );

          const checkbox = createElement("input");
          checkbox.type = "checkbox";
          checkbox.setAttribute(
            "aria-label",
            "Select " + description
          );

          const quantity = createElement("input");
          quantity.type = "number";
          quantity.min = "1";
          quantity.step = "1";
          quantity.value = "1";
          quantity.max = String(
            Math.max(1, Number(product.stock) || 1)
          );
          quantity.disabled = true;

          checkbox.addEventListener("change", () => {
            quantity.disabled = !checkbox.checked;
          });

          row.append(name, checkbox, quantity);
          combinationArea.appendChild(row);

          combinations.push({
            size,
            colour,
            checkbox,
            quantity
          });
        });
      });

      selectionMessage.textContent =
        combinations.length +
        " possible combination(s). Tick only the exact combinations you want.";
    }

    [...sizeInputs, ...colourInputs].forEach(input => {
      input.addEventListener("change", renderCombinations);
    });

    productCheckbox.addEventListener("change", () => {
      productLabel.textContent = productCheckbox.checked
        ? "Product selected"
        : "Select this product";
    });

    renderCombinations();

    function selectedVariantValues() {
      const selected = getSelectedCombinations();

      if (selected.length !== 1) {
        return {
          size: null,
          colour: null
        };
      }

      return {
        size: selected[0].size,
        colour: selected[0].colour
      };
    }

    addButton.addEventListener("click", () => {
      // Selecting at least one exact size/colour combination is sufficient.
      // The separate product checkbox is only a visual indicator and must
      // not block customers from adding their already-selected combinations.
      if (!productEligible(product)) {
        selectionMessage.textContent =
          "This product is not available for Lay-Bay.";
        return;
      }

      const selected = getSelectedCombinations();

      if (!selected.length) {
        selectionMessage.textContent =
          "Please tick at least one exact combination.";
        return;
      }

      let added = 0;

      for (const item of selected) {
        const quantity = Number(item.quantity.value);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > Number(product.stock)
        ) {
          selectionMessage.textContent =
            "Please enter a valid quantity within available stock for every selected combination.";
          return;
        }
      }

      selected.forEach(item => {
                const existing = layBaySelectionCart.find(entry =>
          String(entry.product_id) === String(product.id) &&
          String(entry.size || "") === String(item.size || "") &&
          String(entry.colour || "") === String(item.colour || "") &&
          !entry.image_url
        );

        const quantity = Number(item.quantity.value);

        if (existing) {
          existing.quantity += quantity;
        } else {
          layBaySelectionCart.push({
            product_id: product.id,
            product_name: product.name || "LBM Product",
            size: item.size,
            colour: item.colour,
            quantity,
            unit_price: productPrice(product)
          });
        }

        added++;
      });

      renderSelectionBasket();

      selectionMessage.textContent =
        added + " selected combination(s) added to your Lay-Bay basket.";

      openSelectionBasket();
    });

    return {
      element: wrapper,
      getValues: selectedVariantValues,
      valid: () =>
        productCheckbox.checked &&
        getSelectedCombinations().length === 1
    };
  }

  // =======================================================
  // 10A. TEMPORARY LAY-BAY SELECTION BASKET
  // =======================================================

  function ensureSelectionBasket() {
    let section = $("layBaySelectionBasket");

    if (section) return section;

    section = createElement("section", "lb-panel");
    section.id = "layBaySelectionBasket";

    section.classList.add("lb-basket-drawer");
    const backdrop = createElement("div", "lb-basket-backdrop");
    backdrop.id = "layBayBasketBackdrop";
    backdrop.addEventListener("click", closeSelectionBasket);
    document.body.appendChild(backdrop);

    const launcher = createElement("button", "lb-basket-launcher", "Lay-Bay Basket");
    launcher.id = "layBayBasketLauncher";
    launcher.type = "button";
    launcher.addEventListener("click", openSelectionBasket);
    document.body.appendChild(launcher);

    const drawerHead = createElement("div", "lb-basket-drawer-head");
    const heading = createElement("h2", "", "My Lay-Bay Basket");
    const closeButton = createElement("button", "", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close Lay-Bay basket");
    closeButton.addEventListener("click", closeSelectionBasket);
    drawerHead.append(heading, closeButton);

    const note = createElement("p", "lb-muted",
      "Your selections stay in this basket while you continue. Adding items does not create a savings plan or submit a payment."
    );

    const list = createElement("div");
    list.id = "layBaySelectionBasketList";

    const total = createElement("p");
    total.id = "layBaySelectionBasketTotal";
    total.className = "lb-basket-total";

    const planNote = createElement("div", "lb-basket-plan-note",
      "Payment plan preview: each product and selected variant has its own plan. The first deposit guide is 50% of its Lay-Bay total; the remaining balance is due within 30 days after LBM approves the first deposit. This basket review does not create a plan or submit payment."
    );
    const continueButton = createElement("button", "", "Continue Selecting Products");
    continueButton.type = "button";
    continueButton.addEventListener("click", closeSelectionBasket);

    const clearButton = createElement("button", "", "Clear Selection Basket");
    clearButton.type = "button";

    clearButton.addEventListener("click", () => {
      if (!layBaySelectionCart.length) return;

      if (!window.confirm("Clear all selected basket items?")) {
        return;
      }

      layBaySelectionCart = [];
      renderSelectionBasket();
    });

    const checkoutButton = createElement("button", "", "Continue to Checkout");
    checkoutButton.type = "button";
    checkoutButton.addEventListener("click", openLayBayCheckout);
    const actions = createElement("div", "lb-basket-actions");
    actions.append(continueButton, checkoutButton, clearButton);
    section.append(drawerHead, note, list, total, planNote, actions);

    // Keep the basket outside the catalogue/page layout.
    // This "portal" placement prevents it from appearing as a normal
    // section at the bottom or inheriting clipping/positioning from
    // the product catalogue container.
    document.body.appendChild(section);

    return section;
  }

  function openSelectionBasket() {
    const section = ensureSelectionBasket();
    const backdrop = $("layBayBasketBackdrop");

    // Match the main shop cart exactly: opening the cart itself creates
    // the dimmed viewport overlay; no scrolling or Back action is needed.
    section.classList.add("open");
    backdrop?.classList.add("open");

    section.style.position = "fixed";
    section.style.top = "0";
    section.style.right = "0";
    section.style.bottom = "0";
    section.style.left = "auto";
    section.style.width = "min(520px, 100vw)";
    section.style.maxHeight = "100vh";
    section.style.maxHeight = "100dvh";
    section.style.margin = "0";
    section.style.borderRadius = "12px 0 0 12px";
    section.style.overflowY = "auto";
    section.style.zIndex = "99991";
    section.style.display = "block";

    if (window.matchMedia("(max-width: 600px)").matches) {
      section.style.top = "auto";
      section.style.right = "0";
      section.style.bottom = "0";
      section.style.left = "0";
      section.style.width = "100%";
      section.style.maxHeight = "min(82vh, 82dvh)";
      section.style.borderRadius = "16px 16px 0 0";
    }

    document.body.style.overflow = "hidden";
    section.setAttribute("role", "dialog");
    section.setAttribute("aria-modal", "true");
    section.setAttribute("aria-label", "LBM Lay-Bay basket. Your selection has been added.");
    section.scrollTop = 0;
  }
  function closeSelectionBasket() {
    $("layBaySelectionBasket")?.classList.remove("open");
    $("layBayBasketBackdrop")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function renderSelectionBasket() {
    ensureSelectionBasket();

    const list = $("layBaySelectionBasketList");
    const totalElement = $("layBaySelectionBasketTotal");

    if (!list || !totalElement) return;

    list.innerHTML = "";

    const launcher = $("layBayBasketLauncher");
    const itemCount = layBaySelectionCart.reduce(
      (sum, item) => sum + Number(item.quantity || 0), 0
    );
    if (launcher) {
      launcher.textContent = "Lay-Bay Basket (" + itemCount + ")";
      launcher.classList.toggle("visible", itemCount > 0);
    }

    if (!layBaySelectionCart.length) {
      list.textContent =
        "Your Lay-Bay selection basket is empty.";

      totalElement.textContent = "Estimated total: K0.00";
      return;
    }

    let total = 0;

    layBaySelectionCart.forEach((item, index) => {
      const card = createElement(
        "article",
        "lb-basket-card"
      );

      const lineTotal =
        Number(item.unit_price) * Number(item.quantity);

      total += lineTotal;

      const variant = [
        item.size ? "Size: " + item.size : "",
        item.colour ? "Colour: " + item.colour : ""
      ].filter(Boolean).join(" | ");

      const remove = createElement(
        "button",
        "",
        "Remove"
      );

      remove.type = "button";

      remove.addEventListener("click", () => {
        layBaySelectionCart.splice(index, 1);
        renderSelectionBasket();
      });

      
      if (item.image_url) {
        const preview = createElement("img");

        preview.src = item.image_url;
        preview.alt = item.product_name + " selected picture";

        preview.style.width = "85px";
        preview.style.height = "85px";
        preview.style.objectFit = "contain";
        preview.style.borderRadius = "8px";
        preview.style.background = "#080808";
        preview.style.marginBottom = "8px";

        card.appendChild(preview);
      }

      card.append(
        createElement("h3", "", item.product_name),

        createElement(
          "p",
          "",
          variant || "Standard product"
        ),

        createElement(
          "p",
          "",
          item.image_url
            ? "Selected picture: " +
              (Number(item.image_index) + 1)
            : "Picture not specified"
        ),

        createElement(
          "p",
          "",
          "Quantity: " + item.quantity
        ),

        createElement(
          "p",
          "",
          "Unit price: " + money(item.unit_price)
        ),

        createElement(
          "p",
          "lb-basket-total",
          "Line total: " + money(lineTotal)
        ),

        createElement(
          "p",
          "",
          "First deposit guide (50%): " + money(lineTotal * 0.5)
        ),

        createElement(
          "p",
          "",
          "Remaining balance guide: " + money(lineTotal * 0.5)
        ),

        remove
      );

      list.appendChild(card);
    });

    totalElement.textContent =
      "Estimated total: " + money(total);
  }



  // =======================================================
  // 10B. SINGLE-DRAWER LAY-BAY CHECKOUT
  // =======================================================

  let layBayCheckoutPanel = null;

  function ensureLayBayCheckoutPanel() {
    if (layBayCheckoutPanel) return layBayCheckoutPanel;
    layBayCheckoutPanel = createElement("section", "lb-basket-plan-note");
    layBayCheckoutPanel.id = "layBayCheckoutPanel";
    layBayCheckoutPanel.style.display = "none";
    const heading = createElement("h3", "", "Secure Lay-Bay Checkout");
    const intro = createElement("p", "", "Each selected product and variant becomes its own savings plan. The first deposit for each plan must be at least 50% of its Lay-Bay total.");
    const lines = createElement("div");
    lines.id = "layBayCheckoutLines";
    const methodLabel = createElement("label", "", "Payment method");
    const method = createElement("select");
    method.id = "layBayCheckoutMethod";
    [
      ["", "Choose payment method"],
      ["MTN Mobile Money", "MTN Mobile Money"],
      ["Airtel Money", "Airtel Money"],
      ["Zamtel Kwacha", "Zamtel Kwacha"],
      ["Bank Transfer", "Bank Transfer"],
      ["Other", "Other"]
    ].forEach(([value,label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      method.appendChild(option);
    });
    const referenceLabel = createElement("label", "", "Transaction reference");
    const reference = createElement("input");
    reference.id = "layBayCheckoutReference";
    reference.type = "text";
    reference.maxLength = 150;
    reference.placeholder = "Enter the actual payment reference";
    reference.autocomplete = "off";
    const proofLabel = createElement("label", "", "Payment proof (JPG, PNG, WEBP or PDF; max 5 MB)");
    const proof = createElement("input");
    proof.id = "layBayCheckoutProof";
    proof.type = "file";
    proof.accept = "image/jpeg,image/png,image/webp,application/pdf";
    const status = createElement("p", "lb-message");
    status.id = "layBayCheckoutMessage";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const submit = createElement("button", "", "Submit Lay-Bay Checkout");
    submit.type = "button";
    submit.id = "layBayCheckoutSubmit";
    submit.addEventListener("click", submitLayBayCheckout);
    const back = createElement("button", "", "Back to Basket");
    back.type = "button";
    back.style.marginLeft = "8px";
    back.addEventListener("click", () => {
      layBayCheckoutPanel.style.display = "none";
      $("layBaySelectionBasketList").style.display = "";
      $("layBaySelectionBasketTotal").style.display = "";
      const note = $("layBaySelectionBasket")?.querySelector(".lb-basket-plan-note");
      if (note) note.style.display = "";
    });
    layBayCheckoutPanel.append(heading,intro,lines,methodLabel,method,referenceLabel,reference,proofLabel,proof,status,submit,back);
    $("layBaySelectionBasket").appendChild(layBayCheckoutPanel);
    return layBayCheckoutPanel;
  }

  function openLayBayCheckout() {
    if (!currentUser) {
      message("productsMessage", "Please sign in before checking out.", false);
      return;
    }
    if (!layBaySelectionCart.length) {
      message("productsMessage", "Your Lay-Bay basket is empty.", false);
      return;
    }
    const panel = ensureLayBayCheckoutPanel();
    const lines = $("layBayCheckoutLines");
    lines.innerHTML = "";
    layBaySelectionCart.forEach((item,index) => {
      const total = Number((Number(item.unit_price) * Number(item.quantity)).toFixed(2));
      const minimum = Number((total * 0.5).toFixed(2));
      const card = createElement("article","lb-basket-card");
      const variant = [item.size ? "Size: "+item.size : "", item.colour ? "Colour: "+item.colour : ""].filter(Boolean).join(" | ") || "Standard product";
      const title = createElement("h4","",item.product_name+" — "+variant);
      const amountLabel = createElement("label","","Initial deposit (minimum "+money(minimum)+")");
      const amount = createElement("input");
      amount.type="number"; amount.min=String(minimum); amount.max=String(total); amount.step="0.01"; amount.value=String(minimum); amount.required=true;
      amount.dataset.checkoutAmount=String(index);
      card.append(title,createElement("p","","Quantity: "+item.quantity),createElement("p","","Lay-Bay total: "+money(total)),createElement("p","","Remaining after this deposit: "+money(total-minimum)),amountLabel,amount);
      lines.appendChild(card);
    });
    panel.style.display="block";
    $("layBaySelectionBasketList").style.display="none";
    $("layBaySelectionBasketTotal").style.display="none";
    const note = $("layBaySelectionBasket")?.querySelector(".lb-basket-plan-note");
    if (note) note.style.display="none";
    $("layBayCheckoutMessage").textContent="";
    panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  async function submitLayBayCheckout() {
    const button=$("layBayCheckoutSubmit");
    const status=$("layBayCheckoutMessage");
    if (!currentUser) { status.textContent="Your session has expired. Please sign in again."; return; }
    if (!layBaySelectionCart.length) { status.textContent="Your basket is empty."; return; }
    const method=$("layBayCheckoutMethod")?.value;
    const reference=$("layBayCheckoutReference")?.value.trim();
    const proofFile=$("layBayCheckoutProof")?.files?.[0] || null;
    if (!method) { status.textContent="Choose a payment method."; return; }
    if (!reference || reference.length<3) { status.textContent="Enter the actual transaction reference."; return; }
    if (proofFile && (!["image/jpeg","image/png","image/webp","application/pdf"].includes(proofFile.type) || proofFile.size>5*1024*1024)) {
      status.textContent="Payment proof must be JPG, PNG, WEBP or PDF and no larger than 5 MB."; return;
    }
    const amounts=[...document.querySelectorAll("[data-checkout-amount]")];
    if (amounts.length!==layBaySelectionCart.length) { status.textContent="Checkout items changed. Reopen checkout and try again."; return; }
    const items=[];
    for(let i=0;i<layBaySelectionCart.length;i++){
      const item=layBaySelectionCart[i];
      const total=Number((Number(item.unit_price)*Number(item.quantity)).toFixed(2));
      const amount=Number(amounts[i].value);
      const minimum=Number((total*0.5).toFixed(2));
      if(!Number.isFinite(amount)||amount<minimum||amount>total){
        status.textContent="Deposit for "+item.product_name+" must be between "+money(minimum)+" and "+money(total)+"."; return;
      }
      items.push({product_id:item.product_id,size:item.size||null,colour:item.colour||null,quantity:Number(item.quantity),deposit_amount:Number(amount.toFixed(2))});
    }
    button.disabled=true; button.textContent="Submitting checkout...";
    status.textContent="Submitting your product-specific plans and initial deposits securely...";
    let proofPath=null;
    try {
      if(proofFile){
        const ext=proofFile.type==="application/pdf"?"pdf":proofFile.type==="image/png"?"png":proofFile.type==="image/webp"?"webp":"jpg";
        proofPath=currentUser.id+"/payment-proof-"+Date.now()+"."+ext;
        const upload=await db.storage.from("lay-bay-payment-proofs").upload(proofPath,proofFile,{upsert:false,contentType:proofFile.type,cacheControl:"3600"});
        if(upload.error) throw upload.error;
      }
      let proofUrl=null;
      if(proofPath){
        const signed=await db.storage.from("lay-bay-payment-proofs").createSignedUrl(proofPath,31536000);
        if(signed.error) throw signed.error;
        proofUrl=signed.data.signedUrl;
      }
      const {data,error}=await db.rpc("submit_lay_bay_checkout",{
        p_items:items,p_payment_method:method,p_payment_reference:reference,p_proof_url:proofUrl
      });
      if(error) throw error;
      await loadPlans();
      const count=Number(data?.checkout_lines||items.length);
      layBaySelectionCart=[];
      renderSelectionBasket();
      $("layBayCheckoutLines").textContent="";
      $("layBayCheckoutMethod").value="";
      $("layBayCheckoutReference").value="";
      $("layBayCheckoutProof").value="";
      status.textContent="Checkout submitted successfully. "+count+" product-specific plan(s) and initial deposit(s) are awaiting LBM verification. Your dashboard will show each plan separately. Receipts are generated automatically after deposits are approved.";
      button.textContent="Checkout Submitted";
      return;
    } catch(error) {
      if(proofPath) {
        await db.storage.from("lay-bay-payment-proofs").remove([proofPath]).catch(()=>{});
      }
      status.textContent=error.message||"Checkout could not be submitted. Please review your basket and try again.";
      button.disabled=false; button.textContent="Submit Lay-Bay Checkout";
    }
  }

  // =======================================================
  // 11. DISPLAY ALL PRODUCTS
  // =======================================================

  function renderProducts() {
    const container = $("productsList");
    if (!container) return;

    // Apply the two-column layout directly to the real catalogue element.
    // This overrides the dashboard's generic .lb-grid min-width rule,
    // which otherwise forces one card per row on narrow mobile screens.
    container.style.setProperty("display", "grid", "important");
    container.style.setProperty(
      "grid-template-columns",
      "repeat(2, minmax(0, 1fr))",
      "important"
    );
    container.style.setProperty("gap", "10px", "important");
    container.style.setProperty("align-items", "start");

    container.innerHTML = "";

    if (!products.length) {
      message(
        "productsMessage",
        "No products were found in the main LBM catalogue."
      );
      return;
    }

    createSelectionStyles();
    ensureSelectionBasket();

    products.forEach(product => {
      const card = createElement(
        "article",
        "lb-card lb-product"
      );
      card.dataset.productId = String(product.id);
      card.dataset.category = String(product.category || "");
      card.style.setProperty("width", "100%", "important");
      card.style.setProperty("min-width", "0", "important");
      card.style.setProperty("margin", "0", "important");
      card.style.setProperty("box-sizing", "border-box");

      const images = productImages(product);

      const photo = createElement("img");
      photo.alt = product.name || "LBM product";
      photo.loading = "lazy";

      if (images.length) {
        photo.src = images[0];
        photo.style.cursor = "zoom-in";

        photo.addEventListener("click", () =>
  openProductGallery(images, 0, product)
);
        photo.onerror = () => {
          photo.style.display = "none";
        };
      } else {
        photo.style.display = "none";
      }

      const title = createElement(
        "h3",
        "",
        product.name || "LBM Product"
      );

      const normal = createElement(
        "p",
        "",
        "Normal price: " + money(product.price)
      );

      const layBay = createElement(
        "p",
        "",
        "Lay-Bay price: " +
        money(productPrice(product))
      );

      layBay.style.color = "#D4AF37";
      layBay.style.fontWeight = "bold";

      const availability = productAvailability(product);

      const status = createElement(
        "p",
        "lb-product-status",
        availability.label
      );

      status.style.fontWeight = "bold";
      status.style.color = availability.available
        ? "#25a56a"
        : "#d99b35";

      if (images.length) {
        title.style.cursor = "pointer";
        title.setAttribute("role", "button");
        title.setAttribute("tabindex", "0");
        title.setAttribute("aria-label", "Explore " + (product.name || "product") + " pictures and options");
        title.addEventListener("click", () =>
          openProductGallery(images, 0, product)
        );
        title.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProductGallery(images, 0, product);
          }
        });
      }

      const photoHint = createElement(
        "p",
        "lb-product-photo-hint",
        images.length ? "Tap picture to explore" : "Pictures unavailable"
      );

      card.append(
        photo,
        photoHint,
        title,
        normal,
        layBay,
        status
      );

      container.appendChild(card);
    });

    renderSelectionBasket();

    const enabledCount = products.filter(
      productEligible
    ).length;

    message(
      "productsMessage",
      "Showing all " + products.length +
      " main-store products. " +
      enabledCount + " currently available for Lay-Bay."
    );
  }


  // =======================================================
  // 11.9. SHOW A CLEAR SUMMARY AFTER A PLAN IS CREATED
  // =======================================================

  function showCreatedPlanSummary(plan) {
    if (!plan) return;

    const plansMessage = $("plansMessage");
    const plansList = $("plansList");
    if (!plansMessage || !plansList) return;

    $("lbm-created-plan-summary")?.remove();

    const balance = balanceFor(plan.id);
    const target = Number(
      balance?.target_price ?? plan.lay_bay_price_snapshot ?? 0
    );
    const verified = Number(balance?.current_balance ?? 0);
    const remaining = Number(
      balance?.remaining_balance ?? Math.max(target - verified, 0)
    );
    const firstDeposit = Number((target * 0.5).toFixed(2));

    const card = createElement("section", "lb-card");
    card.id = "lbm-created-plan-summary";

    card.append(
      createElement("h3", "", "Your Lay-Bay plan has been created!"),
      createElement("p", "", "Product: " + (plan.product_name_snapshot || "Selected LBM product")),
      createElement("p", "", "Lay-Bay plan total: " + money(target)),
      createElement("p", "", "Verified payments so far: " + money(verified)),
      createElement("p", "", "Remaining balance: " + money(remaining)),
      createElement(
        "p",
        "",
        "Next step: Submit your first deposit of at least " + money(firstDeposit) + " (50%)."
      ),
      createElement(
        "p",
        "lb-muted",
        "Creating this plan does not mean it is fully paid or ready for collection. Your first deposit must be verified by LBM before the 30-day payment period begins."
      )
    );

    const nextButton = createElement("button", "", "Go to Deposit Form");
    nextButton.type = "button";
    nextButton.addEventListener("click", () => {
      $("depositSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      $("selectedPlan")?.focus({ preventScroll: true });
    });
    card.appendChild(nextButton);

    plansMessage.after(card);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }


  // =======================================================
  // 12. CREATE A SAVINGS PLAN
  // =======================================================

  async function createPlan(product, button, variants) {
    if (!currentUser) {
      message(
        "productsMessage",
        "Please sign in before creating a plan.",
        false
      );
      return;
    }

    if (!productEligible(product)) {
      message(
        "productsMessage",
        "This product is not currently available for Lay-Bay.",
        false
      );
      return;
    }

    if (!variants.valid()) {
      message(
        "productsMessage",
        "Please select the required size and colour first.",
        false
      );
      return;
    }

    const selected = variants.getValues();

    const confirmed = window.confirm(
      "Create a Lay-Bay plan for " +
      (product.name || "this product") +
      "\n\n" +
      (selected.size ? "Size: " + selected.size + "\n" : "") +
      (selected.colour ? "Colour: " + selected.colour + "\n" : "") +
      "Lay-Bay price: " + money(productPrice(product)) +
      "\nFirst deposit required: " +
      money(Number((productPrice(product) * 0.5).toFixed(2))) +
      " (50%)." +
      "\nThe remaining balance is due within 30 days after LBM approves the first deposit." +
      "\n\nContinue?"
    );

    if (!confirmed) return;

    setButton(button, true, "Creating plan...");

    try {
      const { error } = await db.rpc(
        "create_lay_bay_plan",
        {
          p_product_id: product.id,
          p_selected_size: selected.size,
          p_selected_colour: selected.colour
        }
      );

      if (error) throw error;

      await loadPlans();

      const matchingPlan = plans.find(plan =>
        String(plan.product_id) === String(product.id) &&
        String(plan.selected_size || "") === String(selected.size || "") &&
        String(plan.selected_colour || "") === String(selected.colour || "") &&
        ["active", "pending_initial_deposit"].includes(plan.plan_status)
      );

      if (matchingPlan && $("selectedPlan")) {
        $("selectedPlan").value = matchingPlan.id;
      }

      message(
        "plansMessage",
        matchingPlan
          ? "Your Lay-Bay plan is awaiting its first deposit. Review the summary below for the amount and next step."
          : "The plan request was processed. Please refresh your plans."
      );

      if (matchingPlan) {
        showCreatedPlanSummary(matchingPlan);
      } else if ($("depositSection")) {
        $("depositSection").scrollIntoView({ behavior: "smooth" });
      }

    } catch (error) {
      message(
        "productsMessage",
        error.message || "Could not create your Lay-Bay plan.",
        false
      );

    } finally {
      renderProducts();
    }
  }

  // =======================================================
  // 13. LOAD CUSTOMER PLANS, DEPOSITS, BALANCES,
  //     RECEIPTS AND REFUNDS
  // =======================================================

  async function loadPlans() {
    if (!currentUser) return;

    message("plansMessage", "Loading your savings records...");

    const results = await Promise.all([
      db.from("lay_bay_plans")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }),

      db.from("lay_bay_deposits")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }),

      db.rpc("get_my_lay_bay_balances"),

      db.from("lay_bay_receipts")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("issued_at", { ascending: false }),

      db.from("lay_bay_refunds")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("requested_at", { ascending: false })
    ]);

    const [
      planResult,
      depositResult,
      balanceResult,
      receiptResult,
      refundResult
    ] = results;

    if (planResult.error) {
      message("plansMessage", planResult.error.message, false);
      return;
    }

    if (depositResult.error) {
      message("plansMessage", depositResult.error.message, false);
      return;
    }

    if (balanceResult.error) {
      message("plansMessage", balanceResult.error.message, false);
      return;
    }

    plans = planResult.data || [];
    deposits = depositResult.data || [];
    balances = balanceResult.data || [];

    receipts = receiptResult.error ? [] : (receiptResult.data || []);
    refunds = refundResult.error ? [] : (refundResult.data || []);

    renderPlans();
    renderDepositHistory();
    renderStatistics();
    populatePlanSelector();
    renderReceipts();
    renderRefunds();

    if (receiptResult.error) {
      message(
        "receiptsMessage",
        "Receipt records could not be loaded: " + receiptResult.error.message,
        false
      );
    }

    if (refundResult.error) {
      message(
        "refundsMessage",
        "Refund records could not be loaded: " + refundResult.error.message,
        false
      );
    }

    if (!receiptResult.error && !refundResult.error) {
      message("plansMessage", "");
    }
  }

  // =======================================================
  // 14. DISPLAY SAVINGS PLANS
  // =======================================================

  function renderPlans() {
    const container = $("plansList");
    if (!container) return;

    container.innerHTML = "";

    if (!plans.length) {
      container.textContent =
        "You have not created a savings plan yet.";
      return;
    }

    plans.forEach(plan => {
      const balance = balanceFor(plan.id);

      const target = Number(
        balance?.target_price ??
        plan.lay_bay_price_snapshot ??
        0
      );

      const current = Number(balance?.current_balance ?? 0);

      const remaining = Number(
        balance?.remaining_balance ??
        Math.max(target - current, 0)
      );

      const progress = Math.max(
        0,
        Math.min(100, Number(balance?.progress_percent ?? 0))
      );

      const card = createElement("article", "lb-card");

      const title = createElement(
        "h3",
        "",
        balance?.product_name ||
        plan.product_name_snapshot ||
        "Lay-Bay Product"
      );

      const variantText = [];

      if (plan.selected_size) {
        variantText.push("Size: " + plan.selected_size);
      }

      if (plan.selected_colour) {
        variantText.push("Colour: " + plan.selected_colour);
      }

      if (variantText.length) {
        card.appendChild(
          createElement(
            "p",
            "lb-plan-variant",
            variantText.join(" | ")
          )
        );
      }

      const status = createElement(
        "p",
        "",
        "Plan status: " + (
          plan.plan_status === "pending_initial_deposit"
            ? "Awaiting 50% first deposit"
            : (plan.plan_status || "Unknown")
        )
      );

      const total = createElement(
        "p",
        "",
        "Plan total: " + money(target)
      );

      const saved = createElement(
        "p",
        "",
        "Verified balance: " + money(current)
      );

      const left = createElement(
        "p",
        "",
        "Remaining: " + money(remaining)
      );

      const expiry = createElement(
        "p",
        "",
        plan.plan_status === "pending_initial_deposit"
          ? "30-day payment period: Starts after the first 50% deposit is approved"
          : "Deadline: " + dateText(
              balance?.expires_at || plan.expires_at
            )
      );

      const bar = createElement("div", "lb-progress");
      const fill = createElement("span");

      fill.style.width = progress + "%";
      bar.appendChild(fill);

      const percent = createElement(
        "p",
        "",
        progress.toFixed(1) + "% funded"
      );

      card.append(
        title,
        createElement("p", "lb-plan-variant", "Quantity: " + Math.max(1, Number(plan.quantity || 1))),
        status,
        total,
        saved,
        left,
        expiry,
        bar,
        percent
      );

      const isActivePlan = plan.plan_status === "active";
      const isRefundEligibleStatus = ["expired", "cancelled"].includes(plan.plan_status);

      if ((isActivePlan || isRefundEligibleStatus) && current > 0) {
        const existingRefund = refunds.find(refund =>
          String(refund.plan_id) === String(plan.id)
        );

        if (
          !existingRefund ||
          existingRefund.request_status === "rejected"
        ) {
          const requestTitle = createElement(
            "h4",
            "",
            isActivePlan ? "Request plan cancellation" : "Request a refund"
          );

          const requestNote = createElement(
            "p",
            "lb-muted",
            isActivePlan
              ? "Your plan will be placed on hold while LBM reviews your cancellation request. An administrator will assess any proposed deduction individually under the published cancellation policy. No automatic percentage penalty applies. Any deduction and its reason will be recorded before the refund is processed."
              : "Submit a refund request for the remaining verified balance. Any applicable deduction will be assessed individually and explained to you."
          );

          const reason = createElement("textarea", "lb-refund-reason");
          reason.rows = 3;
          reason.maxLength = 1000;
          reason.placeholder = isActivePlan
            ? "Explain why you want to cancel this plan..."
            : "Explain why you are requesting a refund...";

          const requestButton = createElement(
            "button",
            "",
            isActivePlan ? "Submit Cancellation Request" : "Submit Refund Request"
          );

          requestButton.type = "button";

          requestButton.addEventListener("click", () =>
            requestRefund(plan.id, reason, requestButton, isActivePlan)
          );

          card.append(requestTitle, requestNote, reason, requestButton);

        } else {
          card.appendChild(
            createElement(
              "p",
              "lb-muted",
              (isActivePlan ? "Cancellation request status: " : "Refund request status: ") +
              existingRefund.request_status
            )
          );
        }
      }

      container.appendChild(card);
    });
  }

  // =======================================================
  // 15. CUSTOMER STATISTICS
  // =======================================================

  function renderStatistics() {
    const total = balances.reduce(
      (sum, row) => sum + Number(row.current_balance || 0),
      0
    );

    if ($("totalSavings")) {
      $("totalSavings").textContent = money(total);
    }

    if ($("activePlans")) {
      $("activePlans").textContent = plans.filter(
        plan => plan.plan_status === "active"
      ).length;
    }

    if ($("completedPlans")) {
      $("completedPlans").textContent = plans.filter(
        plan => ["completed", "fulfilled"].includes(plan.plan_status)
      ).length;
    }

    if ($("pendingDeposits")) {
      $("pendingDeposits").textContent = deposits.filter(
        deposit => deposit.verification_status === "pending"
      ).length;
    }
  }

  // =======================================================
  // 16. DEPOSIT PLAN SELECTOR
  // =======================================================

  function populatePlanSelector() {
    const select = $("selectedPlan");
    if (!select) return;

    select.innerHTML =
      '<option value="">Choose a Lay-Bay plan</option>';

    plans.filter(plan =>
      ["active", "pending_initial_deposit"].includes(plan.plan_status)
    ).forEach(plan => {
      const option = document.createElement("option");

      option.value = plan.id;

      const variants = [];

      if (plan.selected_size) {
        variants.push("Size " + plan.selected_size);
      }

      if (plan.selected_colour) {
        variants.push(plan.selected_colour);
      }

      option.textContent =
        (plan.product_name_snapshot || "Lay-Bay Product") +
        (variants.length ? " (" + variants.join(", ") + ")" : "") +
        " — " +
        money(plan.lay_bay_price_snapshot) +
        (plan.plan_status === "pending_initial_deposit"
          ? " — Awaiting 50% first deposit"
          : " — Active");

      select.appendChild(option);
    });
  }

  // =======================================================
  // 17. DEPOSIT HISTORY
  // =======================================================

  function renderDepositHistory() {
    const container = $("depositHistory");
    if (!container) return;

    container.innerHTML = "";

    if (!deposits.length) {
      container.textContent =
        "No deposits have been submitted yet.";
      return;
    }

    deposits.forEach(deposit => {
      const row = createElement("article", "lb-card");

      row.append(
        createElement("strong", "", money(deposit.amount)),
        createElement(
          "p",
          "",
          "Verification: " + (deposit.verification_status || "Unknown")
        ),
        createElement(
          "p",
          "",
          "Method: " + (deposit.payment_method || "Not provided")
        ),
        createElement(
          "p",
          "",
          "Reference: " + (deposit.payment_reference || "Not provided")
        ),
        createElement(
          "p",
          "",
          "Submitted: " +
          dateText(deposit.submitted_at || deposit.created_at)
        )
      );

      container.appendChild(row);
    });
  }

  // =======================================================
  // 18. PAYMENT RECEIPTS
  // =======================================================

  function renderReceipts() {
    const container = $("receiptsList");
    if (!container) return;

    container.innerHTML = "";

    if (!receipts.length) {
      container.textContent =
        "No approved payment receipts are available yet.";
      return;
    }

    message("receiptsMessage", "");

    receipts.forEach(receipt => {
      const card = createElement("article", "lb-card");

      const button = createElement(
        "button",
        "",
        "Print / Save Receipt"
      );

      button.type = "button";
      button.addEventListener("click", () => printReceipt(receipt));

      card.append(
        createElement(
          "h3",
          "",
          receipt.receipt_number || "LBM Payment Receipt"
        ),
        createElement(
          "p",
          "",
          "Product: " + (receipt.product_name_snapshot || "Not available")
        ),
        createElement(
          "p",
          "",
          "Approved payment: " + money(receipt.amount)
        ),
        createElement(
          "p",
          "",
          "Plan total: " + money(receipt.plan_total)
        ),
        createElement(
          "p",
          "",
          "Payment method: " + (receipt.payment_method || "Not provided")
        ),
        createElement(
          "p",
          "",
          "Payment reference: " +
          (receipt.payment_reference || "Not provided")
        ),
        createElement("p", "", "Issued: " + dateText(receipt.issued_at)),
        button
      );

      container.appendChild(card);
    });
  }

  function printReceipt(receipt) {
    const printWindow = window.open(
      "",
      "_blank",
      "width=700,height=800"
    );

    if (!printWindow) {
      message(
        "receiptsMessage",
        "Please allow pop-ups to print your receipt.",
        false
      );
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>LBM Payment Receipt</title>
        <style>
          body {
            font-family:Arial,sans-serif;
            color:#222;
            max-width:650px;
            margin:30px auto;
            padding:25px;
          }
          .receipt {
            border:2px solid #D4AF37;
            padding:25px;
          }
          h2 { color:#997718; }
          .line {
            display:flex;
            justify-content:space-between;
            gap:15px;
            border-bottom:1px solid #ddd;
            padding:10px 0;
          }
          .number {
            font-size:20px;
            font-weight:bold;
            color:#997718;
            overflow-wrap:anywhere;
          }
          .footer {
            margin-top:25px;
            font-size:12px;
            color:#666;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>LBM ONLINE STORE</h1>
          <h2>LAY-BAY PAYMENT RECEIPT</h2>
          <p class="number">${safe(receipt.receipt_number)}</p>

          <div class="line">
            <strong>Product</strong>
            <span>${safe(receipt.product_name_snapshot)}</span>
          </div>

          <div class="line">
            <strong>Plan total</strong>
            <span>${safe(money(receipt.plan_total))}</span>
          </div>

          <div class="line">
            <strong>Approved payment</strong>
            <span>${safe(money(receipt.amount))}</span>
          </div>

          <div class="line">
            <strong>Currency</strong>
            <span>${safe(receipt.currency || "ZMW")}</span>
          </div>

          <div class="line">
            <strong>Payment method</strong>
            <span>${safe(receipt.payment_method)}</span>
          </div>

          <div class="line">
            <strong>Payment reference</strong>
            <span>${safe(receipt.payment_reference)}</span>
          </div>

          <div class="line">
            <strong>Submitted</strong>
            <span>${safe(dateText(receipt.deposit_submitted_at))}</span>
          </div>

          <div class="line">
            <strong>Verified</strong>
            <span>${safe(dateText(receipt.deposit_verified_at))}</span>
          </div>

          <div class="line">
            <strong>Receipt issued</strong>
            <span>${safe(dateText(receipt.issued_at))}</span>
          </div>

          <p class="footer">
            This receipt confirms that the deposit shown above
            was approved by LBM Online Store. It is not proof
            that the product has been physically collected.
          </p>
        </div>

        <p><button onclick="window.print()">Print / Save as PDF</button></p>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  // =======================================================
  // 19. REFUND REQUEST HISTORY
  // =======================================================

  function renderRefunds() {
    const container = $("refundsList");
    if (!container) return;

    container.innerHTML = "";

    if (!refunds.length) {
      container.textContent =
        "You have not submitted any refund requests.";
      return;
    }

    message("refundsMessage", "");

    refunds.forEach(refund => {
      const card = createElement("article", "lb-card");

      card.append(
        createElement("h3", "", "Refund Request"),
        createElement(
          "p",
          "",
          "Verified deposited balance: " + money(refund.total_deposited)
        ),
        createElement(
          "p",
          "",
          "Refund approved: " + money(refund.refund_amount)
        ),
        createElement(
          "p",
          "",
          "Administrator deduction: " + money(refund.proposed_deduction || 0)
        ),
        createElement(
          "p",
          "",
          "Status: " + (refund.request_status || "Unknown")
        ),
        createElement(
          "p",
          "",
          "Reason: " + (refund.cancellation_reason || "Not provided")
        ),
        createElement(
          "p",
          "",
          "Requested: " + dateText(refund.requested_at)
        )
      );

      if (
        Number(refund.proposed_deduction || 0) > 0 &&
        refund.deduction_reason &&
        ["approved", "processing", "processed"].includes(refund.request_status)
      ) {
        card.appendChild(createElement(
          "p", "", "Deduction explanation: " + refund.deduction_reason
        ));
      }

      if (
        refund.request_status === "rejected" &&
        refund.rejection_reason
      ) {
        card.appendChild(
          createElement(
            "p",
            "",
            "Administrator's reason: " + refund.rejection_reason
          )
        );
      }

      if (refund.request_status === "processed") {
        card.append(
          createElement(
            "p",
            "",
            "Refund payment reference: " +
            (refund.refund_payment_reference || "Not provided")
          ),
          createElement(
            "p",
            "",
            "Processed: " + dateText(refund.processed_at)
          )
        );
      }

      container.appendChild(card);
    });
  }

  // =======================================================
  // 20. SUBMIT A REFUND REQUEST
  // =======================================================

  async function requestRefund(planId, reasonInput, button, isCancellation = false) {
    const reason = reasonInput.value.trim();

    if (reason.length < 5) {
      message(
        "refundsMessage",
        "Please enter a clear refund reason.",
        false
      );
      return;
    }

    const confirmationText = isCancellation
      ? "Submit a cancellation and refund request? The plan will be placed on hold while LBM reviews it. It will only be cancelled if LBM approves the request."
      : "Submit a refund request for this Lay-Bay plan? LBM will review it.";

    if (!window.confirm(confirmationText)) return;

    setButton(button, true, "Submitting request...");

    try {
      const { error } = await db.rpc(
        "request_lay_bay_refund",
        {
          p_plan_id: planId,
          p_reason: reason
        }
      );

      if (error) throw error;

      message(
        "refundsMessage",
        isCancellation
          ? "Your cancellation and refund request has been submitted. Your plan is now awaiting LBM's decision."
          : "Your refund request has been submitted for review."
      );

      await loadPlans();

    } catch (error) {
      message(
        "refundsMessage",
        error.message || "Could not submit refund request.",
        false
      );

    } finally {
      setButton(
        button,
        false,
        isCancellation ? "Submit Cancellation Request" : "Submit Refund Request"
      );
    }
  }

  // =======================================================
  // 21. SUBMIT A DEPOSIT
  // =======================================================

  async function submitDeposit(event) {
    event.preventDefault();

    const planId = $("selectedPlan")?.value;
    const amount = Number($("depositAmount")?.value);
    const selectedPlan = plans.find(plan => String(plan.id) === String(planId));
    const selectedBalance = balanceFor(planId);
    const alreadyPaid = Number(selectedBalance?.current_balance || 0);
    const firstDepositMinimum = selectedPlan
      ? Number((Number(selectedPlan.lay_bay_price_snapshot) * 0.5).toFixed(2))
      : 0;
    const method = $("paymentMethod")?.value.trim();
    const reference = $("paymentReference")?.value.trim();
    const proof = $("paymentProof")?.value.trim();

    if (
      !planId ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !method ||
      !reference
    ) {
      message(
        "depositMessage",
        "Complete all required deposit fields with a valid amount.",
        false
      );
      return;
    }

    if (
      selectedPlan &&
      alreadyPaid <= 0 &&
      amount < firstDepositMinimum
    ) {
      message(
        "depositMessage",
        "Your first deposit must be at least " +
          money(firstDepositMinimum) +
          " (50% of the Lay-Bay price).",
        false
      );
      return;
    }

    const button = $("submitDepositBtn");

    setButton(button, true, "Submitting...");

    try {
      const { data, error } = await db.rpc(
        "submit_lay_bay_deposit",
        {
          p_plan_id: planId,
          p_amount: amount,
          p_payment_method: method,
          p_payment_reference: reference,
          p_proof_url: proof || null
        }
      );

      if (error) throw error;

      message(
        "depositMessage",
        "Deposit submitted for verification. Reference ID: " +
        String(data || "Submitted")
      );

      $("depositForm").reset();

      await loadPlans();

    } catch (error) {
      message(
        "depositMessage",
        error.message || "Deposit submission failed.",
        false
      );

    } finally {
      setButton(
        button,
        false,
        "Submit Deposit for Verification"
      );
    }
  }

  // =======================================================
  // 22. LOGOUT
  // =======================================================

  async function logout() {
    const button = $("logoutBtn");

    setButton(button, true, "Logging out...");

    try {
      const { error } = await db.auth.signOut();

      if (error) throw error;

      currentUser = null;
      window.location.replace("login.html");

    } catch (error) {
      message(
        "pageMessage",
        error.message || "Could not log out.",
        false
      );

      setButton(button, false, "Logout");
    }
  }

  // =======================================================
  // 23. AUTHENTICATION STATE CHANGES
  // =======================================================

  db.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      window.location.replace("login.html");
    }
  });

  // =======================================================
  // 24. INITIALISE DASHBOARD
  // =======================================================

  async function initialise() {
    try {
      ensureExtraSections();

      const authenticated = await requireSession();

      if (!authenticated) return;

      if ($("logoutBtn")) {
        $("logoutBtn").addEventListener("click", logout);
      }

      if ($("depositForm")) {
        $("depositForm").addEventListener(
          "submit",
          submitDeposit
        );
      }

      message(
        "pageMessage",
        "Your Lay-Bay dashboard is loading..."
      );

      await Promise.all([
        loadProducts(),
        loadPlans()
      ]);

      // Keep the page header clean after loading; errors and important
      // notices still use the live message area when needed.
      const pageStatus = $("pageMessage");
      if (pageStatus) {
        pageStatus.textContent = "";
        pageStatus.classList.remove("show", "error", "success");
        pageStatus.style.display = "none";
      }

    } catch (error) {
      message(
        "pageMessage",
        error.message || "Could not load the dashboard.",
        false
      );
    }
  }

  initialise();

})();
