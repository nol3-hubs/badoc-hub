# BADOC Hub Dashboard — Test2

Independent test repository merged from the newer `nol3-hubs/test` project while retaining Test2's extension-version validation and GitHub Actions workflows.

## Included
- BADOC Hub dashboard v78
- Chrome extension v1.3.5, including Downloaded Data display in the POD/POOH Checker
- Firefox extension v69.4.7
- First Mile XLSX-to-CSV support
- On-demand Pickup Info lookup from the signed-in SPX tab, including pickup attempts, geofence, remarks, photos, and seller signature
- Integrated POD/POOH checker with an Assigned Parcels Today button that exports Forward and Return Orders across all statuses and filters only Assigned Time to the current Philippine calendar day
- Built-in Chrome extension installer and generated ZIP package
- One-request combined SPX export for Delivering, Delivered, and OnHold
- CFR1 frozen-membership recovery and late cloud-load handling
- Test2 GitHub Actions workflows and supporting tools

## Extension version validation
The dashboard checks the installed extension package version separately from the bridge protocol version.

Minimum versions:
- Chrome: `1.3.5`
- Firefox: `69.4.7`

Both extension bridge scripts report their package version during the handshake. Missing or older package versions are rejected by the dashboard. The built-in Chrome installer bundle still needs to be refreshed to include the latest v1.2.9 source package.

## Pickup export and matching
- Pickup Orders exports all statuses and all bulky types, limited only to Created Time in the last 14 days through the selected day.
- Pickup Tasks exports all statuses without driver, vehicle, pickup-point, or created-time restrictions.
- The daily Pickup results keep Orders whose ETA is today (Philippine time), match by Pickup Task Number when available and otherwise by Pickup Point ID, and preserve orders without a matching task/driver as `Unassigned`. The mapped Pickup Task statuses Accepted, Disabled, Pickup no order, and Inbounded take precedence; the Order status is the fallback for other task states.
- Unmatched Inbounded and Onhold task-only rows created today appear in the main results and remain listed in the unmatched-task panel for reference. Their Order Number, Seller Name, and ETA stay blank when no matching current-day Pickup Order exists.
- The combined Pickup CSV and Copy for Sheet use the same current search/status-filtered rows as the main table.

- The first successful Pickup Orders and Pickup Tasks exports of each Philippine calendar day establish the baseline. Each Order ID / Pickup Task Number keeps its first-seen status for that day; newly appearing IDs are appended without overwriting existing baseline entries. Baselines are kept locally and in shared cloud storage.
- Pickup Task Number is preferred for order/task association when present in both exports; otherwise the existing Pickup Point ID association is retained.
- An explicit Disabled task is shown as **Cancelled after Assigned** only when its first-sync baseline was Assigned. Other Disabled records are omitted from the main results and unmatched-task panel.
- Each Order Number has an on-demand **Pickup Info** action. It reads the authenticated SPX `pickup_info` endpoint and displays pickup status/times, attempt history, task/rider, geofence result, remarks, seller signature, and available photo links. It requires an open, signed-in SPX tab and does not bulk-fetch or cache order details.

## Repository boundaries
- This is the independent Test2 test repository.
- `nol3-hubs/test` was used as the source and was not changed.
- Production `nol3-hubs/badoc-hub` was not changed.
- Test2's existing GitHub Actions workflows are retained.
