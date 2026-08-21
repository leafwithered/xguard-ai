# XGuard AI

> **The explainable pre-sign security layer for X Layer.**

XGuard AI decodes transaction behavior, explains the deterministic consequences of signing, compares those consequences with the user's optional stated intent, inspects real X Layer on-chain context, and fuses deterministic security rules with AI explanation. AI may raise risk, but it cannot reduce known deterministic security signals. Users remain in control of every wallet action.

**Live Demo:** https://xguard-ai-six.vercel.app  ·  **GitHub:** https://github.com/leafwithered/xguard-ai  ·  **Final Judge Demo Video:** https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4

**Project X:** https://x.com/AevrynHQ  ·  **Build X Post:** https://x.com/AevrynHQ/status/2090382549205873099

![XGuard AI Final Judge interface](docs/assets/xguard-v2-hero.png)

**Demo asset:** `demo/xguard-ai-build-x-demo.mp4` (1920×1080 H.264, approximately 1:34). It was composed from verified screenshots of the canonical Production deployment and demonstrates Judge Mode, Hybrid Analysis, Risk Fusion, real X Layer RPC intelligence, and the existing confirmed receipt without connecting a wallet or creating a transaction.

## V4 Preview Candidate — OKX Simulation Evidence

The `codex/v4-okx-simulation` branch extends the frozen V3 evidence architecture without changing the stable Production deployment:

- **X Layer Testnet (`1952`)** keeps the existing bounded RPC intelligence and preflight path. It never calls the Mainnet simulator.
- **X Layer Mainnet (`196`, OKX `chainIndex: "196"`)** adds the official OKX OnchainOS Transaction Simulation API as a server-side, read-only evidence provider.
- RPC preflight and OKX simulation remain separate evidence sources. Any disagreement is surfaced explicitly and caps analysis confidence.
- Simulation facts enter normalized evidence before the optional AI call. AI may explain those facts but cannot rewrite them or lower the deterministic safety floor.
- An empty OKX risk list means only **“No OKX simulation risk entries were returned.”** It is not proof of safety.
- Missing credentials, authentication errors, rate limits, timeouts, malformed responses, and provider errors remain visible but non-fatal; deterministic/RPC/AI-or-Local analysis continues.

This V4 code is a **Preview candidate only** until a real read-only API verification and separate release approval are complete. It does not alter the existing RiskRegistry, verified receipt, canonical Production URL, or Production environment.

See [docs/V4_OKX_SIMULATION.md](docs/V4_OKX_SIMULATION.md) for the evidence schema, trust boundaries, failure matrix, and credential handoff gate.

## 60–90 Second Judge Path (V3 stable)

1. Open the V3.1 Preview and select **⚡ Try Judge Demo**.
2. Load **Safe Transfer**, then explicitly click **Analyze risk** to see the LOW baseline.
3. Load **Ambiguous Approval** to see `approve(address,uint256)` remain LOW-confidence and `UNDETERMINED`: the uint256 may be an ERC20 allowance or an ERC721 token ID, so a low heuristic score is not confirmation of safety.
4. Load **Suspicious Airdrop** to see a CLAIM intent conflict with `setApprovalForAll(true)`, producing a deterministic HIGH `MISMATCH` because the transaction grants contract-wide operator permission.
5. Select **Load Verified X Layer Receipt** to inspect the existing confirmed RiskRegistry transaction from real X Layer RPC data.

Judge Mode only loads examples, navigates, and explains. It never auto-analyzes, connects a wallet, signs, records an assessment, or broadcasts a transaction.

## Why XGuard Is Different

- **Deterministic first:** known security rules and decoded permissions establish an inspectable floor.
- **Transaction consequences:** a deterministic engine answers “What happens if I sign this?” with source-labeled facts and no invented token metadata.
- **Intent vs Reality:** optional user intent is normalized, then compared against decoded behavior; deterministic mismatches may raise risk and cannot be downgraded by AI.
- **Transparent AI fusion:** `Final Risk = max(Deterministic Floor, AI Assessment)` is shown in the product.
- **Real X Layer intelligence:** `eth_getCode`, EIP-1967 inspection, `eth_call`, and `eth_estimateGas` provide live context with isolated timeouts.
- **Explainable evidence:** risk signals are labeled `RULE`, `DECODER`, `ON-CHAIN`, or `AI`; unavailable data is never fabricated.
- **User-controlled signing:** analysis and receipt recording are advisory and require explicit user actions.

