# XGuard Analysis Receipt Specification

## Status and purpose

This document specifies XGuard Analysis Receipt schema `1.0.0` and canonicalization profile `xguard-c14n-v1`. A receipt is a normalized, machine-readable snapshot returned with a completed pre-sign analysis. Wallets, dApps, and security systems can store it, export it, and independently check whether its content still matches its included SHA-256 fingerprint.

A receipt is evidence infrastructure, not an attestation. It does not prove transaction safety, provider truth, blockchain finality, identity, or XGuard authorship.

## Envelope

```ts
type AnalysisReceipt = {
  receiptType: "xguard.analysis-receipt";
  schemaVersion: "1.0.0";
  analysisId: string; // random UUID; identifier only
  engine: {
    xguardVersion: string;
    ruleVersion: string;
    decoderVersion: string;
  };
  observedAt: string; // UTC ISO 8601
  network: {
    analysisNetwork: "XLAYER_TESTNET" | "XLAYER_MAINNET";
    chainId: 1952 | 196;
  };
  transaction: {
    from: string | null;
    to: string;
    value: string;    // human OKB decimal
    calldata: string; // 0x-prefixed bytes
  };
  assessment: {
    deterministicKnownRisk: RiskComponent;
    aiAdvisory: RiskComponent | null;
    finalRisk: RiskComponent;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    verdict: "ASSESSED" | "UNDETERMINED";
    execution: "SUCCEEDED" | "REVERTED" | "UNAVAILABLE";
    recommendation: string;
  };
  evidence: {
    decodedAction: object;
    consequences: object[];
    intentComparison: object;
    contractIntelligence: object;
    simulationEvidence: object;
    evidenceConsistency: object;
  };
  provenance: { sources: ProvenanceSource[] };
  integrity: {
    canonicalizationVersion: "xguard-c14n-v1";
    hashAlgorithm: "SHA-256";
    fingerprint: `sha256:${string}`;
  };
};
```

`analysisId` is generated with `crypto.randomUUID()` for each completed analysis. It is not derived from a wallet, secret, or receipt content and is not an integrity or authorship guarantee.

The receipt excludes the original free-text request context, provider authentication, raw prompts, environment data, request headers, and operational logs. Its intent comparison contains normalized result evidence without copying the original free-text intent.

## Evidence and assessment semantics

The four evidence classes remain distinct:

| Class | Receipt representation | Trust boundary |
| --- | --- | --- |
| Factual/deterministic | decoded action, consequences, deterministic known risk | Local rules and decoding; heuristic, not exhaustive |
| Provider | X Layer RPC and OKX OnchainOS evidence | A normalized provider observation, not a verdict |
| AI advisory | optional advisory risk | May raise final risk; cannot lower deterministic risk or rewrite facts |
| Receipt integrity | fingerprint | Detects content changes only |

`finalRisk.score = max(deterministicKnownRisk.score, aiAdvisory.score)` when AI is available; otherwise it equals deterministic known risk. Confidence, verdict, and execution semantics remain deterministic. An empty OKX risk array means only that the provider returned no risk entries.

## `xguard-c14n-v1`

The same canonicalizer is used for generation and verification:

- Object keys are sorted lexicographically by JavaScript string code-unit order.
- Array order is preserved.
- Strings, booleans, `null`, and finite numbers use deterministic JSON serialization.
- Undefined object properties are omitted.
- Undefined array entries are rejected.
- Non-finite numbers and non-JSON values are rejected.
- Dangerous imported keys `__proto__`, `constructor`, and `prototype` are rejected at every depth.
- No whitespace or locale-dependent formatting is added.
- Timestamps remain ISO strings.

This is an XGuard-defined profile. It does not claim RFC 8785 compliance.

## Fingerprint generation

The fingerprint covers the entire receipt, including `integrity.canonicalizationVersion` and `integrity.hashAlgorithm`, and excludes only `integrity.fingerprint`:

```text
receipt
→ remove integrity.fingerprint
→ canonicalize with xguard-c14n-v1
→ UTF-8 encode
→ SHA-256
→ lowercase hexadecimal
→ prefix with sha256:
```

Pretty-printing exported JSON does not affect the fingerprint.

## Verification

The local verifier accepts at most 512 KiB, parses JSON in the browser, rejects malformed or dangerous structures, validates critical schema fields, and recomputes the fingerprint without calling XGuard, AI, OKX, RPC, a wallet, or a blockchain.

Results are limited to:

- `INTEGRITY VERIFIED`
- `INTEGRITY CHECK FAILED`
- `UNSUPPORTED RECEIPT VERSION`
- `INVALID RECEIPT FORMAT`

Integrity verification confirms that this receipt’s content matches its fingerprint. It does not prove the transaction is safe or that the receipt was signed by XGuard.

Anyone can modify a receipt and compute a new internally consistent fingerprint. Schema `1.0.0` has no signature or authorship mechanism.

## Versioning

- `schemaVersion` changes when required fields or their meaning become incompatible.
- `canonicalizationVersion` changes when canonical serialization changes.
- Verifiers must reject unsupported versions rather than guessing.
- Additive API response fields outside the receipt do not change this schema.

## Minimal consumer flow

```ts
const response = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(transactionIntent)
});
const { analysisReceipt } = await response.json();

// Inspect assessment and provenance, then store/export the receipt.
// Use xguard-c14n-v1 and SHA-256 to verify its fingerprint independently.
```
