# SPX BRIDGE for BADOC HUB — Firefox

**Package version:** 69.5.7  
**Existing Mozilla add-on ID:** `spx-bridge-badoc-hub@nol3-hubs.github.io`  
**Minimum Firefox version:** 128.0

This is the Firefox-targeted Test2 build. It is maintained separately from the Chrome extension in `extension/` and does not modify the production `nol3-hubs/badoc-hub` repository.

## Included
- BADOC HUB SPX bridge and parcel-export workflows
- Received Checking integration
- POD/POOH checker app and SPX page bridge
- Firefox Manifest V2 event-page configuration
- Firefox Add-ons settings route (`about:addons`)

## Download
The GitHub Actions package workflow builds and publishes the unsigned XPI and SHA-256 checksum:

- [Download Firefox XPI 69.5.7](https://github.com/nol3-hubs/Test2/raw/refs/heads/main/downloads/SPX-BRIDGE-BADOC-HUB-FIREFOX-69.5.7.xpi)
- [View SHA-256 checksum](https://github.com/nol3-hubs/Test2/blob/main/downloads/SPX-BRIDGE-BADOC-HUB-FIREFOX-69.5.7.sha256)

## Submit as an update to the existing Mozilla listing
1. Download the `.xpi` package above.
2. Sign in to the Mozilla Add-on Developer Hub.
3. Open the existing listing **SPX BRIDGE for BADOC HUB** (Add-on ID 3093259).
4. Choose **Upload a New Version** and upload the generated `.xpi`.
5. Review Mozilla's validation results and submit it for signing/review.

Do not create a new add-on listing. Keep the existing Gecko ID so Mozilla treats this as an update to the current add-on.

## Compatibility and validation
- Uses the existing Gecko ID and Firefox Manifest V2 event-page behavior.
- Uses Firefox's Add-ons manager instead of Chrome's extension-management page.
- Uses Firefox's `scripting.executeScript()` MAIN world support (Firefox 128+).
- The 69.5.7 package passed the repository's Mozilla WebExtension lint step with zero errors. The lint output reports two compatibility warnings related to the declared `data_collection_permissions` key and minimum Firefox version.
- A live SPX login/sync test and Mozilla signing/review are still required before distributing it as a production update.
