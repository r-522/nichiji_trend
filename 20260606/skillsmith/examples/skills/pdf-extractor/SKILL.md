---
name: pdf-extractor
description: Use this skill when the user asks to extract text, tables, or metadata from a PDF file, or to convert a PDF into markdown. Handles both digital and scanned PDFs.
license: MIT
compatibility: Requires the `pdftotext` binary (poppler-utils) on PATH.
allowed-tools: Bash Read
metadata:
  author: skillsmith-examples
  version: 1.2.0
---

# pdf-extractor

Extract structured content from PDF documents.

## Instructions

1. Confirm the target PDF path exists.
2. For digital PDFs, run `pdftotext -layout <file> -` to capture text with layout.
3. For scanned PDFs, fall back to OCR (see `references/ocr.md`).
4. Return the extracted content as markdown.

## Examples

> "Pull the invoice total out of `invoice.pdf`" → extract text, locate the
> total line, and report the value.
