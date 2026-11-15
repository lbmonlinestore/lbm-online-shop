/* LBM Website Traffic Analytics — anonymous daily unique visitors */
(function () {
  "use strict";
  if (window.__lbmTrafficAnalyticsStarted) return;
  window.__lbmTrafficAnalyticsStarted = true;

  const SUPABASE_URL = "https://toovotqrcsulhgdrcsmn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";
  const STORAGE_KEY = "lbm_analytics_visitor_v1";

  function getVisitorToken() {
    try {
      let token = localStorage.getItem(STORAGE_KEY);
      if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
        token = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              return (c === "x" ? r : (r & 3 | 8)).toString(16);
            });
        localStorage.setItem(STORAGE_KEY, token);
      }
      return token;
    } catch (_) {
      return null;
    }
  }

  function loadSupabase(done) {
    if (window.supabase && window.supabase.createClient) return done();
    const existing = document.querySelector('script[data-lbm-supabase]');
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.dataset.lbmSupabase = "1";
    script.onload = done;
    script.onerror = () => console.warn("LBM traffic analytics: Supabase library unavailable.");
    document.head.appendChild(script);
  }

  async function recordVisit() {
    const token = getVisitorToken();
    if (!token || !window.supabase) return;
    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData && sessionData.session && sessionData.session.user;
      if (user) {
        const { data: admin } = await client
          .from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
        if (admin) return; // Do not count administrator browsing/testing.
      }
      const { error } = await client.rpc("record_lbm_website_visit", {
        p_visitor_token: token
      });
      if (error) console.warn("LBM traffic analytics could not record this visit:", error.message);
    } catch (error) {
      console.warn("LBM traffic analytics error:", error);
    }
  }

  loadSupabase(recordVisit);
})();