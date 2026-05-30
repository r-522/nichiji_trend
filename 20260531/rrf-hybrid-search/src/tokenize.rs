//! Unicode-aware tokenisation helpers (no external crates).

/// Split `text` on non-alphanumeric Unicode boundaries and lowercase each run.
pub fn tokens(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    for ch in text.chars() {
        if ch.is_alphanumeric() {
            for low in ch.to_lowercase() {
                buf.push(low);
            }
        } else if !buf.is_empty() {
            out.push(std::mem::take(&mut buf));
        }
    }
    if !buf.is_empty() {
        out.push(buf);
    }
    out
}

/// Build space-padded character trigrams over each word in `text`.
///
/// Padding with a leading and trailing space lets the trigrams pick up
/// prefixes and suffixes ("` ru`", "`st `") which gives a lightweight
/// morphological signal even without a neural embedding model.
pub fn char_trigrams(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut word = String::new();
    let emit = |word: &str, out: &mut Vec<String>| {
        if word.is_empty() {
            return;
        }
        let padded: String = format!(" {} ", word);
        let chars: Vec<char> = padded.chars().collect();
        if chars.len() < 3 {
            return;
        }
        for w in chars.windows(3) {
            out.push(w.iter().collect::<String>());
        }
    };
    for ch in text.chars() {
        if ch.is_alphanumeric() {
            for low in ch.to_lowercase() {
                word.push(low);
            }
        } else if !word.is_empty() {
            emit(&word, &mut out);
            word.clear();
        }
    }
    emit(&word, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_split_and_lowercase() {
        assert_eq!(
            tokens("Hybrid Search: BM25 + Vector!"),
            vec!["hybrid", "search", "bm25", "vector"]
        );
    }

    #[test]
    fn tokens_handle_unicode() {
        assert_eq!(
            tokens("ベクトル検索、BM25, RAG"),
            vec!["ベクトル検索", "bm25", "rag"]
        );
    }

    #[test]
    fn trigrams_include_padding() {
        let t = char_trigrams("cat");
        assert!(t.contains(&" ca".to_string()));
        assert!(t.contains(&"cat".to_string()));
        assert!(t.contains(&"at ".to_string()));
    }

    #[test]
    fn trigrams_morphology_overlap() {
        let a: std::collections::HashSet<_> =
            char_trigrams("encrypt").into_iter().collect();
        let b: std::collections::HashSet<_> =
            char_trigrams("encryption").into_iter().collect();
        let shared = a.intersection(&b).count();
        assert!(shared >= 4, "expected morphological overlap, got {shared}");
    }
}
