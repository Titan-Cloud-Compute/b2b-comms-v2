import { Routes } from '@angular/router';
import { FEATURE_ROUTES } from './features/index';

export const routes: Routes = [
  ...FEATURE_ROUTES,
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    data: { hideSupportFooter: true }
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    data: { hideSupportFooter: true }
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    data: { hideSupportFooter: true }
  },
  {
    path: 'signup',
    redirectTo: 'signup/1',
    pathMatch: 'full'
  },
  {
    path: 'signup/:step',
    loadComponent: () => import('./signup/signup.component').then(m => m.SignupComponent),
    data: { hideSupportFooter: ['1'] }
  },
  {
    path: 'terms',
    loadComponent: () => import('./terms/terms.component').then(m => m.TermsComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent),
    data: { hideSupportFooter: true }
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout.component').then(m => m.LayoutComponent),
    data: { rendersSupportFooterInLayout: true },
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'admin',
        loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'admin/overview',
        loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'admin/app-settings',
        loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
      },
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
