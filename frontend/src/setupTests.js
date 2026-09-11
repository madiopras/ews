import { TextDecoder, TextEncoder } from "util";

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
if (!window.requestAnimationFrame) window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
if (!window.cancelAnimationFrame) window.cancelAnimationFrame = (id) => window.clearTimeout(id);

// Mock Vercel Speed Insights for testing (using manual mock from __mocks__)
jest.mock("@vercel/speed-insights/react");

// Mock Vercel Analytics for testing (using manual mock from __mocks__)
jest.mock("@vercel/analytics/react");
