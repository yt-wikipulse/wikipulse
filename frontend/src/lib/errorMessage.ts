import { HttpError } from "../api/http";

const TIMEOUT_MESSAGE = "Сервер не ответил вовремя";

export function describeError(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return `${fallback}: сервер ответил ${error.status}`;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return TIMEOUT_MESSAGE;
  }

  return fallback;
}
