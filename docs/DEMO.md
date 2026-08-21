# XGuard AI — V6 Judge Demo

**V6 Preview:** assigned after Preview deployment

**Stable Production:** https://xguard-ai-six.vercel.app

The V6 path requires no wallet connection and creates no transaction. Judge Mode only loads inputs or navigates to evidence; every analysis, export, file selection, and verification is explicit. The XGuard deployment-key signature is not a user wallet signature.

## Script

### 0:00–0:10 — Product promise

Open the V6 Preview and say:

> Know what a transaction does before you sign. XGuard combines deterministic decoding, X Layer RPC, Intent vs Reality, optional OKX simulation, and evidence-grounded AI without treating any provider as a safety oracle.

Open **⚡ Try Judge Demo**.

### 0:10–0:22 — Safe Transfer

Load **Safe Transfer**, click **Analyze risk**, and show:

- Final `8 LOW`
- Deterministic Known Risk `8 LOW`
- Hybrid Analysis
- consequence and RPC evidence

Say: “Even the low baseline is inspectable; low is not a guarantee.”

### 0:22–0:38 — Ambiguous Approval

Load **Ambiguous Approval**, click **Analyze risk**, and show:

- `approve(address,uint256)`
- standard `UNDETERMINED`
- deterministic `20 LOW`
- `LOW` confidence and `UNDETERMINED` verdict
- separate AI Advisory and Final Risk fields

Say: “Readable calldata is not always sufficient evidence. XGuard refuses to call this an unlimited ERC20 approval without token-standard proof.”

### 0:38–0:53 — Suspicious Airdrop

Load **Suspicious Airdrop**, click **Analyze risk**, and show:

- `setApprovalForAll(true)`
- claim intent versus contract-wide permission
- deterministic `78 HIGH` floor
- `MISMATCH`

Say: “The intent says claim; the transaction grants broad operator permission. AI cannot lower that deterministic floor.”

### 0:53–1:12 — Live OKX Mainnet Simulation

In Judge Mode, load **Live OKX Mainnet Simulation**, then explicitly click **Analyze risk**. Show:

- X Layer Mainnet · Chain `196`
- provider `OKX OnchainOS`
- chainIndex `196`
- Live Provider Evidence badge only after `AVAILABLE / HTTP 200 / code 0`
- intention `Token Approval`
- observed timestamp, provider latency, gas, and no failure reason

Say: “This is a real, read-only simulation of a public historical fixture. Provider evidence is additional consequence evidence—not a safety verdict.”

### 1:12–1:24 — Analysis Receipt

Show Analysis ID, schema `1.0.0`, four provenance sources, and the `sha256:` fingerprint. Select **Export JSON**, then **Verify Current**.

Say: “The API now returns a portable, versioned evidence receipt. The same canonicalizer generates and verifies its fingerprint.”

### 1:24–1:38 — Integrity boundary

Import the original exported JSON and show `INTEGRITY VERIFIED`. In a local copy, change one assessment value without updating the fingerprint, then import it and show `INTEGRITY CHECK FAILED`.

Say: “Integrity detects content changes. It does not prove safety or XGuard authorship.”

### 1:38–1:55 — Signed Analysis Attestation

Show algorithm `Ed25519`, key ID, public-key fingerprint, signed receipt fingerprint, and signing time. Select **Export Attested Package**, then **Verify Current Package**. Show both:

- `RECEIPT INTEGRITY — INTEGRITY VERIFIED`
- `XGUARD ATTESTATION — ATTESTATION VERIFIED`

Say: “V5 proves that content matches its fingerprint. V6 proves that this exact fingerprint was signed by the trusted key configured for this XGuard deployment.”

For the decisive security demonstration, modify a security-relevant receipt field in a package, recompute a valid V5 fingerprint, retain the original attestation, and verify again. Show:

- `INTEGRITY VERIFIED`
- `ATTESTATION CHECK FAILED`

Say: “Recomputing an internally valid fingerprint is not enough to forge XGuard deployment-key authenticity. This still does not prove transaction safety, provider truth, finality, or on-chain anchoring.”

### 1:55–2:05 — Existing X Layer receipt

Select **View Receipt** and show the existing confirmed Testnet transaction.

Say: “Recording is optional and user-controlled. This receipt already proves the integration; no judge wallet action is required.”

## Reproducible inputs

### Ambiguous Approval

```text
0x095ea7b30000000000000000000000001234567890123456789012345678901234567890ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

Expected: `approve(address,uint256)`, standard `UNDETERMINED`, deterministic `20 LOW`, LOW confidence, `UNDETERMINED`, with no definitive ERC20 Unlimited claim.

### Suspicious Airdrop

```text
0xa22cb46500000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000001
```

Target: `0x08a25a794639a6cA03b0A7C655B2c36d82fF144a` · Value: `0 OKB` · Context: `I only want to claim an airdrop.`

### Public Mainnet simulation fixture

Source transaction: https://www.okx.com/web3/explorer/xlayer/tx/0xe7314b7a3b53ee7520198a3fa65126b8a840a822c71b40c60eae0f1e54ed5448

The preset copies only public `from`, `to`, value, and calldata from this confirmed transaction. It does not claim ownership of the address, connect a wallet, sign, replay, or broadcast it.

## Existing verified receipt

- Network: X Layer Testnet (`1952`)
- Contract: https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5
- User transaction: https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb
- Receipt: success; `RiskAssessmentRecorded` score `12`

## QA checklist

- Safe: `8 LOW`
- Ambiguous: deterministic `20 LOW`, LOW confidence, `UNDETERMINED`
- Suspicious: deterministic `78 HIGH`, `MISMATCH`
- AI-raised final score is never labeled deterministic known risk
- Live badge never appears for Testnet, mock, unavailable, error, non-200, or non-zero business-code evidence
- EIP-1967 wording is scoped; it does not exclude every proxy type
- Editing any input or network invalidates the previous analysis
- Exported JSON contains schema, provenance, and fingerprint but no original free-text context or provider authentication metadata
- Original receipt verifies; an undigested change fails
- Original attested package shows integrity and attestation verified
- Tampered receipt with a recomputed V5 fingerprint keeps integrity valid but fails attestation
- Uploaded package keys are never trusted; verification resolves the deployment key endpoint
- Missing attestation configuration does not change risk, confidence, verdict, execution, or receipt output
- Verification never says that a transaction is safe, provider evidence is true, or the receipt is anchored on-chain
- No connection, signature, broadcast, deployment, or new chain transaction

The existing public MP4 remains the historical stable Production capture. It is not evidence of the V6 Preview attestation path.
