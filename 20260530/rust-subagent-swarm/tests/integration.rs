//! End-to-end integration tests: build a plan, run it across multiple workers,
//! and confirm both correctness (final answers in memory) and parallelism
//! (wall-time < sum of per-task times).

use rust_subagent_swarm::llm::{MockPlanner, Planner};
use rust_subagent_swarm::orchestrator::Orchestrator;
use rust_subagent_swarm::plan::{SubTask, ToolCall};

#[test]
fn end_to_end_demo_goal_completes() {
    let orch = Orchestrator::new(4);
    let report = orch.run(&MockPlanner, "compute 7*6 and reverse 'hello'");
    // every step in every task succeeded
    for r in &report.results {
        assert!(r.is_ok(), "task failed: {} — {:?}", r.title, r.steps);
    }
    // expected memory keys are present
    let keys: Vec<&str> = report
        .memory_snapshot
        .iter()
        .map(|(k, _)| k.as_str())
        .collect();
    assert!(keys.contains(&"timestamp"));
    assert!(keys.contains(&"goal_stats"));
    assert!(keys.contains(&"calc_result"));
    assert!(keys.contains(&"reversed"));
    assert!(keys.contains(&"io_probe"));
    // calc actually evaluated
    let calc = report
        .memory_snapshot
        .iter()
        .find(|(k, _)| k == "calc_result")
        .map(|(_, v)| v.clone())
        .unwrap();
    assert_eq!(calc, "42");
}

#[test]
fn many_workers_beat_one_worker_on_io_bound_plan() {
    // A plan with several sleep_ms steps in parallel sub-tasks: 8 workers
    // should finish in roughly one slot's worth of wall time, not 8 slots.
    let plan = rust_subagent_swarm::plan::Plan {
        goal: "stress".into(),
        tasks: (0..8)
            .map(|i| SubTask {
                id: i,
                title: format!("sleep-{}", i),
                steps: vec![ToolCall {
                    tool: "sleep_ms".into(),
                    args: "ms=80".into(),
                }],
                memory_key: None,
            })
            .collect(),
    };

    let serial = Orchestrator::new(1).execute_plan(plan.clone());
    let parallel = Orchestrator::new(8).execute_plan(plan);

    let wall = |rs: &[rust_subagent_swarm::plan::TaskResult]| -> u128 {
        rs.iter().map(|r| r.started_ms + r.elapsed_ms).max().unwrap_or(0)
    };

    let s = wall(&serial);
    let p = wall(&parallel);
    // 8 workers should be at least 3x faster than 1 worker on this workload
    // (we use a slack factor to stay robust on slow CI; real-world it's ~8x).
    assert!(
        s as f64 / p.max(1) as f64 >= 3.0,
        "expected >=3x speed-up, got {:.2}x (serial={}ms, parallel={}ms)",
        s as f64 / p.max(1) as f64,
        s,
        p
    );
}

#[test]
fn planner_is_pluggable_via_trait_object() {
    let p: &dyn Planner = &MockPlanner;
    let reg = rust_subagent_swarm::tools::ToolRegistry::with_defaults();
    let plan = p.plan("hello 1+1", &reg);
    assert!(!plan.tasks.is_empty());
    assert!(plan.tasks.iter().all(|t| !t.steps.is_empty()));
}
