//! Parallel sub-agent orchestrator.
//!
//! Implements the "spawn N workers, dispatch sub-tasks over an mpsc channel,
//! collect results back over another" pattern that powers parallel subagent
//! systems like Anthropic's Claude Code, Google's Antigravity harness, and
//! Rust-native agent frameworks (Rig, AutoAgents, OpenFANG) that emerged in
//! Q1 2026. Zero external dependencies — pure stdlib threads + channels.

use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Instant;

use crate::agent;
use crate::llm::Planner;
use crate::memory::Memory;
use crate::plan::{Plan, SubTask, TaskResult};
use crate::tools::ToolRegistry;

pub struct Orchestrator {
    pub workers: usize,
    pub registry: ToolRegistry,
    pub memory: Memory,
}

impl Orchestrator {
    pub fn new(workers: usize) -> Self {
        Self {
            workers: workers.max(1),
            registry: ToolRegistry::with_defaults(),
            memory: Memory::new(),
        }
    }

    pub fn with_registry(mut self, registry: ToolRegistry) -> Self {
        self.registry = registry;
        self
    }

    /// Make a plan with the given planner, then run every sub-task in parallel.
    /// Returns results in the same order as `plan.tasks` (by id).
    pub fn run(&self, planner: &dyn Planner, goal: &str) -> RunReport {
        let plan = planner.plan(goal, &self.registry);
        let results = self.execute_plan(plan.clone());
        RunReport {
            planner: planner.name().to_string(),
            plan,
            results,
            memory_snapshot: self.memory.snapshot(),
        }
    }

    pub fn execute_plan(&self, plan: Plan) -> Vec<TaskResult> {
        let epoch = Instant::now();
        let (task_tx, task_rx) = mpsc::channel::<SubTask>();
        let (result_tx, result_rx) = mpsc::channel::<TaskResult>();
        let task_rx = Arc::new(std::sync::Mutex::new(task_rx));

        let mut handles = Vec::with_capacity(self.workers);
        for worker_id in 0..self.workers {
            let rx = task_rx.clone();
            let tx = result_tx.clone();
            let registry = self.registry.clone();
            let memory = self.memory.clone();
            handles.push(thread::spawn(move || loop {
                let task = {
                    let g = rx.lock().unwrap();
                    g.recv()
                };
                match task {
                    Ok(t) => {
                        let res = agent::execute(t, worker_id, &registry, &memory, epoch);
                        if tx.send(res).is_err() {
                            break;
                        }
                    }
                    Err(_) => break, // channel closed -> shutdown
                }
            }));
        }

        let n = plan.tasks.len();
        for t in plan.tasks {
            task_tx.send(t).expect("workers dropped task channel");
        }
        drop(task_tx); // signal workers to shut down once drained
        drop(result_tx); // close our cloning sender so result_rx ends naturally

        let mut results: Vec<TaskResult> = Vec::with_capacity(n);
        for _ in 0..n {
            match result_rx.recv() {
                Ok(r) => results.push(r),
                Err(_) => break,
            }
        }
        for h in handles {
            let _ = h.join();
        }
        results.sort_by_key(|r| r.id);
        results
    }
}

#[derive(Debug, Clone)]
pub struct RunReport {
    pub planner: String,
    pub plan: Plan,
    pub results: Vec<TaskResult>,
    pub memory_snapshot: Vec<(String, String)>,
}

impl RunReport {
    pub fn render(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!("Goal     : {}\n", self.plan.goal));
        out.push_str(&format!("Planner  : {}\n", self.planner));
        out.push_str(&format!("Sub-tasks: {}\n", self.results.len()));
        let total_wall: u128 = self
            .results
            .iter()
            .map(|r| r.started_ms + r.elapsed_ms)
            .max()
            .unwrap_or(0);
        let serial_sum: u128 = self.results.iter().map(|r| r.elapsed_ms).sum();
        out.push_str(&format!(
            "Wall-time: {} ms  (sum-of-tasks if serial: {} ms — speed-up {:.2}x)\n",
            total_wall,
            serial_sum,
            if total_wall == 0 {
                1.0
            } else {
                serial_sum as f64 / total_wall as f64
            }
        ));
        out.push('\n');

        out.push_str("Per-task timeline:\n");
        for r in &self.results {
            let status = if r.is_ok() { "OK " } else { "ERR" };
            out.push_str(&format!(
                "  #{:>2} [{}] w{} t+{:>4}ms (+{:>3}ms) — {}\n",
                r.id, status, r.worker, r.started_ms, r.elapsed_ms, r.title
            ));
            for s in &r.steps {
                match &s.output {
                    Ok(o) => {
                        let short = truncate(o, 80);
                        out.push_str(&format!("       · {} -> {}\n", s.tool, short));
                    }
                    Err(e) => {
                        out.push_str(&format!("       · {} !! {}\n", s.tool, e));
                    }
                }
            }
        }

        if !self.memory_snapshot.is_empty() {
            out.push_str("\nShared memory (final):\n");
            for (k, v) in &self.memory_snapshot {
                out.push_str(&format!("  {} = {}\n", k, truncate(v, 80)));
            }
        }
        out
    }
}

fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(n).collect();
        out.push('…');
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::MockPlanner;
    use std::time::Instant;

    #[test]
    fn runs_all_subtasks_in_correctly() {
        let orch = Orchestrator::new(4);
        let report = orch.run(&MockPlanner, "compute 2+3 and reverse this");
        assert!(!report.results.is_empty());
        // every sub-task that asked to publish a memory key did so
        for r in &report.results {
            assert!(r.is_ok(), "task failed: {:?}", r);
        }
        // The expected memory keys all show up.
        let keys: Vec<&str> = report
            .memory_snapshot
            .iter()
            .map(|(k, _)| k.as_str())
            .collect();
        for required in ["timestamp", "goal_stats", "calc_result", "reversed", "io_probe"] {
            assert!(keys.contains(&required), "missing memory key: {}", required);
        }
    }

    #[test]
    fn worker_count_is_clamped_to_one_minimum() {
        let o = Orchestrator::new(0);
        assert_eq!(o.workers, 1);
        // Even with one worker, it should still complete.
        let t0 = Instant::now();
        let _ = o.run(&MockPlanner, "no math here");
        assert!(t0.elapsed().as_secs() < 5);
    }
}
