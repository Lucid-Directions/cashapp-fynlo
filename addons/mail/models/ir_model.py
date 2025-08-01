# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import _, api, fields, models
from cashapp.exceptions import UserError


class IrModel(models.Model):
    _inherit = 'ir.model'
    _order = 'is_mail_thread DESC, name ASC'

    is_mail_thread = fields.Boolean(
        string="Has Mail Thread", default=False,
    )
    is_mail_activity = fields.Boolean(
        string="Has Mail Activity", default=False,
    )
    is_mail_blacklist = fields.Boolean(
        string="Has Mail Blacklist", default=False,
    )

    def unlink(self):
        """ Delete mail data (followers, messages, activities) associated with
        the models being deleted.
        """
        if not self:
            return True

        # Delete followers, messages and attachments for models that will be unlinked.
        mail_models = self.search([
            ('model', 'in', ('mail.activity', 'mail.activity.type', 'mail.followers', 'mail.message'))
        ], order='id')

        if not (self & mail_models):
            models = tuple(self.mapped('model'))
            model_ids = tuple(self.ids)

            query = "DELETE FROM mail_activity WHERE res_model_id IN %s"
            self.env.cr.execute(query, [model_ids])

            query = "DELETE FROM mail_activity_type WHERE res_model IN %s"
            self.env.cr.execute(query, [models])

            query = "DELETE FROM mail_followers WHERE res_model IN %s"
            self.env.cr.execute(query, [models])

            query = "DELETE FROM mail_message WHERE model in %s"
            self.env.cr.execute(query, [models])

        # Get files attached solely to the models being deleted (and none other)
        models = tuple(self.mapped('model'))
        query = """
            SELECT DISTINCT store_fname
            FROM ir_attachment
            WHERE res_model IN %s
            EXCEPT
            SELECT store_fname
            FROM ir_attachment
            WHERE res_model not IN %s;
        """
        self.env.cr.execute(query, [models, models])
        fnames = self.env.cr.fetchall()

        query = """DELETE FROM ir_attachment WHERE res_model in %s"""
        self.env.cr.execute(query, [models])

        for (fname,) in fnames:
            self.env['ir.attachment']._file_delete(fname)

        return super(IrModel, self).unlink()

    def write(self, vals):
        if self and ('is_mail_thread' in vals or 'is_mail_activity' in vals or 'is_mail_blacklist' in vals):
            if any(rec.state != 'manual' for rec in self):
                raise UserError(_('Only custom models can be modified.'))
            if 'is_mail_thread' in vals and any(rec.is_mail_thread > vals['is_mail_thread'] for rec in self):
                raise UserError(_('Field "Mail Thread" cannot be changed to "False".'))
            if 'is_mail_activity' in vals and any(rec.is_mail_activity > vals['is_mail_activity'] for rec in self):
                raise UserError(_('Field "Mail Activity" cannot be changed to "False".'))
            if 'is_mail_blacklist' in vals and any(rec.is_mail_blacklist > vals['is_mail_blacklist'] for rec in self):
                raise UserError(_('Field "Mail Blacklist" cannot be changed to "False".'))
            res = super(IrModel, self).write(vals)
            self.env.flush_all()
            # setup models; this reloads custom models in registry
            self.pool.setup_models(self._cr)
            # update database schema of models
            models = self.pool.descendants(self.mapped('model'), '_inherits')
            self.pool.init_models(self._cr, models, dict(self._context, update_custom_fields=True))
        else:
            res = super(IrModel, self).write(vals)
        return res

    def _reflect_model_params(self, model):
        vals = super(IrModel, self)._reflect_model_params(model)
        vals['is_mail_thread'] = isinstance(model, self.pool['mail.thread'])
        vals['is_mail_activity'] = isinstance(model, self.pool['mail.activity.mixin'])
        vals['is_mail_blacklist'] = isinstance(model, self.pool['mail.thread.blacklist'])
        return vals

    @api.model
    def _instanciate(self, model_data):
        model_class = super(IrModel, self)._instanciate(model_data)
        if model_data.get('is_mail_blacklist') and model_class._name != 'mail.thread.blacklist':
            parents = model_class._inherit or []
            parents = [parents] if isinstance(parents, str) else parents
            model_class._inherit = parents + ['mail.thread.blacklist']
            if model_class._custom:
                model_class._primary_email = 'x_email'
        elif model_data.get('is_mail_thread') and model_class._name != 'mail.thread':
            parents = model_class._inherit or []
            parents = [parents] if isinstance(parents, str) else parents
            model_class._inherit = parents + ['mail.thread']
        if model_data.get('is_mail_activity') and model_class._name != 'mail.activity.mixin':
            parents = model_class._inherit or []
            parents = [parents] if isinstance(parents, str) else parents
            model_class._inherit = parents + ['mail.activity.mixin']
        return model_class

    def _get_definitions(self, model_names):
        model_definitions = super()._get_definitions(model_names)
        for model_name, model_definition in model_definitions.items():
            model = self.env[model_name]
            tracked_field_names = model._track_get_fields() if 'mail.thread' in model._inherit else []
            for fname in tracked_field_names:
                if fname in model_definition["fields"]:
                    model_definition["fields"][fname]["tracking"] = True
            if isinstance(self.env[model_name], self.env.registry['mail.activity.mixin']):
                model_definition["has_activities"] = True
        return model_definitions

    def _get_model_definitions(self, model_names_to_fetch):
        model_definitions = super()._get_model_definitions(model_names_to_fetch)
        for model_name, model_definition in model_definitions.items():
            model = self.env[model_name]
            tracked_field_names = model._track_get_fields() if 'mail.thread' in model._inherit else []
            for fname, field in model_definition["fields"].items():
                if fname in tracked_field_names:
                    field['tracking'] = True
            if isinstance(self.env[model_name], self.env.registry['mail.activity.mixin']):
                model_definition["has_activities"] = True
        return model_definitions
