# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

""" Modules (also called addons) management.

"""

from . import db, graph, loading, migration, module, registry, neutralize

from cashapp.modules.loading import load_modules, reset_modules_state

from cashapp.modules.module import (
    adapt_version,
    check_manifest_dependencies,
    get_module_path,
    get_module_resource,
    get_modules,
    get_modules_with_version,
    get_resource_from_path,
    get_resource_path,
    check_resource_path,
    initialize_sys_path,
    get_manifest,
    load_openerp_module,
)
