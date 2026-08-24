import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { readAdminListParams, toAdminApiParams, updateAdminSearchParams } from "../lib/adminQueryParams.js";

export default function useAdminListParams(options = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readAdminListParams(searchParams, options);

  const setParams = useCallback((patch, updateOptions = {}) => {
    setSearchParams(
      (current) => updateAdminSearchParams(current, patch, updateOptions),
      { replace: updateOptions.replace ?? true },
    );
  }, [setSearchParams]);

  const resetParams = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return {
    params,
    apiParams: toAdminApiParams(params),
    searchParams,
    setParams,
    resetParams,
  };
}
