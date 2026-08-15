MANASWINI SHOPPING CORNER — IMAGE + ACCOUNT UPDATE

1. Upload the contents of this package to the GitHub repository.
2. In Google Apps Script, replace code.gs with backend/code.gs.
3. Deploy the Apps Script as a Web App: Execute as the Google account that owns the Sheets/Drive; Who has access: Anyone.
4. The Drive Product Images folder must remain accessible to the Apps Script owner. The backend automatically converts MSC001-01.jpg, MSC001-02.jpg, etc. into public image URLs.
5. The backend now uses Google Drive's public file-view URL and the frontend has two image fallbacks. This avoids relying only on Drive thumbnailLink URLs, which Google documents as short-lived/not intended for direct web-app use.
6. Optional: run syncProductImagesFromDrive() once in Apps Script to refresh the ProductImages sheet and set file sharing.
7. ACCOUNT: email/username signup and login are server-side. Users are stored in a Users sheet automatically. Passwords are stored only as salted SHA-256 hashes; the plaintext password is not stored. Sessions expire after 7 days.
8. CHECKOUT: a customer must be logged in with a valid session before Proceed to Checkout can open, and the backend rejects unauthenticated orders.
9. GOOGLE LOGIN: put your Google OAuth Web Client ID in account.js and the same ID in CONFIG.GOOGLE_CLIENT_ID in backend/code.gs. Add the GitHub Pages origin as an authorized JavaScript origin in Google Cloud.
10. MY ACCOUNT contains My Details, My Orders, Saved Address, Wishlist and Track your order.
11. Cart count is hidden as requested.
12. Clean URLs remain directory URLs such as /shop/, /categories/, /about/, /contact/, /account/; no .html suffix is used.
