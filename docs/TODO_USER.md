# Final Release Status

## V4 Preview credential handoff — pending

Phase A implementation and mock verification do not use real OKX credentials. After the V4 Preview and CI are ready, the project owner must add these three server-side variables in **Vercel → XGuard AI Project → Settings → Environment Variables**, scoped to **Preview** only:

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_API_PASSPHRASE`

Do not paste values into chat, Git, documentation, screenshots, or logs. After saving the Preview variables, confirm exactly: `V4 PREVIEW CREDENTIALS CONFIGURED`. A separate read-only live verification can then begin. Production must remain unchanged until that later verification and a separate release approval.

## Stable Production

- Final Judge Upgrade: merged to `main`
- Core application baseline: `409aa73c211a6b350af757d130c3f41ac8cfe962`
- Production: https://xguard-ai-six.vercel.app
- Historical pre-polish Production deployment: `dpl_KkyED1sN18hK4QXjzLZnuNYoeamC` (`Ready` at verification time)
- Main CI: passed — https://github.com/leafwithered/xguard-ai/actions/runs/32436406395
- Production smoke: Safe Transfer `8 LOW`, Unlimited Approval `72 HIGH`, Suspicious Airdrop `100 HIGH`
- Provider: Production Hybrid Analysis is verified through the server-configured, provider-neutral OpenAI-compatible adapter; public artifacts do not assert the upstream provider identity
- Contract: existing V1 `RiskRegistry` remains unchanged at `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- New contract deployment for Final Judge Upgrade: none
- New on-chain transaction for Final Judge Upgrade: none

## Submission status

- Already submitted by the project owner.
- No release action remains solely because a Git commit SHA, Preview URL, or transient Vercel deployment ID changes.

## V3.1.1 manual Preview gate

- Open the authenticated `v3-competition` Preview after the final V3.1.1 deployment.
- Verify Safe Transfer, Ambiguous Approval, and Suspicious Airdrop in that order.
- Confirm analysis runs, transaction edits invalidate stale results, layout/assets are intact, and no wallet request appears.
- Do not approve a merge until this manual gate passes.

## Possible follow-up

- Edit or resubmit only if a canonical link in the original submission is incorrect or the organizer explicitly requests an update. Contact email remains private and is provided only in the official form.

## Media status

- Final Judge Upgrade demo: completed at `demo/xguard-ai-build-x-demo.mp4` from verified Production screenshots.
- Current Production hero: completed at `docs/assets/xguard-v2-hero.png` with Judge Mode visible.
- No manual media capture, wallet connection, signature, contract deployment, or new chain transaction remains required.
