import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  CreateFlagRequest,
  FlagEnvironment,
  FlagListItem,
  FlagListQuery,
  FlagResponse,
  PageResponse,
  UpdateFlagRequest,
} from '../models/flag.model';

@Service()
export class FlagsApiService {
  private readonly http = inject(HttpClient);

  list({ environment, search, enabled, page, pageSize }: FlagListQuery) {
    return this.http.get<PageResponse<FlagListItem>>('/api/flags', {
      params: {
        environment,
        page,
        pageSize,
        ...(search ? { search } : {}),
        ...(enabled === undefined ? {} : { enabled }),
      },
    });
  }

  get(id: string) {
    return this.http.get<FlagResponse>(`/api/flags/${encodeURIComponent(id)}`);
  }

  create(request: CreateFlagRequest) {
    return this.http.post<FlagResponse>('/api/flags', request);
  }

  update(id: string, request: UpdateFlagRequest) {
    return this.http.patch<FlagResponse>(
      `/api/flags/${encodeURIComponent(id)}`,
      request,
    );
  }

  setEnabled(id: string, environment: FlagEnvironment, enabled: boolean) {
    return this.update(id, { environment, enabled });
  }
}
