export interface ContactInfo {
  number: string;
  network: string;
}

export interface EvacuationCenter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  disaster_type?: string | string[]; // Can be either string or array
  contact?: string | ContactInfo[];
  image_url?: string;
  last_updated?: string;
  barangay?: string;
  distance?: number; // For nearest center calculations
  routing_available?: boolean; // Whether routing is available for this center
}


