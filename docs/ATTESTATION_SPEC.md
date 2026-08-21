# XGuard Signed Analysis Attestation Specification

## Purpose and trust model

XGuard V6 adds deployment-key authenticity to the unchanged V5 Analysis Receipt. Receipt integrity answers whether receipt content still matches its SHA-256 fingerprint. Attestation verification answers whether that exact fingerprint was signed by the Ed25519 key configured for the XGuard deployment whose public-key endpoint is being trusted.

The trust root is the public key returned by that deployment's `GET /api/attestation-key` endpoint. An uploaded package cannot supply or replace the trust root.

Attestation verification does not prove that a transaction is safe, that provider data is true, that a transaction reached blockchain finality, that a receipt was anchored on-chain, or that a legal entity owns the deployment.

## Cryptographic profile

- Algorithm: Ed25519
- Private key: PKCS#8 Ed25519 PEM, Base64-encoded as complete PEM file bytes
- Public key: derived from the private key and exported as SPKI DER
- Public-key fingerprint: `sha256:<lowercase SHA-256 hex of SPKI DER bytes>`
- Signature encoding: unpadded Base64URL
- Attestation version: `1.0.0`
- Canonicalization: the existing `xguard-c14n-v1` JSON rules, without changing V5 receipt fingerprint behavior

## Attestation envelope

```ts
type AnalysisAttestation = {
  attestationType: "xguard.analysis-attestation";
  attestationVersion: "1.0.0";
  algorithm: "Ed25519";
  keyId: string;
  signedAt: string;
  receiptBinding: {
    receiptType: "xguard.analysis-receipt";
    schemaVersion: "1.0.0";
    analysisId: string;
    canonicalizationVersion: "xguard-c14n-v1";
    hashAlgorithm: "SHA-256";
    fingerprint: `sha256:${string}`;
  };
  publicKeyFingerprint: `sha256:${string}`;
  signature: string;
};
```

The signature authenticates every field above except `signature`. The canonical signed payload is UTF-8 encoding of the `xguard-c14n-v1` serialization of:

```text
attestationType
attestationVersion
algorithm
keyId
signedAt
receiptBinding
publicKeyFingerprint
```

Changing any bound receipt identifier, security metadata, timestamp, key identifier, or public-key fingerprint invalidates the signature.

## V5 compatibility

V6 does not add fields to `AnalysisReceipt`, change schema `1.0.0`, change `xguard-c14n-v1`, or include the attestation in the V5 fingerprint payload. Standalone receipt export remains a pure V5 receipt. Known V5 fixtures are regression-tested byte-for-byte under V6.

## Attested Analysis Package

```ts
type AttestedAnalysisPackage = {
  packageType: "xguard.attested-analysis";
  packageVersion: "1.0.0";
  receipt: AnalysisReceipt;
  attestation: AnalysisAttestation;
};
```

The package contains no private key, credential, authorization header, raw prompt, environment metadata, or server log. It is separate from the standalone V5 receipt artifact.

## Verification procedure

1. Reject oversized files and malformed, dangerous, or unexpected structures.
2. Validate and recompute the V5 receipt fingerprint.
3. Validate the complete attestation structure and supported version/algorithm.
4. Compare every `receiptBinding` field with the included receipt.
5. Resolve `keyId` against the trusted deployment's safe public-key endpoint.
6. Derive the SHA-256 fingerprint of the returned SPKI bytes and compare it with both the endpoint and attestation fingerprints.
7. Reconstruct the canonical signed payload.
8. Verify the Ed25519 signature.

Receipt integrity and XGuard attestation are always reported separately. A modified receipt with a recomputed, internally valid V5 fingerprint can show `INTEGRITY VERIFIED` while the retained original signature shows `ATTESTATION CHECK FAILED`.

## Public key endpoint

`GET /api/attestation-key` returns only safe public material when configured:

```json
{
  "status": "AVAILABLE",
  "keyId": "example-key-id",
  "algorithm": "Ed25519",
  "publicKeySpkiBase64": "<public SPKI DER only>",
  "publicKeyFingerprint": "sha256:<64 lowercase hex>"
}
```

Absent or invalid configuration returns only `UNAVAILABLE` or `INVALID_CONFIG`. Private PEM, private DER, Base64 private-key data, parsing details, and environment values are never returned.

## Server configuration and failure isolation

The two server-only variables are:

- `XGUARD_ATTESTATION_PRIVATE_KEY_PEM_B64`
- `XGUARD_ATTESTATION_KEY_ID`

The private-key value is Base64 of the complete PKCS#8 Ed25519 PEM file bytes. `keyId` accepts 1–64 lowercase letters, digits, periods, underscores, and hyphens.

The public key is derived; no second public-key secret is configured. If configuration is missing or malformed, or signing fails, transaction analysis and the V5 receipt are still returned unchanged while `analysisAttestation` is `null`. Attestation availability never changes risk, confidence, verdict, execution, AI, RPC, or OKX semantics.

## Security limitations

- Deployment-key authenticity is scoped to possession of the configured private key; key custody and rotation remain deployment responsibilities.
- Verification trusts the deployment endpoint selected by the user or application.
- This prototype does not provide on-chain anchoring, a transparency log, revocation history, legal identity, hardware-backed keys, a Merkle tree, or blockchain finality.
- The verifier does not call AI, OKX, RPC, a wallet, or a blockchain.
- The server-side deployment signature is not a user wallet signature and never authorizes or broadcasts a transaction.
