import { CATALOG, type Phrase, type Word } from "./data";
import { meaningKey, normalize } from "./learning";
import { findBankMeanings } from "./wordBank";

export function englishQuery(value: string): string {
  return normalize(value).replace(/[\u2010-\u2015\u2212]/g, "-");
}

export function canFindExpressions(value: string): boolean {
  const query = englishQuery(value);
  return query.length <= 100 && /^[a-z]+(?:[ '-][a-z]+)*$/.test(query);
}

export function phraseMatchesQuery(phrase: Phrase, value: string): boolean {
  const query = englishQuery(value);
  if (!query) return true;
  // English words must match whole tokens: "art" is not "heart".
  if (canFindExpressions(query)) {
    const tokens = query.split(/[ -]+/).join("[ -]+");
    const pattern = new RegExp(`(^|[^a-z'])${tokens}($|[^a-z'])`, "i");
    return [phrase.text, ...phrase.keywords].some((text) =>
      pattern.test(englishQuery(text)),
    );
  }
  return [phrase.text, phrase.translation, ...phrase.keywords].some((text) =>
    normalize(text).includes(query),
  );
}

export function expressionMeanings(value: string, personal: Word[]): Word[] {
  const query = englishQuery(value);
  const seen = new Set<string>();
  return [...personal, ...CATALOG, ...findBankMeanings(query)].filter(
    (word) => {
      if (englishQuery(word.word) !== query || !word.translation.trim())
        return false;
      const key = meaningKey(word);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
}
