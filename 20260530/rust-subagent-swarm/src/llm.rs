//! Pluggable LLM backend.
//!
//! The default `MockPlanner` is deterministic and offline: it inspects the goal
//! text and decomposes it into a parallel `Plan` whose sub-tasks each call a few
//! tools from the registry. Real backends (Gemini 3.5 Flash, Claude, etc.)
//! implement the same `Planner` trait — just swap one struct.

use crate::plan::{Plan, SubTask, ToolCall};
use crate::tools::ToolRegistry;

pub trait Planner: Send + Sync {
    /// Turn a free-form goal into a parallelizable plan, given the available tools.
    fn plan(&self, goal: &str, registry: &ToolRegistry) -> Plan;
    fn name(&self) -> &'static str;
}

/// Deterministic, no-network planner. Picks tasks based on keywords in the goal.
pub struct MockPlanner;

impl Planner for MockPlanner {
    fn name(&self) -> &'static str {
        "mock"
    }

    fn plan(&self, goal: &str, registry: &ToolRegistry) -> Plan {
        let mut tasks: Vec<SubTask> = Vec::new();
        let goal_lc = goal.to_lowercase();
        let mut next_id: u64 = 1;
        let mut push = |title: &str, steps: Vec<ToolCall>, key: Option<&str>| -> SubTask {
            let t = SubTask {
                id: next_id,
                title: title.to_string(),
                steps,
                memory_key: key.map(|k| k.to_string()),
            };
            next_id += 1;
            t
        };

        // 1. Time sub-agent (always runs — every report wants a timestamp).
        tasks.push(push(
            "record JST timestamp",
            vec![ToolCall {
                tool: "jst_time".into(),
                args: String::new(),
            }],
            Some("timestamp"),
        ));

        // 2. Goal-stats sub-agent.
        tasks.push(push(
            "compute goal text statistics",
            vec![
                ToolCall {
                    tool: "text_stats".into(),
                    args: format!("text='{}'", escape_single(goal)),
                },
                ToolCall {
                    tool: "uppercase".into(),
                    args: format!("text='{}'", escape_single(goal)),
                },
            ],
            Some("goal_stats"),
        ));

        // 3. If the goal mentions math/numbers, run a calc sub-agent.
        if goal_lc.contains("calc")
            || goal_lc.contains("math")
            || goal_lc.contains("sum")
            || goal_lc.chars().any(|c| c.is_ascii_digit())
        {
            // Pull out a tiny expression (or use a default demo expression).
            let expr = extract_expr(goal).unwrap_or_else(|| "(1+2+3+4+5)*7".to_string());
            tasks.push(push(
                "evaluate inline arithmetic",
                vec![ToolCall {
                    tool: "calc".into(),
                    args: format!("expr='{}'", escape_single(&expr)),
                }],
                Some("calc_result"),
            ));
        }

        // 4. If the goal mentions reverse / mirror, add a reverse sub-agent.
        if goal_lc.contains("reverse") || goal_lc.contains("mirror") || goal_lc.contains("flip") {
            tasks.push(push(
                "reverse the goal text",
                vec![ToolCall {
                    tool: "reverse".into(),
                    args: format!("text='{}'", escape_single(goal)),
                }],
                Some("reversed"),
            ));
        }

        // 5. Parallelism-showcase sub-agent (simulates a "slow tool" call).
        //    Always runs so demo output reliably shows parallel speed-up.
        tasks.push(push(
            "simulate slow I/O (parallelism showcase)",
            vec![ToolCall {
                tool: "sleep_ms".into(),
                args: "ms=120".into(),
            }],
            Some("io_probe"),
        ));

        // Drop any tasks whose first tool isn't actually registered (defensive).
        tasks.retain(|t| t.steps.iter().all(|s| registry.get(&s.tool).is_some()));

        Plan {
            goal: goal.to_string(),
            tasks,
        }
    }
}

fn escape_single(s: &str) -> String {
    s.replace('\'', " ")
}

/// Very small heuristic: pull the first contiguous run of arithmetic characters.
fn extract_expr(goal: &str) -> Option<String> {
    let allowed = |c: char| c.is_ascii_digit() || "+-*/() ".contains(c);
    let mut best: Option<String> = None;
    let mut cur = String::new();
    for c in goal.chars() {
        if allowed(c) {
            cur.push(c);
        } else {
            if cur.chars().any(|x| x.is_ascii_digit()) && cur.chars().any(|x| "+-*/".contains(x)) {
                let candidate = cur.trim().to_string();
                if best.as_ref().map(|b| b.len()).unwrap_or(0) < candidate.len() {
                    best = Some(candidate);
                }
            }
            cur.clear();
        }
    }
    if cur.chars().any(|x| x.is_ascii_digit()) && cur.chars().any(|x| "+-*/".contains(x)) {
        let candidate = cur.trim().to_string();
        if best.as_ref().map(|b| b.len()).unwrap_or(0) < candidate.len() {
            best = Some(candidate);
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_planner_always_emits_timestamp_and_stats() {
        let reg = ToolRegistry::with_defaults();
        let p = MockPlanner.plan("write a hello-world summary", &reg);
        assert!(p.tasks.iter().any(|t| t.memory_key.as_deref() == Some("timestamp")));
        assert!(p.tasks.iter().any(|t| t.memory_key.as_deref() == Some("goal_stats")));
    }

    #[test]
    fn mock_planner_adds_calc_when_digits_present() {
        let reg = ToolRegistry::with_defaults();
        let p = MockPlanner.plan("please compute 2+3*4", &reg);
        assert!(p
            .tasks
            .iter()
            .any(|t| t.memory_key.as_deref() == Some("calc_result")));
    }

    #[test]
    fn mock_planner_adds_reverse_branch() {
        let reg = ToolRegistry::with_defaults();
        let p = MockPlanner.plan("reverse this please", &reg);
        assert!(p
            .tasks
            .iter()
            .any(|t| t.memory_key.as_deref() == Some("reversed")));
    }

    #[test]
    fn extract_expr_picks_longest_arith_run() {
        assert_eq!(extract_expr("compute 1+2 and also 3*4-5"), Some("3*4-5".into()));
        assert_eq!(extract_expr("no math here"), None);
    }
}
