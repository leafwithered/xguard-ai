# Build X Series — Final Submission

- **Project Name:** `XGuard AI`
- **Short Description:** `Verifiable pre-sign security and policy infrastructure for X Layer.`
- **Production:** https://xguard-ai-six.vercel.app
- **GitHub:** https://github.com/leafwithered/xguard-ai
- **Final Demo:** https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-final.mp4
- **Project X Account:** https://x.com/AevrynHQ
- **Build X Post:** https://x.com/AevrynHQ/status/2090382549205873099
- **Application Logic Baseline:** `dfa1d3396e08454f941ada09f219e6b4853fa8c4`
- **Contact Email:** Provided in the official submission
- **Telegram:** `@hierarchleaf`

## Project summary

XGuard helps users and wallet/dApp integrations understand what an EVM transaction will do before signing. It keeps deterministic facts, bounded provider evidence, AI advisory, receipt integrity, deployment-key authenticity, policy action, and on-chain anchoring as separate claims.

`Transaction → Evidence → Receipt Integrity → Deployment-key Authenticity → Policy Action → Mainnet Receipt Anchor`

Final public capabilities:

- Deterministic transaction decoding and explainable known-risk rules
- X Layer RPC intelligence and bounded `eth_call` / `eth_estimateGas` preflight evidence
- OKX OnchainOS read-only transaction simulation on X Layer Mainnet
- Intent vs Reality comparison
- Evidence-grounded AI Advisory that cannot lower deterministic known risk or control policy
- Versioned Analysis Receipt with schema `1.0.0`
- `xguard-c14n-v1` canonicalization and SHA-256 receipt integrity
- Ed25519 deployment-key attestation of the exact receipt fingerprint
- Deterministic Policy Guard actions: `ALLOW`, `WARN`, `REQUIRE_REVIEW`, and `BLOCK_RECOMMENDED`
- X Layer Mainnet Receipt Anchor for an exact `bytes32` receipt digest
- Read-only Published Mainnet Proof verification

## Public chain evidence

The two public evidence paths use the same hexadecimal address on different chains. They are different contracts with different purposes and must always be identified by network and chain ID.

### A. Historical Testnet Evidence

- **Network:** X Layer Testnet
- **Chain ID:** `1952`
- **Contract:** `RiskRegistry`
- **Address:** [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- **Historical Deployment Tx:** [`0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b)
- **Historical Interaction Tx:** [`0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb)
- **Interaction Result:** Receipt success; `RiskAssessmentRecorded` emitted with risk score `12`

This historical path records that a user explicitly reviewed an assessment. It does not execute the analyzed transaction and is not the Mainnet Receipt Anchor.

### B. Current Mainnet Receipt Anchor

- **Network:** X Layer Mainnet
- **Chain ID:** `196`
- **Contract:** `XGuardReceiptAnchor`
- **Address:** [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- **Deployment Tx:** [`0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb`](https://www.okx.com/web3/explorer/xlayer/tx/0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb)
- **First Receipt Anchor Tx:** [`0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347`](https://www.okx.com/web3/explorer/xlayer/tx/0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347)
- **Published Receipt Digest:** `0xef6cf319eb689233180f465d331969c91a9c5c07d893047294bdda5de0da0eab`
- **Read-only Verification:** `anchored(bytes32) = true`

The Mainnet anchor proves only that this exact digest was recorded by the configured contract in a confirmed Chain `196` transaction. It does not prove transaction safety, provider truth, authorship, ownership, execution, or legal identity.

## Final competition demo

- **Repository Path:** `demo/xguard-ai-build-x-final.mp4`
- **Public URL:** https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-final.mp4
- **Captured From:** Canonical Production at https://xguard-ai-six.vercel.app
- **Duration:** Approximately 88 seconds
- **Resolution:** `1920x1080`
- **Codec / Frame Rate:** H.264 at 30 fps
- **Narration:** None
- **Captions:** English

The demo story is:

1. XGuard positioning
2. Suspicious Airdrop
3. Deterministic `78 HIGH`
4. Intent `MISMATCH`
5. `BLOCK_RECOMMENDED`
6. X Layer RPC evidence
7. OKX Mainnet evidence
8. Analysis Receipt
9. `INTEGRITY VERIFIED`
10. Ed25519 Attestation
11. `ATTESTATION VERIFIED`
12. Deterministic Policy Guard
13. Published X Layer Mainnet Proof
14. `anchored(bytes32) = true`
15. Evidence → Integrity → Authenticity → Policy → Anchor

The historical `demo/xguard-ai-build-x-demo.mp4` is preserved unchanged and is not the final competition demo.

## Claim boundaries

- **Receipt Integrity** means the receipt content is consistent with its canonical SHA-256 fingerprint.
- **Ed25519 Attestation** means the deployment key signed that exact receipt fingerprint.
- **Policy Guard** is a deterministic integration recommendation; AI Advisory never controls it.
- **Mainnet Anchor** means the exact digest was recorded on X Layer Mainnet Chain `196`.
- Empty OKX risk entries mean only that no entries were returned; they do not prove safety.
- RPC preflight and OKX simulation are bounded current-state evidence, not a full trace, state-diff, or smart-contract audit.
- No layer guarantees transaction safety.

## Final checks

- [x] Canonical Production is public.
- [x] GitHub repository is public.
- [x] The application baseline passed 362 tests and the Production release gates.
- [x] Receipt integrity and Ed25519 attestation verification are independently demonstrated.
- [x] Deterministic Policy Guard behavior is demonstrated.
- [x] Live OKX Mainnet evidence is labeled as evidence, not a safety verdict.
- [x] Historical Testnet `1952` evidence and current Mainnet `196` evidence are disambiguated.
- [x] The Published Mainnet Proof is independently readable without wallet interaction.
- [x] The final demo uses no wallet connection, signature, broadcast, or new blockchain transaction.

## Deployment tooling note

Repository deployment scripts are historical/developer tooling and are not part of current Production execution. The Mainnet `XGuardReceiptAnchor` is already deployed through an explicit human wallet flow and is publicly verifiable at the links above.
