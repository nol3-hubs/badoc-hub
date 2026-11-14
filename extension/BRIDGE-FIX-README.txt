Badoc Hub Chrome Extension v1.0.8

First Mile binary export fix:
- Reads the SPX export response as bytes before deciding whether it is JSON, CSV, or XLSX.
- Reads signed-download responses as bytes as well; Excel workbooks are converted to CSV before local storage.
- Always names converted First Mile downloads with a .csv extension, even when SPX names its source file .xlsx.
- Keeps the Orders-then-Tasks one-button workflow and local-only storage.

Install using chrome://extensions → Developer mode → Load unpacked, and select this extension-chrome folder.
