
// ==========================================
// LBM ONLINE SHOP - ADMIN SYSTEM
// ==========================================

const PRODUCTS_KEY = "lbmProducts";
const ORDERS_KEY = "lbmOrders";

// ==========================================
// STORAGE FUNCTIONS
// ==========================================

function getData(key) {
    try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : [];
    } catch (error) {
        console.error("Storage error:", error);
        return [];
    }
}

function saveData(key, data) {
    try {
        window.localStorage.setItem(
            key,
            JSON.stringify(data)
        );
        return true;
    } catch (error) {
        console.error("Saving error:", error);
        alert("Unable to save. Check your browser storage.");
        return false;
    }
}

// ==========================================
// FORMAT MONEY
// ==========================================

function formatMoney(amount) {
    return "K" + Number(amount || 0).toFixed(2);
}

// ==========================================
// SAFE HTML
// ==========================================

function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard() {

    const products = getData(PRODUCTS_KEY);
    const orders = getData(ORDERS_KEY);

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(
        order => order.status === "Pending"
    ).length;

    const revenue = orders
        .filter(order =>
            ["Paid", "Completed"].includes(order.status)
        )
        .reduce(
            (sum, order) =>
                sum + Number(order.amount || 0),
            0
        );

    document.getElementById("total-orders").textContent =
        totalOrders;

    document.getElementById("total-products").textContent =
        products.length;

    document.getElementById("pending-orders").textContent =
        pendingOrders;

    document.getElementById("total-revenue").textContent =
        formatMoney(revenue);

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

// ==========================================
// DISPLAY PRODUCTS
// ==========================================

function displayAdminProducts() {

    const products = getData(PRODUCTS_KEY);

    const list = document.getElementById(
        "admin-products-list"
    );

    const count = document.getElementById(
        "product-count"
    );

    if (!list) return;

    if (count) {
        count.textContent =
            products.length + (
                products.length === 1 ? " product" : " products"
            );
    }

    if (products.length === 0) {

        list.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    No products available. Add your first product above.
                </td>
            </tr>
        `;

        return;
    }

    list.innerHTML = products.map(product => `

        <tr>

            <td>
                <img
                    class="product-thumbnail"
                    src="${safeText(product.image)}"
                    alt="${safeText(product.name)}"
                    onerror="this.src='https://placehold.co/100x100?text=LBM'"
                >
            </td>

            <td class="product-name-cell">
                ${safeText(product.name)}
                <br>
                <small>${safeText(product.category || "Other")}</small>
            </td>

            <td>${formatMoney(product.price)}</td>

            <td class="stock-status">
                ${Number(product.stock ?? 10)}
            </td>

            <td>
                <div class="product-actions">

                    <button
                        class="secondary-button"
                        data-action="edit"
                        data-id="${Number(product.id)}"
                    >
                        Edit
                    </button>

                    <button
                        class="danger-button"
                        data-action="delete"
                        data-id="${Number(product.id)}"
                    >
                        Delete
                    </button>

                </div>
            </td>

        </tr>

    `).join("");
}

// ==========================================
// PRODUCT FORM ELEMENTS
// ==========================================

const productForm = document.getElementById("product-form");

const productId = document.getElementById("product-id");
const productName = document.getElementById("product-name");
const productCategory = document.getElementById("product-category");
const productPrice = document.getElementById("product-price");
const productStock = document.getElementById("product-stock");
const productImage = document.getElementById("product-image");
const productDescription = document.getElementById("product-description");

const saveButton = document.getElementById("save-product-button");
const cancelButton = document.getElementById("cancel-edit-button");
const formTitle = document.getElementById("product-form-title");
const adminMessage = document.getElementById("admin-message");

// ==========================================
// RESET PRODUCT FORM
// ==========================================

function resetProductForm() {

    productForm.reset();

    productId.value = "";

    formTitle.textContent = "Add New Product";

    saveButton.textContent = "SAVE PRODUCT";

    cancelButton.hidden = true;

    adminMessage.textContent = "";
}

// ==========================================
// ADD OR UPDATE PRODUCT
// ==========================================

productForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const products = getData(PRODUCTS_KEY);

    const name = productName.value.trim();
    const category = productCategory.value;
    const price = Number(productPrice.value);
    const stock = Number(productStock.value);
    const image = productImage.value.trim();
    const description = productDescription.value.trim();

    if (!name || !description || !image) {
        alert("Please complete all product fields.");
        return;
    }

    if (
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        alert("Enter a valid price and whole-number stock quantity.");
        return;
    }

    const editingId = productId.value;

    if (editingId) {

        const index = products.findIndex(
            product => String(product.id) === editingId
        );

        if (index === -1) {
            alert("Product not found.");
            return;
        }

        products[index] = {
            ...products[index],
            name,
            category,
            price,
            stock,
            image,
            description
        };

    } else {

        const newId = products.reduce(
            (maximum, product) =>
                Math.max(maximum, Number(product.id) || 0),
            0
        ) + 1;

        products.push({
            id: newId,
            name,
            category,
            price,
            stock,
            image,
            description
        });
    }

    if (!saveData(PRODUCTS_KEY, products)) {
        return;
    }

    resetProductForm();

    displayAdminProducts();
    updateDashboard();

    adminMessage.textContent =
        "Product saved successfully!";

});

// ==========================================
// EDIT PRODUCT
// ==========================================

function editProduct(id) {

    const products = getData(PRODUCTS_KEY);

    const product = products.find(
        item => Number(item.id) === Number(id)
    );

    if (!product) {
        alert("Product not found.");
        return;
    }

    productId.value = product.id;
    productName.value = product.name || "";

    const category = product.category || "Other";

    if (!Array.from(productCategory.options).some(
        option => option.value === category
    )) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        productCategory.appendChild(option);
    }

    productCategory.value = category;

    productPrice.value = product.price ?? 0;
    productStock.value = product.stock ?? 10;
    productImage.value = product.image || "";
    productDescription.value = product.description || "";

    formTitle.textContent = "Edit Product";

    saveButton.textContent = "UPDATE PRODUCT";

    cancelButton.hidden = false;

    document.getElementById("products-section")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}

// ==========================================
// DELETE PRODUCT
// ==========================================

function deleteProduct(id) {

    const products = getData(PRODUCTS_KEY);

    const product = products.find(
        item => Number(item.id) === Number(id)
    );

    if (!product) return;

    const confirmed = confirm(
        'Are you sure you want to delete "' +
        product.name +
        '"?'
    );

    if (!confirmed) return;

    const updatedProducts = products.filter(
        item => Number(item.id) !== Number(id)
    );

    if (!saveData(PRODUCTS_KEY, updatedProducts)) {
        return;
    }

    resetProductForm();

    displayAdminProducts();
    updateDashboard();

    adminMessage.textContent =
        "Product deleted successfully.";
}

// ==========================================
// PRODUCT TABLE BUTTONS
// ==========================================

document.getElementById("admin-products-list")
    .addEventListener("click", function(event) {

        const button = event.target.closest("button");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === "edit") {
            editProduct(id);
        }

        if (action === "delete") {
            deleteProduct(id);
        }
    });

// ==========================================
// CANCEL EDITING
// ==========================================

cancelButton.addEventListener("click", resetProductForm);

// ==========================================
// MANAGE PRODUCTS QUICK ACTION
// ==========================================

document.getElementById("manage-products-button")
    .addEventListener("click", function() {

        document.getElementById("products-section")
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    });

// ==========================================
// REFRESH WHEN STORAGE CHANGES
// ==========================================

window.addEventListener("storage", function(event) {

    if (
        event.key === PRODUCTS_KEY ||
        event.key === ORDERS_KEY
    ) {
        displayAdminProducts();
        updateDashboard();
    }
});

// ==========================================
// START ADMIN SYSTEM
// ==========================================

displayAdminProducts();
updateDashboard();

console.log("LBM Admin System loaded successfully.");
