use std::fs;
use std::io::{self, Read};
use std::path::Path;
use std::process::ExitCode;

use rrf_hybrid_search::{HybridIndex, tokenize};

const DEFAULT_K_RRF: f64 = 60.0;
const DEFAULT_TOP_K: usize = 5;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(String::as_str).unwrap_or("");
    let rest = &args[args.len().min(2)..];

    let result = match cmd {
        "demo" => cmd_demo(rest),
        "search" => cmd_search(rest),
        "-h" | "--help" | "help" | "" => {
            usage();
            Ok(())
        }
        other => {
            eprintln!("unknown command: {other:?}\n");
            usage();
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::from(1)
        }
    }
}

fn usage() {
    eprintln!(
        "rrf-hybrid-search — BM25 + trigram-cosine retrieval fused with Reciprocal Rank Fusion

usage:
  rrf-hybrid-search demo [--query Q] [--top N] [--k K]
        Run the built-in corpus + sample query. Pass --query to override.

  rrf-hybrid-search search --corpus PATH --query Q [--top N] [--k K]
        PATH may be a directory of .txt files (one doc per file) OR a single
        file with one doc per line. Use '-' to read the corpus from stdin
        (one doc per non-empty line).

options:
  --top N      number of hits to print (default 5)
  --k K        RRF smoothing constant (default 60, per Cormack et al. 2009)
"
    );
}

#[derive(Default)]
struct Flags {
    query: Option<String>,
    corpus: Option<String>,
    top: Option<usize>,
    k: Option<f64>,
}

fn parse_flags(args: &[String]) -> Result<Flags, String> {
    let mut f = Flags::default();
    let mut i = 0;
    while i < args.len() {
        let key = &args[i];
        let val = args.get(i + 1).cloned();
        let need = |v: Option<String>, name: &str| {
            v.ok_or_else(|| format!("{name} requires a value"))
        };
        match key.as_str() {
            "--query" | "-q" => {
                f.query = Some(need(val, key)?);
                i += 2;
            }
            "--corpus" | "-c" => {
                f.corpus = Some(need(val, key)?);
                i += 2;
            }
            "--top" => {
                f.top = Some(
                    need(val, key)?
                        .parse()
                        .map_err(|e| format!("--top: {e}"))?,
                );
                i += 2;
            }
            "--k" => {
                f.k = Some(
                    need(val, key)?
                        .parse()
                        .map_err(|e| format!("--k: {e}"))?,
                );
                i += 2;
            }
            other => return Err(format!("unknown flag {other:?}")),
        }
    }
    Ok(f)
}

fn cmd_demo(args: &[String]) -> Result<(), String> {
    let flags = parse_flags(args)?;
    let docs = demo_corpus();
    let query = flags
        .query
        .unwrap_or_else(|| "post quantum encryption migration".to_string());
    run(&docs, &query, flags.top.unwrap_or(DEFAULT_TOP_K), flags.k.unwrap_or(DEFAULT_K_RRF))
}

fn cmd_search(args: &[String]) -> Result<(), String> {
    let flags = parse_flags(args)?;
    let corpus = flags
        .corpus
        .ok_or_else(|| "--corpus is required (use 'demo' for the built-in corpus)".to_string())?;
    let query = flags
        .query
        .ok_or_else(|| "--query is required".to_string())?;
    let docs = load_corpus(&corpus)?;
    if docs.is_empty() {
        return Err(format!("corpus {corpus:?} is empty"));
    }
    run(&docs, &query, flags.top.unwrap_or(DEFAULT_TOP_K), flags.k.unwrap_or(DEFAULT_K_RRF))
}

fn run(docs: &[String], query: &str, top: usize, k_rrf: f64) -> Result<(), String> {
    let index = HybridIndex::build(docs.to_vec());

    println!("corpus       : {} documents", docs.len());
    println!("query        : {query}");
    println!("RRF k        : {k_rrf}");
    println!("retrievers   : BM25 (sparse/lexical) + trigram cosine (dense-ish)");
    println!();

    // Show per-retriever top-K then the fused result, so the fusion effect
    // is visible.
    let q_tokens = tokenize::tokens(query);
    let q_trigrams = tokenize::char_trigrams(query);
    let bm25 = index.bm25.score(&q_tokens);
    let vec = index.vector.score(&q_trigrams);

    print_single("BM25 (lexical)", &bm25, docs, top);
    print_single("Trigram cosine (morphological)", &vec, docs, top);

    let hits = index.search(query, top, k_rrf);
    println!("=== RRF-fused top {} ===", hits.len());
    println!(
        "{:<5} {:<10} {:<8} {:<8} {:<8} {:<8}  doc",
        "#", "rrf", "bm25#", "bm25", "vec#", "vec"
    );
    for (i, h) in hits.iter().enumerate() {
        let preview = snippet(&docs[h.doc_id], 70);
        println!(
            "{:<5} {:<10.6} {:<8} {:<8.3} {:<8} {:<8.3}  {}",
            i + 1,
            h.rrf_score,
            h.bm25_rank.map(|r| r.to_string()).unwrap_or_else(|| "-".into()),
            h.bm25_score,
            h.vector_rank.map(|r| r.to_string()).unwrap_or_else(|| "-".into()),
            h.vector_score,
            preview
        );
    }
    Ok(())
}

