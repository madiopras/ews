"""SSE serialization kept outside planner generation use cases."""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass
class PlannerStreamMetrics:
    response_payload_bytes: int = 0
    sse_event_count: int = 0


def encode_sse_event(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def encode_sse_stream(
    events: AsyncIterator[dict], metrics: PlannerStreamMetrics
) -> AsyncIterator[str]:
    async for event in events:
        chunk = encode_sse_event(event)
        metrics.response_payload_bytes += len(chunk.encode("utf-8"))
        metrics.sse_event_count += 1
        yield chunk
