# vysti_api.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from marker import mark_docx_bytes  # uses your existing engine
import io

app = FastAPI(title="Vysti Marker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosened for dev; we can tighten later
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
    author: str | None = Form(None),
    title: str | None = Form(None),
    author2: str | None = Form(None),
    title2: str | None = Form(None),
    author3: str | None = Form(None),
    title3: str | None = Form(None),
):
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
    if author:
        teacher_config["author_name"] = author
    if title:
        teacher_config["text_title"] = title
    if author2:
        teacher_config["author_name_2"] = author2
    if title2:
        teacher_config["text_title_2"] = title2
    if author3:
        teacher_config["author_name_3"] = author3
    if title3:
        teacher_config["text_title_3"] = title3

    # 4. Call your engine
    # mark_docx_bytes is defined in marker.py and returns (marked_bytes, metadata)
    marked_bytes, metadata = mark_docx_bytes(
        docx_bytes,
        mode=mode,
        teacher_config=teacher_config,
        # rules_path default "Vysti Rules for Writing.xlsx" is fine for now
    )

    # For now, just log metadata to the server console so you can see it
    print("Vysti metadata:", metadata)

    # 5. Stream the marked .docx back to the client
    base_name = file.filename.rsplit(".", 1)[0] if file.filename else "essay"
    output_filename = f"{base_name}_marked.docx"

    return StreamingResponse(
        io.BytesIO(marked_bytes),
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{output_filename}"'
        },
    )
