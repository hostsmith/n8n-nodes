import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeListSearchItems,
	type INodeListSearchResult,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { siteDescription } from './resources/site';
import { domainDescription } from './resources/domain';
import { accountDescription } from './resources/account';
import {
	deploySite,
	getHomePartition,
	hostsmithApiRequest,
	listAllDomains,
	listAllSites,
	type Partition,
} from './transport';

/**
 * Resolve the `{ siteId, partition }` for a Site operation. When the user picks
 * a site From List, the partition is detected from the merged both-partition
 * site probe. When a Site ID is entered By ID, the Partition field is required.
 */
async function resolveSiteTarget(
	ctx: IExecuteFunctions,
	itemIndex: number,
): Promise<{ siteId: string; partition: Partition }> {
	const rl = ctx.getNodeParameter('siteId', itemIndex) as { mode?: string; value?: string } | string;
	const mode = typeof rl === 'object' && rl !== null ? (rl.mode ?? 'id') : 'id';
	const rawValue = typeof rl === 'object' && rl !== null ? (rl.value ?? '') : String(rl);
	const siteId = rawValue.trim();
	if (!siteId) {
		throw new NodeOperationError(ctx.getNode(), 'Site ID is required', { itemIndex });
	}

	// An explicit Partition (picked from the list or typed) always wins.
	const partitionRaw = ctx.getNodeParameter('sitePartition', itemIndex, '', {
		extractValue: true,
	}) as string;
	const partition = (partitionRaw || '').trim().toLowerCase();
	if (partition === 'us' || partition === 'eu') {
		return { siteId, partition };
	}

	// Auto-Detect (Partition left empty) → read it from the picked site. This
	// only works when the site was chosen From List (so it's in the probe).
	if (mode === 'list') {
		const sites = await listAllSites.call(ctx);
		const found = sites.find((s) => (s.id as string) === siteId);
		if (found && (found.partition === 'us' || found.partition === 'eu')) {
			return { siteId, partition: found.partition };
		}
	}

	throw new NodeOperationError(
		ctx.getNode(),
		'Select or enter the Partition (us or eu) for this Site ID',
		{
			itemIndex,
			description:
				'Auto-Detect only works when you pick the Site From List. For a Site ID entered By ID, set the Partition to us or eu.',
		},
	);
}

export class Hostsmith implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hostsmith',
		name: 'hostsmith',
		icon: 'file:../../icons/hostsmith_logo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage Hostsmith sites, domains, and account',
		defaults: {
			name: 'Hostsmith',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'hostsmithOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Domain',
						value: 'domain',
					},
					{
						name: 'Site',
						value: 'site',
					},
				],
				default: 'site',
			},
			...siteDescription,
			...domainDescription,
			...accountDescription,
		],
	};

	methods = {
		listSearch: {
			async domainSearch(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const domains = await listAllDomains.call(this);
				const needle = (filter ?? '').toLowerCase();
				const results: INodeListSearchItems[] = domains
					.map((domain) => {
						const name = domain.name as string;
						const partition = domain.partition as string;
						return { name: `${name} (${partition})`, value: name };
					})
					.filter((option) => needle === '' || option.name.toLowerCase().includes(needle))
					.sort((a, b) => a.name.localeCompare(b.name));
				return { results };
			},

			async siteSearch(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const sites = await listAllSites.call(this);
				const needle = (filter ?? '').toLowerCase();
				const results: INodeListSearchItems[] = sites
					.map((site) => {
						const subdomain = site.subdomain as string;
						const domain = site.domain as string;
						const partition = site.partition as string;
						const id = site.id as string;
						return {
							name: `${subdomain}.${domain} (${partition})`,
							value: id,
							url: `https://${subdomain}.${domain}`,
						};
					})
					.filter(
						(option) =>
							needle === '' ||
							option.name.toLowerCase().includes(needle) ||
							option.value.toLowerCase().includes(needle),
					)
					.sort((a, b) => a.name.localeCompare(b.name));
				return { results };
			},

			async partitionSearch(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
				return {
					results: [
						{ name: 'Auto-Detect (From Selected Site)', value: '' },
						{ name: 'United States (US)', value: 'us' },
						{ name: 'European Union (EU)', value: 'eu' },
					],
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const homePartition = await getHomePartition.call(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject | IDataObject[] = {};

				if (resource === 'account') {
					// Get: GET /v1/account → unwrap `account`.
					const response = (await hostsmithApiRequest.call(
						this,
						'GET',
						'/v1/account',
						homePartition,
					)) as { account: IDataObject };
					responseData = response.account;
				} else if (resource === 'domain') {
					// List: merge /v1/domains across both partitions.
					const type = this.getNodeParameter('type', i) as string;
					const shared = type === 'shared' ? true : type === 'custom' ? false : undefined;
					responseData = await listAllDomains.call(this, shared);
				} else if (resource === 'site') {
					if (operation === 'list') {
						// Merge /v1/sites across both partitions.
						responseData = await listAllSites.call(this);
					} else if (operation === 'get') {
						const { siteId, partition } = await resolveSiteTarget(this, i);
						responseData = (await hostsmithApiRequest.call(
							this,
							'GET',
							`/v1/sites/${encodeURIComponent(siteId)}`,
							partition,
						)) as IDataObject;
					} else if (operation === 'delete') {
						const { siteId, partition } = await resolveSiteTarget(this, i);
						responseData = (await hostsmithApiRequest.call(
							this,
							'DELETE',
							`/v1/sites/${encodeURIComponent(siteId)}`,
							partition,
						)) as IDataObject;
					} else if (operation === 'create') {
						const domain = this.getNodeParameter('domain', i, '', {
							extractValue: true,
						}) as string;
						const serveAtApex = this.getNodeParameter('serveAtApex', i) as boolean;
						// The API takes a `subdomain`; apex is the canonical "www".
						const subdomain = serveAtApex
							? 'www'
							: (this.getNodeParameter('subdomain', i) as string);

						// Site Create must target the host of the domain's partition.
						const domains = await listAllDomains.call(this);
						const match = domains.find((d) => d.name === domain);
						const partition = ((match?.partition as Partition) ?? homePartition) as Partition;

						responseData = (await hostsmithApiRequest.call(this, 'POST', '/v1/sites', partition, {
							domain,
							subdomain,
						})) as IDataObject;
					} else if (operation === 'deploy') {
						const { siteId, partition } = await resolveSiteTarget(this, i);
						responseData = await deploySite.call(this, i, siteId, partition);
					}
				}

				if (Array.isArray(responseData)) {
					for (const entry of responseData) {
						returnData.push({ json: entry, pairedItem: { item: i } });
					}
				} else {
					returnData.push({ json: responseData, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
