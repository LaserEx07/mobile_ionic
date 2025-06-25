import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrsTestPage } from './ors-test.page';

const routes: Routes = [
  {
    path: '',
    component: OrsTestPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrsTestPageRoutingModule {}
