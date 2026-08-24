export const DEFAULT_ADMIN_PAGE_SIZE = 25;
export const ADMIN_PAGE_SIZES = [10, 25, 50];

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readAdminListParams(searchParams, options = {}) {
  const {
    defaultPageSize = DEFAULT_ADMIN_PAGE_SIZE,
    pageSizes = ADMIN_PAGE_SIZES,
    defaultSort = "-created_at",
    allowedSorts = [],
    filterKeys = [],
  } = options;
  const requestedSize = positiveInteger(searchParams.get("page_size"), defaultPageSize);
  const pageSize = pageSizes.includes(requestedSize) ? requestedSize : defaultPageSize;
  const filters = filterKeys.reduce((result, key) => {
    const value = searchParams.get(key);
    if (value != null && value !== "") result[key] = value;
    return result;
  }, {});

  const requestedSort = searchParams.get("sort") || defaultSort;
  const sort = allowedSorts.length === 0 || allowedSorts.includes(requestedSort)
    ? requestedSort
    : defaultSort;

  return {
    q: (searchParams.get("q") || "").trim(),
    page: positiveInteger(searchParams.get("page"), 1),
    page_size: pageSize,
    sort,
    ...filters,
  };
}

export function updateAdminSearchParams(currentParams, patch, options = {}) {
  const { resetPage = true } = options;
  const next = new URLSearchParams(currentParams);
  let listStateChanged = false;

  Object.entries(patch).forEach(([key, value]) => {
    if (key !== "page") listStateChanged = true;
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      next.delete(key);
      return;
    }
    next.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });

  if (resetPage && listStateChanged && !("page" in patch)) next.set("page", "1");
  return next;
}

export function toAdminApiParams(params) {
  return Object.entries(params).reduce((result, [key, value]) => {
    if (value != null && value !== "") result[key] = value;
    return result;
  }, {});
}
