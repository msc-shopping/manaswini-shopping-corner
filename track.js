// Track-order page.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#trackForm");
  if (form && typeof window.trackOrder === "function") form.addEventListener("submit", window.trackOrder);
});
