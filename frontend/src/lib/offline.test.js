import {
  cacheGet,
  clearPrivateCache,
  clearAccountSession,
  privateCacheGet,
  privateCacheSet,
} from "./offline.js";

describe("private offline cache", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  test("isolates data by user id", () => {
    privateCacheSet("user-a", "wishlist", [{ id: "a" }]);
    privateCacheSet("user-b", "wishlist", [{ id: "b" }]);

    expect(privateCacheGet("user-a", "wishlist").data).toEqual([{ id: "a" }]);
    expect(privateCacheGet("user-b", "wishlist").data).toEqual([{ id: "b" }]);
    expect(cacheGet("wishlist")).toBeNull();
  });

  test("logout cleanup only removes the current user scope", () => {
    privateCacheSet("user-a", "wishlist", [{ id: "a" }]);
    privateCacheSet("user-b", "wishlist", [{ id: "b" }]);

    clearPrivateCache("user-a");

    expect(privateCacheGet("user-a", "wishlist")).toBeNull();
    expect(privateCacheGet("user-b", "wishlist").data).toEqual([{ id: "b" }]);
  });

  test("account switching clears private caches and sensitive session continuity", () => {
    privateCacheSet("user-a", "trip_workspace", [{ id: "private-a" }]);
    privateCacheSet("user-b", "trip_workspace", [{ id: "private-b" }]);
    sessionStorage.setItem("planner_draft_v2", "private planner output");
    sessionStorage.setItem("auth_next", "/saved/trips/private-a");
    sessionStorage.setItem("ews.analytics-session.v1", "anonymous-linkable-session");

    clearAccountSession("user-a");

    expect(privateCacheGet("user-a", "trip_workspace")).toBeNull();
    expect(privateCacheGet("user-b", "trip_workspace").data).toEqual([{ id: "private-b" }]);
    expect(sessionStorage.getItem("planner_draft_v2")).toBeNull();
    expect(sessionStorage.getItem("auth_next")).toBeNull();
    expect(sessionStorage.getItem("ews.analytics-session.v1")).toBeNull();
  });
});
