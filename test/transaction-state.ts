import { expect } from "chai";
import { initialRecordState, isRecordPending, reduceRecordState } from "../lib/transaction-state.ts";

describe("On-chain confirmation state", function () {
  it("does not report success before a successful receipt", function () {
    const hash = `0x${"1".repeat(64)}` as const;
    const awaiting = reduceRecordState(initialRecordState, { type: "SIGNATURE_REQUESTED" });
    const submitted = reduceRecordState(awaiting, { type: "SUBMITTED", hash });
    const confirming = reduceRecordState(submitted, { type: "CONFIRMING" });
    expect(awaiting.phase).to.equal("awaiting-signature");
    expect(submitted.phase).to.equal("submitted");
    expect(confirming.phase).to.equal("confirming");
    expect(isRecordPending(confirming)).to.equal(true);
    expect(reduceRecordState(confirming, { type: "CONFIRMED" }).phase).to.equal("confirmed");
    expect(reduceRecordState(confirming, { type: "REVERTED" }).phase).to.equal("reverted");
  });
});
