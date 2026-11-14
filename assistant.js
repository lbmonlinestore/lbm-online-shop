/* =========================================================
   LBM ONLINE SHOP — TECHNICAL ASSISTANT
   Complete read-only shopping helper.
   English / Bemba / Nyanja. No order or admin permissions.
========================================================= */
(() => {
  "use strict";

  const SUPABASE_URL = "https://toovotqrcsulhgdrcsmn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";
  const WHATSAPP = "260969034955";

  const messages = document.getElementById("chatMessages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const language = document.getElementById("assistantLanguage");
  const sendButton = document.getElementById("sendButton");
  if (!messages || !form || !input || !language) {
    console.error("LBM Assistant: required chat elements are missing.");
    return;
  }

  const words = {
    en: {
      welcome: "Hello! Welcome to LBM Online Shop. I can help you find products, check prices, sizes and colours, and explain how to order.",
      language: "Language changed to English.",
      loading: "Checking the LBM product catalogue…",
      found: "Here are the products I found:",
      none: "I couldn't find a matching product. Try another name or contact our team on WhatsApp.",
      error: "The product catalogue is not responding right now. Please try again or contact our team on WhatsApp.",
      all: "Here are the products currently listed in our catalogue:",
      ask: "Which product would you like me to check?",
      size: "Tell me the product name and I will check its listed sizes.",
      colour: "Tell me the product name and I will check its listed colours.",
      order: "To order, open the product in the shop and contact our team on WhatsApp to confirm availability, size, colour and delivery.",
      delivery: "We serve customers across Zambia. Parcels are sent using carrier services; delivery charges and timing depend on the destination. Please confirm the current details with our team.",
      payment: "The shop displays MTN, Airtel and Zamtel Money options. Confirm payment instructions with LBM before sending money.",
      help: "Ask me to show products, find a product by name, check its price, sizes or colours, or explain ordering, delivery and payment.",
      whatsapp: "You can contact LBM customer support directly on WhatsApp.",
      price: "Price",
      sizes: "Sizes",
      colours: "Colours",
      description: "Details",
      unavailable: "Not listed",
      enquire: "Ask about this product on WhatsApp"
    },
    bem: {
      welcome: "Mwaiseni ku LBM Online Shop! Kuti namyafwa shani? Ningamona ama product, ama price, ama size na ama colour.",
      language: "Ululimi lwacinja",
      loading: "Nalolesha mu ma product ya LBM…",
      found: "Naisanga ifi ma product:",
      none: "Nshaisanga iyi product. Yesheni ishina line kapena mututumine pa WhatsApp.",
      error: "Ndi na akashishi pa kulolesha ama product. Mukwai, yesheniko nakabili kapena mututumine pa WhatsApp.",
      all: "Aya ni ma product yalembwa mu shop:",
      ask: "Ni product inshi mulefwaya ndiloleshe?",
      size: "Ndeipusha ishina lya product kuti ndiloleshe ama size.",
      colour: "Ndeipusha ishina lya product kuti ndiloleshe ama colour.",
      order: "Pa ku order, funguleni product mu shop, kabili mututumine pa WhatsApp kuti twikilishe availability, size, colour na delivery.",
      delivery: "Tuposa ama parcel mu Zambia yonse ukubomfya carrier services. Ama delivery charges na inshita filekanafye ukulingana nefyo muleya. Mukwai, ipusheni pa WhatsApp.",
      payment: "Mu shop muli MTN, Airtel na Zamtel Money. Mukwai, ikilisha ama payment instructions na LBM ukushita ukutuma ndalama.",
      help: "Mwingaipusha ukuti ndilange ama product, price, size, colour, ukuti mwalanda shani order, delivery na payment.",
      whatsapp: "Mwinga landa na LBM pa WhatsApp.",
      price: "Price",
      sizes: "Ama size",
      colours: "Ama colour",
      description: "Ifyo ili",
      unavailable: "Takwaba ifyalembwa",
      enquire: "Ipusheni iyi product pa WhatsApp"
    },
    nya: {
      welcome: "Takulandirani ku LBM Online Shop! Ndingakuthandizeni kupeza katundu, kudziwa mitengo, ma size ndi ma colour, komanso mmene mungayitanitsire.",
      language: "Chinenero chasinthidwa kukhala Chinyanja.",
      loading: "Ndikuyang'ana katundu wa ku LBM…",
      found: "Izi ndi zimene ndapeza:",
      none: "Sindinapeze katunduyu. Yesani dzina lina kapena tilankhuleni pa WhatsApp.",
      error: "Sindikutha kupeza mndandanda wa katundu panopa. Yesaninso kapena tilankhuleni pa WhatsApp.",
      all: "Iyi ndi katundu amene walembedwa m'sitolo:",
      ask: "Mukufuna ndione katundu uti?",
      size: "Ndiuzeni dzina la katunduyo kuti ndione ma size ake.",
      colour: "Ndiuzeni dzina la katunduyo kuti ndione ma colour ake.",
      order: "Kuti muyitanitse, tsegulani katunduyo m'sitolo ndipo tilankhuleni pa WhatsApp kuti titsimikizire kupezeka, size, colour ndi kutumiza.",
      delivery: "Timatumiza katundu m'madera osiyanasiyana ku Zambia pogwiritsa ntchito ma carrier. Mtengo ndi nthawi yotumizira zimasiyana malinga ndi kumene mukukhala. Tsimikizirani pa WhatsApp.",
      payment: "M'sitolo muli njira za MTN, Airtel ndi Zamtel Money. Tsimikizirani malangizo a kulipira ndi LBM musanatumize ndalama.",
      help: "Mundifunse kuti ndionetse katundu, mtengo, ma size, ma colour, mmene mungayitanitsire, kutumiza kapena kulipira.",
      whatsapp: "Mungathe kulankhula ndi gulu la LBM pa WhatsApp.",
      price: "Mtengo",
      sizes: "Ma size",
      colours: "Ma colour",
      description: "Zambiri",
      unavailable: "Sizinatchulidwe",
      enquire: "Funsani za katunduyu pa WhatsApp"
    }
  };

  let currentLanguage = language.value || "en";
  let db = null;
  let productCache = null;
  let busy = false;

  if (window.supabase && typeof window.supabase.createClient === "function") {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  function say(text, type = "bot", extraNode = null) {
    const bubble = document.createElement("div");
    bubble.className = "message " + type;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    bubble.appendChild(paragraph);
    if (extraNode) bubble.appendChild(extraNode);
    const stamp = document.createElement("span");
    stamp.className = "message-time";
    stamp.textContent = type === "bot" ? "LBM Assistant" : "You";
    bubble.appendChild(stamp);
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function t(key) { return (words[currentLanguage] || words.en)[key] || words.en[key] || ""; }
  function normalise(value) {
    if (Array.isArray(value)) return value.map(x => String(x).trim()).filter(Boolean);
    if (value === null || value === undefined || value === "") return [];
    const raw = String(value).trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(x => String(x).trim()).filter(Boolean);
    } catch (_) {}
    return raw.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  }
  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? "K" + n.toLocaleString("en-ZM", {minimumFractionDigits:2, maximumFractionDigits:2}) : "Price on request";
  }
  function productName(p) { return p.name || p.product_name || p.title || "LBM product"; }
  function stockAvailable(p) {
    if (p.is_available === false || p.is_active === false) return false;
    if (p.stock !== undefined && Number(p.stock) <= 0) return false;
    return true;
  }
  async function getProducts() {
    if (productCache) return productCache;
    if (!db) throw new Error("Supabase client unavailable");
    const { data, error } = await db.from("products").select("*").order("created_at", {ascending:false}).limit(200);
    if (error) throw error;
    productCache = (data || []).filter(stockAvailable);
    return productCache;
  }
  function whatsappLink(p) {
    const text = "Hello LBM, I would like to enquire about " + productName(p) + (p.id ? " (Product ID: " + p.id + ")" : "") + ".";
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text);
  }
  function productCards(products) {
    const wrap = document.createElement("div");
    products.forEach(p => {
      const card = document.createElement("article");
      card.className = "product-result";
      const heading = document.createElement("h3");
      heading.textContent = productName(p);
      card.appendChild(heading);
      const price = document.createElement("p");
      price.className = "product-price";
      price.textContent = t("price") + ": " + money(p.price);
      card.appendChild(price);
      const description = document.createElement("p");
      description.textContent = t("description") + ": " + (p.description || t("unavailable"));
      card.appendChild(description);
      const sizes = document.createElement("p");
      sizes.textContent = t("sizes") + ": " + (normalise(p.available_sizes).join(", ") || t("unavailable"));
      card.appendChild(sizes);
      const colours = document.createElement("p");
      colours.textContent = t("colours") + ": " + (normalise(p.available_colours).join(", ") || t("unavailable"));
      card.appendChild(colours);
      const link = document.createElement("a");
      link.className = "product-link";
      link.href = whatsappLink(p);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = t("enquire");
      card.appendChild(link);
      wrap.appendChild(card);
    });
    return wrap;
  }

  function findIntent(text) {
    const q = text.toLowerCase();
    if (/\b(hi|hello|hey|mwaiseni|moni|good morning|good afternoon|good evening)\b/.test(q)) return "greeting";
    if (/\b(help|what can you do|how can you help)\b/.test(q)) return "help";
    if (/\b(all products|show products|view products|available products|catalogue|catalog|ma product)\b/.test(q)) return "all";
    if (/\b(size|sizes|ma size)\b/.test(q)) return "sizes";
    if (/\b(colou?r|colou?rs|ma colour|ma color)\b/.test(q)) return "colours";
    if (/\b(price|cost|how much|ama price)\b/.test(q)) return "price";
    if (/\b(order|buy|purchase|yitanits|order shani)\b/.test(q)) return "order";
    if (/\b(delivery|deliver|shipping|parcel|kutuma)\b/.test(q)) return "delivery";
    if (/\b(payment|pay|mtn|airtel|zamtel|kulipila)\b/.test(q)) return "payment";
    if (/\b(whatsapp|contact|support|talk to|speak to)\b/.test(q)) return "whatsapp";
    return "product";
  }

  async function answer(raw) {
    const query = raw.trim();
    if (!query || busy) return;
    say(query, "user");
    input.value = "";
    const intent = findIntent(query);
    if (intent === "greeting" || intent === "help" || intent === "order" || intent === "delivery" || intent === "payment" || intent === "whatsapp") {
      const key = intent === "greeting" ? "welcome" : intent;
      say(t(key));
      if (intent === "whatsapp") {
        const a = document.createElement("a");
        a.className = "product-link";
        a.href = "https://wa.me/" + WHATSAPP;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "WhatsApp LBM";
        const holder = document.createElement("div");
        holder.appendChild(a);
        messages.lastElementChild.appendChild(holder);
      }
      return;
    }
    if (intent === "sizes" || intent === "colours") {
      const stripped = query.replace(/\b(what|which|are|is|the|available|size|sizes|colour|colours|color|colors|for|of|do|you|have|ma)\b/gi, " ").trim();
      if (stripped.length < 2) { say(t(intent)); return; }
    }
    if (intent === "all" || intent === "sizes" || intent === "colours" || intent === "price" || intent === "product") {
      busy = true;
      if (sendButton) sendButton.disabled = true;
      say(t("loading"));
      try {
        const products = await getProducts();
        let matches = products;
        if (intent !== "all") {
          const queryWords = query.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 1 && !["what","which","show","find","product","products","available","size","sizes","colour","colours","color","colors","price","much","how","the","for","of","is","are","do","you","have","check","tell","me"].includes(x));
          matches = products.filter(p => {
            const haystack = [productName(p), p.description, p.category, p.brand].filter(Boolean).join(" ").toLowerCase();
            return queryWords.length ? queryWords.some(w => haystack.includes(w)) : false;
          });
        }
        if (!matches.length) say(t("none"));
        else {
          say(intent === "all" ? t("all") : t("found"));
          messages.appendChild(productCards(matches.slice(0, intent === "all" ? 20 : 6)));
          messages.scrollTop = messages.scrollHeight;
        }
      } catch (err) {
        console.error("LBM Assistant catalogue error:", err);
        say(t("error"));
      } finally {
        busy = false;
        if (sendButton) sendButton.disabled = false;
      }
      return;
    }
    say(t("help"));
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    answer(input.value);
  });
  document.querySelectorAll(".quick-question").forEach(button => {
    button.addEventListener("click", () => answer(button.dataset.question || button.textContent));
  });
  language.addEventListener("change", () => {
    currentLanguage = words[language.value] ? language.value : "en";
    say(t("language"));
  });
  say(t("welcome"));

  // Expose a safe refresh hook for troubleshooting without granting write access.
  window.LBMTechnicalAssistant = {
    refreshProducts: () => { productCache = null; return getProducts(); }
  };
})();