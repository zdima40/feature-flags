import { Routes } from '@angular/router';

const loadFlagForm = () =>
  import('./features/flags/flag-form/flag-form').then(
    (module) => module.FlagForm,
  );

export const routes: Routes = [
  { path: '', redirectTo: 'flags', pathMatch: 'full' },
  {
    path: 'flags',
    title: 'list.heading',
    loadComponent: () =>
      import('./features/flags/flags-list/flags-list').then(
        (module) => module.FlagsList,
      ),
  },
  {
    path: 'flags/new',
    title: 'list.create',
    loadComponent: loadFlagForm,
  },
  {
    path: 'flags/:id/edit',
    title: 'form.edit',
    loadComponent: loadFlagForm,
  },
  {
    path: 'flags/:id/history',
    title: 'history.heading',
    loadComponent: () =>
      import('./features/flags/flag-history/flag-history').then(
        (module) => module.FlagHistory,
      ),
  },
];
