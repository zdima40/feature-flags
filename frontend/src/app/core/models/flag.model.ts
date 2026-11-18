export type FlagEnvironment = 'Development' | 'Staging' | 'Production';

export interface FlagListQuery {
  environment: FlagEnvironment;
  search: string;
  enabled: boolean | undefined;
  page: number;
  pageSize: number;
}

export interface FlagListItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercentage: number;
  updatedAtUtc: string;
}

export interface PageResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
