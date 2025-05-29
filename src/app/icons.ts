import { addIcons } from 'ionicons';
import {
  thunderstormOutline,
  chevronUp,
  chevronDown,
  chevronDownCircle,
  chevronDownCircleOutline,
  chevronDownOutline,
  walkOutline,
  bicycleOutline,
  carOutline,
  navigateOutline,
  navigate,
  timeOutline,
  informationCircleOutline,
  callOutline,
  locationOutline,
  locateOutline,
  locateSharp,
  closeOutline,
  closeCircle,
  arrowForwardOutline,
  location,
  peopleOutline,
  chevronBackOutline,
  alertCircleOutline,
  homeOutline,
  warningOutline,
  waterOutline,
  cloudOutline,
  helpCircleOutline,
  mapOutline,
  searchOutline,
  search,
  personOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  refreshOutline,
  menuOutline,
  settingsOutline,
  notificationsOutline
} from 'ionicons/icons';

// Register all icons used in the application
export function registerIcons() {
  addIcons({
    // Weather and disaster icons
    'thunderstorm-outline': thunderstormOutline,
    'water-outline': waterOutline,
    'cloud-outline': cloudOutline,

    // Navigation icons
    'chevron-up': chevronUp,
    'chevron-back-outline': chevronBackOutline,
    'chevron-down': chevronDown,
    'chevron-down-circle': chevronDownCircle,
    'chevron-down-circle-outline': chevronDownCircleOutline,
    'chevron-down-outline': chevronDownOutline,
    'arrow-forward-outline': arrowForwardOutline,

    // Transportation icons
    'walk-outline': walkOutline,
    'bicycle-outline': bicycleOutline,
    'car-outline': carOutline,

    // Map and location icons
    'navigate-outline': navigateOutline,
    'navigate': navigate,
    'location-outline': locationOutline,
    'location': location,
    'locate-outline': locateOutline,
    'locate': locateSharp,
    'map-outline': mapOutline,

    // Information icons
    'time-outline': timeOutline,
    'information-circle-outline': informationCircleOutline,
    'help-circle-outline': helpCircleOutline,
    'alert-circle-outline': alertCircleOutline,
    'warning-outline': warningOutline,

    // Contact and user icons
    'call-outline': callOutline,
    'people-outline': peopleOutline,
    'person-outline': personOutline,
    'mail-outline': mailOutline,

    // UI control icons
    'close-outline': closeOutline,
    'close-circle': closeCircle,
    'search-outline': searchOutline,
    'search': search,
    'refresh-outline': refreshOutline,
    'menu-outline': menuOutline,
    'settings-outline': settingsOutline,
    'home-outline': homeOutline,
    'notifications-outline': notificationsOutline,

    // Security icons
    'lock-closed-outline': lockClosedOutline,
    'eye-outline': eyeOutline,
    'eye-off-outline': eyeOffOutline
  });
}
