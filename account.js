/* ============================================================
   MANASWINI ACCOUNT
   Google Sign-In UI + local profile fallback.
   For production Google authentication, set GOOGLE_CLIENT_ID and
   deploy the matching Apps Script backend actions.
   ============================================================ */

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const ACCOUNT_KEY = "manaswini_account";
const ACCOUNT_API_URL = window.MANASWINI_API_URL || "https://script.google.com/macros/s/AKfycbwm--c615ozXW6wDPzSq8WLGfwnPbkncyCM8m5dXeUB2GiFYFXuK9jaLzPKmIrAJ-me/exec";

function accountGet() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); }
  catch (_) { return null; }
}
function accountSave(user) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user)); }
function accountClear() { localStorage.removeItem(ACCOUNT_KEY); }

function accountEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
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
  document.getElementById("profileDetails").innerHTML = `
    <div class="profile-row"><span>Full Name</span><strong>${accountEsc(user.fullName || "—")}</strong></div>
    <div class="profile-row"><span>Username</span><strong>${accountEsc(user.username || "—")}</strong></div>
    <div class="profile-row"><span>Email</span><strong>${accountEsc(user.email || "—")}</strong></div>
    <div class="profile-row"><span>Mobile</span><strong>${accountEsc(user.phone || "—")}</strong></div>`;

  const address = user.address || user.city || user.state || user.pincode;
  document.getElementById("addressDetails").innerHTML = address ? `
    <div class="saved-address"><strong>${accountEsc(user.fullName || "Delivery address")}</strong>
    <span>${accountEsc(user.address || "")}</span>
    <span>${accountEsc([user.city,user.state,user.pincode].filter(Boolean).join(", "))}</span>
    <span>${accountEsc(user.phone || "")}</span></div>` : `<div class="empty">No saved address yet.<br><button class="text-btn" id="addAddressInline" type="button">Add an address</button></div>`;

  renderLocalOrders(user);
  if (user.provider === "google" && user.token) loadGoogleOrders(user.token);
  renderWishlist();
}

function renderLocalOrders(user) {
  const orders = JSON.parse(localStorage.getItem("manaswini_orders") || "[]");
  const mine = orders.filter(o => !user.email || o.email === user.email).slice().reverse();
  const box = document.getElementById("myOrders");
  if (!box) return;
  if (!mine.length) {
    box.innerHTML = `<div class="empty">No orders linked to this account yet.<br><a class="text-link" href="shop.html">Start shopping →</a></div>`;
    return;
  }
  box.innerHTML = mine.map(o => `<div class="order-row"><div><strong>${accountEsc(o.orderId)}</strong><small>${accountEsc(o.date || "")}</small></div><div><b>₹${Number(o.total || 0).toLocaleString("en-IN")}</b><small>${accountEsc(o.status || "Order Placed")}</small></div></div>`).join("");
}

function renderWishlist() {
  const ids = JSON.parse(localStorage.getItem("manaswini_wishlist") || "[]");
  const box = document.getElementById("wishlistDetails");
  if (!box) return;
  if (!ids.length) { box.innerHTML = `<div class="empty">Your wishlist is empty.<br><a class="text-link" href="shop.html">Explore products →</a></div>`; return; }
  const products = (window.state?.products || []).filter(p => ids.includes(String(p.ProductID)));
  box.innerHTML = products.length ? products.map(p => `<div class="wishlist-row"><span>${accountEsc(p.ProductName)}</span><strong>₹${Number(p.Price||0).toLocaleString("en-IN")}</strong></div>`).join("") : `<div class="empty">Your saved favourites will appear here.</div>`;
}

