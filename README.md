# BADOC Hub Dashboard — Test2

Independent test repository merged from the newer `nol3-hubs/test` project while retaining Test2's extension-version validation and GitHub Actions workflows.

## Included
- BADOC Hub dashboard v63
- Chrome extension v1.1.8, including First Mile Orders and Tasks
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
- Chrome: `1.1.9`
- Firefox: `69.3.5`

Both extension bridge scripts report their package version during the handshake. Missing or older package versions are rejected by the dashboard.

## Repository boundaries
- This is the independent Test2 test repository.
- `nol3-hubs/test` was used as the source and was not changed.
- Production `nol3-hubs/badoc-hub` was not changed.
- Test2's existing GitHub Actions workflows are retained.
