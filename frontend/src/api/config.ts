export type ConfigResponse = {
  ymaps_api_key: string;
};

export async function getConfig(
  signal?: AbortSignal,
): Promise<ConfigResponse> {
  const response = await fetch("/api/v1/config", { signal });

  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }

  return response.json() as Promise<ConfigResponse>;
}
