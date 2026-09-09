/**
 * Runtime configuration — the deployed contract this frontend reads.
 *
 * Every value here is PUBLIC (contract id, RPC URL, network passphrase)
 * and is baked in with working testnet defaults so the app runs with no
 * `.env` at all. Override via `NEXT_PUBLIC_*` env vars — the prefix is
 * deliberate: on-chain reads run in the browser (see
 * docs/investigation/02-browser-sdk-proof.md), so the config must reach
 * the client bundle.
 *
 * This repo NEVER holds a secret key of any kind. There is no attestor
 * key, no signer, no keystore path — the app only ever simulates reads
 * and (for "view my passport") asks a wallet extension for its public
 * address. See README "Security".
 *
 * Defaults, from the proofowl-contracts repo (confirmed 2026-09-09):
 *  - contract id  : its README "Deployed contracts" table, v0.3 row (crate 0.3.0)
 *  - rpc / passphrase : its docs/testnet/phase2-v0.3-alpha.md "Network target"
 */

// Type only — erased at build time. Importing a VALUE from
// @proofowl/contract-sdk here would pull the whole SDK barrel
// (@stellar/stellar-sdk included) into every module that reads config.
import type { ProofOwlContractConfig } from "@proofowl/contract-sdk";

/** Stellar mainnet passphrase — inlined so this module has no SDK value import. */
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

/** v0.3 (crate `0.3.0`) testnet instance. "Disposable; may be replaced." */
export const DEFAULT_CONTRACT_ID = "CAIDTSVPQICTA2VLE6BSQYHEELHGPZWQDYWKSDBRW4LYPZH6Q44UTAOA";
export const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
export const DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * The current on-chain attestor for the default instance (rotated
 * 2026-09-07). The frontend does not sign anything, so it never needs
 * this to act — it is surfaced on the "how linking works" page only, as
 * reference. Prefer reading it live with `getAttestor()` where it
 * matters; a rotation would make this stale.
 */
export const REFERENCE_ATTESTOR = "GAVHDK6V2LBGBCBWIZXEHDJAW6ZZKPCKLDANURKJZU4NFDCAV2BYFXEF";

const STRKEY_C_RE = /^C[A-Z2-7]{55}$/;

function readEnv(key: string, fallback: string): string {
  const raw = process.env[key];
  const value = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : fallback;
  return value;
}

export interface AppChainConfig extends ProofOwlContractConfig {
  /** Human label for the target network, derived from the passphrase. */
  networkLabel: "testnet" | "futurenet" | "custom";
}

let cached: AppChainConfig | undefined;

/**
 * Resolve the chain config from env (or defaults). Validates shape and
 * refuses the Stellar mainnet passphrase outright — this is a read-only
 * testnet explorer and pointing it at mainnet is always a mistake.
 */
export function getChainConfig(): AppChainConfig {
  if (cached) return cached;

  const contractId = readEnv("NEXT_PUBLIC_PROOFOWL_CONTRACT_ID", DEFAULT_CONTRACT_ID);
  const rpcUrl = readEnv("NEXT_PUBLIC_PROOFOWL_RPC_URL", DEFAULT_RPC_URL);
  const networkPassphrase = readEnv(
    "NEXT_PUBLIC_PROOFOWL_NETWORK_PASSPHRASE",
    DEFAULT_NETWORK_PASSPHRASE,
  );

  if (!STRKEY_C_RE.test(contractId)) {
    throw new Error(
      `NEXT_PUBLIC_PROOFOWL_CONTRACT_ID must be a 'C...' contract strkey (56 chars); got ${JSON.stringify(
        contractId,
      )}`,
    );
  }
  if (!rpcUrl.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_PROOFOWL_RPC_URL must be an https:// URL");
  }
  if (networkPassphrase === MAINNET_PASSPHRASE) {
    throw new Error(
      "This frontend is a read-only testnet explorer and refuses the Stellar mainnet passphrase.",
    );
  }

  const networkLabel: AppChainConfig["networkLabel"] =
    networkPassphrase === DEFAULT_NETWORK_PASSPHRASE
      ? "testnet"
      : networkPassphrase === "Test SDF Future Network ; October 2022"
        ? "futurenet"
        : "custom";

  cached = { contractId, rpcUrl, networkPassphrase, networkLabel };
  return cached;
}

/** Test-only: drop the memoised config so a new env can take effect. */
export function __resetChainConfigForTests(): void {
  cached = undefined;
}
