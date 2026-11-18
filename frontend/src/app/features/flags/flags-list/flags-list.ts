import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { FlagsApiService } from '../../../core/api/flags-api.service';
import { FlagEnvironment } from '../../../core/models/flag.model';

const PAGE_SIZE = 20;

@Component({
  imports: [DatePipe, TuiButton, TuiTextfield],
  selector: 'app-flags-list',
  styleUrl: './flags-list.css',
  templateUrl: './flags-list.html',
})
export class FlagsList {
  private readonly api = inject(FlagsApiService);

  protected readonly environments = [
    'Development',
    'Staging',
    'Production',
  ] as const;
  protected readonly environment = signal<FlagEnvironment>('Development');
  protected readonly search = signal('');
  protected readonly enabled = signal<boolean | undefined>(undefined);

  private readonly searchTerm = computed(() => this.search().trim());
  private readonly filters = computed(() => ({
    environment: this.environment(),
    search: this.searchTerm(),
    enabled: this.enabled(),
  }));

  protected readonly page = linkedSignal({
    source: this.filters,
    computation: () => 1,
  });
  protected readonly flags = rxResource({
    params: () => ({
      ...this.filters(),
      page: this.page(),
      pageSize: PAGE_SIZE,
    }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly pageCount = computed(() => {
    const total = this.flags.hasValue() ? this.flags.value().totalCount : 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  });

  protected changePage(page: number): void {
    if (
      this.flags.hasValue() &&
      !this.flags.isLoading() &&
      page >= 1 &&
      page <= this.pageCount()
    ) {
      this.page.set(page);
    }
  }
}
