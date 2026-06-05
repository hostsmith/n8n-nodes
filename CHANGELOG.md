# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0

Initial release.

- **Hostsmith** node with three resources:
  - **Account** — Get (org details, plan limits, usage)
  - **Domain** — List (all / shared only / custom only)
  - **Site** — Create, Delete, Deploy, Get, List
- **Site → Deploy** publishes one or more files (binary or inline text) as a new
  version via Hostsmith's presigned upload flow, with automatic 5 MB multipart
  splitting for large files.
- Automatic partition resolution — the node picks the correct partition API host
  (`us` / `eu`) per operation from the OAuth token and the selected site/domain;
  there is no partition setting on the credential.
- **Hostsmith OAuth2 API** credential using Authorization Code + PKCE (public
  client, no client secret).
