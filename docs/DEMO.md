# XGuard AI — Final Build X Demo

> **Verifiable pre-sign security and policy infrastructure for X Layer.**

- **Canonical Production:** https://xguard-ai-six.vercel.app
- **Repository Path:** `demo/xguard-ai-build-x-final.mp4`
- **Public Video:** https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-final.mp4
- **Duration:** Approximately 88 seconds
- **Resolution:** `1920x1080`
- **Codec / Frame Rate:** H.264 at 30 fps
- **Narration:** None
- **Captions:** English
- **Capture Source:** Canonical Production only

The historical `demo/xguard-ai-build-x-demo.mp4` remains unchanged. It is retained as historical evidence and is not the final competition demo.

## Final demo story

`Transaction → Evidence → Receipt Integrity → Deployment-key Authenticity → Policy Action → Mainnet Receipt Anchor`

| Time | Production evidence shown |
| --- | --- |
| `0:00–0:07` | XGuard positioning: verifiable pre-sign security and policy infrastructure for X Layer |
| `0:07–0:12` | 60-Second Judge Path and explicit no-wallet workflow |
| `0:12–0:20` | Suspicious Airdrop, deterministic `78 HIGH`, and contract-wide operator permission |
| `0:20–0:27` | Intent vs Reality: claim intent conflicts with calldata, producing `MISMATCH` |
| `0:27–0:34` | Deterministic Policy Guard: `BLOCK_RECOMMENDED`; AI Advisory does not control policy |
| `0:34–0:41` | X Layer RPC evidence on X Layer Mainnet, Chain `196` |
| `0:41–0:50` | OKX OnchainOS `LIVE PROVIDER EVIDENCE` and `AVAILABLE` read-only Mainnet simulation |
| `0:50–0:57` | Versioned Analysis Receipt and canonical SHA-256 fingerprint |
| `0:57–1:03` | Receipt verification: `INTEGRITY VERIFIED` |
| `1:03–1:12` | Ed25519 deployment attestation with `INTEGRITY VERIFIED` and `ATTESTATION VERIFIED` |
| `1:12–1:18` | Published X Layer Mainnet Receipt Anchor proof ready for read-only verification |
| `1:18–1:28` | `PUBLISHED MAINNET PROOF CONFIRMED` and `anchored(bytes32) = true` |

Closing sequence: **Evidence → Integrity → Authenticity → Policy → Anchor.**

## Demonstrated security boundaries

- Deterministic transaction decoding and X Layer RPC evidence remain inspectable separately from AI Advisory.
- The user’s stated intent never replaces decoded transaction facts.
- AI Advisory can raise final risk but cannot lower deterministic known risk or control policy state.
- OKX OnchainOS output is additional provider evidence, never a safety oracle.
- Empty OKX risk entries do not prove a transaction is safe.
- Receipt Integrity proves content consistency with the canonical SHA-256 fingerprint, not authorship or safety.
- Ed25519 Attestation proves deployment-key authenticity of that exact receipt fingerprint, not transaction safety or provider truth.
- Policy Guard is a deterministic integration recommendation.
- Mainnet anchoring proves that the exact digest was recorded on Chain `196`; it does not prove safety, provider truth, execution, ownership, or legal identity.
- X Layer RPC preflight and OKX simulation are bounded current-state evidence, not a full trace, state-diff, or smart-contract audit.

## Mainnet proof shown

- **Network:** X Layer Mainnet
- **Chain ID:** `196`
- **Contract:** `XGuardReceiptAnchor`
- **Anchor Contract:** [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- **Deployment Tx:** [`0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb`](https://www.okx.com/web3/explorer/xlayer/tx/0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb)
- **First Anchor Tx:** [`0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347`](https://www.okx.com/web3/explorer/xlayer/tx/0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347)
- **Published Receipt Digest:** `0xef6cf319eb689233180f465d331969c91a9c5c07d893047294bdda5de0da0eab`
- **Read-only Result:** `anchored(bytes32) = true`

## Historical Testnet evidence

- **Network:** X Layer Testnet
- **Chain ID:** `1952`
- **Contract:** `RiskRegistry`
- **Address:** [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- **Historical Deployment Tx:** [`0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b)
- **Historical Interaction Tx:** [`0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb)

The historical Testnet `RiskRegistry` and current Mainnet `XGuardReceiptAnchor` happen to share the same hexadecimal address on different chains. They are separate contracts and separate evidence paths.

## Recording safety

The final demo used zero wallet connections, wallet RPC requests, user signatures, broadcasts, contract deployments, or new blockchain transactions. Published Mainnet Proof verification is read-only. No secret values appear in the recording.
