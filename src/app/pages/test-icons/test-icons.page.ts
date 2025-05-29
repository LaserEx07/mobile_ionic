import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { CustomIconComponent } from '../../components/custom-icons';

@Component({
  selector: 'app-test-icons',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Test Icons</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <h2>Standard Ionicons</h2>
      <div class="icon-row">
        <div class="icon-item">
          <ion-icon name="chevron-up" size="large"></ion-icon>
          <p>chevron-up</p>
        </div>
        <div class="icon-item">
          <ion-icon name="chevron-down" size="large"></ion-icon>
          <p>chevron-down</p>
        </div>
        <div class="icon-item">
          <ion-icon name="chevron-down-circle" size="large"></ion-icon>
          <p>chevron-down-circle</p>
        </div>
        <div class="icon-item">
          <ion-icon name="chevron-down-circle-outline" size="large"></ion-icon>
          <p>chevron-down-circle-outline</p>
        </div>
        <div class="icon-item">
          <ion-icon name="navigate" size="large"></ion-icon>
          <p>navigate</p>
        </div>
      </div>

      <h2>Custom Icons</h2>
      <div class="icon-row">
        <div class="icon-item">
          <app-custom-icon name="chevron-down-circle-outline" [size]="32"></app-custom-icon>
          <p>Custom chevron-down-circle-outline</p>
        </div>
        <div class="icon-item">
          <app-custom-icon name="navigate" [size]="32"></app-custom-icon>
          <p>Custom navigate</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .icon-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }

    .icon-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 120px;
    }

    ion-icon {
      font-size: 32px;
    }

    p {
      margin-top: 8px;
      font-size: 12px;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule, CustomIconComponent]
})
export class TestIconsPage {}
