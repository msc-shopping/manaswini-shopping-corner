// Categories page controls. Product data and category cards are loaded by app.js.
document.addEventListener("DOMContentLoaded", () => {
  const filter = document.querySelector("#categoryPageFilter");
  const sort = document.querySelector("#categorySortFilter");
  if (filter) filter.addEventListener("change", e => { window.state.category = e.target.value; window.state.categoryPageActive = true; window.renderCategoryProducts(true); });
  if (sort) sort.addEventListener("change", e => { window.state.sort = e.target.value; window.renderCategoryProducts(true); });
});
