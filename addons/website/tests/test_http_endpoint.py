# Part of CashApp. See LICENSE file for full copyright and licensing details.
from cashapp.tests import HttpCase, tagged


@tagged('-at_install', 'post_install')
class TestHttpEndPoint(HttpCase):

    def test_can_clear_routing_map_during_render(self):
        """
        The routing map might be cleared while rendering a qweb view.
        For example, if an asset bundle is regenerated the old one is unlinked,
        which causes a cache clearing.
        This test ensures that the rendering still works, even in this case.
        """
        homepage_view = self.env['ir.ui.view'].search([
            ('website_id', '=', self.env.ref('website.default_website').id),
            ('key', '=', 'website.homepage'),
        ])
        self.env['ir.ui.view'].create({
            'name': 'Add cache clear to Home',
            'type': 'qweb',
            'mode': 'extension',
            'inherit_id': homepage_view.id,
            'arch_db': """
                <t t-call="website.layout" position="before">
                    <t t-esc="website.env.registry.clear_cache('routing')"/>
                </t>
            """,
        })

        r = self.url_open('/')
        r.raise_for_status()

    def test_redirect_double_slash(self):
        res = self.url_open('/test_http//greeting', allow_redirects=False)
        self.assertIn(res.status_code, (301, 308))
        self.assertURLEqual(res.headers.get('Location'), '/test_http/greeting')

    def test_404(self):
        # the main purpose of this test is to cover the http._serve_db handle_error
        self.url_open('/not_found')
