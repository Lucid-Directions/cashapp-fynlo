import { SuggestedRecipient } from "@mail/core/web/suggested_recipient";

import { Component, useState } from "@cashapp/owl";

/**
 * @typedef {Object} Props
 * @property {function} onSuggestedRecipientAdded
 * @property {import("models").Thread} thread
 * @property {string} className
 * @property {string} styleString
 * @extends {Component<Props, Env>}
 */
export class SuggestedRecipientsList extends Component {
    static template = "mail.SuggestedRecipientsList";
    static components = { SuggestedRecipient };
    static props = ["thread", "className?", "styleString?", "onSuggestedRecipientAdded"];

    setup() {
        super.setup();
        this.state = useState({ showMore: false });
    }

    get suggestedRecipients() {
        if (!this.state.showMore) {
            return this.props.thread.suggestedRecipients.slice(0, 3);
        }
        return this.props.thread.suggestedRecipients;
    }
}
