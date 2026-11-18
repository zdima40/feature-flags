import { Routes } from '@angular/router';

const loadFlagForm = () =>
  import('./features/flags/flag-form/flag-form').then(
    (module) => module.FlagForm,
  );

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
  {
    path: 'flags/new',
    title: 'Создать флаг',
    loadComponent: loadFlagForm,
  },
  {
    path: 'flags/:id/edit',
    title: 'Редактирование флага',
    loadComponent: loadFlagForm,
  },
  {
    path: 'flags/:id/history',
    title: 'История флага',
    loadComponent: () =>
      import('./features/flags/flag-history/flag-history').then(
        (module) => module.FlagHistory,
      ),
  },
];