## Stable Production Baseline

The frozen V3 stable checkpoint is commit `04575cc764163c7cb99b948c050e974e4cd20a2e` with tag `v3.1.1-stable`, and the canonical Vercel Production URL remains unchanged. Production Hybrid Analysis is verified through the provider-neutral adapter; the upstream provider is selected only through server-side environment variables and is not asserted by the public client. The V1 RiskRegistry evidence and every public URL remain unchanged.

- Safe Transfer: `8 LOW`, Hybrid Analysis
- Unlimited Approval: `72 HIGH`, decoded ERC20 `approve`, spender and `Amount: Unlimited` visible
- Suspicious Airdrop: `100 HIGH`, deterministic safety floor preserved through AI enrichment
- Clear Analysis, wallet connection, X Layer Testnet switching, and explicit user confirmation are included
- Contract V2 is documented as a proposal only; no new contract or chain transaction was introduced

### V3 Stable Evidence Architecture

V3 adds an evidence-first analysis pipeline, deterministic Transaction Consequence Engine, optional Intent vs Reality comparison, selector-ambiguity hardening, and a reproducible 57-case security benchmark (34 corpus cases, 11 pipeline invariants, and 12 semantic/adversarial cases). The stable checkpoint does not alter the existing RiskRegistry contract or verified receipt.

### V3.1 semantic correctness

`approve(address,uint256)` and `transferFrom(address,address,uint256)` are shared by ERC20 and ERC721. V3.1 therefore decodes their signature-level facts first and leaves the uint256 meaning explicitly unresolved unless bounded ERC165 evidence positively identifies ERC721. A negative ERC721/ERC1155 result never proves ERC20. In particular, `maxUint256` is not called an unlimited ERC20 allowance without separately trusted ERC20 semantics.

For smart contracts, XGuard checks `supportsInterface(0x80ac58cd)` and `supportsInterface(0xd9b67a26)` with bounded RPC calls. Positive results may establish ERC721 or ERC1155; unavailable, false, or inconsistent evidence remains `UNKNOWN`. `setApprovalForAll` is described as contract-wide NFT/multi-token operator permission without inventing a standard or collection identity.

Empty calldata with native value is also target-aware: an EOA is described as an externally owned account, while a smart-contract target warns that `receive()` or `fallback()` logic may execute. XGuard never claims what that logic does.

## Project Overview

The application supports wallet connection, X Layer Testnet detection and switching, transaction decoding, real RPC intelligence, bounded preflight checks, provider-neutral AI analysis, deterministic fallback analysis, post-hoc transaction inspection, Judge Mode, user confirmation, and an optional on-chain risk receipt.

### V3.1 Candidate Product

- Hybrid Analysis returns structured risk analysis through an OpenAI-compatible Responses API without allowing AI to weaken deterministic signals.
- Local Analysis keeps the product usable when the configured AI provider is unavailable or returns invalid output.
- Every V3 report separates known-risk severity, analysis confidence, verdict, and current execution status, with plain-language reasons and a recommendation.
- Calldata decoding exposes signature-level approval/transfer facts, confirmed token-standard evidence, transfer recipients, raw uint256 values, and contract-wide operator permissions without forcing ERC20 semantics onto shared selectors.
- Demo presets make Safe Transfer, Ambiguous Approval, and Suspicious Airdrop paths reproducible without auto-analyzing or signing.
- Recording is optional and only starts after explicit user review and wallet confirmation.
- The UI waits for a successful X Layer receipt before displaying `Confirmed`.
- `RiskRegistry` is deployed on X Layer Testnet, and a real user-signed interaction is publicly verified below.
- The production deployment has been verified with a provider-backed Hybrid Analysis response.

## Problem

Wallet confirmation screens expose raw addresses, values, and calldata that many users cannot interpret. Malicious approvals, unknown selectors, zero-address transfers, and social-engineering prompts can look similar to normal transactions.

## Solution

