export interface EvacuationCenter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  disaster_type?: string | string[]; // Can be either string or array
  contact?: string;
  image_url?: string;
  last_updated?: string;
  barangay?: string;
  distance?: number; // For nearest center calculations
}

export interface OfflineRoute {
  id?: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  disaster_type: string;
  route_data: string; // JSON string of route coordinates
  distance: number;
  duration: number;
  travel_mode: string;
  created_at?: string;
}
