import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { OrsTestPageRoutingModule } from './ors-test-routing.module';
import { OrsTestPage } from './ors-test.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OrsTestPageRoutingModule
  ],
  declarations: [OrsTestPage]
})
export class OrsTestPageModule {}
