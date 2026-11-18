export type FlagEnvironment = 'Development' | 'Staging' | 'Production';

export interface FlagListQuery {
  environment: FlagEnvironment;
  search: string;
  enabled: boolean | undefined;
  page: number;
  pageSize: number;
}

export interface FlagEnvironmentSettings {
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercentage: number;
  updatedAtUtc: string;
}

export interface FlagListItem extends FlagEnvironmentSettings {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface FlagResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  environments: FlagEnvironmentSettings[];
}

export interface PageResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
