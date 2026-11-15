/* LBM INTERNATIONAL PHONE INPUT — fully independent country and number fields */
(function () {
  "use strict";

  const utilsUrl = "https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/utils.js";
  let utilsPromise;

  function loadUtils() {
    if (!utilsPromise) {
      utilsPromise = new Promise((resolve, reject) => {
        const helper = document.createElement("input");
        const instance = window.intlTelInput(helper, {
          initialCountry: "zm",
          loadUtils: () => import(utilsUrl)
        });
        instance.promise.then(() => {
          const utils = window.intlTelInput?.utils;
          if (!utils) reject(new Error("Phone validation could not be loaded. Please refresh."));
          else resolve(utils);
          instance.destroy();
        }).catch(reject);
      });
    }
    return utilsPromise;
  }

  function attach(input) {
    if (!input) throw new Error("Phone number field was not found.");
    if (!window.intlTelInput) throw new Error("Country list could not be loaded. Refresh and try again.");
    if (input.dataset.lbmPhoneReady === "1") return input._lbmPhoneControl;

    const countries = window.intlTelInput.getCountryData();
    if (!countries?.length) throw new Error("Country list is unavailable. Please refresh.");

    const wrapper = document.createElement("div");
    wrapper.className = "lbm-phone-fields";
    wrapper.style.cssText = "display:grid;grid-template-columns:minmax(125px,38%) minmax(0,1fr);gap:9px;width:100%;align-items:stretch";

    const countrySelect = document.createElement("select");
    countrySelect.className = "lbm-phone-country";
    countrySelect.setAttribute("aria-label", "Country calling code");
    countrySelect.style.cssText = "width:100%;min-width:0;padding:13px 8px;border:1px solid #ccd2da;border-radius:8px;background:#fff;color:#171717;font-size:15px";

    countries.forEach(country => {
      const option = document.createElement("option");
      option.value = country.iso2;
      option.textContent = country.name + " (+" + country.dialCode + ")";
      option.dataset.dialCode = country.dialCode;
      countrySelect.appendChild(option);
    });

    const parent = input.parentNode;
    parent.insertBefore(wrapper, input);
    wrapper.append(countrySelect, input);
    input.style.width = "100%";
    input.style.minWidth = "0";
    input.placeholder = "e.g. 0969034955";
    input.setAttribute("autocomplete", "tel-national");
    input.setAttribute("aria-label", "Phone number without country calling code");

    const zm = countries.find(c => c.iso2 === "zm");
    countrySelect.value = zm ? "zm" : (countries[0]?.iso2 || "");
    const originalStyle = input.getAttribute("style") || "";
    input.dataset.lbmPhoneReady = "1";

    const control = {
      promise: Promise.resolve(),
      getSelectedCountryData() {
        const selected = countries.find(c => c.iso2 === countrySelect.value);
        return selected || {};
      },
      getNumber() { return input.value; },
      isValidNumber() { return true; },
      destroy() {
        wrapper.parentNode?.insertBefore(input, wrapper);
        wrapper.remove();
        input.setAttribute("style", originalStyle);
        delete input.dataset.lbmPhoneReady;
        delete input._lbmPhoneControl;
      },
      countrySelect
    };
    input._lbmPhoneControl = control;
    return control;
  }

  async function getValidNumber(input) {
    const control = attach(input);
    const utils = await loadUtils();
    const country = control.getSelectedCountryData();
    const raw = input.value.trim();

    if (!raw) throw new Error("Enter your phone number.");
    if (raw.startsWith("+") || raw.startsWith("00")) {
      throw new Error("Enter the national phone number only. The country code is already in its own box.");
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) throw new Error("Enter a valid phone number.");

    // Accept the familiar national trunk prefix where the country's numbering
    // plan uses it. intl-tel-input's utilities normalise it to E.164.
    if (!utils.isValidNumber(raw, country.iso2)) {
      throw new Error("Please enter a complete, valid phone number for the selected country.");
    }

    const formatted = utils.formatNumber(raw, country.iso2, utils.numberFormat.E164);
    if (!formatted || !formatted.startsWith("+" + country.dialCode)) {
      throw new Error("We could not verify this number for the selected country. Check the country code and number.");
    }
    return formatted;
  }

  async function promptNumber() {
    return new Promise((resolve, reject) => {
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "border:0;border-radius:16px;padding:24px;width:min(92vw,430px);box-shadow:0 15px 55px #0005";
      dialog.innerHTML = '<h2 style="margin:0 0 8px">Your phone number</h2><p style="color:#666;font-size:14px">Choose your country calling code, then enter your local phone number in the separate box.</p><label for="lbmCheckoutPhone" style="display:block;margin:18px 0 7px;font-weight:bold">Country code and phone number</label><input id="lbmCheckoutPhone" type="tel" autocomplete="tel-national" style="width:100%;padding:13px;border:1px solid #ccc;border-radius:8px;font-size:16px"><p id="lbmPhoneError" style="color:#a21d1d;font-size:13px"></p><div style="display:flex;gap:10px;margin-top:18px"><button type="button" id="lbmPhoneCancel" style="flex:1;padding:12px;border:1px solid #ccc;border-radius:8px;background:white">Cancel</button><button type="button" id="lbmPhoneContinue" style="flex:1;padding:12px;border:0;border-radius:8px;background:#080808;color:#d4af37;font-weight:bold">Continue</button></div>';
      document.body.appendChild(dialog);
      const input = dialog.querySelector("#lbmCheckoutPhone");
      const error = dialog.querySelector("#lbmPhoneError");
      try { attach(input); } catch (e) { dialog.remove(); reject(e); return; }
      dialog.querySelector("#lbmPhoneCancel").onclick = () => { dialog.close(); dialog.remove(); resolve(null); };
      dialog.querySelector("#lbmPhoneContinue").onclick = async () => {
        const btn = dialog.querySelector("#lbmPhoneContinue");
        btn.disabled = true;
        error.textContent = "";
        try {
          const number = await getValidNumber(input);
          dialog.close(); dialog.remove(); resolve(number);
        } catch (e) {
          error.textContent = e.message;
          btn.disabled = false;
        }
      };
      dialog.addEventListener("cancel", () => { dialog.remove(); resolve(null); }, { once: true });
      dialog.showModal();
      input.focus();
    });
  }

  window.LBMPhone = { attach, getValidNumber, promptNumber };
})();