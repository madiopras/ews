import {
  readAdminListParams,
  toAdminApiParams,
  updateAdminSearchParams,
} from "./adminQueryParams.js";

describe("admin list query params", () => {
  test("normalizes pagination, sort, search, and configured filters", () => {
    const params = new URLSearchParams("q=%20toba%20&page=2&page_size=50&sort=name&status=active&ignored=value");
    expect(readAdminListParams(params, { filterKeys: ["status"] })).toEqual({
      q: "toba",
      page: 2,
      page_size: 50,
      sort: "name",
      status: "active",
    });
  });

  test("falls back from invalid page values", () => {
    const params = new URLSearchParams("page=-5&page_size=999&sort=unsafe_field");
    expect(readAdminListParams(params, { allowedSorts: ["name", "-name"] })).toMatchObject({ page: 1, page_size: 25, sort: "-created_at" });
  });

  test("resets page when search or filters change", () => {
    const current = new URLSearchParams("q=old&page=8&status=active");
    const next = updateAdminSearchParams(current, { q: "new", status: "" });
    expect(next.get("q")).toBe("new");
    expect(next.get("page")).toBe("1");
    expect(next.has("status")).toBe(false);
  });

  test("keeps explicit page navigation and strips empty API values", () => {
    const current = new URLSearchParams("q=toba&page=1");
    const next = updateAdminSearchParams(current, { page: 3 });
    expect(next.get("page")).toBe("3");
    expect(toAdminApiParams({ q: "", page: 3, status: null, sort: "name" })).toEqual({ page: 3, sort: "name" });
  });
});
