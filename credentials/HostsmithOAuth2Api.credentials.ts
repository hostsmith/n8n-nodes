import type {
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HostsmithOAuth2Api implements ICredentialType {
	name = 'hostsmithOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Hostsmith OAuth2 API';

	icon: Icon = 'file:../icons/hostsmith_logo.svg';

	documentationUrl = 'https://hostsmith.net/docs/developers/authentication';

	properties: INodeProperties[] = [
		// Authorization Code + PKCE (S256). Hostsmith is a public client
		// (token_endpoint_auth_methods_supported: ["none"]) — no client secret.
		//
		// Client ID is empty by default: create a client in the Hostsmith
		// dashboard (Developers → OAuth Clients) registering the OAuth Redirect
		// URL shown above, then paste the resulting Client ID here.
		{
			displayName: 'Setup',
			name: 'setupNotice',
			type: 'notice',
			default: '',
			description:
				'1. Copy the <b>OAuth Redirect URL</b> shown on this credential. 2. In Hostsmith, open <b>Developers → OAuth Clients</b> (<a href="https://hostsmith.net/developers/oauth-clients">hostsmith.net/developers/oauth-clients</a>), create a client with that redirect URL, and copy its <b>Client ID</b>. 3. Paste it below and click "Connect my account". No client secret is needed.',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description:
				'The Client ID from a Hostsmith OAuth client (Developers → OAuth Clients) registered with this credential’s OAuth Redirect URL',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'hidden',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://hostsmith.net/api/oauth/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://hostsmith.net/api/oauth/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			// files:write authorizes Site → Deploy uploads.
			default: 'account:read sites:read sites:write domains:read files:write',
		},
		{
			// Bind the token audience to BOTH partition API hosts so the same
			// credential works regardless of the Partition selected below.
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default:
				'resource=https://us.api.hostsmith.net&resource=https://eu.api.hostsmith.net',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
		// No partition selector: the node resolves the partition host in code —
		// the token's homePartition claim for most operations, and the selected
		// domain's partition for Site Create.
	];

	// Confirms the connected token works by hitting /v1/account (served by either
	// partition host; the token audience covers both). Shows the green check.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://us.api.hostsmith.net',
			url: '/v1/account',
		},
	};
}
