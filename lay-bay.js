
/* =====================================================
   LBM ONLINE STORE
   LBM LAY-BAY CUSTOMER PAGE
   ROOT TEST VERSION
===================================================== */

(function () {
  "use strict";

  /* =========================
     1. SUPABASE CONNECTION
  ========================= */

  const SUPABASE_URL =
    "https://toovotqrcsulhgdrcsmn.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

  if (!window.supabase) {
    alert("Supabase could not load. Please check your internet connection.");
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let products = [];
  let plans = [];
  let deposits = [];
  let balances = [];

  /* =========================
     2. GENERAL HELPERS
  ========================= */

  function money(value) {
    return "K" + Number(value || 0).toLocaleString(
      "en-ZM",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showMessage(id, message, success = false) {
    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#187a36" : "#b42318";
  }

  function formatDate(value) {
    if (!value) return "Not available";

    return new Date(value).toLocaleDateString("en-ZM", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function getBalance(planId) {
    return balances.find(
      item => String(item.plan_id) === String(planId)
    );
  }

  /* =========================
     3. ACCOUNT DISPLAY
  ========================= */

  function showSignedIn(user) {
    currentUser = user;

    if ($("authSection")) {
      $("authSection").classList.add("hidden");
    }

    if ($("accountSection")) {
      $("accountSection").classList.remove("hidden");
    }

    if ($("productsSection")) {
      $("productsSection").classList.remove("hidden");
    }

    if ($("depositSection")) {
      $("depositSection").classList.remove("hidden");
    }

    if ($("customerEmail")) {
      $("customerEmail").textContent = user.email || "";
    }

    showMessage("authMessage", "");

    loadProducts();
    loadPlans();
  }

  function showSignedOut() {
    currentUser = null;

    if ($("authSection")) {
      $("authSection").classList.remove("hidden");
    }

    if ($("accountSection")) {
      $("accountSection").classList.add("hidden");
    }

    if ($("productsSection")) {
      $("productsSection").classList.add("hidden");
    }

    if ($("depositSection")) {
      $("depositSection").classList.add("hidden");
    }
  }

  /* =========================
     4. CUSTOMER SIGN IN
  ========================= */

  async function login() {
    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
      showMessage("authMessage", "Enter your email and password.");
      return;
    }

    const button = $("loginBtn");

    if (button) button.disabled = true;

    showMessage("authMessage", "Signing in...");

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (button) button.disabled = false;

    if (error) {
      showMessage("authMessage", error.message);
      return;
    }

    showSignedIn(data.user);
  }

  /* =========================
     5. CUSTOMER REGISTRATION
  ========================= */

  async function register() {
    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
      showMessage("authMessage", "Enter your email and password.");
      return;
    }

    if (password.length < 8) {
      showMessage(
        "authMessage",
        "Your password must contain at least 8 characters."
      );
      return;
    }

    const button = $("registerBtn");

    if (button) button.disabled = true;

    showMessage("authMessage", "Creating your account...");

    const { data, error } = await db.auth.signUp({
      email,
      password
    });

    if (button) button.disabled = false;

    if (error) {
      showMessage("authMessage", error.message);
      return;
    }

    if (data.session && data.user) {
      showSignedIn(data.user);
    } else {
      showMessage(
        "authMessage",
        "Account created. Please check your email for confirmation.",
        true
      );
    }
  }

  /* =========================
     6. CUSTOMER SIGN OUT
  ========================= */

  async function logout() {
    const { error } = await db.auth.signOut();

    if (error) {
      alert("Unable to sign out: " + error.message);
      return;
    }

    showSignedOut();
  }

  /* =========================
     7. PRODUCT IMAGE
  ========================= */

  function getProductImage(product) {
    let image = product.image || "";

    if (Array.isArray(product.images) && product.images.length) {
      const first = product.images[0];

      image = typeof first === "string"
        ? first
        : first?.url || first?.src || image;
    }

    return image;
  }

  /* =========================
     8. PRODUCT ELIGIBILITY
  ========================= */

  function isEligible(product) {
    const normalPrice = Number(product.price || 0);
    const layBayPrice = Number(product.lay_bay_price || 0);
    const stock = Number(product.stock || 0);

    return (
      stock > 0 &&
      normalPrice > 0 &&
      layBayPrice > normalPrice
    );
  }

  /* =========================
     9. LOAD SHOP PRODUCTS
  ========================= */

  async function loadProducts() {
    const container = $("productsList");

    if (!container) return;

    container.textContent = "Loading products...";

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      container.textContent =
        "Unable to load products: " + error.message;
      return;
    }

    products = (data || []).filter(isEligible);

    renderProducts();
  }

  /* =========================
     10. DISPLAY PRODUCTS
  ========================= */

  function renderProducts() {
    const container = $("productsList");

    if (!container) return;

    if (!products.length) {
      container.innerHTML =
        "<p>No eligible Lay-Bay products are currently available.</p>";
      return;
    }

    container.innerHTML = products.map(product => {
      const image = getProductImage(product);

      return `
        <div class="product-card">
          ${
            image
              ? `<img src="${escapeHTML(image)}"
                   alt="${escapeHTML(product.name)}"
                   style="width:100%;max-width:220px;
                   height:180px;object-fit:cover;
                   border-radius:8px;">`
              : ""
          }

          <h3>${escapeHTML(product.name)}</h3>

          <p>
            Normal price:
            <span class="price">${money(product.price)}</span>
          </p>

          <p>
            Lay-Bay price:
            <strong class="price">
              ${money(product.lay_bay_price)}
            </strong>
          </p>

          <p class="muted">
            Available stock: ${Number(product.stock)}
          </p>

          <button type="button"
            data-product-id="${escapeHTML(product.id)}">
            Start Lay-Bay Plan
          </button>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-product-id]")
      .forEach(button => {
        button.addEventListener("click", () => {
          createPlan(button.dataset.productId);
        });
      });
  }

  /* =========================
     11. CREATE LAY-BAY PLAN
  ========================= */

  async function createPlan(productId) {
    if (!currentUser) {
      showMessage("authMessage", "Please sign in first.");
      return;
    }

    const product = products.find(
      item => String(item.id) === String(productId)
    );

    if (!product || !isEligible(product)) {
      alert("This product is no longer eligible for Lay-Bay.");
      await loadProducts();
      return;
    }

    const confirmed = confirm(
      "Start a Lay-Bay plan for " +
      product.name +
      " at " +
      money(product.lay_bay_price) +
      "?"
    );

    if (!confirmed) return;

    showMessage("authMessage", "Creating your plan...");

    const { error } = await db.rpc(
      "create_lay_bay_plan",
      {
        p_product_id: product.id
      }
    );

    if (error) {
      showMessage("authMessage", error.message);
      return;
    }

    showMessage(
      "authMessage",
      "Your plan has been created or retrieved. Refreshing your plans...",
      true
    );

    await loadPlans();

    if ($("depositSection")) {
      $("depositSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  /* =========================
     12. LOAD CUSTOMER PLANS
  ========================= */

  async function loadPlans() {
    if (!currentUser) return;

    const container = $("plansList");

    if (container) {
      container.textContent = "Loading your plans...";
    }

    const results = await Promise.all([
      db.from("lay_bay_plans")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }),

      db.from("lay_bay_deposits")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false }),

      db.rpc("get_my_lay_bay_balances")
    ]);

    const plansResult = results[0];
    const depositsResult = results[1];
    const balancesResult = results[2];

    if (plansResult.error) {
      if (container) {
        container.textContent =
          "Unable to load plans: " + plansResult.error.message;
      }
      return;
    }

    if (depositsResult.error) {
      if (container) {
        container.textContent =
          "Unable to load payment records: " +
          depositsResult.error.message;
      }
      return;
    }

    if (balancesResult.error) {
      if (container) {
        container.textContent =
          "Unable to load account balances: " +
          balancesResult.error.message;
      }
      return;
    }

    plans = plansResult.data || [];
    deposits = depositsResult.data || [];
    balances = balancesResult.data || [];

    renderPlans();
    populatePlanSelector();
  }

  /* =========================
     13. DISPLAY CUSTOMER PLANS
  ========================= */

  function renderPlans() {
    const container = $("plansList");

    if (!container) return;

    if (!plans.length) {
      container.innerHTML =
        "<p>You have not created a Lay-Bay plan yet.</p>";
      return;
    }

    container.innerHTML = plans.map(plan => {
      const balance = getBalance(plan.id);

      const target = Number(
        balance?.target_price ??
        plan.lay_bay_price_snapshot ??
        0
      );

      const approved = Number(
        balance?.total_credited ?? 0
      );

      const currentBalance = Number(
        balance?.current_balance ?? approved
      );

      const remaining = Number(
        balance?.remaining_balance ??
        Math.max(0, target - currentBalance)
      );

      const status = plan.plan_status || "unknown";

      return `
        <div class="plan-card">
          <h3>
            ${escapeHTML(
              plan.product_name_snapshot || "Lay-Bay Product"
            )}
          </h3>

          <p>
            Plan price:
            <strong class="price">${money(target)}</strong>
          </p>

          <p>
            Approved payments:
            ${money(approved)}
          </p>

          <p>
            Current balance:
            ${money(currentBalance)}
          </p>

          <p>
            Remaining amount:
            <strong>${money(remaining)}</strong>
          </p>

          <p>
            Plan status:
            <strong>${escapeHTML(status)}</strong>
          </p>

          <p class="muted">
            Started: ${formatDate(plan.created_at)}
          </p>

          <p class="muted">
            Expiry: ${formatDate(balance?.expires_at)}
          </p>
        </div>
      `;
    }).join("");
  }

  /* =========================
     14. PLAN SELECTOR
  ========================= */

  function populatePlanSelector() {
    const select = $("selectedPlan");

    if (!select) return;

    const previousValue = select.value;

    select.innerHTML =
      '<option value="">Select your Lay-Bay plan</option>';

    plans
      .filter(plan => plan.plan_status === "active")
      .forEach(plan => {
        const option = document.createElement("option");

        option.value = plan.id;

        option.textContent =
          (plan.product_name_snapshot || "Lay-Bay Product") +
          " — " +
          money(plan.lay_bay_price_snapshot);

        select.appendChild(option);
      });

    if (
      previousValue &&
      [...select.options].some(
        option => option.value === previousValue
      )
    ) {
      select.value = previousValue;
    }
  }

  /* =========================
     15. SUBMIT CUSTOMER DEPOSIT
  ========================= */

  async function submitDeposit() {
    if (!currentUser) {
      showMessage("depositMessage", "Please sign in first.");
      return;
    }

    const planId = $("selectedPlan")?.value;
    const amount = Number($("depositAmount")?.value);
    const method = $("paymentMethod")?.value;
    const reference = $("paymentReference")?.value.trim();
    const proof = $("paymentProof")?.value.trim() || null;

    if (!planId) {
      showMessage("depositMessage", "Please select a plan.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("depositMessage", "Enter a valid payment amount.");
      return;
    }

    if (!method) {
      showMessage("depositMessage", "Select your payment method.");
      return;
    }

    if (!reference) {
      showMessage(
        "depositMessage",
        "Enter your actual payment transaction reference."
      );
      return;
    }

    const button = $("submitDepositBtn");

    if (button) button.disabled = true;

    showMessage(
      "depositMessage",
      "Submitting your payment for verification..."
    );

    const { data, error } = await db.rpc(
      "submit_lay_bay_deposit",
      {
        p_plan_id: planId,
        p_amount: amount,
        p_payment_method: method,
        p_payment_reference: reference,
        p_proof_url: proof
      }
    );

    if (button) button.disabled = false;

    if (error) {
      showMessage("depositMessage", error.message);
      return;
    }

    if ($("depositAmount")) $("depositAmount").value = "";
    if ($("paymentReference")) $("paymentReference").value = "";
    if ($("paymentProof")) $("paymentProof").value = "";

    showMessage(
      "depositMessage",
      "Payment submitted successfully. It will count towards your plan only after admin verification.",
      true
    );

    await loadPlans();
  }

  /* =========================
     16. BUTTON CONNECTIONS
  ========================= */

  $("loginBtn")?.addEventListener("click", login);

  $("registerBtn")?.addEventListener("click", register);

  $("logoutBtn")?.addEventListener("click", logout);

  $("submitDepositBtn")?.addEventListener(
    "click",
    submitDeposit
  );

  /* =========================
     17. AIRTel PAYMENT DETAILS
  ========================= */

  $("paymentMethod")?.addEventListener("change", function () {
    const details = $("airtelPaymentDetails");

    if (details) {
      details.style.display =
        this.value === "Airtel Money" ? "block" : "none";
    }
  });

  /* =========================
     18. RESTORE CUSTOMER SESSION
  ========================= */

  async function initialise() {
    const { data, error } = await db.auth.getSession();

    if (error) {
      showMessage("authMessage", error.message);
      return;
    }

    if (data.session?.user) {
      showSignedIn(data.session.user);
    } else {
      showSignedOut();
    }
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      showSignedOut();
    }
  });

  initialise();

})();
