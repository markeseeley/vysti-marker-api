# Handwriting OCR for Vysti Marker

Convert photographed handwritten student essays into digital text, then feed them through the existing Vysti marking engine.

## Status: Planning

## Approach

Use a multimodal LLM (Claude vision) as the primary transcription engine:
- Teacher photographs handwritten pages with phone camera
- Images are preprocessed (deskew, crop, contrast)
- Sent to Claude for transcription
- Plain text output feeds into existing `/mark_text` or `/check_text` endpoints

## Project Structure

```
handwriting-ocr/
  README.md          — this file
  PLAN.md            — implementation plan and architecture
  poc/               — proof-of-concept scripts (isolated from main app)
```

## Integration Point

Once validated, this becomes a preprocessing step that produces a plain text string.
That string enters the existing marking pipeline — no changes to the core engine needed.