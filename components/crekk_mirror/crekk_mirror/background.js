// crekk mirror — service worker: shape-match Solana RPC calls, learn hosts, redirect via DNR.
// Wallet backgrounds (Phantom et al.) make their RPC calls from extension contexts
// that page hooks cannot see; the webRequest -> DNR loop is what catches those.

const CREKK_RPC = "https://rpc.squarefun.xyz";
const CREKK_RPC_ORIGIN = new URL(CREKK_RPC).origin;

// Well-known mainnet RPC endpoints: seeded day one, no learning lag.
const KNOWN_HOSTS = [
  "api.mainnet-beta.solana.com",
  "api.solana-blc.com",
  "api.ankr.com",
  "solana-rpc.publicnode.com",
  "solana.public-rpc.com",
  "rpc.ankr.com",
  "solana.api.onfinality.io",
  "api.blockspace.network",
  "solana.getblock.io",
  "endpoints.omniatech.io",
  "api.shyft.to",
  "mainnet.helius-rpc.com",
  "solana-mainnet.g.alchemy.com",
  "api.devnet.solana.com",
];

// A body is "Solana RPC shaped" if it parses as JSON-RPC 2.0 with a Solana method.
const SOLANA_METHODS = new Set([
  "getAccountInfo", "getMultipleAccounts", "getProgramAccounts", "getBalance",
  "getSlot", "getSlotsPerEpoch", "getBlockHeight", "getBlockTime", "getEpochInfo",
  "getGenesisHash", "getHealth", "getVersion", "getRecentPerformanceSamples",
  "getLatestBlockhash", "isBlockhashValid", "getFeeForMessage", "getStakeMinimumDelegation",
  "getInflationGovernor", "getInflationRate", "getInflationReward", "getStakeActivation",
  "getTokenAccountBalance", "getTokenAccountsByOwner", "getTokenLargestAccounts",
  "getTokenSupply", "getLargestAccounts", "getSupply", "getMinimumBalanceForRentExemption",
  "getTransaction", "getSignaturesForAddress", "getSignatureStatuses",
  "getTransactionCount", "getVoteAccounts", "getLeaderSchedule", "getClusterNodes",
  "getAccountInfoAndContext", "getSnapshotSlot", "sendTransaction", "simulateTransaction",
  "getAccountInfoWithCtx", "getStakeActivation", "getStakeDelegations",
  "getMaxRetransmitSlot", "getMaxShredInsertSlot", "getRecentPrioritizationFees",
  "getPriorityFeeEstimate", "getStakeMinimumDelegation", "getNonceFromNonceAccount",
]);

function isRpcShaped(bodyText) {
  if (!bodyText) return false;
  let parsed;
  try { parsed = JSON.parse(bodyText); } catch (_) { return false; }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  if (arr.length === 0) return false;
  return arr.every(
    (r) =>
      r &&
      typeof r === "object" &&
      r.jsonrpc === "2.0" &&
      typeof r.method === "string" &&
      (SOLANA_METHODS.has(r.method) ||
        r.method.startsWith("get") ||
        r.method === "sendTransaction" ||
        r.method === "simulateTransaction" ||
        r.method === "requestAirdrop")
  );
}

async function redirectHost(host) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.some((r) => r.condition.requestDomains && r.condition.requestDomains.includes(host))) {
    return; // already learned
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: 100000 + (existing.length % 90000),
        priority: 1,
        action: {
          type: "redirect",
          redirect: { transform: { scheme: "https", host: new URL(CREKK_RPC).hostname } },
        },
        condition: {
          requestDomains: [host],
          resourceTypes: ["xmlhttprequest", "websocket", "other"],
        },
      },
    ],
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  for (const host of KNOWN_HOSTS) {
    await redirectHost(host);
  }
});

// Observe bodies anywhere in the browser (including other extensions' service
// workers). Learn any host that speaks Solana RPC, then DNR it for good.
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || !details.requestBody) return;
    const raw = details.requestBody.raw || [];
    const bodyText = raw
      .map((b) => new TextDecoder().decode(b.bytes))
      .join("");
    if (!isRpcShaped(bodyText)) return;
    redirectHost(new URL(details.url).hostname).catch(console.error);
  },
  { urls: ["http://*/*", "https://*/*"] },
  ["requestBody"]
);

// mirror build probe
