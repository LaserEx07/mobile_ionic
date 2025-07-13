import {
  ImpactStyle,
  NotificationType
} from "./chunk-OGKSRTVA.js";
import {
  WebPlugin
} from "./chunk-MCFBZ5YE.js";
import {
  __async
} from "./chunk-EAE2VPRF.js";

// node_modules/@capacitor/haptics/dist/esm/web.js
var HapticsWeb = class extends WebPlugin {
  constructor() {
    super(...arguments);
    this.selectionStarted = false;
  }
  impact(options) {
    return __async(this, null, function* () {
      const pattern = this.patternForImpact(options === null || options === void 0 ? void 0 : options.style);
      this.vibrateWithPattern(pattern);
    });
  }
  notification(options) {
    return __async(this, null, function* () {
      const pattern = this.patternForNotification(options === null || options === void 0 ? void 0 : options.type);
      this.vibrateWithPattern(pattern);
    });
  }
  vibrate(options) {
    return __async(this, null, function* () {
      const duration = (options === null || options === void 0 ? void 0 : options.duration) || 300;
      this.vibrateWithPattern([duration]);
    });
  }
  selectionStart() {
    return __async(this, null, function* () {
      this.selectionStarted = true;
    });
  }
  selectionChanged() {
    return __async(this, null, function* () {
      if (this.selectionStarted) {
        this.vibrateWithPattern([70]);
      }
    });
  }
  selectionEnd() {
    return __async(this, null, function* () {
      this.selectionStarted = false;
    });
  }
  patternForImpact(style = ImpactStyle.Heavy) {
    if (style === ImpactStyle.Medium) {
      return [43];
    } else if (style === ImpactStyle.Light) {
      return [20];
    }
    return [61];
  }
  patternForNotification(type = NotificationType.Success) {
    if (type === NotificationType.Warning) {
      return [30, 40, 30, 50, 60];
    } else if (type === NotificationType.Error) {
      return [27, 45, 50];
    }
    return [35, 65, 21];
  }
  vibrateWithPattern(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    } else {
      throw this.unavailable("Browser does not support the vibrate API");
    }
  }
};
export {
  HapticsWeb
};
//# sourceMappingURL=web-OFE4VD5L.js.map
