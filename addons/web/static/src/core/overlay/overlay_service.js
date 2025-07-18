import { markRaw, reactive } from "@cashapp/owl";
import { registry } from "../registry";
import { OverlayContainer } from "./overlay_container";

const mainComponents = registry.category("main_components");
const services = registry.category("services");

/**
 * @typedef {{
 *  env?: object;
 *  onRemove?: () => void;
 *  sequence?: number;
 *  rootId?: string;
 * }} OverlayServiceAddOptions
 */

export const overlayService = {
    start() {
        let nextId = 0;
        const overlays = reactive({});

        mainComponents.add("OverlayContainer", {
            Component: OverlayContainer,
            props: { overlays },
        });

        const remove = (id, onRemove = () => {}) => {
            if (id in overlays) {
                onRemove();
                delete overlays[id];
            }
        };

        /**
         * @param {typeof Component} component
         * @param {object} props
         * @param {OverlayServiceAddOptions} [options]
         * @returns {() => void}
         */
        const add = (component, props, options = {}) => {
            const id = ++nextId;
            const removeCurrentOverlay = () => remove(id, options.onRemove);
            overlays[id] = {
                id,
                component,
                env: options.env && markRaw(options.env),
                props,
                remove: removeCurrentOverlay,
                sequence: options.sequence ?? 50,
                rootId: options.rootId,
            };
            return removeCurrentOverlay;
        };

        return { add, overlays };
    },
};

services.add("overlay", overlayService);
