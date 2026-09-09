/**
 * READ-ONLY wallet connection. This module exists to get ONE thing from
 * a browser wallet: the connected account's public address. It never
 * builds, signs, or submits a transaction or an auth entry.
 *
 * `@creit.tech/stellar-wallets-kit` exposes `signTransaction`,
 * `signAuthEntry`, `signMessage`, `signAndSubmitTransaction` — NONE of
 * them are called here or anywhere in this repo (an ESLint rule forbids
 * the identifiers project-wide). Interactive wallet-linking is
 * deliberately out of scope for this version; see /link.
 *
 * The kit modules poke at `window`, so everything is loaded through a
 * dynamic import from inside the click handler — never at module top,
 * never during SSR, and not in the initial bundle.
 */

import { getChainConfig } from "@/lib/config";
import { isStellarWalletAddress } from "@/lib/hashing/identifiers";

export type ConnectResult =
  | { kind: "connected"; address: string }
  | { kind: "dismissed" }
  | { kind: "error"; message: string };

let initialised = false;

async function loadKit() {
  const [
    { StellarWalletsKit, Networks },
    { FreighterModule },
    { xBullModule },
    { LobstrModule },
    { HanaModule },
  ] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
    import("@creit.tech/stellar-wallets-kit/modules/hana"),
  ]);

  if (!initialised) {
    const cfg = getChainConfig();
    const network = cfg.networkLabel === "futurenet" ? Networks.FUTURENET : Networks.TESTNET;
    StellarWalletsKit.init({
      network,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule(), new HanaModule()],
    });
    initialised = true;
  }
  return StellarWalletsKit;
}

/**
 * Open the wallet picker, then return the chosen account's public
 * address. The only kit calls are `init`, `authModal`, `getAddress`.
 */
export async function connectForAddress(): Promise<ConnectResult> {
  try {
    const kit = await loadKit();
    await kit.authModal({});
    const { address } = await kit.getAddress();

    if (!address) return { kind: "dismissed" };
    if (!isStellarWalletAddress(address)) {
      return { kind: "error", message: `wallet returned an unexpected address: ${address}` };
    }
    return { kind: "connected", address };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The kit throws when the user closes the modal without choosing.
    if (/closed|dismiss|cancel/i.test(message)) return { kind: "dismissed" };
    return { kind: "error", message };
  }
}

/** Best-effort disconnect; safe to call even if never connected. */
export async function disconnectWallet(): Promise<void> {
  try {
    const kit = await loadKit();
    await kit.disconnect();
  } catch {
    /* nothing connected */
  }
}
