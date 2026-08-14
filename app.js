const API_URL = window.MANASWINI_API_URL;
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("manaswini_cart") || "[]"),
  selectedProduct: null,
  modalQty: 1,
  category: "",
  search: "",
  sort: "featured"
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener("DOMContentLoaded", () => {
  $("#year").textContent = new Date().getFullYear();
  bindUI();
  loadProducts();
  renderCart();
});

function bindUI() {
  $("#cartBtn").onclick = openCart;
  $("#closeCart").onclick = closeCart;
  $("#overlay").onclick = closeCart;
  $("#searchBtn").onclick = () => $("#searchPanel").classList.toggle("open");
  $("#searchInput").addEventListener("input", e => { state.search = e.target.value.toLowerCase().trim(); renderProducts(); });
  $("#mobileMenuBtn").onclick = () => $("#mainNav").classList.toggle("open");
  $("#checkoutBtn").onclick = openCheckout;
  $("#whatsappBtn").onclick = orderViaWhatsApp;
  $("#modalMinus").onclick = () => setModalQty(state.modalQty - 1);
  $("#modalPlus").onclick = () => setModalQty(state.modalQty + 1);
  $("#modalAdd").onclick = () => { addToCart(state.selectedProduct, state.modalQty); closeModal("productModal"); openCart(); };
  $("#checkoutForm").onsubmit = submitOrder;
  $("#trackForm").onsubmit = trackOrder;
  $("#categoryFilter").onchange = e => { state.category = e.target.value; renderProducts(); };
  $("#sortFilter").onchange = e => { state.sort = e.target.value; renderProducts(); };
  $$(".category-card").forEach(btn => btn.onclick = () => {
    state.category = btn.dataset.category;
    $("#categoryFilter").value = state.category;
    document.querySelector("#products").scrollIntoView({behavior:"smooth"});
    renderProducts();
  });
  $$(".modal-close").forEach(btn => btn.onclick = () => closeModal(btn.dataset.close));
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}?action=getProducts`, {cache:"no-store"});
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Unable to load products");
    state.products = Array.isArray(data.products) ? data.products : [];
    populateCategories();
    renderProducts();
  } catch (err) {
    $("#loadingState").innerHTML = `<div>Unable to load the collection right now.<br><small>${escapeHtml(err.message)}</small></div>`;
  } finally {
    $("#loadingState").style.display = "none";
  }
}

function populateCategories() {
  const select = $("#categoryFilter");
  const categories = [...new Set(state.products.map(p => String(p.Category || "").trim()).filter(Boolean))].sort();
  select.innerHTML = `<option value="">All categories</option>` + categories.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
  if (state.category) select.value = state.category;
}

function filteredProducts() {
  let list = [...state.products];
  if (state.category) list = list.filter(p => String(p.Category || "") === state.category);
  if (state.search) {
    list = list.filter(p => Object.values(p).join(" ").toLowerCase().includes(state.search));
  }
  if (state.sort === "low") list.sort((a,b) => num(a.Price)-num(b.Price));
  if (state.sort === "high") list.sort((a,b) => num(b.Price)-num(a.Price));
  if (state.sort === "name") list.sort((a,b) => String(a.ProductName||"").localeCompare(String(b.ProductName||"")));
  return list;
}

function renderProducts() {
  const grid = $("#productGrid");
  const list = filteredProducts();
  $("#emptyState").hidden = list.length !== 0;
  grid.innerHTML = list.map(productCard).join("");
  $$(".product-card").forEach(card => {
    const id = card.dataset.id;
    card.onclick = () => openProduct(id);
    const add = card.querySelector("[data-add]");
    if (add) add.onclick = e => { e.stopPropagation(); addToCart(findProduct(id), getMOQ(findProduct(id))); };
  });
}

function getProductImages(p) {

  if (!p) return [];

  // New multiple-image format from Google Apps Script
  if (Array.isArray(p.ImageURLs)) {

    return p.ImageURLs
      .filter(x => x && x.url)
      .map(x => ({
        name: String(x.name || ""),
        url: String(x.url || "")
      }));
  }

  // Backward compatibility with the old ImageURL field
  const oldImage = String(p.ImageURL || "").trim();

  if (oldImage) {
    return [{
      name: "",
      url: oldImage
    }];
  }

  return [];
}

function productCard(p) {

  const price = num(p.Price);
  const mrp = num(p.MRP);
  const moq = getMOQ(p);

  const images = getProductImages(p);
  const img = images.length ? images[0].url : "";

  return `
    <article class="product-card" data-id="${escapeAttr(p.ProductID)}">

      <div class="product-image">

        ${
          img
            ? `
              <img
                class="product-main-image"
                src="${escapeAttr(img)}"
                alt="${escapeAttr(p.ProductName)}"
                loading="lazy"
                onerror="
                  this.style.display='none';
                  this.parentElement.querySelector('.image-placeholder').style.display='flex';
                "
              >

              <div
                class="image-placeholder"
                style="display:none;"
              >M</div>
            `
            : `
              <div class="image-placeholder">M</div>
            `
        }

        ${
          moq > 1
            ? `<span class="badge">MOQ ${moq}</span>`
            : ""
        }

        ${
          images.length > 1
            ? `
              <span class="image-count">
                ${images.length} photos
              </span>

              <div class="product-thumbnails">

                ${images.map((image, index) => `
                  <button
                    type="button"
                    class="product-thumbnail ${index === 0 ? "active" : ""}"
                    data-src="${escapeAttr(image.url)}"
                    onclick="
                      const gallery = this.closest('.product-image');
                      const main = gallery.querySelector('.product-main-image');

                      if (main) {
                        main.src = this.dataset.src;
                        main.style.display = 'block';
                      }

                      gallery
                        .querySelectorAll('.product-thumbnail')
                        .forEach(function(btn) {
                          btn.classList.remove('active');
                        });

                      this.classList.add('active');
                    "
                    aria-label="View image ${index + 1}"
                  >
                    <img
                      src="${escapeAttr(image.url)}"
                      alt="${escapeAttr(p.ProductName)} - image ${index + 1}"
                      loading="lazy"
                    >
                  </button>
                `).join("")}

              </div>
            `
            : ""
        }

      </div>

      <div class="product-info">

        <div class="product-cat">
          ${escapeHtml(p.Category || "Collection")}
        </div>

        <h3 class="product-name">
          ${escapeHtml(p.ProductName || "Product")}
        </h3>

        <div>
          <span class="price">
            ${money(price)}
            ${p.Unit ? ` / ${escapeHtml(p.Unit)}` : ""}
          </span>

          ${
            mrp > price
              ? `<span class="mrp">${money(mrp)}</span>`
              : ""
          }
        </div>

        <div class="moq">
          ${
            moq > 1
              ? `Minimum order: ${moq} ${escapeHtml(p.Unit || "units")}`
              : "Minimum order: 1"
          }
        </div>

        <div class="card-actions">
          <button class="small-btn">View</button>
          <button class="small-btn primary" data-add>Add</button>
        </div>

      </div>

    </article>
  `;
}

function openProduct(id) {
  console.log("NEW openProduct() RUNNING");
  const p = findProduct(id);

  if (!p) return;

  state.selectedProduct = p;
  state.modalQty = getMOQ(p);

  $("#modalCategory").textContent =
    p.Category || "Collection";

  $("#modalName").textContent =
    p.ProductName || "Product";

  $("#modalPrice").textContent =
    `${money(num(p.Price))}${p.Unit ? ` / ${p.Unit}` : ""}`;

  $("#modalMOQ").textContent =
    getMOQ(p) > 1
      ? `Minimum Order: ${getMOQ(p)}`
      : "MOQ: 1";

  $("#modalDescription").textContent =
    p.Description ||
    "Product details will be updated soon.";

  setModalQty(state.modalQty);

  /* ==========================================================
     PRODUCT IMAGES
     ========================================================== */

  const images = getProductImages(p);

  const modalImage = $("#modalImage");

  if (!modalImage) {
    openModal("productModal");
    return;
  }

  if (!images.length) {

    modalImage.innerHTML = `
      <div class="image-placeholder">M</div>
    `;

  } else {

    modalImage.innerHTML = `
      <div class="modal-gallery">

        <div class="modal-main-image">

          <img
            id="modalMainImage"
            src="${escapeAttr(images[0].url)}"
            alt="${escapeAttr(p.ProductName)}"
          >

        </div>

        ${
          images.length > 1
            ? `
              <div class="modal-thumbnails">

                ${images.map((image, index) => `
                  <button
                    type="button"
                    class="modal-thumbnail ${
                      index === 0 ? "active" : ""
                    }"
                    data-image-url="${escapeAttr(image.url)}"
                    aria-label="View image ${index + 1}"
                  >
                    <img
                      src="${escapeAttr(image.url)}"
                      alt="${escapeAttr(
                        p.ProductName
                      )} image ${index + 1}"
                    >
                  </button>
                `).join("")}

              </div>
            `
            : ""
        }

      </div>
    `;

    /* ----------------------------------------------------------
       THUMBNAIL CLICK HANDLING
       ---------------------------------------------------------- */

    const mainImage =
      modalImage.querySelector("#modalMainImage");

    const thumbnails =
      modalImage.querySelectorAll(".modal-thumbnail");

    thumbnails.forEach(function(thumbnail) {

      thumbnail.addEventListener(
        "click",
        function() {

          const newUrl =
            this.getAttribute("data-image-url");

          if (!newUrl || !mainImage) return;

          mainImage.src = newUrl;

          thumbnails.forEach(function(btn) {
            btn.classList.remove("active");
          });

          this.classList.add("active");
        }
      );

    });

  }

  openModal("productModal");
}

function setModalQty(q) {
  const moq = getMOQ(state.selectedProduct || {});
  const stock = num((state.selectedProduct || {}).Stock);
  let value = Math.max(moq, Math.floor(q || moq));
  if (stock > 0) value = Math.min(value, stock);
  state.modalQty = value;
  $("#modalQty").textContent = value;
}

function addToCart(p, quantity = 1) {

  if (!p) return;

  const moq = getMOQ(p);

  let qty =
    Math.max(
      moq,
      Math.floor(quantity)
    );

  const stock = num(p.Stock);

  if (stock > 0) {
    qty = Math.min(qty, stock);
  }

  const existing =
    state.cart.find(
      i => i.productId === String(p.ProductID)
    );

  if (existing) {

    existing.quantity += qty;

  } else {

    const images = getProductImages(p);

    const firstImage =
      images.length
        ? images[0].url
        : "";

    state.cart.push({

      productId:
        String(p.ProductID),

      productName:
        String(p.ProductName),

      quantity:
        qty,

      price:
        num(p.Price),

      unit:
        String(p.Unit || ""),

      imageUrl:
        firstImage

    });
  }

  saveCart();
  renderCart();
}

function changeCart(id, delta) {
  const item = state.cart.find(i => i.productId === id);
  const p = findProduct(id);
  if (!item || !p) return;
  const moq = getMOQ(p);
  item.quantity = Math.max(moq, item.quantity + delta);
  const stock = num(p.Stock);
  if (stock > 0) item.quantity = Math.min(item.quantity, stock);
  saveCart(); renderCart();
}

function removeCart(id) {
  state.cart = state.cart.filter(i => i.productId !== id);
  saveCart(); renderCart();
}

function renderCart() {
  $("#cartCount").textContent = state.cart.reduce((s,i)=>s+i.quantity,0);
  if (!state.cart.length) {
    $("#cartItems").innerHTML = `<div class="empty">Your cart is waiting for something beautiful.</div>`;
    $("#cartSubtotal").textContent = "₹0.00";
    return;
  }
  $("#cartItems").innerHTML = state.cart.map(i => `<div class="cart-item">
    <div class="cart-thumb">${i.imageUrl ? `<img src="${escapeAttr(i.imageUrl)}" alt="">` : "M"}</div>
    <div><h4>${escapeHtml(i.productName)}</h4><p>${money(i.price)}${i.unit ? ` / ${escapeHtml(i.unit)}` : ""}</p>
      <div class="cart-controls"><button onclick="changeCart('${escapeAttr(i.productId)}',-1)">−</button><b>${i.quantity}</b><button onclick="changeCart('${escapeAttr(i.productId)}',1)">+</button><button class="remove" onclick="removeCart('${escapeAttr(i.productId)}')">Remove</button></div>
    </div><strong>${money(i.price*i.quantity)}</strong>
  </div>`).join("");
  $("#cartSubtotal").textContent = money(cartSubtotal());
}

function cartSubtotal() { return state.cart.reduce((s,i)=>s+num(i.price)*i.quantity,0); }
function saveCart() { localStorage.setItem("manaswini_cart", JSON.stringify(state.cart)); }
function findProduct(id) { return state.products.find(p => String(p.ProductID) === String(id)); }
function getMOQ(p) { return Math.max(1, Math.floor(num(p && p.MOQ) || 1)); }
function num(v) { const n=Number(v); return Number.isFinite(n)?n:0; }
function money(v) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(num(v)); }

function openCart() { $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("show"); }
function closeCart() { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("show"); }
function openModal(id) { $("#"+id).classList.add("open"); document.body.style.overflow="hidden"; }
function closeModal(id) { $("#"+id).classList.remove("open"); document.body.style.overflow=""; }

function openCheckout() {
  if (!state.cart.length) { alert("Your cart is empty."); return; }
  closeCart();
  const subtotal = cartSubtotal();
  $("#checkoutSummary").innerHTML = `<div class="summary-row"><span>Items</span><strong>${state.cart.reduce((s,i)=>s+i.quantity,0)}</strong></div><div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-row"><span>Shipping</span><strong>Calculated by store</strong></div><div class="summary-row"><strong>Final amount</strong><strong>Calculated securely by store</strong></div>`;
  $("#checkoutMessage").textContent = "";
  openModal("checkoutModal");
}

