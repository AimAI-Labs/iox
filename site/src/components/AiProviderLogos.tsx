import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono";
import DeepSeek from "@lobehub/icons/es/DeepSeek/components/Mono";
import Claude from "@lobehub/icons/es/Claude/components/Mono";
import Qwen from "@lobehub/icons/es/Qwen/components/Mono";
import Gemini from "@lobehub/icons/es/Gemini/components/Mono";
import Ollama from "@lobehub/icons/es/Ollama/components/Mono";

const PROVIDERS = [
  { name: "OpenAI", Icon: OpenAI },
  { name: "DeepSeek", Icon: DeepSeek },
  { name: "Claude", Icon: Claude },
  { name: "Qwen", Icon: Qwen },
  { name: "Gemini", Icon: Gemini },
  { name: "Ollama", Icon: Ollama },
];

export function AiProviderLogos({ label }: { label: string }) {
  return (
    <div className="logos" role="group" aria-label={label}>
      {PROVIDERS.map(({ name, Icon }) => (
        <div className="logo-item" key={name}>
          <Icon size={20} aria-hidden="true" />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}
