const REQUEST_TIMEOUT_MS = 10_000;

export class HttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);

    this.name = "HttpError";
    this.status = status;
  }
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function requestJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { signal: withTimeout(signal) });

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  return response.json() as Promise<T>;
}
