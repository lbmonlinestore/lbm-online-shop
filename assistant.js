
/* =========================================================
   LBM ONLINE SHOP
   TECHNICAL ASSISTANT
   VERSION 1.1 - K0 TEST BUILD

   Features:
   - English, Copperbelt Bemba and Zambian Nyanja
   - Live read-only product lookup from Supabase
   - Product prices, sizes and colours
   - Product-specific size and colour questions
   - WhatsApp customer support
   - Carrier-service delivery information
   - No admin or order-changing permissions
   ========================================================= */


/* =========================================================
   1. CONFIGURATION
   ========================================================= */

const LBM_SUPABASE_URL =
  "https://toovotqrcsulhgdrcsmn.supabase.co";

const LBM_SUPABASE_KEY =
  "sb_publishable_aNXeSFItUW9hhq2iJ19tug_fvrvoXbg";

const LBM_WHATSAPP_NUMBER = "260969034955";

let lbmDatabase = null;

if (window.supabase && window.supabase.createClient) {
  lbmDatabase = window.supabase.createClient(
    LBM_SUPABASE_URL,
    LBM_SUPABASE_KEY
  );
}


/* =========================================================
   2. PAGE ELEMENTS
   ========================================================= */

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const languageSelect =
  document.getElementById("assistantLanguage");

const assistantLauncher =
  document.getElementById("assistantLauncher");

const assistantFloatingPanel =
  document.getElementById("assistantFloatingPanel");

const closeAssistant =
  document.getElementById("closeAssistant");

let currentLanguage = "en";
let cachedProducts = null;


/* =========================================================
   3. APPROVED LANGUAGE LIBRARY
   ========================================================= */

const LBM_MESSAGES = {

  /* ---------------- ENGLISH ---------------- */

  en: {
    welcome:
      "Welcome to LBM Online Shop! How can I help you today?",

    greeting:
      "Hello! Welcome to LBM Online Shop. What would you like to know?",

    help:
      "I can help you find products, check prices, sizes and colours, and understand how to order.",

    products:
      "Let me check the products available in our shop.",

    productsFound:
      "Here are the matching products I found:",

    noProducts:
      "I couldn't find that product. Please try another product name or contact us on WhatsApp.",

    databaseError:
      "I'm having trouble accessing the product catalogue at the moment. Please contact our team on WhatsApp for assistance.",

    ordering:
      "To place an order, identify the product you want and contact our team on WhatsApp to confirm the product and available options.",

    delivery:
      "We send parcels using carrier services. Delivery charges and arrangements may vary. Please contact our team on WhatsApp for the current details.",

    payment:
      "For payment methods and payment instructions, please contact our team on WhatsApp.",

    sizes:
      "I can check the sizes listed for a product. Please tell me the product name.",

    colours:
      "I can check the colours listed for a product. Please tell me the product name.",

    whatsapp:
      "You can speak directly to our LBM customer support team on WhatsApp.",

    unknown:
      "I didn't understand your question. Please try again, or contact our team on WhatsApp.",

    loading:
      "Please wait a moment while I check the product catalogue...",

    empty:
      "No information has been listed for this item.",

    price:
      "Price",

    sizesLabel:
      "Available sizes",

    coloursLabel:
      "Available colours",

    description:
      "Description",

    enquire:
      "Enquire on WhatsApp",

    whatsappButton:
      "Contact LBM on WhatsApp",

    sorry:
      "Sorry about that.",

    tryAgain:
      "Please try again.",

    connectTeam:
      "Let me connect you to our team."
  },


  /* ---------------- BEMBA ---------------- */

  bem: {
    welcome:
      "Mwaiseni ku LBM Online Shop! Bushe kuti namyafwa shani?",

    greeting:
      "Mwaiseni! Ni product nshi mulefwaya?",

    help:
      "Bushe kuti namyafwa shani? Mwingaipusha pa products, ama price, ama sizes, ama colours na ukucita order.",

    products:
      "Lekeni mbone.",

    productsFound:
      "Natukwata.",

    noProducts:
      "Nshisangile ifyo mulefwaya mukwai.",

    databaseError:
      "Ndi na akashishi mu kubona products. Mukwai, tutumineni ku WhatsApp.",

    ordering:
      "Kuti mwafwaya uku order shani? Kuti mwa order ukubomfya WhatsApp.",

    delivery:
      "Tulatuma ama parcel ukubomfya carrier services. Pa ma delivery charges na amalango, mukwai tutumineni ku WhatsApp.",

    payment:
      "Pa nshila sha kulipila, mukwai tutumineni ku WhatsApp.",

    sizes:
      "Ma sizes nshi mukwete? Ndafwaya ishina lya product kuti mbone.",

    colours:
      "Ma colours nshi muk