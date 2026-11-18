import { Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiLink, TuiLoader, TuiNotification } from '@taiga-ui/core';
import { TuiPagination } from '@taiga-ui/kit';
import { FlagsApiService } from '../../../core/api/flags-api.service';

const FIELD_LABELS = new Map([
  ['created', 'Флаг создан'],
  ['name', 'Название'],
  ['description', 'Описание'],
  ['enabled', 'Статус'],
  ['rolloutPercentage', 'Rollout'],
]);
const PAGE_SIZE = 20;

@Component({
  imports: [
    RouterLink,
    TuiButton,
    TuiLink,
    TuiLoader,
    TuiNotification,
    TuiPagination,
    TuiTable,
  ],
  selector: 'app-flag-history',
  styleUrl: './flag-history.css',
  templateUrl: './flag-history.html',
})
export class FlagHistory {
  private readonly api = inject(FlagsApiService);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, {
    requireSync: true,
  });
  private readonly id = computed(() => this.routeParams().get('id'));
  private readonly dateTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  protected readonly page = linkedSignal({
    source: this.id,
    computation: () => 1,
  });
  protected readonly history = rxResource({
    params: () => {
      const id = this.id();
      return id ? { id, page: this.page() } : undefined;
    },
    stream: ({ params }) => this.api.history(params.id, params.page, PAGE_SIZE),
  });
  protected readonly pageCount = computed(() => {
    if (!this.history.hasValue()) {
      return 1;
    }
    const { totalCount, pageSize } = this.history.value();
    return Math.max(1, Math.ceil(totalCount / pageSize));
  });

  protected readonly events = computed(() =>
    this.history.hasValue()
      ? this.history.value().items.map((event) => ({
          ...event,
          label: FIELD_LABELS.get(event.field) ?? event.field,
          localDateTime: this.dateTime.format(new Date(event.changedAtUtc)),
        }))
      : [],
  );

  protected changePage(page: number): void {
    if (
      this.history.hasValue() &&
      !this.history.isLoading() &&
      page >= 1 &&
      page <= this.pageCount()
    ) {
      this.page.set(page);
    }
  }
}
