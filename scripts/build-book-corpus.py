"""Rebuild the licensed, pinned corpus; Python is needed only to refresh books."""
import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--cache", type=Path, default=Path(".book-corpus-cache"))
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
catalog = json.loads((root / "scripts/book-sources/catalog.json").read_text())
output = root / "public/data/books"
output.mkdir(parents=True, exist_ok=True)
args.cache.mkdir(parents=True, exist_ok=True)
books = []
for entry in catalog:
    cached = args.cache / (entry["id"] + ".txt")
    if not cached.exists():
        with urllib.request.urlopen(entry["download"], timeout=30) as response:
            cached.write_bytes(response.read())
    raw = cached.read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
        raise ValueError(f'Source checksum changed: {entry["title"]}')
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        if not re.search(rb"encoding:.*(?:ISO-8859-1|Latin-1)", raw, re.I):
            raise
        text = raw.decode("iso-8859-1")
    start = re.search(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG.*?\*\*\*", text, re.I)
    end = re.search(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG.*?\*\*\*", text, re.I)
    if not start or not end or start.end() >= end.start():
        raise ValueError(f'Book boundaries missing: {entry["title"]}')
    body = text[start.end():end.start()].strip()
    blocks = re.split(r"\n\s*\n", body.replace("\r\n", "\n"))
    paragraphs = []
    section = ""
    for block in blocks:
        paragraph = re.sub(r"\s+", " ", block).strip()
        if not paragraph:
            continue
        if re.match(r"^(?:CHAPTER|BOOK|PART)\s+(?:[IVXLCDM]+|\d+)\b", paragraph, re.I) and len(paragraph) < 160:
            section = paragraph
        paragraphs.append({"text": paragraph, "section": section})
    if len(paragraphs) < 100:
        raise ValueError(f'Incomplete book: {entry["title"]}')
    book = {key: entry[key] for key in ("id", "title", "author", "year", "source")}
    data = {**book, "sourceSha256": entry["sha256"], "paragraphs": paragraphs}
    encoded = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    (output / (entry["id"] + ".json")).write_bytes(encoded)
    # Preserve the complete original, including the Gutenberg header and licence.
    (output / (entry["id"] + ".txt")).write_bytes(raw)
    books.append({**book, "sha256": hashlib.sha256(encoded).hexdigest(), "sourceSha256": entry["sha256"], "paragraphs": len(paragraphs), "bytes": len(encoded)})
revision = hashlib.sha256("".join(book["sha256"] for book in books).encode()).hexdigest()
manifest = {"version": 1, "revision": revision, "books": books}
(output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
(output / "credits.txt").write_text(
    "Lexi book corpus\n\nComplete original texts and their Project Gutenberg licences are preserved in the numbered .txt files.\n"
    "Works are public domain in the USA; check applicable terms in your jurisdiction. No illustrations or published Russian translations are included.\n"
    "The reader normalises whitespace only. Automated translations and explanations are separate from the original English.\n\n"
    + "\n\n".join(f'{entry["title"]} — {entry["author"]}, {entry["year"]}\n{entry["source"]}\nMirror: {entry["download"]}\nOriginal SHA-256: {entry["sha256"]}' for entry in catalog)
    + "\n"
)
print(f'Built {len(books)} complete books, {sum(book["paragraphs"] for book in books)} paragraphs.')
