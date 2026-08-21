# XGuard AI

> **Know what a transaction does before you sign.**

XGuard AI is explainable, verifiable pre-sign security infrastructure for X Layer. V7 adds deterministic wallet/dApp policy action to the existing evidence, receipt integrity, and deployment-key authenticity layers:

`Evidence → Integrity → Authenticity → Policy Action`

The Policy Guard returns `ALLOW`, `WARN`, `REQUIRE_REVIEW`, or `BLOCK_RECOMMENDED`. AI Advisory never controls policy state, `ALLOW` is not a guarantee of safety, and nothing connects, signs, or broadcasts automatically.

**Production:** [xguard-ai-six.vercel.app](https://xguard-ai-six.vercel.app) · **Source:** [github.com/leafwithered/xguard-ai](https://github.com/leafwithered/xguard-ai) · **Demo:** [xguard-ai-build-x-demo.mp4](https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4)

**X account:** [@AevrynHQ](https://x.com/AevrynHQ) · **Build X post:** [View post](https://x.com/AevrynHQ/status/2090382549205873099)

![XGuard AI interface](docs/assets/xguard-v2-hero.png)

## What judges can verify

1. **Safe Transfer** — `8 LOW`, an explainable deterministic baseline.
2. **Ambiguous Approval** — deterministic `20 LOW`, `LOW` confidence, `UNDETERMINED`; `approve(address,uint256)` is not forced into ERC20 semantics without token-standard evidence.
3. **Suspicious Airdrop** — deterministic `78 HIGH`, `MISMATCH`; claim intent conflicts with `setApprovalForAll(true)`.
4. **Live OKX Mainnet Simulation** — a public historical approval fixture can be loaded explicitly for real, read-only provider evidence on Chain `196`.
5. **Analysis Receipt** — inspect a random analysis ID, schema version, normalized provenance, and SHA-256 fingerprint; export JSON explicitly.
6. **Verify Receipt** — verify the current receipt or import a JSON receipt locally; tampering fails the integrity check.
7. **Signed Analysis Attestation** — verify that the exact receipt fingerprint was signed by the Ed25519 key configured for this deployment.
8. **Existing X Layer receipt** — a real, user-signed RiskRegistry receipt is verifiable on X Layer Testnet (`1952`).
9. **Policy Guard** — inspect a deterministic integration recommendation and stable reason codes; AI does not control the decision.

Judge Mode only loads examples and navigates. The user must explicitly select **Analyze risk**. It never connects a wallet, signs, records, or broadcasts.

## V7 Preview status

`codex/v7-policy-engine` is a Preview-only candidate based exactly on the human-QA-passed V6 checkpoint. It has not been merged into `main` and does not change the canonical V4.1 Production deployment.

- Testnet `1952` retains the V3 RPC/preflight path and never calls the Mainnet simulator.
- Mainnet `196` adds optional OKX OnchainOS simulation with `chainIndex: "196"`.
- A Live Provider badge appears only for normalized `AVAILABLE` evidence with HTTP `200` and business code `0` on Mainnet `196`.
- RPC and OKX simulation remain separate evidence sources; disagreement is surfaced and lowers confidence.
- Missing credentials, timeout, rate limiting, malformed responses, and provider errors never disable deterministic analysis.
- Empty provider risk entries mean only that no entries were returned—not that a transaction is safe.
- Every completed analysis adds a backward-compatible `analysisReceipt` response field with schema `1.0.0` and `xguard-c14n-v1` integrity.
- When configured, the API adds an optional `analysisAttestation` signed by the deployment's Ed25519 key; missing or invalid signing configuration never breaks analysis or the V5 receipt.
- Standalone V5 receipt export is unchanged. A separate Attested Analysis Package binds the receipt fingerprint to the deployment key.
- Attested package verification resolves the deployment's trusted public key and never trusts a key supplied by an uploaded package.
- Export and verification are explicit actions. Verification does not call AI, OKX, RPC, a wallet, or a blockchain.
- A separate adjacent `policyDecision` uses only normalized deterministic evidence and does not modify the V5 receipt or V6 attestation formats.
- Use [`sdk/xguard.ts`](sdk/xguard.ts) and [`examples/wallet-integration.ts`](examples/wallet-integration.ts) for a compact, repository-local integration example.

See the [Policy Engine specification](docs/POLICY_ENGINE.md), [Analysis Receipt specification](docs/ANALYSIS_RECEIPT_SPEC.md), [Signed Attestation specification](docs/ATTESTATION_SPEC.md), [integration guide](docs/INTEGRATION.md), [OpenAPI](docs/openapi.yaml), and [judge demo](docs/DEMO.md).

## Evidence hierarchy

XGuard reports these layers separately:

| Layer | Meaning |
| --- | --- |
| Final Risk Score | `max(Deterministic Known Risk, AI Advisory)` |
| Deterministic Known Risk | Rule- and decoder-backed heuristic severity |
| AI Advisory | Evidence-grounded score/explanation; may raise but never lower the deterministic floor |
| Confidence / Verdict / Execution | Whether evidence is sufficient, whether the case is assessed, and current-state preflight outcome |
| Consequences / Intent | What signing does and whether that matches the user’s stated goal |
| X Layer RPC | Bytecode, scoped EIP-1967 implementation-slot check, `eth_call`, and `eth_estimateGas` |
| OKX Simulation | Additional Mainnet provider evidence: intention, changes, gas, failure reason, and risk entries |

The primary score is never labeled “known risk” when AI raised it. For example, an Ambiguous Approval may show deterministic `20 LOW`, AI `75 HIGH`, and final `75 HIGH` while remaining `LOW` confidence and `UNDETERMINED`.

## Deterministic Safety Invariant

`Final Risk = max(Deterministic Known Risk, AI Advisory)`

AI can explain evidence or raise final risk, but it cannot reduce deterministic known-risk signals, rewrite RPC/simulation facts, change the deterministic verdict, or turn missing evidence into proof of safety. If the AI provider is missing, unavailable, slow, or malformed, XGuard falls back to Local Analysis.

## Why X Layer and OKX

X Layer is where transaction intent, contract behavior, and user confirmation meet. XGuard uses X Layer RPC for chain-specific bytecode and bounded preflight evidence on both supported networks. The existing `RiskRegistry` creates a compact, public proof that a user reviewed an assessment on Testnet without executing the analyzed transaction.

On X Layer Mainnet, OKX OnchainOS adds an independent read-only simulation view. That evidence improves consequence visibility but is deliberately bounded: provider evidence is not a safety verdict, and Testnet `1952` is never sent to the Mainnet-only simulation endpoint.

## Architecture

```mermaid
flowchart TD
    U[User transaction + optional intent] --> D[Deterministic decoder and rules]
    D --> R[X Layer RPC intelligence and preflight]
    R --> O{Mainnet 196?}
    O -->|yes| S[OKX read-only simulation]
    O -->|no: Testnet 1952| E[Normalized evidence]
    S --> E
    E --> C[Consequences + confidence + verdict]
    E --> A[One optional AI advisory call]
    C --> F[Deterministic safety invariant]
    A --> F
    F --> V[Final assessment]
    V --> P[Versioned Analysis Receipt]
    P --> K[xguard-c14n-v1]
    K --> Z[SHA-256 fingerprint]
    Z --> T[Ed25519 deployment attestation]
    T --> X[Export / Verify / API]
    V --> H[Human decision]
    H --> Q[Optional existing Testnet RiskRegistry]
```

`lib/analyze-pipeline.ts` owns evidence-first orchestration. `lib/evidence.ts` creates a bounded, normalized evidence object before `lib/ai/provider.ts` is called. The provider adapter is configured only on the server through `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`; the public client does not expose or prove the upstream provider identity.

`lib/analysis-receipt.ts` is the shared server/browser implementation for receipt construction, strict validation, canonicalization, fingerprinting, and local verification. Integrity verification confirms content consistency only; it does not prove safety or XGuard authorship.

`lib/analysis-attestation.ts` validates packages and verifies signatures against the deployment trust root. Server-only signing derives the public SPKI key from one configured PKCS#8 private key. Attestation verification confirms deployment-key authenticity of a receipt fingerprint, not transaction safety, provider truth, finality, on-chain anchoring, or legal identity.

## X Layer integration

| Analysis network | Chain ID | RPC | OKX Transaction Simulation |
| --- | ---: | --- | --- |
| X Layer Testnet | `1952` | `https://testrpc.xlayer.tech/terigon` | Unsupported; never called |
| X Layer Mainnet | `196` | `https://rpc.xlayer.tech` | V4 Preview, `chainIndex: "196"` |

RPC checks are isolated and timeout-bounded:

- `eth_getCode` identifies EOA versus contract and reports bytecode size.
- `eth_getStorageAt` checks only the EIP-1967 implementation slot; it does not exclude every proxy type.
- `eth_call` records current-state success/revert evidence.
- `eth_estimateGas` reports an estimate when available.

These are bounded preflight checks, not an audit or full trace/state-diff guarantee.

## Verified on-chain evidence

- Network: X Layer Testnet (`1952`)
- RiskRegistry: [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- Deployment transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Verified user transaction: [`0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb)
- Receipt: success; `RiskAssessmentRecorded` emitted with score `12`

The deployed V1 contract holds no funds and creates no token. Contract V2 remains a proposal only; V4 deploys no contract and creates no transaction.

## Local development

```bash
pnpm install --frozen-lockfile
copy .env.example .env.local
pnpm run dev
```

Open `http://localhost:3000`. Without AI or OKX credentials, deterministic Local Analysis and the Testnet RPC path remain usable.

### Server-side configuration

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | AI provider key |
| `AI_BASE_URL` | OpenAI-compatible base URL |
| `AI_MODEL` | Provider model identifier |
| `XLAYER_RPC_URL` | Testnet RPC |
| `XLAYER_MAINNET_RPC_URL` | Mainnet RPC |
| `OKX_API_KEY` | OKX API key |
| `OKX_SECRET_KEY` | OKX signing secret |
| `OKX_API_PASSPHRASE` | OKX passphrase |
| `XGUARD_ATTESTATION_PRIVATE_KEY_PEM_B64` | Base64 of complete PKCS#8 Ed25519 private-key PEM file bytes; server-only |
| `XGUARD_ATTESTATION_KEY_ID` | Public bounded identifier for the deployment attestation key |
| `NEXT_PUBLIC_RISK_REGISTRY_ADDRESS` | Public deployed Testnet registry address |

`DEPLOYER_PRIVATE_KEY` is needed only for explicitly authorized contract deployment and must never be configured in the browser or committed. V4 does not use it.

## Verification

```bash
pnpm run build
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
pnpm run presentation:test
pnpm run receipt:test
pnpm run attestation:test
```

V6 preserves the complete V5 corpus and its exact receipt fingerprints, then adds ephemeral-key signing, strict binding, trusted-key verification, recomputed-fingerprint attack, failure-isolation, privacy, and trust-language coverage.

## Limitations

- Scores are heuristic severity, not calibrated fraud probabilities.
- RPC preflight and OKX simulation are current-state, bounded evidence—not proof of safety.
- Contract reputation and verified-source provenance are not yet integrated.
- AI and deterministic rules can miss malicious behavior or create false positives.
- This prototype has a basic in-memory API rate limit and no availability SLA.
- Receipt fingerprints provide content integrity only. Ed25519 attestations add deployment-key authenticity of the fingerprint, not provider authentication, transaction safety, finality, on-chain anchoring, or legal identity.

## Historical evidence note

The unchanged public video captures the earlier stable Production Judge path, including the historical Unlimited Approval result `72 HIGH`. It is retained as stable Production evidence, not as the current V4 Preview Judge semantics. The current Preview path uses selector-hardened Ambiguous Approval instead.

## License

Released under the [MIT License](LICENSE). Submission fields are in [docs/SUBMISSION.md](docs/SUBMISSION.md); contact email remains only in the official form.
