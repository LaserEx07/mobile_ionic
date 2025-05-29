import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { SearchPage } from './search.page';
import { EvacuationCenterModalComponent } from './evacuation-center-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild([
      {
        path: '',
        component: SearchPage
      }
    ])
  ],
  declarations: [SearchPage, EvacuationCenterModalComponent]
})
export class SearchPageModule {}
