

const API_URL = "https://script.google.com/macros/s/AKfycbwm--c615ozXW6wDPzSq8WLGfwnPbkncyCM8m5dXeUB2GiFYFXuK9jaLzPKmIrAJ-me/exec";
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("manaswini_cart") || "[]"),
  selectedProduct: null,
  modalQty: 1,
  selectedImages: {},
  selectedVariant: null,
  category: "",
  search: "",
  sort: "featured",
  categoryPageActive: false
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

document.addEventListener("DOMContentLoaded", () => {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
  bindUI();
  renderCart();
  loadProducts();
});

function bindUI() {
  const cartBtn=$("#cartBtn"), closeCartBtn=$("#closeCart"), overlay=$("#overlay"), searchBtn=$("#searchBtn"), searchInput=$("#searchInput"), mobile=$("#mobileMenuBtn");
  if(cartBtn) cartBtn.onclick=openCart;
  if(closeCartBtn) closeCartBtn.onclick=closeCart;
  if(overlay) overlay.onclick=closeCart;
  if(searchBtn) searchBtn.onclick=()=>$("#searchPanel")?.classList.toggle("open");
  if(searchInput) searchInput.addEventListener("input",e=>{ state.search=e.target.value.toLowerCase().trim(); if($("#shopProductGrid")) renderShopProducts(); else if($("#homeProductGrid")) renderHomeProducts(); });
  if(mobile) mobile.onclick=()=>$("#mainNav")?.classList.toggle("open");
  if($("#checkoutBtn")) $("#checkoutBtn").onclick=openCheckout;
  if($("#whatsappBtn")) $("#whatsappBtn").onclick=orderViaWhatsApp;
  if($("#modalMinus")) $("#modalMinus").onclick=()=>setModalQty(state.modalQty-1);
  if($("#modalPlus")) $("#modalPlus").onclick=()=>setModalQty(state.modalQty+1);
  if($("#modalAdd")) $("#modalAdd").onclick=()=>{ addToCart(state.selectedProduct,state.modalQty,state.selectedVariant); closeModal("productModal"); openCart(); };
  if($("#checkoutForm")) $("#checkoutForm").onsubmit=submitOrder;
  document.querySelectorAll('input[name="paymentMode"]').forEach(r=>r.addEventListener("change",()=>{ const box=$("#onlinePaymentDetails"); if(!box) return; box.hidden=document.querySelector('input[name="paymentMode"]:checked')?.value!=="ONLINE"; }));
  $$(".modal-close").forEach(btn=>btn.onclick=()=>closeModal(btn.dataset.close));
  if($("#enquiryForm")) $("#enquiryForm").onsubmit=submitEnquiry;
  // Clear a category whenever the user opens another top-level page.
  document.querySelectorAll(".main-nav a").forEach(link=>link.addEventListener("click",()=>{ state.category=""; state.categoryPageActive=false; }));
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}?action=getProducts`, {cache:"default"});
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Unable to load products");
    state.products = Array.isArray(data.products) ? data.products : [];
    populateCategories();
    renderHomeProducts();
    renderShopProducts();
    renderCategoryProducts(false);
  } catch (err) {
    if ($("#homeLoadingState")) {
      $("#homeLoadingState").innerHTML = `<div>Unable to load the collection right now.<br><small>${escapeHtml(err.message)}</small></div>`;
    }
    if ($("#shopLoadingState")) {
      $("#shopLoadingState").innerHTML = `<div>Unable to load products right now.<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  } finally {
    if ($("#homeLoadingState")) $("#homeLoadingState").style.display = "none";
    if ($("#shopLoadingState")) $("#shopLoadingState").style.display = "none";
  }
}

