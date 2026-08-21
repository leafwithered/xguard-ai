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
- `analysisReceipt`: schema-versioned normalized evidence with assessment, provenance, and a reproducible SHA-256 fingerprint.

## Analysis Receipt

Every successful V5 analysis returns `analysisReceipt` without removing or renaming existing response fields. Consumers can inspect the existing top-level response as before, or treat the receipt as a portable integration artifact:

```text
transaction intent
→ POST /api/analyze
→ inspect assessment and provenance
→ store or export analysisReceipt
→ independently verify its fingerprint
```

The receipt uses type `xguard.analysis-receipt`, schema `1.0.0`, canonicalization `xguard-c14n-v1`, and fingerprint format `sha256:<64 lowercase hex characters>`. The hash covers the entire receipt including its canonicalization and hash identifiers, excluding only `integrity.fingerprint`.

The downloadable JSON is pretty-printed for humans; verification canonicalizes the parsed object and does not hash the download formatting. See [Analysis Receipt Specification](ANALYSIS_RECEIPT_SPEC.md) and [OpenAPI](openapi.yaml).

Integrity verification confirms that this receipt’s content matches its fingerprint. It does not prove the transaction is safe or that the receipt was signed by XGuard.

## Boundaries

- This is a competition prototype, not a supported SDK or availability-guaranteed service.
- The route has a basic in-memory rate limit and no SLA.
- It never connects a wallet, signs, or broadcasts.
- Mainnet simulation is read-only and requires a public sender address in the request.
- Provider credentials stay on the server. Clients must never send `AI_API_KEY`, OKX credentials, private keys, or seed phrases.
- A successful provider response, empty risk list, or LOW score is not proof of safety.
- Receipt verification is local content integrity only. It does not authenticate XGuard or any evidence provider.
