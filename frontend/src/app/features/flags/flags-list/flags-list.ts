import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  rxResource,
  takeUntilDestroyed,
  toSignal,
} from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiTable } from '@taiga-ui/addon-table';
import {
  TuiButton,
  TuiInput,
  TuiLink,
  TuiLoader,
  TuiNotification,
} from '@taiga-ui/core';
import {
  TuiChevron,
  TuiLineClamp,
  TuiPagination,
  TuiSelect,
  TuiSwitch,
} from '@taiga-ui/kit';
import { finalize, tap } from 'rxjs';
import { FlagsApiService } from '../../../core/api/flags-api.service';
import {
  FLAG_ENVIRONMENTS,
  FlagEnvironment,
  FlagListItem,
  PageResponse,
} from '../../../core/models/flag.model';

const PAGE_SIZE = 20;
const STATUS_FILTERS = {
  'Все статусы': undefined,
  Включённые: true,
  Выключенные: false,
} as const;

function lastPage(result: PageResponse<FlagListItem>): number {
  return Math.max(1, Math.ceil(result.totalCount / result.pageSize));
}

@Component({
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TuiButton,
    TuiLink,
    TuiSwitch,
    TuiInput,
    TuiChevron,
    TuiLineClamp,
    TuiLoader,
    TuiNotification,
    TuiPagination,
    TuiSelect,
    TuiTable,
  ],
  selector: 'app-flags-list',
  styleUrl: './flags-list.css',
  templateUrl: './flags-list.html',
})
export class FlagsList {
  private readonly api = inject(FlagsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    requireSync: true,
  });
  private readonly refresh = signal(0);

  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly notice = signal<
    { message: string; error: boolean } | undefined
  >(undefined);

  protected readonly environments = FLAG_ENVIRONMENTS;
  protected readonly environment = computed(() => {
    const selected = this.queryParams().get('environment');
    return (
      this.environments.find((environment) => environment === selected) ??
      'Development'
    );
  });
  protected readonly search = signal('');
  protected readonly statuses = Object.keys(STATUS_FILTERS);
  protected readonly status =
    signal<keyof typeof STATUS_FILTERS>('Все статусы');
  protected readonly enabled = computed(() => STATUS_FILTERS[this.status()]);

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
      refresh: this.refresh(),
    }),
    stream: ({ params }) =>
      this.api.list(params).pipe(
        tap((result) => {
          const last = lastPage(result);
          if (params.page > last) {
            this.page.set(last);
          }
        }),
      ),
  });
  protected readonly pageCount = computed(() =>
    this.flags.hasValue() ? lastPage(this.flags.value()) : 1,
  );

  protected flagKey(flag: FlagListItem): string {
    return `${flag.environment}/${flag.id}`;
  }

  protected changeEnvironment(environment: FlagEnvironment): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { environment },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

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

  protected toggleFlag(event: Event, flag: FlagListItem): void {
    // Keep the checkbox on the confirmed value until the server returns fresh data.
    event.preventDefault();
    const key = this.flagKey(flag);
    if (this.flags.isLoading() || this.saving().has(key)) {
      return;
    }

    this.saving.update((pending) => new Set([...pending, key]));
    this.notice.set(undefined);
    this.api
      .setEnabled(flag.id, flag.environment, !flag.enabled)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() =>
          this.saving.update((pending) => {
            const remaining = new Set(pending);
            remaining.delete(key);
            return remaining;
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.notice.set({
            message: `Статус флага «${flag.name}» в ${flag.environment} обновлён.`,
            error: false,
          });
          if (this.environment() === flag.environment && !this.flags.reload()) {
            // A GET already in flight may have read the old status.
            this.refresh.update((version) => version + 1);
          }
        },
        error: () =>
          this.notice.set({
            message: `Не удалось обновить статус флага «${flag.name}» в ${flag.environment}. Попробуйте ещё раз.`,
            error: true,
          }),
      });
  }
}
