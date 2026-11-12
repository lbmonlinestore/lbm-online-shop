
/* =====================================================
   LBM ONLINE SHOP - NEW STOREFRONT FEATURES
   RETURNS | CUSTOMER REVIEWS | ANNOUNCEMENTS | GREETING
   ===================================================== */

(() => {
    "use strict";

    const SUPABASE_URL = "https://toovotqrcsulhgdrcsmn.supabase.co";
    const SUPABASE_KEY = "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

    if (!window.supabase) {
        console.error("LBM Features: Supabase library not loaded.");
        return;
    }

    const db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    /* =====================================================
       1. SAFE HTML
       ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    /* =====================================================
       2. FEATURE STYLES
       ===================================================== */

    function installStyles() {
        if (document.getElementById("lbm-new-features-style")) return;

        const style = document.createElement("style");
        style.id = "lbm-new-features-style";

        style.textContent = `
            .lbm-feature-section {
                width: min(1100px, 92%);
                margin: 35px auto;
                padding: 25px;
                background: #111;
                color: #fff;
                border: 1px solid #292929;
                border-radius: 14px;
                box-sizing: border-box;
            }

            .lbm-feature-section h2 {
                color: #d4af37;
                margin-top: 0;
                margin-bottom: 12px;
            }

            .lbm-feature-section p {
                line-height: 1.7;
            }

            .lbm-announcement-card,
            .lbm-review-card {
                background: #1b1b1b;
                border: 1px solid #333;
                border-radius: 10px;
                padding: 16px;
                margin: 14px 0;
            }

            .lbm-announcement-card h3 {
                color: #d4af37;
                margin-top: 0;
            }

            .lbm-feature-form {
                display: grid;
                gap: 13px;
                margin-top: 20px;
            }

            .lbm-feature-form input,
            .lbm-feature-form textarea,
            .lbm-feature-form select {
                width: 100%;
                padding: 13px;
                border-radius: 7px;
                border: 1px solid #444;
                background: #080808;
                color: white;
                box-sizing: border-box;
                font: inherit;
            }

            .lbm-feature-form textarea {
                min-height: 110px;
                resize: vertical;
            }

            .lbm-feature-button {
                display: inline-block;
                background: #d4af37;
                color: #080808;
                border: none;
                padding: 13px 20px;
                border-radius: 7px;
                font-weight: bold;
                cursor: pointer;
                text-decoration: none;
                text-align: center;
                transition: background .2s, transform .2s;
            }

            .lbm-feature-button:hover {
                background: #edca65;
                transform: translateY(-2px);
            }

            .lbm-feature-button:disabled {
                opacity: .6;
                cursor: not-allowed;
            }

            .lbm-feature-message {
                margin-top: 10px;
                line-height: 1.5;
            }

            .lbm-review-stars {
                color: #d4af37;
                letter-spacing: 3px;
                font-size: 19px;
            }

            .lbm-feature-date {
                color: #aaa;
                font-size: 12px;
            }

            /* GREETING: SCROLL-AWAY EFFECT */

            #lbm-welcome-greeting {
                position: static !important;
                top: auto !important;
                bottom: auto !important;
                left: auto !important;
                right: auto !important;
                z-index: auto !important;

                width: 100%;
                display: block;
                box-sizing: border-box;
                text-align: center;

                margin: 0 auto;
                padding: 14px 16px;

                color: #fff;
                background: #080808;

                font-size: 17px;
                font-weight: 600;
                line-height: 1.6;

                transform: translateY(0);
                opacity: 1;

                will-change: transform, opacity;
                transition: opacity .08s linear;
            }

            #lbm-welcome-greeting span {
                color: #d4af37;
            }

            @media(max-width:600px) {
                .lbm-feature-section {
                    padding: 18px;
                }

                #lbm-welcome-greeting {
                    font-size: 15px;
                    padding: 12px;
                }
            }

            @media(prefers-reduced-motion: reduce) {
                #lbm-welcome-greeting {
                    transition: none;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =====================================================
       3. WELCOME MESSAGE AND ZAMBIA-TIME GREETING
       ===================================================== */

    function installGreeting() {
        let greeting = document.getElementById(
            "lbm-welcome-greeting"
        );

        if (!greeting) {
            greeting = document.createElement("div");
            greeting.id = "lbm-welcome-greeting";
        }

        const main = document.querySelector("main");

        if (main && greeting.parentElement !== main) {
            main.insertBefore(greeting, main.firstChild);
        } else if (!main && !greeting.parentElement) {
            document.body.prepend(greeting);
        }

        function updateGreeting() {
            const hour = Number(
                new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Africa/Lusaka",
                    hour: "2-digit",
                    hourCycle: "h23"
                }).format(new Date())
            );

            let message;

            if (hour < 12) {
                message = "Good morning";
            } else if (hour < 18) {
                message = "Good afternoon";
            } else {
                message = "Good evening";
            }

            greeting.innerHTML =
                '<span>Welcome to LBM Online Store</span><br>' +
                escapeHTML(message) +
                "! We're glad to have you here.";
        }

        updateGreeting();

        if (!greeting.dataset.timerInstalled) {
            greeting.dataset.timerInstalled = "true";
            setInterval(updateGreeting, 60000);
        }

        /* =========================================
           GREETING SCROLL ANIMATION

           0–100px: Fully visible
           100–220px: Gradually fades and moves up
           Beyond 220px: Completely invisible
        ========================================= */

        if (!greeting.dataset.scrollInstalled) {
            greeting.dataset.scrollInstalled = "true";

            let ticking = false;

            function updateGreetingScroll() {
                const scrollY = Math.max(
                    0,
                    window.scrollY || window.pageYOffset
                );

                const startFade = 100;
                const endFade = 220;

                const progress = Math.min(
                    1,
                    Math.max(
                        0,
                        (scrollY - startFade) / (endFade - startFade)
                    )
                );

                const opacity = 1 - progress;
                const movement = -35 * progress;

                greeting.style.opacity = String(opacity);
                greeting.style.transform =
                    `translateY(${movement}px)`;

                ticking = false;
            }

            window.addEventListener("scroll", () => {
                if (!ticking) {
                    window.requestAnimationFrame(
                        updateGreetingScroll
                    );

                    ticking = true;
                }
            }, { passive: true });

            updateGreetingScroll();
        }
    }

    /* =====================================================
       4. CREATE STOREFRONT SECTIONS
       ===================================================== */

    function createFeatureSections() {
        const existing = document.getElementById(
            "lbm-new-store-features"
        );

        if (existing) return;

        const wrapper = document.createElement("div");
        wrapper.id = "lbm-new-store-features";

        wrapper.innerHTML = `
            <section class="lbm-feature-section" id="lbm-announcements">

                <h2>📢 Store Announcements</h2>

                <p>
                    Stay updated with the latest news, new arrivals
                    and special offers from LBM Online Store.
                </p>

                <div id="lbm-announcements-list">
                    <p>Loading announcements...</p>
                </div>

            </section>

            <section class="lbm-feature-section" id="lbm-reviews">

                <h2>⭐ Customer Reviews</h2>

                <p>
                    Your feedback helps us improve our products
                    and services.
                </p>

                <div id="lbm-reviews-list">
                    <p>Loading customer reviews...</p>
                </div>

                <h3>Leave a Review</h3>

                <form id="lbm-review-form" class="lbm-feature-form">

                    <input
                        type="text"
                        id="lbm-review-name"
                        placeholder="Your name"
                        minlength="2"
                        maxlength="80"
                        required
                    >

                    <select id="lbm-review-rating" required>
                        <option value="">Select your rating</option>
                        <option value="5">★★★★★ - Excellent</option>
                        <option value="4">★★★★ - Very Good</option>
                        <option value="3">★★★ - Good</option>
                        <option value="2">★★ - Fair</option>
                        <option value="1">★ - Poor</option>
                    </select>

                    <textarea
                        id="lbm-review-text"
                        placeholder="Write your experience with our shop..."
                        minlength="2"
                        maxlength="1000"
                        required
                    ></textarea>

                    <button class="lbm-feature-button" type="submit">
                        Submit Review
                    </button>

                    <div
                        id="lbm-review-message"
                        class="lbm-feature-message"
                    ></div>

                </form>

            </section>

            <section class="lbm-feature-section" id="lbm-return-policy">

                <h2>↩️ Returns & Exchanges</h2>

                <p>
                    At LBM Online Store, customer satisfaction matters to us.
                    Customers may submit a return or exchange request
                    within <strong>3 days after delivery</strong>.
                </p>

                <p>
                    To submit a request, verify your order using your
                    order number and the phone number used during checkout.
                </p>

                <p>
                    You can also track the progress of your request
                    and view responses from our customer support team
                    directly on our website.
                </p>

                <a
                    href="returns.html"
                    class="lbm-feature-button"
                >
                    Submit / Track Return or Exchange
                </a>

            </section>
        `;

        const footer = document.querySelector("footer");

        if (footer) {
            footer.parentNode.insertBefore(wrapper, footer);
        } else {
            document.body.appendChild(wrapper);
        }
    }

    /* =====================================================
       5. LOAD PUBLISHED ANNOUNCEMENTS
       ===================================================== */

    async function loadAnnouncements() {
        const container = document.getElementById(
            "lbm-announcements-list"
        );

        if (!container) return;

        try {
            const { data, error } = await db
                .from("announcements")
                .select("id, title, message, created_at")
                .eq("is_published", true)
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML =
                    "<p>There are currently no announcements. Please check back soon.</p>";
                return;
            }

            container.innerHTML = data.map(item => `
                <article class="lbm-announcement-card">
                    <h3>${escapeHTML(item.title)}</h3>

                    <p>${escapeHTML(item.message).replace(/\n/g, "<br>")}</p>

                    <div class="lbm-feature-date">
                        ${escapeHTML(
                            new Date(item.created_at).toLocaleDateString(
                                "en-ZM",
                                { timeZone: "Africa/Lusaka" }
                            )
                        )}
                    </div>
                </article>
            `).join("");

        } catch (error) {
            console.error("LBM announcements:", error);

            container.innerHTML =
                "<p>Announcements are temporarily unavailable.</p>";
        }
    }

    /* =====================================================
       6. LOAD APPROVED CUSTOMER REVIEWS
       ===================================================== */

    async function loadReviews() {
        const container = document.getElementById(
            "lbm-reviews-list"
        );

        if (!container) return;

        try {
            const { data, error } = await db
                .from("customer_reviews")
                .select("id, customer_name, rating, review_text, created_at")
                .eq("status", "Approved")
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML =
                    "<p>No customer reviews have been published yet. Be the first to share your experience!</p>";
                return;
            }

            container.innerHTML = data.map(review => `
                <article class="lbm-review-card">

                    <div class="lbm-review-stars">
                        ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}
                    </div>

                    <p>${escapeHTML(review.review_text).replace(/\n/g, "<br>")}</p>

                    <strong>${escapeHTML(review.customer_name)}</strong>

                    <div class="lbm-feature-date">
                        ${escapeHTML(
                            new Date(review.created_at).toLocaleDateString(
                                "en-ZM",
                                { timeZone: "Africa/Lusaka" }
                            )
                        )}
                    </div>

                </article>
            `).join("");

        } catch (error) {
            console.error("LBM reviews:", error);

            container.innerHTML =
                "<p>Customer reviews are temporarily unavailable.</p>";
        }
    }

    /* =====================================================
       7. CUSTOMER REVIEW SUBMISSION
       ===================================================== */

    function installReviewForm() {
        const form = document.getElementById("lbm-review-form");

        if (!form || form.dataset.installed === "true") return;

        form.dataset.installed = "true";

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const name = document.getElementById(
                "lbm-review-name"
            ).value.trim();

            const rating = Number(
                document.getElementById("lbm-review-rating").value
            );

            const reviewText = document.getElementById(
                "lbm-review-text"
            ).value.trim();

            const message = document.getElementById(
                "lbm-review-message"
            );

            const button = form.querySelector(
                "button[type='submit']"
            );

            if (name.length < 2 || name.length > 80) {
                message.textContent = "Please enter a valid name.";
                return;
            }

            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                message.textContent =
                    "Please select a rating from 1 to 5.";
                return;
            }

            if (reviewText.length < 2 || reviewText.length > 1000) {
                message.textContent =
                    "Your review must contain 2 to 1,000 characters.";
                return;
            }

            button.disabled = true;
            button.textContent = "Submitting...";

            try {
                const { error } = await db
                    .from("customer_reviews")
                    .insert([{
                        customer_name: name,
                        rating: rating,
                        review_text: reviewText,
                        status: "Pending"
                    }]);

                if (error) throw error;

                message.style.color = "#4ade80";

                message.textContent =
                    "Thank you! Your review has been submitted and is awaiting approval.";

                form.reset();

            } catch (error) {
                console.error("LBM review submission:", error);

                message.style.color = "#ff7777";

                message.textContent =
                    "We could not submit your review. Please try again.";

            } finally {
                button.disabled = false;
                button.textContent = "Submit Review";
            }
        });
    }

    /* =====================================================
       8. START FEATURES
       ===================================================== */

    async function startLBMFeatures() {
        installStyles();
        installGreeting();
        createFeatureSections();
        installReviewForm();

        await Promise.all([
            loadAnnouncements(),
            loadReviews()
        ]);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startLBMFeatures,
            { once: true }
        );
    } else {
        startLBMFeatures();
    }

  
    /* =====================================================
       9. CUSTOMER DARK / LIGHT MODE SWITCH
       SAVES CUSTOMER PREFERENCE ON DEVICE
    ===================================================== */

    function installThemeSwitcher() {
        if (document.getElementById("lbm-theme-switcher")) return;

        const style = document.createElement("style");

        style.id = "lbm-theme-switcher-style";

        style.textContent = `

            /* THEME SWITCH BUTTON */

            #lbm-theme-switcher {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 9px 12px;
                min-height: 38px;
                border: 1px solid #D4AF37;
                border-radius: 5px;
                background: transparent;
                color: #D4AF37;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition: all .25s ease;
            }

            #lbm-theme-switcher:hover {
                background: #D4AF37;
                color: #080808;
            }

            /* LIGHT MODE GLOBAL */

            body[data-lbm-theme="light"] {
                background: #F5F3ED !important;
                color: #222222 !important;
            }

            body[data-lbm-theme="light"] .topbar {
                background: linear-gradient(
                    135deg,
                    #FFFFFF,
                    #F4F0E5,
                    #FFFFFF
                ) !important;
                border-bottom: 1px solid #D4AF37;
                box-shadow: 0 4px 18px rgba(0,0,0,.10);
            }

            body[data-lbm-theme="light"] .topbar .brand {
                color: #9B7622;
            }

            body[data-lbm-theme="light"] .topbar .brand span {
                color: #222222;
            }

            body[data-lbm-theme="light"] .topbar .navigation a {
                color: #292929;
            }

            body[data-lbm-theme="light"] .topbar .header-whatsapp {
                color: #80601B;
                border-color: #B8962E;
            }

            body[data-lbm-theme="light"] .topbar .header-whatsapp:hover {
                background: #D4AF37;
                color: #111111;
            }

            body[data-lbm-theme="light"] #lbm-theme-switcher {
                color: #80601B;
                border-color: #B8962E;
            }

            body[data-lbm-theme="light"] #lbm-theme-switcher:hover {
                background: #D4AF37;
                color: #111111;
            }

            /* GREETING */

            body[data-lbm-theme="light"] #lbm-welcome-greeting {
                background: #F0EBDD !important;
                color: #292929 !important;
            }

            body[data-lbm-theme="light"] #lbm-welcome-greeting span {
                color: #9B7622;
            }

            /* HERO */

            body[data-lbm-theme="light"] .hero {
                background:
                    linear-gradient(
                        90deg,
                        rgba(255,255,255,.95),
                        rgba(255,255,255,.78),
                        rgba(255,255,255,.35)
                    ),
                    linear-gradient(135deg,#E8DFC9,#F7F5EF 65%) !important;
            }

            body[data-lbm-theme="light"] .hero h1 {
                color: #94701E;
            }

            body[data-lbm-theme="light"] .hero p {
                color: #333333;
            }

            /* GENERAL SECTIONS */

            body[data-lbm-theme="light"] section:not(.hero) {
                color: #292929;
            }

            body[data-lbm-theme="light"] h2,
            body[data-lbm-theme="light"] .section-title,
            body[data-lbm-theme="light"] .collection-title {
                color: #96721F;
            }

            body[data-lbm-theme="light"] .about,
            body[data-lbm-theme="light"] .about-section,
            body[data-lbm-theme="light"] .contact,
            body[data-lbm-theme="light"] .contact-section {
                background: #EEEAE0 !important;
                color: #292929 !important;
            }

            body[data-lbm-theme="light"] .about p,
            body[data-lbm-theme="light"] .about-section p,
            body[data-lbm-theme="light"] .contact p,
            body[data-lbm-theme="light"] .contact-section p {
                color: #444444;
            }

            /* PRODUCT CARDS */

            body[data-lbm-theme="light"] .product-card {
                background: linear-gradient(145deg,#FFFFFF,#F5F1E7) !important;
                border-color: #D8C89F;
                box-shadow: 0 5px 16px rgba(0,0,0,.08);
            }

            body[data-lbm-theme="light"] .product-card h3 {
                color: #252525;
            }

            body[data-lbm-theme="light"] .product-description {
                color: #666666;
            }

            body[data-lbm-theme="light"] .product-price {
                color: #94701E;
            }

            body[data-lbm-theme="light"] .product-card img,
            body[data-lbm-theme="light"] .product-image {
                background: #EAE6DC;
            }

            /* CART */

            body[data-lbm-theme="light"] .cart-section {
                background: #FFFFFF !important;
                color: #222222 !important;
                border-color: #D8C89F;
            }

            body[data-lbm-theme="light"] .cart-section h2,
            body[data-lbm-theme="light"] .cart-section h3,
            body[data-lbm-theme="light"] .cart-total,
            body[data-lbm-theme="light"] .total-price {
                color: #94701E;
            }

            body[data-lbm-theme="light"] .cart-item p,
            body[data-lbm-theme="light"] .cart-item span {
                color: #292929;
            }

            body[data-lbm-theme="light"] .cart-item {
                border-bottom-color: #E4DDCD;
            }

            /* INPUTS AND FORMS */

            body[data-lbm-theme="light"] input,
            body[data-lbm-theme="light"] select,
            body[data-lbm-theme="light"] textarea {
                background: #FFFFFF !important;
                color: #222222 !important;
                border-color: #D5C69F !important;
            }

            body[data-lbm-theme="light"] input::placeholder,
            body[data-lbm-theme="light"] textarea::placeholder {
                color: #888888;
            }

            /* ANNOUNCEMENTS AND REVIEWS */

            body[data-lbm-theme="light"] .lbm-feature-section {
                background: #FFFFFF !important;
                color: #292929 !important;
                border-color: #D8C89F;
                box-shadow: 0 5px 18px rgba(0,0,0,.05);
            }

            body[data-lbm-theme="light"] .lbm-feature-section h2 {
                color: #94701E;
            }

            body[data-lbm-theme="light"] .lbm-announcement-card,
            body[data-lbm-theme="light"] .lbm-review-card {
                background: #F7F4EC !important;
                color: #292929 !important;
                border-color: #E1D5B8;
            }

            body[data-lbm-theme="light"] .lbm-announcement-card h3 {
                color: #94701E;
            }

            body[data-lbm-theme="light"] .lbm-feature-date {
                color: #777777;
            }

            /* FOOTER */

            body[data-lbm-theme="light"] footer {
                background: #E9E4D8 !important;
                color: #555555 !important;
                border-top-color: #D4AF37;
            }

            body[data-lbm-theme="light"] footer a {
                color: #94701E;
            }

            /* SEARCH AND FILTERS */

            body[data-lbm-theme="light"] .search-container input,
            body[data-lbm-theme="light"] .filter-container select,
            body[data-lbm-theme="light"] .product-filters select {
                background: #FFFFFF !important;
                color: #222222 !important;
            }

            /* THEME SWITCH MOBILE */

            @media(max-width:650px) {
                #lbm-theme-switcher {
                    padding: 8px 9px;
                    font-size: 10px;
                    min-height: 35px;
                }
            }

            @media(prefers-reduced-motion:reduce) {
                #lbm-theme-switcher {
                    transition: none;
                }
            }
        `;

        document.head.appendChild(style);

        /* RESTORE SAVED THEME */

        let savedTheme = "dark";

        try {
            const storedTheme = localStorage.getItem("lbm-screen-theme");

            if (storedTheme === "light" || storedTheme === "dark") {
                savedTheme = storedTheme;
            }
        } catch (error) {
            console.warn("LBM theme preference unavailable.");
        }

        function applyTheme(theme) {
            document.body.setAttribute("data-lbm-theme", theme);

            const button = document.getElementById(
                "lbm-theme-switcher"
            );

            if (button) {
                const isDark = theme === "dark";

                button.innerHTML = isDark
                    ? "☀️ Light"
                    : "🌙 Dark";

                button.setAttribute(
                    "aria-label",
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                );

                button.setAttribute(
                    "aria-pressed",
                    String(!isDark)
                );
            }

            try {
                localStorage.setItem("lbm-screen-theme", theme);
            } catch (error) {
                console.warn("Could not save LBM theme preference.");
            }
        }

        /* CREATE THE SWITCH IN THE HEADER */

        const header = document.querySelector(".topbar");

        if (!header) {
            console.warn("LBM theme switch: Header not found.");
            return;
        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "lbm-theme-switcher";

        button.addEventListener("click", () => {
            const currentTheme = document.body.getAttribute(
                "data-lbm-theme"
            );

            applyTheme(currentTheme === "dark" ? "light" : "dark");
        });

        header.appendChild(button);

        applyTheme(savedTheme);
    }

    /* INSTALL THE THEME SWITCH */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            installThemeSwitcher,
            { once: true }
        );
    } else {
        installThemeSwitcher();
    }

  
})();
