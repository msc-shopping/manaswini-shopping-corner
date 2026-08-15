/* ============================================================
   MANASWINI SHOPPING CORNER — FRONTEND APP
   ============================================================ */

const API_URL = "https://script.google.com/macros/s/AKfycbwm--c615ozXW6wDPzSq8WLGfwnPbkncyCM8m5dXeUB2GiFYFXuK9jaLzPKmIrAJ-me/exec";
window.MANASWINI_API_URL = API_URL;
const APP_SCRIPT_ELEMENT = document.currentScript || document.querySelector('script[src*="app.js"]');
const SITE_ROOT = APP_SCRIPT_ELEMENT ? new URL("./", APP_SCRIPT_ELEMENT.src) : new URL("./", location.href);
const LOCAL_CATALOG_URL = new URL("products.json", SITE_ROOT).href;
const PAGE_URLS = {
  home: new URL("./", SITE_ROOT).href,
  categories: new URL("categories/", SITE_ROOT).href,
  shop: new URL("shop/", SITE_ROOT).href,
  about: new URL("about/", SITE_ROOT).href,
  contact: new URL("contact/", SITE_ROOT).href,
  track: new URL("track/", SITE_ROOT).href,
  account: new URL("account/", SITE_ROOT).href
};
function pageUrl(page){ return PAGE_URLS[page] || PAGE_URLS.home; }
const API_TIMEOUT = 5500;

const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("manaswini_cart") || "[]"),
  selectedProduct: null,
  modalQty: 1,
  selectedVariant: null,
  category: "",
  search: "",
  sort: "featured",
  source: "none"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function currentPage() {
  return document.body.dataset.page || "index";
}

function pageName() {
  const map = {
    index: "home",
    categories: "categories",
    shop: "shop",
    about: "about",
    contact: "contact",
    track: "track",
    account: "account"
  };
  return map[currentPage()] || "home";
}

document.addEventListener("DOMContentLoaded", () => {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  bindCommonUI();
  markActiveNavigation();
  renderCart();
  loadProducts();
});

function bindCommonUI() {
  $("#cartBtn")?.addEventListener("click", openCart);
  $("#closeCart")?.addEventListener("click", closeCart);
  $("#overlay")?.addEventListener("click", closeCart);

  $("#mobileMenuBtn")?.addEventListener("click", () => {
    $("#mainNav")?.classList.toggle("open");
  });

  $("#searchBtn")?.addEventListener("click", () => {
    $("#searchPanel")?.classList.toggle("open");
    $("#searchInput")?.focus();
  });

  $("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    if (pageName() === "shop") renderShopProducts();
  });

  $("#checkoutBtn")?.addEventListener("click", openCheckout);
  $("#whatsappBtn")?.addEventListener("click", orderViaWhatsApp);
  $("#checkoutForm")?.addEventListener("submit", submitOrder);
  $("#enquiryForm")?.addEventListener("submit", submitEnquiry);
  $("#trackForm")?.addEventListener("submit", trackOrder);

  $("#modalMinus")?.addEventListener("click", () => setModalQty(state.modalQty - 1));
  $("#modalPlus")?.addEventListener("click", () => setModalQty(state.modalQty + 1));
  $("#modalAdd")?.addEventListener("click", () => {
    if (!state.selectedProduct) return;
    addToCart(state.selectedProduct, state.modalQty, state.selectedVariant);
    closeModal("productModal");
    openCart();
  });

  $$(".modal-close").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  $$('input[name="paymentMode"]').forEach(radio => {
    radio.addEventListener("change", updatePaymentDetails);
  });

  $("#categoryPageFilter")?.addEventListener("change", event => {
    state.category = event.target.value;
    renderCategoryProducts(true);
  });

  $("#categorySortFilter")?.addEventListener("change", event => {
    state.sort = event.target.value;
    renderCategoryProducts(true);
  });

  $("#shopCategoryFilter")?.addEventListener("change", event => {
    state.category = event.target.value;
    renderShopProducts();
  });

  $("#shopSortFilter")?.addEventListener("change", event => {
    state.sort = event.target.value;
    renderShopProducts();
  });

  $("#shopSearchInput")?.addEventListener("input", event => {
    state.search = event.target.value.trim().toLowerCase();
    renderShopProducts();
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeCart();
      $$(".modal.open").forEach(modal => closeModal(modal.id));
    }
  });
}

