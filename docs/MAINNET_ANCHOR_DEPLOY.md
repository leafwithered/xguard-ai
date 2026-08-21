# Human-Executed X Layer Mainnet Anchor Deployment Record

The deployment was completed manually by the user through a browser wallet. XGuard automation did not access a wallet secret, sign, or broadcast. Do not redeploy this contract as part of Phase B.

## Verified public record

- Contract: [`0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`](https://www.okx.com/web3/explorer/xlayer/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5)
- Deployment transaction: [`0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb`](https://www.okx.com/web3/explorer/xlayer/tx/0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb)
- Network: X Layer Mainnet, Chain ID `196`
- Receipt status: success
- Constructor arguments: none
- Value transferred: zero

## Review manifest

- Contract: `XGuardReceiptAnchor`
- Source: `contracts/XGuardReceiptAnchor.sol`
- Solidity: `0.8.24`
- EVM target: Paris
- Optimizer: enabled, `200` runs
- Constructor arguments: none
- Network: X Layer Mainnet
- Chain ID: `196` (`0xc4`)
- Currency: OKB
- Primary RPC: `https://rpc.xlayer.tech`
- Fallback RPC: `https://xlayerrpc.okx.com`
- Explorer: `https://www.okx.com/web3/explorer/xlayer`

The expected deployed behavior is limited to rejecting zero digests, setting `anchored[digest] = true`, and emitting `ReceiptAnchored(digest, msg.sender, block.timestamp)`. The contract has no owner or privileged control.

## Preserved deployment safety procedure

1. Review the exact committed source and compiled artifact locally.
2. Open the chosen audited browser deployment interface and select Solidity `0.8.24`, optimizer enabled, 200 runs, with no constructor arguments.
3. In OKX Wallet, explicitly select **X Layer Mainnet** and independently confirm Chain ID `196` before opening a signature request.
4. Compare the interface bytecode with the locally compiled deployment bytecode. Do not proceed if it differs.
5. Review the wallet gas estimate and total OKB cost. Stop if the network, bytecode, constructor, sender, or cost is unexpected.
6. Personally confirm the deployment transaction in the wallet.
7. After confirmation, record the public contract address and deployment transaction hash.
8. Open both on `https://www.okx.com/web3/explorer/xlayer` and verify Chain 196, successful status, deployed bytecode, and the expected sender.
9. Only after independent review, configure the real public address for the anchor branch and create a new Preview.

STOP immediately if the wallet displays any network other than X Layer Mainnet / Chain 196, requests value transfer, shows constructor data, or displays bytecode inconsistent with the compiled artifact.

The procedure is retained for auditability, not as authorization to deploy again. Phase B performs only read-only verification and public configuration of the already deployed address.
