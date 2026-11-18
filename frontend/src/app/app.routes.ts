import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'flags', pathMatch: 'full' },
  {
    path: 'flags',
    title: 'Список флагов | Rollout',
    loadComponent: () =>
      import('./features/flags/flags-list/flags-list').then(
        (module) => module.FlagsList,
      ),
  },
];
