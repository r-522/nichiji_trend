//! End-to-end test: build a fixture, parse it back, and assert structural invariants.

use gguf_inspector::{fixture, gguf, report::Report, types::GgmlType};

#[test]
fn fixture_roundtrips() {
    let buf = fixture::build();
    let file = gguf::parse(&buf).expect("parse should succeed");

    assert_eq!(file.version, 3);
    assert_eq!(file.architecture(), Some("phi3"));
    assert_eq!(file.name(), Some("phi3-mini-fixture"));
    assert_eq!(file.alignment(), 32);

    assert_eq!(file.tensors.len(), 11);
    assert!(file.metadata.len() >= 12);

    let token_embd = file
        .tensors
        .iter()
        .find(|t| t.name == "token_embd.weight")
        .expect("token_embd.weight present");
    assert_eq!(token_embd.ggml_type, GgmlType::Q4K);
    assert_eq!(token_embd.dimensions, vec![3072, 32064]);
    assert!(token_embd.estimated_bytes() > 0);

    // Offsets must be strictly non-decreasing and 32-aligned for a freshly built fixture.
    let mut prev_end = 0u64;
    for t in &file.tensors {
        assert!(t.offset % 32 == 0, "tensor {} offset {} not 32-aligned", t.name, t.offset);
        assert!(t.offset >= prev_end, "tensor {} offset went backwards", t.name);
        prev_end = t.offset + t.estimated_bytes();
    }
}

#[test]
fn report_renders_both_modes() {
    let buf = fixture::build();
    let file = gguf::parse(&buf).unwrap();
    let r = Report::new(&file);

    let human = r.render_human(8, 4);
    assert!(human.contains("GGUF file"));
    assert!(human.contains("phi3"));
    assert!(human.contains("Quantization breakdown"));
    assert!(human.contains("Q4_K"));

    let json = r.render_json();
    assert!(json.starts_with('{') && json.ends_with('}'));
    assert!(json.contains(r#""architecture":"phi3""#));
    assert!(json.contains(r#""type":"Q4_K""#));
    assert!(json.contains(r#""tensor_count":11"#));
}

#[test]
fn bad_magic_rejected() {
    let mut buf = fixture::build();
    buf[0] = 0xFF;
    let err = gguf::parse(&buf).unwrap_err();
    assert!(matches!(err, gguf::ParseError::BadMagic(_)));
}

#[test]
fn truncated_input_rejected() {
    let buf = fixture::build();
    let truncated = &buf[..buf.len() / 2];
    assert!(gguf::parse(truncated).is_err());
}

#[test]
fn quant_breakdown_sums_to_total_estimate() {
    let buf = fixture::build();
    let file = gguf::parse(&buf).unwrap();
    let r = Report::new(&file);

    let total_from_tensors: u64 = file.tensors.iter().map(|t| t.estimated_bytes()).sum();
    let total_from_breakdown: u64 = r.quant_breakdown().iter().map(|b| b.estimated_bytes).sum();
    assert_eq!(total_from_tensors, total_from_breakdown);
}
