import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { FlagListItem, PageResponse } from '../models/flag.model';

@Service()
export class FlagsApiService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<PageResponse<FlagListItem>>('/api/flags');
  }
}