XGuard AI converts transaction fields into a `0–100` heuristic severity score, a `LOW / MEDIUM / HIGH` known-risk level, concise reasons, and an actionable recommendation. V3 separately reports `Analysis Confidence`, `Verdict`, and `Execution Status`, so a low score for unsupported behavior cannot look like confirmed safety. The app never signs automatically; users retain final control.

The score is a deterministic heuristic severity score. It is not a probability of maliciousness, a statistically calibrated fraud probability, an audit result, or a safety guarantee; for example, `72` does not mean “72% malicious.”

The hybrid design combines a deterministic Risk Engine with a configurable OpenAI-compatible explanation layer. Production Hybrid Analysis is verified, while the public repository remains neutral about the server-configured upstream provider. If that provider is unavailable, Local Analysis remains fully demoable.

## How XGuard AI Works

1. Connect an EVM wallet.
2. Detect or switch to X Layer Testnet (`1952`).
3. Enter `from`, `to`, value, calldata, and an optional plain-language expectation.
4. Decode supported calldata and run the deterministic Local Risk Engine.
5. Inspect the target through the RPC selected for the explicit analysis network and run bounded `eth_call` / `eth_estimateGas` preflight checks.
6. On X Layer Mainnet only, request additional read-only transaction evidence from OKX OnchainOS Transaction Simulation; X Layer Testnet never uses this API.
7. Build sanitized, normalized evidence containing decoded behavior, deterministic signals, consequences, contract facts, RPC execution facts, and the immutable simulation block.
8. Derive confidence, verdict, execution state, and evidence consistency deterministically, then call the optional AI adapter once with that evidence.
9. Compare optional stated intent with decoded reality, enforce deterministic mismatch floors, and fuse AI advisory risk without allowing it to lower the floor.
10. Review consequences, Intent vs Reality, known-risk severity, confidence, separate RPC/simulation evidence, reasons, and recommendation before signing.
11. Optionally confirm explicitly and record the assessment hash and score through the existing Testnet `RiskRegistry`.

## Architecture

```mermaid
flowchart TD
    U[User Transaction] --> D[Transaction Decoder]
    D --> L[Deterministic Risk Engine]
    L --> CI[On-chain Contract Intelligence]
    CI --> P[Transaction Preflight]
    P --> O{Mainnet 196?}
    O -->|yes| X[OKX OnchainOS Simulation]
    O -->|no: Testnet 1952| C[Deterministic Consequences]
    X --> C
    C --> E[Normalized Immutable Evidence]
    E --> V[Confidence / Verdict / Execution]
    E --> A[One AI Advisory Call]
    I[Optional User Intent] --> M[Intent vs Reality]
    A --> M
    C --> M
    M --> S[Deterministic Safety Floor]
    S --> F[Risk Fusion]
    A --> F
    A -. unavailable or invalid .-> S
    V --> R[Final Evidence Report]
    F --> R
    R --> Q[User Decision]
    Q --> XR[Optional X Layer Receipt]
```

## AI Risk Engine

