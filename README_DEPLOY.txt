MANASWINI SHOPPING CORNER — FINAL UPDATE

1. Replace the old website files with all files in this folder on GitHub Pages.
2. Keep these files in the same directory:
   index.html
   categories.html
   shop.html
   about.html
   contact.html
   track.html
   account.html
   style.css
   app.js
   index.js
   categories.js
   shop.js
   about.js
   contact.js
   track.js
   account.js
   products.json

3. Google Apps Script:
   - Open backend/code.gs.
   - Put your Google OAuth Web Client ID in CONFIG.GOOGLE_CLIENT_ID.
   - Deploy a NEW Web App version.
   - Execute as: Me.
   - Who has access: Anyone.
   - Replace the API URL in app.js only if the new deployment URL changes.

4. Google Cloud:
   - Create an OAuth 2.0 Web Client ID.
   - Add your GitHub Pages origin to Authorized JavaScript origins.
     Example: https://YOUR-USERNAME.github.io
   - Put the client ID in account.js and backend/code.gs.

5. Account features:
   - Google Sign-In becomes active after the client ID is configured.
   - Google users can have a profile and the site can load their Orders from the Orders sheet.
   - The email/username form is a browser-local fallback. Do not treat it as production-grade authentication until a server-side password/OTP system is added.

6. Products/images:
   - The local products.json is only a fallback catalogue.
   - Product images are read from ImageURL/ImageURLs/Image1/Image2/etc. when present.
   - Google Drive file links are converted to viewable URLs automatically.
   - The current supplied products.json contains no actual image URLs, so real product photos cannot appear until image URLs are supplied in the Products/ProductImages data.

7. Categories page:
   - Product counts are removed from category cards.
   - Products are rendered in separate category sections below the category cards.
   - Local products appear immediately; the live API refreshes in the background without holding the page on a loading message.
