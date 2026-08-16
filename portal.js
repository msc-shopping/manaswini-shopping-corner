
const MSC_API = "https://script.google.com/macros/s/AKfycbxhV70YM0H3LYxEj2qI3uxDAVOn0BPPRjnv3_Sd4z3qSpHPqvREQutdSRZssP9ZBk8BWQ/exec";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function msg(el,text,type=""){ if(!el)return; el.textContent=text; el.className="portal-message "+type; el.hidden=!text; }
async function post(payload){
  const r=await fetch(MSC_API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
  const d=await r.json(); if(d.status!=="success") throw new Error(d.message||"Request failed."); return d;
}
function getIdToken(){return window.__mscIdToken||"";}

function setupGoogle(clientId, callback){
  if(!clientId || clientId.indexOf("YOUR_GOOGLE")===0) return;
  const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.async=true; s.defer=true;
  s.onload=()=>google.accounts.id.initialize({client_id:clientId,callback:response=>{window.__mscIdToken=response.credential; callback(response.credential);}});
  document.head.appendChild(s);
}
function imageToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        resolve({name:file.name,dataUrl:c.toDataURL("image/jpeg",0.82)});
      };
      img.onerror=()=>reject(new Error("Could not read "+file.name)); img.src=reader.result;
    };
    reader.onerror=()=>reject(new Error("Could not read "+file.name)); reader.readAsDataURL(file);
  });
}

/* Collaborate page */
if(document.body.dataset.portal==="collaborate"){
  $("#sellerApplyForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); const f=new FormData(e.target); const out=$("#applyMessage");
    msg(out,"Submitting application…");
    try{
      const d=await post({action:"sellerApply",application:Object.fromEntries(f.entries())});
      $("#sellerId").textContent=d.sellerId; $("#sellerStatus").textContent=d.applicationStatus;
      $("#applicationSuccess").hidden=false; e.target.reset(); msg(out,"Application submitted successfully.","success");
    }catch(err){msg(out,err.message,"error");}
  });
  $("#statusForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); const f=new FormData(e.target), out=$("#statusMessage"); msg(out,"Checking status…");
    try{
      const d=await post({action:"sellerStatus",email:f.get("email"),sellerId:f.get("sellerId")});
      if(!d.seller){msg(out,"No seller application was found for those details.","error");$("#statusCard").hidden=true;return;}
      $("#statusCard").hidden=false; $("#statusName").textContent=d.seller.businessName||d.seller.fullName;
      $("#statusValue").textContent=d.seller.applicationStatus; $("#statusNote").textContent=d.seller.adminNote||"No note from MSC Admin.";
      msg(out,"Status found.","success");
    }catch(err){msg(out,err.message,"error");}
  });
}

