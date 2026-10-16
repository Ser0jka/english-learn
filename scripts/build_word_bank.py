"""Build a deterministic bilingual sense bank. Python 3 standard library only.

Downloads immutable source revisions with SHA-256 verification, never uses AI.
Run: python3 scripts/build_word_bank.py --cache /tmp/lexi-word-bank-sources
The generated data is distributed under CC BY-SA 4.0; see WORD_BANK.md.
"""

import argparse
import collections
import hashlib
import json
from pathlib import Path
import random
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "wordnet.zip": (
        "https://raw.githubusercontent.com/nltk/nltk_data/550b6625bcef1f2abff2ff770a5a0d272c9c6b2a/packages/corpora/wordnet.zip",
        "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59",
    ),
    "russian.tab": (
        "https://raw.githubusercontent.com/omwn/omw-data/406bf83b3c507a3d1f26e88252d5d66893fd36bf/wns/wikt/wn-wikt-rus.tab",
        "bdb2f68c2ba46ca89e131b6b3c5bd14fdbb2c2f00a9dc7cb1dd24e00f08c6751",
    ),
    "frequency.txt": (
        "https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/en/en_50k.txt",
        "5351ff405b1126ef555791dd4d9798a48e3e9a501a9fc481a9da957752cfb458",
    ),
}
POS = {"n": "noun", "v": "verb", "a": "adjective", "r": "adverb"}
# Abbreviations and function words have misleadingly high subtitle frequency.
SKIP = set("a an the in out no not do be are is am don so".split())
REGISTER = re.compile(r"offensive|vulgar|obscene|derogatory|archaic|obsolete|sexual intercourse|orgasm", re.I)
TRAVEL = {"noun.animal", "noun.plant", "noun.location", "noun.phenomenon", "noun.object", "verb.motion"}
IDEAS = {"noun.feeling", "noun.cognition", "noun.communication", "noun.attribute", "verb.cognition", "verb.emotion"}


def obtain(cache, name):
    url, expected = SOURCES[name]
    dest = cache / name
    if not dest.exists():
        temporary = dest.with_suffix(".download")
        with urllib.request.urlopen(url, timeout=60) as response:
            temporary.write_bytes(response.read())
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != expected:
            temporary.unlink()
            raise ValueError("Source checksum mismatch: " + name)
        temporary.replace(dest)
    if hashlib.sha256(dest.read_bytes()).hexdigest() != expected:
        raise ValueError("Cached source checksum mismatch: " + name)
    return dest


