import React from "react";
import { PLANNER_RESULT_FORMAT, selectPlannerResultMode } from "../../lib/plannerResultContract.js";

export default function PlannerResultGate({ features, result, renderStructured, children }) {
  const mode = selectPlannerResultMode(features, result);
  if (mode === PLANNER_RESULT_FORMAT.STRUCTURED && typeof renderStructured === "function") {
    return <div className="contents" data-planner-result-mode="structured">{renderStructured(result)}</div>;
  }
  return <div className="contents" data-planner-result-mode="legacy">{children}</div>;
}
