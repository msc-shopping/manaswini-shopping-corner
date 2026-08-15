/**
 * MANASWINI SHOPPING CORNER - MASTER ENGINE
 * Includes Local + Backend Sync, Auth System, Cart Engine, & Instant Auto-Fill
 */

// 1. EMBEDDED MASTER CATALOG (Guarantees products render instantly offline or online)
const INITIAL_PRODUCTS = [
  {
    ProductID: "MSC001",
    ProductName: "Emerald CZ Floral Bridal Necklace Set",
    Category: "jewellery",
    MRP: 2999,
    Discount: 17,
    Price: 2499,
    MOQ: 1,
    Stock: 10,
    Unit: "set",
    ImageURL: "assets/product-1.png",
    Description: "Gold-plated green hydro stone bridal neckpiece with matching chandelier earrings."
  },
  {
    ProductID: "MSC002",
    ProductName: "Multicolor Peacock Brocade Potli Bags",
    Category: "return-gifts",
    MRP: 100,
    Discount: 25,
    Price: 75,
    MOQ: 10,
    Stock: 200,
    Unit: "piece",
    ImageURL: "assets/product-11.png",
    Description: "Size 7x9 inch drawstring potlis for wedding favors, dry fruits, and Navratri."
  },
  {
    ProductID: "MSC003",
    ProductName: "Handcrafted Painted Peetham with Brass Diya",
    Category: "puja-decor",
    MRP: 699,
    Discount: 28,
    Price: 499,
    MOQ: 2,
    Stock: 30,
    Unit: "set",
    ImageURL: "assets/product-12.png",
    Description: "Traditional painted kolam chowki paired with solid traditional brass oil lamp."
  },
  {
    ProductID: "MSC004",
    ProductName: "Traditional Deity Face Kumkum Tags (Pack of 25)",
    Category: "return-gifts",
    MRP: 50,
    Discount: 30,
    Price: 35,
    MOQ: 25,
    Stock: 500,
    Unit: "piece",
    ImageURL: "assets/product-1.png",
    Description: "Handcrafted deity motif tags with kumkum-pasupu packets for thamboolam favors."
  },
  {
    ProductID: "MSC005",
    ProductName: "Traditional Gold-Plated Long Temple Haar",
    Category: "jewellery",
    MRP: 2499,
    Discount: 24,
    Price: 1899,
    MOQ: 1,
    Stock: 15,
    Unit: "piece",
    ImageURL: "assets/product-11.png",
    Description: "Micro gold plated traditional long necklace with intricate temple finish."
  },
  {
    ProductID: "MSC006",
    ProductName: "Decorated Varalakshmi Goddess Face Mask",
    Category: "puja-decor",
    MRP: 1499,
    Discount: 20,
    Price: 1199,
    MOQ: 1,
    Stock: 20,
    Unit: "piece",
    ImageURL: "assets/product-12.png",
    Description: "Hand-painted and jewel-studded goddess face mask for festive Kalasam decoration."
  }
];

// STATE MANAGEMENT
let liveProducts = [...INITIAL_PRODUCTS];
let cart = JSON.parse(localStorage.getItem('msc_cart') || '[]');
let currentUser = JSON.parse(localStorage.getItem('msc_user') || 'null');
let userOrders = JSON.parse(localStorage.getItem('msc_orders') || '[]');

// PASTE YOUR APPS SCRIPT URL HERE WHEN DEPLOYED
const APPS_SCRIPT_URL = ""; 

document.addEventListener('DOMContentLoaded', () => {
  renderProducts(liveProducts);
  updateCartBadge();
  updateAuthUI();
  fetchBackendProducts();
});

// 2. FETCH LIVE PRODUCTS FROM APPS SCRIPT (IF CONFIGURED)
async function fetchBackendProducts() {
  if (!APPS_SCRIPT_URL) return;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getProducts`);
    const data = await res.json();
    if (data.status === 'success' && data.products && data.products.length > 0) {
      liveProducts = data.products;
      renderProducts(liveProducts);
    }
  } catch (e) {
    console.log("Using cached/embedded catalogue fallback.");
  }
}

// 3. RENDER PRODUCTS TO GRID
function renderProducts(items) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No products found in this category.</p>`;
    return;
  }

  items.forEach(p => {
    const mrp = p.MRP || Math.round(p.Price * 1.25);
    const discount = p.Discount || Math.round(((mrp - p.Price) / mrp) * 100);
    const moq = p.MOQ || 1;

    grid.innerHTML += `
      <div class="product-card">
        <div class="card-img-box">
          <img src="${p.ImageURL}" alt="${p.ProductName}" onerror="this.src='https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&q=80'">
          ${discount > 0 ? `<span class="badge-discount">${discount}% OFF</span>` : ''}
          ${moq > 1 ? `<span class="badge-moq">Min. Order: ${moq} ${p.Unit}s</span>` : ''}
        </div>
        <div class="card-body">
          <h3>${p.ProductName}</h3>
          <p class="desc">${p.Description || ''}</p>
          <div class="price-row">
            <span class="price-current">₹${p.Price}</span>
            <span class="price-mrp">₹${mrp}</span>
          </div>
          <div class="qty-control">
            <label>Quantity:</label>
            <input type="number" id="qty-${p.ProductID}" class="qty-input" value="${moq}" min="${moq}" step="1">
          </div>
          <button class="btn-add-cart" onclick="addToCart('${p.ProductID}')">Add to Cart</button>
        </div>
      </div>
    `;
  });
}

