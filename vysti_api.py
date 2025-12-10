# vysti_api.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from marker import mark_docx_bytes  # uses your existing engine
import io

app = FastAPI(title="Vysti Marker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosened for dev; you can tighten this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Vysti marker API is running"}


@app.post("/mark")
async def mark_essay(
    file: UploadFile = File(...),
    mode: str = Form("textual_analysis"),

    # Primary work
    author: str | None = Form(None),
    title: str | None = Form(None),
    text_is_minor_work: bool | None = Form(None),

    # Second work (optional)
    author2: str | None = Form(None),
    title2: str | None = Form(None),
    text_is_minor_work_2: bool | None = Form(None),

    # Third work (optional)
    author3: str | None = Form(None),
    title3: str | None = Form(None),
    text_is_minor_work_3: bool | None = Form(None),

    # Rule toggles (optional)
    # Rule toggles (optional)
    forbid_personal_pronouns: bool | None = Form(None),
    forbid_audience_reference: bool | None = Form(None),
    enforce_closed_thesis: bool | None = Form(None),
    require_body_evidence: bool | None = Form(None),
    allow_intro_summary_quotes: bool | None = Form(None),
    enforce_intro_quote_rule: bool | None = Form(None),
    enforce_contractions_rule: bool | None = Form(None),
):
    """
    Mark a .docx essay using the Vysti engine.

    Accepts up to three works (author/title) plus:
      - text_is_minor_work, text_is_minor_work_2, text_is_minor_work_3
      - forbid_personal_pronouns
      - enforce_closed_thesis

    These map directly onto MarkerConfig in marker.py.
    """
    # 1. Basic validation
    if not file.filename.lower().endswith(".docx"):
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload a .docx file"},
        )

    # 2. Read file bytes
    docx_bytes = await file.read()

    # 3. Build teacher_config from form fields (matches MarkerConfig)
    teacher_config: dict = {}

    # --- Works / titles ---
    if author:
        teacher_config["author_name"] = author
    if title:
        teacher_config["text_title"] = title
    if text_is_minor_work is not None:
        teacher_config["text_is_minor_work"] = text_is_minor_work

    if author2:
        teacher_config["author_name_2"] = author2
    if title2:
        teacher_config["text_title_2"] = title2
    if text_is_minor_work_2 is not None:
        teacher_config["text_is_minor_work_2"] = text_is_minor_work_2

    if author3:
        teacher_config["author_name_3"] = author3
    if title3:
        teacher_config["text_title_3"] = title3
    if text_is_minor_work_3 is not None:
        teacher_config["text_is_minor_work_3"] = text_is_minor_work_3

    # --- Rule overrides ---
    # These override the defaults chosen by get_preset_config(mode)
    if forbid_personal_pronouns is not None:
        teacher_config["forbid_personal_pronouns"] = forbid_personal_pronouns
    if forbid_audience_reference is not None:
        teacher_config["forbid_audience_reference"] = forbid_audience_reference
    if enforce_closed_thesis is not None:
        teacher_config["enforce_closed_thesis"] = enforce_closed_thesis
    if require_body_evidence is not None:
        teacher_config["require_body_evidence"] = require_body_evidence
    if allow_intro_summary_quotes is not None:
        teacher_config["allow_intro_summary_quotes"] = allow_intro_summary_quotes
    if enforce_intro_quote_rule is not None:
        teacher_config["enforce_intro_quote_rule"] = enforce_intro_quote_rule
    if enforce_contractions_rule is not None:
        teacher_config["enforce_contractions_rule"] = enforce_contractions_rule
    # 4. Call your engine
    marked_bytes, metadata = mark_docx_bytes(
        docx_bytes,
        mode=mode,
        teacher_config=teacher_config if teacher_config else None,
        # rules_path default "Vysti Rules for Writing.xlsx" is fine
    )

    # You can watch this in Render logs to confirm the flags:
    print("Vysti metadata:", metadata)
    print("Teacher config used:", teacher_config)

    # 5. Stream the marked .docx back to the client
    base_name = file.filename.rsplit(".", 1)[0] if file.filename else "essay"
    output_filename = f"{base_name}_marked.docx"

    return StreamingResponse(
        io.BytesIO(marked_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )
