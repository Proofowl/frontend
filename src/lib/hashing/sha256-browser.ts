/**
 * Browser stand-in for the sliver of `node:crypto` this app touches:
 * `createHash("sha256").update(bytes|string).digest(...)`.
 *
 * WHY THIS EXISTS
 * `@proofowl/contract-sdk`'s barrel pulls in its `identifiers.ts`, which
 * does `import { createHash } from "node:crypto"`. This app's own
 * canonical-hashing module (../hashing/identifiers.ts, ported verbatim
 * from proofowl-backend) does the same. Both run client-side. Webpack
 * cannot bundle `node:crypto` for the browser, so `next.config.ts`
 * aliases `node:crypto` (client build only) to this file. The
 * investigation proved the Vite equivalent of exactly this alias; see
 * docs/investigation/02-browser-sdk-proof.md.
 *
 * Backed by `@noble/hashes` (already in the dependency tree via
 * @stellar/stellar-sdk). No new runtime weight of note.
 *
 * Only `sha256` is implemented — the only algorithm either consumer
 * asks for. Anything else throws loudly rather than silently returning a
 * wrong digest.
 */

import { sha256 } from "@noble/hashes/sha2";

type Encoding = "hex" | undefined;

function toBytes(data: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

class Sha256Hash {
  #chunks: Uint8Array[] = [];

  update(data: Uint8Array | ArrayBuffer | string): this {
    this.#chunks.push(toBytes(data));
    return this;
  }

  digest(encoding?: Encoding): string | Uint8Array {
    const total = this.#chunks.reduce((n, c) => n + c.length, 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const c of this.#chunks) {
      joined.set(c, offset);
      offset += c.length;
    }
    const out = sha256(joined);
    return encoding === "hex" ? toHex(out) : out;
  }
}

export function createHash(algorithm: string): Sha256Hash {
  if (algorithm !== "sha256") {
    throw new Error(`sha256-browser shim: only "sha256" is supported, got "${algorithm}"`);
  }
  return new Sha256Hash();
}

export default { createHash };
