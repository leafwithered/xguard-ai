# XGuard X Layer Mainnet Receipt Anchor

The anchor adds one narrow X Layer-native claim to the existing trust pipeline:

`Evidence → Receipt Integrity → Deployment-key Authenticity → Deterministic Policy → X Layer Mainnet Receipt Anchor`

## Exact digest semantics

The contract anchors the existing V5 Analysis Receipt SHA-256 digest. For a fingerprint `sha256:<64 lowercase hex characters>`, XGuard removes only the literal `sha256:` prefix and interprets the remaining 64 hex characters directly as Solidity `bytes32`.

No second hash is applied. The fingerprint string is not hashed. SHA-256 is not replaced by keccak256. [`receiptFingerprintToBytes32`](../lib/anchor.ts) requires the exact lowercase format and fails closed.

## Contract

[`XGuardReceiptAnchor.sol`](../contracts/XGuardReceiptAnchor.sol) contains only:

- `mapping(bytes32 => bool) public anchored`
- `anchor(bytes32 receiptDigest)`
- `ReceiptAnchored(receiptDigest, submitter, timestamp)`

Zero digest reverts. Duplicate explicit anchors remain safe: the mapping stays true and another event may be emitted. The contract does not establish receipt ownership.

It has no owner, admin, upgrade mechanism, custody, withdrawal, fee, arbitrary external call, delegatecall, selfdestruct, proxy, batching, or Merkle structure. It cannot receive OKB through the anchor function.

## Trust boundaries

`X LAYER ANCHOR CONFIRMED` proves only that a confirmed X Layer Mainnet transaction called the configured anchor contract with the exact V5 receipt digest.

It does not prove transaction safety, provider truth, execution of the analyzed transaction, address ownership, OKX endorsement, or XGuard authorship. V5 verifies receipt content integrity. V6 separately verifies XGuard deployment-key authorship. V7 policy remains an adjacent deterministic integration recommendation and is not cryptographically included in the anchor.

## Eligibility

The competition UI permits an anchor transaction only when all conditions hold:

1. A current Analysis Receipt exists on X Layer Mainnet, Chain 196.
2. Receipt Integrity is `INTEGRITY VERIFIED`.
3. XGuard Attestation is `ATTESTATION VERIFIED` and binds the same fingerprint.
4. The fingerprint parses to a non-zero exact SHA-256 `bytes32` digest.
5. A real anchor contract address is configured.

Policy does not determine eligibility. `BLOCK_RECOMMENDED` evidence may still be anchored because anchoring records evidence rather than endorsing a transaction.

## Verification and wallet flow

`Verify On-chain Anchor` is an explicit read-only action using public X Layer Mainnet RPC. A true `anchored(digest)` result becomes `CONFIRMED`; false becomes `NOT_ANCHORED`; RPC errors become `UNAVAILABLE`/`FAILED`, never a false negative.

The transaction path requires separate explicit actions: Connect Wallet, Switch wallet to X Layer Mainnet, and Anchor Receipt. Initial render, refresh, Judge navigation, eligibility, and read-only verification never request wallet accounts, network switching, signing, or broadcasting.

## Live Mainnet proof

- Chain: X Layer Mainnet `196`
- Contract: [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- Deployment transaction: [`0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb`](https://www.okx.com/web3/explorer/xlayer/tx/0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb)
- First anchor transaction: [`0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347`](https://www.okx.com/web3/explorer/xlayer/tx/0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347)
- Receipt digest: `0xef6cf319eb689233180f465d331969c91a9c5c07d893047294bdda5de0da0eab`
- Read-only result: `anchored(bytes32) = true`

Both configured RPC endpoints report Chain ID `196`. The deployment and first anchor receipts have successful status, the anchor call contains the exact digest with zero value, and the deployed executable bytecode matches the reviewed artifact when compiler metadata is excluded.

The application configures only this real public address. Missing, malformed, and zero-address configuration paths remain fail-closed in the shared client boundary. The known first proof transaction is shown only when its exact digest is verified; other receipt digests are never associated with that transaction.
