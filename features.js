
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
                background: #d4af37;
                color: #080808;
                border: none;
                padding: 13px 20px;
                border-radius: 7px;
                font-weight: bold;
                cursor: pointer;
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

            #lbm-welcome-greeting {
                text-align: center;
                margin: 12px auto;
                padding: 12px 16px;
                color: #fff;
                font-size: 17px;
                font-weight: 600;
                line-height: 1.6;
            }

            #lbm-welcome-greeting span {
                color: #d4af37;
            }

            @media(max-width:600px) {
                .lbm-feature-section {
                    padding: 18px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =====================================================
       3. WELCOME MESSAGE AND ZAMBIA-TIME GREETING
       ===================================================== */

    function installGreeting() {
        let greeting = document.getElementById("lbm-welcome-greeting");

        if (!greeting) {
            greeting = document.createElement("div");
            greeting.id = "lbm-welcome-greeting";

            const hero = document.querySelector(
                ".hero, #home, header"
            );

            if (hero) {
                hero.appendChild(greeting);
            } else {
                document.body.prepend(greeting);
            }
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
        setInterval(updateGreeting, 60000);
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
                <p>Stay updated with the latest news, new arrivals and special offers from LBM Online Store.</p>
                <div id="lbm-announcements-list">
                    <p>Loading announcements...</p>
                </div>
            </section>

            <section class="lbm-feature-section" id="lbm-reviews">
                <h2>⭐ Customer Reviews</h2>
                <p>Your feedback helps us improve our products and services.</p>

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

                    <div id="lbm-review-message" class="lbm-feature-message"></div>
                </form>
            </section>

            <section class="lbm-feature-section" id="lbm-return-policy">
                <h2>↩️ Returns & Exchanges</h2>
                <p>
                    At LBM Online Store, customer satisfaction matters to us.
                    Customers may request a return or exchange within
                    <strong>3 days after delivery</strong>.
                </p>
                <p>
                    Please contact our customer support team within this
                    period to discuss your return or exchange request.
                </p>
                <p>
                    We will assist you with the next steps.
                </p>
                <a
                    href="https://wa.me/260969034955?text=Hello%20LBM%20Online%20Store%2C%20I%20would%20like%20to%20make%20a%20return%20or%20exchange%20request."
                    target="_blank"
                    rel="noopener noreferrer"
                    class="lbm-feature-button"
                    style="display:inline-block;text-decoration:none;"
                >
                    Contact Us on WhatsApp
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

            const button = form.querySelector("button[type='submit']");

            if (name.length < 2 || name.length > 80) {
                message.textContent = "Please enter a valid name.";
                return;
            }

            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                message.textContent = "Please select a rating from 1 to 5.";
                return;
            }

            if (reviewText.length < 2 || reviewText.length > 1000) {
                message.textContent = "Your review must contain 2 to 1,000 characters.";
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

})();
