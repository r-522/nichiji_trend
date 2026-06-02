//! Tool registry. Each tool is a pure function: `&str` JSON-ish args -> `Result<String, String>`.
//!
//! Tools are intentionally side-effect-free (or read-only) so sub-agents can run
//! them in parallel without coordination. The argument format is a tiny key=value
//! line parser (deliberately not full JSON to stay zero-dependency).

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

pub type ToolFn = Arc<dyn Fn(&str) -> Result<String, String> + Send + Sync>;

#[derive(Clone)]
pub struct Tool {
    pub name: &'static str,
    pub description: &'static str,
    pub call: ToolFn,
}

#[derive(Clone, Default)]
pub struct ToolRegistry {
    tools: HashMap<&'static str, Tool>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, tool: Tool) {
        self.tools.insert(tool.name, tool);
    }

    pub fn get(&self, name: &str) -> Option<&Tool> {
        self.tools.get(name)
    }

    pub fn names(&self) -> Vec<&'static str> {
        let mut v: Vec<&'static str> = self.tools.keys().copied().collect();
        v.sort_unstable();
        v
    }

    pub fn describe(&self) -> String {
        let mut out = String::new();
        for name in self.names() {
            let t = &self.tools[name];
            out.push_str(&format!("- {:<14} {}\n", t.name, t.description));
        }
        out
    }

    pub fn with_defaults() -> Self {
        let mut r = Self::new();
        r.register(Tool {
            name: "calc",
            description: "Evaluate a simple +,-,*,/ expression on integers. args: expr=...",
            call: Arc::new(tool_calc),
        });
        r.register(Tool {
            name: "text_stats",
            description: "Return char/word/line counts. args: text=...",
            call: Arc::new(tool_text_stats),
        });
        r.register(Tool {
            name: "reverse",
            description: "Reverse a string. args: text=...",
            call: Arc::new(tool_reverse),
        });
        r.register(Tool {
            name: "uppercase",
            description: "Uppercase a string. args: text=...",
            call: Arc::new(tool_upper),
        });
        r.register(Tool {
            name: "jst_time",
            description: "Return the current JST (UTC+9) wall-clock time.",
            call: Arc::new(|_args| tool_jst()),
        });
        r.register(Tool {
            name: "sleep_ms",
            description: "Sleep N milliseconds (useful for showcasing parallelism). args: ms=...",
            call: Arc::new(tool_sleep),
        });
        r.register(Tool {
            name: "echo",
            description: "Return the text as-is. args: text=...",
            call: Arc::new(|args| Ok(parse_args(args).get("text").cloned().unwrap_or_default())),
        });
        r
    }
}

/// Parse `key=value key2=value2` into a map. Values containing spaces must be
/// wrapped in single quotes: `text='hello world'`.
pub fn parse_args(args: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let bytes = args.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        let key_start = i;
        while i < bytes.len() && bytes[i] != b'=' && !bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        let key = String::from_utf8_lossy(&bytes[key_start..i]).into_owned();
        if i >= bytes.len() || bytes[i] != b'=' {
            out.insert(key, String::new());
            continue;
        }
        i += 1; // skip '='
        let val = if i < bytes.len() && bytes[i] == b'\'' {
            i += 1;
            let v_start = i;
            while i < bytes.len() && bytes[i] != b'\'' {
                i += 1;
            }
            let v = String::from_utf8_lossy(&bytes[v_start..i]).into_owned();
            if i < bytes.len() {
                i += 1; // skip closing quote
            }
            v
        } else {
            let v_start = i;
            while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            String::from_utf8_lossy(&bytes[v_start..i]).into_owned()
        };
        out.insert(key, val);
    }
    out
}

fn tool_calc(args: &str) -> Result<String, String> {
    let m = parse_args(args);
    let expr = m.get("expr").ok_or("missing arg: expr")?.trim();
    let val = eval_expr(expr)?;
    Ok(val.to_string())
}

fn tool_text_stats(args: &str) -> Result<String, String> {
    let m = parse_args(args);
    let text = m.get("text").cloned().unwrap_or_default();
    let chars = text.chars().count();
    let words = text.split_whitespace().count();
    let lines = if text.is_empty() {
        0
    } else {
        text.lines().count().max(1)
    };
    Ok(format!("chars={} words={} lines={}", chars, words, lines))
}

fn tool_reverse(args: &str) -> Result<String, String> {
    let m = parse_args(args);
    let text = m.get("text").cloned().unwrap_or_default();
    Ok(text.chars().rev().collect())
}

fn tool_upper(args: &str) -> Result<String, String> {
    let m = parse_args(args);
    let text = m.get("text").cloned().unwrap_or_default();
    Ok(text.to_uppercase())
}

fn tool_jst() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    let secs = now.as_secs() as i64 + 9 * 3600; // JST = UTC+9
    let (y, mo, d, h, mi, s) = epoch_to_civil(secs);
    Ok(format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02} JST",
        y, mo, d, h, mi, s
    ))
}

fn tool_sleep(args: &str) -> Result<String, String> {
    let m = parse_args(args);
    let ms: u64 = m
        .get("ms")
        .and_then(|v| v.parse().ok())
        .ok_or("missing or invalid arg: ms")?;
    std::thread::sleep(std::time::Duration::from_millis(ms));
    Ok(format!("slept {} ms", ms))
}

