/**
 * A tiny, dependency-free, deterministic text embedder.
 *
 * Production agent-memory stacks call out to a hosted embedding model, but that
 * needs network access and an API key. To keep this project fully runnable
 * offline we use a hashed bag-of-words vector ("feature hashing") with
 * sub-linear term-frequency weighting and L2 normalisation. It is good enough to
 * rank semantically overlapping sentences above unrelated ones, which is all the
 * retrieval layer needs to demonstrate the architecture.
 */

/** Dimensionality of the embedding space. */
export const EMBED_DIM = 256;

/** Lower-case, split on non-word characters, drop empties and 1-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length > 1);
}

/** FNV-1a 32-bit hash — fast, stable across runs and platforms. */
function fnv1a(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Embed text into a unit-length vector. Each token is hashed into a bucket; a
 * second sign hash reduces collisions by letting buckets add or subtract.
 */
export function embed(text: string): Float32Array {
  const vec = new Float32Array(EMBED_DIM);
  const counts = new Map<string, number>();
  for (const tok of tokenize(text)) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  for (const [tok, count] of counts) {
    const h = fnv1a(tok);
    const bucket = h % EMBED_DIM;
    const sign = (h & 0x100) === 0 ? 1 : -1;
    // Sub-linear TF weighting dampens the effect of repeated tokens.
    vec[bucket] += sign * (1 + Math.log(count));
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBED_DIM; i++) vec[i] /= norm;
  }
  return vec;
}

/** Cosine similarity of two L2-normalised vectors (i.e. their dot product). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  // Clamp into [0, 1]; negative cosine just means "unrelated" here.
  return dot < 0 ? 0 : dot > 1 ? 1 : dot;
}
