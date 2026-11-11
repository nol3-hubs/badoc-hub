# SPX BRIDGE for BADOC HUB — Firefox Android

**Package version:** 69.2.4  
**Existing Mozilla add-on ID:** `spx-bridge-badoc-hub@nol3-hubs.github.io`  
**Minimum Firefox version:** 128.0

This separate Firefox-targeted build is based on the current source in the repository's `extension/` folder. It does not replace or modify the Chrome package.

## Included
- BADOC Hub SPX bridge and parcel-export workflows
- Received Checking integration
- POD/POOH checker app and SPX page bridge
- Firefox Manifest V2 event-page configuration
- Firefox Add-ons settings route (`about:addons`)

## Download
After the GitHub Actions package job completes, the unsigned update package is published at:

`downloads/SPX-BRIDGE-BADOC-HUB-69.2.4.xpi`

[Download the Firefox XPI](https://github.com/nol3-hubs/badoc-hub/raw/refs/heads/main/downloads/SPX-BRIDGE-BADOC-HUB-69.2.4.xpi)

## Submit as an update to the existing Mozilla listing
1. Download the `.xpi` package above.
2. Sign in to the Mozilla Add-on Developer Hub.
3. Open the existing listing **SPX BRIDGE for BADOC HUB** (Add-on ID 3093259).
4. Choose **Upload a New Version** and upload the generated `.xpi`.
5. Check AMO validation results and submit for signing/review.

Do not create a new add-on listing. Upload through the existing listing so Mozilla treats it as an update to version 69.2.1 and retains the existing add-on identity.

## Compatibility notes
- Reuses the Gecko ID from the installed 69.2.1 package.
- Keeps Manifest V2 event-page behavior from the installed Firefox build.
- Uses Firefox's Add-ons manager instead of Chrome's extension-management page.
- Uses Firefox's `scripting.executeScript()` MAIN world support (Firefox 128+).

**Firefox-specific change in 69.2.4:** Requests to the SPX origin are now executed from the already logged-in SPX tab in Firefox, rather than from the extension background origin. Signed CSV downloads from their download host still use the extension fetch path.

**Testing status:** The source package must pass Mozilla WebExtension lint and still needs a live SPX login test before production use. Mozilla must approve/sign it before Firefox distributes it.
