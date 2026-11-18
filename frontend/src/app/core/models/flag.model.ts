export const FLAG_ENVIRONMENTS = [
  'Development',
  'Staging',
  'Production',
] as const;
export type FlagEnvironment = (typeof FLAG_ENVIRONMENTS)[number];

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
