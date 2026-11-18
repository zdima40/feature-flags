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
import { TuiButton, TuiInput, TuiLink } from '@taiga-ui/core';
import { TuiSwitch, TuiTextarea } from '@taiga-ui/kit';
import { finalize, tap } from 'rxjs';
import { FlagsApiService } from '../../../core/api/flags-api.service';
import {
  FLAG_ENVIRONMENTS,
  FlagEnvironment,
  FlagResponse,
} from '../../../core/models/flag.model';

function saveErrors(error: unknown): string[] {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return ['Флаг с таким ключом уже существует.'];
    }
    if (error.status === 404) {
      return ['Флаг не найден.'];
    }
    const problem: unknown = error.error;
    if (error.status === 400 && problem && typeof problem === 'object') {
      if (
        'errors' in problem &&
        problem.errors &&
        typeof problem.errors === 'object'
      ) {
        const groups: unknown[] = Object.values(problem.errors);
        const messages = groups
          .flat()
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          );
        if (messages.length) {
          return [...new Set(messages)];
        }
      }
      if (
        'detail' in problem &&
        typeof problem.detail === 'string' &&
        problem.detail.trim()
      ) {
        return [problem.detail];
      }
    }
  }
  return ['Не удалось сохранить флаг. Попробуйте ещё раз.'];
}

@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TuiButton,
    TuiLink,
    TuiSwitch,
    TuiTextarea,
    TuiInput,
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
  private readonly createdIn = FLAG_ENVIRONMENTS.find(
    (environment) =>
      environment === this.router.currentNavigation()?.extras.info,
  );
  private readonly createdId = this.createdIn ? this.id() : null;
  protected readonly confirmation = linkedSignal<string>(() =>
    this.createdId && this.createdId === this.id() ? 'Флаг создан.' : '',
  );
  protected readonly errors = linkedSignal({
    source: this.id,
    computation: (): string[] => [],
  });
  protected readonly saving = signal(false);
  protected readonly createdFlagId = signal<string | null>(null);
  protected readonly environments = FLAG_ENVIRONMENTS;
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    key: this.fb.control({ value: '', disabled: this.id() !== null }, [
      Validators.required,
      Validators.pattern(/^[A-Za-z0-9_-]+$/),
    ]),
    description: '',
    environment: this.fb.control<FlagEnvironment>('Development'),
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
    if (this.saving() || this.createdFlagId()) {
      return;
    }

    const id = this.id();
    const { key, name, description, environment } = this.form.getRawValue();
    const settings = this.settings[environment];
    const { enabled, rolloutPercentage } = settings.getRawValue();
    this.confirmation.set('');
    if (this.form.invalid || settings.invalid || rolloutPercentage === null) {
      this.form.markAllAsTouched();
      settings.markAllAsTouched();
      this.errors.set(['Проверьте отмеченные поля.']);
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
        next: (saved) => {
          if (id !== this.id()) {
            return;
          }
          if (!id) {
            this.createdFlagId.set(saved.id);
            this.confirmation.set('Флаг создан.');
            void this.router
              .navigate(['/flags', saved.id, 'edit'], {
                replaceUrl: true,
                info: environment,
              })
              .catch(() => {
                // The created flag remains accessible from the confirmation.
              });
            return;
          }
          this.resetFields(saved, environment);
          for (const savedSettings of saved.environments) {
            const group = this.settings[savedSettings.environment];
            if (savedSettings.environment === environment || group.pristine) {
              group.reset(savedSettings);
            }
          }
          this.confirmation.set(
            `Флаг сохранён. Настройки ${environment} обновлены.`,
          );
        },
        error: (error: unknown) => {
          if (id === this.id()) {
            this.errors.set(saveErrors(error));
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
    this.resetFields(
      flag,
      flag.id === this.createdId ? this.createdIn : undefined,
    );
    for (const settings of flag.environments) {
      this.settings[settings.environment].reset(settings);
    }
  }

  private resetFields(
    flag: FlagResponse,
    environment: FlagEnvironment = 'Development',
  ): void {
    this.form.reset({
      name: flag.name,
      key: { value: flag.key, disabled: true },
      description: flag.description ?? '',
      environment,
    });
  }
}
