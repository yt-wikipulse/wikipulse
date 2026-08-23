const API_URL = "https://api-maps.yandex.ru/v3/";

let loading: Promise<void> | null = null;

export function readApiKeys(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export function pickApiKey(keys: string[], random: number): string {
  if (keys.length === 0) {
    throw new Error("VITE_YMAPS_API_KEY не задан");
  }

  return keys[Math.min(Math.floor(random * keys.length), keys.length - 1)];
}

export function loadYmaps(): Promise<void> {
  if (loading) {
    return loading;
  }

  loading = new Promise<void>((resolve, reject) => {
    const key = pickApiKey(
      readApiKeys(import.meta.env.VITE_YMAPS_API_KEY),
      Math.random(),
    );

    const script = document.createElement("script");

    script.src = `${API_URL}?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Не удалось загрузить API Яндекс Карт"));
    };

    document.head.append(script);
  }).then(() => ymaps3.ready);

  return loading;
}
