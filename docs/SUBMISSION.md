# Build X Series Submission

- Project Name: `XGuard AI`
- Short Description: `Explainable pre-sign security for X Layer with deterministic safety rules, real RPC intelligence, and provider-neutral AI enrichment.`
- Website: `https://xguard-ai-six.vercel.app`
- GitHub: `https://github.com/leafwithered/xguard-ai`
- X Layer Network: `X Layer Testnet (Chain ID 1952)`
- Contract Address: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment Tx Hash: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Explorer Link: `https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- User Interaction Tx Hash: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- User Interaction Receipt: success (`0x1`)
- User Interaction Event: `RiskAssessmentRecorded`, risk score `12`
- User Interaction Explorer: `https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Demo Instructions: `docs/DEMO.md`
- Demo Video: `https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4` (updated Final Judge Upgrade walkthrough; 1920×1080 H.264, approximately 1:34, captured from Production)
- Project X Account: `https://x.com/AevrynHQ`
- X Post mentioning @XLayerOfficial: `https://x.com/AevrynHQ/status/2090382549205873099`
- Contact Email: `Provided in official submission`
- Telegram: `@hierarchleaf`

## Final Checks

- [x] Public app is reachable and Real AI Analysis has been smoke-tested.
- [x] GitHub repository is public.
- [x] `RiskRegistry` is deployed to X Layer Testnet.
- [x] Contract address and deployment transaction are verified in the explorer.
- [x] A real user-signed `recordAssessment` transaction is confirmed with a successful receipt and emitted event.
- [x] Project has an independent X account and its public profile URL is verified.
- [x] Project X post is publicly accessible and its thread includes `@XLayerOfficial`.
- [x] Final Judge Upgrade core application baseline `409aa73c211a6b350af757d130c3f41ac8cfe962` is deployed to the canonical Production URL and smoke-tested with Safe, Unlimited Approval, and Suspicious Airdrop presets.
- [x] Provider-backed Hybrid Analysis is verified in Production through the provider-neutral adapter; provider configuration and secrets are not exposed to the browser or repository.
- [x] Official submission was completed by the project owner.

## Current readiness

- Local MVP, Final Judge Upgrade presets, configurable AI adapter, deterministic Local Risk Engine floor, wallet/network UI, contract tests, and browser QA are complete.
- `RiskRegistry` is verified on X Layer Testnet; the real address, transaction hash, and explorer link are recorded above.
- A real user-signed `recordAssessment` interaction is confirmed on Chain ID `1952`; its receipt and `RiskAssessmentRecorded` event are publicly verifiable above.
- Website, GitHub, Production Hybrid Analysis, X account/post, contact details, public chain evidence, current hero screenshot, and Final Judge Upgrade demo video are ready. The project owner has already completed the official submission.
- Resubmission is not required solely because Git commit SHAs, Preview URLs, or transient Vercel deployment IDs change while the canonical public URLs remain stable. Edit or resubmit only if a canonical submitted link is incorrect or the organizer explicitly requests an update.

## V3 Preview candidate (not Production)

The `v3-competition` branch adds an evidence-first pipeline and independently reports known-risk severity, deterministic Analysis Confidence, Analysis Verdict, and current-state Execution Status. AI receives sanitized RPC/preflight facts before its one advisory call and cannot change factual evidence, confidence, verdict, execution status, or lower the deterministic safety floor. Unsupported or malformed calldata remains `LOW` confidence and `UNDETERMINED`; a LOW heuristic score is never presented as confirmation of safety. This candidate does not change the submitted Production URL, deployed RiskRegistry, or verified user transaction unless separately approved and merged.

## Final submission fields

- Project Name: `XGuard AI`
- Short Description: `Explainable pre-sign security for X Layer with deterministic safety rules, real RPC intelligence, and provider-neutral AI enrichment.`
- Long Description: `XGuard AI is an explainable pre-sign security layer that decodes EVM transaction intent, inspects real X Layer bytecode and the EIP-1967 implementation slot, and performs bounded eth_call plus eth_estimateGas preflight checks—not full state-diff simulation. It fuses RULE, DECODER, ON-CHAIN, and AI evidence into a transparent 0–100 result. Final Risk is the maximum of the deterministic safety floor and the AI assessment, so AI cannot weaken known signals. RPC or AI failure never disables Local Analysis. Users retain final control and may optionally record a compact RiskRegistry receipt on X Layer Testnet after explicit review.`
- Website URL: `https://xguard-ai-six.vercel.app`
- GitHub URL: `https://github.com/leafwithered/xguard-ai`
- X Layer Network: `X Layer Testnet`
- Chain ID: `1952`
- Contract Address: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Contract Explorer URL: `https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment Transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Verified User Transaction: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- User Transaction Explorer URL: `https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Demo Instructions: `docs/DEMO.md`
- Demo Video URL: `https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4`
- Project X Account: `https://x.com/AevrynHQ`
- X Post URL: `https://x.com/AevrynHQ/status/2090382549205873099`
- Contact Email: `Provided in official submission`
- Telegram: `@hierarchleaf`
