import { evaluateExpr, evaluateBooleanExpr } from "@web/core/py_js/py";
import { registry } from "@web/core/registry";

import { Component, xml } from "@cashapp/owl";
const viewWidgetRegistry = registry.category("view_widgets");

const supportedInfoValidation = {
    type: Array,
    element: Object,
    shape: {
        label: String,
        name: String,
        type: String,
        availableTypes: { type: Array, element: String, optional: true },
        default: { type: String, optional: true },
        help: { type: String, optional: true },
        choices: /* choices if type == selection */ {
            type: Array,
            element: Object,
            shape: { label: String, value: String },
            optional: true,
        },
    },
    optional: true,
};

viewWidgetRegistry.addValidation({
    component: { validate: (c) => c.prototype instanceof Component },
    extractProps: { type: Function, optional: true },
    additionalClasses: { type: Array, element: String, optional: true },
    fieldDependencies: {
        type: [Function, { type: Array, element: Object, shape: { name: String, type: String } }],
        optional: true,
    },
    listViewWidth: {
        type: [
            Number,
            {
                type: Array,
                element: Number,
                validate: (array) => array.length === 1 || array.length === 2,
            },
            Function,
        ],
        optional: true,
    },
    supportedAttributes: supportedInfoValidation,
    supportedOptions: supportedInfoValidation,
});

/**
 * A Component that supports rendering `<widget />` tags in a view arch
 * It should have minimum legacy support that is:
 * - getting the legacy widget class from the legacy registry
 * - instanciating a legacy widget
 * - passing to it a "legacy node", which is a representation of the arch's node
 * It supports instancing components from the "view_widgets" registry.
 */
export class Widget extends Component {
    static template = xml/*xml*/ `
        <div t-att-class="classNames" t-att-style="props.style">
            <t t-component="widget.component" t-props="widgetProps" />
        </div>`;

    static parseWidgetNode = function (node) {
        const name = node.getAttribute("name");
        const widget = viewWidgetRegistry.get(name);
        const widgetInfo = {
            name,
            widget,
            options: {},
            attrs: {},
        };

        for (const { name, value } of node.attributes) {
            if (["name", "widget"].includes(name)) {
                // avoid adding name and widget to attrs
                continue;
            }
            if (name === "options") {
                widgetInfo.options = evaluateExpr(value);
            } else if (!name.startsWith("t-att")) {
                // all other (non dynamic) attributes
                widgetInfo.attrs[name] = value;
            }
        }

        return widgetInfo;
    };
    static props = {
        "*": true,
    };

    setup() {
        if (this.props.widgetInfo) {
            this.widget = this.props.widgetInfo.widget;
        } else {
            this.widget = viewWidgetRegistry.get(this.props.name);
        }
    }

    get classNames() {
        const classNames = {
            o_widget: true,
            [`o_widget_${this.props.name}`]: true,
            [this.props.className]: Boolean(this.props.className),
        };
        if (this.widget.additionalClasses) {
            for (const cls of this.widget.additionalClasses) {
                classNames[cls] = true;
            }
        }
        return classNames;
    }
    get widgetProps() {
        const record = this.props.record;

        let readonlyFromModifiers = false;
        let propsFromNode = {};
        if (this.props.widgetInfo) {
            const widgetInfo = this.props.widgetInfo;
            readonlyFromModifiers = evaluateBooleanExpr(
                widgetInfo.attrs.readonly,
                record.evalContextWithVirtualIds
            );
            const dynamicInfo = {
                readonly: readonlyFromModifiers,
            };
            propsFromNode = this.widget.extractProps
                ? this.widget.extractProps(widgetInfo, dynamicInfo)
                : {};
        }

        return {
            record,
            readonly: !record.isInEdition || readonlyFromModifiers || false,
            ...propsFromNode,
        };
    }
}
