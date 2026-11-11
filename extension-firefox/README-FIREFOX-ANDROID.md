# SPX BRIDGE for BADOC HUB — Firefox Android

**Package version:** 69.2.2  
**Existing Mozilla add-on ID:** `spx-bridge-badoc-hub@nol3-hubs.github.io`  
**Minimum Firefox version:** 128.0

This separate Firefox-targeted build is based on the current source in the repository's `extension/` folder. It does not replace or modify the Chrome package.

## Included
- BADOC Hub SPX bridge and parcel-export workflows
- Received Checking integration
- POD/POOH checker app and SPX page bridge
- Firefox Manifest V2 event-page configuration
- Firefox Add-ons settings route (`about:addons`)

## Build
The GitHub Actions workflow **Package Firefox SPX Bridge** creates an `.xpi` artifact whenever files under `extension-firefox/` change, or when run manually.

## Submit as an update to the existing Mozilla listing
1. Download the `.xpi` artifact produced by the workflow.
2. Sign in to the Mozilla Add-on Developer Hub.
3. Open the existing listing **SPX BRIDGE for BADOC HUB** (Add-on ID 3093259).
4. Choose **Upload a New Version** and upload the generated `.xpi`.
5. Check AMO validation results and submit for signing/review.

Do not create a new add-on listing. Upload through the existing listing so Mozilla treats it as an update to version 69.2.1 and retains the existing add-on identity.

## Compatibility notes
- Reuses the Gecko ID from the installed 69.2.1 package.
- Keeps Manifest V2 event-page behavior from the installed Firefox build.
- Uses Firefox's `about:addons` page instead of Chrome's `chrome://extensions/`.
- Uses Firefox's `scripting.executeScript()` MAIN world support (Firefox 128+).

**Testing status:** The source package is prepared and statically checked by the workflow. It has not yet been tested against a live SPX session or approved/signed by Mozilla. Test with a logged-in SPX account after Mozilla signs the submitted package.
