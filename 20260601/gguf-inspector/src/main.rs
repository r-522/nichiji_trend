//! CLI entrypoint.
//!
//! Usage:
//!   gguf-inspector <file.gguf> [--json] [--max-metadata N] [--max-tensors N]
//!   gguf-inspector --demo       [--json] [--max-metadata N] [--max-tensors N]
//!   gguf-inspector --help | --version

use std::fs;
use std::io::{self, Write};
use std::process::ExitCode;

use gguf_inspector::{fixture, gguf, report::Report};

const USAGE: &str = "\
gguf-inspector  —  inspect GGUF v3 model files (on-device LLM tooling, 2026-06-01)

USAGE:
  gguf-inspector <PATH>        [--json] [--max-metadata N] [--max-tensors N]
  gguf-inspector --demo        [--json] [--max-metadata N] [--max-tensors N]
  gguf-inspector --help | --version

OPTIONS:
  --json              Emit machine-readable JSON instead of the human report.
  --max-metadata N    Limit metadata lines shown in human mode (default 32).
  --max-tensors  N    Limit tensor lines shown in human mode  (default 24).
  --demo              Parse an in-memory fixture (no input file needed).
  --help              Show this help.
  --version           Print version.
";

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(msg) => {
            let _ = writeln!(io::stderr(), "gguf-inspector: {msg}");
            ExitCode::from(1)
        }
    }
}

struct Args {
    path: Option<String>,
    demo: bool,
    json: bool,
    max_metadata: usize,
    max_tensors: usize,
}

fn parse_args() -> Result<Option<Args>, String> {
    let mut it = std::env::args().skip(1);
    let mut args = Args {
        path: None,
        demo: false,
        json: false,
        max_metadata: 32,
        max_tensors: 24,
    };
    while let Some(a) = it.next() {
        match a.as_str() {
            "--help" | "-h" => {
                println!("{USAGE}");
                return Ok(None);
            }
            "--version" | "-V" => {
                println!("gguf-inspector {}", env!("CARGO_PKG_VERSION"));
                return Ok(None);
            }
            "--demo" => args.demo = true,
            "--json" => args.json = true,
            "--max-metadata" => {
                let v = it.next().ok_or("--max-metadata requires a value")?;
                args.max_metadata = v.parse().map_err(|_| "--max-metadata: bad integer")?;
            }
            "--max-tensors" => {
                let v = it.next().ok_or("--max-tensors requires a value")?;
                args.max_tensors = v.parse().map_err(|_| "--max-tensors: bad integer")?;
            }
            other if other.starts_with("--") => {
                return Err(format!("unknown flag: {other}"));
            }
            path => {
                if args.path.is_some() {
                    return Err("only one input path is accepted".into());
                }
                args.path = Some(path.to_owned());
            }
        }
    }
    if !args.demo && args.path.is_none() {
        return Err("missing input file (try --demo or --help)".into());
    }
    Ok(Some(args))
}

fn run() -> Result<(), String> {
    let args = match parse_args()? {
        Some(a) => a,
        None => return Ok(()),
    };

    let bytes: Vec<u8> = if args.demo {
        fixture::build()
    } else {
        let path = args.path.as_ref().unwrap();
        fs::read(path).map_err(|e| format!("failed to read {path}: {e}"))?
    };

    let file = gguf::parse(&bytes).map_err(|e| format!("parse error: {e}"))?;
    let report = Report::new(&file);

    let mut out = io::stdout().lock();
    let text = if args.json {
        report.render_json()
    } else {
        report.render_human(args.max_metadata, args.max_tensors)
    };
    out.write_all(text.as_bytes())
        .map_err(|e| format!("write error: {e}"))?;
    if !text.ends_with('\n') {
        let _ = out.write_all(b"\n");
    }
    Ok(())
}