def build(cache):
    paths = {name: obtain(cache, name) for name in SOURCES}
    freq = {line.rsplit(" ", 1)[0]: i + 1 for i, line in enumerate(paths["frequency.txt"].read_text().splitlines())}
    russian = collections.defaultdict(list)
    for line in paths["russian.tab"].read_text().splitlines():
        if line.startswith("#") or not line:
            continue
        key, kind, lemma = line.split("\t")
        if kind == "rus:lemma" and re.fullmatch(r"[а-яёА-ЯЁ][а-яёА-ЯЁ -]{0,99}", lemma) and lemma not in russian[key]:
            russian[key].append(lemma)
    source = zipfile.ZipFile(paths["wordnet.zip"])
    lexical_names = {int(line.split()[0]): line.split()[1] for line in source.read("wordnet/lexnames").decode().splitlines()}
    senses = {}
    for line in source.read("wordnet/index.sense").decode().splitlines():
        label, offset, number, _count = line.split()
        lemma, kind = label.split("%")
        pos = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "a"}[kind[0]]
        senses[(offset + "-" + pos, lemma)] = int(number)
    records = []
    equivalence = collections.defaultdict(set)
    ru_by_word = collections.defaultdict(set)
    for extension in ["noun", "verb", "adj", "adv"]:
        for line in source.read("wordnet/data." + extension).decode().splitlines():
            if not line or not line[0].isdigit():
                continue
            meta, gloss = line.split("|", 1)
            tokens = meta.split()
            pos = "a" if tokens[2] == "s" else tokens[2]
            key = tokens[0] + "-" + pos
            count = int(tokens[3], 16)
            lemmas = [re.sub(r"\((?:a|p|ip)\)$", "", tokens[4 + i * 2]).replace("_", " ") for i in range(count)]
            lemmas = list(dict.fromkeys(w for w in lemmas if re.fullmatch(r"[a-z][a-z -]{1,98}", w)))
            for lemma in lemmas:
                equivalence[lemma].add(key)
                ru_by_word[lemma].update(russian[key])
            eligible = [w for w in lemmas if w in freq and w not in SKIP and " " not in w]
            if not eligible or not russian[key] or REGISTER.search(gloss):
                continue
            word = min(eligible, key=lambda w: (senses.get((key, w.replace(" ", "_")), 999), freq[w]))
            definition = gloss.strip().split('; "')[0].strip().rstrip(";")
            synonyms = [w for w in lemmas if w != word][:20]
            # Reject prompts that become empty or just grammatical boilerplate when masked.
            pattern = r"(?<![a-z])(?:" + "|".join(re.escape(w) for w in [word, *synonyms]) + r")(?![a-z])"
            masked = re.sub(pattern, "_____", definition, flags=re.I)
            if len(re.findall(r"[a-z]{2,}", masked, re.I)) < 3:
                continue
            translation = "; ".join(russian[key][:3])
            if len(translation) > 300:
                continue
            examples = re.findall(r'"([^"\n]+)"', gloss)
            example = next((v for v in examples if re.search(pattern, v, re.I)), "")
            cursor = 4 + 2 * count
            pointer_count = int(tokens[cursor])
            relatives = {tokens[cursor + 2 + i * 4] + "-" + ("a" if tokens[cursor + 3 + i * 4] == "s" else tokens[cursor + 3 + i * 4]) for i in range(pointer_count)}
            category = lexical_names[int(tokens[1])]
            records.append(dict(key=key, word=word, translation=translation, definition=definition,
                                example=example, synonyms=synonyms, pos=POS[pos], rank=freq[word],
                                sense=senses.get((key, word), 999), relatives=relatives, category=category))
    records.sort(key=lambda r: (r["rank"], r["sense"], r["key"]))
    selected, meanings, count_by_word = [], set(), collections.Counter()
    for record in records:
        meaning = (record["word"], record["translation"].lower())
        if meaning in meanings or count_by_word[record["word"]] >= 3:
            continue
        meanings.add(meaning)
        count_by_word[record["word"]] += 1
        selected.append(record)
        if len(selected) == 10000:
            break
    if len(selected) != 10000:
        raise ValueError("Not enough eligible senses: " + str(len(selected)))
    groups, by_pos = collections.defaultdict(list), collections.defaultdict(list)
    for record in selected:
        groups[record["category"]].append(record)
        by_pos[record["pos"]].append(record)
    output = []
    for card in selected:
        rng = random.Random(int(hashlib.sha256(card["key"].encode()).hexdigest()[:16], 16))
        close, broad = list(groups[card["category"]]), list(by_pos[card["pos"]])
        rng.shuffle(close)
        rng.shuffle(broad)
        negatives = []
        for candidate in close + broad:
            word = candidate["word"]
            if word in negatives or candidate["key"] in card["relatives"] or card["key"] in candidate["relatives"]:
                continue
            if equivalence[word] & equivalence[card["word"]] or ru_by_word[word] & ru_by_word[card["word"]]:
                continue
            negatives.append(word)
            if len(negatives) == 6:
                break
        if len(negatives) != 6:
            raise ValueError("Not enough safe distractors: " + card["key"])
        topic = "travel" if card["category"] in TRAVEL else "ideas" if card["category"] in IDEAS else "everyday"
        output.append([card["key"], card["word"], card["translation"], card["definition"], card["example"],
                       card["synonyms"], card["pos"], card["rank"], topic, negatives])
    encoded = (json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    (ROOT / "src/generated/word-bank.json").write_bytes(encoded)
    summary = {"cards": len(output), "uniqueHeadwords": len({r[1] for r in output}),
               "sha256": hashlib.sha256(encoded).hexdigest(), "sources": SOURCES,
               "partsOfSpeech": dict(collections.Counter(r[6] for r in output))}
    (ROOT / "src/generated/word-bank-manifest.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "public/data/word-bank.json").write_bytes(encoded)
    print(json.dumps({k: v for k, v in summary.items() if k != "sources"}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/lexi-word-bank-sources"))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    build(args.cache)
