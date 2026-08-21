# XGuard Analysis API Integration

XGuard exposes a prototype JSON endpoint for pre-sign analysis:

```text
POST /api/analyze
Content-Type: application/json
```

## Request

```ts
type AnalyzeRequest = {
  analysisNetwork?: "XLAYER_TESTNET" | "XLAYER_MAINNET";
  from: string;    // optional empty string on Testnet; required for Mainnet simulation
  to: string;      // 20-byte EVM address
  value: string;   // human OKB decimal, not wei
  data: string;    // even-length 0x-prefixed calldata
  context: string; // optional user-stated intent; treated as untrusted data
};
```

Safe Testnet example:

```bash
curl -X POST https://xguard-ai-six.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  --data '{"analysisNetwork":"XLAYER_TESTNET","from":"","to":"0x1111111111111111111111111111111111111111","value":"0.1","data":"0x","context":"Send 0.1 OKB to a known address"}'
```

## Response concepts

- `finalScore` / `level`: final fused risk severity.
- `deterministicScore`: rule- and decoder-backed known-risk floor.
- `aiScore`: optional advisory score; it may raise but never lower final risk.
- `analysisConfidence`, `analysisVerdict`, `executionStatus`: evidence sufficiency, assessment state, and bounded RPC preflight outcome.
- `decodedAction`, `consequences`, `intentComparison`: human-readable behavior and intent comparison.
- `contractIntelligence`: chain-specific bytecode, scoped EIP-1967, call, and gas evidence.
- `simulationEvidence`: normalized OKX evidence. Testnet returns `UNSUPPORTED`; Mainnet may return `AVAILABLE`, `UNAVAILABLE`, or `ERROR`.
- `evidenceConsistency`: whether bounded RPC and simulation execution evidence agree.
- `mode`: `HYBRID`, `AI`, or `LOCAL`.

## Boundaries

- This is a competition prototype, not a supported SDK or availability-guaranteed service.
- The route has a basic in-memory rate limit and no SLA.
- It never connects a wallet, signs, or broadcasts.
- Mainnet simulation is read-only and requires a public sender address in the request.
- Provider credentials stay on the server. Clients must never send `AI_API_KEY`, OKX credentials, private keys, or seed phrases.
- A successful provider response, empty risk list, or LOW score is not proof of safety.
