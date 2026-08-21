# XGuard Analysis API Integration

XGuard exposes a prototype JSON endpoint for pre-sign analysis:

```text
POST /api/analyze
Content-Type: application/json
```

## V7 Policy Guard

Every successful analysis includes an adjacent `policyDecision` object with policy ID `xguard-pre-sign-policy-v1`, version `1.0.0`, a deterministic decision, stable reason codes, normalized input facts, and `aiInfluencedDecision: false`.

Use [`../sdk/xguard.ts`](../sdk/xguard.ts) for typed API access and strict policy validation. [`../examples/wallet-integration.ts`](../examples/wallet-integration.ts) demonstrates `ALLOW`, `WARN`, `REQUIRE_REVIEW`, and `BLOCK_RECOMMENDED` handling while keeping signature request explicit and user-controlled.

The policy does not change Analysis Receipt schema `1.0.0` or V6 Ed25519 attestation semantics. `ALLOW` means only that the configured deterministic policy does not require additional review from the available normalized evidence; it does not mean safe. See [Policy Engine](POLICY_ENGINE.md).

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
- `analysisAttestation`: optional Ed25519 deployment-key signature over the exact V5 receipt fingerprint and attestation metadata; `null` when signing is unavailable.
- `attestationAvailability`: `AVAILABLE`, `UNAVAILABLE`, or `INVALID_CONFIG`; it never changes analysis semantics.
- `policyDecision`: V7 deterministic wallet/dApp integration recommendation, separate from the receipt and attestation.

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

## Signed Analysis Attestation

When server signing configuration is valid, the same response contains `analysisAttestation` schema `1.0.0`. It binds the V5 receipt type, schema, analysis ID, canonicalization, hash algorithm, exact fingerprint, key ID, signing time, and public-key fingerprint. The signature is unpadded Base64URL Ed25519 over canonical attestation metadata excluding only `signature`.

```text
analysisReceipt
→ verify V5 SHA-256 integrity
→ resolve keyId from GET /api/attestation-key
→ verify SPKI SHA-256 fingerprint
→ verify canonical Ed25519 signed payload
```

The UI preserves standalone **Export Analysis Receipt** and adds a separate **Attested Analysis Package**:

```json
{
  "packageType": "xguard.attested-analysis",
  "packageVersion": "1.0.0",
  "receipt": {},
  "attestation": {}
}
```

Package verification must reject an uploaded public key as a trust root. The trusted key is safe public material returned by this deployment:

```text
GET /api/attestation-key
```

An available response contains `status`, `keyId`, `algorithm`, `publicKeySpkiBase64`, and `publicKeyFingerprint`. An unavailable deployment returns only a safe availability state. No private key, PEM, credential, or parsing diagnostic is returned.

Receipt integrity and attestation authenticity are independent results. Modifying a receipt and recomputing a valid V5 fingerprint can produce `INTEGRITY VERIFIED`, but retaining the original attestation produces `ATTESTATION CHECK FAILED`.

Attestation verification confirms that this receipt fingerprint was signed by the Ed25519 key configured for this XGuard deployment. It does not prove the transaction is safe, that provider data is true, that the transaction reached blockchain finality, or that the receipt has been anchored on-chain. See [Signed Analysis Attestation Specification](ATTESTATION_SPEC.md).

## Boundaries

- This is a competition prototype, not a supported SDK or availability-guaranteed service.
- The route has a basic in-memory rate limit and no SLA.
- It never connects a wallet, signs, or broadcasts.
- Mainnet simulation is read-only and requires a public sender address in the request.
- Provider credentials stay on the server. Clients must never send `AI_API_KEY`, OKX credentials, private keys, or seed phrases.
- The attestation private key remains server-only. Clients receive only derived public SPKI material and its SHA-256 fingerprint.
- A successful provider response, empty risk list, or LOW score is not proof of safety.
- Receipt verification is content integrity only. Attestation verification proves only deployment-key authenticity of the receipt fingerprint and does not authenticate any evidence provider.
