import { Domain } from "@web/core/domain";
import { serializeDate, serializeDateTime } from "@web/core/l10n/dates";
import { registry } from "@web/core/registry";
import { KeepLast } from "@web/core/utils/concurrency";
import { useAutofocus, useBus, useService } from "@web/core/utils/hooks";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { fuzzyTest } from "@web/core/utils/search";
import { _t } from "@web/core/l10n/translation";
import { SearchBarMenu } from "../search_bar_menu/search_bar_menu";

import { Component, useExternalListener, useRef, useState } from "@cashapp/owl";
import { useDropdownState } from "@web/core/dropdown/dropdown_hooks";
import { hasTouch } from "@web/core/browser/feature_detection";
const parsers = registry.category("parsers");

const CHAR_FIELDS = ["char", "html", "many2many", "many2one", "one2many", "text", "properties"];
const FOLDABLE_TYPES = ["properties", "many2one", "many2many"];

let nextItemId = 1;
const SUB_ITEMS_DEFAULT_LIMIT = 8;

export class SearchBar extends Component {
    static template = "web.SearchBar";
    static components = {
        SearchBarMenu,
    };
    static props = {
        autofocus: { type: Boolean, optional: true },
        slots: {
            type: Object,
            optional: true,
            shape: {
                default: { optional: true },
                "search-bar-additional-menu": { optional: true },
            },
        },
        toggler: {
            type: Object,
            optional: true,
        },
    };
    static defaultProps = {
        autofocus: true,
    };

    setup() {
        this.dialogService = useService("dialog");
        this.fields = this.env.searchModel.searchViewFields;
        this.searchItemsFields = this.env.searchModel.getSearchItems((f) => f.type === "field");
        this.root = useRef("root");
        this.ui = useService("ui");

        this.visibilityState = useState(this.props.toggler?.state || { showSearchBar: true });

        // core state
        this.state = useState({
            expanded: [],
            focusedIndex: 0,
            query: "",
            subItemsLimits: {},
        });

        // derived state
        this.items = useState([]);
        this.subItems = {};

        this.searchBarDropdownState = useDropdownState();

        this.orm = useService("orm");

        this.keepLast = new KeepLast();

        this.inputRef =
            this.env.config.disableSearchBarAutofocus || !this.props.autofocus
                ? useRef("autofocus")
                : useAutofocus({ mobile: this.props.toggler !== undefined }); // only force the focus on touch devices when the toggler is present on small devices

        useBus(this.env.searchModel, "focus-search", () => {
            this.inputRef.el.focus();
        });

        useBus(this.env.searchModel, "update", this.render);

        useExternalListener(window, "click", this.onWindowClick);
        useExternalListener(window, "keydown", this.onWindowKeydown);
    }

    /**
     * @param {number} id
     * @param {Object}
     */
    getSearchItem(id) {
        return this.env.searchModel.searchItems[id];
    }

    /**
     * @param {Object} [options={}]
     * @param {number[]} [options.expanded]
     * @param {number} [options.focusedIndex]
     * @param {string} [options.query]
     * @param {Object[]} [options.subItems]
     * @returns {Object[]}
     */
    async computeState(options = {}) {
        const query = "query" in options ? options.query : this.state.query;
        const expanded = "expanded" in options ? options.expanded : this.state.expanded;
        const focusedIndex =
            "focusedIndex" in options ? options.focusedIndex : this.state.focusedIndex;
        const subItems = "subItems" in options ? options.subItems : this.subItems;

        const tasks = [];
        for (const id of expanded) {
            const searchItem = this.getSearchItem(id);
            if (searchItem.type === "field" && searchItem.fieldType === "properties") {
                tasks.push({ id, prom: this.getSearchItemsProperties(searchItem) });
            } else if (!subItems[id]) {
                if (!this.state.subItemsLimits[id]) {
                    this.state.subItemsLimits[id] = SUB_ITEMS_DEFAULT_LIMIT;
                }
                tasks.push({ id, prom: this.computeSubItems(searchItem, query) });
            }
        }

        const prom = this.keepLast.add(Promise.all(tasks.map((task) => task.prom)));

        if (tasks.length) {
            const taskResults = await prom;
            tasks.forEach((task, index) => {
                subItems[task.id] = taskResults[index];
            });
        }

        this.state.expanded = expanded;
        this.state.query = query;
        this.state.focusedIndex = focusedIndex;
        this.subItems = subItems;

        this.inputRef.el.value = query;

        const trimmedQuery = this.state.query.trim();

        this.items.length = 0;
        if (!trimmedQuery) {
            return;
        }

        for (const searchItem of this.searchItemsFields) {
            this.items.push(...this.getItems(searchItem, trimmedQuery));
        }

        this.items.push({
            title: _t("Add a custom filter"),
            isAddCustomFilterButton: true,
        });
    }

