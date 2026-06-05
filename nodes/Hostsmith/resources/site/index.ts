import type { INodeProperties } from 'n8n-workflow';

const showOnlyForSites = {
	resource: ['site'],
};

export const siteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForSites,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a site',
				description: 'Create a new site',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a site',
				description: 'Delete a site',
			},
			{
				name: 'Deploy',
				value: 'deploy',
				action: 'Deploy files to a site',
				description: 'Publish one or more files to a site as a new version',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a site',
				description: 'Get the details of a single site',
			},
			{
				name: 'List',
				value: 'list',
				action: 'List sites',
				description: 'List sites in the account',
			},
		],
		default: 'list',
	},
	{
		displayName: 'Site',
		name: 'siteId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The site to act on — pick one from your account or enter a Site ID',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['get', 'delete', 'deploy'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'siteSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
			},
		],
	},
	{
		displayName: 'Partition',
		name: 'sitePartition',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description:
			'Data partition the site lives in. Defaults to Auto-Detect, which reads the partition from the site you pick From List. Set us or eu explicitly when you enter a Site ID by ID (auto-detect cannot resolve a manually typed ID).',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['get', 'delete', 'deploy'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'partitionSearch',
					searchable: false,
				},
			},
			{
				displayName: 'Value',
				name: 'value',
				type: 'string',
				placeholder: 'us or eu',
			},
		],
	},
	{
		displayName: 'Domain',
		name: 'domain',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Parent domain for the site (one of your available Hostsmith domains)',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['create'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'domainSearch',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. us.hostsmith.link',
			},
		],
	},
	{
		displayName: 'Serve at Apex',
		name: 'serveAtApex',
		type: 'boolean',
		default: false,
		description:
			'Whether to serve the site at the bare apex of a custom domain (requires a domain that supports apex). When off, a subdomain is required.',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Subdomain',
		name: 'subdomain',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. my-portfolio',
		description: 'Subdomain prefix (lowercase alphanumeric and hyphens), e.g. my-portfolio.example.com',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['create'],
				serveAtApex: [false],
			},
		},
	},
	{
		displayName: 'Files',
		name: 'files',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add File',
		},
		default: {},
		placeholder: 'Add File',
		description:
			'Files to publish together as one site version. Each file is read from binary input or inline text — never the filesystem. Large files are split into 5 MB parts; for big deploys set N8N_DEFAULT_BINARY_DATA_MODE=filesystem so file bytes are not held entirely in memory.',
		displayOptions: {
			show: {
				resource: ['site'],
				operation: ['deploy'],
			},
		},
		options: [
			{
				name: 'file',
				displayName: 'File',
				values: [
					{
						displayName: 'Source',
						name: 'source',
						type: 'options',
						options: [
							{
								name: 'Binary',
								value: 'binary',
							},
							{
								name: 'Text',
								value: 'text',
							},
						],
						default: 'binary',
						description: 'Where the file bytes come from',
					},
					{
						displayName: 'Binary Property',
						name: 'binaryProperty',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property on the input item that holds the file',
						displayOptions: {
							show: {
								source: ['binary'],
							},
						},
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'Inline text content to publish (e.g. generated HTML or JSON)',
						displayOptions: {
							show: {
								source: ['text'],
							},
						},
					},
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. index.html or assets/style.css',
						description: 'Destination path of the file within the site',
					},
				],
			},
		],
	},
];
