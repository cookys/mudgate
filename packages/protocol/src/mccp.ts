/**
 * Optional MCCP2 inflate (Phase 3). Off by default — Phase 1a DONT MCCP2.
 */
import { inflateRawSync, inflateSync } from "node:zlib";

export function tryInflateMccp(chunk: Uint8Array): Uint8Array {
  try {
    return new Uint8Array(inflateSync(Buffer.from(chunk)));
  } catch {
    try {
      return new Uint8Array(inflateRawSync(Buffer.from(chunk)));
    } catch {
      return chunk;
    }
  }
}
