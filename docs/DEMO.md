# XGuard AI — 75–90 Second Judge Demo

**V4 Preview:** https://xguard-ai-git-codex-v4-okx-simulation-leafwithereds-projects.vercel.app

**Stable Production:** https://xguard-ai-six.vercel.app

The V4 path requires no wallet connection and creates no transaction. Judge Mode only loads inputs; every analysis is an explicit click.

## Script

### 0:00–0:10 — Product promise

Open the V4 Preview and say:

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

### 1:12–1:24 — Evidence hierarchy

Point to Final Risk, deterministic known risk, AI advisory, confidence/verdict/execution, consequences, Intent vs Reality, RPC, and OKX evidence.

Say: “Each claim keeps its provenance. Missing evidence stays missing; conflicts remain visible.”

### 1:24–1:30 — Existing receipt

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
- No connection, signature, broadcast, deployment, or new chain transaction

The existing public MP4 remains the historical stable Production capture. Do not regenerate it until V4 is explicitly approved for Production so the public path continues to represent deployed behavior.
