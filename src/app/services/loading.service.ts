import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeLoader: HTMLIonLoadingElement | null = null;

  constructor(private loadingController: LoadingController) {}

  /**
   * Shows a loading spinner with improved accessibility
   * @param message Optional message to display
   * @returns Promise that resolves when the loader is presented
   */
  async showLoading(message: string = 'Please wait...'): Promise<void> {
    // Dismiss any existing loader first
    await this.dismissLoading();

    // Create the loading element
    this.activeLoader = await this.loadingController.create({
      message,
      spinner: 'circular',
      cssClass: 'accessible-loading',
      // We'll handle the aria attributes in the afterCreate callback
    });

    // Present the loader
    await this.activeLoader.present();

    // Fix accessibility issues after the loader is in the DOM
    this.fixAccessibility(this.activeLoader);
  }

  /**
   * Dismisses the active loading spinner if one exists
   */
  async dismissLoading(): Promise<void> {
    if (this.activeLoader) {
      try {
        await this.activeLoader.dismiss();
      } catch (error) {
        console.warn('Error dismissing loader:', error);
      }
      this.activeLoader = null;
    }
  }

  /**
   * Fixes accessibility issues with the loading element
   * @param loader The loading element to fix
   */
  private fixAccessibility(loader: HTMLIonLoadingElement): void {
    if (!loader) return;

    // Get the element
    const element = loader.querySelector('.loading-wrapper');
    if (!element) return;

    // Remove aria-hidden and add inert attribute instead
    const parentElement = loader.shadowRoot?.querySelector('.overlay-hidden');
    if (parentElement && parentElement.hasAttribute('aria-hidden')) {
      parentElement.removeAttribute('aria-hidden');
      parentElement.setAttribute('inert', '');
    }

    // Ensure proper focus management
    loader.onDidDismiss().then(() => {
      // Return focus to the previously focused element when dismissed
      const previouslyFocused = document.querySelector(':focus-within');
      if (previouslyFocused && 'focus' in previouslyFocused) {
        (previouslyFocused as HTMLElement).focus();
      }
    });
  }
}
