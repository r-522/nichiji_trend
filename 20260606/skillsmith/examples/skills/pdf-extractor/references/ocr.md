# OCR fallback for scanned PDFs

When `pdftotext` returns little or no text, the PDF is likely scanned images.

1. Rasterise pages: `pdftoppm -png -r 300 <file> page`
2. Run OCR per page: `tesseract page-1.png stdout -l eng`
3. Concatenate page results in order and return as markdown.

This detail lives in a reference file so the main SKILL.md stays short and is
only loaded into the agent's context when OCR is actually needed.
