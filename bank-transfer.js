/* LBM BANK TRANSFER CHECKOUT — additive extension to script.js */
(function(){
 "use strict";
 if(window.LBM_BANK_TRANSFER_INSTALLED)return;window.LBM_BANK_TRANSFER_INSTALLED=true;
 const BUCKET="lbm-bank-transfer-receipts";
 const METHODS=["Cash on Delivery","MTN Mobile Money","Airtel Money","Zamtel Kwacha","Bank Transfer"];
 let banks=[],order=null;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const money=v=>"K"+Number(v||0).toLocaleString("en-ZM",{minimumFractionDigits:2,maximumFractionDigits:2});
 const token=()=>window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2);
 function styles(){if($("lbmPayStyles"))return;const s=document.createElement("style");s.id="lbmPayStyles";s.textContent="#lbmPayModal{display:none;position:fixed;inset:0;z-index:100100;background:#000c;padding:14px;align-items:center;justify-content:center}#lbmPayModal.open{display:flex}.lbmPayDialog{background:#fff;color:#171717;border-radius:14px;padding:18px;width:min(560px,100%);max-height:94vh;overflow:auto}.lbmPayHead{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e4d5a7;padding-bottom:12px}.lbmPayHead h2{margin:0;font-size:20px}.lbmPayHead p{margin:5px 0;color:#666;font-size:13px}.lbmPayClose{border:0;border-radius:50%;background:#111;color:#d4af37;width:34px;height:34px;font-size:22px}.lbmPayForm label{display:block;font-weight:700;font-size:13px;margin:11px 0 5px}.lbmPayForm input,.lbmPayForm textarea{box-sizing:border-box;width:100%;padding:11px;border:1px solid #ccc;border-radius:7px;font:14px Arial}.lbmPayMethods{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lbmPayMethods label{border:1px solid #ddd;border-radius:7px;padding:10px;margin:0}.lbmPayMethods input{width:auto}.lbmPayBtn{width:100%;padding:14px;margin-top:14px;background:#111;color:#d4af37;border:0;border-radius:7px;font-weight:800}.lbmPayBtn:disabled{opacity:.5}.lbmPayNote{font-size:12px;color:#666;line-height:1.5}.lbmPayError{background:#fff0f0;color:#a11;padding:10px;margin:10px 0;border-radius:7px}.lbmPaySuccess{background:#edf8ef;color:#176b32;padding:12px;margin:10px 0;border-radius:7px}.lbmBank{border:1px solid #e0d2a7;background:#fffdf7;border-radius:8px;padding:12px;margin:8px 0}.lbmBank p{font-size:13px;margin:5px 0;overflow-wrap:anywhere}.lbmPayRef{padding:12px;background:#171717;color:#d4af37;text-align:center;border-radius:7px;font-weight:bold;margin:12px 0}@media(max-width:420px){.lbmPayDialog{padding:13px}.lbmPayMethods{grid-template-columns:1fr}}";document.head.appendChild(s);}
 function modal(){styles();let m=$("lbmPayModal");if(m)return m;m=document.createElement("div");m.id="lbmPayModal";m.innerHTML='<section class="lbmPayDialog" role="dialog" aria-modal="true"><div class="lbmPayHead"><div><h2 id="lbmPayTitle">Complete your LBM order</h2><p id="lbmPaySub">Choose your payment method.</p></div><button class="lbmPayClose" type="button">×</button></div><div id="lbmPayBody"></div></section>';document.body.appendChild(m);m.querySelector(".lbmPayClose").onclick=close;m.onclick=e=>{if(e.target===m)close();};return m;}
 function close(){const m=$("lbmPayModal");if(m)m.classList.remove("open");order=null;}
 function error(form,msg){let e=form.querySelector(".lbmPayError");if(!e){e=document.createElement("div");e.className="lbmPayError";form.prepend(e);}e.textContent=msg;}
 async function loadBanks(){const r=await supabaseClient.from("lbm_bank_accounts").select("id,bank_name,account_name,account_number,branch,account_type,instructions").eq("is_active",true).order("sort_order").order("bank_name");if(r.error)throw r.error;banks=r.data||[];return banks;}
 function showCheckout(){
  const m=modal(),b=$("lbmPayBody"),total=cart.reduce((s,i)=>s+Number(i.price)*Number(i.quantity),0);
  $("lbmPayTitle").textContent="Complete your LBM order";
  $("lbmPaySub").textContent="Enter your details and choose how you would like to pay.";
  b.innerHTML='<form id="lbmPayDetails" class="lbmPayForm"><label>Full name</label><input id="lbmPayName" required maxlength="120" autocomplete="name"><label>Phone number</label><input id="lbmPayPhone" type="tel" required maxlength="30" autocomplete="tel"><label>Delivery address or pickup location</label><textarea id="lbmPayAddress" required maxlength="500" rows="2"></textarea><label>Payment method</label><div class="lbmPayMethods">'+METHODS.map((v,i)=>'<label><input type="radio" name="lbmPayMethod" value="'+esc(v)+'" '+(i===0?"checked":"")+"> "+esc(v)+"</label>").join("")+'</div><p class="lbmPayNote">Order total: <strong>'+money(total)+'</strong>. Your order is not marked as paid until LBM confirms payment.</p><button class="lbmPayBtn" type="submit">CONTINUE TO ORDER</button></form><details style="margin-top:16px"><summary style="cursor:pointer;font-weight:700">Already placed a Bank Transfer order? Resume it here</summary><form id="lbmPayRecoverForm" class="lbmPayForm"><label>Order number</label><input id="lbmRecoverOrderId" inputmode="numeric" pattern="[0-9]+" required><label>Recovery code</label><input id="lbmRecoverCode" autocomplete="off" required minlength="64" maxlength="64"><label>Phone number used for the order</label><input id="lbmRecoverPhone" type="tel" required maxlength="30"><p class="lbmPayNote">Use the recovery code shown when you created the order. LBM cannot retrieve that code for you.</p><button class="lbmPayBtn" type="submit">RECOVER BANK TRANSFER ORDER</button></form></details>';
  $("lbmPayDetails").onsubmit=submitOrder;
  $("lbmPayRecoverForm").onsubmit=resumeOrder;
  m.classList.add("open");
 }
 function buildItems(){if(!cart.length)throw Error("Your shopping cart is empty.");let total=0;const items=[];for(const line of cart){const p=products.find(x=>String(x.id)===String(line.id));if(!p)throw Error("A product is no longer available. Refresh the shop.");const qty=Number(line.quantity),price=Number(p.price);if(!Number.isInteger(qty)||qty<1||!Number.isFinite(price)||price<=0)throw Error("Invalid product price or quantity.");if(getProductCartQuantity(p.id)>getStock(p))throw Error(p.name+" has insufficient stock.");const size=line.selectedSize||"",colour=line.selectedColour||"",sizes=getProductSizes(p),colours=getProductColours(p);if(sizes.length&&!sizes.includes(size))throw Error("Choose a valid size for "+p.name+".");if(colours.length&&!colours.includes(colour))throw Error("Choose a valid colour for "+p.name+".");const sub=price*qty;total+=sub;items.push({product_id:p.id,name:p.name,price:price,quantity:qty,subtotal:sub,image_url:line.selectedImageUrl||getProductImage(p),image_index:Number(line.selectedImageIndex||0)+1,style:line.style||"Selected picture",selected_size:size||null,selected_colour:colour||null});}return{items,total};}
 function orderId(data){let d=Array.isArray(data)?data[0]:data;if(d&&typeof d==="object")d=d.order_id??d.id??d.place_lbm_order;if(!d)throw Error("The server did not return an order number.");return Number(d);}
 async function submitOrder(e){
  e.preventDefault();
  const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');
  const name=$("lbmPayName").value.trim(),phone=$("lbmPayPhone").value.trim(),address=$("lbmPayAddress").value.trim();
  const method=f.querySelector('input[name="lbmPayMethod"]:checked')?.value;
  if(!name||!phone||!address||!method)return error(f,"Complete all fields and choose a payment method.");
  let o;
  try{o=buildItems();}catch(x){return error(f,x.message);}
  if(method==="Bank Transfer"){
   try{await loadBanks();if(!banks.length)return error(f,"Bank Transfer is unavailable until LBM adds an active bank account.");}
   catch(x){return error(f,"Bank accounts could not be loaded: "+x.message);}
  }
  btn.disabled=true;btn.textContent="SUBMITTING ORDER...";
  const w=method==="Bank Transfer"?null:window.open("about:blank","_blank");
  try{
   let id,bankResult=null;
   if(method==="Bank Transfer"){
    const r=await supabaseClient.rpc("create_lbm_bank_transfer_order",{
     p_customer_name:name,p_phone:phone,p_address:address,p_items:o.items,p_total:o.total
    });
    if(r.error)throw r.error;
    bankResult=r.data;
    if(!bankResult||bankResult.success!==true)throw Error("The secure Bank Transfer order could not be created.");
    id=Number(bankResult.order_id);
    if(!Number.isSafeInteger(id)||id<1||!bankResult.recovery_code)throw Error("The server did not return the order recovery details.");
   }else{
    const r=await supabaseClient.rpc("place_lbm_order",{
     p_customer_name:name,p_phone:phone,p_address:address,p_items:o.items,p_total:o.total,p_payment_method:method
    });
    if(r.error)throw r.error;
    id=orderId(r.data);
   }
   cart=[];saveCart();updateCart();if(cartSection)cartSection.classList.remove("open");
   if(method==="Bank Transfer"){
    order={id:id,phone:phone,total:Number(bankResult.total),reference:bankResult.payment_reference||("LBM-BT-"+String(id).padStart(7,"0")),recoveryCode:bankResult.recovery_code,paymentStatus:"Awaiting Payment",orderStatus:"Pending"};
    showBanks();
   }else{
    const rows=o.items.map(i=>i.name+" — "+i.style+(i.selected_size?", Size: "+i.selected_size:"")+(i.selected_colour?", Colour: "+i.selected_colour:"")+", Qty: "+i.quantity+", Subtotal: "+money(i.subtotal));
    const msg=["NEW LBM ONLINE SHOP ORDER","","ORDER REFERENCE: LBM-"+id,"Customer: "+name,"Phone: "+phone,"Address: "+address,"Payment method: "+method,"","ORDER DETAILS:",...rows,"","TOTAL: "+money(o.total),"",method==="Cash on Delivery"?"Customer requests Cash on Delivery. Please confirm availability and delivery.":"Customer selected "+method+". Please provide official LBM payment instructions and verify payment before processing."].join("\n");
    const url="https://wa.me/"+WHATSAPP_NUMBER+"?text="+encodeURIComponent(msg);
    const m=modal();$("lbmPayTitle").textContent="Order submitted";$("lbmPaySub").textContent="Your reference is LBM-"+id;
    $("lbmPayBody").innerHTML='<div class="lbmPaySuccess">Your order has been recorded. Payment method: <strong>'+esc(method)+'</strong>. Your order is not marked as paid.</div><button id="lbmPayWhatsApp" class="lbmPayBtn" type="button">CONTINUE ON WHATSAPP</button>';
    $("lbmPayWhatsApp").onclick=()=>window.open(url,"_blank","noopener");
    if(w&&!w.closed)w.location.href=url;
   }
  }catch(x){
   if(w&&!w.closed)w.close();
   error(f,x.message||"Order submission failed. Your cart has been preserved.");
  }finally{if(f.isConnected){btn.disabled=false;btn.textContent="CONTINUE TO ORDER";}}
 }
 async function resumeOrder(e){
  e.preventDefault();
  const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');
  const id=Number($("lbmRecoverOrderId").value),code=$("lbmRecoverCode").value.trim(),phone=$("lbmRecoverPhone").value.trim();
  if(!Number.isSafeInteger(id)||id<1||!/^[0-9a-fA-F]{64}$/.test(code)||!phone)return error(f,"Enter the order number, 64-character recovery code and original phone number.");
  btn.disabled=true;btn.textContent="RECOVERING ORDER...";
  try{
   const r=await supabaseClient.rpc("get_lbm_bank_transfer_order_secure",{p_order_id:id,p_recovery_code:code});
   if(r.error)throw r.error;
   const d=r.data;
   if(!d||d.success!==true)throw Error("The order could not be recovered.");
   await loadBanks();
   if(!banks.length)throw Error("No active bank account is currently available. Please contact LBM.");
   order={id:Number(d.order_id),phone:phone,total:Number(d.total),reference:d.payment_reference||("LBM-BT-"+String(d.order_id).padStart(7,"0")),recoveryCode:code,paymentStatus:d.payment_status,orderStatus:d.order_status};
   showBanks();
  }catch(x){error(f,x.message||"Order recovery failed. Check your details and try again.");}
  finally{if(f.isConnected){btn.disabled=false;btn.textContent="RECOVER BANK TRANSFER ORDER";}}
 }
 function showBanks(){
  if(!order)return;
  const m=modal();
  $("lbmPayTitle").textContent="Bank Transfer Instructions";
  $("lbmPaySub").textContent="Transfer the exact amount to one of LBM’s active accounts.";
  let html='<div class="lbmPaySuccess">Order <strong>'+esc(order.reference)+'</strong> has been created. It is not marked as paid until LBM verifies the funds.</div>';
  if(order.recoveryCode){
   html+='<div class="lbmPayRef">YOUR ORDER RECOVERY CODE<br><span style="overflow-wrap:anywhere;display:block;margin:8px 0">'+esc(order.recoveryCode)+'</span><button type="button" id="lbmCopyRecovery" class="lbmPayBtn" style="margin-top:4px">COPY RECOVERY CODE</button></div><p class="lbmPayNote"><strong>Important:</strong> Save this code somewhere safe. You need both this code and your order number to resume receipt submission if you close this page. LBM cannot retrieve the original code for you.</p>';
  }
  html+='<div class="lbmPayRef">PAYMENT REFERENCE<br>'+esc(order.reference)+'</div><p><strong>Order total: '+money(order.total)+'</strong></p>';
  if(String(order.orderStatus||"").toLowerCase()==="cancelled"){
   html+='<div class="lbmPayError">This order has been cancelled. Do not make a transfer.</div>';
  }else if(order.paymentStatus==="Paid"||order.paymentStatus==="Pending Verification"){
   html+='<div class="lbmPaySuccess">Current payment status: <strong>'+esc(order.paymentStatus)+'</strong>. '+(order.paymentStatus==="Paid"?"This order has already been paid.":"Your receipt is awaiting LBM verification.")+'</div>';
  }else{
   if(order.paymentStatus==="Payment Rejected"){
    html+='<div class="lbmPayError">The previous receipt was rejected. Review the administrator note if one was provided, then submit a corrected receipt.</div>';
   }
   html+='<p class="lbmPayNote">Use the payment reference when making the transfer. Then choose the account you paid into and submit your transaction reference and receipt.</p>';
   banks.forEach((b,i)=>{
    html+='<div class="lbmBank"><label><input type="radio" name="lbmBankChoice" value="'+esc(b.id)+'" '+(i===0?"checked":"")+'> <strong>'+esc(b.bank_name)+'</strong></label><p><strong>Account name:</strong> '+esc(b.account_name)+'</p><p><strong>Account number:</strong> '+esc(b.account_number)+'</p><p><strong>Branch:</strong> '+esc(b.branch||"Not specified")+'</p><p><strong>Account type:</strong> '+esc(b.account_type||"Not specified")+'</p>'+(b.instructions?'<p>'+esc(b.instructions)+'</p>':'')+'</div>';
   });
   html+='<form id="lbmPayReceiptForm" class="lbmPayForm"><label>Bank transaction reference</label><input id="lbmPayTxn" required maxlength="120" placeholder="Reference shown by your bank"><label>Amount transferred (ZMW)</label><input id="lbmPayAmount" type="number" min="0.01" step="0.01" required value="'+Number(order.total).toFixed(2)+'"><label>Transfer receipt (JPG, PNG, WEBP or PDF; max 5 MB)</label><input id="lbmPayFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><p class="lbmPayNote">Uploading a receipt does not mean funds are confirmed. LBM will check its bank records.</p><button class="lbmPayBtn" type="submit">SUBMIT PAYMENT FOR VERIFICATION</button></form>';
  }
  $("lbmPayBody").innerHTML=html;
  const copy=$("lbmCopyRecovery");
  if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(order.recoveryCode);copy.textContent="COPIED";}catch(_){copy.textContent="PLEASE COPY THE CODE ABOVE";}};
  const form=$("lbmPayReceiptForm");if(form)form.onsubmit=submitReceipt;
  m.classList.add("open");
 }
 async function submitReceipt(e){e.preventDefault();if(!order)return;const f=e.currentTarget,btn=f.querySelector("button[type=submit]"),bankId=f.querySelector('input[name="lbmBankChoice"]:checked')?.value,txn=$("lbmPayTxn").value.trim(),amount=Number($("lbmPayAmount").value),file=$("lbmPayFile").files[0],types=["image/jpeg","image/png","image/webp","application/pdf"];if(!bankId||!txn||!file)return error(f,"Select a bank, enter the transaction reference and attach the receipt.");if(!types.includes(file.type)||file.size>5242880)return error(f,"Choose a JPG, PNG, WEBP or PDF receipt no larger than 5 MB.");if(amount!==Number(order.total))return error(f,"The amount must match the order total exactly: "+money(order.total));btn.disabled=true;btn.textContent="UPLOADING RECEIPT...";try{const auth=await supabaseClient.rpc("request_lbm_bank_receipt_upload_secure",{p_order_id:order.id,p_recovery_code:order.recoveryCode});if(auth.error)throw auth.error;const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"})[file.type],path=order.id+"/"+auth.data+"."+ext;const up=await supabaseClient.storage.from(BUCKET).upload(path,file,{cacheControl:"0",upsert:false,contentType:file.type});if(up.error)throw up.error;btn.textContent="SUBMITTING FOR VERIFICATION...";const r=await supabaseClient.rpc("submit_lbm_bank_transfer",{p_order_id:order.id,p_phone:order.phone,p_bank_account_id:bankId,p_transaction_reference:txn,p_amount:amount,p_receipt_path:up.data.path});if(r.error)throw r.error;$("lbmPayTitle").textContent="Payment submitted";$("lbmPaySub").textContent="Order "+order.reference;$("lbmPayBody").innerHTML='<div class="lbmPaySuccess"><strong>Payment submitted for verification.</strong><br>Your order remains pending while LBM checks its bank records.</div><div class="lbmPayRef">'+esc(r.data?.payment_reference||order.reference)+'</div><p>Keep your order reference and bank transaction reference.</p><button id="lbmPayDone" class="lbmPayBtn" type="button">DONE</button>';$("lbmPayDone").onclick=close;order=null;}catch(x){error(f,x.message||"Could not submit payment details. Please try again.");}finally{if(f.isConnected){btn.disabled=false;btn.textContent="SUBMIT PAYMENT FOR VERIFICATION";}}}
 function intercept(e){e.preventDefault();e.stopImmediatePropagation();if(!cart.length){alert("Your shopping cart is empty.");return;}showCheckout();}
 function install(){const b=$("checkout-button");if(!b)return;b.addEventListener("click",intercept,true);b.textContent="PROCEED TO CHECKOUT";}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();