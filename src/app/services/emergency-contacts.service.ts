import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { OfflineStorageService } from './offline-storage.service';

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  type: 'police' | 'fire' | 'medical' | 'rescue' | 'government' | 'utility' | 'general';
  description?: string;
  available24h: boolean;
  priority: number; // 1 = highest priority
}

export interface DisasterPreparednessInfo {
  id: string;
  disasterType: 'Earthquake' | 'Flood' | 'Typhoon' | 'Fire' | 'Landslide' | 'General';
  title: string;
  instructions: string[];
  preparationSteps: string[];
  emergencyKit: string[];
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyContactsService {
  private http = inject(HttpClient);
  private offlineStorage = inject(OfflineStorageService);

  // Default emergency contacts for Philippines
  private defaultEmergencyContacts: EmergencyContact[] = [
    {
      id: 'pnp-911',
      name: 'Philippine National Police',
      number: '911',
      type: 'police',
      description: 'Emergency hotline for police assistance',
      available24h: true,
      priority: 1
    },
    {
      id: 'bfp-911',
      name: 'Bureau of Fire Protection',
      number: '911',
      type: 'fire',
      description: 'Fire emergency and rescue services',
      available24h: true,
      priority: 1
    },
    {
      id: 'red-cross',
      name: 'Philippine Red Cross',
      number: '143',
      type: 'medical',
      description: 'Medical emergency and disaster response',
      available24h: true,
      priority: 2
    },
    {
      id: 'ndrrmc',
      name: 'NDRRMC',
      number: '(02) 8911-1406',
      type: 'government',
      description: 'National Disaster Risk Reduction and Management Council',
      available24h: true,
      priority: 2
    },
    {
      id: 'coast-guard',
      name: 'Philippine Coast Guard',
      number: '(02) 8527-8481',
      type: 'rescue',
      description: 'Maritime search and rescue operations',
      available24h: true,
      priority: 3
    },
    {
      id: 'meralco',
      name: 'Meralco Emergency',
      number: '16211',
      type: 'utility',
      description: 'Power outage and electrical emergency',
      available24h: true,
      priority: 4
    },
    {
      id: 'maynilad',
      name: 'Maynilad Emergency',
      number: '1626',
      type: 'utility',
      description: 'Water service emergency',
      available24h: true,
      priority: 4
    },
    {
      id: 'alerto-support',
      name: 'ALERTO Support',
      number: '+63 900 123 4567',
      type: 'general',
      description: 'ALERTO system support and assistance',
      available24h: false,
      priority: 5
    }
  ];

  // Default disaster preparedness information
  private defaultDisasterInfo: DisasterPreparednessInfo[] = [
    {
      id: 'earthquake-prep',
      disasterType: 'Earthquake',
      title: 'Earthquake Preparedness',
      instructions: [
        'Drop, Cover, and Hold On immediately',
        'Stay away from windows, mirrors, and heavy objects',
        'If outdoors, move away from buildings and power lines',
        'If in a vehicle, pull over and stay inside',
        'Do not run outside during shaking'
      ],
      preparationSteps: [
        'Secure heavy furniture and appliances',
        'Identify safe spots in each room',
        'Practice earthquake drills regularly',
        'Keep emergency supplies accessible',
        'Know how to turn off gas, water, and electricity'
      ],
      emergencyKit: [
        'First aid kit and medications',
        'Flashlight and extra batteries',
        'Battery-powered radio',
        'Water (1 gallon per person per day)',
        'Non-perishable food for 3 days',
        'Emergency contact list',
        'Cash and important documents',
        'Whistle for signaling help'
      ]
    },
    {
      id: 'flood-prep',
      disasterType: 'Flood',
      title: 'Flood Preparedness',
      instructions: [
        'Move to higher ground immediately',
        'Avoid walking or driving through flood waters',
        'Stay away from downed power lines',
        'Listen to emergency broadcasts',
        'Do not drink flood water'
      ],
      preparationSteps: [
        'Know your evacuation routes',
        'Keep sandbags or flood barriers ready',
        'Elevate utilities above potential flood levels',
        'Create a family communication plan',
        'Sign up for flood warnings'
      ],
      emergencyKit: [
        'Waterproof containers for documents',
        'Life jackets or flotation devices',
        'Water purification tablets',
        'Waterproof flashlight',
        'Emergency food and water',
        'Battery-powered radio',
        'First aid supplies',
        'Emergency contact information'
      ]
    },
    {
      id: 'typhoon-prep',
      disasterType: 'Typhoon',
      title: 'Typhoon Preparedness',
      instructions: [
        'Stay indoors and away from windows',
        'Secure or bring in outdoor objects',
        'Avoid using electrical appliances',
        'Stay in the strongest part of the building',
        'Listen to weather updates continuously'
      ],
      preparationSteps: [
        'Install storm shutters or board up windows',
        'Trim trees and secure outdoor furniture',
        'Stock up on emergency supplies',
        'Charge all electronic devices',
        'Fill bathtubs and containers with water'
      ],
      emergencyKit: [
        'Battery-powered radio and flashlights',
        'Extra batteries',
        'Non-perishable food for several days',
        'Water storage containers',
        'First aid kit and medications',
        'Duct tape and plastic sheeting',
        'Emergency contact list',
        'Cash and important documents'
      ]
    },
    {
      id: 'fire-prep',
      disasterType: 'Fire',
      title: 'Fire Safety',
      instructions: [
        'Evacuate immediately when alarm sounds',
        'Stay low to avoid smoke inhalation',
        'Feel doors before opening them',
        'Use stairs, never elevators',
        'Call 911 once you are safe'
      ],
      preparationSteps: [
        'Install smoke detectors in every room',
        'Create and practice escape plans',
        'Keep fire extinguishers accessible',
        'Clear escape routes of obstacles',
        'Teach children about fire safety'
      ],
      emergencyKit: [
        'Fire extinguisher (ABC type)',
        'Smoke masks or cloth for breathing',
        'Flashlight for dark conditions',
        'Emergency ladder for upper floors',
        'Important documents in fireproof safe',
        'Emergency contact list',
        'First aid supplies',
        'Battery-powered radio'
      ]
    }
  ];

  /**
   * Initialize emergency contacts and cache them
   */
  async initializeEmergencyContacts(): Promise<void> {
    try {
      // Try to fetch from API first, fallback to defaults
      let contacts = this.defaultEmergencyContacts;
      let disasterInfo = this.defaultDisasterInfo;

      // try {
      //   // Try to fetch updated contacts from API if available
      //   const response = await firstValueFrom(
      //     this.http.get<{contacts: EmergencyContact[], disasterInfo: DisasterPreparednessInfo[]}>
      //       (`${environment.apiUrl}/emergency-contacts`)
      //   );
        
      //   if (response.contacts) {
      //     contacts = response.contacts;
      //   }
      //   if (response.disasterInfo) {
      //     disasterInfo = response.disasterInfo;
      //   }
      // } catch (error) {
      //   console.log('Using default emergency contacts (API not available)');
      // }

      // Cache the contacts and disaster info
      await this.offlineStorage.cacheEmergencyContacts(contacts);
      await this.offlineStorage.cacheDisasterInfo(disasterInfo);

      console.log(`📞 Initialized ${contacts.length} emergency contacts`);
      console.log(`🌪️ Initialized ${disasterInfo.length} disaster preparedness guides`);
    } catch (error) {
      console.error('Failed to initialize emergency contacts:', error);
    }
  }

  /**
   * Get emergency contacts (from cache or defaults)
   */
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      // Try to get from cache first
      const cachedContacts = await this.offlineStorage.getCachedEmergencyContacts();
      if (cachedContacts && cachedContacts.length > 0) {
        return cachedContacts;
      }

      // Fallback to defaults and cache them
      await this.offlineStorage.cacheEmergencyContacts(this.defaultEmergencyContacts);
      return this.defaultEmergencyContacts;
    } catch (error) {
      console.error('Failed to get emergency contacts:', error);
      return this.defaultEmergencyContacts;
    }
  }

  /**
   * Get disaster preparedness information
   */
  async getDisasterInfo(): Promise<DisasterPreparednessInfo[]> {
    try {
      // Try to get from cache first
      const cachedInfo = await this.offlineStorage.getCachedDisasterInfo();
      if (cachedInfo && cachedInfo.length > 0) {
        return cachedInfo;
      }

      // Fallback to defaults and cache them
      await this.offlineStorage.cacheDisasterInfo(this.defaultDisasterInfo);
      return this.defaultDisasterInfo;
    } catch (error) {
      console.error('Failed to get disaster info:', error);
      return this.defaultDisasterInfo;
    }
  }

  /**
   * Get contacts by type
   */
  async getContactsByType(type: EmergencyContact['type']): Promise<EmergencyContact[]> {
    const contacts = await this.getEmergencyContacts();
    return contacts.filter(contact => contact.type === type)
                  .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get disaster info by type
   */
  async getDisasterInfoByType(disasterType: DisasterPreparednessInfo['disasterType']): Promise<DisasterPreparednessInfo | null> {
    const disasterInfo = await this.getDisasterInfo();
    return disasterInfo.find(info => info.disasterType === disasterType) || null;
  }

  /**
   * Get high priority emergency contacts (priority 1-2)
   */
  async getHighPriorityContacts(): Promise<EmergencyContact[]> {
    const contacts = await this.getEmergencyContacts();
    return contacts.filter(contact => contact.priority <= 2)
                  .sort((a, b) => a.priority - b.priority);
  }
}