/* Seller page */
if(document.body.dataset.portal==="seller"){
  const clientId=document.body.dataset.googleClientId||"";
  const loginBtn=$("#sellerGoogleLogin");
  setupGoogle(clientId, async token=>{
    msg($("#sellerAuthMessage"),"Signing in…");
    try{
      const d=await post({action:"sellerGetProfile",idToken:token});
      window.__mscSeller=d.seller; $("#sellerAuth").hidden=true; $("#sellerDashboard").hidden=false;
      $("#sellerName").textContent=d.seller.BusinessName||d.seller.FullName; loadSellerData();
      msg($("#sellerAuthMessage"),"Signed in successfully.","success");
    }catch(err){msg($("#sellerAuthMessage"),err.message,"error");}
  });
  loginBtn?.addEventListener("click",()=>{
    if(!clientId || clientId.indexOf("YOUR_GOOGLE")===0){msg($("#sellerAuthMessage"),"Google Client ID is not configured yet. Configure the same OAuth Client ID used by account.js.","error");return;}
    if(window.google?.accounts?.id) google.accounts.id.prompt(); else msg($("#sellerAuthMessage"),"Loading Google sign-in…");
  });

  async function loadSellerData(){
    try{
      const [p,o,pay]=await Promise.all([
        post({action:"sellerGetProducts",idToken:getIdToken()}),
        post({action:"sellerGetOrders",idToken:getIdToken()}),
        post({action:"sellerGetPayouts",idToken:getIdToken()})
      ]);
      renderSellerProducts(p.products||[]); renderSellerOrders(o.orders||[]); renderSellerPayouts(pay.payouts||[]);
    }catch(err){msg($("#sellerDashboardMessage"),err.message,"error");}
  }
  function renderSellerProducts(list){
    $("#sellerProducts").innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.ProductName)}</td><td>${esc(x.Subcategory||x.Category)}</td><td><span class="status status-${String(x.Status).toLowerCase().replace(/\s/g,"-")}">${esc(x.Status)}</span></td><td>${esc(x.AdminNote||"—")}</td></tr>`).join(""):`<tr><td colspan="4">No product submissions yet.</td></tr>`;
  }
  function renderSellerOrders(list){
    $("#sellerOrders").innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.orderId)}</td><td>${esc(x.date)}</td><td>${x.items.map(i=>esc(i.productName)+" × "+i.quantity).join("<br>")}</td><td>₹${Number(x.sellerTotal||0).toFixed(2)}</td><td>${esc(x.status||"—")}</td></tr>`).join(""):`<tr><td colspan="5">No seller orders yet.</td></tr>`;
  }
  function renderSellerPayouts(list){
    $("#sellerPayouts").innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.PayoutID)}</td><td>${esc(x.OrderID)}</td><td>₹${Number(x.SellerAmount||0).toFixed(2)}</td><td>${esc(x.EligibleDate||"—")}</td><td><span class="status">${esc(x.Status||"Pending")}</span></td></tr>`).join(""):`<tr><td colspan="5">No payout records yet.</td></tr>`;
  }

  $("#sellerProductForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); const f=new FormData(e.target), files=[...$("#productImages").files], out=$("#productMessage");
    if(files.length<1){msg(out,"Please upload at least one product image.","error");return;}
    if(files.length>8){msg(out,"Maximum 8 images per product.","error");return;}
    msg(out,"Preparing images and submitting for review…");
    try{
      const images=[]; for(const file of files) images.push(await imageToDataUrl(file));
      const product={}; for(const [k,v] of f.entries()) if(k!=="images") product[k]=v;
      const d=await post({action:"sellerSubmitProduct",idToken:getIdToken(),product,images});
      msg(out,`${d.message} Submission ID: ${d.submissionId}`,"success"); e.target.reset(); loadSellerData();
    }catch(err){msg(out,err.message,"error");}
  });
}

/* Admin page */
if(document.body.dataset.portal==="admin"){
  const clientId=document.body.dataset.googleClientId||"";
  setupGoogle(clientId, async token=>{
    try{const d=await post({action:"adminGetPortalSettings",idToken:token}); window.__mscAdminToken=token; $("#adminAuth").hidden=true;$("#adminDashboard").hidden=false;loadAdmin();}catch(err){msg($("#adminAuthMessage"),err.message,"error");}
  });
  $("#adminGoogleLogin")?.addEventListener("click",()=>{
    if(!clientId || clientId.indexOf("YOUR_GOOGLE")===0){msg($("#adminAuthMessage"),"Google Client ID is not configured.","error");return;}
    if(window.google?.accounts?.id) google.accounts.id.prompt();
  });
  async function adminPost(action,extra={}){return post(Object.assign({action,idToken:window.__mscAdminToken},extra));}
  async function loadAdmin(){
    try{
      const [s,p,settings]=await Promise.all([adminPost("adminGetSellers"),adminPost("adminGetSellerProducts"),adminPost("adminGetPortalSettings")]);
      renderSellers(s.sellers||[]);renderSellerProducts(p.products||[]);renderSettings(settings.settings||{});
    }catch(err){msg($("#adminDashboardMessage"),err.message,"error");}
  }
  function renderSellers(list){
    $("#adminSellers").innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.SellerID)}</td><td><strong>${esc(x.BusinessName)}</strong><br><small>${esc(x.Email)}</small></td><td>${esc(x.Phone)}</td><td><span class="status">${esc(x.Status)}</span></td><td><button class="mini approve" data-seller="${esc(x.SellerID)}" data-decision="Approved">Approve</button><button class="mini reject" data-seller="${esc(x.SellerID)}" data-decision="Rejected">Reject</button></td></tr>`).join(""):`<tr><td colspan="5">No seller applications.</td></tr>`;
    $$("#adminSellers [data-seller]").forEach(b=>b.onclick=async()=>{const note=prompt("Admin note (optional):","");try{await adminPost("adminReviewSeller",{sellerId:b.dataset.seller,decision:b.dataset.decision,note:note||""});loadAdmin();}catch(err){alert(err.message);}});
  }
  function renderSellerProducts(list){
    $("#adminSellerProducts").innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.SubmissionID)}</td><td>${esc(x.SellerID)}</td><td><strong>${esc(x.ProductName)}</strong><br><small>${esc(x.Category)} / ${esc(x.Subcategory)}</small></td><td>₹${Number(x.MRP||0).toFixed(2)}<br>Suggested ₹${Number(x.SuggestedPrice||0).toFixed(2)}</td><td><span class="status">${esc(x.Status)}</span></td><td><button class="mini approve" data-sub="${esc(x.SubmissionID)}" data-decision="Approved">Approve</button><button class="mini reject" data-sub="${esc(x.SubmissionID)}" data-decision="Rejected">Reject</button></td></tr>`).join(""):`<tr><td colspan="6">No seller product submissions.</td></tr>`;
    $$("#adminSellerProducts [data-sub]").forEach(b=>b.onclick=async()=>{
      let price=""; if(b.dataset.decision==="Approved"){price=prompt("Enter ADMIN approved selling price:","");if(price===null)return;}
      const note=prompt("Admin note / rejection reason:","")||"";
      try{await adminPost("adminReviewSellerProduct",{submissionId:b.dataset.sub,decision:b.dataset.decision,approvedPrice:price,note});loadAdmin();}catch(err){alert(err.message);}
    });
  }
  function renderSettings(s){
    $("#returnDays").value=s["Return Period Days"]??"0"; $("#platformFee").value=s["Platform Fee Percent"]??"0";
  }
  $("#settingsForm")?.addEventListener("submit",async e=>{
    e.preventDefault();try{await adminPost("adminSavePortalSettings",{settings:{"Return Period Days":$("#returnDays").value,"Platform Fee Percent":$("#platformFee").value}});msg($("#adminSettingsMessage"),"Settings saved.","success");}catch(err){msg($("#adminSettingsMessage"),err.message,"error");}
  });
}
