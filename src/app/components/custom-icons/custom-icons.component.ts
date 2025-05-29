import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-icon',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
    <div [ngSwitch]="name" class="custom-icon" [class.ion-color]="color" [class]="'ion-color-' + color" [style.width]="size + 'px'" [style.height]="size + 'px'">
      <!-- Chevron Down Circle Outline -->
      <svg *ngSwitchCase="'chevron-down-circle-outline'" xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512">
        <title>Chevron Down Circle</title>
        <path d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192S362 64 256 64z" stroke="currentColor" fill="none" stroke-miterlimit="10" stroke-width="32"/>
        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M352 216l-96 96-96-96"/>
      </svg>

      <!-- Navigate Icon -->
      <svg *ngSwitchCase="'navigate'" xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512">
        <title>Navigate</title>
        <path d="M256 64L96 433.062 256 352l160 81.062z" fill="currentColor"/>
      </svg>

      <!-- Default case - show error message -->
      <div *ngSwitchDefault class="icon-error">
        Icon '{{ name }}' not found
      </div>
    </div>
  `,
  styles: [`
    .custom-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .custom-icon svg {
      width: 100%;
      height: 100%;
    }

    .ion-color svg {
      color: var(--ion-color-base);
    }

    .icon-error {
      font-size: 10px;
      color: red;
      text-align: center;
    }
  `]
})
export class CustomIconComponent {
  @Input() name: string = '';
  @Input() color: string = '';
  @Input() size: number = 24;
}
