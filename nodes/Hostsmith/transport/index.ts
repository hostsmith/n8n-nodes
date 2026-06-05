import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** S3-style multipart part size: 5 MB. */
const PART_SIZE = 5 * 1024 * 1024;

export type Partition = 'us' | 'eu';

/** The Hostsmith data partitions, in query order for merge operations. */
export const PARTITIONS: Partition[] = ['us', 'eu'];

/**
 * Infer the home partition from a Hostsmith access token, mirroring the JS
 * SDK's `partitionFromToken`: base64url-decode the JWT payload and read its
 * `homePartition` claim. Returns `undefined` when the token can't be decoded.
 */
function decodeHomePartition(token: string | undefined): Partition | undefined {
	if (!token) return undefined;
	const parts = token.split('.');
	if (parts.length !== 3) return undefined;
	try {
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as IDataObject;
		const home = payload.homePartition;
		if (home === 'us' || home === 'eu') return home;
	} catch {
		return undefined;
	}
	return undefined;
}

/**
 * Resolve the default partition host for the connected credential. Prefers the
 * OAuth token's `homePartition` claim (no extra request); if the token can't be
 * read or decoded, falls back to `GET /v1/account` (which works on any partition
 * host) to read `account.user.homePartition`, and finally defaults to `us`. No
 * host is picked on the credential anymore — this replaces the old selector.
 */
export async function getHomePartition(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<Partition> {
	const credentials = await this.getCredentials('hostsmithOAuth2Api');
	const tokenData = credentials.oauthTokenData as IDataObject | undefined;
	const fromToken = decodeHomePartition(tokenData?.access_token as string | undefined);
	if (fromToken) return fromToken;

	// Fallback: ask the API. /v1/account is served by either partition host, so
	// the bootstrap host doesn't matter — the claim is a property of the user.
	try {
		const response = (await hostsmithApiRequest.call(this, 'GET', '/v1/account', 'us')) as {
			account?: { user?: { homePartition?: string } };
		};
		const home = response.account?.user?.homePartition;
		if (home === 'us' || home === 'eu') return home;
	} catch {
		// Ignore and fall through to the default.
	}
	return 'us';
}

/**
 * Send an authenticated request to a specific partition's Hostsmith Public API
 * host (`https://<partition>.api.hostsmith.net`). Authentication is delegated to
 * n8n's OAuth2 helper. Only `this.helpers.*` and Node built-ins are used — no
 * external dependencies, no filesystem access, no environment-variable access.
 */
export async function hostsmithApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	partition: Partition,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	return await this.helpers.httpRequestWithAuthentication.call(this, 'hostsmithOAuth2Api', {
		method,
		baseURL: `https://${partition}.api.hostsmith.net`,
		url: endpoint,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		...(body !== undefined ? { body } : {}),
		...(qs !== undefined ? { qs } : {}),
		json: true,
	});
}

/**
 * List domains across both partitions and merge them (like the MCP server's
 * `list_domains`). Each returned domain carries its `partition`, used both for
 * the Domain resource locator and to route Site Create to the right host.
 */
export async function listAllDomains(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	shared?: boolean,
): Promise<IDataObject[]> {
	const qs = shared !== undefined ? { shared: String(shared) } : undefined;
	const merged: IDataObject[] = [];
	for (const partition of PARTITIONS) {
		const response = (await hostsmithApiRequest.call(
			this,
			'GET',
			'/v1/domains',
			partition,
			undefined,
			qs,
		)) as { domains?: IDataObject[] };
		for (const domain of response.domains ?? []) {
			merged.push({ ...domain, partition: (domain.partition as string) ?? partition });
		}
	}
	return merged;
}

/**
 * List sites across both partitions and merge them (like the MCP server's
 * `list_sites`). Each returned site carries its `partition` (from the host that
 * returned it), used both for the Site resource-locator picker and to resolve
 * the partition of a selected site at execution time.
 */
