// Home page initialization is handled by app.js.
// This file is intentionally kept page-specific so Home remains independent.
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.renderHomeProducts === "function") window.renderHomeProducts();
});
