"""
PDF text extraction for Vysti Marker.

Phase 1: text-based PDFs only. Scanned/image PDFs are rejected with a
clear error message.
"""

from io import BytesIO

import pdfplumber

# ── Limits ──────────────────────────────────────────────────────────────
MAX_PDF_PAGES = 50
_MIN_CHARS_PER_PAGE = 50  # below this → likely scanned / image PDF


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be processed (scanned, encrypted, etc.)."""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract plain text from a text-based PDF.

    Returns the full text with paragraphs separated by double newlines,
    ready to feed into ``build_doc_from_text()``.

    Raises ``PDFExtractionError`` for scanned PDFs, encrypted files,
    page-count violations, or empty documents.
    """
    try:
        pdf = pdfplumber.open(BytesIO(pdf_bytes))
    except Exception as exc:
        raise PDFExtractionError(
            "Could not open this PDF. It may be encrypted or corrupted."
        ) from exc

    with pdf:
        num_pages = len(pdf.pages)
        if num_pages == 0:
            raise PDFExtractionError("This PDF has no pages.")
        if num_pages > MAX_PDF_PAGES:
            raise PDFExtractionError(
                f"This PDF has {num_pages} pages (limit is {MAX_PDF_PAGES}). "
                "Please upload only the essay portion."
            )

        page_texts = []
        for page in pdf.pages:
            raw = page.extract_text() or ""
            cleaned = _clean_page_text(raw)
            if cleaned:
                page_texts.append(cleaned)

        full_text = "\n\n".join(page_texts)

        # ── Scanned-PDF detection ───────────────────────────────────
        total_chars = len(full_text.strip())
        if total_chars < _MIN_CHARS_PER_PAGE * num_pages:
            raise PDFExtractionError(
                "This PDF appears to be scanned or image-based. "
                "Please upload a text-based PDF or .docx file instead."
            )

        if not full_text.strip():
            raise PDFExtractionError(
                "No text could be extracted from this PDF."
            )

    return full_text


# ── Helpers ─────────────────────────────────────────────────────────────

def _clean_page_text(text: str) -> str:
    """Remove bare page numbers and reconstruct paragraphs from PDF lines.

    pdfplumber returns one ``\\n`` per visual line in the PDF — both hard
    line-wraps and real paragraph breaks look the same.  We reconstruct
    paragraphs by joining consecutive lines that appear to be part of the
    same paragraph, and inserting ``\\n\\n`` at likely paragraph boundaries.
    """
    lines = text.split("\n")
    cleaned: list[str] = []
    for line in lines:
        stripped = line.strip()
        # Skip bare page numbers
        if stripped and stripped.isdigit():
            continue
        if not stripped:
            # Blank line → definite paragraph break
            cleaned.append("")
            continue
        cleaned.append(stripped)

    # Merge lines into paragraphs.  A new paragraph starts when:
    #  - the previous line is blank, OR
    #  - the previous line ends with sentence-ending punctuation AND the
    #    current line starts with an uppercase letter (heuristic for a
    #    new paragraph vs. a mid-sentence line wrap).
    import re
    _SENTENCE_END = re.compile(r'[.!?;:][""\u2019\u201D)]*$')

    paragraphs: list[str] = []
    buf: list[str] = []

    for line in cleaned:
        if not line:
            # Blank → flush current paragraph
            if buf:
                paragraphs.append(" ".join(buf))
                buf = []
            continue
        if buf:
            prev = buf[-1]
            # Heuristic: previous line ends a sentence AND this line
            # starts with uppercase → likely a new paragraph.
            if _SENTENCE_END.search(prev) and line[0].isupper():
                paragraphs.append(" ".join(buf))
                buf = [line]
                continue
        buf.append(line)

    if buf:
        paragraphs.append(" ".join(buf))

    return "\n\n".join(paragraphs)