    /**
     * @param {Object} searchItem
     * @param {string} trimmedQuery
     * @returns {Object[]}
     */
    getItems(searchItem, trimmedQuery) {
        const items = [];

        const isFieldProperty = searchItem.type === "field_property";
        const fieldType = this.getFieldType(searchItem);

        /** @todo do something with respect to localization (rtl) */
        let preposition = this.getPreposition(searchItem);

        if ((isFieldProperty && FOLDABLE_TYPES.includes(fieldType)) || fieldType === "properties") {
            // Do not chose preposition for foldable properties
            // or the properties item itself
            preposition = null;
        }

        if (["selection", "boolean", "tags"].includes(fieldType)) {
            const booleanOptions = [
                [true, _t("Yes")],
                [false, _t("No")],
            ];
            let options;
            if (isFieldProperty) {
                const { selection, tags } = searchItem.propertyFieldDefinition || {};
                options = selection || tags || booleanOptions;
            } else {
                options = this.fields[searchItem.fieldName].selection || booleanOptions;
            }
            for (const [value, label] of options) {
                if (fuzzyTest(trimmedQuery.toLowerCase(), label.toLowerCase())) {
                    items.push({
                        id: nextItemId++,
                        searchItemDescription: searchItem.description,
                        preposition,
                        searchItemId: searchItem.id,
                        label,
                        /** @todo check if searchItem.operator is fine (here and elsewhere) */
                        operator: searchItem.operator || "=",
                        value,
                        isFieldProperty,
                    });
                }
            }
            return items;
        }

        const parser = parsers.contains(fieldType) ? parsers.get(fieldType) : (str) => str;
        let value;
        try {
            switch (fieldType) {
                case "date": {
                    value = serializeDate(parser(trimmedQuery));
                    break;
                }
                case "datetime": {
                    value = serializeDateTime(parser(trimmedQuery));
                    break;
                }
                case "many2one": {
                    value = trimmedQuery;
                    break;
                }
                default: {
                    value = parser(trimmedQuery);
                }
            }
        } catch {
            return [];
        }

        const item = {
            id: nextItemId++,
            searchItemDescription: searchItem.description,
            preposition,
            searchItemId: searchItem.id,
            label: this.state.query,
            operator: searchItem.operator || (CHAR_FIELDS.includes(fieldType) ? "ilike" : "="),
            value,
            isFieldProperty,
        };

        if (isFieldProperty) {
            item.isParent = FOLDABLE_TYPES.includes(fieldType);
            item.unselectable = FOLDABLE_TYPES.includes(fieldType);
            item.propertyItemId = searchItem.propertyItemId;
        } else if (fieldType === "properties") {
            item.isParent = true;
            item.unselectable = true;
        } else if (fieldType === "many2one") {
            item.isParent = true;
        }

        if (item.isParent) {
            item.isExpanded = this.state.expanded.includes(item.searchItemId);
        }

        items.push(item);

        if (item.isExpanded) {
            if (searchItem.type === "field" && searchItem.fieldType === "properties") {
                for (const subItem of this.subItems[searchItem.id]) {
                    items.push(...this.getItems(subItem, trimmedQuery));
                }
            } else {
                items.push(...this.subItems[searchItem.id]);
            }
        }

        return items;
    }

