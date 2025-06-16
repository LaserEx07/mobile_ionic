import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { EvacuationCenterModalComponent } from './evacuation-center-modal.component';
import { LoadingService } from '../../services/loading.service';
import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SearchPage implements OnInit {
  searchQuery: string = '';
  locations: EvacuationCenter[] = [];
  allCenters: EvacuationCenter[] = [];
  isLoading: boolean = false;
  hasError: boolean = false;
  errorMessage: string = '';

  constructor(
    private http: HttpClient,
    private loadingService: LoadingService,
    private toastCtrl: ToastController,
    private router: Router,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.loadEvacuationCenters();
  }

  async loadEvacuationCenters() {
    await this.loadingService.showLoading('Loading evacuation centers...');
    this.isLoading = true;

    try {
      this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
        .subscribe({
          next: (data) => {
            console.log('Loaded evacuation centers:', data);
            this.allCenters = data || [];
            this.isLoading = false;
            this.loadingService.dismissLoading();
          },
          error: (error) => {
            console.error('Error loading evacuation centers:', error);
            this.hasError = true;
            this.errorMessage = 'Failed to load evacuation centers. Please try again later.';
            this.isLoading = false;
            this.loadingService.dismissLoading();

            this.toastCtrl.create({
              message: 'Failed to load evacuation centers. Please try again later.',
              duration: 3000,
              color: 'danger'
            }).then(toast => toast.present());
          }
        });
    } catch (error) {
      console.error('Exception loading evacuation centers:', error);
      this.hasError = true;
      this.errorMessage = 'An unexpected error occurred. Please try again later.';
      this.isLoading = false;
      this.loadingService.dismissLoading();
    }
  }

  onSearch(event: any) {
    const query = event.target.value.toLowerCase().trim();
    console.log('Searching for:', query);

    if (!query) {
      this.locations = [];
      return;
    }

    // Search in the already loaded centers
    this.locations = this.allCenters.filter(center => {
      // Search by name (prioritize starts with)
      const nameStartsWith = center.name.toLowerCase().startsWith(query);
      const nameIncludes = center.name.toLowerCase().includes(query);

      // Search by address
      const addressIncludes = center.address?.toLowerCase().includes(query);

      // Search by disaster type - handle both array and string formats
      let disasterTypeIncludes = false;
      if (center.disaster_type) {
        if (Array.isArray(center.disaster_type)) {
          disasterTypeIncludes = center.disaster_type.some(type =>
            type.toLowerCase().includes(query)
          );
        } else {
          disasterTypeIncludes = center.disaster_type.toLowerCase().includes(query);
        }
      }

      // Prioritize exact matches and "starts with" matches
      return nameStartsWith || nameIncludes || addressIncludes || disasterTypeIncludes;
    });

    // Sort results: prioritize "starts with" matches for name
    this.locations.sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(query);
      const bStartsWith = b.name.toLowerCase().startsWith(query);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return 0;
    });
  }

  clearSearch() {
    this.searchQuery = '';
    this.locations = [];
  }

  refreshCenters(event: any) {
    this.loadEvacuationCenters().then(() => {
      event.target.complete();
    });
  }

  async viewOnMap(center: EvacuationCenter) {
    // Show modal with center details
    const modal = await this.modalCtrl.create({
      component: EvacuationCenterModalComponent,
      componentProps: {
        center: center
      },
      cssClass: 'evacuation-center-modal'
    });

    await modal.present();
  }
}