"""
OCR transcription for scanned/handwritten PDFs.

When pdf_extract.py detects a scanned PDF, this module converts pages to
images and transcribes them via the Anthropic vision API.
"""

import asyncio
import base64
import io
import os
import time

import anthropic
import fitz  # PyMuPDF
from PIL import Image

# ── Config ───────────────────────────────────────────────────────────────
MAX_B64_BYTES = 5_242_880
MAX_IMAGE_BYTES = int(MAX_B64_BYTES * 3 / 4) - 10_000  # ~3.9 MB raw

# Sonnet for scanned/handwritten — proven more accurate on real student work
MODEL = "claude-sonnet-4-6"

TRANSCRIBE_PROMPT = """Transcribe the text in this image exactly as written.

Rules:
- Preserve the original wording, spelling, and grammar (including errors)
- If handwritten: where text has been crossed out and replaced, use the REPLACEMENT word
- If a word is truly illegible, write [illegible]
- Ignore any teacher annotations in different colored ink
- Output plain text with paragraph breaks where the student started new paragraphs
- Do NOT add any commentary, headers, or formatting — just the transcribed text"""


# ── Image processing ────────────────────────────────────────────────────

def _compress_image(image_bytes: bytes, content_type: str) -> tuple[bytes, str]:
    """Compress image to fit within API limits."""
    if len(image_bytes) <= MAX_IMAGE_BYTES and content_type in (
        "image/jpeg", "image/png", "image/webp"
    ):
        return image_bytes, content_type

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")

    for quality in (85, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        if buf.tell() <= MAX_IMAGE_BYTES:
            return buf.getvalue(), "image/jpeg"

    img.thumbnail((2000, 2000), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=60)
    return buf.getvalue(), "image/jpeg"


async def _transcribe_page(
    client: anthropic.AsyncAnthropic,
    image_bytes: bytes,
    media_type: str,
) -> str:
    """Transcribe a single page image. Returns the text."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    response = await client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    },
                },
                {"type": "text", "text": TRANSCRIBE_PROMPT},
            ],
        }],
    )
    return response.content[0].text


# ── Main entry point ────────────────────────────────────────────────────

async def transcribe_scanned_pdf(pdf_bytes: bytes) -> str:
    """
    Convert a scanned/image PDF to text via OCR.

    Renders each page at 200 DPI, sends to Claude vision API,
    and returns the assembled text ready for build_doc_from_text().

    Raises RuntimeError if the API key is missing or transcription fails.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Handwriting OCR is not configured. "
            "Please upload a text-based PDF or .docx file instead."
        )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = 200 / 72
    mat = fitz.Matrix(zoom, zoom)

    # Render pages to images
    prepared = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")
        img_bytes, media_type = _compress_image(png_bytes, "image/png")
        prepared.append((img_bytes, media_type))
    doc.close()

    if not prepared:
        raise RuntimeError("PDF has no pages to transcribe.")

    # Transcribe all pages concurrently
    client = anthropic.AsyncAnthropic(api_key=api_key)
    tasks = [
        _transcribe_page(client, img_bytes, media_type)
        for img_bytes, media_type in prepared
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Assemble text
    page_texts = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            page_texts.append(f"[Error transcribing page {i + 1}]")
        else:
            page_texts.append(result)

    full_text = "\n\n".join(page_texts)
    if not full_text.strip():
        raise RuntimeError("No text could be extracted from this scanned PDF.")

    return full_text
