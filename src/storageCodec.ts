import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
const PREFIX = "lexi-z1:";
const LIMIT = 32 * 1024 * 1024;
// Fifteen bits per character avoid lone surrogates and preserve DOMString portability.
function pack(bytes: Uint8Array) {
  const pieces: string[] = [];
  let values: number[] = [];
  let bits = 0,
    buffer = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    if (bits >= 15) {
      bits -= 15;
      values.push(((buffer >>> bits) & 32767) + 32);
      buffer &= (1 << bits) - 1;
    }
    if (values.length >= 8192) {
      pieces.push(String.fromCharCode(...values));
      values = [];
    }
  }
  if (bits) values.push((buffer << (15 - bits)) + 32);
  pieces.push(String.fromCharCode(...values));
  return pieces.join("");
}
function unpack(value: string, length: number) {
  if (value.length !== Math.ceil((length * 8) / 15))
    throw new Error("Неполное сохранение.");
  const bytes = new Uint8Array(length);
  let offset = 0,
    bits = 0,
    buffer = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i) - 32;
    if (code < 0 || code > 32767) throw new Error("Повреждённое сохранение.");
    buffer = (buffer << 15) | code;
    bits += 15;
    while (bits >= 8 && offset < length) {
      bits -= 8;
      bytes[offset++] = (buffer >>> bits) & 255;
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}
export function encodeStoredJson(json: string) {
  if (json.length < 1000000) return json;
  const original = strToU8(json);
  if (original.length > LIMIT)
    throw new Error("Слишком большой словарь. Экспортируйте данные.");
  const compressed = gzipSync(original, { level: 6, mtime: 0 });
  const encoded = `${PREFIX}${compressed.length}:${original.length}:${pack(compressed)}`;
  return encoded.length < json.length ? encoded : json;
}
export function decodeStoredJson(raw: string) {
  if (!raw.startsWith(PREFIX)) return raw;
  const header = /^lexi-z1:(\d{1,9}):(\d{1,9}):/.exec(raw);
  if (!header) throw new Error("Повреждённый заголовок сохранения.");
  const length = Number(header[1]),
    originalLength = Number(header[2]);
  if (
    length < 18 ||
    length > LIMIT ||
    originalLength < 1 ||
    originalLength > LIMIT
  )
    throw new Error("Недопустимый размер сохранения.");
  const bytes = unpack(raw.slice(header[0].length), length);
  if (new DataView(bytes.buffer).getUint32(length - 4, true) !== originalLength)
    throw new Error("Размер сохранения не совпадает.");
  return strFromU8(gunzipSync(bytes, { out: new Uint8Array(originalLength) }));
}
