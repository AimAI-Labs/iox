// Verified against the linked official catalogs. Keep both locales in sync.
export const MODEL_CATALOG_UPDATED_AT = "2026-11-01";

export const PROVIDER_MODELS = {
  deepseek: {
    models: ["DeepSeek V4.1 Flash", "DeepSeek V4 Pro"],
    modelsUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
  },
  openai: {
    models: ["GPT-6 Astra", "GPT-6.1 Sol", "GPT-6.1 Terra", "GPT-6 Luna"],
    modelsUrl: "https://developers.openai.com/api/docs/models",
  },
  claude: {
    models: ["Claude Fable 5.1", "Claude Opus 5.5", "Claude Sonnet 5.5", "Claude Haiku 5.5"],
    modelsUrl: "https://platform.claude.com/docs/en/models/overview",
  },
  qwen: {
    models: ["Qwen3.8 Max", "Qwen3.7 Plus", "Qwen3.8 Flash"],
    modelsUrl: "https://www.alibabacloud.com/help/en/model-studio/text-generation-model",
  },
  gemini: {
    models: ["Gemini 4 Argon", "Gemini 3.8 Flash", "Gemini 3.5 Flash-Lite"],
    modelsUrl: "https://ai.google.dev/gemini-api/docs/models",
  },
  local: {
    models: ["Qwen3.8", "Gemma 4", "Muse Glimmer"],
    modelsUrl: "https://ollama.com/search",
  },
} as const;
