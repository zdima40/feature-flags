import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiLink } from '@taiga-ui/core';
import { FlagsApiService } from '../../../core/api/flags-api.service';

const FIELD_LABELS = new Map([
  ['created', 'Флаг создан'],
  ['name', 'Название'],
  ['description', 'Описание'],
  ['enabled', 'Статус'],
  ['rolloutPercentage', 'Rollout'],
]);

@Component({
  imports: [RouterLink, TuiLink],
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
  private readonly history = rxResource({
    params: () => this.id() ?? undefined,
    stream: ({ params }) => this.api.history(params),
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
}