function setupGoogle() {
  const fallback = document.getElementById("googleFallback");
  const help = document.getElementById("googleHelp");
  if (!fallback) return;

  if (GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
    fallback.addEventListener("click", () => {
      alert("Google Sign-In is ready in the interface. Add your Google OAuth Client ID in account.js and configure the GitHub Pages URL as an authorized JavaScript origin in Google Cloud.");
    });
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    fallback.hidden = true;
    help.hidden = true;
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    google.accounts.id.renderButton(document.getElementById("googleSignInButton"), { theme: "outline", size: "large", shape: "pill", width: 360, text: "continue_with" });
  };
  document.head.appendChild(script);
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(atob(payload).split('').map(c => '%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch (_) { return null; }
}

async function handleGoogleCredential(response) {
  const data = decodeJwt(response.credential);
  if (!data || !data.email) { alert("Google sign-in could not be completed."); return; }
  const user = {
    userId: data.sub,
    googleId: data.sub,
    email: data.email,
    username: (data.email.split('@')[0] || 'customer').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,30),
    fullName: data.name || data.given_name || '',
    phone: '',
    address: '', city: '', state: 'Telangana', pincode: '',
    photo: data.picture || '',
    provider: 'google',
    token: response.credential
  };
  accountSave(user);
  renderAccount();
  syncGoogleProfile(response.credential);
}

async function syncGoogleProfile(idToken) {
  try {
    const response = await fetch(ACCOUNT_API_URL, {
      method: "POST",
      headers: {"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({action:"googleLogin", idToken})
    });
    const data = await response.json();
    if (data.status === "success" && data.user) {
      const user = accountGet() || {};
      accountSave({...user, ...data.user, token:idToken, provider:"google"});
      renderAccount();
      loadGoogleOrders(idToken);
    }
  } catch (_) {
    // The account remains usable locally if the Apps Script deployment is unavailable.
  }
}

async function loadGoogleOrders(idToken) {
  const box = document.getElementById("myOrders");
  if (!box) return;
  try {
    const response = await fetch(ACCOUNT_API_URL, {
      method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"getMyOrders", idToken})
    });
    const data=await response.json();
    if (data.status !== "success") return;
    const orders=data.orders||[];
    if(!orders.length){ box.innerHTML='<div class="empty">No orders found for this Google account.<br><a class="text-link" href="shop.html">Start shopping →</a></div>'; return; }
    box.innerHTML=orders.map(o=>`<div class="order-row"><div><strong>${accountEsc(o.orderId)}</strong><small>${accountEsc(o.date||"")}</small></div><div><b>₹${Number(o.total||0).toLocaleString("en-IN")}</b><small>${accountEsc(o.status||"Order Placed")}</small></div></div>`).join("");
  } catch (_) {}
}

function handleSignup(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  const existing = accountGet();
  const user = {
    userId: `local-${Date.now()}`,
    email: data.email.trim().toLowerCase(),
    username: data.username.trim(),
    fullName: data.fullName.trim(),
    phone: data.phone.trim(),
    address: '', city: '', state: 'Telangana', pincode: '',
    provider: 'email'
  };
  if (existing && existing.email === user.email) {
    document.getElementById('signupMessage').textContent = 'An account with this email is already signed in on this browser.';
    return;
  }
  // The password is deliberately not stored in localStorage. Production authentication should be handled server-side.
  accountSave(user);
  document.getElementById('signupMessage').textContent = 'Account created on this browser. You can now complete your profile.';
  event.target.reset();
  renderAccount();
}

function handleLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  const user = accountGet();
  if (!user) { document.getElementById('loginMessage').textContent = 'No local account is available. Create an account or use Google Sign-In.'; return; }
  const identity = data.identity.trim().toLowerCase();
  if (identity === String(user.email || '').toLowerCase() || identity === String(user.username || '').toLowerCase()) {
    renderAccount();
  } else {
    document.getElementById('loginMessage').textContent = 'Account not found on this browser.';
  }
}

function editProfile() {
  const user = accountGet(); if (!user) return;
  const name = prompt('Full name:', user.fullName || ''); if (name === null) return;
  const phone = prompt('Mobile number:', user.phone || ''); if (phone === null) return;
  user.fullName = name.trim(); user.phone = phone.trim(); accountSave(user); renderAccount();
}

function editAddress() {
  const user = accountGet(); if (!user) return;
  const address = prompt('Delivery address:', user.address || ''); if (address === null) return;
  const city = prompt('City:', user.city || 'Hyderabad'); if (city === null) return;
  const pin = prompt('PIN code:', user.pincode || ''); if (pin === null) return;
  user.address=address.trim(); user.city=city.trim(); user.pincode=pin.trim(); accountSave(user); renderAccount();
}

document.addEventListener('DOMContentLoaded', () => {
  renderAccount();
  setupGoogle();
  document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', () => { accountClear(); renderAccount(); });
  document.getElementById('editProfileBtn')?.addEventListener('click', editProfile);
  document.getElementById('editAddressBtn')?.addEventListener('click', editAddress);
});
