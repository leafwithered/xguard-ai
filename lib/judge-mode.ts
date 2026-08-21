export type JudgeModeState = {
  open: boolean;
  revealRequest: number;
};

export type JudgeModeAction = { type: "OPEN" } | { type: "CLOSE" };

export const initialJudgeModeState: JudgeModeState = { open: false, revealRequest: 0 };

export function reduceJudgeMode(state: JudgeModeState, action: JudgeModeAction): JudgeModeState {
  if (action.type === "OPEN") return { open: true, revealRequest: state.revealRequest + 1 };
  return { ...state, open: false };
}
