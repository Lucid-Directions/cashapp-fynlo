import { expect, test } from "@cashapp/hoot";
import { press, queryAllTexts } from "@cashapp/hoot-dom";
import { animationFrame } from "@cashapp/hoot-mock";
import { Component, xml } from "@cashapp/owl";
import {
    contains,
    defineActions,
    defineMenus,
    getService,
    mountWithCleanup,
    useTestClientAction,
} from "@web/../tests/web_test_helpers";

import { Dialog } from "@web/core/dialog/dialog";
import { WebClient } from "@web/webclient/webclient";

defineMenus([
    { id: 0 }, // prevents auto-loading the first action
    { id: 1, name: "Contact", actionID: 1001 },
    {
        id: 2,
        name: "Sales",
        actionID: 1002,
        appID: 2,
        children: [
            {
                id: 3,
                name: "Info",
                appID: 2,
                actionID: 1003,
            },
            {
                id: 4,
                name: "Report",
                appID: 2,
                actionID: 1004,
            },
        ],
    },
]);
const testAction = useTestClientAction();
defineActions([
    { ...testAction, id: 1001, params: { description: "Id 1" } },
    { ...testAction, id: 1003, params: { description: "Info" } },
    { ...testAction, id: 1004, params: { description: "Report" } },
]);

test.tags("desktop");
test("displays only apps if the search value is '/'", async () => {
    await mountWithCleanup(WebClient);
    expect(".o_menu_brand").toHaveCount(0);

    await press(["control", "k"]);
    await animationFrame();
    await contains(".o_command_palette_search input").edit("/", { confirm: false });
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command_category").toHaveCount(1);
    expect(".o_command").toHaveCount(2);
    expect(queryAllTexts(".o_command_name")).toEqual(["Contact", "Sales"]);
});

test.tags("desktop");
test("displays apps and menu items if the search value is not only '/'", async () => {
    await mountWithCleanup(WebClient);

    await press(["control", "k"]);
    await animationFrame();
    await contains(".o_command_palette_search input").edit("/sal", { confirm: false });
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command").toHaveCount(3);
    expect(queryAllTexts(".o_command_name")).toEqual(["Sales", "Sales / Info", "Sales / Report"]);
});

test.tags("desktop");
test("opens an app", async () => {
    await mountWithCleanup(WebClient);
    expect(".o_menu_brand").toHaveCount(0);

    await press(["control", "k"]);
    await animationFrame();
    await contains(".o_command_palette_search input").edit("/", { confirm: false });
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);

    await press("enter");
    await animationFrame();
    // empty screen for now, wait for actual action to show up
    await animationFrame();
    expect(".o_menu_brand").toHaveText("Contact");
    expect(".test_client_action").toHaveText("ClientAction_Id 1");
});

test.tags("desktop");
test("opens a menu items", async () => {
    await mountWithCleanup(WebClient);
    expect(".o_menu_brand").toHaveCount(0);

    await press(["control", "k"]);
    await animationFrame();
    await contains(".o_command_palette_search input").edit("/sal", { confirm: false });
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".o_command_category").toHaveCount(2);

    await contains("#o_command_2").click();
    await animationFrame();
    // empty screen for now, wait for actual action to show up
    await animationFrame();
    expect(".o_menu_brand").toHaveText("Sales");
    expect(".test_client_action").toHaveText("ClientAction_Report");
});

test.tags("desktop");
test("open a menu item when a dialog is displayed", async () => {
    class CustomDialog extends Component {
        static template = xml`<Dialog contentClass="'test'">content</Dialog>`;
        static components = { Dialog };
        static props = ["*"];
    }

    await mountWithCleanup(WebClient);
    expect(".o_menu_brand").toHaveCount(0);
    expect(".modal .test").toHaveCount(0);

    getService("dialog").add(CustomDialog);
    await animationFrame();
    expect(".modal .test").toHaveCount(1);

    await press(["control", "k"]);
    await animationFrame();
    await contains(".o_command_palette_search input").edit("/sal", { confirm: false });
    await animationFrame();
    expect(".o_command_palette").toHaveCount(1);
    expect(".modal .test").toHaveCount(1);

    await contains("#o_command_2").click();
    await animationFrame();
    expect(".o_menu_brand").toHaveText("Sales");
});
