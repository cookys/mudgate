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
 */
export class Big5StreamDecoder {
  private pending: number | null = null;
  private readonly encoding: Big5Encoding;

  constructor(encoding: Big5Encoding = "big5hkscs") {
    assertEncoding(encoding);
    this.encoding = encoding;
  }

  push(bytes: Uint8Array): string {
    const parts: number[] = [];
    let i = 0;
    if (this.pending !== null) {
      if (bytes.length === 0) return "";
      parts.push(this.pending, bytes[0]!);
      this.pending = null;
      i = 1;
    }
    while (i < bytes.length) {
      const b = bytes[i]!;
      if (b < 0x80) {
        parts.push(b);
        i += 1;
      } else if (i + 1 < bytes.length) {
        parts.push(b, bytes[i + 1]!);
        i += 2;
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
