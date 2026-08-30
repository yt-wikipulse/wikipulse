import { requestJson } from "./http";

export type ConfigResponse = {
  ymaps_api_key: string;
};

export function getConfig(signal?: AbortSignal): Promise<ConfigResponse> {
  return requestJson<ConfigResponse>("/api/v1/config", signal);
}
