/* LBM INTERNATIONAL PHONE INPUT — pinned intl-tel-input 25.3.1 */
(function () {
  "use strict";
  const utils = () => import("https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/utils.js");
  function attach(input) {
    if (!input || !window.intlTelInput) throw new Error("Phone input could not be loaded. Refresh and try again.");
    if (input.dataset.lbmPhoneReady === "1") return window.intlTelInput.getInstance(input);
    const iti = window.intlTelInput(input, {
      initialCountry: "zm",
      nationalMode: true,
      separateDialCode: true,
      formatOnDisplay: true,
      autoPlaceholder: "polite",
      loadUtils: utils
    });
    input.dataset.lbmPhoneReady = "1";
    return iti;
  }
  async function getValidNumber(input) {
    const iti = attach(input);
    await iti.promise;
    if (!input.value.trim() || !iti.isValidNumber()) {
      input.setCustomValidity("Enter a complete, valid phone number for the selected country.");
      input.reportValidity();
      input.setCustomValidity("");
      throw new Error("Please enter a complete, valid phone number.");
    }
    return iti.getNumber();
  }
  async function promptNumber() {
    return new Promise((resolve, reject) => {
      const dialog = document.createElement("dialog");
      dialog.style.cssText = "border:0;border-radius:16px;padding:24px;width:min(92vw,430px);box-shadow:0 15px 55px #0005";
      dialog.innerHTML = '<h2 style="margin:0 0 8px">Your phone number</h2><p style="color:#666;font-size:14px">Choose your country and enter your complete number.</p><label for="lbmCheckoutPhone" style="display:block;margin:18px 0 7px;font-weight:bold">Phone number</label><input id="lbmCheckoutPhone" type="tel" autocomplete="tel" style="width:100%;padding:13px;border:1px solid #ccc;border-radius:8px;font-size:16px"><p id="lbmPhoneError" style="color:#a21d1d;font-size:13px"></p><div style="display:flex;gap:10px;margin-top:18px"><button type="button" id="lbmPhoneCancel" style="flex:1;padding:12px;border:1px solid #ccc;border-radius:8px;background:white">Cancel</button><button type="button" id="lbmPhoneContinue" style="flex:1;padding:12px;border:0;border-radius:8px;background:#080808;color:#d4af37;font-weight:bold">Continue</button></div>';
      document.body.appendChild(dialog);
      const input=dialog.querySelector("#lbmCheckoutPhone"), error=dialog.querySelector("#lbmPhoneError");
      let iti;
      try { iti=attach(input); } catch(e) { dialog.remove(); reject(e); return; }
      dialog.querySelector("#lbmPhoneCancel").onclick=()=>{dialog.close();dialog.remove();resolve(null);};
      dialog.querySelector("#lbmPhoneContinue").onclick=async()=>{
        const btn=dialog.querySelector("#lbmPhoneContinue"); btn.disabled=true; error.textContent="";
        try { const number=await getValidNumber(input); dialog.close();dialog.remove();resolve(number); }
        catch(e){error.textContent=e.message;btn.disabled=false;}
      };
      dialog.addEventListener("cancel",()=>{dialog.remove();resolve(null);},{once:true});
      dialog.showModal(); input.focus();
    });
  }
  window.LBMPhone = {attach, getValidNumber, promptNumber};
})();