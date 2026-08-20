# User Actions Required — V2

The Hackathon V1 submission, public links, contract, verified transaction, and third-party Production AI provider remain unchanged.

1. **Official OpenAI Preview secret** — After the V2 Preview exists, add a user-owned official OpenAI API key only to the Vercel Preview environment. Never send it in chat. Set `AI_API_KEY`, `AI_BASE_URL=https://api.openai.com`, and the documented Responses-compatible `AI_MODEL` selected during migration verification.
2. **Production promotion approval** — Promote or merge V2 only after Preview QA and official API smoke tests pass. Production must continue using the current verified third-party provider until then.
3. **Optional YouTube mirror** — The public GitHub MP4 remains the canonical fallback; a YouTube Unlisted mirror is optional.

No wallet signature, contract deployment, mainnet action, or new on-chain transaction is required for V2 code QA.
