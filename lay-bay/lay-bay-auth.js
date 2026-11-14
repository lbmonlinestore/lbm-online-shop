
/* =====================================================
   LBM LAY-BAY — CUSTOMER AUTHENTICATION
   Email/password + Google authentication
   Username registration and first-time setup
===================================================== */

(function () {
  "use strict";

  // =====================================================
  // 1. SUPABASE CONFIGURATION
  // =====================================================

  const SUPABASE_URL =
    "https://toovotqrcsulhgdrcsmn.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

  if (!window.supabase) {
    alert("Supabase could not load. Check your internet connection.");
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const $ = id => document.getElementById(id);

  // =====================================================
  // 2. GENERAL HELPERS
  // =====================================================

  function show(id, message, success) {
    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#D4AF37" : "#ff7777";
  }

  function validUsername(username) {
    return /^[A-Za-z0-9_]{3,20}$/.test(username);
  }

  function friendlyError(error) {
    const message = error?.message || "Something went wrong.";

    if (/duplicate|unique/i.test(message)) {
      return "That username is already taken. Please choose another.";
    }

    if (/60 days/i.test(message)) {
      return message;
    }

    return message;
  }

  // =====================================================
  // 3. CUSTOMER PROFILE CHECK
  // =====================================================

  async function getCustomerProfile(userId) {
    const { data, error } = await db
      .from("lay_bay_profiles")
      .select("username, account_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return data;
  }

  // =====================================================
  // 4. SAVE USERNAME SECURELY
  // =====================================================

  async function saveUsername(username) {
    if (!validUsername(username)) {
      throw new Error(
        "Username must contain 3–20 characters: letters, numbers or underscores only."
      );
    }

    const { data, error } = await db.rpc(
      "set_lay_bay_username",
      {
        p_username: username.trim()
      }
    );

    if (error) throw error;

    return data;
  }

  // =====================================================
  // 5. FIRST-TIME USERNAME SETUP
  // =====================================================

  function showUsernameSetup() {
    const signupForm = $("signupForm");

    if (signupForm) {
      signupForm.style.display = "none";
    }

    let panel = $("usernameSetupPanel");

    if (panel) {
      panel.style.display = "block";
      return;
    }

    panel = document.createElement("div");
    panel.id = "usernameSetupPanel";

    panel.style.cssText = `
      max-width:480px;
      margin:25px auto;
      padding:25px;
      background:#151515;
      border:1px solid #D4AF37;
      border-radius:12px;
      color:#fff;
    `;

    panel.innerHTML = `
      <h2 style="color:#D4AF37;margin-top:0;">
        Choose Your Lay-Bay Username
      </h2>

      <p>
        Before entering your dashboard, choose a unique username.
      </p>

      <p style="font-size:13px;color:#bbb;">
        Use 3–20 characters. Letters, numbers and underscores only.
      </p>

      <input
        id="firstUsername"
        type="text"
        minlength="3"
        maxlength="20"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        placeholder="Choose your username"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px;
          margin:10px 0;
          border-radius:7px;
          border:1px solid #555;
          background:#080808;
          color:white;
        "
      >

      <button
        id="saveFirstUsername"
        type="button"
        style="
          width:100%;
          padding:13px;
          border:0;
          border-radius:7px;
          background:#D4AF37;
          color:#080808;
          font-weight:bold;
          cursor:pointer;
        "
      >
        Save Username
      </button>

      <p id="usernameSetupMessage" style="margin-top:15px;"></p>
    `;

    if (signupForm && signupForm.parentNode) {
      signupForm.parentNode.insertBefore(
        panel,
        signupForm.nextSibling
      );
    } else {
      document.body.appendChild(panel);
    }

    $("saveFirstUsername").addEventListener(
      "click",
      async function () {
        const username = $("firstUsername").value.trim();
        const button = $("saveFirstUsername");
        const message = $("usernameSetupMessage");

        if (!validUsername(username)) {
          message.textContent =
            "Enter 3–20 characters using letters, numbers or underscores.";
          message.style.color = "#ff7777";
          return;
        }

        button.disabled = true;
        button.textContent = "Saving...";

        try {
          await saveUsername(username);

          message.textContent =
            "Username saved. Opening your dashboard...";

          message.style.color = "#D4AF37";

          window.location.href = "dashboard.html";

        } catch (error) {
          message.textContent = friendlyError(error);
          message.style.color = "#ff7777";

          button.disabled = false;
          button.textContent = "Save Username";
        }
      }
    );
  }

  // =====================================================
  // 6. CHECK EXISTING LOGIN SESSION
  // =====================================================

  async function redirectIfSignedIn() {
    const { data, error } = await db.auth.getSession();

    if (error || !data.session) return;

    try {
      const user = data.session.user;
      const profile = await getCustomerProfile(user.id);

      if (profile && profile.username) {
        window.location.href = "dashboard.html";
        return;
      }

      showUsernameSetup();

    } catch (error) {
      console.error("Profile check failed:", error);

      show(
        "signupMessage",
        "We could not verify your profile. Please refresh and try again.",
        false
      );
    }
  }


  // =====================================================
  // 7. GOOGLE SIGN-IN BUTTON
  // =====================================================

  const signupForm = $("signupForm");

  if (signupForm) {
    const googleButton = document.createElement("button");

    googleButton.type = "button";
    googleButton.id = "googleSignInButton";

    googleButton.innerHTML = `
      <span style="
        display:flex;
        align-items:center;
        justify-content:center;
        gap:12px;
      ">
        <svg width="22" height="22" viewBox="0 0 48 48"
             xmlns="http://www.w3.org/2000/svg"
             aria-hidden="true">
          <path fill="#4285F4"
            d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/>
          <path fill="#34A853"
            d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/>
          <path fill="#FBBC05"
            d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z"/>
          <path fill="#EA4335"
            d="M24 12.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.9 6.1-8.5 11.4-8.5z"/>
        </svg>
        <span>Continue with Google</span>
      </span>
    `;

    googleButton.style.cssText = `
      width:100%;
      padding:13px;
      margin:12px 0;
      background:#fff;
      color:#222;
      border:1px solid #ccc;
      border-radius:7px;
      font-weight:bold;
      font-size:15px;
      cursor:pointer;
    `;

    signupForm.parentNode.insertBefore(
      googleButton,
      signupForm
    );

    
googleButton.addEventListener("click", async function () {
  googleButton.disabled = true;
  googleButton.textContent = "Connecting to Google...";

  show("signupMessage", "Connecting securely to Google...", true);

  try {
    const redirectTo =
      window.location.origin + window.location.pathname;

    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo
      }
    });

    if (error) throw error;

    if (!data || !data.url) {
      throw new Error("Google authorization URL was not returned.");
    }

    window.location.assign(data.url);

  } catch (error) {
    console.error("Google sign-in error:", error);

    show("signupMessage", friendlyError(error), false);

    googleButton.disabled = false;
    googleButton.textContent = "Continue with Google";
  }
});



  }

  // =====================================================
  // 8. EMAIL AND PASSWORD REGISTRATION
  // =====================================================

  if (signupForm) {
    redirectIfSignedIn();

    signupForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const fullName = $("fullName").value.trim();
      const email = $("email").value.trim().toLowerCase();
      const username = $("username").value.trim();
      const password = $("password").value;
      const confirmPassword = $("confirmPassword").value;
      const button = $("signupBtn");

      if (!fullName) {
        show("signupMessage", "Please enter your full name.", false);
        return;
      }

      if (!validUsername(username)) {
        show(
          "signupMessage",
          "Username must contain 3–20 characters using letters, numbers or underscores.",
          false
        );
        return;
      }

      if (password.length < 8) {
        show(
          "signupMessage",
          "Your password must contain at least 8 characters.",
          false
        );
        return;
      }

      if (password !== confirmPassword) {
        show("signupMessage", "Your passwords do not match.", false);
        return;
      }

      if (!$("agree").checked) {
        show(
          "signupMessage",
          "Please accept the terms and conditions.",
          false
        );
        return;
      }

      button.disabled = true;
      button.textContent = "Creating account...";

      show(
        "signupMessage",
        "Please wait while your account is created.",
        true
      );

      try {
        const { data, error } = await db.auth.signUp({
          email: email,
          password: password,

          options: {
            data: {
              full_name: fullName,
              username: username
            }
          }
        });

        if (error) throw error;

        if (data.session) {
          await saveUsername(username);

          show(
            "signupMessage",
            "Account created successfully. Opening your dashboard...",
            true
          );

          window.location.href = "dashboard.html";

        } else {
          show(
            "signupMessage",
            "Your account has been created. Please confirm your email before logging in. Your username will be registered when you first sign in. If another customer takes it before then, you may need to choose another.",
            true
          );

          button.disabled = false;
          button.textContent = "Create Account";
        }

      } catch (error) {
        show("signupMessage", friendlyError(error), false);

        button.disabled = false;
        button.textContent = "Create Account";
      }
    });
  }

  // =====================================================
  // 9. EMAIL LOGIN HANDLER
  // Kept for compatibility if this file is used on a
  // page with the expected loginBtn element.
  // Do not load alongside login.html's own handler.
  // =====================================================

  const loginForm = $("loginForm");

  if (loginForm && $("loginBtn")) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = $("email").value.trim().toLowerCase();
      const password = $("password").value;
      const button = $("loginBtn");

      button.disabled = true;
      button.textContent = "Signing in...";

      show(
        "loginMessage",
        "Checking your login details...",
        true
      );

      try {
        const { data, error } = await db.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error("Login did not create a session.");
        }

        const profile = await getCustomerProfile(
          data.session.user.id
        );

        if (!profile || !profile.username) {
          window.location.href = "signup.html";
          return;
        }

        show(
          "loginMessage",
          "Login successful. Opening your dashboard...",
          true
        );

        window.location.href = "dashboard.html";

      } catch (error) {
        show("loginMessage", friendlyError(error), false);

        button.disabled = false;
        button.textContent = "Login";
      }
    });
  }

})();
