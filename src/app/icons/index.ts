import { addIcons } from 'ionicons';
import { 
  locateOutline, 
  locationOutline,
  locate,
  location,
  mapOutline,
  navigateOutline,
  navigateCircleOutline,
  warningOutline,
  alertCircleOutline,
  homeOutline,
  searchOutline,
  menuOutline,
  personOutline,
  settingsOutline,
  compassOutline,
  cloudOutline,
  waterOutline,
  earthOutline,
  flameOutline
} from 'ionicons/icons';

// Register all icons used in the app
export function registerIcons() {
  addIcons({
    'locate-outline': locateOutline,
    'location-outline': locationOutline,
    'locate': locate,
    'location': location,
    'map-outline': mapOutline,
    'navigate-outline': navigateOutline,
    'navigate-circle-outline': navigateCircleOutline,
    'warning-outline': warningOutline,
    'alert-circle-outline': alertCircleOutline,
    'home-outline': homeOutline,
    'search-outline': searchOutline,
    'menu-outline': menuOutline,
    'person-outline': personOutline,
    'settings-outline': settingsOutline,
    'compass-outline': compassOutline,
    'cloud-outline': cloudOutline,
    'water-outline': waterOutline,
    'earth-outline': earthOutline,
    'flame-outline': flameOutline
  });
}
