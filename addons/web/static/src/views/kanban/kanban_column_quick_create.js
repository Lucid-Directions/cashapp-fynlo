import { _t } from "@web/core/l10n/translation";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";
import { useAutofocus, useService } from "@web/core/utils/hooks";
import { KanbanColumnExamplesDialog } from "./kanban_column_examples_dialog";

import { Component, useExternalListener, useState, useRef } from "@cashapp/owl";

export class KanbanColumnQuickCreate extends Component {
    static template = "web.KanbanColumnQuickCreate";
    static props = {
        exampleData: [Object, { value: null }],
        onFoldChange: Function,
        onValidate: Function,
        folded: Boolean,
        groupByField: Object,
    };

    setup() {
        this.dialog = useService("dialog");
        this.root = useRef("root");
        this.state = useState({
            hasInputFocused: false,
        });

        useAutofocus();
        this.inputRef = useRef("autofocus");

        // Close on outside click
        useExternalListener(window, "mousedown", (/** @type {MouseEvent} */ ev) => {
            // This target is kept in order to impeach close on outside click behavior if the click
            // has been initiated from the quickcreate root element (mouse selection in an input...)
            this.mousedownTarget = ev.target;
        });
        useExternalListener(
            window,
            "click",
            (/** @type {MouseEvent} */ ev) => {
                const target = this.mousedownTarget || ev.target;
                const gotClickedInside = this.root.el.contains(target);
                if (!gotClickedInside) {
                    this.fold();
                }
                this.mousedownTarget = null;
            },
            { capture: true }
        );

        // Key Navigation
        useHotkey("escape", () => this.fold());
    }

    get canShowExamples() {
        const { allowedGroupBys = [], examples = [] } = this.props.exampleData || {};
        const hasExamples = Boolean(examples.length);
        return hasExamples && allowedGroupBys.includes(this.props.groupByField.name);
    }

    get relatedFieldName() {
        return this.props.groupByField.string;
    }

    fold() {
        this.props.onFoldChange(true);
    }

    unfold() {
        this.props.onFoldChange(false);
    }

    validate() {
        const title = this.inputRef.el.value.trim();
        if (title.length) {
            this.props.onValidate(title);
            this.inputRef.el.value = "";
        }
    }

    showExamples() {
        this.dialog.add(KanbanColumnExamplesDialog, {
            examples: this.props.exampleData.examples,
            applyExamplesText:
                this.props.exampleData.applyExamplesText || _t("Use This For My Kanban"),
            applyExamples: (index) => {
                const { examples, foldField } = this.props.exampleData;
                const { columns, foldedColumns = [] } = examples[index];
                for (const groupName of columns) {
                    this.props.onValidate(groupName);
                }
                for (const groupName of foldedColumns) {
                    this.props.onValidate(groupName, foldField);
                }
            },
        });
    }

    onInputKeydown(ev) {
        if (ev.key === "Enter") {
            this.validate();
        }
    }
}
