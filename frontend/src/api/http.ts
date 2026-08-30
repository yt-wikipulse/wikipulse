/**
 * Верхняя граница ожидания ответа. Без неё зависший запрос оставлял бы экран
 * в загрузке навсегда: fetch сам не прерывается.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Ошибка HTTP со статусом. Нужна, чтобы вызывающая сторона могла отличить
 * 404 от 503: от обычного Error остаётся только строка.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);

    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * Складывает таймаут с сигналом отмены вызывающего кода, поэтому
 * размонтирование компонента по-прежнему обрывает запрос.
 */
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
