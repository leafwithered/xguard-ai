# XGuard AI Judge Demo

**Production:** https://xguard-ai-six.vercel.app

The main judge path takes 75–90 seconds, requires no wallet connection, and creates no transaction. XGuard AI is an explainable pre-sign security layer for X Layer: real RPC context and deterministic rules establish the safety floor, provider-neutral AI adds explanation, and AI cannot lower known risk.

## 75–90 second judge path

### 0:00–0:10 — Positioning

Open Production and say:

> XGuard AI is the explainable pre-sign security layer for X Layer. It decodes intent, checks real RPC evidence, and fuses deterministic security rules with provider-neutral AI before the user signs.

Point to `X Layer Testnet · Chain 1952`. Open **⚡ Try Judge Demo** and explain that Judge Mode only loads examples; it never connects, signs, records, or broadcasts.

### 0:10–0:22 — Safe Transfer

Load **Safe Transfer**, select **Analyze risk**, and show:

- `8 LOW`
- `Hybrid Analysis`
- deterministic baseline
- `X Layer RPC` evidence

Say: “The low-risk baseline is still explainable and grounded in current X Layer RPC data.”

### 0:22–0:42 — Unlimited Approval

Load **Unlimited Approval**, select **Analyze risk**, and show:

- `72 HIGH`
- decoded `approve(address,uint256)`
- spender `0x1234567890123456789012345678901234567890`
- `Amount: Unlimited`
- source labels: `RULE / DECODER / ON-CHAIN / AI`

Say: “Raw calldata becomes a human-readable permission request before signing.”

### 0:42–0:55 — Explainable Risk Fusion

Point to:

- Deterministic Floor
- AI Assessment
- Final Risk
- `Final Risk = max(Deterministic Floor, AI Assessment)`

Say: “AI may add context or raise risk, but it cannot weaken deterministic security signals.”

### 0:55–1:08 — Contract Intelligence

Show:

- Address Type and bytecode size
- EIP-1967 implementation inspection
- Transaction Preflight from bounded `eth_call`
- Estimated Gas from `eth_estimateGas`

Say: “These are bounded preflight checks, not full state-diff simulation and not proof that a contract is safe.”

### 1:08–1:20 — Suspicious Airdrop

Load **Suspicious Airdrop**, select **Analyze risk**, and show:

- `100 HIGH`
- zero-address and unlimited-approval critical signals
- social-engineering context
- `Deterministic floor preserved`

Say: “Even when AI participates, the deterministic safety floor remains 100.”

### 1:20–1:30 — Existing X Layer evidence

Select **Load Verified X Layer Receipt** and show the confirmed post-hoc receipt and official Explorer link.

Say: “Recording is optional and user-controlled. Judges do not need to connect a wallet or create a new transaction; this existing receipt is the public evidence.”

## Unlimited Approval calldata

Use the checked-in Judge Mode preset. Its calldata is:

```text
0x095ea7b30000000000000000000000001234567890123456789012345678901234567890ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

Expected decoded fields:

- Action: `ERC20 Approval`
- Method: `approve(address,uint256)`
- Spender: `0x1234567890123456789012345678901234567890`
- Amount: `Unlimited`

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

## Current video status

The public file `demo/xguard-ai-build-x-demo.mp4` is a valid 1920×1080 H.264 MP4 of approximately 2:56, but its screenshots predate the Final Judge Upgrade. It does not fully show Judge Mode, Explainable Risk Fusion, Contract Intelligence, Transaction Preflight, or all four source labels.

A manual 75–100 second Production recording using the timed path above is recommended. Replace the existing file only after visually verifying that the recording contains no secret, wallet signature, personal information, fabricated RPC result, or fabricated AI response.

## Regression checklist

- Safe Transfer: `8 LOW`, Hybrid Analysis
- Unlimited Approval: `72 HIGH`, decoded spender and unlimited amount
- Suspicious Airdrop: `100 HIGH`, deterministic floor preserved
- On-chain Intelligence: real RPC status is visible or explicitly `Unavailable`
- EIP-1967 wording does not imply that all proxy types were checked
- Transaction Preflight is described as bounded `eth_call + eth_estimateGas`, not full simulation
- Editing any transaction field invalidates the old analysis and requires re-analysis
- No wallet connection, signing, contract deployment, or new chain transaction is required
