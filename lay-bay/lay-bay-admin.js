
/* =========================================
   LBM LAY-BAY ADMIN MODULE
   Product availability
   Customer registration overview
   Deposit management
   ========================================= */

(function () {
  "use strict";

  // =========================================
  // 1. MODULE STATE
  // =========================================

  let layBayDeposits = [];
  let layBayProducts = [];
  let layBayFilter = "pending";
  let layBayBusy = false;
  let customerOverviewBusy = false;

  const productBusyIds = new Set();
  const LAY_BAY_MARKUP = 1.22;

  // =========================================
  // 2. ADMIN CONNECTION
  // =========================================

  function getAdminDb() {
    return window.LBM_ADMIN_CONTEXT?.db || window.db || null;
  }

  function getAdminUser() {
    return window.LBM_ADMIN_CONTEXT?.currentUser ||
      window.currentUser ||
      null;
  }

  // =========================================
  // 3. HELPER FUNCTIONS
  // =========================================

  function lbEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function lbMoney(amount, currency = "ZMW") {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: currency
    }).format(Number(amount || 0));
  }

  function lbDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-ZM", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function lbRegistrationDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-ZM", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function lbSafeProof(url) {
    try {
      const parsed = new URL(url);

      if (
        parsed.protocol !== "https:" &&
        parsed.protocol !== "http:"
      ) return null;

      return parsed.href;
    } catch {
      return null;
    }
  }

  function getLayBayPrice(normalPrice) {
    return Number(
      (Number(normalPrice || 0) * LAY_BAY_MARKUP).toFixed(2)
    );
  }

  function getProductName(product) {
    return product.name ||
      product.product_name ||
      "Unnamed product";
  }

  function getProductStock(product) {
    return Number(product.stock || 0);
  }

  // =========================================
  // 4. CUSTOMER REGISTRATION HTML
  // =========================================

  function customerOverviewHTML() {
    return `
      <div id="lbCustomerOverviewSection" style="
        margin:20px 0;
        padding:16px;
        border:1px solid #ccc;
        border-radius:12px;
      ">

        <h3>Customer Registration Overview</h3>

        <p>
          View registered Lay-Bay customers and account activity.
        </p>

        <div id="lbCustomerSummary">
          Loading customer statistics...
        </div>

        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin:15px 0;
        ">
          <button type="button" id="lbRefreshCustomers">
            Refresh registrations
          </button>
        </div>

        <div id="lbCustomerMessage"></div>

        <div id="lbCustomerList">
          Loading customer registrations...
        </div>

      </div>
    `;
  }

  // =========================================
  // 5. CREATE LAY-BAY ADMIN TAB
  // =========================================

  function createLayBayTab() {
    let tab = document.querySelector('[data-tab="laybay"]');

    const referenceTab =
      document.querySelector('[data-tab="returns"]') ||
      document.querySelector('[data-tab="orders"]');

    const referencePanel =
      document.getElementById("returnsTab") ||
      document.getElementById("ordersTab");

    if (!tab && !referenceTab) {
      console.error("Lay-Bay: Admin tab location not found.");
      return;
    }

    if (!tab) {
      tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.tab = "laybay";
      tab.className = referenceTab.className;
      tab.textContent = "Lay-Bay Management";

      referenceTab.after(tab);
    }

    let panel = document.getElementById("laybayTab");

    if (!panel) {
      if (!referencePanel) {
        console.error("Lay-Bay: Admin panel location not found.");
        return;
      }

      panel = document.createElement("section");
      panel.id = "laybayTab";
      panel.className = "tab-content hidden";

      panel.innerHTML = `
        <div style="padding:20px">

          <h2>Lay-Bay Management</h2>

          <p>
            Manage eligible products, customer registrations
            and customer Lay-Bay deposits.
          </p>

          <!-- PRODUCT AVAILABILITY -->

          <div style="
            margin:20px 0;
            padding:16px;
            border:1px solid #ccc;
            border-radius:12px;
          ">

            <h3>Lay-Bay Product Availability</h3>

            <p>
              Enable Lay-Bay for products you want customers to
              purchase through the Lay-Bay payment plan.
            </p>

            <p style="font-size:13px;color:#777">
              Lay-Bay prices are calculated automatically using a
              22% increase on the normal product price. Disabling
              a product affects new plans only. Existing customer
              plans remain intact.
            </p>

            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:8px;
              margin:12px 0;
            ">
              <button type="button" id="lbLoadProducts">
                Refresh products
              </button>
            </div>

            <div id="lbProductMessage"></div>

            <div id="lbProductList">
              Loading products...
            </div>

          </div>

          <!-- CUSTOMER REGISTRATIONS -->

          ${customerOverviewHTML()}

          <!-- DEPOSIT MANAGEMENT -->

          <div style="
            margin:20px 0;
            padding:16px;
            border:1px solid #ccc;
            border-radius:12px;
          ">

            <h3>Customer Deposit Management</h3>

            <div id="lbAdminSummary"></div>

            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:8px;
              margin:15px 0;
            ">

              <button type="button" data-lb-filter="pending">
                Pending
              </button>

              <button type="button" data-lb-filter="approved">
                Approved
              </button>

              <button type="button" data-lb-filter="rejected">
                Rejected
              </button>

              <button type="button" data-lb-filter="all">
                All deposits
              </button>

              <button type="button" id="lbRefresh">
                Refresh deposits
              </button>

            </div>

            <div id="lbAdminMessage"></div>

            <div id="lbDepositList">
              Loading deposits...
            </div>

          </div>

        </div>
      `;

      referencePanel.after(panel);
    } else {
      // If the panel already exists, add registrations
      // without removing existing product or deposit sections.

      if (!document.getElementById("lbCustomerOverviewSection")) {
        const depositSection = panel.querySelector("#lbAdminSummary")
          ?.parentElement;

        const customerHTML = customerOverviewHTML();

        if (depositSection) {
          depositSection.insertAdjacentHTML(
            "beforebegin",
            customerHTML
          );
        } else {
          panel.insertAdjacentHTML("beforeend", customerHTML);
        }
      }
    }

    // =====================================
    // TAB CLICK
    // =====================================

    if (!tab.dataset.lbAdminBound) {
      tab.dataset.lbAdminBound = "true";

      tab.addEventListener("click", function () {
        if (typeof activateTab === "function") {
          activateTab("laybay");
        }

        loadLayBayAdmin();
        loadLayBayProducts();
        loadLayBayCustomerOverview();
      });
    }

    // =====================================
    // CUSTOMER REFRESH
    // =====================================

    const customerRefresh =
      panel.querySelector("#lbRefreshCustomers");

    if (customerRefresh && !customerRefresh.dataset.bound) {
      customerRefresh.dataset.bound = "true";

      customerRefresh.addEventListener(
        "click",
        loadLayBayCustomerOverview
      );
    }

    // =====================================
    // DEPOSIT FILTERS
    // =====================================

    panel.querySelectorAll("[data-lb-filter]").forEach(button => {
      if (button.dataset.bound) return;

      button.dataset.bound = "true";

      button.addEventListener("click", function () {
        layBayFilter = button.dataset.lbFilter;
        renderLayBayDeposits();
      });
    });

    // =====================================
    // DEPOSIT REFRESH
    // =====================================

    const depositRefresh = panel.querySelector("#lbRefresh");

    if (depositRefresh && !depositRefresh.dataset.bound) {
      depositRefresh.dataset.bound = "true";

      depositRefresh.addEventListener(
        "click",
        loadLayBayAdmin
      );
    }

    // =====================================
    // PRODUCT REFRESH
    // =====================================

    const productRefresh = panel.querySelector("#lbLoadProducts");

    if (productRefresh && !productRefresh.dataset.bound) {
      productRefresh.dataset.bound = "true";

      productRefresh.addEventListener(
        "click",
        loadLayBayProducts
      );
    }
  }

  // =========================================
  // 6. LOAD CUSTOMER REGISTRATION OVERVIEW
  // =========================================

  async function loadLayBayCustomerOverview() {
    const summary = document.getElementById("lbCustomerSummary");
    const list = document.getElementById("lbCustomerList");
    const message = document.getElementById("lbCustomerMessage");
    const refresh = document.getElementById("lbRefreshCustomers");

    if (!summary || !list) return;

    const db = getAdminDb();

    if (!db) {
      summary.textContent = "Supabase connection not found.";
      return;
    }

    if (!getAdminUser()) {
      summary.textContent = "Administrator session not found.";
      return;
    }

    if (customerOverviewBusy) return;

    customerOverviewBusy = true;

    if (refresh) {
      refresh.disabled = true;
      refresh.textContent = "Refreshing...";
    }

    summary.textContent = "Loading customer statistics...";
    list.textContent = "Loading customer registrations...";

    if (message) message.textContent = "";

    try {
      const { data, error } = await db.rpc(
        "get_lay_bay_customer_overview"
      );

      if (error) throw error;

      if (!data || typeof data !== "object") {
        throw new Error("The customer overview returned an unexpected response.");
      }

      const total = Number(data.total_registered || 0);
      const active = Number(data.active_accounts || 0);
      const customers = Array.isArray(data.customers)
        ? data.customers
        : [];

      summary.innerHTML = `
        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:12px;
          margin:15px 0;
        ">

          <div style="
            flex:1;
            min-width:140px;
            padding:15px;
            border:1px solid #ccc;
            border-radius:10px;
          ">
            <div style="font-size:13px;color:#777">
              Total registered
            </div>
            <div style="font-size:25px;font-weight:bold">
              ${lbEscape(total)}
            </div>
          </div>

          <div style="
            flex:1;
            min-width:140px;
            padding:15px;
            border:1px solid #ccc;
            border-radius:10px;
          ">
            <div style="font-size:13px;color:#777">
              Active accounts
            </div>
            <div style="font-size:25px;font-weight:bold">
              ${lbEscape(active)}
            </div>
          </div>

        </div>
      `;

      if (!customers.length) {
        list.textContent = "No registered Lay-Bay customers found.";
        return;
      }

      list.innerHTML = `
        <h4>Registered Customers</h4>

        <div style="overflow-x:auto">
          <table style="
            width:100%;
            border-collapse:collapse;
            min-width:280px;
          ">

            <thead>
              <tr>
                <th style="
                  text-align:left;
                  padding:10px;
                  border-bottom:1px solid #ccc;
                ">
                  Username
                </th>

                <th style="
                  text-align:left;
                  padding:10px;
                  border-bottom:1px solid #ccc;
                ">
                  Registration date
                </th>
              </tr>
            </thead>

            <tbody>
              ${customers.map(customer => `
                <tr>
                  <td style="
                    padding:10px;
                    border-bottom:1px solid #ddd;
                  ">
                    ${lbEscape(customer.username || "Username not set")}
                  </td>

                  <td style="
                    padding:10px;
                    border-bottom:1px solid #ddd;
                  ">
                    ${lbEscape(lbRegistrationDate(customer.created_at))}
                  </td>
                </tr>
              `).join("")}
            </tbody>

          </table>
        </div>
      `;

    } catch (error) {
      console.error("Lay-Bay customer overview error:", error);

      summary.textContent = "Could not load customer statistics.";

      list.textContent =
        "Could not load registrations: " + error.message;

      if (message) {
        message.textContent =
          "Check the administrator session and the customer overview database function.";
      }

    } finally {
      customerOverviewBusy = false;

      if (refresh) {
        refresh.disabled = false;
        refresh.textContent = "Refresh registrations";
      }
    }
  }

  // =========================================
  // 7. LOAD PRODUCTS
  // =========================================

  async function loadLayBayProducts() {
    const list = document.getElementById("lbProductList");
    const message = document.getElementById("lbProductMessage");

    if (!list) return;

    const db = getAdminDb();

    if (!db) {
      list.textContent = "Supabase connection not found.";
      return;
    }

    list.textContent = "Loading products...";

    if (message) message.textContent = "";

    try {
      const { data, error } = await db
        .from("products")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      layBayProducts = data || [];

      renderLayBayProducts();

    } catch (error) {
      console.error("Lay-Bay product loading error:", error);

      list.textContent =
        "Could not load products: " + error.message;
    }
  }

  // =========================================
  // 8. DISPLAY PRODUCT AVAILABILITY
  // =========================================

  function renderLayBayProducts() {
    const list = document.getElementById("lbProductList");

    if (!list) return;

    if (!layBayProducts.length) {
      list.textContent = "No products were found.";
      return;
    }

    list.innerHTML = layBayProducts.map(product => {
      const enabled = product.lay_bay_enabled === true;

      const normalPrice = Number(product.price || 0);
      const layBayPrice = getLayBayPrice(normalPrice);
      const stock = getProductStock(product);

      const productId = String(product.id);
      const busy = productBusyIds.has(productId);

      const statusText = enabled
        ? "Lay-Bay enabled"
        : "Lay-Bay disabled";

      const statusColor = enabled ? "#16803c" : "#a33";

      return `
        <article style="
          border:1px solid #ccc;
          border-radius:10px;
          padding:14px;
          margin:12px 0;
        ">

          <div style="
            display:flex;
            flex-wrap:wrap;
            justify-content:space-between;
            gap:10px;
          ">

            <div style="flex:1;min-width:180px">

              <h4 style="margin:0 0 10px">
                ${lbEscape(getProductName(product))}
              </h4>

              <p style="margin:5px 0">
                <strong>Normal price:</strong>
                ${lbEscape(lbMoney(normalPrice))}
              </p>

              <p style="margin:5px 0">
                <strong>Lay-Bay price:</strong>
                ${lbEscape(lbMoney(layBayPrice))}
              </p>

              <p style="margin:5px 0">
                <strong>Stock:</strong>
                ${lbEscape(stock)}
              </p>

              <p style="
                margin:8px 0;
                font-weight:bold;
                color:${statusColor};
              ">
                ${lbEscape(statusText)}
              </p>

              ${
                stock <= 0
                  ? `<p style="font-size:12px;color:#a33">
                       Out of stock. New plans cannot be created until
                       stock is available.
                     </p>`
                  : ""
              }

            </div>

            <div style="
              display:flex;
              align-items:center;
              min-width:130px;
            ">

              <button
                type="button"
                data-lb-product-toggle="${lbEscape(productId)}"
                data-lb-enabled="${enabled ? "true" : "false"}"
                ${busy ? "disabled" : ""}
                style="
                  padding:10px 14px;
                  border:0;
                  border-radius:7px;
                  cursor:pointer;
                  background:${enabled ? "#a33" : "#16803c"};
                  color:white;
                  opacity:${busy ? "0.6" : "1"};
                "
              >
                ${
                  busy
                    ? "Saving..."
                    : enabled
                      ? "Disable Lay-Bay"
                      : "Enable Lay-Bay"
                }
              </button>

            </div>

          </div>

        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-lb-product-toggle]").forEach(button => {
      button.addEventListener("click", function () {
        const productId = button.dataset.lbProductToggle;
        const currentlyEnabled =
          button.dataset.lbEnabled === "true";

        setLayBayProductAvailability(
          productId,
          !currentlyEnabled
        );
      });
    });
  }

  // =========================================
  // 9. ENABLE OR DISABLE A PRODUCT
  // =========================================

  async function setLayBayProductAvailability(productId, enabled) {
    const db = getAdminDb();

    if (!db) {
      alert("Supabase connection not found.");
      return;
    }

    if (productBusyIds.has(String(productId))) return;

    const product = layBayProducts.find(
      item => String(item.id) === String(productId)
    );

    if (!product) {
      alert("Product could not be found. Refresh the product list.");
      return;
    }

    const productName = getProductName(product);

    const confirmation = enabled
      ? `Enable Lay-Bay for "${productName}"? The Lay-Bay price will be calculated automatically using the 22% increase.`
      : `Disable Lay-Bay for "${productName}"? Existing customer plans will not be affected.`;

    if (!confirm(confirmation)) return;

    productBusyIds.add(String(productId));
    renderLayBayProducts();

    try {
      const { data, error } = await db
        .from("products")
        .update({
          lay_bay_enabled: enabled
        })
        .eq("id", productId)
        .select("id, lay_bay_enabled");

      if (error) throw error;

      if (!data || !data.length) {
        throw new Error(
          "No product was updated. Check administrator permissions."
        );
      }

      layBayProducts = layBayProducts.map(item => {
        if (String(item.id) === String(productId)) {
          return {
            ...item,
            lay_bay_enabled: enabled
          };
        }

        return item;
      });

      const message = document.getElementById("lbProductMessage");

      if (message) {
        message.textContent = enabled
          ? `${productName} is now enabled for Lay-Bay.`
          : `${productName} is now disabled for new Lay-Bay plans.`;
      }

    } catch (error) {
      console.error("Lay-Bay availability update error:", error);

      alert(
        "Could not update Lay-Bay availability: " + error.message
      );

    } finally {
      productBusyIds.delete(String(productId));
      renderLayBayProducts();
    }
  }

  // =========================================
  // 10. LOAD CUSTOMER DEPOSITS
  // =========================================

  async function loadLayBayAdmin() {
    const list = document.getElementById("lbDepositList");
    const message = document.getElementById("lbAdminMessage");

    if (!list) return;

    const db = getAdminDb();

    list.textContent = "Loading Lay-Bay deposits...";

    if (!getAdminUser()) {
      list.textContent = "Administrator session not found.";
      return;
    }

    if (!db) {
      list.textContent = "Supabase connection not found.";
      return;
    }

    try {
      const { data: deposits, error } = await db
        .from("lay_bay_deposits")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const rows = deposits || [];

      const planIds = [
        ...new Set(rows.map(x => x.plan_id).filter(Boolean))
      ];

      const userIds = [
        ...new Set(rows.map(x => x.user_id).filter(Boolean))
      ];

      let plans = [];
      let profiles = [];

      if (planIds.length) {
        const result = await db
          .from("lay_bay_plans")
          .select("*")
          .in("id", planIds);

        if (result.error) throw result.error;

        plans = result.data || [];
      }

      if (userIds.length) {
        const result = await db
          .from("lay_bay_profiles")
          .select("*")
          .in("user_id", userIds);

        if (result.error) throw result.error;

        profiles = result.data || [];
      }

      layBayDeposits = rows.map(deposit => ({
        ...deposit,

        plan: plans.find(
          p => String(p.id) === String(deposit.plan_id)
        ),

        profile: profiles.find(
          p => p.user_id === deposit.user_id
        )
      }));

      if (message) message.textContent = "";

      renderLayBayDeposits();

    } catch (error) {
      console.error("Lay-Bay loading error:", error);

      list.textContent =
        "Could not load Lay-Bay data: " + error.message;
    }
  }

  // =========================================
  // 11. DISPLAY CUSTOMER DEPOSITS
  // =========================================

  function renderLayBayDeposits() {
    const list = document.getElementById("lbDepositList");
    const summary = document.getElementById("lbAdminSummary");

    if (!list) return;

    const pending = layBayDeposits.filter(
      d => d.verification_status === "pending"
    ).length;

    const approved = layBayDeposits.filter(
      d => d.verification_status === "approved"
    ).length;

    const rejected = layBayDeposits.filter(
      d => d.verification_status === "rejected"
    ).length;

    if (summary) {
      summary.textContent =
        `Pending: ${pending} | Approved: ${approved} | Rejected: ${rejected}`;
    }

    const filtered = layBayFilter === "all"
      ? layBayDeposits
      : layBayDeposits.filter(
          d => d.verification_status === layBayFilter
        );

    if (!filtered.length) {
      list.textContent = "No deposits in this category.";
      return;
    }

    list.innerHTML = filtered.map(deposit => {
      const profile = deposit.profile || {};
      const plan = deposit.plan || {};

      const proof = lbSafeProof(deposit.proof_url);

      const name = profile.full_name || "Customer";
      const phone = profile.phone_number || "Not supplied";
      const status = deposit.verification_status || "unknown";

      return `
        <article style="
          border:1px solid #ccc;
          border-radius:10px;
          padding:15px;
          margin:12px 0;
        ">

          <h3>${lbEscape(name)}</h3>

          <p>
            <strong>Phone:</strong>
            ${lbEscape(phone)}
          </p>

          <p>
            <strong>Product:</strong>
            ${lbEscape(plan.product_name_snapshot || "Unknown")}
          </p>

          <p>
            <strong>Deposit:</strong>
            ${lbEscape(lbMoney(deposit.amount, deposit.currency))}
          </p>

          <p>
            <strong>Payment method:</strong>
            ${lbEscape(deposit.payment_method)}
          </p>

          <p>
            <strong>Reference:</strong>
            ${lbEscape(deposit.payment_reference)}
          </p>

          <p>
            <strong>Submitted:</strong>
            ${lbEscape(lbDate(deposit.submitted_at))}
          </p>

          <p>
            <strong>Status:</strong>
            ${lbEscape(status.toUpperCase())}
          </p>

          ${
            proof
              ? `<p>
                   <a href="${lbEscape(proof)}"
                      target="_blank"
                      rel="noopener noreferrer">
                     View payment proof
                   </a>
                 </p>`
              : "<p>No valid payment proof link supplied.</p>"
          }

          ${
            status === "pending"
              ? `
                <div style="
                  display:flex;
                  flex-wrap:wrap;
                  gap:8px;
                  margin-top:12px;
                ">

                  <button
                    type="button"
                    data-lb-approve="${lbEscape(deposit.id)}"
                  >
                    Approve deposit
                  </button>

                  <button
                    type="button"
                    data-lb-reject="${lbEscape(deposit.id)}"
                  >
                    Reject deposit
                  </button>

                </div>
              `
              : ""
          }

          ${
            deposit.rejection_reason
              ? `<p>
                   <strong>Rejection reason:</strong>
                   ${lbEscape(deposit.rejection_reason)}
                 </p>`
              : ""
          }

        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-lb-approve]").forEach(button => {
      button.addEventListener("click", () =>
        reviewLayBayDeposit(
          button.dataset.lbApprove,
          "approve"
        )
      );
    });

    list.querySelectorAll("[data-lb-reject]").forEach(button => {
      button.addEventListener("click", () =>
        reviewLayBayDeposit(
          button.dataset.lbReject,
          "reject"
        )
      );
    });
  }

  // =========================================
  // 12. APPROVE OR REJECT DEPOSIT
  // =========================================

  async function reviewLayBayDeposit(depositId, decision) {
    if (layBayBusy) return;

    const db = getAdminDb();

    if (!db) {
      alert("Supabase connection not found.");
      return;
    }

    let reason = null;

    if (decision === "reject") {
      reason = prompt(
        "Enter the reason for rejecting this deposit:"
      );

      if (!reason || !reason.trim()) {
        alert("A rejection reason is required.");
        return;
      }
    }

    const confirmation = decision === "approve"
      ? "Approve this deposit? The customer's Lay-Bay ledger will be credited."
      : "Reject this deposit?";

    if (!confirm(confirmation)) return;

    layBayBusy = true;

    try {
      const { data, error } = await db.rpc(
        "review_lay_bay_deposit",
        {
          p_deposit_id: depositId,
          p_decision: decision,
          p_rejection_reason: reason
        }
      );

      if (error) throw error;

      alert(data || "Deposit review completed.");

      await loadLayBayAdmin();

    } catch (error) {
      console.error("Lay-Bay review error:", error);

      alert("Review failed: " + error.message);

    } finally {
      layBayBusy = false;
    }
  }

  // =========================================
  // 13. PUBLIC MODULE FUNCTIONS
  // =========================================

  window.loadLayBayAdmin = loadLayBayAdmin;
  window.loadLayBayProducts = loadLayBayProducts;
  window.loadLayBayCustomerOverview = loadLayBayCustomerOverview;

  // =========================================
  // 14. INITIALISE MODULE
  // =========================================

  function initialiseLayBayAdmin() {
    createLayBayTab();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseLayBayAdmin
    );
  } else {
    initialiseLayBayAdmin();
  }

})();
