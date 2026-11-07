# Badoc Hub — Firebase setup

The app points at your Realtime Database:
`https://badoc-hub-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app`

1. **Rules** — Firebase console → Realtime Database → Rules → paste, then Publish:

       {
         "rules": {
           ".read": false,
           ".write": false,
           "badoc": { ".read": true, ".write": true }
         }
       }

2. **Optional** — paste `apiKey` / `appId` into `BADOC_FIREBASE_CONFIG` in `index.html`.
   Sync works with `databaseURL` alone.

3. Open the hub from your GitHub link → Settings → *Test Cloud Connection*.