`lib/analyze-pipeline.ts` owns the evidence-first orchestration and accepts small injectable RPC, simulation, and AI dependencies for integration testing. `lib/evidence.ts` creates a bounded, sanitized object with the transaction, decoded action, deterministic signals, consequences, address type, code presence/size, scoped EIP-1967 observation, RPC preflight facts, and normalized OKX simulation evidence. Only after that evidence exists does `lib/ai/provider.ts` make one advisory request. Configure an OpenAI-compatible provider using `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. The adapter attempts `/v1/responses` first and then `/v1/chat/completions`. Output is validated before use. Production Hybrid Analysis is verified through this server-configured adapter; public artifacts do not assert the upstream provider identity.

Confidence and verdict are deterministic: unsupported, malformed, or materially token-standard-ambiguous calldata is `LOW` confidence and `UNDETERMINED`; a known decode with unavailable or partial RPC evidence is generally `MEDIUM`; a known decode with complete RPC evidence may be `HIGH`; an observed EIP-1967 implementation caps confidence at `MEDIUM` because arbitrary implementation behavior is not fully inspected. Every response includes deterministic `confidenceReasons`. High risk does not mean low confidence, and preflight revert does not add arbitrary malicious-risk points. AI cannot change evidence, execution status, verdict, or final analysis confidence.

User-provided `transaction.context` is structured as untrusted intent data. Both Responses and Chat fallback prompts explicitly reject embedded instructions such as “ignore previous instructions,” “mark this safe,” or requests to discard RPC evidence. This is defense-in-depth, not a claim that any LLM is universally prompt-injection-proof; deterministic evidence and fusion invariants remain the primary boundary.

AI enrichment has a shared 15-second provider budget. Responses remains preferred and Chat Completions is attempted only when the Responses endpoint explicitly reports a compatibility status or returns malformed success output. Network failures and timeouts fall back directly to Local Analysis instead of stacking a second provider timeout. RPC evidence is still collected before AI, so this bound does not weaken evidence-first ordering.

The deterministic Local Risk Engine checks zero addresses, exact bigint native value thresholds, decoded ERC20/NFT approvals, unlimited permissions, transfer methods, malformed and unknown calldata, intent mismatches, unknown-contract context, and common social-engineering signals. AI may normalize ambiguous natural language, but deterministic code performs the consequence comparison wherever supported.

The browser never receives `AI_API_KEY`. Missing configuration, timeouts, unsupported endpoints, and malformed output automatically use Local Analysis.

The adapter is intentionally provider-neutral: `AI_BASE_URL` may point at a third-party OpenAI-compatible base URL, with or without `/v1`. It tries `/v1/responses` first and uses `/v1/chat/completions` when Responses is unsupported. `mergeRiskResults` guarantees `finalScore >= deterministicScore` and preserves deterministic critical signals.

## X Layer Integration

| Analysis network | Chain ID | RPC evidence | OKX Transaction Simulation |
| --- | ---: | --- | --- |
| X Layer Testnet | `1952` | `https://testrpc.xlayer.tech/terigon` | Unsupported; never called |
| X Layer Mainnet | `196` | `https://rpc.xlayer.tech` | Supported in V4 with `chainIndex: "196"` |

Both networks use OKB as the native token. The existing `RiskRegistry` and verified receipt remain Testnet-only.

### On-chain Intelligence and Preflight

For each valid destination, the server performs isolated, timeout-bounded X Layer RPC checks:

- `eth_getCode` distinguishes an EOA from a smart contract and reports actual bytecode size.
- `eth_getStorageAt` inspects the EIP-1967 implementation slot without claiming trust, verification, or audit status.
- `eth_call` reports whether the proposed call succeeds or reverts and decodes standard `Error(string)` and `Panic(uint256)` data when available.
- `eth_estimateGas` reports an estimate when the RPC can produce one.

RPC failure never blocks deterministic analysis. Unavailable results are labeled `Unavailable`; XGuard does not invent contract reputation or simulation output. The Transaction Analyzer can also load a real X Layer transaction and receipt for clearly labeled **post-hoc** analysis.

### OKX OnchainOS Transaction Simulation (V4 Preview)

For an explicitly selected X Layer Mainnet analysis, the server signs one bounded `POST /api/v6/dex/pre-transaction/simulate` request using the exact raw JSON body sent on the wire. `txAmount` is converted from human OKB to 18-decimal base units, and calldata is sent unchanged. The UI preserves provider-returned intention, asset changes and raw signed values, gas used, failure reason, and risk entries. A simulation failure means the transaction may fail under the simulated state; it is not automatically labeled malicious.

Credentials are server-side only. The browser bundle, API response, logs, fixtures, and repository never receive keys, passphrases, or authentication signatures. Phase A intentionally performs no real OKX request; real verification is gated on Preview-only credential configuration.

## Smart Contract

`contracts/RiskRegistry.sol` stores an assessment by `analysisHash` with the submitting user, risk score, and timestamp. It holds no funds and creates no token.

```solidity
recordAssessment(bytes32 analysisHash, uint8 riskScore)
```

Deployed testnet contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`  
Deployment transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`  
[Open in X Layer Testnet Explorer](https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)

### Verified user interaction

- Network: X Layer Testnet (`1952`)
- Contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Method: `recordAssessment(bytes32,uint8)`
- User interaction transaction: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Receipt status: success (`0x1`)
- Event: `RiskAssessmentRecorded` emitted with risk score `12`
- Explorer: [View transaction](https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb)

## Tech Stack

- Next.js 14, React, TypeScript
- viem and injected EVM wallets
- Configurable OpenAI-compatible provider adapter
- Solidity 0.8.24, Hardhat, ethers
- X Layer Testnet

