/**
 * Self-contained skill handlers used by the example agents.
 *
 * Each handler is a pure-ish function that turns a free-text request into
 * a result string + optional structured data. No external LLM or network
 * calls are required, so the whole mesh runs fully offline.
 */

import type { AgentSkill } from "./types.js";

export interface SkillResult {
  text: string;
  data?: Record<string, unknown>;
}

export type SkillHandler = (input: string) => SkillResult;

export interface SkillImpl {
  card: AgentSkill;
  handle: SkillHandler;
}

/** Safe arithmetic evaluator — supports + - * / ( ) and decimals only. */
function evalArithmetic(expr: string): number {
  const cleaned = expr.replace(/[^0-9+\-*/().\s]/g, "");
  if (!cleaned.trim()) throw new Error("no arithmetic expression found");
  // Shunting-yard to RPN, then evaluate. Avoids `eval`.
  const tokens = cleaned.match(/(\d+\.?\d*|[+\-*/()])/g) ?? [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const output: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/\d/.test(t)) {
      output.push(t);
    } else if (t in prec) {
      while (
        ops.length &&
        ops[ops.length - 1]! in prec &&
        prec[ops[ops.length - 1]!]! >= prec[t]!
      ) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    } else if (t === "(") {
      ops.push(t);
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      ops.pop();
    }
  }
  while (ops.length) output.push(ops.pop()!);

  const stack: number[] = [];
  for (const t of output) {
    if (/\d/.test(t)) {
      stack.push(parseFloat(t));
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("malformed expression");
      if (t === "+") stack.push(a + b);
      else if (t === "-") stack.push(a - b);
      else if (t === "*") stack.push(a * b);
      else if (t === "/") stack.push(a / b);
    }
  }
  const result = stack.pop();
  if (result === undefined || Number.isNaN(result)) {
    throw new Error("could not evaluate expression");
  }
  return result;
}

export const calculatorSkill: SkillImpl = {
  card: {
    id: "calculate",
    name: "Arithmetic Calculator",
    description: "Evaluates an arithmetic expression embedded in the request.",
    tags: ["math", "calculate", "arithmetic"],
    examples: ["What is (1200 + 800) * 1.05 ?"],
  },
  handle(input) {
    const value = evalArithmetic(input);
    const rounded = Math.round(value * 100) / 100;
    return { text: `result = ${rounded}`, data: { value: rounded } };
  },
};

/** Pull all currency-style amounts out of free text. */
export const amountExtractorSkill: SkillImpl = {
  card: {
    id: "extract-amounts",
    name: "Amount Extractor",
    description: "Extracts monetary amounts from a transaction description.",
    tags: ["text", "extract", "finance"],
    examples: ["Wire of $12,500 and a fee of $35.50"],
  },
  handle(input) {
    const matches = input.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) ?? [];
    const amounts = matches
      .map((m) => parseFloat(m.replace(/[$,]/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const total = amounts.reduce((a, b) => a + b, 0);
    return {
      text: `found ${amounts.length} amount(s); total = ${total}`,
      data: { amounts, total },
    };
  },
};

const POSITIVE = ["good", "great", "approved", "clear", "safe", "ok", "pass"];
const NEGATIVE = ["bad", "fraud", "risk", "denied", "flag", "suspicious", "fail"];

export const sentimentSkill: SkillImpl = {
  card: {
    id: "sentiment",
    name: "Sentiment Classifier",
    description: "Naive lexicon-based sentiment classification of text.",
    tags: ["text", "nlp", "sentiment"],
    examples: ["This transaction looks suspicious and risky"],
  },
  handle(input) {
    const words = input.toLowerCase().split(/\W+/);
    let score = 0;
    for (const w of words) {
      if (POSITIVE.includes(w)) score += 1;
      if (NEGATIVE.includes(w)) score -= 1;
    }
    const label = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
    return { text: `sentiment = ${label} (score ${score})`, data: { label, score } };
  },
};

/**
 * Compliance check that mirrors the Build 2026 Azure Agent Mesh demo:
 * flag any amount above a regulatory threshold for manual review.
 */
export const complianceSkill: SkillImpl = {
  card: {
    id: "compliance-check",
    name: "Compliance Checker",
    description:
      "Flags a monetary total against a regulatory reporting threshold ($10,000).",
    tags: ["compliance", "finance", "governance"],
    examples: ["Check total 12500 against threshold"],
  },
  handle(input) {
    const threshold = 10000;
    const nums = (input.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    const total = nums.length ? Math.max(...nums) : 0;
    const flagged = total >= threshold;
    return {
      text: flagged
        ? `FLAGGED: total ${total} >= threshold ${threshold} — file regulatory report`
        : `CLEAR: total ${total} < threshold ${threshold}`,
      data: { total, threshold, flagged },
    };
  },
};
