"""
Thin re-export so vysti_api.py can import the OCR router from the project root.

Usage in vysti_api.py:
    from handwriting_ocr_router import ocr_router
    app.include_router(ocr_router, prefix="/api/ocr")
"""

import sys
import os

# Add the handwriting-ocr directory to sys.path so its imports resolve
_ocr_dir = os.path.join(os.path.dirname(__file__), "handwriting-ocr")
if _ocr_dir not in sys.path:
    sys.path.insert(0, _ocr_dir)

from ocr_router import ocr_router  # noqa: E402
