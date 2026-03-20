"""
Shared constants for VLM vs OCR+LLM benchmark.
RESPONSE_SCHEMA and SYSTEM_INSTRUCTION are identical for both extraction paths
to ensure a fair comparison.

NOTE: Coordinate fields (fieldCoordinates, sectionCoordinates) are excluded
from the response schema to stay within Gemini's structured output constraint
limits. The system instruction still asks the model to reason about layout
but does not require coordinate output.
"""

# --------------------------------------------------------------------------- #
# RESPONSE_SCHEMA – Gemini structured-output schema for certificate extraction
# Stripped of all coordinate sub-schemas to avoid "too many states" error.
# --------------------------------------------------------------------------- #
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "administrativeData": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING"},
                "validityType": {
                    "type": "STRING",
                    "enum": [
                        "Until Revoked",
                        "Time After Dispatch",
                        "Specific Time",
                    ],
                },
                "durationY": {"type": "INTEGER"},
                "durationM": {"type": "INTEGER"},
                "dateOfIssue": {"type": "STRING"},
                "specificTime": {"type": "STRING"},
                "producers": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "email": {"type": "STRING"},
                            "phone": {"type": "STRING"},
                            "fax": {"type": "STRING"},
                            "address": {
                                "type": "OBJECT",
                                "properties": {
                                    "street": {"type": "STRING"},
                                    "streetNo": {"type": "STRING"},
                                    "postCode": {"type": "STRING"},
                                    "city": {"type": "STRING"},
                                    "countryCode": {"type": "STRING"},
                                },
                            },
                            "organizationIdentifiers": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "scheme": {"type": "STRING"},
                                        "value": {"type": "STRING"},
                                        "link": {"type": "STRING"},
                                    },
                                },
                            },
                        },
                    },
                },
                "responsiblePersons": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "role": {"type": "STRING"},
                            "description": {"type": "STRING"},
                        },
                    },
                },
            },
        },
        "materials": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "minimumSampleSize": {"type": "STRING"},
                    "materialClass": {"type": "STRING"},
                    "itemQuantities": {"type": "STRING"},
                    "isCertified": {"type": "BOOLEAN"},
                    "materialIdentifiers": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "scheme": {"type": "STRING"},
                                "value": {"type": "STRING"},
                                "link": {"type": "STRING"},
                            },
                        },
                    },
                },
            },
        },
        "properties": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "isCertified": {"type": "BOOLEAN"},
                    "description": {"type": "STRING"},
                    "procedures": {"type": "STRING"},
                    "results": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "description": {"type": "STRING"},
                                "quantities": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "name": {"type": "STRING"},
                                            "value": {"type": "STRING"},
                                            "unit": {"type": "STRING"},
                                            "dsiValue": {"type": "STRING"},
                                            "dsiUnit": {"type": "STRING"},
                                            "uncertainty": {"type": "STRING"},
                                            "coverageFactor": {
                                                "type": "STRING",
                                            },
                                            "coverageProbability": {
                                                "type": "STRING",
                                            },
                                            "distribution": {"type": "STRING"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "statements": {
            "type": "OBJECT",
            "properties": {
                "official": {
                    "type": "OBJECT",
                    "properties": {
                        "intendedUse": {"type": "STRING"},
                        "storageInformation": {"type": "STRING"},
                        "handlingInstructions": {"type": "STRING"},
                        "metrologicalTraceability": {"type": "STRING"},
                        "healthAndSafety": {"type": "STRING"},
                        "subcontractors": {"type": "STRING"},
                        "legalNotice": {"type": "STRING"},
                        "referenceToCertificationReport": {"type": "STRING"},
                    },
                },
            },
        },
    },
}

