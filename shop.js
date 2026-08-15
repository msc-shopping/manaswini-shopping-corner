// Shop page controls.
document.addEventListener("DOMContentLoaded", () => {
  const filter = document.querySelector("#shopCategoryFilter");
  const sort = document.querySelector("#shopSortFilter");
  const search = document.querySelector("#shopSearchInput");
  if (filter) filter.addEventListener("change", e => { window.state.category = e.target.value; window.renderShopProducts(); });
  if (sort) sort.addEventListener("change", e => { window.state.sort = e.target.value; window.renderShopProducts(); });
  if (search) search.addEventListener("input", e => { window.state.search = e.target.value.toLowerCase().trim(); window.renderShopProducts(); });
});