    getPreposition(searchItem) {
        const fieldType = this.getFieldType(searchItem);
        return ["date", "datetime"].includes(fieldType) ? _t("at") : _t("for");
    }

    getFieldType(searchItem) {
        const { type } =
            searchItem.type === "field_property"
                ? searchItem.propertyFieldDefinition
                : this.fields[searchItem.fieldName];
        const fieldType = type === "reference" ? "char" : type;

        return fieldType;
    }

    /**
     * @param {Object} searchItem
     * @returns {Object[]}
     */
    getSearchItemsProperties(searchItem) {
        return this.env.searchModel.getSearchItemsProperties(searchItem);
    }

    /**
     * @param {Object} searchItem
     * @param {string} query
     * @returns {Object[]}
     */
    async computeSubItems(searchItem, query) {
        const field = this.fields[searchItem.fieldName];
        const context = { ...this.env.searchModel.domainEvalContext, ...field.context };
        let domain = [];
        if (searchItem.domain) {
            try {
                domain = new Domain(searchItem.domain).toList(context);
            } catch {
                // Pass
            }
        }
        const relation =
            searchItem.type === "field_property"
                ? searchItem.propertyFieldDefinition.comodel
                : field.relation;

        let nameSearchOperator = "ilike";
        if (query && query[0] === '"' && query[query.length - 1] === '"') {
            query = query.slice(1, -1);
            nameSearchOperator = "=";
        }
        const limitToFetch = this.state.subItemsLimits[searchItem.id] + 1;
        const options = await this.orm.call(relation, "name_search", [], {
            args: domain,
            operator: nameSearchOperator,
            context,
            limit: limitToFetch,
            name: query.trim(),
        });

        let showLoadMore = false;
        if (options.length === limitToFetch) {
            options.pop();
            showLoadMore = true;
        }

        const subItems = [];
        if (options.length) {
            const operator = searchItem.operator || "=";
            for (const [value, label] of options) {
                subItems.push({
                    id: nextItemId++,
                    isChild: true,
                    searchItemId: searchItem.id,
                    value,
                    label,
                    operator,
                });
            }
            if (showLoadMore) {
                subItems.push({
                    id: nextItemId++,
                    isChild: true,
                    searchItemId: searchItem.id,
                    label: _t("Load more"),
                    unselectable: true,
                    loadMore: () => {
                        this.state.subItemsLimits[searchItem.id] += SUB_ITEMS_DEFAULT_LIMIT;
                        const newSubItems = [...this.subItems];
                        newSubItems[searchItem.id] = undefined;
                        this.computeState({ subItems: newSubItems });
                    },
                });
            }
        } else {
            subItems.push({
                id: nextItemId++,
                isChild: true,
                searchItemId: searchItem.id,
                label: _t("(no result)"),
                unselectable: true,
            });
        }
        return subItems;
    }

    /**
     * @param {number} [index]
     */
    focusFacet(index) {
        const facets = this.root.el.getElementsByClassName("o_searchview_facet");
        if (facets.length) {
            if (index === undefined) {
                facets[facets.length - 1].focus();
            } else {
                facets[index].focus();
            }
        }
    }

    /**
     * @param {Object} facet
     */
    removeFacet(facet) {
        this.env.searchModel.deactivateGroup(facet.groupId);
        this.inputRef.el.focus();
    }

    resetState(options = { focus: true }) {
        this.state.subItemsLimits = {};
        this.computeState({ expanded: [], focusedIndex: 0, query: "", subItems: [] });
        if (options.focus) {
            this.inputRef.el.focus();
        }
    }

