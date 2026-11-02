import { useEffect, useState } from "react";
export function useApi<T>(url: string | null) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const key = `${url}|${retry}`;
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.detail === "string"
              ? body.detail
              : `Could not load data (${response.status}).`,
          );
        }
        return response.json() as Promise<T>;
      })
      .then((data) => setResult({ key, data }))
      .catch((e) => {
        if (e.name !== "AbortError") setResult({ key, error: e.message });
      });
    return () => controller.abort();
  }, [url, retry]);
  // Compare the response identity during render, not just after an effect starts.
  // New settings can never relabel old results, including on failed requests.
  const current = url && result?.key === `${url}|${retry}` ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: !!url && !current,
    retry: () => setRetry((n) => n + 1),
  };
}
