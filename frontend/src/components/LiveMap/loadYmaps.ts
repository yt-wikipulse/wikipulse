const API_URL = "https://api-maps.yandex.ru/v3/";

let loading: Promise<void> | null = null;

export function readApiKey(raw: string | undefined): string {
  const key = (raw ?? "").trim();

  if (!key) {
    throw new Error("VITE_YMAPS_API_KEY не задан");
  }

  return key;
}

export function loadYmaps(): Promise<void> {
  if (loading) {
    return loading;
  }

  loading = new Promise<void>((resolve, reject) => {
    const key = readApiKey(import.meta.env.VITE_YMAPS_API_KEY);

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
