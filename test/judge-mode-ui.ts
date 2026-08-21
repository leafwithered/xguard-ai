import { expect } from "chai";
import { readFileSync } from "node:fs";
import { initialJudgeModeState, reduceJudgeMode } from "../lib/judge-mode.ts";

const pageSource = readFileSync("app/page.tsx", "utf8");

function sourceBetween(start: string, end: string) {
  return pageSource.slice(pageSource.indexOf(start), pageSource.indexOf(end, pageSource.indexOf(start)));
}

describe("Judge Mode mobile CTA", function () {
  it("is closed initially", function () {
    expect(initialJudgeModeState).to.deep.equal({ open: false, revealRequest: 0 });
    expect(pageSource).to.include("useReducer(reduceJudgeMode, initialJudgeModeState)");
  });

  it("opens Judge Mode explicitly", function () {
    expect(reduceJudgeMode(initialJudgeModeState, { type: "OPEN" })).to.deep.equal({ open: true, revealRequest: 1 });
    expect(pageSource).to.include('dispatchJudgeMode({ type: "OPEN" })');
  });

  it("renders the controlled judge-demo section when open", function () {
    expect(pageSource).to.include('judgeMode.open && <section className="judge-mode" id="judge-demo"');
    expect(pageSource).to.include('aria-controls="judge-demo"');
  });

  it("does not close when the CTA is activated again", function () {
    const open = reduceJudgeMode(initialJudgeModeState, { type: "OPEN" });
    expect(reduceJudgeMode(open, { type: "OPEN" })).to.deep.equal({ open: true, revealRequest: 2 });
  });

  it("closes only through the explicit Close action", function () {
    const open = reduceJudgeMode(initialJudgeModeState, { type: "OPEN" });
    expect(reduceJudgeMode(open, { type: "CLOSE" })).to.deep.equal({ open: false, revealRequest: 1 });
    expect(pageSource).to.include('onClick={() => dispatchJudgeMode({ type: "CLOSE" })}>Close');
  });

  it("uses native button activation for keyboard compatibility", function () {
    const heroActions = sourceBetween('<div className="hero-actions">', "</div></div>");
    expect(heroActions).to.include('<button className="judge-button"');
    expect(heroActions).to.include("onClick={openJudgeMode}");
    expect(heroActions).not.to.match(/onTouch|onMouse|hover/i);
  });

  it("uses the same platform-neutral path at mobile widths", function () {
    const openHandler = sourceBetween("function openJudgeMode", "useEffect(() => {");
    expect(openHandler).to.include('dispatchJudgeMode({ type: "OPEN" })');
    expect(openHandler).not.to.match(/touch|pointer|innerWidth|matchMedia/i);
  });

  it("reveals judge-demo only after the open state renders", function () {
    const revealEffect = sourceBetween("if (!judgeMode.open || judgeMode.revealRequest === 0)", "function applyConnectedWalletState");
    expect(revealEffect).to.include('document.getElementById("judge-demo")?.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(revealEffect).to.include("window.requestAnimationFrame");
    expect(revealEffect).to.include("window.cancelAnimationFrame");
  });

  it("opens with zero wallet, analysis or provider calls", function () {
    const openLifecycle = sourceBetween("function openJudgeMode", "function applyConnectedWalletState");
    expect(openLifecycle).not.to.match(/\.request\s*\(|fetch\s*\(|analyz|simulate|OKX|sign|record|broadcast|requestWalletConnection|readConnectedWalletState/i);
  });
});
