/* LBM PHONE FIELDS v5 — native country selector and independent national-number input */
(function () {
  "use strict";

  const utilsUrl = "https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/utils.js";
  let utilsPromise;

  function loadUtils() {
    if (!utilsPromise) {
      utilsPromise = new Promise((resolve, reject) => {
        if (!window.intlTelInput) {
          reject(new Error("Phone validation library is unavailable. Please refresh and try again."));
          return;
        }
        const helper = document.createElement("input");
        const instance = window.intlTelInput(helper, {
          initialCountry: "zm",
          loadUtils: () => import(utilsUrl)
        });
        instance.promise.then(() => {
          const utils = window.intlTelInput.utils;
          instance.destroy();
          helper.remove();
          if (!utils) reject(new Error("Phone validation could not be loaded. Please refresh."));
          else resolve(utils);
        }).catch(error => {
          instance.destroy();
          helper.remove();
          reject(error);
        });
      });
    }
    return utilsPromise;
  }

  function attach(input) {
    if (!input) throw new Error("Phone number field was not found.");
    if (input.dataset.lbmPhoneReady === "1") return input._lbmPhoneControl;
    if (!window.intlTelInput || !window.intlTelInput.getCountryData) {
      throw new Error("The country list is unavailable. Please refresh the page.");
    }

    // Remove a previously attached international-phone widget if this page was cached
    // with an older version. The replacement controls below are plain HTML elements.
    const previous = window.intlTelInput.getInstance?.(input);
    if (previous) previous.destroy();
    const oldWrapper = input.closest(".iti");
    if (oldWrapper && oldWrapper.parentNode) oldWrapper.parentNode.insertBefore(input, oldWrapper), oldWrapper.remove();

    const countries = window.intlTelInput.getCountryData();
    if (!Array.isArray(countries) || !countries.length) {
      throw new Error("The country list is empty. Please refresh the page.");
    }

    const wrapper = document.createElement("div");
    wrapper.className = "lbm-phone-fields-v5";
    wrapper.style.cssText = "display:grid;grid-template-columns:minmax(145px,42%) minmax(0,1fr);gap:9px;width:100%;align-items:end";

    const countryBox = document.createElement("div");
    const numberBox = document.createElement("div");
    const countryLabel = document.createElement("label");
    const numberLabel = document.createElement("label");
    countryLabel.textContent = "Country calling code";
    numberLabel.textContent = "Phone number";
    countryLabel.style.cssText = numberLabel.style.cssText = "display:block;font-size:13px;font-weight:700;margin:0 0 7px";
    const select = document.createElement("select");
    select.className = "lbm-phone-country-v5";
    select.setAttribute("aria-label", "Country calling code");
    select.style.cssText = "width:100%;min-width:0;min-height:48px;padding:10px 8px;border:1px solid #ccd2da;border-radius:8px;background:#fff;color:#171717;font-size:14px";
    countries.forEach(country => {
      const option = document.createElement("option");
      option.value = country.iso2;
      option.textContent = country.name + " (+" + country.dialCode + ")";
      option.dataset.dialCode = country.dialCode;
      select.appendChild(option);
    });

    const originalStyle = input.getAttribute("style");
    const parent = input.parentNode;
    parent.insertBefore(wrapper, input);
    wrapper.append(countryBox, numberBox);
    countryBox.append(countryLabel, select);
    numberBox.append(numberLabel, input);
    input.style.cssText = "width:100%;min-width:0;min-height:48px;padding:10px 12px;border:1px solid #ccd2da;border-radius:8px;font-size:16px;box-sizing:border-box";
    input.type = "tel";
    input.placeholder = "e.g. 0969034955";
    input.autocomplete = "tel-national";
    input.inputMode = "tel";
    input.setAttribute("aria-label", "Phone number without country calling code");
    input.removeAttribute("data-intl-tel-input-id");

    select.value = countries.some(c => c.iso2 === "zm") ? "zm" : countries[0].iso2;
    input.dataset.lbmPhoneReady = "1";

    const control = {
      promise: Promise.resolve(),
      countrySelect: select,
      getSelectedCountryData() {
        return countries.find(c => c.iso2 === select.value) || {};
      },
      getNumber() { return input.value; },
      isValidNumber() { return true; },
      destroy() {
        if (wrapper.parentNode) wrapper.parentNode.insertBefore(input, wrapper);
        wrapper.remove();
        if (originalStyle === null) input.removeAttribute("style");
        else input.setAttribute("style", originalStyle);
        delete input.dataset.lbmPhoneReady;
        delete input._lbmPhoneControl;
      }
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
    if (/^[+]|^00/.test(raw)) {
      throw new Error("Enter the local phone number only. The country calling code is selected separately.");
    }
    if (!country.iso2 || !country.dialCode) {
      throw new Error("Please select your country calling code.");
    }
    if (!utils.isValidNumber(raw, country.iso2)) {
      throw new Error("Enter a complete, valid phone number for the selected country.");
    }
    const formatted = utils.formatNumber(raw, country.iso2, utils.numberFormat.E164);
    if (!formatted || !formatted.startsWith("+" + country.dialCode)) {
      throw new Error("The number does not match the selected country calling code.");
    }
    return formatted;
  }

  async function promptNumber() {
    return new Promise((resolve, reject) => {
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "border:0;border-radius:16px;padding:24px;width:min(92vw,460px);box-shadow:0 15px 55px #0005";
      dialog.innerHTML = '<h2 style="margin:0 0 8px">Your phone number</h2><p style="color:#666;font-size:14px;line-height:1.5">Select your country calling code in the first box. Enter only your local number in the second box. The two fields do not edit one another.</p><input id="lbmCheckoutPhone" type="tel" style="width:100%;padding:13px;border:1px solid #ccc;border-radius:8px;font-size:16px;box-sizing:border-box"><p id="lbmPhoneError" style="color:#a21d1d;font-size:13px" role="alert"></p><div style="display:flex;gap:10px;margin-top:18px"><button type="button" id="lbmPhoneCancel" style="flex:1;padding:12px;border:1px solid #ccc;border-radius:8px;background:white">Cancel</button><button type="button" id="lbmPhoneContinue" style="flex:1;padding:12px;border:0;border-radius:8px;background:#080808;color:#d4af37;font-weight:bold">Continue</button></div>';
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
          dialog.close();
          dialog.remove();
          resolve(number);
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
