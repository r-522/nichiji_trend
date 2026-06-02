//! Sub-agent worker. One sub-agent owns one `SubTask`: it runs each tool call
//! in sequence, records every step, and writes its final answer into shared
//! memory if a `memory_key` was assigned.

use std::time::Instant;

use crate::memory::Memory;
use crate::plan::{StepResult, SubTask, TaskResult};
use crate::tools::ToolRegistry;

pub fn execute(
    task: SubTask,
    worker: usize,
    registry: &ToolRegistry,
    memory: &Memory,
    epoch: Instant,
) -> TaskResult {
    let started_ms = epoch.elapsed().as_millis();
    let t0 = Instant::now();
    let mut steps: Vec<StepResult> = Vec::with_capacity(task.steps.len());
    let mut last_ok: String = String::new();

    for call in &task.steps {
        let out = match registry.get(&call.tool) {
            Some(t) => (t.call)(&call.args),
            None => Err(format!("tool not found: {}", call.tool)),
        };
        if let Ok(ref s) = out {
            last_ok = s.clone();
        }
        steps.push(StepResult {
            tool: call.tool.clone(),
            args: call.args.clone(),
            output: out,
        });
    }

    let elapsed_ms = t0.elapsed().as_millis();
    let final_answer = last_ok.clone();

    if let Some(key) = task.memory_key.as_ref() {
        memory.put(key.clone(), final_answer.clone());
    }

    TaskResult {
        id: task.id,
        title: task.title,
        worker,
        started_ms,
        elapsed_ms,
        steps,
        final_answer,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plan::ToolCall;

    #[test]
    fn execute_runs_all_steps_and_records_memory() {
        let reg = ToolRegistry::with_defaults();
        let mem = Memory::new();
        let task = SubTask {
            id: 1,
            title: "demo".into(),
            steps: vec![
                ToolCall {
                    tool: "echo".into(),
                    args: "text='hi'".into(),
                },
                ToolCall {
                    tool: "uppercase".into(),
                    args: "text='hi'".into(),
                },
            ],
            memory_key: Some("k".into()),
        };
        let res = execute(task, 0, &reg, &mem, Instant::now());
        assert!(res.is_ok());
        assert_eq!(res.steps.len(), 2);
        assert_eq!(res.final_answer, "HI");
        assert_eq!(mem.get("k").unwrap(), "HI");
    }

    #[test]
    fn execute_records_missing_tool_as_error() {
        let reg = ToolRegistry::with_defaults();
        let mem = Memory::new();
        let task = SubTask {
            id: 2,
            title: "bad".into(),
            steps: vec![ToolCall {
                tool: "nope".into(),
                args: "".into(),
            }],
            memory_key: None,
        };
        let res = execute(task, 0, &reg, &mem, Instant::now());
        assert!(!res.is_ok());
    }
}
