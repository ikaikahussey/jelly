import { 
    AgentActionKey, 
    AgentConfig, 
    AgentConstraintConfig, 
    AIModels,
    AllModels,
    LiteModels,
    RegularModels,
} from "./config.types";
// Common configs - these are good defaults
const COMMON_AGENT_CONFIGS = {
    screenshotAnalysis: {
        name: AIModels.DISABLED,
        reasoning_effort: 'medium' as const,
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    realtimeCodeFixer: {
        name: AIModels.GROK_4_1_FAST_NON_REASONING,
        reasoning_effort: 'low' as const,
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fastCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GROK_4_1_FAST_NON_REASONING,
        temperature: 1,
    },
} as const;

const SHARED_IMPLEMENTATION_CONFIG = {
    reasoning_effort: 'low' as const,
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_2_5_PRO,
};

//======================================================================================
// ATTENTION! Platform config requires specific API keys and Cloudflare AI Gateway setup.
//======================================================================================
/* 
These are the configs used at build.cloudflare.dev 
You may need to provide API keys for these models in your environment or use 
Cloudflare AI Gateway unified billing for seamless model access without managing multiple keys.
*/
const PLATFORM_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    blueprint: {
        name: AIModels.GEMINI_3_PRO_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 20000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 1.0,
    },
    projectSetup: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.OPENAI_5_MINI,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    conversationalResponse: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'low',
        max_tokens: 4000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    deepDebugger: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.GROK_4_1_FAST_NON_REASONING,
        reasoning_effort: 'low',
        max_tokens: 16000,
        temperature: 0.0,
        fallbackModel: AIModels.GROK_CODE_FAST_1,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
};

//======================================================================================
// Default Gemini-only config (most likely used in your deployment)
//======================================================================================
/* These are the default out-of-the box gemini-only models used when PLATFORM_MODEL_PROVIDERS is not set */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 0.6,
    },
    blueprint: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 64000,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
        temperature: 1,
    },
    projectSetup: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        ...SHARED_IMPLEMENTATION_CONFIG,
    },
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'low',
        max_tokens: 4000,
        temperature: 0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    deepDebugger: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fileRegeneration: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
};

//======================================================================================
// Ollama / self-hosted config (zero cost, runs on your own GPU)
//======================================================================================
/* Set OLLAMA_BASE_URL env var to point at your Ollama instance.
   Set OLLAMA_MODEL to override the default model (default: qwen3:32b).
   Works with any Ollama model that supports OpenAI-compatible chat completions. */
const OLLAMA_SHARED_CONFIG = {
    reasoning_effort: undefined,
    max_tokens: 32000,
    temperature: 0.7,
    fallbackModel: AIModels.OLLAMA_QWEN3,
};

function buildOllamaConfig(model: string): AgentConfig {
    const ollamaModel = `ollama/${model}` as AIModels;
    return {
        screenshotAnalysis: {
            name: AIModels.DISABLED,
            reasoning_effort: undefined,
            max_tokens: 8000,
            temperature: 1,
            fallbackModel: ollamaModel,
        },
        realtimeCodeFixer: {
            name: ollamaModel,
            reasoning_effort: undefined,
            max_tokens: 32000,
            temperature: 0.2,
            fallbackModel: ollamaModel,
        },
        fastCodeFixer: {
            name: AIModels.DISABLED,
            reasoning_effort: undefined,
            max_tokens: 32000,
            temperature: 0.0,
            fallbackModel: ollamaModel,
        },
        templateSelection: {
            name: ollamaModel,
            max_tokens: 2000,
            fallbackModel: ollamaModel,
            temperature: 0.6,
        },
        blueprint: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
            max_tokens: 20000,
        },
        projectSetup: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
        },
        phaseGeneration: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
        },
        firstPhaseImplementation: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
            max_tokens: 48000,
        },
        phaseImplementation: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
            max_tokens: 48000,
        },
        conversationalResponse: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
            max_tokens: 4000,
        },
        deepDebugger: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
        },
        fileRegeneration: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
        },
        agenticProjectBuilder: {
            name: ollamaModel,
            ...OLLAMA_SHARED_CONFIG,
        },
    };
}

/** Default config used when no env is available (fallback) */
export const AGENT_CONFIG: AgentConfig = DEFAULT_AGENT_CONFIG;

/** Get the agent config, checking env for platform overrides */
export function getAgentConfig(env?: {
    PLATFORM_MODEL_PROVIDERS?: unknown;
    OLLAMA_BASE_URL?: string;
    OLLAMA_MODEL?: string;
}): AgentConfig {
    if (env?.OLLAMA_BASE_URL) {
        return buildOllamaConfig(env.OLLAMA_MODEL ?? 'qwen3:32b');
    }
    return env?.PLATFORM_MODEL_PROVIDERS ? PLATFORM_AGENT_CONFIG : DEFAULT_AGENT_CONFIG;
}


export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
	['fastCodeFixer', {
		allowedModels: new Set([AIModels.DISABLED]),
		enabled: true,
	}],
	['realtimeCodeFixer', {
		allowedModels: new Set([AIModels.DISABLED]),
		enabled: true,
	}],
	['fileRegeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['phaseGeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['projectSetup', {
		allowedModels: new Set([...RegularModels, AIModels.GEMINI_2_5_PRO]),
		enabled: true,
	}],
	['conversationalResponse', {
		allowedModels: new Set(RegularModels),
		enabled: true,
	}],
	['templateSelection', {
		allowedModels: new Set(LiteModels),
		enabled: true,
	}],
]);