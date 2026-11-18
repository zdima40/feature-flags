import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiLink, TuiTextfield } from '@taiga-ui/core';
import { TuiSwitch, TuiTextarea } from '@taiga-ui/kit';
import { tap } from 'rxjs';
import { FlagsApiService } from '../../../core/api/flags-api.service';
import {
  FLAG_ENVIRONMENTS,
  FlagEnvironment,
  FlagResponse,
} from '../../../core/models/flag.model';

@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TuiButton,
    TuiLink,
    TuiSwitch,
    TuiTextarea,
    TuiTextfield,
  ],
  selector: 'app-flag-form',
  styleUrl: './flag-form.css',
  templateUrl: './flag-form.html',
})
export class FlagForm {
  private readonly api = inject(FlagsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, {
    requireSync: true,
  });

  protected readonly id = computed(() => this.routeParams().get('id'));
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
    for (const {
      environment,
      enabled,
      rolloutPercentage,
    } of flag.environments) {
      this.settings[environment].reset({ enabled, rolloutPercentage });
    }
  }
}
