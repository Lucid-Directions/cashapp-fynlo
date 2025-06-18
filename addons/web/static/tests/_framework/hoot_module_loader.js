// @cashapp-module ignore
// ! WARNING: this module must be loaded after `module_loader` but cannot have dependencies !

(function (cashapp) {
    "use strict";

    if (cashapp.define.name.endsWith("(hoot)")) {
        return;
    }

    const name = `${cashapp.define.name} (hoot)`;
    cashapp.define = {
        [name](name, dependencies, factory) {
            return cashapp.loader.define(name, dependencies, factory, !name.endsWith(".hoot"));
        },
    }[name];
})(globalThis.cashapp);
