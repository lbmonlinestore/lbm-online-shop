
/* ==========================================
   LBM ONLINE STORE
   LAY-BAY ADMIN MANAGEMENT MODULE
   ========================================== */

(function () {
  "use strict";

  const context = window.LBM_ADMIN_CONTEXT;

  if (!context || !context.db) {
    console.error("Lay-Bay: Admin database connection is missing.");
    return;
  }

  const db = context.db;

  let deposits = [];
  let filter = "pending";
  let busy = false;

  /* ==========================================
     HELPERS
     ========================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function money(amount, currency = "ZMW") {
    try {
      return new Intl.NumberFormat("en-ZM", {
        style: "currency",
        currency: currency || "ZMW"
      }).format(Number(amount || 0));
    } catch {
      return `${currency || "ZMW"} ${Number(amount || 0).toFixed(2)}`;
    }
  }

  function dateFormat(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-ZM", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function proofLink(value) {
    try {
      if (!value) return null;

      const url = new URL(value);

      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function showMessage(message, isError = false) {
    const element = getElement("lbMessage");

    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#b00020" : "inherit";
  }

  /* ==========================================
     CUSTOMER REGISTRATION OVERVIEW
     ========================================== */

  async function loadCustomerOverview() {
    const container = getElement("lbCustomerOverview");

    if (!container) return;

    if (!context.currentUser) {
      container.textContent =
        "Administrator session not found.";
      return;
    }

    container.textContent =
      "Loading customer registration information...";

    try {
      const { data, error } = await db.rpc(
        "get_lay_bay_customer_overview"
      );

      if (error) throw error;

      if (!data || typeof data !== "object") {
        throw new Error(
          "The database returned an invalid response."
        );
      }

      const total = Number(data.total_registered || 0);
      const active = Number(data.active_accounts || 0);
      const customers = Array.isArray(data.customers)
        ? data.customers
        : [];

      container.innerHTML = `
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
          gap:12px;
          margin:15px 0">

          <div style="
            border:1px solid #ccc;
            border-radius:10px;
            padding:16px">

            <p>Total Registered</p>

            <h2>${escapeHTML(total)}</h2>
          </div>

          <div style="
            border:1px solid #ccc;
            border-radius:10px;
            padding:16px">

            <p>Active Accounts</p>

            <h2>${escapeHTML(active)}</h2>
          </div>

        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          flex-wrap:wrap;
          gap:10px">

          <h3>Registered Customers</h3>

          <button type="button" id="lbCustomerRefresh">
            Refresh Customers
          </button>

        </div>

        <div id="lbCustomerList"></div>
      `;

      const customerList = getElement("lbCustomerList");

      if (customers.length === 0) {
        customerList.textContent =
          "No registered customers found.";
      } else {
        customerList.innerHTML = customers.map(customer => `
          <article style="
            border:1px solid #ccc;
            border-radius:9px;
            padding:12px;
            margin:10px 0">

            <p>
              <strong>Username:</strong>
              ${escapeHTML(customer.username || "Username not set")}
            </p>

            <p>
              <strong>Registration date:</strong>
              ${escapeHTML(dateFormat(customer.created_at))}
            </p>

          </article>
        `).join("");
      }

      getElement("lbCustomerRefresh").addEventListener(
        "click",
        loadCustomerOverview
      );

      console.log("LBM customer overview:", {
        total_registered: total,
        active_accounts: active,
        customers
      });

    } catch (error) {
      console.error(
        "Customer overview error:",
        error
      );

      container.innerHTML = `
        <p style="color:#b00020">
          Unable to load customer registrations:
          ${escapeHTML(error.message || String(error))}
        </p>

        <button type="button" id="lbCustomerRetry">
          Try Again
        </button>
      `;

      getElement("lbCustomerRetry").addEventListener(
        "click",
        loadCustomerOverview
      );
    }
  }

  /* ==========================================
     CREATE DASHBOARD TAB
     ========================================== */

  function createTab() {
    if (document.querySelector('[data-tab="laybay"]')) {
      return;
    }

    const existingTab =
      document.querySelector('[data-tab="returns"]') ||
      document.querySelector('[data-tab="orders"]');

    const existingPanel =
      document.getElementById("returnsTab") ||
      document.getElementById("ordersTab");

    if (!existingTab || !existingPanel) {
      console.error("Lay-Bay: Could not locate dashboard tabs.");
      return;
    }

    const tab = document.createElement("button");

    tab.type = "button";
    tab.dataset.tab = "laybay";
    tab.className = existingTab.className;
    tab.textContent = "Lay-Bay Management";

    existingTab.after(tab);

    const panel = document.createElement("section");

    panel.id = "laybayTab";
    panel.className = "tab-content hidden";

    panel.innerHTML = `
      <div style="padding:20px">

        <h2>Lay-Bay Management</h2>

        <h3>Customer Registrations</h3>

        <p>
          Customer registration overview.
          Only usernames and registration dates are displayed.
        </p>

        <div id="lbCustomerOverview">
          Select Lay-Bay Management to load customers.
        </div>

        <hr style="margin:25px 0">

        <h3>Deposit Management</h3>

        <p>Manage customer Lay-Bay deposits.</p>

        <div id="lbSummary"
          style="margin:15px 0;font-weight:bold">
        </div>

        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-bottom:15px">

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
            All
          </button>

          <button type="button" id="lbRefresh">
            Refresh Deposits
          </button>

        </div>

        <p id="lbMessage" role="status" aria-live="polite"></p>

        <div id="lbDepositList">
          Select Lay-Bay Management to load deposits.
        </div>

      </div>
    `;

    existingPanel.after(panel);

    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.tab === "laybay"
        );
      });

      document.querySelectorAll(".tab-content").forEach(section => {
        section.classList.toggle(
          "hidden",
          section.id !== "laybayTab"
        );
      });

      loadCustomerOverview();
      loadDeposits();
    });

    panel.querySelectorAll("[data-lb-filter]").forEach(button => {
      button.addEventListener("click", () => {
        filter = button.dataset.lbFilter;
        renderDeposits();
      });
    });

    panel.querySelector("#lbRefresh").addEventListener(
      "click",
      loadDeposits
    );
  }

  /* ==========================================
     LOAD DEPOSITS
     ========================================== */

  async function loadDeposits() {
    const list = getElement("lbDepositList");

    if (!list) return;

    if (!context.currentUser) {
      showMessage("Administrator session not found.", true);
      list.textContent = "Please log in as an administrator.";
      return;
    }

    list.textContent = "Loading deposits...";
    showMessage("Connecting to Lay-Bay database...");

    try {
      const result = await db
        .from("lay_bay_deposits")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (result.error) {
        throw result.error;
      }

      const rows = result.data || [];

      const planIds = [
        ...new Set(rows.map(deposit => deposit.plan_id).filter(Boolean))
      ];

      const userIds = [
        ...new Set(rows.map(deposit => deposit.user_id).filter(Boolean))
      ];

      let plans = [];
      let profiles = [];

      if (planIds.length > 0) {
        const response = await db
          .from("lay_bay_plans")
          .select("*")
          .in("id", planIds);

        if (response.error) {
          throw new Error(
            "Could not load Lay-Bay plans: " + response.error.message
          );
        }

        plans = response.data || [];
      }

      if (userIds.length > 0) {
        const response = await db
          .from("lay_bay_profiles")
          .select("*")
          .in("user_id", userIds);

        if (response.error) {
          throw new Error(
            "Could not load customer profiles: " + response.error.message
          );
        }

        profiles = response.data || [];
      }

      deposits = rows.map(deposit => ({
        ...deposit,

        plan: plans.find(
          plan => plan.id === deposit.plan_id
        ) || null,

        profile: profiles.find(
          profile => profile.user_id === deposit.user_id
        ) || null
      }));

      renderDeposits();

      if (rows.length === 0) {
        showMessage(
          "Database query succeeded, but returned zero visible deposits. Check whether deposits have been submitted and whether administrator SELECT access is allowed by RLS."
        );
      } else {
        showMessage(
          `Successfully loaded ${rows.length} deposits.`
        );
      }

    } catch (error) {
      console.error("Lay-Bay loading error:", error);

      deposits = [];

      const message = error?.message || String(error);

      showMessage("DATABASE ERROR: " + message, true);

      list.textContent = "Unable to load deposits: " + message;

      updateSummary();
    }
  }

  /* ==========================================
     SUMMARY COUNTS
     ========================================== */

  function updateSummary() {
    const summary = getElement("lbSummary");

    if (!summary) return;

    const pending = deposits.filter(
      deposit => deposit.verification_status === "pending"
    ).length;

    const approved = deposits.filter(
      deposit => deposit.verification_status === "approved"
    ).length;

    const rejected = deposits.filter(
      deposit => deposit.verification_status === "rejected"
    ).length;

    summary.textContent =
      `Pending: ${pending} | Approved: ${approved} | Rejected: ${rejected}`;
  }

  /* ==========================================
     DISPLAY DEPOSITS
     ========================================== */

  function renderDeposits() {
    const list = getElement("lbDepositList");

    if (!list) return;

    updateSummary();

    const filtered = filter === "all"
      ? deposits
      : deposits.filter(
          deposit => deposit.verification_status === filter
        );

    if (filtered.length === 0) {
      list.textContent = "No deposits found for this filter.";
      return;
    }

    list.innerHTML = filtered.map(deposit => {
      const profile = deposit.profile || {};
      const plan = deposit.plan || {};

      const proof = proofLink(deposit.proof_url);

      const status = String(
        deposit.verification_status || "unknown"
      ).toUpperCase();

      return `
        <article style="
          border:1px solid #ccc;
          border-radius:10px;
          padding:15px;
          margin-bottom:12px">

          <h3>
            ${escapeHTML(profile.full_name || "Customer")}
          </h3>

          <p>
            <strong>Phone:</strong>
            ${escapeHTML(profile.phone_number || "Not supplied")}
          </p>

          <p>
            <strong>Product:</strong>
            ${escapeHTML(plan.product_name_snapshot || "Unknown product")}
          </p>

          <p>
            <strong>Deposit:</strong>
            ${escapeHTML(money(deposit.amount, deposit.currency))}
          </p>

          <p>
            <strong>Payment method:</strong>
            ${escapeHTML(deposit.payment_method || "Not supplied")}
          </p>

          <p>
            <strong>Reference:</strong>
            ${escapeHTML(deposit.payment_reference || "Not supplied")}
          </p>

          <p>
            <strong>Date:</strong>
            ${escapeHTML(dateFormat(deposit.submitted_at))}
          </p>

          <p>
            <strong>Status:</strong>
            ${escapeHTML(status)}
          </p>

          ${
            proof
              ? `<p>
                   <a href="${escapeHTML(proof)}"
                      target="_blank"
                      rel="noopener noreferrer">
                     View payment proof
                   </a>
                 </p>`
              : "<p>No valid payment proof supplied.</p>"
          }

          ${
            deposit.verification_status === "pending"
              ? `
                <button
                  type="button"
                  data-lb-approve="${escapeHTML(deposit.id)}">
                  Approve
                </button>

                <button
                  type="button"
                  data-lb-reject="${escapeHTML(deposit.id)}">
                  Reject
                </button>
              `
              : ""
          }

          ${
            deposit.rejection_reason
              ? `<p>
                   <strong>Rejection reason:</strong>
                   ${escapeHTML(deposit.rejection_reason)}
                 </p>`
              : ""
          }

        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-lb-approve]").forEach(button => {
      button.addEventListener("click", () => {
        reviewDeposit(button.dataset.lbApprove, "approve");
      });
    });

    list.querySelectorAll("[data-lb-reject]").forEach(button => {
      button.addEventListener("click", () => {
        reviewDeposit(button.dataset.lbReject, "reject");
      });
    });
  }

  /* ==========================================
     APPROVE OR REJECT DEPOSIT
     ========================================== */

  async function reviewDeposit(depositId, decision) {
    if (busy) return;

    if (!depositId || !["approve", "reject"].includes(decision)) {
      alert("Invalid deposit review request.");
      return;
    }

    let reason = null;

    if (decision === "reject") {
      reason = prompt("Enter the rejection reason:");

      if (!reason || !reason.trim()) {
        alert("A rejection reason is required.");
        return;
      }

      reason = reason.trim();
    }

    if (!confirm(
      `Are you sure you want to ${decision} this deposit?`
    )) {
      return;
    }

    busy = true;

    showMessage("Processing deposit review...");

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

      await loadDeposits();

    } catch (error) {
      console.error("Lay-Bay review failed:", error);

      const message = error?.message || String(error);

      showMessage("REVIEW ERROR: " + message, true);

      alert("Deposit review failed: " + message);

    } finally {
      busy = false;
    }
  }

  /* ==========================================
     PUBLIC REFRESH FUNCTIONS
     ========================================== */

  window.loadLayBayAdmin = loadDeposits;
  window.loadLayBayCustomerOverview = loadCustomerOverview;

  /* ==========================================
     INITIALISE MODULE
     ========================================== */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      createTab,
      { once: true }
    );
  } else {
    createTab();
  }

})();
