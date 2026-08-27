import { getConfig } from "../../api/config";

const API_URL = "https://api-maps.yandex.ru/v3/";

let loading: Promise<void> | null = null;

export function readApiKey(raw: string | undefined): string {
  const key = (raw ?? "").trim();

  if (!key) {
    throw new Error("Ключ Яндекс Карт не задан на бэкенде");
  }

  return key;
}

function appendScript(key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = `${API_URL}?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Не удалось загрузить API Яндекс Карт"));

    document.head.append(script);
  });
}

export function loadYmaps(): Promise<void> {
  if (loading) {
    return loading;
  }

  loading = (async () => {
    const config = await getConfig();

    await appendScript(readApiKey(config.ymaps_api_key));
    await ymaps3.ready;
  })().catch((error: unknown) => {
    loading = null;

    throw error;
  });

  return loading;
}
