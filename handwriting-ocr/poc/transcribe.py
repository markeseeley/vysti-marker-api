"""
Handwriting OCR Proof of Concept
================================
Standalone script that converts PDF pages (handwritten or typed) into text
using Claude's vision API. Completely isolated from the main Vysti app.

Usage:
    python transcribe.py "path/to/essay.pdf"
    python transcribe.py "path/to/essay.pdf" --pages 2-4
    python transcribe.py "path/to/essay.pdf" --model haiku
    python transcribe.py "path/to/essay.pdf" --save

Requires:
    ANTHROPIC_API_KEY in environment or ../.env file
"""

import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

# Load .env from the handwriting-ocr directory
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import anthropic
import fitz  # PyMuPDF
from PIL import Image


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODELS = {
    "haiku":  "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
}

TRANSCRIPTION_PROMPT = """Transcribe the handwritten text in this image exactly as the student wrote it.

Rules:
- Preserve the student's original wording, spelling, and grammar (including errors)
- Where text has been crossed out and replaced with a word written above, use the REPLACEMENT word (the correction the student intended)
- If a word is truly illegible, write [illegible]
- Ignore any printed/typed text (like "25-26 Q2 Benchmark" headers) — only transcribe handwritten content
- Ignore teacher annotations in different colored ink (e.g., red pen marks, circled items, marginal comments)
- Output plain text with paragraph breaks where the student started new paragraphs
- Do NOT add any commentary, headers, or formatting — just the transcribed text"""

TYPED_PROMPT = """Transcribe the text in this image exactly as printed.

Rules:
- Preserve the original wording, spelling, and grammar exactly
- Maintain paragraph structure
- Ignore any handwritten annotations, marks, or comments — only transcribe the printed/typed text
- Output plain text with paragraph breaks matching the original
- Do NOT add any commentary, headers, or formatting — just the transcribed text"""


# ---------------------------------------------------------------------------
# PDF to images
# ---------------------------------------------------------------------------

MAX_B64_BYTES = 5_242_880  # Anthropic's 5MB limit is on the base64 string
# base64 expands by ~4/3, so raw image must be under ~3.7MB
MAX_IMAGE_BYTES = int(MAX_B64_BYTES * 3 / 4) - 10_000  # ~3.9MB with safety margin


def pdf_to_images(pdf_path: str, page_range: str | None = None, dpi: int = 200) -> list[dict]:
    """Convert PDF pages to base64-encoded JPEG images, compressed to fit API limits.

    Returns a list of dicts: [{"page": 1, "base64": "...", "size_kb": 123, "media_type": "..."}, ...]
    """
    doc = fitz.open(pdf_path)
    total_pages = len(doc)

    # Parse page range
    if page_range:
        start, end = _parse_range(page_range, total_pages)
    else:
        start, end = 0, total_pages - 1

    images = []
    zoom = dpi / 72  # 72 is PDF default DPI
    mat = fitz.Matrix(zoom, zoom)

    for i in range(start, end + 1):
        page = doc[i]
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")

        # If PNG is small enough, use it directly
        if len(png_bytes) <= MAX_IMAGE_BYTES:
            b64 = base64.standard_b64encode(png_bytes).decode("utf-8")
            images.append({
                "page": i + 1,
                "base64": b64,
                "size_kb": round(len(png_bytes) / 1024, 1),
                "media_type": "image/png",
            })
            continue

        # Otherwise compress to JPEG, reducing quality until it fits
        img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        for quality in (85, 70, 55, 40):
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality)
            jpeg_bytes = buf.getvalue()
            if len(jpeg_bytes) <= MAX_IMAGE_BYTES:
                break

        b64 = base64.standard_b64encode(jpeg_bytes).decode("utf-8")
        images.append({
            "page": i + 1,
            "base64": b64,
            "size_kb": round(len(jpeg_bytes) / 1024, 1),
            "media_type": "image/jpeg",
        })

    doc.close()
    return images


def _parse_range(range_str: str, total: int) -> tuple[int, int]:
    """Parse '2-4' into (1, 3) zero-indexed."""
    if "-" in range_str:
        parts = range_str.split("-")
        start = max(0, int(parts[0]) - 1)
        end = min(total - 1, int(parts[1]) - 1)
    else:
        start = end = max(0, int(range_str) - 1)
    return start, end


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

def transcribe_page(
    client: anthropic.Anthropic,
    image_b64: str,
    model: str,
    prompt: str,
    media_type: str = "image/png",
) -> dict:
    """Send a single page image to Claude and get transcription back.

    Returns {"text": "...", "input_tokens": N, "output_tokens": N, "time_s": F}
    """
    t0 = time.time()

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
        }],
    )

    elapsed = time.time() - t0
    text = response.content[0].text

    return {
        "text": text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "time_s": round(elapsed, 1),
    }


