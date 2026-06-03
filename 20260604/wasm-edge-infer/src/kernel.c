/*
 * kernel.c — portable neural-inference kernel for wasm-edge-infer.
 *
 * Compiled to a freestanding wasm32 module (no libc, no WASI imports) so the
 * exact same binary runs unchanged in a browser, in Node.js, on a Raspberry Pi
 * or inside an edge runtime (Wasmtime / WasmEdge / Cloudflare Workers).
 *
 * The kernel only knows how to crunch float math on its own linear memory.
 * The host (TypeScript) owns the model: it writes weights/inputs into memory,
 * sequences the layers, and reads the result back. This is the same
 * "host drives a portable compute kernel" shape that WASI-NN standardises.
 *
 * All pointers are i32 byte offsets into the wasm linear memory. Tensors are
 * 32-bit floats laid out row-major.
 */

#define HEAP_SIZE (1 << 16) /* 64 KiB scratch arena, plenty for tiny models */

/* Static arena. Declaring it forces the linker to reserve enough memory pages,
 * and &arena gives us a stable base offset to bump-allocate from. */
static unsigned char arena[HEAP_SIZE];
static unsigned int bump = 0;

/* Freestanding builds have no libc, but the compiler may still lower struct/
 * array operations to these symbols, so provide minimal implementations. */
void *memset(void *d, int c, unsigned long n) {
    unsigned char *p = (unsigned char *)d;
    for (unsigned long i = 0; i < n; i++) p[i] = (unsigned char)c;
    return d;
}
void *memcpy(void *d, const void *s, unsigned long n) {
    unsigned char *a = (unsigned char *)d;
    const unsigned char *b = (const unsigned char *)s;
    for (unsigned long i = 0; i < n; i++) a[i] = b[i];
    return d;
}

/* Bump allocator. Returns a byte offset (wasm32 pointer) aligned to 8 bytes.
 * Returns 0 (a deliberately unused offset) when the arena is exhausted. */
__attribute__((export_name("alloc")))
unsigned int alloc(unsigned int nbytes) {
    unsigned int aligned = (bump + 7u) & ~7u;
    if (aligned + nbytes > HEAP_SIZE) return 0;
    bump = aligned + nbytes;
    return (unsigned int)(arena - (unsigned char *)0) + aligned;
}

/* Reset the arena so the host can reuse memory across inference runs. */
__attribute__((export_name("reset")))
void reset(void) { bump = 0; }

/* Dense (fully-connected) layer: out[j] = bias[j] + sum_i weight[j*in_len+i]*in[i]
 * weight is an out_len x in_len row-major matrix. */
__attribute__((export_name("dense")))
void dense(unsigned int in_ptr, unsigned int in_len,
           unsigned int w_ptr, unsigned int b_ptr,
           unsigned int out_ptr, unsigned int out_len) {
    const float *in  = (const float *)in_ptr;
    const float *w   = (const float *)w_ptr;
    const float *b   = (const float *)b_ptr;
    float *out       = (float *)out_ptr;
    for (unsigned int j = 0; j < out_len; j++) {
        float acc = b ? b[j] : 0.0f;
        const float *row = w + (unsigned long)j * in_len;
        for (unsigned int i = 0; i < in_len; i++) acc += row[i] * in[i];
        out[j] = acc;
    }
}

/* In-place ReLU activation. */
__attribute__((export_name("relu")))
void relu(unsigned int ptr, unsigned int len) {
    float *v = (float *)ptr;
    for (unsigned int i = 0; i < len; i++) if (v[i] < 0.0f) v[i] = 0.0f;
}

/* Numerically-stable softmax, in place. Uses a small Taylor-free exp built on
 * the standard 2^x decomposition so we stay free of libm. */
static float k_exp(float x) {
    /* exp(x) = 2^(x/ln2). Split into integer and fractional parts. */
    const float LOG2E = 1.4426950408889634f;
    float t = x * LOG2E;
    int n = (int)(t + (t >= 0 ? 0.5f : -0.5f));
    float f = t - (float)n;            /* fractional part in [-0.5, 0.5] */
    /* 2^f via a 4th-order polynomial (max err < 1e-4 on the interval). */
    float p = 1.0f + f * (0.6931472f + f * (0.2402265f
              + f * (0.0555041f + f * 0.0096181f)));
    /* multiply by 2^n by hand-assembling the float exponent bits. */
    union { float f; unsigned int u; } b;
    int e = n + 127;
    if (e < 1)   return 0.0f;          /* underflow */
    if (e > 254) e = 254;              /* clamp overflow */
    b.u = ((unsigned int)e) << 23;
    return p * b.f;
}

__attribute__((export_name("softmax")))
void softmax(unsigned int ptr, unsigned int len) {
    float *v = (float *)ptr;
    float mx = v[0];
    for (unsigned int i = 1; i < len; i++) if (v[i] > mx) mx = v[i];
    float sum = 0.0f;
    for (unsigned int i = 0; i < len; i++) { v[i] = k_exp(v[i] - mx); sum += v[i]; }
    if (sum <= 0.0f) sum = 1.0f;
    for (unsigned int i = 0; i < len; i++) v[i] /= sum;
}

/* Index of the largest element — the predicted class. */
__attribute__((export_name("argmax")))
int argmax(unsigned int ptr, unsigned int len) {
    const float *v = (const float *)ptr;
    int best = 0;
    float bestv = v[0];
    for (unsigned int i = 1; i < len; i++) if (v[i] > bestv) { bestv = v[i]; best = (int)i; }
    return best;
}
