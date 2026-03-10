from fastapi import FastAPI, UploadFile, File
import re
import tempfile

import pdfplumber
import fitz  # pymupdf
from rapidfuzz import fuzz

app = FastAPI()

# Words that are payroll labels / company identifiers that must not be returned as a "name".
BLACKLIST = {
    "categorie","catégorie","echelon","échelon","poste","fonction","societe","société","adresse",
    "matricule","cnss","rib","banque","date","periode","période","salaire","bulletin","paie","paye",
    "base","brut","net","cotisation","cotisations","retenue","retenues","prime","primes",
    "taux","gain","gains","deduction","déduction","total","totaux",
    "altra","call"
}

# Strongest, most reliable pattern seen in provided payslips:
# Example: 0832 - JABER Maher
RE_ID_DASH = re.compile(r"^\s*\d{2,6}\s*-\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ'\- ]{1,})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\- ]{1,})(?:\s|$)", re.M)

# Generic uppercase-lastname + firstname line (fallback, conservative)
RE_GENERIC = re.compile(r"^\s*([A-ZÀ-Ÿ]{3,}[A-ZÀ-Ÿ'\- ]{0,})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\- ]{1,})\s*$", re.M)

def normalize(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s

def is_noisy(candidate: str) -> bool:
    low = candidate.lower()
    return any(w in low for w in BLACKLIST)

def extract_text_pdfplumber(path: str) -> str:
    chunks = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages[:2]:
            chunks.append(p.extract_text() or "")
    return "\n".join(chunks)

def extract_text_pymupdf(path: str) -> str:
    doc = fitz.open(path)
    parts = []
    for i in range(min(2, doc.page_count)):
        parts.append(doc.load_page(i).get_text("text"))
    return "\n".join(parts)

def best_candidate_from_text(text: str):
    text = text.replace("\r", "\n")

    m = RE_ID_DASH.search(text)
    if m:
        last = normalize(m.group(1))
        first = normalize(m.group(2))
        cand = f"{last} {first}".strip()
        if cand and not is_noisy(cand):
            return cand, 0.95, [m.group(0).strip()]

    # Look near Employé block if present (common in payslips)
    lines = [normalize(l) for l in text.split("\n") if normalize(l)]
    idx = None
    for i, l in enumerate(lines):
        if "employé" in l.lower() or "employe" in l.lower():
            idx = i
            break
    if idx is not None:
        window = "\n".join(lines[idx: min(len(lines), idx+30)])
        m2 = RE_ID_DASH.search(window)
        if m2:
            last = normalize(m2.group(1))
            first = normalize(m2.group(2))
            cand = f"{last} {first}".strip()
            if cand and not is_noisy(cand):
                return cand, 0.92, [m2.group(0).strip()]

    # Fallback: conservative generic line
    for l in lines:
        m3 = RE_GENERIC.match(l)
        if not m3:
            continue
        # first name should contain a lowercase letter
        if not re.search(r"[a-zà-ÿ]", m3.group(2)):
            continue
        cand = f"{normalize(m3.group(1))} {normalize(m3.group(2))}".strip()
        if cand and not is_noisy(cand):
            return cand, 0.75, [l]

    return None, 0.0, []

@app.post("/extract-name")
async def extract_name(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name

    # Try pdfplumber first; fallback to pymupdf
    text = extract_text_pdfplumber(path)
    cand, conf, signals = best_candidate_from_text(text)
    method = "pdfplumber"

    if not cand:
        text2 = extract_text_pymupdf(path)
        cand, conf, signals = best_candidate_from_text(text2)
        method = "pymupdf" if cand else "none"

    return {
        "candidate_full_name": cand,
        "confidence": conf,
        "signals": signals,
        "method": method,
    }