## Local Development

```bash
pnpm install --frozen-lockfile
copy .env.example .env.local
pnpm run dev
```

Open `http://localhost:3000`. The app works without AI credentials using Local Analysis.

The public production deployment is available at https://xguard-ai-six.vercel.app.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | AI provider key; server-side only |
| `AI_BASE_URL` | OpenAI-compatible provider base URL, with or without `/v1` |
| `AI_MODEL` | Provider-specific model identifier |
| `XLAYER_RPC_URL` | X Layer Testnet deployment RPC |
| `XLAYER_MAINNET_RPC_URL` | X Layer Mainnet RPC used for Mainnet intelligence/preflight |
| `OKX_API_KEY` | OKX OnchainOS API key; server-side only |
| `OKX_SECRET_KEY` | OKX signing secret; server-side only |
| `OKX_API_PASSPHRASE` | OKX API passphrase; server-side only |
| `NEXT_PUBLIC_RISK_REGISTRY_ADDRESS` | Deployed registry address used by the browser |
| `DEPLOYER_PRIVATE_KEY` | Deployment wallet key; never commit |

## Contract Deployment

```bash
pnpm run contract:compile
pnpm run contract:test
pnpm run contract:deploy
```

Deployment requires a user-controlled private key and testnet OKB. Never commit `.env.local` or expose a private key to the browser.

## Testing

```bash
pnpm run build
pnpm run contract:compile
pnpm run contract:test
pnpm run risk:test
pnpm run ai:test
pnpm run decoder:test
pnpm run fusion:test
pnpm run intelligence:test
pnpm run transaction-analyzer:test
pnpm run judge:test
pnpm run analysis-state:test
pnpm run consequence:test
pnpm run intent:test
pnpm run pipeline:test
pnpm run token-standard:test
pnpm run security-benchmark:test
pnpm run simulation:test
```

The full 57-case V3.1 benchmark and its invariants are documented in [docs/SECURITY_BENCHMARK.md](docs/SECURITY_BENCHMARK.md).

The browser smoke path is documented in [docs/DEMO.md](docs/DEMO.md). The API returns `400` for invalid transaction input and keeps Local Analysis available when the configured provider fails.

`npm run contract:deploy` is intentionally not part of the automated test run because it requires a user-controlled deployer key and testnet OKB.

## Demo Flow

Use the 60–90 second path in [docs/DEMO.md](docs/DEMO.md) to demonstrate Safe Transfer, Ambiguous Approval, Suspicious Airdrop, Risk Fusion, and Contract Intelligence without connecting a wallet or creating a new transaction. Finish with the existing verified X Layer receipt as optional public evidence.

## Security Disclaimer

XGuard AI is an advisory prototype, not an audit, wallet firewall, or guarantee of transaction safety. AI and deterministic rules can miss malicious behavior or produce false positives. Verify contracts, permissions, amounts, and destinations independently before signing.

## Limitations

- RPC preflight uses `eth_call` and `eth_estimateGas`. V4 adds bounded OKX simulation evidence on Mainnet, but does not claim full state-diff coverage or proof of safety.
- Contract reputation and verified source metadata are not yet integrated.
- The on-chain registry stores the submitting address, score, hash, and timestamp only; it does not execute or protect transactions.
- AI provider behavior depends on the configured service and its OpenAI-compatible endpoint behavior.

## Roadmap

- Wallet SDK/API integration for other X Layer applications.
- Browser extension and wallet-native pre-sign delivery after the web prototype.
- Verified source metadata and bytecode provenance from authoritative sources.
- Additional trace/state-diff provenance only if an authoritative provider exposes those fields explicitly.
- Evidence-backed phishing intelligence without fabricated reputation scores.
- X Layer mainnet deployment only after the required testnet phase and a separate security review.

The append-only registry design is documented in [docs/CONTRACT_V2.md](docs/CONTRACT_V2.md). It is a proposal only; the deployed V1 contract and verified evidence remain unchanged.

## License

Released under the [MIT License](LICENSE).

## Submission

See [docs/SUBMISSION.md](docs/SUBMISSION.md) for the complete public evidence checklist and final submission fields. Contact email is intentionally omitted from the public repository and provided only in the official form.
