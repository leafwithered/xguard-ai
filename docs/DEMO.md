# XGuard AI Judge Demo

> Historical Production evidence: the unchanged public video records the stable Production behavior from before V3.1 selector-ambiguity hardening. The current script below describes the `v3-competition` candidate, which no longer treats `approve(address,uint256)` or `transferFrom(address,address,uint256)` as definitively ERC20 without supporting standard evidence. No media is regenerated in this pass.

**V3.1 Preview:** https://xguard-ai-git-v3-competition-leafwithereds-projects.vercel.app

**Stable Production evidence:** https://xguard-ai-six.vercel.app

The main judge path takes 75–90 seconds, requires no wallet connection, and creates no transaction. XGuard AI is an explainable pre-sign security layer for X Layer: real RPC context and deterministic rules establish the safety floor, provider-neutral AI adds explanation, and AI cannot lower known risk.

## 75–90 second judge path

### 0:00–0:10 — Positioning

Open the V3.1 Preview and say:

> XGuard AI is the explainable pre-sign security layer for X Layer. It decodes intent, checks real RPC evidence, and fuses deterministic security rules with provider-neutral AI before the user signs.

Point to `X Layer Testnet · Chain 1952`. Open **⚡ Try Judge Demo** and explain that Judge Mode only loads examples; it never connects, signs, records, or broadcasts.

### 0:10–0:22 — Safe Transfer

Load **Safe Transfer**, select **Analyze risk**, and show:

- LOW known-risk deterministic baseline
- HIGH confidence and `ASSESSED` when complete RPC evidence is available
- `SUCCEEDED` when current-state preflight succeeds
- Intent `MATCH`

Say: “The low-risk baseline is still explainable and grounded in current X Layer RPC data.”

### 0:22–0:40 — Ambiguous Approval

Load **Ambiguous Approval**, select **Analyze risk**, and show:

- decoded `approve(address,uint256)`
- `Standard: UNDETERMINED`
- LOW deterministic known-risk heuristic
- LOW Analysis Confidence
- `Verdict: UNDETERMINED`
- the uint256 may be an ERC20 allowance or an ERC721 token ID
- no `Amount: Unlimited` or definitive ERC20 claim

Say: “XGuard knows when the selector is readable but the evidence is not sufficient to claim exact token semantics. A low heuristic score is not confirmation of safety.”

### 0:40–0:58 — Suspicious Airdrop

Load **Suspicious Airdrop**, select **Analyze risk**, and show:

- decoded `setApprovalForAll(address,bool)` with `Approved: Yes`
- observed contract-wide NFT / multi-token operator permission
- stated CLAIM intent versus permission behavior
- deterministic `MISMATCH`
- HIGH known risk from the mismatch floor
- value `0 OKB` and a non-zero target

Say: “The user thinks they are claiming an airdrop, but the encoded transaction grants broad operator permission. That single contradiction is enough to stop and review.”

### 0:58–1:10 — Explainable Risk Fusion

Point to:

- Deterministic Floor
- AI Assessment
- Final Risk
- `Final Risk = max(Deterministic Floor, AI Assessment)`

Say: “AI may add context or raise risk, but it cannot weaken deterministic security signals.”

### 1:10–1:22 — Contract Intelligence

Show:

- Address Type and bytecode size
- EIP-1967 implementation inspection
- Transaction Preflight from bounded `eth_call`
- Estimated Gas from `eth_estimateGas`

Say: “These are bounded preflight checks, not full state-diff simulation and not proof that a contract is safe.”

### 1:22–1:30 — Existing X Layer evidence

Select **Load Verified X Layer Receipt** and show the confirmed post-hoc receipt and official Explorer link.

Say: “Recording is optional and user-controlled. Judges do not need to connect a wallet or create a new transaction; this existing receipt is the public evidence.”

## Current candidate calldata

Ambiguous Approval uses the shared selector deliberately:

```text
0x095ea7b30000000000000000000000001234567890123456789012345678901234567890ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

Expected decoded fields:

- Action: `Approval-like permission call`
- Method: `approve(address,uint256)`
- Standard: `UNDETERMINED`
- Operator / Spender: `0x1234567890123456789012345678901234567890`
- uint256 Value: preserved as raw evidence

Suspicious Airdrop uses `setApprovalForAll(address,bool)` with `approved = true`:

```text
0xa22cb46500000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000001
```

- Target: `0x08a25a794639a6cA03b0A7C655B2c36d82fF144a`
- Value: `0 OKB`
- Context: `I only want to claim an airdrop.`
- Observed behavior: contract-wide operator permission
- Intent comparison: deterministic `MISMATCH`

## Verified public evidence

- Network: X Layer Testnet (`1952`)
- Contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Verified user transaction: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Receipt: success (`0x1`)
- Event: `RiskAssessmentRecorded`, recorded score `12`
- Explorer: https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb

## Optional wallet evidence

Wallet connection, Chain ID `1952` switching, review, and signing are optional product capabilities—not part of the main judge path. Never sign or create a transaction for the final recording. If wallet UI is shown, stop before any signature request.

## Historical captured video

The public file `demo/xguard-ai-build-x-demo.mp4` is the pre-V3.1 Final Judge Upgrade capture: a 1920×1080 H.264 MP4 of approximately 1:34. It uses only screenshots captured from the canonical Production deployment and therefore retains the historical Safe Transfer / Unlimited Approval / Suspicious Airdrop story. It is public evidence of the stable Production baseline, not the V3.1 candidate semantics.

The media was generated without a wallet connection, signature, deployment, or new chain transaction. Its risk scores, decoded approval, RPC results, and receipt fields are the unmodified values returned by Production during capture.

## Regression checklist

- Safe Transfer: LOW baseline, HIGH confidence when RPC evidence is complete, Intent MATCH
- Ambiguous Approval: shared approve selector, standard UNKNOWN, LOW confidence, UNDETERMINED, no unlimited ERC20 critical signal
- Suspicious Airdrop: `setApprovalForAll(true)`, CLAIM mismatch, deterministic HIGH floor, non-zero target, `0 OKB`
- On-chain Intelligence: real RPC status is visible or explicitly `Unavailable`
- EIP-1967 wording does not imply that all proxy types were checked
- Transaction Preflight is described as bounded `eth_call + eth_estimateGas`, not full simulation
- Editing any transaction field invalidates the old analysis and requires re-analysis
- No wallet connection, signing, contract deployment, or new chain transaction is required
