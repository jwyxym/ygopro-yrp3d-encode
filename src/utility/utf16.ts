export function decodeUtf16leZ(bytes: Uint8Array): string {
  let end = bytes.length;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0 && bytes[i + 1] === 0) {
      end = i;
      break;
    }
  }

  const TD = (globalThis as any).TextDecoder as typeof TextDecoder | undefined;
  if (TD) {
    try {
      return new TD('utf-16le').decode(bytes.subarray(0, end));
    } catch {
      // fall through to manual decode
    }
  }

  const codeUnits: number[] = [];
  for (let i = 0; i + 1 < end; i += 2) {
    codeUnits.push(bytes[i] | (bytes[i + 1] << 8));
  }
  return String.fromCharCode(...codeUnits);
}

export function encodeUtf16leZ(value: string): Uint8Array {
  const raw = encodeUtf16le(value);
  const out = new Uint8Array(raw.length + 2);
  out.set(raw);
  return out;
}

export function encodeUtf16leFixed(
  value: string,
  byteLength: number,
  fill = 0xcc,
): Uint8Array {
  const raw = encodeUtf16le(value);
  const out = new Uint8Array(byteLength);
  out.fill(fill & 0xff);

  const maxTextBytes = Math.max(0, byteLength - 2);
  const copyLength = Math.min(raw.length, maxTextBytes);
  out.set(raw.subarray(0, copyLength));
  if (copyLength < byteLength) {
    out[copyLength] = 0;
  }
  if (copyLength + 1 < byteLength) {
    out[copyLength + 1] = 0;
  }
  return out;
}

function encodeUtf16le(value: string): Uint8Array {
  const out = new Uint8Array(value.length * 2);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return out;
}
