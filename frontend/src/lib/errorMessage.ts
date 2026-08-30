import { HttpError } from "../api/http";

const TIMEOUT_MESSAGE = "Сервер не ответил вовремя";

/**
 * Текст ошибки для пользователя. HTTP-статус показывается намеренно:
 * аудитория примера — инженеры, которые запускают его у себя, и «сервер
 * ответил 503» экономит им открытие devtools. Таймаут получает отдельный
 * текст: это единственная ошибка, где виноват не сервер, а сеть.
 */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return `${fallback}: сервер ответил ${error.status}`;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return TIMEOUT_MESSAGE;
  }

  return fallback;
}
