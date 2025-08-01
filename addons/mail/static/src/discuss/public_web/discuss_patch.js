import { Discuss } from "@mail/core/public_web/discuss";
import { Call } from "@mail/discuss/call/common/call";
import { useState } from "@cashapp/owl";
import { useService } from "@web/core/utils/hooks";

import { patch } from "@web/core/utils/patch";

Object.assign(Discuss.components, { Call });

patch(Discuss.prototype, {
    setup() {
        super.setup(...arguments);
        this.rtc = useState(useService("discuss.rtc"));
    },
});
