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
  total_edits: number;
  trends: TrendPoint[];
  top_articles: TopArticle[];
  top_geo: TopGeoPlace[];
};

export type GetDashboardParams = {
  period: string;
  top: number;
};

export async function getDashboard(
  params: GetDashboardParams,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const query = new URLSearchParams({
    period: params.period,
    top: String(params.top),
  });

  const response = await fetch(`/api/v1/dashboard?${query}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard: ${response.status}`);
  }

  return response.json() as Promise<DashboardResponse>;
}
