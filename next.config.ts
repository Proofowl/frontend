import path from "node:path";
import type { NextConfig } from "next";

/**
 * Browser bundler shim — see docs/investigation/02-browser-sdk-proof.md.
 *
 * `@proofowl/contract-sdk`'s barrel re-exports `identifiers.ts`, which
 * does `import { createHash } from "node:crypto"`. This app's own
 * canonical-hashing module (src/lib/hashing/identifiers.ts, ported from
 * proofowl-backend) does the same. Both run client-side here, so the
 * `node:crypto` import must resolve to something webpack can bundle for
 * the browser.
 *
 * The investigation used a Vite `resolve.alias`. The webpack equivalent
 * is `config.resolve.alias`, applied ONLY to the client (`!isServer`)
 * build so server components / route handlers keep the real Node
 * `node:crypto`. A scheme-prefixed specifier (`node:crypto`) also needs
 * a NormalModuleReplacementPlugin — plain `resolve.alias` does not
 * always intercept the `node:` scheme in webpack 5.
 *
 * The alias target (src/lib/hashing/sha256-browser.ts) is a ~40-line
 * shim exposing just `createHash("sha256")`, backed by `@noble/hashes`
 * (already in the tree via @stellar/stellar-sdk).
 *
 * One difference from the investigation's Vite result: a `Buffer`
 * global IS needed here. The Vite probe only ever loaded Buffer.* via
 * the SDK barrel, whose generated bindings self-install `window.Buffer`.
 * This app also imports the ported hashing module (which uses
 * `Buffer.from`) on its own, before any SDK code runs — e.g. on the
 * passport search page — so webpack's ProvidePlugin supplies `Buffer`
 * from the userland `buffer` package for the client build.
 */
const sha256Shim = path.resolve(import.meta.dirname, "src/lib/hashing/sha256-browser.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "node:crypto": sha256Shim,
        crypto: sha256Shim,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:crypto$/,
          (resource: { request: string }) => {
            resource.request = sha256Shim;
          },
        ),
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