async function submitOrder(e) {
  e.preventDefault();
  if (!state.cart.length) return;
  const form = new FormData(e.target);
  const customer = {
    name:String(form.get("name")||"").trim(),
    phone:String(form.get("phone")||"").trim(),
    email:String(form.get("email")||"").trim(),
    address:String(form.get("address")||"").trim(),
    city:String(form.get("city")||"").trim(),
    state:String(form.get("state")||"").trim(),
    pincode:String(form.get("pincode")||"").trim()
  };
  const paymentMode = String(form.get("paymentMode") || "COD");
  const payload = {customer, paymentMode, items:state.cart.map(i=>({productId:i.productId, quantity:i.quantity}))};
  const btn = $("#placeOrderBtn");
  btn.disabled = true; btn.textContent = "Placing order...";
  $("#checkoutMessage").textContent = "";
  try {
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Order could not be placed.");
    state.cart = []; saveCart(); renderCart();
    closeModal("checkoutModal");
    $("#successOrderId").textContent = data.orderId;
    $("#successPayment").textContent = data.paymentStatus + " • Total " + money(data.total);
    openModal("successModal");
    e.target.reset();
  } catch(err) {
    $("#checkoutMessage").textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Place Order";
  }
}

async function trackOrder(e) {
  e.preventDefault();
  const id = $("#trackId").value.trim().toUpperCase();
  const box = $("#trackResult");
  box.hidden = false; box.innerHTML = "Checking order...";
  try {
    const res = await fetch(`${API_URL}?action=trackOrder&orderId=${encodeURIComponent(id)}`, {cache:"no-store"});
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Order not found.");
    const o = data.order;
    box.innerHTML = `<strong>${escapeHtml(o.OrderID || id)}</strong><br>Status: ${escapeHtml(o.OrderStatus || "—")}<br>Payment: ${escapeHtml(o.PaymentStatus || "—")}${o.AWB ? `<br>AWB: ${escapeHtml(o.AWB)}` : ""}${o.TrackingURL ? `<br><a href="${escapeAttr(o.TrackingURL)}" target="_blank" rel="noopener">Open tracking link →</a>` : ""}`;
  } catch(err) { box.innerHTML = `<strong>Unable to find this order.</strong><br>${escapeHtml(err.message)}`; }
}

function orderViaWhatsApp() {
  if (!state.cart.length) { alert("Your cart is empty."); return; }
  const lines = state.cart.map(i => `• ${i.productName} — Qty ${i.quantity} — ${money(i.price*i.quantity)}`).join("\n");
  const msg = `Hello Manaswini Shopping Corner, I would like to place an order:\n\n${lines}\n\nSubtotal: ${money(cartSubtotal())}\n\nPlease confirm availability and shipping.`;
  window.open("https://wa.me/919030833667?text="+encodeURIComponent(msg), "_blank");
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function escapeAttr(v) { return escapeHtml(v); }

window.changeCart = changeCart;
window.removeCart = removeCart;
