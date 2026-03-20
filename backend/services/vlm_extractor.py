"""
VLM Extraction Path: Send PDF bytes directly to Gemini Vision.
"""

import json
import time

from google import genai
from google.genai import types

from services.schema import RESPONSE_SCHEMA

VLM_SYSTEM_INSTRUCTION = """
You are an expert in Reference Material Certificates and XML schema extraction. 
Your goal is to extract structured data from the provided content of a certificate into a JSON format that strictly adheres to the Digital Reference Material Document (DRMD) structure.

The input is a PDF IMAGE (for vision processing). You must intelligently reconstruct the logical structure.

Key Extraction Rules:
1. **Administrative Data**: 
   - **Producer**: Extract name, full address, email, and **PHONE NUMBER**. 
     - **PHONE**: Look specifically for labels like "P:", "Phone:", "Tel:", or patterns starting with country codes (e.g., "+49"). Ensure this is extracted.
     - **Address**: If the City is "Berlin", ALWAYS set the 'countryCode' to "DE".
     - **Post Code (CRITICAL)**: Extract the full string exactly as printed. DO NOT normalize. DO NOT remove prefixes like "D-" or state codes like "MD". Example: "D-12489" MUST be extracted as "D-12489", NOT "12489". "MD 20899-2300" MUST be extracted as "MD 20899-2300".
   - **Responsible Persons (Strict Parsing)**: 
     - Interpret the text block hierarchically:
     - **Line 1 (Top)**: Extract as 'name' (e.g., "Dr. F. Emmerling").
     - **Line 2**: Extract as 'role' (e.g., "Head of Department 1").
     - **Lines 3+ (Bottom)**: Combine ALL remaining lines into 'description' (e.g., "Analytical Chemistry; Reference Materials").
   - **Validity**:
     - "valid for X months" -> 'Time After Dispatch' (durationM).
     - "valid until [Date]" -> 'Specific Time' (specificTime).
       - **CRITICAL DATE FORMAT**: ALL dates (dateOfIssue, specificTime) MUST be in **YYYY-MM-DD** format.
       - If a date is given as **MM/YYYY** (e.g. "05/2048"), convert it to the **LAST DAY** of that month (e.g. "2048-05-31").
     - "valid until revoked" -> 'Until Revoked'.

2. **Materials**: Extract name, description, and minimum sample size.
   - **IMPORTANT**: The "Material Name" is often the prominent title of the document (e.g., "Li-NMC 111...").

3. **Properties (CRITICAL - TABLE STRUCTURE)**: 
   - **Property vs. Result**: A "Property" is a high-level section (e.g., "Certified Values", "Informative Values"). A "MeasurementResult" is a specific table within that section.
   - **EXCLUSION RULES (STRICT)**: 
     - **DO NOT EXTRACT** tables containing "Means of Accepted Data Sets", "Laboratory Means", "Participant Results", "Statistical Data", "Homogeneity", or raw data.
     - **ONLY EXTRACT** tables explicitly related to "Certified Values" (or "Certified Property Values") and "Informative Values" (or "Indicative Values", "Additional Material Information").
   - **MULTIPLE TABLES**: If a section contains VISUALLY DISTINCT tables with different column structures (e.g., one table for "Chemical Composition" and another for "Physical Properties"), create SEPARATE 'MeasurementResult' objects for each.
   - **MERGING RULES**: If a single table is split only by unit headers (e.g., "in %" followed by rows, then "in mg/kg" followed by rows), MERGE them into ONE 'MeasurementResult'.
   - **NAMING**: 
     - Give specific names to tables if possible (e.g., "Mass Fraction", "Physical Properties").
     - FORBIDDEN NAMES: Do NOT use "Table 1", "Raw Data", "in mg/kg", "in %" as the *main* table name.
   - **FOOTNOTES & DESCRIPTIONS**: 
     - Capture numbered footnotes (1), 2)) or '*' descriptions found immediately below a table strictly into the 'description' field of that SPECIFIC 'MeasurementResult'. 
     - **DO NOT** put table-specific footnotes in the 'MaterialProperty' description field. Keep the property description for general text.
   - **COLUMN MAPPING**:
     - Values like "< 2" or "> 100" are VALUES. Put them in 'value'. Leave 'uncertainty' empty.
   - **UNCERTAINTY & COVERAGE (CRITICAL)**:
     - **Coverage Factor (k)**: Look for text like "k=2", "k = 2", or "coverage factor k=2" in table captions, footnotes, or the text surrounding the table. Extract the value (e.g., "2") into the 'coverageFactor' field for EACH quantity.
     - **Probability**: Look for confidence levels like "95%", "95 % confidence", "level of confidence 95%". Extract as "0.95" (if found as 95%) or "95 %".
     - **Inheritance**: If "k=2" or "95%" is mentioned in the table footer/description, you **MUST** apply it to **ALL** quantities in that table unless a specific row has a different value.

4. **Statements**: Extract full text for Intended Use, Storage, Handling, etc.
   - **Subcontractors**: Look for sections titled "Participating Laboratories", "Collaborating Laboratories", "Analyses Performed By" or "Subcontractors". Extract the list of laboratory names found under these headers into the 'subcontractors' field.
   - **Reference To Certification Report**: Ensure the coordinates capture the text describing the report availability (e.g., "A detailed technical report..."). Ensure the box is distinct from and strictly BELOW the Subcontractors/Laboratories section.

Return ONLY the JSON object.
"""

def extract_vlm(pdf_bytes: bytes, api_key: str) -> dict:
    """
    Send raw PDF bytes to Gemini 2.5 Flash as a vision input.
    Returns {"result": <parsed JSON>, "time_ms": <float>}.
    """
    start = time.perf_counter()

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(
                        data=pdf_bytes,
                        mime_type="application/pdf",
                    ),
                    types.Part.from_text(
                        text="Extract the structured data from this Reference Material Certificate.",
                    ),
                ],
            ),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            system_instruction=VLM_SYSTEM_INSTRUCTION,
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
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
