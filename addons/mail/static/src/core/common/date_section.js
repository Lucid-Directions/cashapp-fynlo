import { Component } from "@cashapp/owl";
import { isMobileOS } from "@web/core/browser/feature_detection";

/**
 * @typedef {Object} Props
 * @property {string} date
 * @property {string} [className]
 */
export class DateSection extends Component {
    static template = "mail.DateSection";
    static props = ["date", "className?"];

    get isMobileOS() {
        return isMobileOS();
    }
}
