
// ======================================
// LBM ADMIN DASHBOARD
// ======================================

const PRODUCTS_KEY = "lbmProducts";
const ORDERS_KEY = "lbmOrders";

function getData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        return [];
    }
}

function formatMoney(amount) {
    return "K" + Number(amount || 0).toFixed(2);
}

function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ======================================
// UPDATE DASHBOARD
// ======================================

function updateDashboard() {

    const products = getData(PRODUCTS_KEY);
    const orders = getData(ORDERS_KEY);

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(
        order => order.status === "Pending"
    ).length;

    // Only paid or completed orders count as revenue
    const revenue = orders
        .filter(order =>
            ["Paid", "Completed"].includes(order.status)
        )
        .reduce((sum, order) => sum + Number(order.amount || 0), 0);

    document.getElementById("total-orders").textContent =
        totalOrders;

    document.getElementById("total-products").textContent =
        products.length;

    document.getElementById("pending-orders").textContent =
        pendingOrders;

    document.getElementById("total-revenue").textContent =
        formatMoney(revenue);

    // ==================================
    // DISPLAY RECENT ORDERS
    // ==================================

    const ordersList = document.getElementById("orders-list");

    if (!ordersList) return;

    if (orders.length === 0) {

        ordersList.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">
                    No orders recorded yet.
                </td>
            </tr>
        `;

        return;
    }

    ordersList.innerHTML = orders.slice(0, 10).map(order => `
        <tr>
            <td>${safeText(order.id)}</td>
            <td>${safeText(order.customer)}</td>
            <td>${formatMoney(order.amount)}</td>
            <td>${safeText(order.status)}</td>
        </tr>
    `).join("");
}

// ======================================
// REFRESH WHEN SHOP DATA CHANGES
// ======================================

updateDashboard();

window.addEventListener("storage", function(event) {
    if (
        event.key === PRODUCTS_KEY ||
        event.key === ORDERS_KEY
    ) {
        updateDashboard();
    }
});

// Refresh when returning to dashboard
window.addEventListener("focus", updateDashboard);