export async function listAllSites(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<IDataObject[]> {
	const merged: IDataObject[] = [];
	for (const partition of PARTITIONS) {
		const response = (await hostsmithApiRequest.call(this, 'GET', '/v1/sites', partition)) as {
			sites?: IDataObject[];
		};
		for (const site of response.sites ?? []) {
			merged.push({ ...site, partition: (site.partition as string) ?? partition });
		}
	}
	return merged;
}

interface UploadFileTarget {
	uploadId: string;
	key: string;
	partUploadUrls: Array<{ part: number; url: string }>;
}

interface ResolvedFile {
	fileName: string;
	buffer: Buffer;
	parts: number;
}

/**
 * Publish one or more files to a site through the presigned upload flow:
 * `POST /uploads` (request presigned URLs) → `PUT` each 5 MB part (capturing the
 * `ETag`) → `POST /uploads/:versionId/finalize`. All files go into one version.
 */
export async function deploySite(
	this: IExecuteFunctions,
	itemIndex: number,
	siteId: string,
	partition: Partition,
): Promise<IDataObject> {
	const filesCollection = this.getNodeParameter('files', itemIndex, {}) as IDataObject;
	const rows = (filesCollection.file as IDataObject[] | undefined) ?? [];

	if (rows.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Deploy requires at least one file in the Files collection',
			{ itemIndex },
		);
	}

	// Resolve every row to bytes + destination path (no filesystem access).
	const resolved: ResolvedFile[] = [];
	for (const row of rows) {
		const fileName = ((row.fileName as string) || '').trim();
		if (!fileName) {
			throw new NodeOperationError(this.getNode(), 'Each file row requires a File Name', {
				itemIndex,
			});
		}

		let buffer: Buffer;
		if ((row.source as string) === 'text') {
			buffer = Buffer.from((row.content as string) || '', 'utf8');
		} else {
			const binaryProperty = (row.binaryProperty as string) || 'data';
			this.helpers.assertBinaryData(itemIndex, binaryProperty);
			buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
		}

		resolved.push({
			fileName,
			buffer,
			parts: Math.max(1, Math.ceil(buffer.length / PART_SIZE)),
		});
	}

	// 1. Request presigned upload URLs for the whole version.
	const upload = (await hostsmithApiRequest.call(this, 'POST', `/v1/sites/${encodeURIComponent(siteId)}/uploads`, partition, {
		files: resolved.map((f) => ({
			fileName: f.fileName,
			fileSize: f.buffer.length,
			parts: f.parts,
		})),
	})) as { versionId: string; files: Record<string, UploadFileTarget> };

	const completions: IDataObject[] = [];

	// 2. PUT each part to its presigned URL, capturing the ETag.
	for (const file of resolved) {
		const target = upload.files[file.fileName];
		if (!target) {
			throw new NodeOperationError(
				this.getNode(),
				`Upload response did not include a target for file "${file.fileName}"`,
				{ itemIndex },
			);
		}

		const isMultipart = target.partUploadUrls.length > 1;
		const parts: Array<{ ETag: string; PartNumber: number }> = [];

		for (const { part, url } of target.partUploadUrls) {
			const start = (part - 1) * PART_SIZE;
			const chunk = file.buffer.subarray(start, Math.min(start + PART_SIZE, file.buffer.length));

			const putResponse = (await this.helpers.httpRequest({
				method: 'PUT',
				url,
				body: chunk,
				returnFullResponse: true,
			})) as { headers: IDataObject };

			const etag = (putResponse.headers?.etag ?? putResponse.headers?.ETag) as string | undefined;
			if (!etag) {
				throw new NodeOperationError(
					this.getNode(),
					`Presigned PUT for "${file.fileName}" part ${part} did not return an ETag`,
					{ itemIndex },
				);
			}
			parts.push({ ETag: etag, PartNumber: part });
		}

		// Single-part uploads need no completion entry; multipart files do.
		if (isMultipart) {
			completions.push({
				uploadId: target.uploadId,
				key: target.key,
				parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
			});
		}
	}

	// 3. Finalize the version. Always send `{ completions }` (an empty array for
	// single-part uploads): n8n drops an *empty* object body but keeps the JSON
	// Content-Type, which makes the server reject it as "Malformed JSON".
	const finalize = (await hostsmithApiRequest.call(
		this,
		'POST',
		`/v1/sites/${encodeURIComponent(siteId)}/uploads/${encodeURIComponent(upload.versionId)}/finalize`,
		partition,
		{ completions },
	)) as IDataObject;

	return { versionId: upload.versionId, ...finalize };
}
