import { requestJson } from "./http";

export type TrendPoint = {
  bucket_ts: number;
  edits_count: number;
};

export type TopArticle = {
  title: string;
  url: string;
  edits_count: number;
};

export type TopGeoPlace = {
  h3_parent: string;
  top_title: string;
  top_url: string;
  edits_count: number;
  articles_count: number;
};

export type DashboardResponse = {
  period: string;
  generated_at: number;
  bucket_seconds: number;
  total_edits: number;
  trends: TrendPoint[];
  top_articles: TopArticle[];
  top_geo: TopGeoPlace[];
};

export type GetDashboardParams = {
  period: string;
  limit: number;
};

export function getDashboard(
  params: GetDashboardParams,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const query = new URLSearchParams({
    period: params.period,
    limit: String(params.limit),
  });

  return requestJson<DashboardResponse>(
    `/api/v1/dashboard?${query}`,
    signal,
  );
}