    /**
     * @param {Object} item
     */
    selectItem(item) {
        if (item.isAddCustomFilterButton) {
            return this.env.searchModel.spawnCustomFilterDialog();
        }

        const searchItem = this.getSearchItem(item.searchItemId);
        if (
            (searchItem.type === "field" && searchItem.fieldType === "properties") ||
            (searchItem.type === "field_property" && item.unselectable)
        ) {
            this.toggleItem(item, !item.isExpanded);
            return;
        }

        if (!item.unselectable) {
            const { searchItemId, label, operator, value } = item;
            const autoCompleteValues = { label, operator, value };
            if (value && value[0] === '"' && value[value.length - 1] === '"') {
                autoCompleteValues.value = value.slice(1, -1);
                autoCompleteValues.label = label.slice(1, -1);
                autoCompleteValues.operator = "=";
                autoCompleteValues.enforceEqual = true;
            }
            this.env.searchModel.addAutoCompletionValues(searchItemId, autoCompleteValues);
        }

        if (item.loadMore) {
            item.loadMore();
        } else {
            this.resetState();
        }
    }

    /**
     * @param {Object} item
     * @param {boolean} shouldExpand
     */
    toggleItem(item, shouldExpand) {
        const id = item.searchItemId;
        const expanded = [...this.state.expanded];
        const index = expanded.findIndex((id0) => id0 === id);
        if (shouldExpand === true) {
            if (index < 0) {
                expanded.push(id);
            }
        } else {
            if (index >= 0) {
                expanded.splice(index, 1);
            }
        }
        this.computeState({ expanded });
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    onFacetLabelClick(target, facet) {
        const { domain, groupId } = facet;
        if (this.env.searchModel.canOrderByCount && facet.type === "groupBy") {
            this.env.searchModel.switchGroupBySort();
            return;
        } else if (!domain) {
            return;
        }
        const { resModel } = this.env.searchModel;
        this.dialogService.add(DomainSelectorDialog, {
            resModel,
            domain,
            context: this.env.searchModel.domainEvalContext,
            onConfirm: (domain) => this.env.searchModel.splitAndAddDomain(domain, groupId),
            disableConfirmButton: (domain) => domain === `[]`,
            title: _t("Modify Condition"),
            isDebugMode: this.env.searchModel.isDebugMode,
        });
    }

    /**
     * @param {Object} facet
     * @param {number} facetIndex
     * @param {KeyboardEvent} ev
     */
    onFacetKeydown(facet, facetIndex, ev) {
        switch (ev.key) {
            case "ArrowLeft": {
                if (facetIndex === 0) {
                    this.inputRef.el.focus();
                } else {
                    this.focusFacet(facetIndex - 1);
                }
                break;
            }
            case "ArrowRight": {
                const facets = this.root.el.getElementsByClassName("o_searchview_facet");
                if (facetIndex === facets.length - 1) {
                    this.inputRef.el.focus();
                } else {
                    this.focusFacet(facetIndex + 1);
                }
                break;
            }
            case "Backspace": {
                this.removeFacet(facet);
                break;
            }
        }
    }

    /**
     * @param {Object} facet
     */
    onFacetRemove(facet) {
        this.removeFacet(facet);
    }

    /**
     * @param {number} index
     */
    onItemMousemove(focusedIndex) {
        this.state.focusedIndex = focusedIndex;
        this.inputRef.el.focus();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onSearchKeydown(ev) {
        if (ev.isComposing) {
            // This case happens with an IME for example: we let it handle all key events.
            return;
        }
        const focusedItem = this.items[this.state.focusedIndex];
        let focusedIndex;
        switch (ev.key) {
            case "ArrowDown":
                ev.preventDefault();
                if (this.items.length) {
                    if (this.state.focusedIndex >= this.items.length - 1) {
                        focusedIndex = 0;
                    } else {
                        focusedIndex = this.state.focusedIndex + 1;
                    }
                } else {
                    this.env.searchModel.trigger("focus-view");
                }
                break;
            case "ArrowUp":
                ev.preventDefault();
                if (this.items.length) {
                    if (
                        this.state.focusedIndex === 0 ||
                        this.state.focusedIndex > this.items.length - 1
                    ) {
                        focusedIndex = this.items.length - 1;
                    } else {
                        focusedIndex = this.state.focusedIndex - 1;
                    }
                }
                break;
            case "ArrowLeft":
                if (focusedItem && focusedItem.isParent && focusedItem.isExpanded) {
                    ev.preventDefault();
                    this.toggleItem(focusedItem, false);
                } else if (focusedItem && focusedItem.isChild) {
                    ev.preventDefault();
                    focusedIndex = this.items.findIndex(
                        (item) => item.isParent && item.searchItemId === focusedItem.searchItemId
                    );
                } else if (focusedItem && focusedItem.isFieldProperty) {
                    ev.preventDefault();
                    focusedIndex = this.items.findIndex(
                        (item) => item.isParent && item.searchItemId === focusedItem.propertyItemId
                    );
                } else if (ev.target.selectionStart === 0) {
                    // focus rightmost facet if any.
                    this.focusFacet();
                } else {
                    // do nothing and navigate inside text
                }
                break;
            case "ArrowRight":
                if (ev.target.selectionStart === this.state.query.length) {
                    if (focusedItem && focusedItem.isParent) {
                        ev.preventDefault();
                        if (focusedItem.isExpanded) {
                            focusedIndex = this.state.focusedIndex + 1;
                        } else if (!ev.repeat) {
                            this.toggleItem(focusedItem, true);
                        }
                    } else if (ev.target.selectionStart === this.state.query.length) {
                        // Priority 3: focus leftmost facet if any.
                        this.focusFacet(0);
                    }
                }
                break;
            case "Backspace":
                if (!this.state.query.length) {
                    const facets = this.env.searchModel.facets;
                    if (facets.length) {
                        this.removeFacet(facets[facets.length - 1]);
                    }
                }
                break;
            case "Enter":
                if (!this.state.query.length) {
                    this.env.searchModel.search(); /** @todo keep this thing ?*/
                    break;
                } else if (focusedItem) {
                    ev.preventDefault(); // keep the focus inside the search bar
                    this.selectItem(focusedItem);
                }
                break;
            case "Tab":
                if (this.state.query.length && focusedItem) {
                    ev.preventDefault(); // keep the focus inside the search bar
                    this.selectItem(focusedItem);
                }
                break;
            case "Escape":
                this.resetState();
                break;
        }

        if (focusedIndex !== undefined) {
            this.state.focusedIndex = focusedIndex;
        }
    }

    onSearchClick() {
        if (!hasTouch() && !this.inputRef.el.value.length) {
            this.searchBarDropdownState.open();
        }
    }

    /**
     * @param {InputEvent} ev
     */
    onSearchInput(ev) {
        if (!hasTouch()) {
            this.searchBarDropdownState.close();
        }
        const query = ev.target.value;
        if (query.trim()) {
            this.computeState({ query, expanded: [], focusedIndex: 0, subItems: [] });
        } else if (this.items.length) {
            this.resetState();
        }
    }

    onClickSearchIcon() {
        const focusedItem = this.items[this.state.focusedIndex];
        if (!this.state.query.length) {
            this.env.searchModel.search();
        } else if (focusedItem) {
            this.selectItem(focusedItem);
        }
    }

    onToggleSearchBar() {
        this.state.showSearchBar = !this.state.showSearchBar;
    }

    /**
     * @param {MouseEvent} ev
     */
    onWindowClick(ev) {
        if (this.items.length && !this.root.el.contains(ev.target)) {
            this.resetState({ focus: false });
        }
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onWindowKeydown(ev) {
        if (this.items.length && ev.key === "Escape") {
            this.resetState();
        }
    }
}
