export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: "production" | "development";
  EDITOR_ORIGIN?: string;
  PUBLIC_SHARE_ORIGIN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  GOOGLE_MAPS_BROWSER_KEY?: string;
  GOOGLE_MAPS_MAP_ID?: string;
  READ_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  CREATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