/// Convert a unix-epoch second count to civil (Y, M, D, H, Min, S) using
/// Howard Hinnant's algorithm. Self-contained — no chrono needed.
fn epoch_to_civil(secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = secs.div_euclid(86_400);
    let time_of_day = secs.rem_euclid(86_400);
    let h = (time_of_day / 3600) as u32;
    let mi = ((time_of_day % 3600) / 60) as u32;
    let s = (time_of_day % 60) as u32;

    // Hinnant's "days_from_civil" inverse.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = (y + if m <= 2 { 1 } else { 0 }) as i32;
    (y, m, d, h, mi, s)
}

/// Tiny recursive-descent evaluator for + - * / and parentheses on integers.
/// Returns an i64 to keep behavior obvious.
pub fn eval_expr(expr: &str) -> Result<i64, String> {
    let tokens = tokenize(expr)?;
    let mut p = Parser { tokens, pos: 0 };
    let v = p.parse_expr()?;
    if p.pos != p.tokens.len() {
        return Err(format!("unexpected token at position {}", p.pos));
    }
    Ok(v)
}

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Num(i64),
    Plus,
    Minus,
    Star,
    Slash,
    LParen,
    RParen,
}

fn tokenize(s: &str) -> Result<Vec<Tok>, String> {
    let mut out = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        match c {
            b'+' => {
                out.push(Tok::Plus);
                i += 1;
            }
            b'-' => {
                out.push(Tok::Minus);
                i += 1;
            }
            b'*' => {
                out.push(Tok::Star);
                i += 1;
            }
            b'/' => {
                out.push(Tok::Slash);
                i += 1;
            }
            b'(' => {
                out.push(Tok::LParen);
                i += 1;
            }
            b')' => {
                out.push(Tok::RParen);
                i += 1;
            }
            b'0'..=b'9' => {
                let start = i;
                while i < bytes.len() && bytes[i].is_ascii_digit() {
                    i += 1;
                }
                let n: i64 = std::str::from_utf8(&bytes[start..i])
                    .map_err(|e| e.to_string())?
                    .parse()
                    .map_err(|e: std::num::ParseIntError| e.to_string())?;
                out.push(Tok::Num(n));
            }
            _ => return Err(format!("unexpected char: {}", c as char)),
        }
    }
    Ok(out)
}

struct Parser {
    tokens: Vec<Tok>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Tok> {
        self.tokens.get(self.pos)
    }
    fn bump(&mut self) -> Option<Tok> {
        let t = self.tokens.get(self.pos).cloned();
        if t.is_some() {
            self.pos += 1;
        }
        t
    }

    fn parse_expr(&mut self) -> Result<i64, String> {
        let mut left = self.parse_term()?;
        loop {
            match self.peek() {
                Some(Tok::Plus) => {
                    self.bump();
                    left += self.parse_term()?;
                }
                Some(Tok::Minus) => {
                    self.bump();
                    left -= self.parse_term()?;
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_term(&mut self) -> Result<i64, String> {
        let mut left = self.parse_atom()?;
        loop {
            match self.peek() {
                Some(Tok::Star) => {
                    self.bump();
                    left *= self.parse_atom()?;
                }
                Some(Tok::Slash) => {
                    self.bump();
                    let r = self.parse_atom()?;
                    if r == 0 {
                        return Err("division by zero".into());
                    }
                    left /= r;
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_atom(&mut self) -> Result<i64, String> {
        match self.bump() {
            Some(Tok::Num(n)) => Ok(n),
            Some(Tok::Minus) => Ok(-self.parse_atom()?),
            Some(Tok::Plus) => self.parse_atom(),
            Some(Tok::LParen) => {
                let v = self.parse_expr()?;
                match self.bump() {
                    Some(Tok::RParen) => Ok(v),
                    _ => Err("expected ')'".into()),
                }
            }
            other => Err(format!("expected atom, got {:?}", other)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calc_basic() {
        assert_eq!(eval_expr("1+2*3").unwrap(), 7);
        assert_eq!(eval_expr("(1+2)*3").unwrap(), 9);
        assert_eq!(eval_expr("10/3").unwrap(), 3);
        assert_eq!(eval_expr("-5+8").unwrap(), 3);
    }

    #[test]
    fn calc_div_zero() {
        assert!(eval_expr("1/0").is_err());
    }

    #[test]
    fn parse_args_quoted() {
        let m = parse_args("text='hello world' n=3");
        assert_eq!(m.get("text").unwrap(), "hello world");
        assert_eq!(m.get("n").unwrap(), "3");
    }

    #[test]
    fn registry_defaults_present() {
        let r = ToolRegistry::with_defaults();
        for name in [
            "calc",
            "text_stats",
            "reverse",
            "uppercase",
            "jst_time",
            "sleep_ms",
            "echo",
        ] {
            assert!(r.get(name).is_some(), "missing tool: {}", name);
        }
    }

    #[test]
    fn epoch_to_civil_known() {
        // 2026-01-01 00:00:00 UTC == unix 1767225600 (56y * 365d + 14 leap days).
        assert_eq!(epoch_to_civil(1_767_225_600), (2026, 1, 1, 0, 0, 0));
        // 2026-05-30 00:00:00 UTC == 1767225600 + 149*86400 = 1780099200.
        assert_eq!(epoch_to_civil(1_780_099_200), (2026, 5, 30, 0, 0, 0));
        // 2026-05-30 12:34:56 UTC adds 12*3600 + 34*60 + 56 = 45296 s.
        assert_eq!(epoch_to_civil(1_780_099_200 + 45_296), (2026, 5, 30, 12, 34, 56));
    }
}
