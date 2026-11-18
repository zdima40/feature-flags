import { HttpErrorResponse } from '@angular/common/http';
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
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  TuiButton,
  TuiError,
  tuiIconsProvider,
  TuiInput,
  TuiLink,
  TuiLoader,
  TuiNotification,
} from '@taiga-ui/core';
import { TuiInputNumber, TuiSwitch, TuiTabs, TuiTextarea } from '@taiga-ui/kit';
import { finalize, tap } from 'rxjs';
import { FlagsApiService } from '../../../core/api/flags-api.service';
import {
  FLAG_ENVIRONMENTS,
  FlagResponse,
} from '../../../core/models/flag.model';

const VALIDATION_ERRORS = new Map([
  ['key', 'form.errors.key'],
  ['name', 'form.errors.name'],
  ['environment', 'form.errors.environment'],
  ['enabled', 'form.errors.enabled'],
  ['rolloutPercentage', 'form.errors.rolloutPercentage'],
]);

function saveErrors(error: unknown, editing: boolean): string[] {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return ['form.errors.duplicate'];
    }
    if (error.status === 404) {
      return ['form.errors.notFound'];
    }
    const problem: unknown = error.error;
    if (error.status === 400 && problem && typeof problem === 'object') {
      if (
        'errors' in problem &&
        problem.errors &&
        typeof problem.errors === 'object'
      ) {
        const fields = Object.keys(problem.errors);
        if (fields.length) {
          return [
            ...new Set(
              fields.map((field) =>
                field === 'key' && editing
                  ? 'form.errors.immutableKey'
                  : (VALIDATION_ERRORS.get(field) ?? 'form.errors.checkFields'),
              ),
            ),
          ];
        }
      }
    }
  }
  return ['form.errors.save'];
}

@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    TuiButton,
    TuiLink,
    TuiSwitch,
    TuiTabs,
    TuiTextarea,
    TuiInput,
    TuiInputNumber,
    TuiError,
    TuiLoader,
    TuiNotification,
  ],
  providers: [
    tuiIconsProvider({
      '@tui.plus':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14" stroke="black" stroke-width="2" stroke-linecap="round"/></svg>',
      '@tui.minus':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 12h14" stroke="black" stroke-width="2" stroke-linecap="round"/></svg>',
    }),
  ],
  selector: 'app-flag-form',
  styleUrl: './flag-form.css',
  templateUrl: './flag-form.html',
})
export class FlagForm {
  private readonly api = inject(FlagsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, {
    requireSync: true,
  });

  protected readonly id = computed(() => this.routeParams().get('id'));
  protected readonly confirmation = linkedSignal({
    source: this.id,
    computation: () => '',
  });
  protected readonly errors = linkedSignal({
    source: this.id,
    computation: (): string[] => [],
  });
  protected readonly saving = signal(false);
  protected readonly environments = FLAG_ENVIRONMENTS;
  protected readonly activeEnvironmentIndex = signal(0);
  protected readonly activeEnvironment = computed(
    () => this.environments[this.activeEnvironmentIndex()],
  );
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    key: this.fb.control({ value: '', disabled: this.id() !== null }, [
      Validators.required,
      Validators.pattern(/^[A-Za-z0-9_-]+$/),
    ]),
    description: '',
  });

  protected readonly settings = {
    Development: this.createSettings(),
    Staging: this.createSettings(),
    Production: this.createSettings(),
  };

  protected readonly flag = rxResource({
    params: () => this.id() ?? undefined,
    stream: ({ params }) =>
      this.api.get(params).pipe(tap((flag) => this.loadForm(flag))),
  });

  protected save(): void {
    if (this.saving() || this.confirmation()) {
      return;
    }

    const id = this.id();
    const { key, name, description } = this.form.getRawValue();
    const environment = this.activeEnvironment();
    const settings = this.settings[environment];
    const { enabled, rolloutPercentage } = settings.getRawValue();
    if (this.form.invalid || settings.invalid || rolloutPercentage === null) {
      this.form.markAllAsTouched();
      settings.markAllAsTouched();
      this.errors.set(['form.errors.checkFields']);
      return;
    }

    const request = {
      name,
      description: description || null,
      environment,
      enabled,
      rolloutPercentage,
    };
    this.errors.set([]);
    this.saving.set(true);
    (id ? this.api.update(id, request) : this.api.create({ ...request, key }))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          if (id !== this.id()) {
            return;
          }
          this.confirmation.set(id ? 'form.saved' : 'form.created');
          void this.router
            .navigate(['/flags'], {
              queryParams: { environment },
              replaceUrl: true,
            })
            .catch(() => {
              // The confirmation offers a link if automatic navigation fails.
            });
        },
        error: (error: unknown) => {
          if (id === this.id()) {
            this.errors.set(saveErrors(error, id !== null));
          }
        },
      });
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/flags');
  }

  private createSettings() {
    return this.fb.group({
      enabled: false,
      rolloutPercentage: new FormControl<number | null>(0, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
        (control) =>
          Number.isInteger(control.value) ? null : { integer: true },
      ]),
    });
  }

  private loadForm(flag: FlagResponse): void {
    this.form.reset({
      name: flag.name,
      key: { value: flag.key, disabled: true },
      description: flag.description ?? '',
    });
    this.activeEnvironmentIndex.set(0);
    for (const settings of flag.environments) {
      this.settings[settings.environment].reset(settings);
    }
  }
}
