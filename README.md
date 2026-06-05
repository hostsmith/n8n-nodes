<img src="icons/logo_hs_white_bg_circle_60x60.png" alt="Hostsmith" width="60" height="60" align="left" />

# @hostsmith/n8n-nodes-hostsmith

[![npm version](https://img.shields.io/npm/v/@hostsmith/n8n-nodes-hostsmith?logo=npm)](https://www.npmjs.com/package/@hostsmith/n8n-nodes-hostsmith)
[![npm downloads](https://img.shields.io/npm/dm/@hostsmith/n8n-nodes-hostsmith)](https://www.npmjs.com/package/@hostsmith/n8n-nodes-hostsmith)
[![CI](https://github.com/hostsmith/n8n-nodes/actions/workflows/ci.yml/badge.svg)](https://github.com/hostsmith/n8n-nodes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@hostsmith/n8n-nodes-hostsmith)](LICENSE.md)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-FF6D5A?logo=n8n&logoColor=white)](https://docs.n8n.io/integrations/community-nodes/)

<br clear="left" />

An [n8n](https://n8n.io) community node for [Hostsmith](https://hostsmith.net) - manage your Hostsmith sites, domains, and account from your workflows.

It authenticates with Hostsmith's OAuth 2.0 (Authorization Code + PKCE) and talks to the Hostsmith Public API.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `@hostsmith/n8n-nodes-hostsmith`.

Or install from npm in your n8n instance:

```bash
npm install @hostsmith/n8n-nodes-hostsmith
```

## Operations

The **Hostsmith** node exposes three resources:

| Resource | Operations |
| --- | --- |
| **Account** | Get (org details, plan limits, usage) |
| **Domain** | List (all / shared only / custom only) |
| **Site** | Create, Delete, Deploy, Get, List |

The node resolves the partition API host (`https://us.api.hostsmith.net` / `https://eu.api.hostsmith.net`) automatically - there is no partition setting on the credential:

- **Account Get** uses your account's home partition (read from the token).
- **Site List** and **Domain List** query both partitions and merge the results, so you see everything regardless of where it lives.
- **Site Create** uses the partition of the domain you pick.
- **Site Get / Delete / Deploy** use the partition of the site you pick (see below).

### Selecting a site or domain

- For **Site → Create**, the **Domain** field is a searchable picker of your domains across both partitions (each labelled with its partition). You can also switch it to **By Name** and type a domain manually.
- For **Site → Get / Delete / Deploy**, the **Site** field is a searchable picker (**From List**) of your sites across both partitions, or **By ID** to enter a Site ID directly. The accompanying **Partition** field defaults to **Auto-Detect**, which reads the partition from the site you picked From List. When you enter a Site ID **By ID**, set the **Partition** to **us** or **eu** (Auto-Detect can't resolve a hand-typed ID) - you can pick it from the list or type it.

### Deploy

**Site → Deploy** publishes one or more files to a site as a new version, using Hostsmith's presigned upload flow (`POST /uploads` → `PUT` each part → `POST …/finalize`):

- Add a row to the **Files** table per file. Each row has a **Source** - **Binary** (a binary property of the input item, e.g. `data`) or **Text** (inline content, ideal for AI/template-generated HTML or JSON) - and a required **File Name** giving the destination path within the site (e.g. `index.html`, `assets/style.css`).
- All rows are uploaded together under one version, so a single Deploy publishes a coherent multi-file site.
- Files larger than 5 MB are automatically split into 5 MB multipart parts.
- **Large deploys:** n8n holds binary data in memory by default. For large files, run n8n with `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` so file bytes aren't held entirely in memory.

Bytes are read only from binary input or inline text - the node never touches the filesystem.

## Authentication

Add a **Hostsmith OAuth2 API** credential. Hostsmith is a public OAuth client (PKCE, **no client secret**), so you only ever provide a **Client ID** - never a secret. You get that Client ID by creating an OAuth client in the Hostsmith dashboard.

1. **Copy your OAuth Redirect URL.** n8n shows it on the credential screen - it's your instance's callback:
   `<your-n8n-base-url>/rest/oauth2-credential/callback`
   (e.g. `http://localhost:5678/rest/oauth2-credential/callback` for local, or `https://<your-host>/rest/oauth2-credential/callback` for n8n Cloud / self-hosted). For self-hosted, make sure `N8N_EDITOR_BASE_URL` / `WEBHOOK_URL` is set so this URL is correct.
2. **Create a client in Hostsmith.** Sign in and open **Developers → OAuth Clients** ([hostsmith.net/developers/oauth-clients](https://hostsmith.net/developers/oauth-clients)) → **New client** → give it a name and paste the redirect URL from step 1 → copy the generated **Client ID**. The client is owned by your org and revocable any time; no secret is issued.
3. **Connect.** Paste the Client ID into the credential's **Client ID** field and click **Connect my account** to complete the consent flow. There's no partition to choose - the node selects the right host per operation.

### Scopes

The credential requests `account:read sites:read sites:write domains:read files:write` (the `files:write` scope authorizes Site Deploy uploads). The issued token is bound to both partition API hosts, so one credential works for `us` and `eu` - the node picks the right host per operation, so there's no partition setting to configure.

## Resources

- [Create an OAuth client (Hostsmith dashboard)](https://hostsmith.net/developers/oauth-clients)
- [Hostsmith API authentication docs](https://hostsmith.net/docs/developers/authentication)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
