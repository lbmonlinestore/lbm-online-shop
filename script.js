
/* =====================================
   LBM ONLINE SHOP - ADMIN DASHBOARD
   BLACK & GOLD LUXURY DESIGN
===================================== */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background: #080808;
    color: #f5f5f5;
    min-height: 100vh;
}

/* HEADER */

.admin-header {
    background: #111;
    padding: 22px 5%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #d4af37;
}

.brand {
    color: #d4af37;
    font-size: 25px;
    font-weight: bold;
    letter-spacing: 2px;
}

.brand span {
    color: white;
    font-size: 14px;
}

.shop-link {
    color: #d4af37;
    text-decoration: none;
    border: 1px solid #d4af37;
    padding: 10px 18px;
    border-radius: 6px;
}

.shop-link:hover {
    background: #d4af37;
    color: black;
}

/* MAIN DASHBOARD */

.dashboard {
    width: 90%;
    max-width: 1200px;
    margin: 35px auto;
}

/* WELCOME */

.welcome {
    margin-bottom: 30px;
}

.eyebrow {
    color: #d4af37;
    font-size: 12px;
    letter-spacing: 3px;
    margin-bottom: 10px;
}

.welcome h1 {
    font-size: 34px;
    color: #d4af37;
    margin-bottom: 10px;
}

.subtitle {
    color: #aaa;
    line-height: 1.6;
}

/* STATISTICS */

.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
    margin-bottom: 35px;
}

.stat-card {
    background: #151515;
    border: 1px solid #806522;
    border-radius: 12px;
    padding: 25px 18px;
    transition: 0.3s;
}

.stat-card:hover {
    border-color: #d4af37;
    transform: translateY(-3px);
}

.stat-card p {
    color: #aaa;
    font-size: 14px;
    margin-bottom: 16px;
}

.stat-card h2 {
    color: #d4af37;
    font-size: 27px;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
}

.stat-card span {
    color: #888;
    font-size: 12px;
}

/* DASHBOARD SECTIONS */

.dashboard-section {
    background: #151515;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 25px;
    margin-bottom: 25px;
}

.section-heading {
    margin-bottom: 22px;
}

.section-heading h2 {
    color: #d4af37;
    font-size: 21px;
    margin-bottom: 8px;
}

.section-heading span {
    color: #999;
    font-size: 13px;
}

/* ORDERS TABLE */

.table-container {
    width: 100%;
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 450px;
}

th {
    color: #d4af37;
    text-align: left;
    font-size: 13px;
}

th, td {
    padding: 15px 12px;
    border-bottom: 1px solid #333;
}

td {
    color: #ddd;
    font-size: 14px;
}

.empty-message {
    text-align: center;
    color: #888;
    padding: 30px;
}

/* QUICK ACTIONS */

.actions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
}

.actions-grid button {
    background: #d4af37;
    color: #080808;
    border: none;
    border-radius: 7px;
    padding: 15px 10px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.3s;
}

.actions-grid button:hover {
    background: #f0cc61;
    transform: translateY(-2px);
}

/* FOOTER */

footer {
    text-align: center;
    color: #d4af37;
    padding: 30px 10px;
    font-size: 13px;
}

footer p {
    color: #888;
    margin-top: 8px;
}

/* MOBILE RESPONSIVENESS */

@media (max-width: 800px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .actions-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 480px) {
    .dashboard {
        width: 92%;
        margin: 25px auto;
    }

    .admin-header {
        padding: 18px 4%;
    }

    .brand {
        font-size: 20px;
    }

    .welcome h1 {
        font-size: 28px;
    }

    .stat-card {
        padding: 18px 12px;
    }

    .stat-card h2 {
        font-size: 22px;
    }

    .dashboard-section {
        padding: 17px;
    }
}
