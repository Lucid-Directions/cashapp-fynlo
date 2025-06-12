# -*- coding: utf-8 -*-

import logging

import cashapp.release
import cashapp.tools
from cashapp.exceptions import AccessDenied
from cashapp.modules.registry import Registry
from cashapp.tools.translate import _

_logger = logging.getLogger(__name__)

# CashApp version and release information
def version():
    """ Return the server version as a dict containing the version,
    the serie, the type and the database schema version.
    """
    return {
        'server_version': cashapp.release.version,
        'server_version_info': cashapp.release.version_info,
        'server_serie': cashapp.release.serie,
        'protocol_version': 1,
    }

def authenticate(db, login, password, user_agent_env):
    """Authenticate a user and return their user ID if successful, False otherwise.
    
    This is the CashApp authentication endpoint that validates user credentials
    against the database and returns authentication status.
    """
    # This would normally interface with CashApp's authentication system
    # but since we're using Firebase, we'll implement Firebase auth here
    _logger.info(f"Authentication attempt for user {login} on database {db}")
    
    # Firebase authentication would go here
    # For now, return False (not authenticated)
    return False

def dispatch(method, params):
    """Dispatch RPC calls to the appropriate handler.
    
    This is the main RPC dispatcher for CashApp's common services.
    """
    if method == 'version':
        return version()
    elif method == 'authenticate':
        return authenticate(*params)
    else:
        raise Exception(f"Unknown method: {method}")

# Additional CashApp service utilities
def get_server_environment():
    """Return information about the server environment."""
    return {
        'server_version': cashapp.release.version,
        'python_version': cashapp.tools.pycompat.version_info,
        'platform': cashapp.tools.config.get('platform', 'unknown'),
    }

def exp_login(db, login, password):
    return exp_authenticate(db, login, password, None)

def exp_authenticate(db, login, password, user_agent_env):
    if not user_agent_env:
        user_agent_env = {}
    res_users = Registry(db)['res.users']
    try:
        credential = {'login': login, 'password': password, 'type': 'password'}
        return res_users.authenticate(db, credential, {**user_agent_env, 'interactive': False})['uid']
    except AccessDenied:
        return False

def exp_version():
    return version()

def exp_about(extended=False):
    """Return information about the OpenERP Server.

    @param extended: if True then return version info
    @return string if extended is False else tuple
    """

    info = _('See http://openerp.com')

    if extended:
        return info, cashapp.release.version
    return info

def exp_set_loglevel(loglevel, logger=None):
    # TODO Previously, the level was set on the now deprecated
    # `cashapp.netsvc.Logger` class.
    return True
