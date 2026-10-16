"""Extract all eligible multiword senses from the same pinned WordNet/OMW data."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import random
import re
import zipfile
from build_word_bank import ROOT, SOURCES, obtain, POS, REGISTER, TRAVEL, IDEAS


def build(cache):
    paths = {n: obtain(cache, n) for n in SOURCES}
    freq = {line.rsplit(' ', 1)[0]: i + 1 for i, line in enumerate(paths['frequency.txt'].read_text().splitlines())}
    russian = collections.defaultdict(list)
    for line in paths['russian.tab'].read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, kind, lemma = line.split('\t')
        if kind == 'rus:lemma' and re.fullmatch(r'[а-яёА-ЯЁ][а-яёА-ЯЁ -]{0,99}', lemma) and lemma not in russian[key]:
            russian[key].append(lemma)
    z = zipfile.ZipFile(paths['wordnet.zip'])
    categories = {int(v.split()[0]): v.split()[1] for v in z.read('wordnet/lexnames').decode().splitlines()}
    aliases, ru_by_word = collections.defaultdict(set), collections.defaultdict(set)
    records = []
    for suffix in ['noun', 'verb', 'adj', 'adv']:
        for line in z.read('wordnet/data.' + suffix).decode().splitlines():
            if not line or not line[0].isdigit():
                continue
            meta, gloss = line.split('|', 1)
            t = meta.split()
            pos = 'a' if t[2] == 's' else t[2]
            key = t[0] + '-' + pos
            count = int(t[3], 16)
            terms = [re.sub(r'\((?:a|p|ip)\)$', '', t[4+i*2]).replace('_', ' ') for i in range(count)]
            terms = [v for v in terms if re.fullmatch(r'[a-z]+(?:[ -][a-z]+){0,5}', v)]
            for term in terms:
                aliases[term].add(key)
                ru_by_word[term].update(russian[key])
            phrases = [v for v in terms if ' ' in v and len(v) <= 100 and all(p in freq for p in re.split('[ -]', v))]
            if not phrases or not russian[key] or REGISTER.search(gloss):
                continue
            definition = gloss.strip().split('; "')[0].strip().rstrip(';')
            translation = '; '.join(russian[key][:3])
            if len(translation) > 300:
                continue
            cursor = 4 + count*2
            relatives = {t[cursor+2+i*4] + '-' + ('a' if t[cursor+3+i*4] == 's' else t[cursor+3+i*4]) for i in range(int(t[cursor]))}
            for phrase in phrases:
                synonyms = [v for v in phrases if v != phrase][:20]
                pattern = r'(?<![a-z])(?:' + '|'.join(re.escape(v) for v in [phrase, *synonyms]) + r')(?![a-z])'
                masked = re.sub(pattern, '_____', definition, flags=re.I)
                if len(re.findall('[a-z]{2,}', masked, re.I)) < 3:
                    continue
                example = next((v for v in re.findall(r'"([^"\n]+)"', gloss) if re.search(pattern, v, re.I)), '')
                rank = max(freq[p] for p in re.split('[ -]', phrase))
                records.append(dict(key=key, word=phrase, translation=translation, definition=definition, example=example,
                                    synonyms=synonyms, pos=POS[pos], rank=rank, category=categories[int(t[1])], relatives=relatives))
    records.sort(key=lambda v: (v['pos'] != 'verb', v['rank'], v['word'], v['key']))
    selected, seen = [], set()
    for card in records:
        k = (card['word'], card['translation'])
        if k not in seen:
            seen.add(k)
            selected.append(card)
    grouped = collections.defaultdict(list)
    for card in selected:
        grouped[card['pos']].append(card)
    result = []
    for card in selected:
        pool = grouped[card['pos']][:]
        rng = random.Random(int(hashlib.sha256((card['key']+card['word']).encode()).hexdigest()[:16], 16))
        rng.shuffle(pool)
        pool.sort(key=lambda v: v['category'] != card['category'])
        wrong = []
        for candidate in pool:
            word = candidate['word']
            if word in wrong or candidate['key'] in card['relatives'] or card['key'] in candidate['relatives']:
                continue
            if aliases[word] & aliases[card['word']] or ru_by_word[word] & ru_by_word[card['word']]:
                continue
            wrong.append(word)
            if len(wrong) == 6:
                break
        if len(wrong) != 6:
            raise ValueError('Insufficient distinct choices: '+card['word'])
        topic = 'travel' if card['category'] in TRAVEL else 'ideas' if card['category'] in IDEAS else 'everyday'
        result.append([card['key'], card['word'], card['translation'], card['definition'], card['example'], card['synonyms'],
                       'phrase', card['rank'], topic, wrong, card['pos']])
    encoded = (json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
    (ROOT/'src/generated/phrase-bank.json').write_bytes(encoded)
    (ROOT/'public/data/phrase-bank.json').write_bytes(encoded)
    manifest = dict(phrases=len(result), uniquePhrases=len({r[1] for r in result}),
                    withEnglishExamples=sum(bool(r[4]) for r in result), sha256=hashlib.sha256(encoded).hexdigest(),
                    partsOfSpeech=dict(collections.Counter(r[10] for r in result)))
    (ROOT/'src/generated/phrase-bank-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/lexi-word-bank-sources'))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    build(args.cache)
