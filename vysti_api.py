# vysti_api.py

import os
import io
from io import BytesIO

import httpx
from collections import Counter
from fastapi import (
    FastAPI,
    File,
    UploadFile,
    Form,
    Depends,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from docx import Document

from marker import mark_docx_bytes, extract_summary_metadata  # uses your existing engine


app = FastAPI(title="Vysti Marker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosened for dev; you can tighten this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Supabase config (from environment variables) =====
# ===== Supabase config (from environment variables) =====
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

auth_scheme = HTTPBearer(auto_error=False)



async def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
):
    """
    Validate the Supabase JWT by calling Supabase's Auth API.
    Returns the user dict if valid; otherwise raises 401.
    """
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = cred.credentials

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase config missing on server",
        )

    auth_url = f"{SUPABASE_URL}/auth/v1/user"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            auth_url,
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
        )

    if resp.status_code != 200:
        # Invalid or expired token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return resp.json()


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Vysti marker API is running"}


@app.post("/mark")
async def mark_essay(
    file: UploadFile = File(...),
    mode: str = Form("textual_analysis"),
    user: dict = Depends(get_current_user),  # <-- require Supabase auth

    # Primary work
    author: str | None = Form(None),
    title: str | None = Form(None),
    text_is_minor_work: bool | None = Form(None),

    # New metadata (optional)
    student_name: str | None = Form(None),
    assignment_name: str | None = Form(None),
    class_id: str | None = Form(None),

    # Second work (optional)
    author2: str | None = Form(None),
    title2: str | None = Form(None),
    text_is_minor_work_2: bool | None = Form(None),

    # Third work (optional)
    author3: str | None = Form(None),
    title3: str | None = Form(None),
    text_is_minor_work_3: bool | None = Form(None),

    # Rule toggles (optional)
    forbid_personal_pronouns: bool | None = Form(None),
    forbid_audience_reference: bool | None = Form(None),
    enforce_closed_thesis: bool | None = Form(None),
    require_body_evidence: bool | None = Form(None),
    allow_intro_summary_quotes: bool | None = Form(None),
    enforce_intro_quote_rule: bool | None = Form(None),
    enforce_long_quote_rule: bool | None = Form(None),
    enforce_contractions_rule: bool | None = Form(None),
    enforce_which_rule: bool | None = Form(None),
    enforce_weak_verbs_rule: bool | None = Form(None),
    enforce_fact_proof_rule: bool | None = Form(None),
    enforce_human_people_rule: bool | None = Form(None),
    enforce_vague_terms_rule: bool | None = Form(None),
    enforce_sva_rule: bool | None = Form(None),
    enforce_present_tense_rule: bool | None = Form(None),
    highlight_thesis_devices: bool | None = Form(None),
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

    # 2. Validate class_id if provided
    class_id_validated = None
    if class_id:
        user_id = user.get("id") if isinstance(user, dict) else None
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid user"},
            )
        
        # Verify class exists and belongs to user
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            db_url = f"{SUPABASE_URL}/rest/v1/classes"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{db_url}?id=eq.{class_id}&user_id=eq.{user_id}&archived=eq.false",
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if not data or len(data) == 0:
                        return JSONResponse(
                            status_code=400,
                            content={"error": "Class not found or does not belong to user"},
                        )
                    class_id_validated = class_id
                else:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Failed to validate class"},
                    )

    # 3. Read file bytes
    docx_bytes = await file.read()

    # 4. Build teacher_config from form fields (matches MarkerConfig)
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
    if enforce_long_quote_rule is not None:
        teacher_config["enforce_long_quote_rule"] = enforce_long_quote_rule
    if enforce_contractions_rule is not None:
        teacher_config["enforce_contractions_rule"] = enforce_contractions_rule
    if enforce_which_rule is not None:
        teacher_config["enforce_which_rule"] = enforce_which_rule
    if enforce_weak_verbs_rule is not None:
        teacher_config["enforce_weak_verbs_rule"] = enforce_weak_verbs_rule
    if enforce_fact_proof_rule is not None:
        teacher_config["enforce_fact_proof_rule"] = enforce_fact_proof_rule
    if enforce_human_people_rule is not None:
        teacher_config["enforce_human_people_rule"] = enforce_human_people_rule
    if enforce_vague_terms_rule is not None:
        teacher_config["enforce_vague_terms_rule"] = enforce_vague_terms_rule
    if enforce_sva_rule is not None:
        teacher_config["enforce_sva_rule"] = enforce_sva_rule
    if enforce_present_tense_rule is not None:
        teacher_config["enforce_present_tense_rule"] = enforce_present_tense_rule
    if highlight_thesis_devices is not None:
        teacher_config["highlight_thesis_devices"] = highlight_thesis_devices

    # 5. Call your engine
    marked_bytes, metadata = mark_docx_bytes(
        docx_bytes,
        mode=mode,
        teacher_config=teacher_config if teacher_config else None,
    )

    # You can watch this in Render logs to confirm the flags:
    print("Vysti metadata:", metadata)
    print("Teacher config used:", teacher_config)

    # ----- Count yellow labels from metadata -----
    issues = metadata.get("issues", []) if isinstance(metadata, dict) else []

    label_counter = Counter()
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        lbl = issue.get("label")
        if not lbl:
            continue
        cnt = issue.get("count")
        try:
            cnt_i = int(cnt) if cnt is not None else 1
        except Exception:
            cnt_i = 1
        label_counter[lbl] += (cnt_i if cnt_i > 0 else 1)

    total_labels = sum(label_counter.values())



    # Log usage in Supabase mark_events (best-effort; do not break marking if this fails)
    try:
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            user_id = user.get("id") if isinstance(user, dict) else None
            db_url = f"{SUPABASE_URL}/rest/v1/mark_events"
            payload = {
                "user_id": user_id,
                "file_name": file.filename,
                "mode": mode,
                "bytes": len(docx_bytes),
                "student_name": student_name,
                "assignment_name": assignment_name,
                "class_id": class_id_validated,
                "total_labels": total_labels,
                "label_counts": dict(label_counter),
                "issues": issues,
            }

            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    db_url,
                    json=payload,
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                )
    except Exception as e:
        print("Failed to log mark_event:", repr(e))

    # 5. Stream the marked .docx back to the client
    base_name = file.filename.rsplit(".", 1)[0] if file.filename else "essay"
    output_filename = f"{base_name}_marked.docx"


    return StreamingResponse(
        io.BytesIO(marked_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )


@app.post("/ingest_marked")
async def ingest_marked_essay(
    file: UploadFile = File(...),
    student_name: str | None = Form(None),
    assignment_name: str | None = Form(None),
    mode: str = Form("imported_marked"),
    class_id: str | None = Form(None),
    user: dict = Depends(get_current_user),  # <-- require Supabase auth
):
    """
    Ingest an already-marked .docx file by extracting label counts from the summary table
    and logging it to mark_events.
    """
    # 1. Basic validation
    if not file.filename.lower().endswith(".docx"):
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload a .docx file"},
        )

    # 2. Read file bytes
    docx_bytes = await file.read()

    # 3. Parse the document to extract summary metadata
    try:
        doc = Document(BytesIO(docx_bytes))
        metadata = extract_summary_metadata(doc)
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to parse document: {str(e)}"},
        )

    # 4. Validate that this is a marked document
    issues = metadata.get("issues", [])
    if not issues:
        return JSONResponse(
            status_code=400,
            content={"error": "This doc doesn't appear to be a Vysti-marked file"},
        )

    # 5. Build label_counts from issues
    label_counter = Counter()
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        lbl = issue.get("label")
        if not lbl:
            continue
        cnt = issue.get("count")
        try:
            cnt_i = int(cnt) if cnt is not None else 1
        except Exception:
            cnt_i = 1
        # Ensure count is at least 1
        label_counter[lbl] += max(cnt_i, 1)

    total_labels = sum(label_counter.values())

    # 6. Validate class_id if provided
    class_id_validated = None
    if class_id:
        user_id = user.get("id") if isinstance(user, dict) else None
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="Invalid user",
            )
        
        # Verify class exists and belongs to user
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            db_url = f"{SUPABASE_URL}/rest/v1/classes"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{db_url}?id=eq.{class_id}&user_id=eq.{user_id}&archived=eq.false",
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if not data or len(data) == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="Class not found or does not belong to user",
                        )
                    class_id_validated = class_id
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to validate class",
                    )

    # 7. Log to Supabase mark_events
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration missing on server",
        )

    user_id = user.get("id") if isinstance(user, dict) else None
    db_url = f"{SUPABASE_URL}/rest/v1/mark_events"
    payload = {
        "user_id": user_id,
        "file_name": file.filename,
        "mode": mode,
        "bytes": len(docx_bytes),
        "student_name": student_name,
        "assignment_name": assignment_name,
        "class_id": class_id_validated,
        "total_labels": total_labels,
        "label_counts": dict(label_counter),
        "issues": issues,
    }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                db_url,
                json=payload,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
            )
            # Check if the insert was successful
            if resp.status_code < 200 or resp.status_code >= 300:
                error_msg = resp.text or f"Supabase insert failed with status {resp.status_code}"
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to log mark event to database: {error_msg}",
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log mark event: {str(e)}",
        )

    # 8. Return success response
    return JSONResponse(
        content={
            "ok": True,
            "total_labels": total_labels,
            "label_counts": dict(label_counter),
            "issues": issues,
        }
    )
