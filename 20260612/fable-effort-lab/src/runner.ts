import Anthropic from "@anthropic-ai/sdk";
import { costUsd, Effort, MODEL_ID, RunResult } from "./types.js";

export interface RunOptions {
  prompt: string;
  effort: Effort;
  maxTokens: number;
  showThinking: boolean;
  /** Stream text to stdout as it arrives (single-run mode). */
  echo: boolean;
}

/**
 * Run one prompt against claude-fable-5 at the given effort level.
 *
 * Fable 5 specifics handled here:
 *  - thinking is always on; the `thinking` param is omitted unless we want
 *    summarized display (an explicit {type: "disabled"} would 400)
 *  - depth is controlled via output_config.effort
 *  - safety classifiers can return stop_reason "refusal" on an HTTP 200,
 *    so stop_reason must be checked before reading content
 */
export async function runOnce(client: Anthropic, opts: RunOptions): Promise<RunResult> {
  const started = performance.now();
  let firstTokenAt: number | null = null;

  const base: RunResult = {
    effort: opts.effort,
    ok: false,
    refused: false,
    refusalCategory: null,
    refusalExplanation: null,
    text: "",
    thinkingSummary: "",
    stopReason: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    timeToFirstTokenMs: null,
  };

  try {
    const stream = client.messages.stream({
      model: MODEL_ID,
      max_tokens: opts.maxTokens,
      // No `thinking` field unless summaries are requested — always-on adaptive
      // thinking is the only mode on Fable 5.
      ...(opts.showThinking
        ? { thinking: { type: "adaptive", display: "summarized" } as never }
        : {}),
      output_config: { effort: opts.effort },
      messages: [{ role: "user", content: opts.prompt }],
    } as never);

    stream.on("text", (delta: string) => {
      if (firstTokenAt === null) firstTokenAt = performance.now();
      if (opts.echo) process.stdout.write(delta);
    });

    const message = await stream.finalMessage();
    const latencyMs = performance.now() - started;

    const result: RunResult = {
      ...base,
      stopReason: message.stop_reason ?? null,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      costUsd: costUsd(message.usage.input_tokens, message.usage.output_tokens),
      latencyMs,
      timeToFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - started,
    };

    // Branch on stop_reason, never on stop_details (informational, may be null)
    if (message.stop_reason === "refusal") {
      const details = (message as { stop_details?: { category?: string | null; explanation?: string | null } }).stop_details;
      return {
        ...result,
        refused: true,
        refusalCategory: details?.category ?? null,
        refusalExplanation: details?.explanation ?? null,
        // mid-stream refusals bill the partial output, but it must be discarded
        text: "",
      };
    }

    for (const block of message.content) {
      if (block.type === "text") result.text += block.text;
      if (block.type === "thinking" && block.thinking) {
        result.thinkingSummary += block.thinking;
      }
    }
    result.ok = true;
    return result;
  } catch (err) {
    return {
      ...base,
      latencyMs: performance.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface TokenizerComparison {
  newTokens: number;
  priorTokens: number | null;
  deltaPct: number | null;
}

/**
 * Count tokens under the Fable 5 tokenizer. The endpoint also returns
 * `input_tokens_prior_tokenizer` (the same request under the prior-generation
 * tokenizer) so the ~30% delta can be measured directly.
 */
export async function compareTokenizers(
  client: Anthropic,
  text: string,
): Promise<TokenizerComparison> {
  const res = await client.messages.countTokens({
    model: MODEL_ID,
    messages: [{ role: "user", content: text }],
  });
  const prior =
    (res as { input_tokens_prior_tokenizer?: number }).input_tokens_prior_tokenizer ?? null;
  return {
    newTokens: res.input_tokens,
    priorTokens: prior,
    deltaPct: prior ? ((res.input_tokens - prior) / prior) * 100 : null,
  };
}
