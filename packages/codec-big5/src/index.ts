import * as iconv from "iconv-lite";
import { Buffer } from "buffer";

export type Big5Encoding = "big5hkscs" | "big5";

/**
 * iconv-lite lazy-loads encoding tables on first use. Touch the table once so
 * browser bundles fail fast with a clear error if polyfills are missing.
 */
function assertEncoding(encoding: Big5Encoding): void {
  if (!iconv.encodingExists(encoding)) {
    throw new Error(
      `iconv-lite encoding "${encoding}" unavailable — check browser polyfills (stream/string_decoder/buffer)`,
    );
  }
}

/**
 * Streaming Big5-family decoder (HKSCS-capable via iconv-lite 'big5hkscs').
 * Holds a pending lead byte across chunks.
 *
 * Lead is NOT paired with ASCII/control trail (e.g. ESC 0x1b). Pairing lead+ESC
 * eats the escape and leaves bare `[1;34m…` painted as text (color bleed).
 */
export class Big5StreamDecoder {
  private pending: number | null = null;
  private readonly encoding: Big5Encoding;

  constructor(encoding: Big5Encoding = "big5hkscs") {
    assertEncoding(encoding);
    this.encoding = encoding;
  }

  /** Big5 trail is typically 0x40–0x7E / 0xA1–0xFE — never C0 controls. */
  private static isTrail(b: number): boolean {
    return (b >= 0x40 && b <= 0x7e) || (b >= 0xa1 && b <= 0xfe);
  }

  push(bytes: Uint8Array): string {
    const parts: number[] = [];
    let i = 0;
    if (this.pending !== null) {
      if (bytes.length === 0) return "";
      const next = bytes[0]!;
      if (Big5StreamDecoder.isTrail(next)) {
        parts.push(this.pending, next);
        this.pending = null;
        i = 1;
      } else {
        // Invalid pair: drop orphan lead (or emit as Latin-1 fallback byte)
        // Prefer not inventing a CJK glyph — skip lead, reprocess next as single.
        this.pending = null;
        // i stays 0 so next is handled below
      }
    }
    while (i < bytes.length) {
      const b = bytes[i]!;
      if (b < 0x80) {
        parts.push(b);
        i += 1;
      } else if (i + 1 < bytes.length) {
        const t = bytes[i + 1]!;
        if (Big5StreamDecoder.isTrail(t)) {
          parts.push(b, t);
          i += 2;
        } else {
          // lead followed by non-trail (ESC/ASCII): skip lead, keep next
          i += 1;
        }
      } else {
        this.pending = b;
        break;
      }
    }
    if (!parts.length) return "";
    return iconv.decode(Buffer.from(parts), this.encoding);
  }

  reset(): void {
    this.pending = null;
  }
}

export function decodeBig5(
  bytes: Uint8Array,
  encoding: Big5Encoding = "big5hkscs",
): string {
  assertEncoding(encoding);
  return iconv.decode(Buffer.from(bytes), encoding);
}
