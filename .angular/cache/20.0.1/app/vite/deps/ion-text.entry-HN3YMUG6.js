import {
  createColorClasses
} from "./chunk-NTRTJKKQ.js";
import {
  Host,
  getIonMode,
  h,
  registerInstance
} from "./chunk-HZ2HO4M6.js";
import "./chunk-SCNEKAWF.js";

// node_modules/@ionic/core/dist/esm/ion-text.entry.js
var textCss = ":host(.ion-color){color:var(--ion-color-base)}";
var Text = class {
  constructor(hostRef) {
    registerInstance(this, hostRef);
  }
  render() {
    const mode = getIonMode(this);
    return h(Host, { key: "361035eae7b92dc109794348d39bad2f596eb6be", class: createColorClasses(this.color, {
      [mode]: true
    }) }, h("slot", { key: "c7b8835cf485ba9ecd73298f0529276ce1ea0852" }));
  }
};
Text.style = textCss;
export {
  Text as ion_text
};
/*! Bundled license information:

@ionic/core/dist/esm/ion-text.entry.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=ion-text.entry-HN3YMUG6.js.map
