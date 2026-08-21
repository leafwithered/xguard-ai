# Final Release Status

## V4 Preview credential handoff — completed

The project owner configured these three server-side variables in **Vercel → XGuard AI Project → Settings → Environment Variables**, scoped to **Preview** only:

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_API_PASSPHRASE`

The `V4 PREVIEW CREDENTIALS CONFIGURED` gate was confirmed. Four bounded real read-only X Layer Mainnet samples returned provider HTTP `200`, business code `0`, and normalized status `AVAILABLE`; sanitized evidence is recorded in `docs/V4_OKX_SIMULATION.md`. No values were copied into chat, Git, documentation, screenshots, or logs. Production remains unchanged and requires a separate explicit release approval.

## Stable Production

- V3 Stable: merged to `main` and frozen
- Stable checkpoint: `04575cc764163c7cb99b948c050e974e4cd20a2e` / tag `v3.1.1-stable`
- Production: https://xguard-ai-six.vercel.app
- Historical pre-polish Production deployment: `dpl_KkyED1sN18hK4QXjzLZnuNYoeamC` (`Ready` at verification time)
- Main CI: passed — https://github.com/leafwithered/xguard-ai/actions/runs/32436406395
- Stable Judge semantics: Safe Transfer `8 LOW`, Ambiguous Approval deterministic `20 LOW / LOW confidence / UNDETERMINED`, Suspicious Airdrop deterministic `78 HIGH / MISMATCH`
- Provider: Production Hybrid Analysis is verified through the server-configured, provider-neutral OpenAI-compatible adapter; public artifacts do not assert the upstream provider identity
- Contract: existing V1 `RiskRegistry` remains unchanged at `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- New contract deployment for Final Judge Upgrade: none
- New on-chain transaction for Final Judge Upgrade: none

## Submission status

- Already submitted by the project owner.
- No release action remains solely because a Git commit SHA, Preview URL, or transient Vercel deployment ID changes.

## V4.1 manual Preview gate

- Open the authenticated `codex/v4-okx-simulation` Preview after the V4.1 deployment.
- Verify Safe Transfer, Ambiguous Approval, Suspicious Airdrop, Live OKX Mainnet Simulation, and the existing receipt in that order.
- Confirm Final Risk and Deterministic Known Risk remain separate, the Live Provider badge appears only on a successful real Mainnet provider response, transaction edits invalidate stale results, layout/assets are intact, and no wallet request appears.
- Do not approve a merge until this manual gate passes.

## Possible follow-up

- Edit or resubmit only if a canonical link in the original submission is incorrect or the organizer explicitly requests an update. Contact email remains private and is provided only in the official form.

## Media status

- Final Judge Upgrade demo: completed at `demo/xguard-ai-build-x-demo.mp4` from verified Production screenshots.
- Current Production hero: completed at `docs/assets/xguard-v2-hero.png` with Judge Mode visible.
- No manual media capture, wallet connection, signature, contract deployment, or new chain transaction remains required.
