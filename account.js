/* ============================================================
   MANASWINI ACCOUNT
   Email/password accounts + Google Sign-In + order history.
   ============================================================ */

const GOOGLE_CLIENT_ID =
  "828001323247-j09eo6jfvq0oq25qpae3q82sjn4bpj3a.apps.googleusercontent.com";
const ACCOUNT_KEY = "manaswini_account";
const ACCOUNT_API_URL =
  window.MANASWINI_API_URL ||
  "https://script.google.com/macros/s/AKfycbxhV70YM0H3LYxEj2qI3uxDAVOn0BPPRjnv3_Sd4z3qSpHPqvREQutdSRZssP9ZBk8BWQ/exec";

function accountGet() { try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); } catch (_) { return null; } }
function accountSave(user) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user)); }
function accountClear() { localStorage.removeItem(ACCOUNT_KEY); }
function accountEsc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }

async function accountPost(payload) {
  const response = await fetch(ACCOUNT_API_URL, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(payload)});
  const data = await response.json();
  if (data.status !== "success") throw new Error(data.message || "Account request failed.");
  return data;
}

function afterAccountLogin() {
  renderAccount();
  const params = new URLSearchParams(location.search);
  if (params.get("return") === "checkout") location.href = "../shop/?checkout=1";
}

function renderAccount() {
  const user = accountGet();
  const loggedOut = document.getElementById("accountLoggedOut");
  const loggedIn = document.getElementById("accountLoggedIn");
  if (!loggedOut || !loggedIn) return;
  loggedOut.hidden = !!user;
  loggedIn.hidden = !user;
  if (!user) return;

  document.getElementById("accountGreeting").textContent = `Hello, ${user.fullName || user.username || "there"}.`;
  document.getElementById("profileDetails").innerHTML = `<div class="profile-row"><span>Full Name</span><strong>${accountEsc(user.fullName || "—")}</strong></div><div class="profile-row"><span>Username</span><strong>${accountEsc(user.username || "—")}</strong></div><div class="profile-row"><span>Email</span><strong>${accountEsc(user.email || "—")}</strong></div><div class="profile-row"><span>Mobile</span><strong>${accountEsc(user.phone || "—")}</strong></div>`;

  const address = user.address || user.city || user.state || user.pincode;
  document.getElementById("addressDetails").innerHTML = address ? `<div class="saved-address"><strong>${accountEsc(user.fullName || "Delivery address")}</strong><span>${accountEsc(user.address || "")}</span><span>${accountEsc([user.city,user.state,user.pincode].filter(Boolean).join(", "))}</span><span>${accountEsc(user.phone || "")}</span></div>` : `<div class="empty">No saved address yet.<br><button class="text-btn" id="addAddressInline" type="button">Add an address</button></div>`;

  renderOrders(user);
  renderWishlist();
}

async function renderOrders(user) {
  const box = document.getElementById("myOrders");
  if (!box) return;
  box.innerHTML = '<div class="empty"><span class="spinner"></span> Loading your orders...</div>';
  const local = JSON.parse(localStorage.getItem("manaswini_orders") || "[]");
  try {
    if (!user.sessionToken) throw new Error("No session");
    const data = await accountPost({action:"getMyOrders", sessionToken:user.sessionToken});
    const orders = data.orders || [];
    if (!orders.length && !local.length) { box.innerHTML='<div class="empty">No orders found yet.<br><a class="text-link" href="../shop/">Start shopping →</a></div>'; return; }
    const merged = orders.length ? orders : local.filter(o => !user.email || o.email === user.email).slice().reverse();
    box.innerHTML=merged.map(o=>`<div class="order-row"><div><strong>${accountEsc(o.orderId)}</strong><small>${accountEsc(o.date||"")}</small></div><div><b>₹${Number(o.total||0).toLocaleString("en-IN")}</b><small>${accountEsc(o.status||o.paymentStatus||"Order Placed")}</small></div></div>`).join("");
  } catch (_) {
    const mine = local.filter(o => !user.email || o.email === user.email).slice().reverse();
    box.innerHTML = mine.length ? mine.map(o=>`<div class="order-row"><div><strong>${accountEsc(o.orderId)}</strong><small>${accountEsc(o.date||"")}</small></div><div><b>₹${Number(o.total||0).toLocaleString("en-IN")}</b><small>${accountEsc(o.status||"Order Placed")}</small></div></div>`).join("") : '<div class="empty">Unable to load orders right now.</div>';
  }
}

function renderWishlist() {
  const ids = JSON.parse(localStorage.getItem("manaswini_wishlist") || "[]");
  const box = document.getElementById("wishlistDetails");
  if (!box) return;
  if (!ids.length) { box.innerHTML = `<div class="empty">Your wishlist is empty.<br><a class="text-link" href="../shop/">Explore products →</a></div>`; return; }
  const products = (window.state?.products || []).filter(p => ids.includes(String(p.ProductID)));
  box.innerHTML = products.length ? products.map(p => `<div class="wishlist-row"><span>${accountEsc(p.ProductName)}</span><strong>₹${Number(p.Price||0).toLocaleString("en-IN")}</strong></div>`).join("") : `<div class="empty">Your saved favourites will appear here.</div>`;
}

