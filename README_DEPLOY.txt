MANASWINI SHOPPING CORNER — CLEAN URL + DRIVE IMAGE VERSION

1. Upload the contents of this folder to GitHub Pages.
2. Pages use clean URLs:
   /manaswini-shopping-corner/
   /manaswini-shopping-corner/categories/
   /manaswini-shopping-corner/shop/
   /manaswini-shopping-corner/about/
   /manaswini-shopping-corner/contact/
   /manaswini-shopping-corner/account/

3. Track Order is no longer a top navigation item. It is inside My Account after login, matching the requested shopping-app flow.

4. Product images:
   The Drive folder contains files named MSC001-01.jpg, MSC001-02.jpg, etc.
   backend/code.gs is configured for folder ID:
   1e24OkZn4YIPOD5XLnrW3Dqv--Dj5PUI

   Deploy the updated Apps Script, then run:
   syncProductImagesFromDrive()
   once from the Apps Script editor.

   That function creates/refreshes the ProductImages sheet and sets the product image files to Anyone with the link / Viewer so the public GitHub Pages site can display them. If your Google Workspace blocks public sharing, use another public image host or enable link sharing for the folder/files.

5. Google Sign-In:
   Put your Google OAuth Web Client ID in account.js and CONFIG.GOOGLE_CLIENT_ID in backend/code.gs.
   Add your GitHub Pages origin as an authorized JavaScript origin in Google Cloud.

6. Do not use the old .html links. Use the clean directory URLs above.