def transcribe_pdf(
    pdf_path: str,
    page_range: str | None = None,
    model_key: str = "haiku",
    typed: bool = False,
) -> dict:
    """Full pipeline: PDF → images → transcription → assembled text.

    Returns {
        "full_text": "...",
        "pages": [{"page": 1, "text": "...", ...}, ...],
        "total_tokens": {"input": N, "output": N},
        "total_time_s": F,
        "model": "...",
        "cost_estimate_usd": F,
    }
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set.")
        print("Set it in your environment or create handwriting-ocr/.env with:")
        print("  ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    model = MODELS[model_key]
    prompt = TYPED_PROMPT if typed else TRANSCRIPTION_PROMPT

    # Convert PDF to images
    print(f"Converting PDF to images...")
    images = pdf_to_images(pdf_path, page_range)
    print(f"  {len(images)} page(s), sizes: {[img['size_kb'] for img in images]} KB")

    # Transcribe each page
    pages = []
    total_input = 0
    total_output = 0
    total_time = 0.0

    for img in images:
        print(f"  Transcribing page {img['page']}...", end=" ", flush=True)
        result = transcribe_page(client, img["base64"], model, prompt, img.get("media_type", "image/png"))
        result["page"] = img["page"]
        pages.append(result)

        total_input += result["input_tokens"]
        total_output += result["output_tokens"]
        total_time += result["time_s"]

        print(f"{result['time_s']}s, {result['input_tokens']}+{result['output_tokens']} tokens")

    # Assemble full text
    full_text = "\n\n".join(p["text"] for p in pages)

    # Estimate cost
    cost = _estimate_cost(model_key, total_input, total_output)

    return {
        "full_text": full_text,
        "pages": pages,
        "total_tokens": {"input": total_input, "output": total_output},
        "total_time_s": round(total_time, 1),
        "model": model,
        "cost_estimate_usd": cost,
    }


def _estimate_cost(model_key: str, input_tokens: int, output_tokens: int) -> float:
    """Rough cost estimate based on published pricing."""
    rates = {
        "haiku":  {"input": 1.00 / 1_000_000, "output": 5.00 / 1_000_000},
        "sonnet": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
    }
    r = rates[model_key]
    return round(input_tokens * r["input"] + output_tokens * r["output"], 6)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Transcribe handwritten essays from PDF")
    parser.add_argument("pdf", help="Path to the PDF file")
    parser.add_argument("--pages", help="Page range, e.g. '2-4' or '3'", default=None)
    parser.add_argument("--model", choices=["haiku", "sonnet"], default="haiku",
                        help="Model to use (default: haiku)")
    parser.add_argument("--typed", action="store_true",
                        help="Use typed-text prompt instead of handwriting prompt")
    parser.add_argument("--save", action="store_true",
                        help="Save output to a .txt file alongside the PDF")
    parser.add_argument("--json", action="store_true",
                        help="Output full results as JSON")

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"ERROR: File not found: {args.pdf}")
        sys.exit(1)

    print(f"{'='*60}")
    print(f"Handwriting OCR — Proof of Concept")
    print(f"{'='*60}")
    print(f"File:  {args.pdf}")
    print(f"Model: {MODELS[args.model]} ({args.model})")
    print(f"Mode:  {'typed' if args.typed else 'handwritten'}")
    if args.pages:
        print(f"Pages: {args.pages}")
    print(f"{'='*60}\n")

    result = transcribe_pdf(args.pdf, args.pages, args.model, args.typed)

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"Pages transcribed: {len(result['pages'])}")
    print(f"Total time:        {result['total_time_s']}s")
    print(f"Tokens (in/out):   {result['total_tokens']['input']} / {result['total_tokens']['output']}")
    print(f"Est. cost:         ${result['cost_estimate_usd']:.4f}")
    print(f"{'='*60}\n")

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result["full_text"])

    if args.save:
        out_path = Path(args.pdf).with_suffix(".transcription.txt")
        out_path.write_text(result["full_text"], encoding="utf-8")
        print(f"\nSaved to: {out_path}")

        # Also save the stats
        stats_path = Path(args.pdf).with_suffix(".transcription.json")
        stats = {k: v for k, v in result.items() if k != "full_text"}
        for p in stats["pages"]:
            p["text"] = p["text"][:100] + "..."  # truncate for stats file
        stats_path.write_text(json.dumps(stats, indent=2), encoding="utf-8")
        print(f"Stats: {stats_path}")


if __name__ == "__main__":
    main()