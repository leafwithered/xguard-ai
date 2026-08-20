# User Actions Required

These steps require your own account, wallet, signature, secret, CAPTCHA, or external authorization. Do not send private keys, seed phrases, or API keys in chat.

1. **Configure optional third-party AI** — In `.env.local` set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` locally if AI Analysis is desired. Never share them in chat.
2. **Wallet record flow** — Connect the wallet, switch to X Layer Testnet, review the result, and personally approve the `Record on X Layer` transaction. Never delegate the signature.
3. **Publish externally** — Connect GitHub/Vercel, create the independent project X account, publish the app/repository and an X post mentioning `@XLayerOfficial`, then enter only real URLs in `docs/SUBMISSION.md` and the official form.

## Autonomous work completed

- Final localhost API and UI QA completed without wallet connection or external credentials.
- Risk Engine tests cover ordinary transfers, approvals, unlimited approvals, social-engineering context, malformed bodies, odd calldata, negative values, and non-finite values.
- AI adapter tests cover missing configuration, provider errors, unsupported Responses, Chat Completions success, and malformed output using only a local fake server.
- Contract compile/tests and deployment verification are complete; the verified testnet artifact is recorded in the public docs.

Current external evidence remains `TODO_USER`; nothing has been fabricated.
