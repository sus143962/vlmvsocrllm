"""
OCR + LLM Extraction Path:
  1. Render PDF pages to images (PyMuPDF)
  2. Pass images directly to Tesseract OCR
  3. Send raw text to Gemini for structured extraction
"""

import json
import time

import pymupdf
import pytesseract
from PIL import Image

from google import genai
from google.genai import types

from services.schema import RESPONSE_SCHEMA, SYSTEM_INSTRUCTION


def _pdf_to_text(pdf_bytes: bytes) -> str:
    """Extract text from every page using native text first, OCR as fallback."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    all_text: list[str] = []

    for page in doc:
        # Try native (embedded) text extraction first
        native_text = page.get_text(sort=True).strip()
        if native_text:
            all_text.append(native_text)
            continue

        # Fallback: render page to image and pass directly to Tesseract
        pix = page.get_pixmap(dpi=300)
        pil_img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        ocr_text = pytesseract.image_to_string(
            pil_img, config="--psm 4 --oem 1 -l eng+deu"
        )
        all_text.append(ocr_text)

    doc.close()
    return "\n\n".join(all_text)


def extract_ocr_llm(pdf_bytes: bytes, api_key: str) -> dict:
    """
    OCR the PDF then send the raw text to Gemini for extraction.
    Returns {"result": ..., "time_ms": ..., "ocr_text": ..., "input_tokens": ..., "output_tokens": ...}.
    """
    start = time.perf_counter()

    # Step 1 – OCR
    ocr_text = _pdf_to_text(pdf_bytes)

    # Step 2 – Send OCR text to Gemini (same model, schema & instruction)
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_text(
                        text=(
                            "Extract from the following OCR text of a Reference Material Certificate.\n\n" + ocr_text
                        ),
                    ),
                ],
            ),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0,
        ),
    )

    elapsed_ms = (time.perf_counter() - start) * 1000
    result = json.loads(response.text)

    # Extract token usage
    usage = response.usage_metadata
    input_tokens = getattr(usage, "prompt_token_count", 0) or 0
    output_tokens = getattr(usage, "candidates_token_count", 0) or 0

    return {
        "result": result,
        "time_ms": round(elapsed_ms, 1),
        "ocr_text": ocr_text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
