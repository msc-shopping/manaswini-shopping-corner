MANASWINI SHOPPING CORNER — UPDATED WEBSITE
============================================

WHAT WAS FIXED
---------------
1. Products now have a local products.json fallback, so GitHub Pages does not remain blank when the Google Apps Script endpoint is unavailable.
2. Live Google Apps Script catalogue is still attempted and replaces the saved catalogue when available.
3. Updated Apps Script backend supports JSONP for cross-origin catalogue/tracking requests.
4. Hero/logo artwork is circular rather than the stretched oval shape.
5. Header M logo and footer M logo are fixed circular marks.
6. Footer is structurally at the bottom; the large cream/white area after the footer is removed.
7. All six pages use the same polished header/footer styling.
8. Footer navigation now points to real HTML pages.
9. Categories are generated from the product catalogue.
10. Shop filters/search/sort remain functional.
11. Product cards, product modal, cart and checkout styling are unified.
12. Contact page is arranged as cards + enquiry form + map.
13. Track Order page has a compact centered tracking panel.

GITHUB PAGES
------------
Upload/replace these files in the SAME directory as index.html:

index.html
categories.html
shop.html
about.html
contact.html
track.html
style.css
app.js
index.js
categories.js
shop.js
about.js
contact.js
track.js
products.json

The website entry point remains index.html.

GOOGLE APPS SCRIPT BACKEND
---------------------------
The updated backend is:
backend/code.gs

Replace the old Apps Script code with this code and DEPLOY A NEW VERSION of the web app.
Use:
- Execute as: Me
- Who has access: Anyone

After deployment, update API_URL in app.js if Google gives a NEW deployment URL.

IMPORTANT
---------
The website can display the saved catalogue from products.json even before the Apps Script backend is redeployed. However, live catalogue updates, order placement and order tracking depend on the Apps Script deployment.

PRODUCT IMAGES
--------------
The current supplied Products/ProductImages database has no populated ProductImages rows, so products without image URLs intentionally show the circular M/Manaswini placeholder. When ProductImages is populated, the updated backend automatically returns ImageURLs to the website.
