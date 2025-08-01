import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { useInputField } from "../input_field_hook";
import { standardFieldProps } from "../standard_field_props";

import { Component } from "@cashapp/owl";

export class EmailField extends Component {
    static template = "web.EmailField";
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
    };

    setup() {
        useInputField({ getValue: () => this.props.record.data[this.props.name] || "" });
    }
}

export const emailField = {
    component: EmailField,
    displayName: _t("Email"),
    supportedTypes: ["char"],
    extractProps: ({ attrs }) => ({
        placeholder: attrs.placeholder,
    }),
};

registry.category("fields").add("email", emailField);

class FormEmailField extends EmailField {
    static template = "web.FormEmailField";
}

export const formEmailField = {
    ...emailField,
    component: FormEmailField,
};

registry.category("fields").add("form.email", formEmailField);
