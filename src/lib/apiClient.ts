export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch(input: RequestInfo | URL, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30000, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...requestInit, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export default apiFetch;