function markActiveNavigation() {
  const page = pageName();
  $$(".main-nav a").forEach(link => {
    try {
      const target = new URL(link.href, location.href).pathname.replace(/\/+$/, "");
      const current = location.pathname.replace(/\/+$/, "");
      const active = target === current || (page === "home" && (target === "" || target === new URL(PAGE_URLS.home).pathname.replace(/\/+$/, "")));
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
    } catch (_) {}
  });
}

/* ============================================================
   PRODUCT LOADING
   ============================================================ */

async function loadProducts() {
  showLoadingStates(true);

  // Load the local catalog immediately so GitHub Pages never shows
  // an empty product area while the Apps Script endpoint is unavailable.
  try {
    const local = await fetch(LOCAL_CATALOG_URL, { cache: "no-cache" });
    if (!local.ok) throw new Error("Local catalog unavailable");
    const products = await local.json();
    if (Array.isArray(products) && products.length) {
      state.products = products;
      state.source = "local";
      afterProductsLoaded();
      // Local catalogue is already usable: never keep customers waiting for the live API.
      showLoadingStates(false);
    }
  } catch (error) {
    console.warn("Local catalogue failed:", error);
  }

  // Then try the live Google Sheet API. If it succeeds, it replaces the
  // local copy without interrupting the page.
  try {
    const data = await getProductsFromAPI();
    if (data.status !== "success" || !Array.isArray(data.products)) {
      throw new Error(data.message || "Live catalogue returned an invalid response.");
    }

    if (!data.products.length && state.products.length) {
      throw new Error("Live catalogue returned no active products; keeping the saved catalogue.");
    }

    state.products = data.products;
    state.source = "live";
    afterProductsLoaded();
    showLoadingStates(false);
    if (new URLSearchParams(location.search).get("checkout") === "1") {
      history.replaceState({}, "", location.pathname);
      setTimeout(() => openCheckout(), 250);
    }
  } catch (error) {
    console.warn("Live catalogue unavailable:", error);
    if (!state.products.length) {
      showProductLoadError(error.message || "Unable to load products.");
    }
  } finally {
    showLoadingStates(false);
  }
}

async function getProductsFromAPI() {
  // First attempt normal fetch. This works when Apps Script CORS is available.
  try {
    return await fetchJsonWithTimeout(`${API_URL}?action=getProducts`, API_TIMEOUT);
  } catch (error) {
    // JSONP is supported by the updated Apps Script backend and avoids
    // browser CORS restrictions on GitHub Pages.
    return await jsonp(`${API_URL}?action=getProducts`);
  }
}

function fetchJsonWithTimeout(url, timeout) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);
        return response.json();
      })
      .then(resolve)
      .catch(error => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `manaswiniJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The live catalogue could not be reached."));
    }, 7000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("The live catalogue request failed."));
    };

    script.src = `${url}&callback=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
  });
}

function afterProductsLoaded() {
  populateCategories();
  renderHomeProducts();
  renderShopProducts();
  renderCategoryProducts(false);
  reconcileCart();
  renderCart();
}

function showLoadingStates(show) {
  ["#homeLoadingState", "#shopLoadingState", "#categoryCardsLoadingState", "#categoryProductsLoadingState"]
    .forEach(selector => {
      const element = $(selector);
      if (element) {
        element.hidden = !show;
        element.style.display = show ? "" : "none";
      }
    });
}

function showProductLoadError(message) {
  const clean = escapeHtml(message || "Unknown error");
  if ($("#homeLoadingState")) $("#homeLoadingState").innerHTML = `<span class="status-icon">!</span><span>Unable to load the collection.</span><small>${clean}</small>`;
  if ($("#shopLoadingState")) $("#shopLoadingState").innerHTML = `<span class="status-icon">!</span><span>Unable to load products.</span><small>${clean}</small>`;
  if ($("#categoryCardsLoadingState")) $("#categoryCardsLoadingState").innerHTML = `<span class="status-icon">!</span><span>Unable to load categories.</span><small>${clean}</small>`;
}

