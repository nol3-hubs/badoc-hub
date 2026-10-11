BADOC HUB — GitHub source-based Received Checking integration (v69)

This package is rebuilt from the exact index.html in the uploaded badoc-hub-main ZIP, then adds the isolated Received Checking page and unified SPX BRIDGE v69. It does not replace the base app with the separate newer stage file.

Deploy to the existing nol3-hubs/received GitHub repository:
1. Upload/replace index.html, sw.js, and manifest.webmanifest from this package.
2. Add the extension/ folder with manifest.json, background.js, and content.js.
3. Add the icons/ folder with icon-192.png and icon-512.png.
4. Add received-checking.html and .nojekyll if not present. received-embedded.html and received-srcdoc.html are included as standalone/support copies; the page in index.html embeds its own dashboard.
5. Keep existing badoc-hub-icon.png, favicon.ico, spx-logo-192.png, and spx-logo-512.png. Do not delete other unrelated repository files.
6. Commit the changes, reload SPX BRIDGE in chrome://extensions, and refresh GitHub Pages with Ctrl+F5.

The Received Checking page is contained in an isolated iframe and uses a dedicated local-storage exemption key. It uses the same SPX BRIDGE v69 extension as the existing app. Chrome still requires the one-time Load unpacked action for the extension.

ADDED: Parcel Count includes “Recheck Delivering via Batch Search”. It searches only unique TNs currently marked Delivering in NOL3, previews verified status changes, applies them only after confirmation, and saves a local reconciliation batch without cloud upload. Failed/missing results remain unchanged.


Parcel Count SPX syncs now show a centered operation popup with live progress and a readable completion/error summary instead of browser alert dialogs. Batch Search reconciliation keeps its confirmation and status-change preview.


Progress popup improvement: the progress indicator now uses a continuous indeterminate sweep during SPX work. Recheck Delivering via Batch Search uses an in-app confirmation dialog for both starting the search and approving the verified status-change preview, instead of the browser native confirm dialog.
