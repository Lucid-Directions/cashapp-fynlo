/** @cashapp-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { resizeTextArea } from "@web/core/utils/autoresize";

publicWidget.registry.SurveyPrintWidget = publicWidget.Widget.extend({
    selector: '.o_survey_print',
    events: {
        'click .o_survey_user_results_print': '_onPrintUserResultsClick',
    },

    //--------------------------------------------------------------------------
    // Widget
    //--------------------------------------------------------------------------

    /**
    * @override
    */
    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            // Will allow the textarea to resize if any carriage return instead of showing scrollbar.
            self.$('textarea').each(function () {
                resizeTextArea(this);
            });
        });
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    _onPrintUserResultsClick: function () {
        window.print();
    },

});

export default publicWidget.registry.SurveyPrintWidget;
