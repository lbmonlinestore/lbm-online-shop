/* LBM Customer Behaviour Analytics — anonymous event tracking */
(function () {
  "use strict";
  if (window.__lbmBehaviourAnalyticsStarted) return;
  window.__lbmBehaviourAnalyticsStarted = true;
  const URL = "https://toovotqrcsulhgdrcsmn.supabase.co";
  const KEY = "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";
  const TOKEN_KEY = "lbm_analytics_visitor_v1";
  let client = null, token = null, isAdmin = false, ready = false;
  function getToken() {
    try {
      let v = localStorage.getItem(TOKEN_KEY);
      if (!v || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
        v = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, v);
      }
      return v;
    } catch (_) { return null; }
  }
  function sectionFor(path) {
    if (/lay-bay/i.test(path)) return "Lay-Bay";
    if (/technical-assistant/i.test(path)) return "Technical Assistant";
    if (/returns/i.test(path)) return "Returns & Exchanges";
    if (/catalog|shop|products/i.test(path)) return "Catalogue";
    if (location.hash === "#products") return "Catalogue";
    return "Homepage";
  }
  function device() {
    const w = Math.min(screen.width || innerWidth, innerWidth);
    return w < 600 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  }
  function source() {
    try {
      const u = new URLSearchParams(location.search);
      const tagged = u.get("utm_source");
      if (tagged) return tagged.slice(0,80);
      const ref = document.referrer;
      if (!ref) return "Direct / unknown";
      const host = new URL(ref).hostname.replace(/^www\./,"");
      if (/facebook|instagram|tiktok|whatsapp/i.test(host)) return host;
      if (/google|bing|yahoo|duckduckgo/i.test(host)) return "Search engine";
      return host;
    } catch (_) { return "Direct / unknown"; }
  }
  function safeText(s, n) { return String(s || "").replace(/[\r\n\t]+/g," ").trim().slice(0,n); }
  async function send(type, data) {
    if (!ready || isAdmin || !token || !client) return;
    const d = data || {};
    try {
      await client.rpc("record_lbm_website_event", {
        p_visitor_token: token, p_event_type: type,
        p_page_path: location.pathname,
        p_section: safeText(d.section || sectionFor(location.pathname),80),
        p_product_id: d.productId && /^\d+$/.test(String(d.productId)) ? Number(d.productId) : null,
        p_product_name: safeText(d.productName,120) || null,
        p_category: safeText(d.category,80) || null,
        p_search_term: safeText(d.searchTerm,80) || null,
        p_source: type === "page_view" ? source() : null,
        p_device_type: device()
      });
    } catch (e) { console.warn("LBM analytics event skipped:", e); }
  }
  function productInfo(card) {
    if (!card) return {};
    const action = card.querySelector('[data-action="add"],[data-action="preview-image"]');
    const name = card.querySelector("h3");
    const category = card.querySelector(".product-category");
    return { productId: action && action.dataset.id, productName: name && name.textContent, category: category && category.textContent, section: sectionFor(location.pathname) };
  }
  function observeProducts(root) {
    if (!("IntersectionObserver" in window)) return;
    const cards = root.querySelectorAll ? root.querySelectorAll(".product-card:not([data-lbm-view-observed])") : [];
    cards.forEach(card => {
      card.dataset.lbmViewObserved = "1";
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            observer.unobserve(card);
            send("product_view", productInfo(card));
          }
        });
      }, { threshold: 0.45 });
      observer.observe(card);
    });
  }
  function start() {
    token = getToken();
    if (!token || !window.supabase) return;
    client = window.supabase.createClient(URL, KEY);
    client.auth.getSession().then(async ({data}) => {
      const user = data && data.session && data.session.user;
      if (user) {
        const {data: admin} = await client.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
        isAdmin = !!admin;
      }
      ready = true;
      const path = location.pathname.toLowerCase();
      let type = "page_view";
      if (path.includes("lay-bay")) type = path.includes("signup") ? "lay_bay_signup_view" : "lay_bay_view";
      else if (path.includes("technical-assistant")) type = "technical_assistant_view";
      else if (path.includes("returns")) type = "returns_view";
      send(type);
      observeProducts(document);
    }).catch(e => console.warn("LBM analytics session check failed:",e));
  }
  document.addEventListener("click", e => {
    const add = e.target.closest('[data-action="add"]');
    if (add) send("add_to_cart", productInfo(add.closest(".product-card")));
    const card = e.target.closest(".product-card");
    if (card && !add) send("product_click", productInfo(card));
    if (e.target.closest("#checkout-button")) send("checkout_start",{section:"Checkout"});
  });
  const search = document.getElementById("lbm-product-search");
  if (search) {
    let last = "";
    search.addEventListener("change", () => {
      const term = safeText(search.value,80);
      if (term && term.toLowerCase() !== last.toLowerCase()) { last = term; send("product_search",{searchTerm:term,section:"Catalogue"}); }
    });
    search.addEventListener("keydown",e => {
      if (e.key === "Enter") {
        const term = safeText(search.value,80);
        if (term && term.toLowerCase() !== last.toLowerCase()) { last = term; send("product_search",{searchTerm:term,section:"Catalogue"}); }
      }
    });
    const results = document.getElementById("lbm-search-results");
    if (results && "MutationObserver" in window) new MutationObserver(() => {
      if (/no products found/i.test(results.textContent)) send("search_no_results",{searchTerm:search.value,section:"Catalogue"});
    }).observe(results,{childList:true,subtree:true,characterData:true});
  }
  const productList = document.getElementById("product-list");
  if (productList && "MutationObserver" in window) new MutationObserver(() => observeProducts(productList)).observe(productList,{childList:true,subtree:true});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
  window.LBMAnalytics = { track: send };
})();