function populateCategories() {

  /*
   * Build the category list directly from the Products data.
   * This prevents categories from being missed when a new category
   * is added to the Google Sheet.
   */
  const categories = [...new Set(
    state.products
      .map(p => String(p.Category || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  /* Category filter dropdowns */
  const options =
    `<option value="">All categories</option>` +
    categories
      .map(c =>
        `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`
      )
      .join("");

  ["#shopCategoryFilter", "#categoryPageFilter"].forEach(selector => {
    const select = $(selector);
    if (!select) return;

    select.innerHTML = options;

    if (state.category &&
        categories.includes(state.category)) {
      select.value = state.category;
    } else {
      select.value = "";
    }
  });

  /* Category cards */
  const categoryGrid = $("#categoryGrid");

  if (!categoryGrid) return;

  const icons = ["✦","◇","◌","▱","♢","✺","❖","◈","✧","○"];

  categoryGrid.innerHTML = categories.length
    ? categories.map((category, index) => `
        <button
          type="button"
          class="category-card"
          data-category="${escapeAttr(category)}"
        >
          <span>${icons[index % icons.length]}</span>
          <b>${escapeHtml(category)}</b>
          <small>View ${escapeHtml(category)} products</small>
        </button>
      `).join("")
    : `
      <div class="empty">
        No product categories are available yet.
      </div>
    `;

  /*
   * Bind every dynamically-created category card.
   */
  categoryGrid.querySelectorAll(".category-card").forEach(btn => {

    btn.addEventListener("click", () => {

      const selectedCategory =
        btn.dataset.category || "";

      /*
       * First enter the Categories page with no previous
       * category filter, then apply the newly selected category.
       */
      state.category = selectedCategory;
      state.categoryPageActive = true;

      const filter = $("#categoryPageFilter");
      if (filter) filter.value = selectedCategory;

      renderCategoryProducts();

      setTimeout(() => {

        const area =
          $("#categoryProductsArea");

        if (area) {
          area.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }

      }, 80);

    });

  });
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

function attachProductCardEvents(grid) {
  if (!grid) return;

  grid.querySelectorAll(".product-card").forEach(card => {
    const id = card.dataset.id;
    card.onclick = () => openProduct(id);

    const add = card.querySelector("[data-add]");
    if (add) {
      add.onclick = e => {
        e.stopPropagation();
        addToCart(findProduct(id), getMOQ(findProduct(id)));
      };
    }
  });
}

function renderHomeProducts() {
  const grid = $("#homeProductGrid");
  if (!grid) return;

  /* Home shows a curated preview, not the complete catalogue. */
  const list = filteredProducts().slice(0, 12);
  $("#homeEmptyState").hidden = list.length !== 0;
  grid.innerHTML = list.map(productCard).join("");
  attachProductCardEvents(grid);
}

function renderShopProducts() {
  const grid = $("#shopProductGrid");
  if (!grid) return;

  const list = filteredProducts();
  $("#shopEmptyState").hidden = list.length !== 0;
  grid.innerHTML = list.map(productCard).join("");
  attachProductCardEvents(grid);
}

function renderCategoryProducts(forceShow = false) {
  const grid=$("#categoryProductGrid"), area=$("#categoryProductsArea"), loading=$("#categoryProductsLoadingState"), empty=$("#categoryEmptyState");
  if(!grid || !area) return;
  if(!forceShow && !state.categoryPageActive) { area.hidden=true; grid.innerHTML=""; if(empty) empty.hidden=true; return; }
  area.hidden=false;
  if(!state.products.length){ if(loading) loading.style.display="block"; if(empty) empty.hidden=true; grid.innerHTML=""; return; }
  if(loading) loading.style.display="none";
  const list=filteredProducts();
  const title=$("#categoryPageTitle"); if(title) title.textContent=state.category||"All Products";
  if(empty) empty.hidden=list.length!==0;
  grid.innerHTML=list.map(productCard).join("");
  attachProductCardEvents(grid);
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

  // Backward compatibility with old ImageURL field
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

  const img =
    images.length
      ? images[0].url
      : "";

  return `
    <article class="product-card" data-id="${escapeAttr(p.ProductID)}">

      <div class="product-image">

        ${
          img
            ? `<img
                 src="${escapeAttr(img)}"
                 alt="${escapeAttr(p.ProductName)}"
                 loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
               >
               <div class="image-placeholder" style="display:none;">M</div>`
            : `<div class="image-placeholder">M</div>`
        }

        ${
          moq > 1
            ? `<span class="badge">MOQ ${moq}</span>`
            : ""
        }

        ${
          images.length > 1
            ? `<span class="image-count">${images.length} photos</span>`
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
   PRODUCT IMAGE GALLERY
   ========================================================== */

const images = getProductImages(p);

console.log("Product:", p.ProductID);
console.log("Images:", images);

const modalImage = $("#modalImage");

if (!modalImage) {
  console.error("modalImage element not found.");
  return;
}


/* ----------------------------------------------------------
   REMEMBER PREVIOUSLY SELECTED IMAGE
   ---------------------------------------------------------- */

let selectedIndex = 0;

state.selectedVariant =
  images.length
    ? {
        name: images[0].name,
        url: images[0].url
      }
    : null;


/* ----------------------------------------------------------
   NO IMAGE
   ---------------------------------------------------------- */

if (!images.length) {

  modalImage.innerHTML = `
    <div class="image-placeholder">M</div>
  `;

}


/* ----------------------------------------------------------
   IMAGE GALLERY
   ---------------------------------------------------------- */

else {

  const selectedUrl =
    images[selectedIndex].url;

  modalImage.innerHTML = `

    <div class="modal-gallery">

      <div class="modal-main-image">

        <img
          id="modalMainImage"
          src="${escapeAttr(selectedUrl)}"
          alt="${escapeAttr(
            p.ProductName || "Product"
          )}"
        >

      </div>


      <div class="modal-thumbnails">

        ${images.map(function(image, index) {

          return `

            <button
              type="button"
              class="modal-thumbnail ${
                index === selectedIndex
                  ? "active"
                  : ""
              }"
              data-image-index="${index}"
              data-image-name="${escapeAttr(image.name)}"
              data-image-url="${escapeAttr(image.url)}"
              aria-label="Select ${image.name}"
            >

              <img
                src="${escapeAttr(image.url)}"
                alt="${escapeAttr(
                  p.ProductName || "Product"
                )} - ${index + 1}"
              >

            </button>

          `;

        }).join("")}

      </div>

    </div>

  `;


  /* --------------------------------------------------------
     MAIN IMAGE
     -------------------------------------------------------- */

  const mainImage =
    modalImage.querySelector(
      "#modalMainImage"
    );


  /* --------------------------------------------------------
     THUMBNAILS
     -------------------------------------------------------- */

  const thumbnails =
    modalImage.querySelectorAll(
      ".modal-thumbnail"
    );


  thumbnails.forEach(function(thumbnail) {

    thumbnail.addEventListener(
      "click",
      function() {

        const index =
          parseInt(
            this.getAttribute(
              "data-image-index"
            ),
            10
          );

        if (
          Number.isNaN(index) ||
          !images[index] ||
          !mainImage
        ) {
          return;
        }


        const selected =
          images[index];


        /* --------------------------------------------
           CHANGE LARGE IMAGE
           -------------------------------------------- */

        mainImage.src =
          selected.url;


        /* --------------------------------------------------------
             REMEMBER SELECTED VARIANT FOR CART
             -------------------------------------------------------- */
          
          state.selectedVariant = {
            name: selected.name,
            url: selected.url
          };


        /* --------------------------------------------
           UPDATE ACTIVE THUMBNAIL
           -------------------------------------------- */

        thumbnails.forEach(
          function(button) {

            button.classList.remove(
              "active"
            );

          }
        );


        this.classList.add("active");


      }
    );

  });

}


/* Open modal */

openModal("productModal");

}


/* ============================================================
   PAGE ROUTER
   Only one page-view is visible at a time.
   ============================================================ */

function setModalQty(q) {
  const moq = getMOQ(state.selectedProduct || {});
  const stock = num((state.selectedProduct || {}).Stock);
  let value = Math.max(moq, Math.floor(q || moq));
  if (stock > 0) value = Math.min(value, stock);
  state.modalQty = value;
  $("#modalQty").textContent = value;
}

function addToCart(
  p,
  quantity = 1,
  selectedVariant = null
) {

  if (!p) return;


  const moq =
    getMOQ(p);

  let qty =
    Math.max(
      moq,
      Math.floor(quantity)
    );


  const stock =
    num(p.Stock);

  if (stock > 0) {

    qty =
      Math.min(
        qty,
        stock
      );

  }


  /* --------------------------------------------------------
     SELECTED VARIANT
     -------------------------------------------------------- */

  const variant =
    selectedVariant ||
    (
      getProductImages(p).length
        ? {
            name: getProductImages(p)[0].name,
            url: getProductImages(p)[0].url
          }
        : {
            name: "",
            url: ""
          }
    );


  /*
     IMPORTANT:
     Same product + different variant
     = different cart item
  */

  const variantKey =
    String(p.ProductID) +
    "|" +
    String(variant.name || variant.url || "");


  const existing =
    state.cart.find(
      i => i.cartKey === variantKey
    );


  if (existing) {

    existing.quantity += qty;

  } else {

    state.cart.push({

      cartKey:
        variantKey,

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

      variantName:
        String(variant.name || ""),

      imageUrl:
        String(variant.url || "")

    });

  }


  saveCart();
  renderCart();
}

function changeCart(cartKey, delta) {

  const item =
    state.cart.find(
      i => i.cartKey === cartKey
    );

  if (!item) return;

  const p =
    findProduct(item.productId);

  if (!p) return;
  if (!item || !p) return;
  const moq = getMOQ(p);
  item.quantity = Math.max(moq, item.quantity + delta);
  const stock = num(p.Stock);
  if (stock > 0) item.quantity = Math.min(item.quantity, stock);
  saveCart(); renderCart();
}

function removeCart(cartKey) {

  state.cart =
    state.cart.filter(
      i => i.cartKey !== cartKey
    );

  saveCart();
  renderCart();
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
    <div>
  <h4>${escapeHtml(i.productName)}</h4>

  ${
    i.variantName
      ? `<p>Selected design: ${escapeHtml(i.variantName)}</p>`
      : ""
  }

  <p>
    ${money(i.price)}
    ${i.unit ? ` / ${escapeHtml(i.unit)}` : ""}
  </p>
      <div class="cart-controls"><button onclick="changeCart('${escapeAttr(i.cartKey)}',-1)">−</button><b>${i.quantity}</b><button onclick="changeCart('${escapeAttr(i.cartKey)}',1)">+</button><button class="remove" onclick="removeCart('${escapeAttr(i.cartKey)}')">Remove</button></div>
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
  const paymentReference = String(form.get("paymentReference") || "").trim();
  if (paymentMode === "ONLINE" && !paymentReference) {
    const msg = $("#checkoutMessage"); if(msg) msg.textContent = "Please enter the online payment transaction / UTR ID."; return;
  }
  const payload = {customer, paymentMode, paymentReference, items:state.cart.map(i=>({productId:i.productId, quantity:i.quantity}))};
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


function submitEnquiry(e) {
  e.preventDefault();

  const form = new FormData(e.target);
  const name = String(form.get("enquiryName") || "").trim();
  const phone = String(form.get("enquiryPhone") || "").trim();
  const email = String(form.get("enquiryEmail") || "").trim();
  const subject = String(form.get("enquirySubject") || "").trim();
  const message = String(form.get("enquiryMessage") || "").trim();

  const whatsappText =
    `Hello Manaswini Shopping Corner,\n\n` +
    `Enquiry from: ${name}\n` +
    `Mobile: ${phone}\n` +
    `Email: ${email || "Not provided"}\n` +
    `Requirement: ${subject || "General"}\n\n` +
    `${message}`;

  const box = $("#enquiryMessage");
  if (box) {
    box.textContent = "Opening WhatsApp to send your enquiry...";
  }

  window.open(
    "https://wa.me/919030833667?text=" + encodeURIComponent(whatsappText),
    "_blank",
    "noopener"
  );

  e.target.reset();
  if (box) box.textContent = "Your enquiry is ready to send on WhatsApp.";
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


/* ============================================================
   SAME-TAB SECTION NAVIGATION
   ============================================================ */
(function(){
  const pageLinks = Array.from(document.querySelectorAll("[data-page-link]"));
  if (!pageLinks.length) return;

  function goToSection(id, updateHash){
    const target = document.getElementById(id);
    if (!target) return;
    const header = document.querySelector(".site-header");
    const offset = header ? header.offsetHeight + 10 : 10;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({top: Math.max(0, top), behavior:"smooth"});

    if (updateHash) {
      try { history.replaceState(null, "", "#" + id); } catch(e) {}
    }

    const nav = document.getElementById("mainNav");
    if (nav) nav.classList.remove("open");
  }

  pageLinks.forEach(link => {
    link.addEventListener("click", function(e){
      const id = this.getAttribute("href").replace(/^#/, "");
      if (!document.getElementById(id)) return;
      e.preventDefault();
      goToSection(id, true);
    });
  });

  const sections = pageLinks
    .map(link => document.getElementById(link.dataset.pageLink))
    .filter(Boolean);

  function updateActive(){
    const header = document.querySelector(".site-header");
    const offset = (header ? header.offsetHeight : 0) + 100;
    let current = "home";
    for (const section of sections) {
      if (window.scrollY + offset >= section.offsetTop) current = section.id;
    }
    pageLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.pageLink === current);
    });
  }

  window.addEventListener("scroll", updateActive, {passive:true});
  window.addEventListener("resize", updateActive);
  updateActive();

  const initial = location.hash.replace(/^#/, "");
  if (initial && document.getElementById(initial)) {
    setTimeout(() => goToSection(initial, false), 50);
  }
})();

  
window.state = state;
window.renderHomeProducts = renderHomeProducts;
window.renderShopProducts = renderShopProducts;
window.renderCategoryProducts = renderCategoryProducts;
window.submitEnquiry = submitEnquiry;
window.trackOrder = trackOrder;
window.closeModal = closeModal;
window.openModal = openModal;
