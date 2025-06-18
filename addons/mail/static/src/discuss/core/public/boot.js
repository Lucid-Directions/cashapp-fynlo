import { DiscussClientAction } from "@mail/core/public_web/discuss_client_action";

import { mount, whenReady } from "@cashapp/owl";

import { getTemplate } from "@web/core/templates";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { registry } from "@web/core/registry";
import { makeEnv, startServices } from "@web/env";

(async function boot() {
    await whenReady();

    const mainComponentsRegistry = registry.category("main_components");
    mainComponentsRegistry.add("DiscussClientAction", { Component: DiscussClientAction });

    const env = makeEnv();
    await startServices(env);
    env.services["mail.store"].insert(cashapp.discuss_data);
    cashapp.isReady = true;
    const root = await mount(MainComponentsContainer, document.body, {
        env,
        getTemplate,
        dev: env.debug,
    });
    cashapp.__WOWL_DEBUG__ = { root };
})();
