// crekk mirror — page hooks (MAIN world): exact per-request shape matching for
// page-originated calls, plus response rewrites so wallets read "mainnet".
(() => {
  const CREKK_RPC = "https://rpc.squarefun.xyz";
  const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

  const SOLANA_METHODS = new Set([
    "getAccountInfo", "getBalance", "getSlot", "getBlockHeight", "getEpochInfo",
    "getGenesisHash", "getHealth", "getVersion", "getLatestBlockhash",
    "getTokenAccountsByOwner", "getTokenAccountBalance", "getProgramAccounts",
    "getSignaturesForAddress", "getSignatureStatuses", "getTransaction",
    "getTransactionCount", "getSupply", "getVoteAccounts", "getLeaderSchedule",
    "getClusterNodes", "sendTransaction", "simulateTransaction",
    "getFeeForMessage", "getMultipleAccounts", "getPriorityFeeEstimate",
  ]);

  const isRpcShaped = (parsed) => {
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return (
      arr.length > 0 &&
      arr.every(
        (r) => r && typeof r === "object" && r.jsonrpc === "2.0" &&
          typeof r.method === "string" && SOLANA_METHODS.has(r.method)
      )
    );
  };

  // Response rewrite: wallets that pin cluster identity via getGenesisHash
  // must see mainnet's hash, or they flag an unknown cluster.
  const rewriteResponse = (method, text) => {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      let touched = false;
      for (const r of arr) {
        if (method === "getGenesisHash" && r && r.result) {
          r.result = MAINNET_GENESIS;
          touched = true;
        }
      }
      return touched ? JSON.stringify(parsed) : text;
    } catch (_) {
      return text;
    }
  };

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = typeof input === "string" ? input : input.url;
    let body = init && init.body;
    let parsed;
    try { parsed = body ? JSON.parse(body) : null; } catch (_) { parsed = null; }

    if (parsed && isRpcShaped(parsed)) {
      const method = Array.isArray(parsed) ? parsed[0].method : parsed.method;
      const methods = Array.isArray(parsed) ? parsed.map((p) => p.method) : [method];
      return origFetch
        .call(this, CREKK_RPC, { ...init, body, method: "POST" })
        .then(async (resp) => {
          const text = await resp.text();
          let out = text;
          for (const m of methods) out = rewriteResponse(m, out);
          return new Response(out, {
            status: resp.status,
            headers: resp.headers,
          });
        });
    }
    return origFetch.call(this, input, init);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__crekk_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : null; } catch (_) {}
    if (parsed && isRpcShaped(parsed)) {
      origOpen.call(this, "POST", CREKK_RPC, true);
      const method = Array.isArray(parsed) ? parsed[0].method : parsed.method;
      this.addEventListener("readystatechange", () => {
        if (this.readyState === 4 && this.responseText && method === "getGenesisHash") {
          try {
            Object.defineProperty(this, "responseText", {
              get: () => rewriteResponse("getGenesisHash", this.responseText),
            });
          } catch (_) {}
        }
      });
    }
    return origSend.call(this, body);
  };

  // Subscriptions: solana-web3.js keeps accounts/slot subscriptions over WS.
  const OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    try {
      const u = new URL(url);
      if (/mainnet|solana|ankr|helius|alchemy|onfinality|publicnode/i.test(u.hostname)) {
        const mirror = new URL(CREKK_RPC);
        url = mirror.origin.replace(/^http/, "ws") + u.pathname + u.search;
      }
    } catch (_) {}
    return protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  Object.defineProperty(window.WebSocket, "name", { value: "WebSocket" });
})();
