//! Thread-safe shared memory for cross-agent knowledge.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
pub struct Memory {
    inner: Arc<Mutex<HashMap<String, String>>>,
}

impl Memory {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn put(&self, key: impl Into<String>, value: impl Into<String>) {
        self.inner.lock().unwrap().insert(key.into(), value.into());
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.inner.lock().unwrap().get(key).cloned()
    }

    pub fn snapshot(&self) -> Vec<(String, String)> {
        let g = self.inner.lock().unwrap();
        let mut v: Vec<(String, String)> = g.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        v.sort_by(|a, b| a.0.cmp(&b.0));
        v
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn concurrent_writes_are_seen() {
        let mem = Memory::new();
        let mut handles = Vec::new();
        for i in 0..16 {
            let m = mem.clone();
            handles.push(thread::spawn(move || {
                m.put(format!("k{}", i), format!("v{}", i));
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(mem.len(), 16);
        assert_eq!(mem.get("k7").unwrap(), "v7");
    }
}
