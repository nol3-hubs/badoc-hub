# BADOC Hub Dashboard — Test2

Independent test repository merged from the newer `nol3-hubs/test` project while retaining Test2's extension-version validation and GitHub Actions workflows.

## Included
- BADOC Hub dashboard v76
- Chrome extension v1.2.3, including all-status First Mile Orders and Tasks exports
- Firefox extension v69.3.5
- First Mile XLSX-to-CSV support
- Integrated POD/POOH checker
- Built-in Chrome extension installer and generated ZIP package
- One-request combined SPX export for Delivering, Delivered, and OnHold
- CFR1 frozen-membership recovery and late cloud-load handling
- Test2 GitHub Actions workflows and supporting tools

## Extension version validation
The dashboard checks the installed extension package version separately from the bridge protocol version.

Minimum versions:
- Chrome: `1.2.3`
- Firefox: `69.3.5`

Both extension bridge scripts report their package version during the handshake. Missing or older package versions are rejected by the dashboard. The built-in Chrome installer embeds the same v1.2.3 package.

## Pickup export and matching
- Pickup Orders exports all statuses and all bulky types, limited only to Created Time in the last 14 days through the selected day.
- Pickup Tasks exports all statuses without driver, vehicle, pickup-point, or created-time restrictions.
- The daily Pickup results keep Orders whose ETA is today (Philippine time), match task driver details by Pickup Point ID, preserve orders without a task/driver as `Unassigned`, and use the order export's Status.
- Unmatched Inbounded task-only rows created today remain visible as a separate special case.
- The combined Pickup CSV and Copy for Sheet use the same current search/status-filtered rows as the main table.

## Repository boundaries
- This is the independent Test2 test repository.
- `nol3-hubs/test` was used as the source and was not changed.
- Production `nol3-hubs/badoc-hub` was not changed.
- Test2's existing GitHub Actions workflows are retained.
