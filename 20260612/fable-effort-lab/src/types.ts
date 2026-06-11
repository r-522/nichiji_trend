export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export const MODEL_ID = "claude-fable-5";

// Claude Fable 5 pricing (USD per 1M tokens)
export const PRICE_INPUT_PER_MTOK = 10.0;
export const PRICE_OUTPUT_PER_MTOK = 50.0;

export interface RunResult {
  effort: Effort;
  ok: boolean;
  refused: boolean;
  refusalCategory: string | null;
  refusalExplanation: string | null;
  text: string;
  thinkingSummary: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  timeToFirstTokenMs: number | null;
  error?: string;
}

export function isEffort(value: string): value is Effort {
  return (EFFORT_LEVELS as readonly string[]).includes(value);
}

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK
  );
}
