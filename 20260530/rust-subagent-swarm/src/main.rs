//! CLI entry point.
//!
//!   swarm demo                       # built-in demo task across 4 workers
//!   swarm run "<goal>" [--workers N] # one ad-hoc goal
//!   swarm tools                      # list registered tools
//!   swarm bench                      # parallel vs serial wall-time comparison

use std::env;
use std::process::ExitCode;
use std::time::Instant;

use rust_subagent_swarm::llm::MockPlanner;
use rust_subagent_swarm::orchestrator::Orchestrator;
use rust_subagent_swarm::plan::{Plan, SubTask, ToolCall};
use rust_subagent_swarm::tools::ToolRegistry;

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("demo");

    match cmd {
        "demo" => cmd_demo(),
        "run" => cmd_run(&args[1..]),
        "tools" => cmd_tools(),
        "bench" => cmd_bench(),
        "help" | "--help" | "-h" => {
            print_help();
            ExitCode::SUCCESS
        }
        other => {
            eprintln!("unknown command: {}\n", other);
            print_help();
            ExitCode::from(2)
        }
    }
}

fn print_help() {
    println!(
        "rust-subagent-swarm — local-first parallel sub-agent orchestrator\n\
         \n\
         USAGE:\n\
           swarm demo                            run the built-in demo task (4 workers)\n\
           swarm run <goal> [--workers N]        plan + execute one goal\n\
           swarm tools                           list registered tools\n\
           swarm bench                           wall-time: 1 worker vs N workers\n\
           swarm help                            show this message\n"
    );
}

fn cmd_demo() -> ExitCode {
    let orch = Orchestrator::new(4);
    let goal =
        "Plan a quick status report: compute 2+3*4, reverse 'rustacean', and timestamp it.";
    let report = orch.run(&MockPlanner, goal);
    print!("{}", report.render());
    ExitCode::SUCCESS
}

fn cmd_run(args: &[String]) -> ExitCode {
    let mut workers = 4usize;
    let mut goal_parts: Vec<String> = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let a = &args[i];
        if a == "--workers" {
            if let Some(v) = args.get(i + 1).and_then(|v| v.parse().ok()) {
                workers = v;
                i += 2;
                continue;
            } else {
                eprintln!("--workers requires a positive integer");
                return ExitCode::from(2);
            }
        }
        goal_parts.push(a.clone());
        i += 1;
    }
    if goal_parts.is_empty() {
        eprintln!("missing goal\n");
        print_help();
        return ExitCode::from(2);
    }
    let goal = goal_parts.join(" ");
    let orch = Orchestrator::new(workers);
    let report = orch.run(&MockPlanner, &goal);
    print!("{}", report.render());
    ExitCode::SUCCESS
}

fn cmd_tools() -> ExitCode {
    let r = ToolRegistry::with_defaults();
    print!("{}", r.describe());
    ExitCode::SUCCESS
}

fn cmd_bench() -> ExitCode {
    // 8 independent I/O-bound sub-tasks, each sleeping 100 ms. With 1 worker
    // this runs serially (~800 ms); with 8 workers it runs in one slot (~100 ms).
    let plan = Plan {
        goal: "bench: 8 independent I/O-bound sub-tasks".into(),
        tasks: (0..8)
            .map(|i| SubTask {
                id: i,
                title: format!("sleep-{}", i),
                steps: vec![ToolCall {
                    tool: "sleep_ms".into(),
                    args: "ms=100".into(),
                }],
                memory_key: None,
            })
            .collect(),
    };

    let t1 = Instant::now();
    let r1 = Orchestrator::new(1).execute_plan(plan.clone());
    let serial_wall = t1.elapsed().as_millis();

    let t2 = Instant::now();
    let r2 = Orchestrator::new(8).execute_plan(plan);
    let parallel_wall = t2.elapsed().as_millis();

    println!("Sub-tasks: {}  (each: sleep 100ms)", r1.len());
    println!("1-worker  wall-time : {:>5} ms", serial_wall);
    println!("8-workers wall-time : {:>5} ms", parallel_wall);
    let ratio = if parallel_wall == 0 {
        f64::INFINITY
    } else {
        serial_wall as f64 / parallel_wall as f64
    };
    println!("Speed-up            : {:.2}x", ratio);
    assert_eq!(r1.len(), r2.len());
    ExitCode::SUCCESS
}
