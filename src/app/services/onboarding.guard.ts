import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const onboardingGuard: CanActivateFn = (route, state) => {
  // Use localStorage or Capacitor Storage as needed
  const onboardingComplete = localStorage.getItem('onboardingComplete');
  if (onboardingComplete === 'true') {
    // Onboarding complete: allow navigation
    return true;
  } else {
    // Not complete: redirect to welcome or data page
    const router = inject(Router);
    router.navigate(['/welcome']);
    return false;
  }
};