function setCatalogNotice(text) {
  $$(".catalog-notice").forEach(el => el.remove());
  if (!text) return;
  [$("#homeProductGrid"), $("#shopProductGrid")].forEach(grid => {
    if (!grid || !grid.parentElement) return;
    const notice = document.createElement("div");
    notice.className = "catalog-notice";
    notice.textContent = text;
    grid.parentElement.insertBefore(notice, grid);
  });
}

/* ============================================================
   CATEGORIES + FILTERS
   ============================================================ */

function populateCategories() {
  const categories = [...new Set(
    state.products.map(product => String(product.Category || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const options = `<option value="">All categories</option>` +
    categories.map(category => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join("");

  ["#shopCategoryFilter", "#categoryPageFilter"].forEach(selector => {
    const select = $(selector);
    if (!select) return;
    select.innerHTML = options;
    select.value = state.category && categories.includes(state.category) ? state.category : "";
  });

  const grid = $("#categoryGrid");
  if (!grid) return;

  const icons = ["✦", "◇", "◌", "❖", "✧", "✺", "◈", "♢"];
  grid.innerHTML = categories.map((category, index) => {
    return `<button type="button" class="category-card" data-category="${escapeAttr(category)}">
      <span class="category-icon">${icons[index % icons.length]}</span>
      <b>${escapeHtml(category)}</b>
      <em>Explore →</em>
    </button>`;
  }).join("") || `<div class="empty">No product categories are available.</div>`;

  grid.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      state.category = card.dataset.category || "";
      state.search = "";
      renderCategorySections();
      document.getElementById("category-section-" + slugify(state.category))?.scrollIntoView({behavior:"smooth", block:"start"});
    });
  });
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderCategorySections() {
  const wrap = $("#categoryProductsByCategory");
  if (!wrap) return;

  const categories = [...new Set(state.products.map(p => String(p.Category || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const visibleCategories = state.category ? categories.filter(c => c === state.category) : categories;

  wrap.innerHTML = visibleCategories.map(category => {
    const list = state.products.filter(p => String(p.Category || "") === category);
    return `<section class="category-product-section" id="category-section-${slugify(category)}">
      <div class="category-product-heading">
        <div><span class="eyebrow">${escapeHtml(category)}</span><h2>${escapeHtml(category)}</h2></div>
        <a class="text-link" href="${pageUrl("shop")}?category=${encodeURIComponent(category)}">View all →</a>
      </div>
      <div class="product-grid">${list.map(productCard).join("")}</div>
    </section>`;
  }).join("");

  const empty = $("#categoryEmptyState");
  if (empty) empty.hidden = visibleCategories.length > 0;
  wrap.querySelectorAll(".product-grid").forEach(attachProductCardEvents);
}

function filteredProducts() {
  let list = [...state.products];

  if (state.category) {
    list = list.filter(product => String(product.Category || "") === state.category);
  }

  if (state.search) {
    list = list.filter(product => Object.values(product).join(" ").toLowerCase().includes(state.search));
  }

  if (state.sort === "low") list.sort((a, b) => num(a.Price) - num(b.Price));
  if (state.sort === "high") list.sort((a, b) => num(b.Price) - num(a.Price));
  if (state.sort === "name") list.sort((a, b) => String(a.ProductName || "").localeCompare(String(b.ProductName || "")));

  return list;
}

function renderHomeProducts() {
  const grid = $("#homeProductGrid");
  if (!grid) return;

  const list = state.products.slice(0, 8);
  $("#homeEmptyState")?.toggleAttribute("hidden", list.length > 0);
  grid.innerHTML = list.map(productCard).join("");
  attachProductCardEvents(grid);
}

function renderShopProducts() {
  const grid = $("#shopProductGrid");
  if (!grid) return;

  const list = filteredProducts();
  $("#shopEmptyState")?.toggleAttribute("hidden", list.length > 0);
  grid.innerHTML = list.map(productCard).join("");
  attachProductCardEvents(grid);
}

function renderCategoryProducts() {
  renderCategorySections();
}

function attachProductCardEvents(grid) {
  grid.querySelectorAll(".product-main-image").forEach(img => {
    img.dataset.fallbackTried = "0";
    img.addEventListener("error", () => {
      const original = img.dataset.originalUrl || img.src;
      const idMatch = original.match(/[?&]id=([A-Za-z0-9_-]+)/);
      const tried = Number(img.dataset.fallbackTried || 0);
      if (idMatch && tried === 0) {
        img.dataset.fallbackTried = "1";
        img.src = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
        return;
      }
      if (idMatch && tried === 1) {
        img.dataset.fallbackTried = "2";
        img.src = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
        return;
      }
      img.hidden = true;
      const fallback = img.parentElement?.querySelector(".fallback-placeholder");
      if (fallback) fallback.hidden = false;
    });
  });
  grid.querySelectorAll(".product-card").forEach(card => {
    const id = card.dataset.id;
    card.addEventListener("click", () => openProduct(id));
    card.querySelector("[data-add]")?.addEventListener("click", event => {
      event.stopPropagation();
      const product = findProduct(id);
      if (product) addToCart(product, getMOQ(product));
    });
  });
}

/* ============================================================
   PRODUCT CARDS + GALLERY
   ============================================================ */

function normalizeImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  // Google Drive image links are converted to the public file-view URL.
  // thumbnailLink is intentionally avoided because Google documents it as
  // short-lived and not intended for direct web-app use.
  const drive = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=[^&]+&)?id=|thumbnail\?id=)([A-Za-z0-9_-]+)/i);
  if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;

  const userContent = value.match(/drive\.usercontent\.google\.com\/(?:download|view)[^?]*\?(?:[^#]*&)?id=([A-Za-z0-9_-]+)/i);
  if (userContent) return `https://drive.google.com/uc?export=view&id=${userContent[1]}`;

  return value;
}

function getProductImages(product) {
  if (!product) return [];
  const found = [];
  if (Array.isArray(product.ImageURLs)) {
    product.ImageURLs.forEach(image => {
      const url = normalizeImageUrl(image && (image.url || image.URL));
      if (url) found.push({name:String(image.name || ""), url});
    });
  }
  const keys = Object.keys(product);
  keys.forEach(key => {
    if (!/(image|photo|picture|img)/i.test(key)) return;
    const value = product[key];
    if (Array.isArray(value)) value.forEach(v => { const url=normalizeImageUrl(v); if(url) found.push({name:key,url}); });
    else {
      const text=String(value||"");
      text.split(/[,\n|]+/).map(normalizeImageUrl).filter(Boolean).forEach(url=>found.push({name:key,url}));
    }
  });
  const primary = normalizeImageUrl(product.ImageURL);
  if (primary) found.unshift({name:"",url:primary});
  return found.filter((item,index,arr)=>arr.findIndex(x=>x.url===item.url)===index);
}

function productCard(product) {
  const price = num(product.Price);
  const mrp = num(product.MRP);
  const moq = getMOQ(product);
  const images = getProductImages(product);
  const image = images[0]?.url || "";

  return `<article class="product-card" data-id="${escapeAttr(product.ProductID)}">
    <div class="product-image">
      ${image
        ? `<img class="product-main-image" src="${escapeAttr(image)}" data-original-url="${escapeAttr(image)}" alt="${escapeAttr(product.ProductName)}" loading="lazy" referrerpolicy="no-referrer">
           <div class="image-placeholder fallback-placeholder" hidden><span>M</span><small>MANASWINI</small></div>`
        : `<div class="image-placeholder"><span>M</span><small>MANASWINI</small></div>`}
      ${moq > 1 ? `<span class="badge">MOQ ${moq}</span>` : ""}

    </div>
    <div class="product-info">
      <div class="product-cat">${escapeHtml(product.Category || "Collection")}</div>
      <h3 class="product-name">${escapeHtml(product.ProductName || "Product")}</h3>
      <div class="price-row"><span class="price">${money(price)}</span>${mrp > price ? `<span class="mrp">${money(mrp)}</span>` : ""}</div>
      <div class="moq">${moq > 1 ? `Minimum order: ${moq} ${escapeHtml(product.Unit || "units")}` : "Ready for single-piece orders"}</div>
      <div class="card-actions"><button type="button" class="small-btn">View details</button><button type="button" class="small-btn primary" data-add>Add to cart</button></div>
    </div>
  </article>`;
}

function openProduct(id) {
  const product = findProduct(id);
  if (!product) return;

  state.selectedProduct = product;
  state.modalQty = getMOQ(product);
  state.selectedVariant = null;

  $("#modalCategory").textContent = product.Category || "Collection";
  $("#modalName").textContent = product.ProductName || "Product";
  $("#modalPrice").textContent = `${money(num(product.Price))}${product.Unit ? ` / ${product.Unit}` : ""}`;
  $("#modalMOQ").textContent = getMOQ(product) > 1 ? `Minimum order: ${getMOQ(product)}` : "MOQ: 1";
  $("#modalDescription").textContent = product.Description || "Product details will be updated soon.";
  setModalQty(state.modalQty);

  const images = getProductImages(product);
  const modalImage = $("#modalImage");

  if (!images.length) {
    modalImage.innerHTML = `<div class="modal-placeholder"><span>M</span><small>MANASWINI</small></div>`;
  } else {
    modalImage.innerHTML = `<div class="modal-gallery">
      <div class="modal-main-image"><img id="modalMainImage" src="${escapeAttr(images[0].url)}" alt="${escapeAttr(product.ProductName)}"><div class="modal-placeholder modal-image-fallback" hidden><span>M</span><small>MANASWINI</small></div></div>
      ${images.length > 1 ? `<div class="modal-thumbnails">${images.map((image, index) => `<button type="button" class="modal-thumbnail ${index === 0 ? "active" : ""}" data-index="${index}"><img src="${escapeAttr(image.url)}" alt="Image ${index + 1}"></button>`).join("")}</div>` : ""}
    </div>`;

    const mainImage = $("#modalMainImage");
    mainImage?.addEventListener("error", () => {
      mainImage.hidden = true;
      $("#modalImage .modal-image-fallback")?.removeAttribute("hidden");
    }, {once:true});
    $$("#modalImage .modal-thumbnail").forEach(button => {
      button.addEventListener("click", () => {
        const image = images[Number(button.dataset.index)];
        if (!image) return;
        mainImage.src = image.url;
        state.selectedVariant = image;
        $$("#modalImage .modal-thumbnail").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
      });
    });
  }

  openModal("productModal");
}

/* ============================================================
   CART
   ============================================================ */

function getMOQ(product) {
  return Math.max(1, Math.floor(num(product?.MOQ) || 1));
}

function addToCart(product, quantity = 1, selectedVariant = null) {
  if (!product) return;

  const moq = getMOQ(product);
  const stock = num(product.Stock);
  let qty = Math.max(moq, Math.floor(quantity || moq));
  if (stock > 0) qty = Math.min(qty, stock);

  const variant = selectedVariant || getProductImages(product)[0] || { name: "", url: "" };
  const cartKey = `${product.ProductID}|${variant.name || variant.url || ""}`;
  const existing = state.cart.find(item => item.cartKey === cartKey);

  if (existing) {
    existing.quantity = Math.min(stock > 0 ? stock : existing.quantity + qty, existing.quantity + qty);
  } else {
    state.cart.push({
      cartKey,
      productId: String(product.ProductID),
      productName: String(product.ProductName),
      quantity: qty,
      price: num(product.Price),
      unit: String(product.Unit || ""),
      variantName: String(variant.name || ""),
      imageUrl: String(variant.url || "")
    });
  }

  saveCart();
  renderCart();
}

function changeCart(cartKey, delta) {
  const item = state.cart.find(entry => entry.cartKey === cartKey);
  const product = item ? findProduct(item.productId) : null;
  if (!item || !product) return;

  const moq = getMOQ(product);
  const stock = num(product.Stock);
  item.quantity = Math.max(moq, item.quantity + delta);
  if (stock > 0) item.quantity = Math.min(item.quantity, stock);
  saveCart();
  renderCart();
}

function removeCart(cartKey) {
  state.cart = state.cart.filter(item => item.cartKey !== cartKey);
  saveCart();
  renderCart();
}

function reconcileCart() {
  if (!state.products.length) return;
  state.cart = state.cart.filter(item => findProduct(item.productId));
  saveCart();
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + num(item.quantity), 0);
  if ($("#cartCount")) $("#cartCount").textContent = count;

  const list = $("#cartItems");
  if (!list) return;

  if (!state.cart.length) {
    list.innerHTML = `<div class="empty cart-empty"><div class="empty-mark">M</div><strong>Your cart is waiting.</strong><span>Add something beautiful to your bag.</span></div>`;
    $("#cartSubtotal") && ($("#cartSubtotal").textContent = "₹0.00");
    return;
  }

  list.innerHTML = state.cart.map(item => `<div class="cart-item">
    <div class="cart-thumb">${item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="">` : `<span>M</span>`}</div>
    <div class="cart-item-info">
      <h4>${escapeHtml(item.productName)}</h4>
      ${item.variantName ? `<p>${escapeHtml(item.variantName)}</p>` : ""}
      <p>${money(item.price)}${item.unit ? ` / ${escapeHtml(item.unit)}` : ""}</p>
      <div class="cart-controls"><button type="button" onclick="changeCart('${escapeAttr(item.cartKey)}',-1)">−</button><b>${item.quantity}</b><button type="button" onclick="changeCart('${escapeAttr(item.cartKey)}',1)">+</button><button class="remove" type="button" onclick="removeCart('${escapeAttr(item.cartKey)}')">Remove</button></div>
    </div>
    <strong>${money(item.price * item.quantity)}</strong>
  </div>`).join("");

  $("#cartSubtotal") && ($("#cartSubtotal").textContent = money(cartSubtotal()));
}

function cartSubtotal() {
  return state.cart.reduce((sum, item) => sum + num(item.price) * num(item.quantity), 0);
}

function saveCart() {
  localStorage.setItem("manaswini_cart", JSON.stringify(state.cart));
}

function openCart() {
  $("#cartDrawer")?.classList.add("open");
  $("#overlay")?.classList.add("show");
}

function closeCart() {
  $("#cartDrawer")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

/* ============================================================
   MODALS + CHECKOUT
   ============================================================ */

function openModal(id) {
  $("#" + id)?.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  $("#" + id)?.classList.remove("open");
  if (!$(".modal.open")) document.body.classList.remove("modal-open");
}

function setModalQty(value) {
  const product = state.selectedProduct || {};
  const moq = getMOQ(product);
  const stock = num(product.Stock);
  let quantity = Math.max(moq, Math.floor(value || moq));
  if (stock > 0) quantity = Math.min(quantity, stock);
  state.modalQty = quantity;
  if ($("#modalQty")) $("#modalQty").textContent = quantity;
}

function getLoggedInAccount() {
  try { return JSON.parse(localStorage.getItem("manaswini_account") || "null"); }
  catch (_) { return null; }
}

function openCheckout() {
  if (!state.cart.length) {
    alert("Your cart is empty.");
    return;
  }

  const account = getLoggedInAccount();
  if (!account || !account.sessionToken) {
    closeCart();
    window.location.href = `${pageUrl("account")}?return=checkout`;
    return;
  }

  closeCart();
  $("#checkoutSummary").innerHTML = `<div class="summary-row"><span>Items</span><strong>${state.cart.reduce((sum, item) => sum + item.quantity, 0)}</strong></div><div class="summary-row"><span>Subtotal</span><strong>${money(cartSubtotal())}</strong></div><div class="summary-row"><span>Shipping</span><strong>Calculated by store</strong></div>`;
  $("#checkoutMessage").textContent = "";
  updatePaymentDetails();
  openModal("checkoutModal");
}

function updatePaymentDetails() {
  const online = document.querySelector('input[name="paymentMode"]:checked')?.value === "ONLINE";
  const box = $("#onlinePaymentDetails");
  if (box) box.hidden = !online;
}

async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.length) return;

  const form = new FormData(event.target);
  const paymentMode = String(form.get("paymentMode") || "COD");
  const paymentReference = String(form.get("paymentReference") || "").trim();

  if (paymentMode === "ONLINE" && !paymentReference) {
    $("#checkoutMessage").textContent = "Please enter the transaction / UTR ID.";
    return;
  }

  const account = getLoggedInAccount();
  if (!account || !account.sessionToken) {
    closeModal("checkoutModal");
    window.location.href = `${pageUrl("account")}?return=checkout`;
    return;
  }

  const payload = {
    authToken: account.sessionToken,
    customer: {
      name: String(form.get("name") || account.fullName || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || account.email || "").trim(),
      address: String(form.get("address") || "").trim(),
      city: String(form.get("city") || "").trim(),
      state: String(form.get("state") || "").trim(),
      pincode: String(form.get("pincode") || "").trim()
    },
    paymentMode,
    paymentReference,
    items: state.cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
  };

  const button = $("#placeOrderBtn");
  button.disabled = true;
  button.textContent = "Placing order…";
  $("#checkoutMessage").textContent = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Order could not be placed.");

    const savedOrders = JSON.parse(localStorage.getItem("manaswini_orders") || "[]");
    savedOrders.push({
      orderId: data.orderId,
      date: new Date().toISOString(),
      total: data.total,
      status: "Order Placed",
      email: account.email
    });
    localStorage.setItem("manaswini_orders", JSON.stringify(savedOrders));

    state.cart = [];
    saveCart();
    renderCart();
    event.target.reset();
    updatePaymentDetails();
    closeModal("checkoutModal");
    $("#successOrderId").textContent = data.orderId;
    $("#successPayment").textContent = `${data.paymentStatus} • Total ${money(data.total)}`;
    openModal("successModal");
  } catch (error) {
    $("#checkoutMessage").textContent = `Order could not be submitted: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Place Order";
  }
}

/* ============================================================
   CONTACT + TRACKING
   ============================================================ */

function submitEnquiry(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const text = `Hello Manaswini Shopping Corner,\n\nEnquiry from: ${form.get("enquiryName") || ""}\nMobile: ${form.get("enquiryPhone") || ""}\nEmail: ${form.get("enquiryEmail") || "Not provided"}\nRequirement: ${form.get("enquirySubject") || "General"}\n\n${form.get("enquiryMessage") || ""}`;
  const box = $("#enquiryMessage");
  if (box) box.textContent = "Opening WhatsApp…";
  window.open(`https://wa.me/919030833667?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  event.target.reset();
  if (box) box.textContent = "Your enquiry is ready to send on WhatsApp.";
}

async function trackOrder(event) {
  event.preventDefault();
  const id = $("#trackId")?.value.trim().toUpperCase();
  const box = $("#trackResult");
  if (!id || !box) return;

  box.hidden = false;
  box.innerHTML = `<div class="track-loading"><span class="spinner"></span> Checking order…</div>`;

  try {
    let data;
    try {
      data = await fetchJsonWithTimeout(`${API_URL}?action=trackOrder&orderId=${encodeURIComponent(id)}`, API_TIMEOUT);
    } catch (error) {
      data = await jsonp(`${API_URL}?action=trackOrder&orderId=${encodeURIComponent(id)}`);
    }

    if (data.status !== "success") throw new Error(data.message || "Order not found.");
    const order = data.order;
    box.innerHTML = `<div class="track-result-grid"><div><span>Order ID</span><strong>${escapeHtml(order.OrderID || id)}</strong></div><div><span>Order status</span><strong>${escapeHtml(order.OrderStatus || "—")}</strong></div><div><span>Payment</span><strong>${escapeHtml(order.PaymentStatus || "—")}</strong></div>${order.AWB ? `<div><span>AWB</span><strong>${escapeHtml(order.AWB)}</strong></div>` : ""}</div>${order.TrackingURL ? `<a class="btn btn-outline" href="${escapeAttr(order.TrackingURL)}" target="_blank" rel="noopener">Open tracking link</a>` : ""}`;
  } catch (error) {
    box.innerHTML = `<strong>Unable to find this order.</strong><br><small>${escapeHtml(error.message)}</small>`;
  }
}

function orderViaWhatsApp() {
  if (!state.cart.length) {
    alert("Your cart is empty.");
    return;
  }

  const lines = state.cart.map(item => `• ${item.productName} — Qty ${item.quantity} — ${money(item.price * item.quantity)}`).join("\n");
  const message = `Hello Manaswini Shopping Corner, I would like to place an order:\n\n${lines}\n\nSubtotal: ${money(cartSubtotal())}\n\nPlease confirm availability and shipping.`;
  window.open(`https://wa.me/919030833667?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

/* ============================================================
   HELPERS + GLOBALS
   ============================================================ */

function findProduct(id) {
  return state.products.find(product => String(product.ProductID) === String(id));
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(num(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

window.state = state;
window.renderHomeProducts = renderHomeProducts;
window.renderShopProducts = renderShopProducts;
window.renderCategoryProducts = renderCategoryProducts;
window.renderCategorySections = renderCategorySections;
window.getProductImages = getProductImages;
window.submitEnquiry = submitEnquiry;
window.trackOrder = trackOrder;
window.closeModal = closeModal;
window.openModal = openModal;
window.changeCart = changeCart;
window.removeCart = removeCart;
