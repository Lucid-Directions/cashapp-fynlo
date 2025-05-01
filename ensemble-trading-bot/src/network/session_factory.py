"""
Centralized session management module.
"""

import os
import sys
import logging
import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import socket
import dns.resolver
from .dns_resolver import DirectIPAdapter, patch_socket_getaddrinfo

# Remove the recursion limit increase as it masks the real issue
# sys.setrecursionlimit(5000)

# Setup logging
logger = logging.getLogger(__name__)

# Define fallback DNS servers
FALLBACK_DNS = [
    "8.8.8.8",  # Google DNS
    "1.1.1.1",  # Cloudflare DNS
    "9.9.9.9",  # Quad9 DNS
    "208.67.222.222",  # OpenDNS
]

# Define direct IP mappings for critical services
DIRECT_IPS = {
    "api-fxpractice.oanda.com": ["104.18.34.254", "172.64.153.2"],
    "query2.finance.yahoo.com": ["87.248.114.11", "87.248.114.12"],
    "query1.finance.yahoo.com": ["87.248.114.11", "87.248.114.12"],
    "newsapi.org": ["54.204.239.227", "52.7.71.139"], # Add NewsAPI direct IPs
}

# Global variables to track socket patching state
_original_getaddrinfo = None
_patching_active = False
_in_progress_lookups = set()


def create_reliable_session(timeout=30, max_retries=3, use_direct_ip=False):
    """
    Create a requests session with reliability features.

    Args:
        timeout (int): Request timeout in seconds
        max_retries (int): Maximum number of retries for failed requests
        use_direct_ip (bool): Whether to use direct IP addressing for known domains

    Returns:
        requests.Session: Configured session
    """
    try:
        session = requests.Session()

        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
        )

        # Create adapter with retry strategy
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # Set default timeout
        session.timeout = timeout

        # Patch socket.getaddrinfo to use our DNS resolution strategy
        global _original_getaddrinfo, _patching_active

        # Only apply the patch if it hasn't been applied yet
        if not _patching_active:
            _patching_active = True

            if _original_getaddrinfo is None:
                _original_getaddrinfo = socket.getaddrinfo

            def patched_getaddrinfo(host, port, *args, **kwargs):
                # Create a unique identifier for this lookup request
                lookup_id = f"{host}:{port}"

                # Check if we're already processing this exact lookup
                if lookup_id in _in_progress_lookups:
                    logger.debug(f"Avoiding recursion for {host}:{port}")
                    return _original_getaddrinfo(host, port, *args, **kwargs)

                # Add this lookup to the in-progress set
                _in_progress_lookups.add(lookup_id)

                try:
                    # Check if we have direct IPs for this host and direct IP mode is enabled
                    if use_direct_ip and host in DIRECT_IPS:
                        logger.info(f"Using direct IP for {host}")
                        for ip in DIRECT_IPS[host]:
                            try:
                                return _original_getaddrinfo(ip, port, *args, **kwargs)
                            except socket.gaierror:
                                continue

                    # Try original resolution
                    try:
                        return _original_getaddrinfo(host, port, *args, **kwargs)
                    except socket.gaierror as e:
                        # If direct mode is enabled, try fallback DNS
                        if use_direct_ip:
                            # Try each fallback DNS server
                            for dns_server in FALLBACK_DNS:
                                try:
                                    resolver = dns.resolver.Resolver()
                                    resolver.nameservers = [dns_server]
                                    answers = resolver.resolve(host, "A")
                                    for answer in answers:
                                        try:
                                            return _original_getaddrinfo(
                                                str(answer), port, *args, **kwargs
                                            )
                                        except socket.gaierror:
                                            continue
                                except Exception as dns_err:
                                    logger.warning(
                                        f"Failed to resolve {host} using DNS {dns_server}: {str(dns_err)}"
                                    )
                                    continue

                        # If we get here, all resolution attempts failed
                        raise e

                finally:
                    # Always remove the lookup from in-progress set
                    _in_progress_lookups.discard(lookup_id)

            # Apply the patch
            socket.getaddrinfo = patched_getaddrinfo
            logger.info("Successfully patched socket.getaddrinfo")

        return session

    except Exception as e:
        logger.error(f"Error creating reliable session: {str(e)}")
        # Return a basic session as fallback
        return requests.Session()


def create_direct_ip_session():
    """
    Create a session specifically configured for direct IP connections.
    This is a convenience wrapper around create_reliable_session.

    Returns:
        requests.Session: Session configured for direct IP connections
    """
    return create_reliable_session(use_direct_ip=True)


def patch_requests_library():
    """
    Patch the requests library to use direct IP addressing globally.
    Use this with caution as it affects all requests in the application.
    """
    # Save original request function
    # Unused variable: original_request = requests.api.request

    # Create a session for patched requests
    direct_ip_session = create_direct_ip_session()

    # Define patched request function
    def patched_request(method, url, **kwargs):
        return direct_ip_session.request(method=method, url=url, **kwargs)

    # Apply the patch
    requests.api.request = patched_request
    requests.get = lambda url, **kwargs: patched_request("get", url, **kwargs)
    requests.post = lambda url, **kwargs: patched_request("post", url, **kwargs)
    requests.put = lambda url, **kwargs: patched_request("put", url, **kwargs)
    requests.delete = lambda url, **kwargs: patched_request("delete", url, **kwargs)

    logger.info("Successfully patched requests library to use direct IP addressing")