# --------------------------------------------------------------------------- #
# SYSTEM_INSTRUCTION – Extraction rules for Gemini (identical for both paths)
# Coordinate instructions removed to match the simplified schema.
# --------------------------------------------------------------------------- #
SYSTEM_INSTRUCTION = """\
You are an expert in Reference Material Certificates and structured data extraction.
Your goal is to extract structured data from the provided certificate content into a JSON format that strictly adheres to the Digital Reference Material Document (DRMD) structure.
The input may be a document, image, or text. Regardless of the input format, apply the same extraction rules and produce the same structured output.
You must intelligently reconstruct the logical structure.

Key Extraction Rules:

Administrative Data:
Producer: Extract name, full address, email, and PHONE NUMBER.
PHONE: Look specifically for labels like "P:", "Phone:", "Tel:", or patterns starting with country codes (e.g., "+49"). Ensure this is extracted.
Address: If the City is "Berlin", ALWAYS set the 'countryCode' to "DE".

Responsible Persons (Strict Parsing):
Interpret the text block hierarchically:
Line 1 (Top): Extract as 'name' (e.g., "Dr. F. Emmerling").
Line 2: Extract as 'role' (e.g., "Head of Department 1").
Lines 3+ (Bottom): Combine ALL remaining lines into 'description' (e.g., "Analytical Chemistry; Reference Materials").

Validity:
"valid for X months" -> 'Time After Dispatch' (durationM).
"valid until [Date]" -> 'Specific Time' (specificTime).
CRITICAL DATE FORMAT: ALL dates (dateOfIssue, specificTime) MUST be in YYYY-MM-DD format.
If a date is given as MM/YYYY (e.g. "05/2048"), convert it to the LAST DAY of that month (e.g. "2048-05-31").
"valid until revoked" -> 'Until Revoked'.

Materials: Extract name, description, and minimum sample size.
IMPORTANT: The "Material Name" is often the prominent title of the document (e.g., "Li-NMC 111...").
Material Identifier: Look for the main reference material code at the top of the document (e.g., "BAM-M386a", "ERM-DA470k", "NIST SRM 1234").
Split it into Scheme (e.g., "BAM", "ERM", "NIST") and Value (e.g., "M386a", "DA470k", "SRM 1234").
If the code is just a number or code without a clear provider prefix, use "MaterialID" as the scheme.

Properties (CRITICAL - TABLE STRUCTURE):
Property vs. Result: A "Property" is a high-level section (e.g., "Certified Values", "Informative Values"). A "MeasurementResult" is a specific table within that section.

EXCLUSION RULES (STRICT):
DO NOT EXTRACT tables containing "Means of Accepted Data Sets", "Laboratory Means", "Participant Results", "Statistical Data", "Homogeneity", or raw data.
ONLY EXTRACT tables explicitly related to "Certified Values" (or "Certified Property Values") and "Informative Values" (or "Indicative Values", "Additional Material Information").

MULTIPLE TABLES: If a section contains VISUALLY DISTINCT tables with different column structures (e.g., one table for "Chemical Composition" and another for "Physical Properties"), create SEPARATE 'MeasurementResult' objects for each.
MERGING RULES: If a single table is split only by unit headers (e.g., "in %" followed by rows, then "in mg/kg" followed by rows), MERGE them into ONE 'MeasurementResult'.

NAMING:
Give specific names to tables if possible (e.g., "Mass Fraction", "Physical Properties").
FORBIDDEN NAMES: Do NOT use "Table 1", "Raw Data", "in mg/kg", "in %" as the main table name.

FOOTNOTES & DESCRIPTIONS:
Capture numbered footnotes (1), 2)) or '*' descriptions found immediately below a table strictly into the 'description' field of that SPECIFIC 'MeasurementResult'.
DO NOT put table-specific footnotes in the 'MaterialProperty' description field. Keep the property description for general text.

COLUMN MAPPING:
Values like "< 2" or "> 100" are VALUES. Put them in 'value'. Leave 'uncertainty' empty.

UNCERTAINTY & COVERAGE (CRITICAL):
Coverage Factor (k): Look for text like "k=2", "k = 2", or "coverage factor k=2" in table captions, footnotes, or the text surrounding the table. Extract the value (e.g., "2") into the 'coverageFactor' field for EACH quantity.
Probability: Look for confidence levels like "95%", "95 % confidence", "level of confidence 95%". Extract as "0.95" (if found as 95%) or "95 %".
Inheritance: If "k=2" or "95%" is mentioned in the table footer/description, you MUST apply it to ALL quantities in that table unless a specific row has a different value.

Statements: Extract full text for Intended Use, Storage, Handling, etc.
Subcontractors: Look for sections titled "Participating Laboratories", "Collaborating Laboratories", "Analyses Performed By" or "Subcontractors". Extract the list of laboratory names found under these headers into the 'subcontractors' field.
Reference To Certification Report: Extract the text describing the report availability (e.g., "A detailed technical report...").

Return ONLY the JSON object.
"""
