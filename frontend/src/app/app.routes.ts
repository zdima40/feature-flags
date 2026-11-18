import { Routes } from '@angular/router';

// The form and history TODOs will replace these temporary route components.
const loadPendingFlagPage = () =>
  import('./features/flags/flag-page-pending').then(
    (module) => module.FlagPagePending,
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
    loadComponent: loadPendingFlagPage,
  },
  {
    path: 'flags/:id/edit',
    title: 'Редактирование флага',
    loadComponent: loadPendingFlagPage,
  },
  {
    path: 'flags/:id/history',
    title: 'История флага',
    loadComponent: loadPendingFlagPage,
  },
];
