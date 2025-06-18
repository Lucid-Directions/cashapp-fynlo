# Part of CashApp. See LICENSE file for full copyright and licensing details.
from cashapp.tests import HttpCase, tagged


@tagged("post_install", "-at_install")
class TestDiscussAction(HttpCase):
    def test_go_back_to_thread_from_breadcrumbs(self):
        self.start_tour(
            "/cashapp/discuss?active_id=mail.box_inbox",
            "discuss_go_back_to_thread_from_breadcrumbs.js",
            login="admin",
        )
