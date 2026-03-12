"""
OCR Router — FastAPI endpoint for handwriting transcription.

This is a standalone router that can be mounted into the main app with one line:
    app.include_router(ocr_router, prefix="/api/ocr")

NOT wired into vysti_api.py until fully tested.
"""

import asyncio
import base64
import io
import os
import time

import anthropic
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

ocr_router = APIRouter(tags=["ocr"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MAX_PAGES = 20
MAX_IMAGE_SIZE_MB = 10
MAX_B64_BYTES = 5_242_880
MAX_IMAGE_BYTES = int(MAX_B64_BYTES * 3 / 4) - 10_000
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

MODELS = {
    "handwritten": "claude-sonnet-4-6",    # Sonnet for handwriting (proven better)
    "typed":       "claude-haiku-4-5-20251001",  # Haiku for typed text (cheaper, accurate enough)
}

HANDWRITING_PROMPT = """Transcribe the handwritten text in this image exactly as the student wrote it.

Rules:
- Preserve the student's original wording, spelling, and grammar (including errors)
- Where text has been crossed out and replaced with a word written above, use the REPLACEMENT word
- If a word is truly illegible, write [illegible]
- Ignore any printed/typed text (like headers or form labels) — only transcribe handwritten content
- Ignore teacher annotations in different colored ink (red pen marks, circled items, marginal comments)
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
# Image processing
# ---------------------------------------------------------------------------

def _compress_image(image_bytes: bytes, content_type: str) -> tuple[bytes, str]:
    """Compress image to fit within API limits. Returns (bytes, media_type)."""
    # If already small enough, return as-is
    if len(image_bytes) <= MAX_IMAGE_BYTES and content_type in ("image/jpeg", "image/png", "image/webp"):
        return image_bytes, content_type

    # Convert to JPEG, reducing quality until it fits
    img = Image.open(io.BytesIO(image_bytes))

    # Handle HEIC or other formats by converting to RGB
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    for quality in (85, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        jpeg_bytes = buf.getvalue()
        if len(jpeg_bytes) <= MAX_IMAGE_BYTES:
            return jpeg_bytes, "image/jpeg"

    # Last resort: resize
    img.thumbnail((2000, 2000), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=60)
    return buf.getvalue(), "image/jpeg"


async def _transcribe_page(
    client: anthropic.AsyncAnthropic,
    image_bytes: bytes,
    media_type: str,
    model: str,
    prompt: str,
) -> dict:
    """Transcribe a single page image."""
    t0 = time.time()
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = await client.messages.create(
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
                        "data": b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )

    return {
        "text": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "time_s": round(time.time() - t0, 1),
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

MAX_PAGES_MOBILE = 15


@ocr_router.post("/transcribe")
async def transcribe_images(
    images: list[UploadFile] = File(..., description="Page images in order"),
    mode: str = Form("handwritten", description="'handwritten' or 'typed'"),
    source: str = Form("desktop", description="'desktop' or 'mobile'"),
):
    """Accept ordered page images and return transcribed text.

    Returns:
        {
            "text": "full assembled text...",
            "pages": [{"page": 1, "text": "...", "time_s": 1.2}, ...],
            "total_time_s": 5.4,
            "token_usage": {"input": 1234, "output": 567},
            "model": "claude-sonnet-4-6",
            "page_count": 3
        }
    """
    # Validate
    if not images:
        raise HTTPException(400, "No images provided")
    page_limit = MAX_PAGES_MOBILE if source == "mobile" else MAX_PAGES
    if len(images) > page_limit:
        raise HTTPException(400, f"Maximum {page_limit} pages allowed")
    if mode not in ("handwritten", "typed"):
        raise HTTPException(400, "Mode must be 'handwritten' or 'typed'")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "OCR service not configured")

    model = MODELS[mode]
    prompt = HANDWRITING_PROMPT if mode == "handwritten" else TYPED_PROMPT
    client = anthropic.AsyncAnthropic(api_key=api_key)

    # Read and compress all images
    prepared = []
    for i, img in enumerate(images):
        content_type = img.content_type or "image/jpeg"
        if content_type not in ALLOWED_TYPES:
            raise HTTPException(400, f"Page {i+1}: unsupported format '{content_type}'. Use JPEG, PNG, or WebP.")

        raw = await img.read()
        if len(raw) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise HTTPException(400, f"Page {i+1}: image exceeds {MAX_IMAGE_SIZE_MB}MB limit")

        compressed, media_type = _compress_image(raw, content_type)
        prepared.append((compressed, media_type))

    # Transcribe all pages concurrently
    tasks = [
        _transcribe_page(client, img_bytes, media_type, model, prompt)
        for img_bytes, media_type in prepared
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Assemble results
    pages = []
    total_input = 0
    total_output = 0
    total_time = 0.0

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            pages.append({
                "page": i + 1,
                "text": f"[Error transcribing page {i+1}: {str(result)}]",
                "time_s": 0,
            })
        else:
            pages.append({
                "page": i + 1,
                "text": result["text"],
                "time_s": result["time_s"],
            })
            total_input += result["input_tokens"]
            total_output += result["output_tokens"]
            total_time += result["time_s"]

    full_text = "\n\n".join(p["text"] for p in pages)

    return {
        "text": full_text,
        "pages": pages,
        "total_time_s": round(total_time, 1),
        "token_usage": {"input": total_input, "output": total_output},
        "model": model,
        "page_count": len(pages),
    }
