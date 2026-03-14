import { TemplateRegistry } from '../../inferutils/schemaFormatters';
import { PhaseConceptSchema, type PhaseConceptType } from '../../schemas';
import type { IssueReport } from '../../domain/values/IssueReport';
import type { UserContext } from '../../core/types';
import { issuesPromptFormatter, PROMPT_UTILS } from '../../prompts';

export const PHASE_IMPLEMENTATION_SYSTEM_PROMPT = `You are implementing a phase in a React + TypeScript codebase.

<UX_RUBRIC>
- Layout: responsive, consistent spacing, clear hierarchy.
- Interaction: hover/focus states, sensible transitions.
- States: loading/empty/error handled.
- Accessibility: labels/aria where needed, keyboard focus visible.
</UX_RUBRIC>

<RELIABILITY>
- No TS errors.
- No hooks violations.
- No render loops.
- No whole-store selectors.
</RELIABILITY>

${PROMPT_UTILS.UI_NON_NEGOTIABLES_V3}

${PROMPT_UTILS.COMMON_PITFALLS}

${PROMPT_UTILS.COMMON_DEP_DOCUMENTATION}

<DEPENDENCIES>
{{dependencies}}

{{blueprintDependencies}}
</DEPENDENCIES>

{{template}}

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<PLATFORM_SDK>
The @jelly/platform SDK is pre-installed. Use it for:
- Auth: import { platform } from '@jelly/platform'; const user = await platform.auth.requireUser();
- Social graph: platform.graph.link/unlink/query (follow, friend, subscribe, etc.)
- Content objects: platform.objects.create/get/update/delete/query (posts, articles, listings, etc.)
- Payments: platform.ledger.balance/transfer/history
- Marketplace: platform.marketplace.getListing/checkout/myPurchases/searchComponents/getComponent

Rules:
- Never implement custom authentication. Use platform.auth.requireUser() or platform.auth.getUser().
- For social features, use platform.graph and platform.objects instead of custom storage.
- For payments, use platform.ledger instead of direct Stripe integration.
- Before building complex UI components from scratch, check if a reusable component exists via platform.marketplace.searchComponents().
</PLATFORM_SDK>`;

const PHASE_IMPLEMENTATION_USER_PROMPT_TEMPLATE = `Phase Implementation

<OUTPUT_REQUIREMENTS>
- Output exactly {{fileCount}} files.
- One cat block per file.
- Output only file contents (no commentary).
</OUTPUT_REQUIREMENTS>

<ZUSTAND_STORE_LAW>
- One field per store call: useStore(s => s.field)
- NEVER: useStore(s => s) / useStore((state)=>state)
- NEVER destructure store results
- NEVER return object/array from selector
If you need multiple values/actions, write multiple store calls.
Example:
BAD: const { openWindow, setActiveWindow } = useOSStore(s => s)
GOOD: const openWindow = useOSStore(s => s.openWindow); const setActiveWindow = useOSStore(s => s.setActiveWindow)
</ZUSTAND_STORE_LAW>

<CURRENT_PHASE>
{{phaseText}}

{{issues}}

{{userSuggestions}}
</CURRENT_PHASE>`;

const formatUserSuggestions = (suggestions?: string[] | null): string => {
	if (!suggestions || suggestions.length === 0) return '';

	return `Client feedback to address in this phase:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
};

export function formatPhaseImplementationUserPrompt(args: {
	phaseText: string;
	issuesText?: string;
	userSuggestionsText?: string;
	fileCount?: number;
}): string {
	const prompt = PROMPT_UTILS.replaceTemplateVariables(PHASE_IMPLEMENTATION_USER_PROMPT_TEMPLATE, {
		phaseText: args.phaseText,
		issues: args.issuesText ?? '',
		userSuggestions: args.userSuggestionsText ?? '',
		fileCount: String(args.fileCount ?? 0),
	});

	return PROMPT_UTILS.verifyPrompt(prompt);
}

export function buildPhaseImplementationUserPrompt(args: {
	phase: PhaseConceptType;
	issues: IssueReport;
	userContext?: UserContext;
}): string {
	const phaseText = TemplateRegistry.markdown.serialize(args.phase, PhaseConceptSchema);
	const fileCount = args.phase.files?.length ?? 0;

	return formatPhaseImplementationUserPrompt({
		phaseText,
		issuesText: issuesPromptFormatter(args.issues),
		userSuggestionsText: formatUserSuggestions(args.userContext?.suggestions),
		fileCount,
	});
}
