const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;

const numberFormat = new Intl.NumberFormat("ru-RU");

export function formatEditAge(
  eventTs: number,
  nowSeconds: number,
): string {
  const age = nowSeconds - eventTs;

  if (age < MINUTE_SECONDS) {
    return "только что";
  }

  if (age < HOUR_SECONDS) {
    return `${Math.floor(age / MINUTE_SECONDS)} мин назад`;
  }

  return `${Math.floor(age / HOUR_SECONDS)} ч назад`;
}

export function formatSizeDelta(lengthUpdate: number): string {
  const sign = lengthUpdate < 0 ? "−" : "+";

  return `${sign}${numberFormat.format(Math.abs(lengthUpdate))} Б`;
}

export function pluralizeLines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return "строк";
  }

  if (mod10 === 1) {
    return "строка";
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return "строки";
  }

  return "строк";
}
