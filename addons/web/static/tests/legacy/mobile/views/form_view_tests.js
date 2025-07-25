/** @cashapp-module alias=@web/../tests/mobile/views/form_view_tests default=false */

import { registry } from "@web/core/registry";
import {
    click,
    editInput,
    getFixture,
    makeDeferred,
    nextTick,
    patchWithCleanup,
} from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { AttachDocumentWidget } from "@web/views/widgets/attach_document/attach_document";

let fixture;
let serverData;

const serviceRegistry = registry.category("services");

QUnit.module("Mobile Views", ({ beforeEach }) => {
    beforeEach(() => {
        setupViewRegistries();
        fixture = getFixture();
        serverData = {
            models: {
                partner: {
                    fields: {
                        display_name: { type: "char", string: "Display Name" },
                        trululu: { type: "many2one", string: "Trululu", relation: "partner" },
                        boolean: { type: "boolean", string: "Bool" },
                    },
                    records: [
                        { id: 1, display_name: "first record", trululu: 4 },
                        { id: 2, display_name: "second record", trululu: 1 },
                        { id: 4, display_name: "aaa" },
                    ],
                },
            },
        };
    });

    QUnit.module("FormView");

    QUnit.test(`statusbar buttons are correctly rendered in mobile`, async (assert) => {
        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <button string="Confirm" />
                        <button string="Do it" />
                    </header>
                    <sheet>
                        <group>
                            <button name="display_name" />
                        </group>
                    </sheet>
                </form>
            `,
        });

        // open the dropdown
        await click(fixture, ".o_cp_action_menus button:has(.fa-cog)");
        assert.containsOnce(fixture, ".o-dropdown--menu:visible", "dropdown should be visible");
        assert.containsN(
            fixture,
            ".o-dropdown--menu button",
            2,
            "dropdown should contain 2 buttons"
        );
    });

    QUnit.test(`statusbar widgets should appear in the CogMenu dropdown`, async (assert) => {
        serviceRegistry.add("http", {
            start: () => ({}),
        });

        await makeView({
            type: "form",
            resModel: "partner",
            serverData,
            resId: 2,
            arch: `
                    <form>
                        <header>
                            <widget name="attach_document" string="Attach document" />
                            <button string="Ciao" invisible="display_name == 'first record'" />
                        </header>
                        <sheet>
                            <group>
                                <field name="display_name" />
                            </group>
                        </sheet>
                    </form>
                `,
        });

        // Now there should an action dropdown, because there are two visible buttons
        assert.containsOnce(
            fixture,
            ".o_cp_action_menus button:has(.fa-cog)",
            "should have 'CogMenu' dropdown"
        );

        await click(fixture, ".o_cp_action_menus button:has(.fa-cog)");
        assert.containsN(
            fixture,
            ".o-dropdown--menu button",
            2,
            "should have 2 buttons in the dropdown"
        );

        // change display_name to update buttons modifiers and make one button visible
        await editInput(fixture, ".o_field_widget[name=display_name] input", "first record");

        assert.containsOnce(
            fixture,
            ".o-dropdown--menu button",
            "should have 1 button in the dropdown"
        );
    });

    QUnit.test(`CogMenu dropdown should keep its open/close state`, async function (assert) {
        await makeView({
            type: "form",
            resModel: "partner",
            serverData,
            arch: `
                    <form>
                        <header>
                            <button string="Just more than one" />
                            <button string="Confirm" invisible="display_name == ''" />
                            <button string="Do it" invisible="display_name != ''" />
                        </header>
                        <sheet>
                            <field name="display_name" />
                        </sheet>
                    </form>
                `,
        });

        assert.containsOnce(
            fixture,
            ".o_cp_action_menus button:has(.fa-cog)",
            "should have a 'CogMenu' dropdown"
        );
        assert.doesNotHaveClass(
            fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
            "show",
            "dropdown should be closed"
        );

        // open the dropdown
        await click(fixture, ".o_cp_action_menus button:has(.fa-cog)");
        assert.hasClass(
            fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
            "show",
            "dropdown should be opened"
        );

        // change display_name to update buttons' modifiers
        await editInput(fixture, ".o_field_widget[name=display_name] input", "test");
        assert.containsOnce(
            fixture,
            ".o_cp_action_menus button:has(.fa-cog)",
            "should have a 'CogMenu' dropdown"
        );
        assert.hasClass(
            fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
            "show",
            "dropdown should still be opened"
        );
    });

    QUnit.test(
        `CogMenu dropdown's open/close state shouldn't be modified after 'onchange'`,
        async function (assert) {
            serverData.models.partner.onchanges = {
                display_name: async () => {},
            };

            const onchangeDef = makeDeferred();

            await makeView({
                type: "form",
                resModel: "partner",
                serverData,
                arch: `
                    <form>
                        <header>
                            <button name="create" string="Create Invoice" type="action" />
                            <button name="send" string="Send by Email" type="action" />
                        </header>
                        <sheet>
                            <field name="display_name" />
                        </sheet>
                    </form>
                `,
                mockRPC(route, { method, args }) {
                    if (method === "onchange" && args[2][0] === "display_name") {
                        return onchangeDef;
                    }
                },
            });

            assert.containsOnce(
                fixture,
                ".o_cp_action_menus button:has(.fa-cog)",
                "statusbar should contain a dropdown"
            );
            assert.doesNotHaveClass(
                fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
                "show",
                "dropdown should be closed"
            );

            await editInput(fixture, ".o_field_widget[name=display_name] input", "before onchange");
            await click(fixture, ".o_cp_action_menus button:has(.fa-cog)");
            assert.hasClass(
                fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
                "show",
                "dropdown should be opened"
            );

            onchangeDef.resolve({ value: { display_name: "after onchange" } });
            await nextTick();
            assert.strictEqual(
                fixture.querySelector(".o_field_widget[name=display_name] input").value,
                "after onchange"
            );
            assert.hasClass(
                fixture.querySelector(".o_cp_action_menus button:has(.fa-cog)"),
                "show",
                "dropdown should still be opened"
            );
        }
    );

    QUnit.test(
        `preserve current scroll position on form view while closing dialog`,
        async function (assert) {
            serverData.views = {
                "partner,false,kanban": `
                    <kanban>
                        <templates>
                            <t t-name="card">
                                <field name="display_name" />
                            </t>
                        </templates>
                    </kanban>
                `,
                "partner,false,search": `
                    <search />
                `,
            };

            await makeView({
                type: "form",
                resModel: "partner",
                resId: 2,
                serverData,
                arch: `
                    <form>
                        <sheet>
                            <p style="height:500px" />
                            <field name="trululu" />
                            <p style="height:500px" />
                        </sheet>
                    </form>
                `,
            });

            let position = { top: 0, left: 0 };
            patchWithCleanup(window, {
                scrollTo(newPosition) {
                    position = newPosition;
                },
                get scrollX() {
                    return position.left;
                },
                get scrollY() {
                    return position.top;
                },
            });

            window.scrollTo({ top: 265, left: 0 });
            assert.strictEqual(window.scrollY, 265, "Should have scrolled 265 px vertically");
            assert.strictEqual(window.scrollX, 0, "Should be 0 px from left as it is");

            // click on m2o field
            await click(fixture, ".o_field_many2one input");
            // assert.strictEqual(window.scrollY, 0, "Should have scrolled to top (0) px");
            assert.containsOnce(
                fixture,
                ".modal.o_modal_full",
                "there should be a many2one modal opened in full screen"
            );

            // click on back button
            await click(fixture, ".modal .modal-header .oi-arrow-left");
            assert.strictEqual(
                window.scrollY,
                265,
                "Should have scrolled back to 265 px vertically"
            );
            assert.strictEqual(window.scrollX, 0, "Should be 0 px from left as it is");
        }
    );

    QUnit.test("attach_document widget also works inside a dropdown", async (assert) => {
        let fileInput;
        patchWithCleanup(AttachDocumentWidget.prototype, {
            setup() {
                super.setup();
                fileInput = this.fileInput;
            },
        });

        serviceRegistry.add("http", {
            start: () => ({
                post: (route, params) => {
                    assert.step("post");
                    assert.strictEqual(route, "/web/binary/upload_attachment");
                    assert.strictEqual(params.model, "partner");
                    assert.strictEqual(params.id, 1);
                    return '[{ "id": 5 }, { "id": 2 }]';
                },
            }),
        });

        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: `
                <form>
                    <header>
                        <button string="Confirm" />
                        <widget name="attach_document" string="Attach Document"/>
                    </header>
                    <sheet>
                        <group>
                            <button name="display_name" />
                        </group>
                    </sheet>
                </form>
            `,
        });

        await click(fixture, ".o_cp_action_menus button:has(.fa-cog)");
        await click(fixture, ".o_attach_document");
        fileInput.dispatchEvent(new Event("change"));
        await nextTick();
        assert.verifySteps(["post"]);
    });
});
