import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiLink } from '@taiga-ui/core';

@Component({
  imports: [RouterLink, TuiLink],
  selector: 'app-flag-page-pending',
  template: `
    <h2 class="mt-7 text-2xl font-semibold">{{ title }}</h2>
    <p>Этот раздел появится на следующем этапе разработки.</p>
    <a tuiLink routerLink="/flags">К списку флагов</a>
  `,
})
export class FlagPagePending {
  protected readonly title = inject(ActivatedRoute).snapshot.title;
}
