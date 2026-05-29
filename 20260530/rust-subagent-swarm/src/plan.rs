//! Plan / Task data model passed between the orchestrator and sub-agents.

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub tool: String,
    pub args: String,
}

/// A unit of work assigned to one sub-agent. Tool calls execute sequentially
/// inside one sub-agent, but tasks themselves run in parallel across sub-agents.
#[derive(Debug, Clone)]
pub struct SubTask {
    pub id: u64,
    pub title: String,
    pub steps: Vec<ToolCall>,
    /// Optional memory key under which the sub-agent stores its final answer.
    pub memory_key: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Plan {
    pub goal: String,
    pub tasks: Vec<SubTask>,
}

#[derive(Debug, Clone)]
pub struct StepResult {
    pub tool: String,
    pub args: String,
    pub output: Result<String, String>,
}

#[derive(Debug, Clone)]
pub struct TaskResult {
    pub id: u64,
    pub title: String,
    pub worker: usize,
    pub started_ms: u128,
    pub elapsed_ms: u128,
    pub steps: Vec<StepResult>,
    pub final_answer: String,
}

impl TaskResult {
    pub fn is_ok(&self) -> bool {
        self.steps.iter().all(|s| s.output.is_ok())
    }
}
