import { isPlannerResultV2, PLANNER_RESULT_FORMAT } from "./plannerResultContract.js";

const PROGRESS_PHASES = new Set(["generating", "validating", "hydrating"]);

export function createPlannerStreamState() {
  return {
    output: "",
    recommendations: [],
    destinationIds: [],
    result: null,
    resultFormat: PLANNER_RESULT_FORMAT.LEGACY,
    progressPhase: "generating",
    completed: false,
    error: "",
    errorCode: "",
  };
}

export function applyPlannerStreamEvent(state, event) {
  const next = { ...state };
  if (!event || typeof event !== "object" || Array.isArray(event)) return next;
  if (typeof event.text === "string") next.output += event.text;
  if (Array.isArray(event.recommendations)) next.recommendations = event.recommendations;
  if (Array.isArray(event.destination_ids)) next.destinationIds = event.destination_ids;
  if (PROGRESS_PHASES.has(event.progress?.phase)) next.progressPhase = event.progress.phase;
  if (isPlannerResultV2(event.result)) {
    next.result = event.result;
    next.resultFormat = PLANNER_RESULT_FORMAT.STRUCTURED;
  } else if (event.result_format === PLANNER_RESULT_FORMAT.LEGACY) {
    next.result = null;
    next.resultFormat = PLANNER_RESULT_FORMAT.LEGACY;
  }
  if (event.done === true) next.completed = true;
  if (typeof event.error === "string") next.error = event.error;
  if (typeof event.code === "string") next.errorCode = event.code;
  return next;
}

function parseSseBlock(block) {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export async function consumePlannerSseStream(readable, onEvent) {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  let eventCount = 0;

  const drain = (final = false) => {
    buffer = buffer.replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = final ? "" : (blocks.pop() || "");
    if (final && blocks.length === 0 && buffer) blocks.push(buffer);
    for (const block of blocks) {
      const event = parseSseBlock(block.trim());
      if (!event) continue;
      eventCount += 1;
      if (event.done === true) completed = true;
      onEvent(event);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain(false);
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const finalBlock = buffer.replaceAll("\r\n", "\n").trim();
      buffer = "";
      const event = parseSseBlock(finalBlock);
      if (event) {
        eventCount += 1;
        if (event.done === true) completed = true;
        onEvent(event);
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return { completed, eventCount };
}
