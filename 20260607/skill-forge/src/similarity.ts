/**
 * Dependency-free lexical similarity.
 *
 * Production agent-memory systems reach for vector embeddings, but to keep
 * skill-forge fully self-contained and deterministic we use a bag-of-words
 * TF vector with cosine similarity. It is good enough to demonstrate
 * retrieval-by-relevance without any network or model dependency.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "with",
  "is", "are", "be", "this", "that", "it", "as", "by", "at", "from",
]);

/** Lowercase, split on non-word chars, drop stop words and tiny tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Build a term-frequency map for a list of tokens. */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const tok of tokens) {
    tf.set(tok, (tf.get(tok) ?? 0) + 1);
  }
  return tf;
}

/** Cosine similarity in [0, 1] between two pieces of text. */
export function cosineSimilarity(a: string, b: string): number {
  const tfA = termFrequency(tokenize(a));
  const tfB = termFrequency(tokenize(b));
  if (tfA.size === 0 || tfB.size === 0) return 0;

  let dot = 0;
  for (const [term, freq] of tfA) {
    const other = tfB.get(term);
    if (other !== undefined) dot += freq * other;
  }

  const magA = Math.sqrt([...tfA.values()].reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt([...tfB.values()].reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;

  return dot / (magA * magB);
}
