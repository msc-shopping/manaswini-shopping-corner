/* Categories page only. Shared product/cart logic stays in app.js. */
document.addEventListener('DOMContentLoaded', () => {
  const render = () => {
    if (typeof window.renderCategorySections === 'function') {
      window.renderCategorySections();
      const query = new URLSearchParams(location.search).get('category');
      if (query && window.state) {
        window.state.category = query;
        window.renderCategorySections();
      }
    }
  };
  render();
});