// 4. CATEGORY & SEARCH FILTERS
function filterCategory(cat, btn) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (cat === 'all') {
    renderProducts(liveProducts);
  } else {
    renderProducts(liveProducts.filter(p => p.Category === cat));
  }
}

function searchProducts(query) {
  const q = query.toLowerCase().trim();
  renderProducts(liveProducts.filter(p => 
    p.ProductName.toLowerCase().includes(q) || 
    (p.Description && p.Description.toLowerCase().includes(q))
  ));
}

// 5. CART ENGINE
function addToCart(productId) {
  const p = liveProducts.find(item => item.ProductID === productId);
  if (!p) return;
  const qtyInput = parseInt(document.getElementById(`qty-${productId}`).value) || p.MOQ || 1;
  const quantity = Math.max(qtyInput, p.MOQ || 1);

  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity = quantity;
  } else {
    cart.push({
      productId: p.ProductID,
      productName: p.ProductName,
      price: p.Price,
      quantity: quantity,
      unit: p.Unit || 'piece'
    });
  }

  saveCart();
  openCartModal();
}

function saveCart() {
  localStorage.setItem('msc_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) badge.innerText = totalItems;
}

function openCartModal() {
  renderCartItems();
  document.getElementById('cartModal').classList.add('active');
}

function closeCartModal() {
  document.getElementById('cartModal').classList.remove('active');
}

function renderCartItems() {
  const list = document.getElementById('cartList');
  const subtotalElem = document.getElementById('cartSubtotal');
  const grandTotalElem = document.getElementById('cartGrandTotal');
  if (!list) return;

  list.innerHTML = '';
  let subtotal = 0;

  if (cart.length === 0) {
    list.innerHTML = `<p style="text-align:center; padding:20px; color:#888;">Your cart is empty.</p>`;
    if (subtotalElem) subtotalElem.innerText = '0';
    if (grandTotalElem) grandTotalElem.innerText = '0';
    return;
  }

  cart.forEach((item, idx) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    list.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
        <div>
          <strong style="color:var(--wine-900); font-size:0.9rem;">${item.productName}</strong><br>
          <small style="color:#777;">${item.quantity} &times; ₹${item.price}</small>
        </div>
        <div style="text-align:right;">
          <strong style="color:var(--wine-800);">₹${itemTotal}</strong><br>
          <small><a href="javascript:void(0)" onclick="removeCartItem(${idx})" style="color:#c9184a; text-decoration:none;">Remove</a></small>
        </div>
      </div>
    `;
  });

  const shipping = subtotal >= 3000 ? 0 : 80;
  if (subtotalElem) subtotalElem.innerText = subtotal;
  if (grandTotalElem) grandTotalElem.innerText = subtotal + shipping;

  // Auto-fill checkout fields if user is logged in
  if (currentUser) {
    document.getElementById('orderName').value = currentUser.name || '';
    document.getElementById('orderPhone').value = currentUser.phone || '';
    document.getElementById('orderEmail').value = currentUser.email || '';
    document.getElementById('orderAddress').value = currentUser.address || '';
    document.getElementById('orderCity').value = currentUser.city || '';
    document.getElementById('orderState').value = currentUser.state || '';
    document.getElementById('orderPincode').value = currentUser.pincode || '';
  }
}

function removeCartItem(idx) {
  cart.splice(idx, 1);
  saveCart();
  renderCartItems();
}

// 6. CHECKOUT DISPATCH (Direct to Backend or WhatsApp Fallback)
async function submitOrder(event) {
  event.preventDefault();
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  const customer = {
    name: document.getElementById('orderName').value,
    phone: document.getElementById('orderPhone').value,
    email: document.getElementById('orderEmail').value,
    address: document.getElementById('orderAddress').value,
    city: document.getElementById('orderCity').value,
    state: document.getElementById('orderState').value,
    pincode: document.getElementById('orderPincode').value
  };

  const paymentMode = document.getElementById('orderPaymentMode').value;
  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const shipping = subtotal >= 3000 ? 0 : 80;
  const grandTotal = subtotal + shipping;

  const payload = {
    customer: customer,
    items: cart,
    paymentMode: paymentMode,
    totals: { grandTotal: grandTotal, subtotal: subtotal, shipping: shipping }
  };

  const submitBtn = document.getElementById('orderSubmitBtn');
  submitBtn.innerText = "Processing Order...";
  submitBtn.disabled = true;

  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        recordLocalOrder(data.orderId, payload);
        alert(`🎉 Order Placed Successfully! Your Order ID is ${data.orderId}. Confirmation email sent!`);
        cart = [];
        saveCart();
        closeCartModal();
        return;
      }
    } catch (e) {
      console.log("Backend offline, routing through WhatsApp backup.");
    }
  }

  // Backup WhatsApp Order Forwarding
  const localOrderId = "MSC-" + Date.now().toString().slice(-6);
  recordLocalOrder(localOrderId, payload);
  let msg = `*NEW ORDER: ${localOrderId}*%0A%0A*Customer:* ${customer.name}%0A*Phone:* ${customer.phone}%0A*Address:* ${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}%0A%0A*Items:*%0A`;
  cart.forEach((item, i) => {
    msg += `${i+1}. ${item.productName} (Qty: ${item.quantity}) - ₹${item.price * item.quantity}%0A`;
  });
  msg += `%0A*Total:* ₹${grandTotal} (${paymentMode})`;

  cart = [];
  saveCart();
  closeCartModal();
  window.open(`https://wa.me/919030833667?text=${msg}`, '_blank');
}

function recordLocalOrder(orderId, payload) {
  userOrders.unshift({ orderId, date: new Date().toLocaleDateString(), ...payload });
  localStorage.setItem('msc_orders', JSON.stringify(userOrders));
}

// 7. USER AUTH & ACCOUNT DASHBOARD
function openAuthModal() {
  if (currentUser) {
    openAccountModal();
  } else {
    document.getElementById('authModal').classList.add('active');
  }
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'login') {
    document.getElementById('tabLoginBtn').classList.add('active');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
  } else {
    document.getElementById('tabSignupBtn').classList.add('active');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  currentUser = { name: email.split('@')[0], email: email, phone: "9030833667" };
  localStorage.setItem('msc_user', JSON.stringify(currentUser));
  updateAuthUI();
  closeAuthModal();
  alert(`Welcome back, ${currentUser.name}!`);
}

function handleSignup(e) {
  e.preventDefault();
  currentUser = {
    name: document.getElementById('signupName').value,
    email: document.getElementById('signupEmail').value,
    phone: document.getElementById('signupPhone').value
  };
  localStorage.setItem('msc_user', JSON.stringify(currentUser));
  updateAuthUI();
  closeAuthModal();
  alert(`Account created successfully for ${currentUser.name}!`);
}

function loginWithGoogle() {
  currentUser = {
    name: "Sanjeev Kumar",
    email: "customer@gmail.com",
    phone: "9030833667"
  };
  localStorage.setItem('msc_user', JSON.stringify(currentUser));
  updateAuthUI();
  closeAuthModal();
  alert(`Signed in with Google as ${currentUser.name}!`);
}

function updateAuthUI() {
  const authBtn = document.getElementById('navAuthBtn');
  if (!authBtn) return;
  if (currentUser) {
    authBtn.innerHTML = `👤 ${currentUser.name.split(' ')[0]}`;
  } else {
    authBtn.innerHTML = `👤 Login / Sign Up`;
  }
}

function openAccountModal() {
  document.getElementById('accountName').innerText = currentUser.name;
  document.getElementById('accountEmail').innerText = currentUser.email;
  document.getElementById('accountPhone').innerText = currentUser.phone || 'Not set';

  const orderContainer = document.getElementById('myOrdersList');
  orderContainer.innerHTML = '';
  if (userOrders.length === 0) {
    orderContainer.innerHTML = `<p style="color:#888; font-size:0.85rem;">No orders placed yet.</p>`;
  } else {
    userOrders.forEach(o => {
      orderContainer.innerHTML += `
        <div style="background:#fdfbf7; border:1px solid #ddd; padding:10px; border-radius:6px; margin-bottom:8px;">
          <strong>Order: ${o.orderId}</strong> &bull; ₹${o.totals.grandTotal}<br>
          <small style="color:#666;">Status: Processing &bull; Mode: ${o.paymentMode}</small>
        </div>
      `;
    });
  }

  document.getElementById('accountModal').classList.add('active');
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.remove('active');
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('msc_user');
  updateAuthUI();
  closeAccountModal();
  alert("You have logged out.");
}
