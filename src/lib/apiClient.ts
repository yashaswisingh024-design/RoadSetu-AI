import { auth } from './firebase';

export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch(input: RequestInfo | URL, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30000, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(requestInit.headers || {});
    const currentUser = auth?.currentUser;
    if (currentUser && !headers.has('Authorization')) {
      const token = await currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    return await fetch(input, {
      ...requestInit,
      headers,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export default apiFetch;
