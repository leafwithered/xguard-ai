# XGuard AI Demo (2–3 minutes)

**Production URL:** https://xguard-ai-six.vercel.app

**Generated video asset:** `demo/xguard-ai-build-x-demo.mp4` — 1920×1080 H.264, approximately 2:56, no audio track. It uses real Production AI Analysis, Safe/Unlimited/Suspicious preset screenshots, and public Explorer evidence; no wallet signature is performed.

## Timed 3-minute script

- **0:00–0:20 — Introduction:** Open the production URL. Explain that XGuard AI reviews transaction intent before a user signs and produces a score, reasons, and recommendation.
- **0:20–0:50 — Wallet and network:** Click `Connect wallet`, confirm the wallet shows X Layer Testnet (`Chain ID 1952`), and point out that signing is always user-confirmed. Do not auto-approve any wallet prompt.
- **0:50–1:20 — Safe transaction:** Use the Safe Transfer preset and click `Analyze risk`. Show `AI Analysis`, the `8 LOW` score, reasons, and recommendation.
- **1:20–1:50 — Unlimited Approval:** Use the preset with the `approve(address,uint256)` calldata below. Show the decoded action, spender, `Amount: Unlimited`, critical signals, and the `72 HIGH` result.
- **1:50–2:20 — Suspicious Airdrop:** Show the zero address, value `12`, and urgent airdrop context. The result is `100 HIGH`; explain that the deterministic safety floor prevents AI from lowering the known risk.
- **2:20–2:40 — User confirmation:** Click `I reviewed this result`, then `Record on X Layer`. The user—not the application—reviews any wallet prompt and decides whether to sign.
- **2:40–2:56 — Evidence and differentiation:** Open the verified X Layer Testnet Explorer evidence and summarize the provider-neutral adapter, deterministic fallback, explicit confirmation, and compact on-chain receipt.

## Judge path

1. Open XGuard AI and point out `X Layer Testnet · Chain 1952`.
2. Connect an EVM wallet, switch to X Layer Testnet if needed, and confirm the network badge.
3. Analyze a normal native transfer to show a LOW score and the advisory recommendation.
4. Replace the target with the zero address and use the unlimited `approve` calldata below; analyze again to show HIGH RISK and the explanation list.
5. Click `I reviewed this result`, then `Record on X Layer`. The wallet opens a user-confirmed `RiskRegistry.recordAssessment(bytes32,uint8)` transaction.
6. Approve only after checking the destination, score, and estimated testnet gas. Open the returned explorer link and show the receipt.
7. Point judges to the verified contract `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`.

## Local Risk Analysis

1. Run `npm run dev` and open `http://localhost:3000`.
2. Confirm the page shows `Local Analysis` when no AI provider is configured.
3. Enter:
   - From: empty or a connected wallet address
   - To: `0x0000000000000000000000000000000000000000`
   - Value: `12`
   - Calldata: `0x095ea7b30000000000000000000000001234567890123456789012345678901234567890ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`
   - Context: `Urgent airdrop claim on an unknown contract`
4. Click `Analyze risk`.
5. Verify a HIGH result and reasons covering the zero address, approval, unlimited amount, large value, unknown contract, and social-engineering signal.

## Fallback and validation QA

- With `AI_API_KEY`, `AI_BASE_URL`, or `AI_MODEL` missing, the report is labeled `Local Analysis`.
- If a configured provider times out, returns an error, does not support `/v1/responses`, or returns malformed JSON, the API keeps the deterministic Local Analysis result available.
- A `null` body, invalid address, odd-length calldata, negative value, or non-finite value returns HTTP `400` without invoking the provider.
- `npm run risk:test` covers deterministic signals and malformed input; `npm run ai:test` uses a local fake provider and never contacts a real AI service.

## Wallet and X Layer

1. Click `Connect wallet`.
2. If required, click `Switch to X Layer` and approve the network addition/switch in the wallet.
3. With the verified `RiskRegistry` address configured, click `I reviewed this result`.
4. Click `Record on X Layer`.
5. Approve the transaction in the wallet.
6. Open the returned transaction link in the X Layer Testnet explorer.

Wallet connection, network approval, and transaction signing must be performed by the user.

## Verified on-chain artifact

- Network: X Layer Testnet (`1952`)
- Contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Explorer: https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5

## Real user interaction evidence

- Network: X Layer Testnet (`1952`)
- Contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Method: `recordAssessment(bytes32,uint8)`
- Transaction hash: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Receipt status: success (`0x1`)
- RiskRegistry event: `RiskAssessmentRecorded` emitted; recorded risk score `12`
- Explorer: https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb
