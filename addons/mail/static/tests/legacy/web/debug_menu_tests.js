/** @cashapp-module alias=@mail/../tests/web/debug_menu_tests default=false */
const test = QUnit.test; // QUnit.test()

import { manageMessages } from "@mail/js/tools/debug_manager";

import { registry } from "@web/core/registry";
import { click, getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";
import { assertSteps, step } from "@web/../tests/utils";
import {
    createWebClient,
    doAction,
    getActionManagerServerData,
} from "@web/../tests/webclient/helpers";

QUnit.module("debug menu");

test("Manage Messages", async (assert) => {
    patchWithCleanup(cashapp, { debug: "1" });
    const serverData = getActionManagerServerData();
    // Add fake "mail.message" model and arch
    serverData.models["mail.message"] = {
        fields: { name: { string: "Name", type: "char" } },
        records: [],
    };
    Object.assign(serverData.views, {
        "mail.message,false,list": "<list/>",
        "mail.message,false,form": "<form/>",
        "mail.message,false,search": "<search/>",
    });
    registry.category("debug").category("form").add("manageMessages", manageMessages);
    async function mockRPC(route, { method, model, kwargs }) {
        if (method === "has_access") {
            return true;
        }
        if (method === "web_search_read" && model === "mail.message") {
            step("message_read");
            const { context, domain } = kwargs;
            assert.strictEqual(context.default_res_id, 5);
            assert.strictEqual(context.default_res_model, "partner");
            assert.deepEqual(domain, ["&", ["res_id", "=", 5], ["model", "=", "partner"]]);
        }
    }
    const target = getFixture();
    const wc = await createWebClient({ serverData, mockRPC });
    await doAction(wc, 3, { viewType: "form", props: { resId: 5 } });
    await click(target, ".o_debug_manager .dropdown-toggle");
    const dropdownItems = target.querySelectorAll(".dropdown-menu .dropdown-item");
    assert.strictEqual(dropdownItems.length, 1);
    assert.strictEqual(dropdownItems[0].innerText.trim(), "Messages");

    await click(dropdownItems[0]);
    await assertSteps(["message_read"]);
    assert.strictEqual(
        target.querySelector(".o_breadcrumb .active > span").innerText.trim(),
        "Messages"
    );
});