fn print_single(title: &str, ranked: &[(usize, f64)], docs: &[String], top: usize) {
    println!("--- {title} top {} ---", ranked.len().min(top));
    if ranked.is_empty() {
        println!("  (no matches)");
        println!();
        return;
    }
    for (rank, &(doc_id, score)) in ranked.iter().take(top).enumerate() {
        println!(
            "  {:>2}. score={:.3}  doc#{:<3} {}",
            rank + 1,
            score,
            doc_id,
            snippet(&docs[doc_id], 70)
        );
    }
    println!();
}

fn snippet(s: &str, max_chars: usize) -> String {
    let collapsed: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut out = String::new();
    for (i, ch) in collapsed.chars().enumerate() {
        if i == max_chars {
            out.push('…');
            return out;
        }
        out.push(ch);
    }
    out
}

fn load_corpus(path: &str) -> Result<Vec<String>, String> {
    if path == "-" {
        let mut buf = String::new();
        io::stdin()
            .read_to_string(&mut buf)
            .map_err(|e| format!("read stdin: {e}"))?;
        return Ok(split_lines(&buf));
    }
    let p = Path::new(path);
    let meta = fs::metadata(p).map_err(|e| format!("stat {path:?}: {e}"))?;
    if meta.is_dir() {
        let mut entries: Vec<_> = fs::read_dir(p)
            .map_err(|e| format!("read_dir {path:?}: {e}"))?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|x| x == "txt").unwrap_or(false))
            .collect();
        entries.sort_by_key(|e| e.path());
        let mut out = Vec::with_capacity(entries.len());
        for e in entries {
            let p = e.path();
            let s = fs::read_to_string(&p)
                .map_err(|err| format!("read {p:?}: {err}"))?;
            out.push(s);
        }
        Ok(out)
    } else {
        let s = fs::read_to_string(p).map_err(|e| format!("read {path:?}: {e}"))?;
        Ok(split_lines(&s))
    }
}

fn split_lines(s: &str) -> Vec<String> {
    s.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

fn demo_corpus() -> Vec<String> {
    vec![
        // 0 — exact lexical match for "post quantum encryption migration"
        "Post-quantum encryption migration: enterprises plan their move from RSA to ML-KEM under tight 2026 deadlines.".to_string(),
        // 1 — semantically related, different vocabulary (vector should help)
        "Cryptographers warn that harvest-now-decrypt-later attacks force a rethink of how long-lived secrets are protected.".to_string(),
        // 2 — morphologically related: "encrypts" / "encrypted" trigrams overlap with "encryption"
        "Google Chrome already encrypts TLS handshakes with X25519 + ML-KEM-768 by default.".to_string(),
        // 3 — adjacent topic but not directly related
        "Reciprocal Rank Fusion is the de-facto algorithm for combining lexical and vector retrievers in production RAG.".to_string(),
        // 4 — keyword overlap on "migration" only
        "Schema migrations in Postgres still trip up CI pipelines years after the same lesson has been written up.".to_string(),
        // 5 — purely vector-similar through trigrams ("quant-" etc.) but no exact tokens
        "Quantum-safe key encapsulation mechanisms are now shipping in browsers, VPNs and messaging apps.".to_string(),
        // 6 — distractor
        "The best ramen in Tokyo, ranked: a 2026 spring guide to broths, noodles and toppings.".to_string(),
        // 7 — distractor with one keyword overlap
        "OpenAI's Ads Manager lets brands buy promoted answers inside ChatGPT for the first time.".to_string(),
        // 8 — focused on RAG / RRF (the fusion topic itself)
        "Hybrid search done right: BM25 + dense vectors fused via RRF beats either retriever alone on every BEIR slice.".to_string(),
        // 9 — distractor
        "NASA tests a next-generation space computer that may let deep-space probes act far more autonomously.".to_string(),
    ]
}
