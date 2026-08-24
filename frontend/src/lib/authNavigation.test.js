import { authUrl, localizedAuthError, resumeAuthIntent, safeNextPath } from "./authNavigation.js";

describe("safe auth navigation", () => {
  test("keeps an internal planner path", () => {
    expect(safeNextPath("/planner?dest=abc#result")).toBe("/planner?dest=abc#result");
  });

  test.each(["https://evil.example", "//evil.example/path", "javascript:alert(1)", "/login"])(
    "rejects unsafe or looping destination %s",
    (value) => expect(safeNextPath(value)).toBe("/"),
  );

  test("builds an encoded auth URL with intent", () => {
    expect(authUrl("/login", "/planner?dest=1", "planner_generate")).toBe(
      "/login?next=%2Fplanner%3Fdest%3D1&intent=planner_generate",
    );
  });

  test("resumes wishlist and review intent after authentication", async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { ok: true } }) };
    await resumeAuthIntent("wishlist:destination-1", api);
    expect(api.post).toHaveBeenCalledWith("/wishlist/destination-1");
    await resumeAuthIntent("review:destination-2", api);
    expect(sessionStorage.getItem("pending_review_destination")).toBe("destination-2");
  });

  test("localizes known authentication failures without exposing backend copy", () => {
    const translations = { invalidCredentials: "Kredensial salah", genericError: "Gagal" };
    expect(localizedAuthError("Invalid email or password", translations)).toBe("Kredensial salah");
    expect(localizedAuthError("", translations)).toBe("Gagal");
  });
});