function setupGoogle() {
  const fallback = document.getElementById("googleFallback");
  const help = document.getElementById("googleHelp");
  if (!fallback) return;
  if (GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
    fallback.addEventListener("click", () => alert("Google Sign-In needs your Google OAuth Client ID in account.js. Email/username account creation and login are already available."));
    return;
  }
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true; script.defer = true;
  script.onload = () => {
    fallback.hidden = true; help.hidden = true;
    google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID, callback:handleGoogleCredential});
    google.accounts.id.renderButton(document.getElementById("googleSignInButton"), {theme:"outline", size:"large", shape:"pill", width:360, text:"continue_with"});
  };
  document.head.appendChild(script);
}

function decodeJwt(token) {
  try { const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(decodeURIComponent(atob(payload).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''))); } catch (_) { return null; }
}

async function handleGoogleCredential(response) {
  const data=decodeJwt(response.credential);
  if (!data || !data.email) { alert("Google sign-in could not be completed."); return; }
  try {
    const result=await accountPost({action:"googleLogin", idToken:response.credential});
    accountSave({...result.user, provider:"google", sessionToken:result.sessionToken});
    afterAccountLogin();
  } catch(error) { alert(error.message || "Google sign-in failed."); }
}

async function handleSignup(event) {
  event.preventDefault();
  const message=document.getElementById("signupMessage");
  const data=Object.fromEntries(new FormData(event.target).entries());
  message.textContent="Creating your account...";
  try {
    const result=await accountPost({action:"emailSignup", fullName:data.fullName, username:data.username, email:data.email, phone:data.phone, password:data.password});
    accountSave({...result.user, provider:"email", sessionToken:result.sessionToken});
    event.target.reset();
    message.textContent="Account created successfully.";
    afterAccountLogin();
  } catch(error) { message.textContent=error.message || "Could not create the account."; }
}

async function handleLogin(event) {
  event.preventDefault();
  const message=document.getElementById("loginMessage");
  const data=Object.fromEntries(new FormData(event.target).entries());
  message.textContent="Signing you in...";
  try {
    const result=await accountPost({action:"emailLogin", identity:data.identity, password:data.password});
    accountSave({...result.user, provider:"email", sessionToken:result.sessionToken});
    event.target.reset();
    message.textContent="Login successful.";
    afterAccountLogin();
  } catch(error) { message.textContent=error.message || "Login failed."; }
}

async function editProfile() {
  const user=accountGet(); if(!user?.sessionToken) return;
  const name=prompt('Full name:',user.fullName||''); if(name===null)return;
  const phone=prompt('Mobile number:',user.phone||''); if(phone===null)return;
  const updated={...user,fullName:name.trim(),phone:phone.trim()};
  try { const result=await accountPost({action:"saveProfile",sessionToken:user.sessionToken,profile:{fullName:updated.fullName,phone:updated.phone,address:user.address||"",city:user.city||"",state:user.state||"Telangana",pincode:user.pincode||"",username:user.username||""}}); accountSave({...updated,...result.user,sessionToken:user.sessionToken}); renderAccount(); } catch(error){alert(error.message);} 
}

async function editAddress() {
  const user=accountGet(); if(!user?.sessionToken)return;
  const address=prompt('Delivery address:',user.address||''); if(address===null)return;
  const city=prompt('City:',user.city||'Hyderabad'); if(city===null)return;
  const pin=prompt('PIN code:',user.pincode||''); if(pin===null)return;
  const updated={...user,address:address.trim(),city:city.trim(),pincode:pin.trim()};
  try { const result=await accountPost({action:"saveProfile",sessionToken:user.sessionToken,profile:{fullName:user.fullName||"",phone:user.phone||"",address:updated.address,city:updated.city,state:user.state||"Telangana",pincode:updated.pincode,username:user.username||""}}); accountSave({...updated,...result.user,sessionToken:user.sessionToken}); renderAccount(); } catch(error){alert(error.message);} 
}

async function trackAccountOrder(event) {
  event.preventDefault();
  const input=document.getElementById("accountTrackInput"), box=document.getElementById("accountTrackResult");
  const orderId=String(input?.value||"").trim().toUpperCase(); if(!orderId||!box)return;
  box.hidden=false; box.innerHTML='<div class="spinner"></div> Checking your order...';
  try { const response=await fetch(`${ACCOUNT_API_URL}?action=trackOrder&orderId=${encodeURIComponent(orderId)}`,{cache:"no-store"}); const data=await response.json(); if(data.status!=="success"||!data.order)throw new Error(data.message||"Order ID not found."); const o=data.order; box.innerHTML=`<strong>${accountEsc(o.OrderID||orderId)}</strong><div class="account-track-grid"><span>Status</span><b>${accountEsc(o.OrderStatus||"Order Placed")}</b><span>Payment</span><b>${accountEsc(o.PaymentStatus||"Pending")}</b><span>Total</span><b>₹${Number(o.TotalAmount||0).toLocaleString("en-IN")}</b></div>`; } catch(error){box.innerHTML=`<span class="form-message">${accountEsc(error.message||"Unable to track this order.")}</span>`;}
}

document.addEventListener('DOMContentLoaded',()=>{
  renderAccount(); setupGoogle();
  document.getElementById('signupForm')?.addEventListener('submit',handleSignup);
  document.getElementById('loginForm')?.addEventListener('submit',handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click',()=>{accountClear();renderAccount();});
  document.getElementById('editProfileBtn')?.addEventListener('click',editProfile);
  document.getElementById('editAddressBtn')?.addEventListener('click',editAddress);
  document.getElementById('accountTrackForm')?.addEventListener('submit',trackAccountOrder);
});

window.manaswiniAccountGet=accountGet;
