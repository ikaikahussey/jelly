import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { KernelComponentsService } from '../../../kernel/components';

export type SearchComponentsResult =
	| { components: { name: string; description: string | null; interface: { provides: string[]; consumes: string[] } | null; component_id: string }[] }
	| { error: string };

export function createSearchComponentsTool(
	env: Env,
	logger: StructuredLogger
) {
	return tool({
		name: 'search_components',
		description: 'Search the platform component registry for reusable components. Use this before building complex UI from scratch to check if a matching component already exists.',
		args: {
			query: t.string().describe('Search query describing the component you need (e.g. "expense tracker", "data table", "chart")'),
			limit: t.number().default(5).describe('Max number of results'),
		},
		run: async ({ query, limit }) => {
			try {
				logger.info('Searching components', { query, limit });
				const componentsService = new KernelComponentsService(env);
				const result = await componentsService.search({ query, limit });

				return {
					components: result.components.map((c) => ({
						component_id: c.componentId,
						name: c.name,
						description: c.description,
						interface: c.interfaceJson ? JSON.parse(c.interfaceJson) : null,
					})),
				};
			} catch (error) {
				return {
					error: error instanceof Error
						? `Failed to search components: ${error.message}`
						: 'Unknown error searching components',
				};
			}
		},
	});
}
