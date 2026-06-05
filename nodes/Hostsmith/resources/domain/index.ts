import type { INodeProperties } from 'n8n-workflow';

const showOnlyForDomains = {
	resource: ['domain'],
};

export const domainDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForDomains,
		},
		options: [
			{
				name: 'List',
				value: 'list',
				action: 'List domains',
				description: 'List domains available to the account',
			},
		],
		default: 'list',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['domain'],
				operation: ['list'],
			},
		},
		options: [
			{
				name: 'All',
				value: 'all',
				description: 'Return both shared and custom domains',
			},
			{
				name: 'Shared Only',
				value: 'shared',
				description: 'Return only shared hosting domains',
			},
			{
				name: 'Custom Only',
				value: 'custom',
				description: 'Return only custom domains owned by the organization',
			},
		],
		default: 'all',
		description: 'Filter domains by type',
	},
];
