# Part of CashApp. See LICENSE file for full copyright and licensing details.

from pytz import timezone, UTC, utc
from datetime import timedelta, datetime

from cashapp import _, api, fields, models
from cashapp.exceptions import UserError
from cashapp.tools import format_time


class HrEmployeeBase(models.AbstractModel):
    _name = "hr.employee.base"
    _description = "Basic Employee"
    _order = 'name'

    name = fields.Char()
    active = fields.Boolean("Active")
    color = fields.Integer('Color Index', default=0)
    department_id = fields.Many2one('hr.department', 'Department', check_company=True)
    member_of_department = fields.Boolean("Member of department", compute='_compute_part_of_department', search='_search_part_of_department',
        help="Whether the employee is a member of the active user's department or one of it's child department.")
    job_id = fields.Many2one('hr.job', 'Job Position', check_company=True)
    job_title = fields.Char("Job Title", compute="_compute_job_title", store=True, readonly=False)
    company_id = fields.Many2one('res.company', 'Company')
    address_id = fields.Many2one(
        'res.partner',
        string='Work Address',
        compute="_compute_address_id",
        precompute=True,
        store=True,
        readonly=False,
        check_company=True)
    work_phone = fields.Char('Work Phone', compute="_compute_phones", store=True, readonly=False)
    phone = fields.Char(related="user_id.phone")
    mobile_phone = fields.Char('Work Mobile', compute="_compute_work_contact_details", store=True, inverse='_inverse_work_contact_details')
    work_email = fields.Char('Work Email', compute="_compute_work_contact_details", store=True, inverse='_inverse_work_contact_details')
    email = fields.Char(related="user_id.email")
    work_contact_id = fields.Many2one('res.partner', 'Work Contact', copy=False)
    work_location_id = fields.Many2one('hr.work.location', 'Work Location', domain="[('address_id', '=', address_id)]")
    work_location_name = fields.Char("Work Location Name", compute="_compute_work_location_name_type")
    work_location_type = fields.Selection([
        ("home", "Home"),
        ("office", "Office"),
        ("other", "Other")], compute="_compute_work_location_name_type")
    user_id = fields.Many2one('res.users', help="")
    share = fields.Boolean(related='user_id.share')
    resource_id = fields.Many2one('resource.resource')
    resource_calendar_id = fields.Many2one('resource.calendar', check_company=True)
    is_flexible = fields.Boolean(compute='_compute_is_flexible', store=True)
    is_fully_flexible = fields.Boolean(compute='_compute_is_flexible', store=True)
    parent_id = fields.Many2one('hr.employee', 'Manager', compute="_compute_parent_id", store=True, readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', 'in', allowed_company_ids)]")
    coach_id = fields.Many2one(
        'hr.employee', 'Coach', compute='_compute_coach', store=True, readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', 'in', allowed_company_ids)]",
        help='Select the "Employee" who is the coach of this employee.\n'
             'The "Coach" has no specific rights or responsibilities by default.')
    tz = fields.Selection(
        string='Timezone', related='resource_id.tz', readonly=False,
        help="This field is used in order to define in which timezone the employee will work.")
    hr_presence_state = fields.Selection([
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('archive', 'Archived'),
        ('out_of_working_hour', 'Out of Working hours')], compute='_compute_presence_state', default='out_of_working_hour')
    last_activity = fields.Date(compute="_compute_last_activity")
    last_activity_time = fields.Char(compute="_compute_last_activity")
    hr_icon_display = fields.Selection([
        ('presence_present', 'Present'),
        ('presence_out_of_working_hour', 'Out of Working hours'),
        ('presence_absent', 'Absent'),
        ('presence_archive', 'Archived'),
        ('presence_undetermined', 'Undetermined')], compute='_compute_presence_icon')
    show_hr_icon_display = fields.Boolean(compute='_compute_presence_icon')
    im_status = fields.Char(related="user_id.im_status")
    newly_hired = fields.Boolean('Newly Hired', compute='_compute_newly_hired', search='_search_newly_hired')

    @api.model
    def _get_new_hire_field(self):
        return 'create_date'

    def _compute_newly_hired(self):
        new_hire_field = self._get_new_hire_field()
        new_hire_date = fields.Datetime.now() - timedelta(days=90)
        for employee in self:
            if not employee[new_hire_field]:
                employee.newly_hired = False
            elif not isinstance(employee[new_hire_field], datetime):
                employee.newly_hired = employee[new_hire_field] > new_hire_date.date()
            else:
                employee.newly_hired = employee[new_hire_field] > new_hire_date

    def _search_newly_hired(self, operator, value):
        new_hire_field = self._get_new_hire_field()
        new_hires = self.env['hr.employee'].sudo().search([
            (new_hire_field, '>', fields.Datetime.now() - timedelta(days=90))
        ])

        op = 'in' if value and operator == '=' or not value and operator != '=' else 'not in'
        return [('id', op, new_hires.ids)]

    @api.depends("work_location_id.name", "work_location_id.location_type")
    def _compute_work_location_name_type(self):
        for employee in self:
            employee.work_location_name = employee.work_location_id.name or None
            employee.work_location_type = employee.work_location_id.location_type or 'other'

    def _get_valid_employee_for_user(self):
        user = self.env.user
        # retrieve the employee of the current active company for the user
        employee = user.employee_id
        if not employee:
            # search for all employees as superadmin to not get blocked by multi-company rules
            user_employees = user.employee_id.sudo().search([
                ('user_id', '=', user.id)
            ])
            # the default company employee is most likely the correct one, but fallback to the first if not available
            employee = user_employees.filtered(lambda r: r.company_id == user.company_id) or user_employees[:1]
        return employee

    @api.depends_context('uid', 'company')
    @api.depends('department_id')
    def _compute_part_of_department(self):
        user_employee = self._get_valid_employee_for_user()
        active_department = user_employee.department_id
        if not active_department:
            self.member_of_department = False
        else:
            def get_all_children(department):
                children = department.child_ids
                if not children:
                    return self.env['hr.department']
                return children + get_all_children(children)

            child_departments = active_department + get_all_children(active_department)
            for employee in self:
                employee.member_of_department = employee.department_id in child_departments

    def _search_part_of_department(self, operator, value):
        if operator not in ('=', '!=') or not isinstance(value, bool):
            raise UserError(_('Operation not supported'))

        user_employee = self._get_valid_employee_for_user()
        # Double negation
        if not value:
            operator = '!=' if operator == '=' else '='
        if not user_employee.department_id:
            return [('id', operator, user_employee.id)]
        return (['!'] if operator == '!=' else []) + [('department_id', 'child_of', user_employee.department_id.id)]

    @api.depends('user_id.im_status')
    def _compute_presence_state(self):
        """
        This method is overritten in several other modules which add additional
        presence criterions. e.g. hr_attendance, hr_holidays
        """
        # Check on login
        employee_to_check_working = self.filtered(lambda e: 'offline' in str(e.user_id.im_status))
        working_now_list = employee_to_check_working._get_employee_working_now()
        for employee in self:
            state = 'out_of_working_hour'
            if employee.company_id.hr_presence_control_login:
                if employee.user_id._is_user_available():
                    state = 'present'
                elif 'offline' in str(employee.user_id.im_status) and employee.id in working_now_list:
                    state = 'absent'
            if not employee.active:
                state = 'archive'
            employee.hr_presence_state = state

    @api.depends('user_id')
    def _compute_last_activity(self):
        presences = self.env['bus.presence'].search_read([('user_id', 'in', self.mapped('user_id').ids)], ['user_id', 'last_presence'])
        # transform the result to a dict with this format {user.id: last_presence}
        presences = {p['user_id'][0]: p['last_presence'] for p in presences}

        for employee in self:
            tz = employee.tz
            last_presence = presences.get(employee.user_id.id, False)
            if last_presence:
                last_activity_datetime = last_presence.replace(tzinfo=UTC).astimezone(timezone(tz)).replace(tzinfo=None)
                employee.last_activity = last_activity_datetime.date()
                if employee.last_activity == fields.Date.today():
                    employee.last_activity_time = format_time(self.env, last_presence, time_format='short')
                else:
                    employee.last_activity_time = False
            else:
                employee.last_activity = False
                employee.last_activity_time = False

    @api.depends('parent_id')
    def _compute_coach(self):
        for employee in self:
            manager = employee.parent_id
            previous_manager = employee._origin.parent_id
            if manager and (employee.coach_id == previous_manager or not employee.coach_id):
                employee.coach_id = manager
            elif not employee.coach_id:
                employee.coach_id = False

    @api.depends('job_id')
    def _compute_job_title(self):
        for employee in self.filtered('job_id'):
            employee.job_title = employee.job_id.name

    @api.depends('address_id')
    def _compute_phones(self):
        for employee in self:
            if employee.address_id and employee.address_id.phone:
                employee.work_phone = employee.address_id.phone
            else:
                employee.work_phone = False

    @api.depends('work_contact_id', 'work_contact_id.mobile', 'work_contact_id.email')
    def _compute_work_contact_details(self):
        for employee in self:
            if employee.work_contact_id:
                employee.mobile_phone = employee.work_contact_id.mobile
                employee.work_email = employee.work_contact_id.email

    def _create_work_contacts(self):
        if any(employee.work_contact_id for employee in self):
            raise UserError(_('Some employee already have a work contact'))
        work_contacts = self.env['res.partner'].create([{
            'email': employee.work_email,
            'mobile': employee.mobile_phone,
            'name': employee.name,
            'image_1920': employee.image_1920,
            'company_id': employee.company_id.id
        } for employee in self])
        for employee, work_contact in zip(self, work_contacts):
            employee.work_contact_id = work_contact

    def _inverse_work_contact_details(self):
        employees_without_work_contact = self.env['hr.employee']
        for employee in self:
            if not employee.work_contact_id:
                employees_without_work_contact += employee
            else:
                employee.work_contact_id.sudo().write({
                    'email': employee.work_email,
                    'mobile': employee.mobile_phone,
                })
        if employees_without_work_contact:
            employees_without_work_contact.sudo()._create_work_contacts()

    @api.depends('company_id')
    def _compute_address_id(self):
        for employee in self:
            address = employee.company_id.partner_id.address_get(['default'])
            employee.address_id = address['default'] if address else False

    @api.depends('department_id')
    def _compute_parent_id(self):
        for employee in self.filtered('department_id.manager_id'):
            employee.parent_id = employee.department_id.manager_id

    @api.depends('resource_calendar_id', 'hr_presence_state')
    def _compute_presence_icon(self):
        """
        This method compute the state defining the display icon in the kanban view.
        It can be overriden to add other possibilities, like time off or attendances recordings.
        """
        for employee in self:
            employee.hr_icon_display = 'presence_' + employee.hr_presence_state
            employee.show_hr_icon_display = bool(employee.user_id)

    @api.depends('resource_calendar_id.flexible_hours')
    def _compute_is_flexible(self):
        for employee in self:
            employee.is_fully_flexible = not employee.resource_calendar_id
            employee.is_flexible = employee.is_fully_flexible or employee.resource_calendar_id.flexible_hours

    @api.model
    def _get_employee_working_now(self):
        working_now = []
        # We loop over all the employee tz and the resource calendar_id to detect working hours in batch.
        all_employee_tz = set(self.mapped('tz'))
        for tz in all_employee_tz:
            employee_ids = self.filtered(lambda e: e.tz == tz)
            resource_calendar_ids = employee_ids.mapped('resource_calendar_id')
            for calendar_id in resource_calendar_ids:
                res_employee_ids = employee_ids.filtered(lambda e: e.resource_calendar_id.id == calendar_id.id)
                start_dt = fields.Datetime.now()
                stop_dt = start_dt + timedelta(hours=1)
                from_datetime = utc.localize(start_dt).astimezone(timezone(tz or 'UTC'))
                to_datetime = utc.localize(stop_dt).astimezone(timezone(tz or 'UTC'))
                # Getting work interval of the first is working. Functions called on resource_calendar_id
                # are waiting for singleton
                work_interval = res_employee_ids[0].resource_calendar_id._work_intervals_batch(from_datetime, to_datetime)[False]
                # Employee that is not supposed to work have empty items.
                if len(work_interval._items) > 0:
                    # The employees should be working now according to their work schedule
                    working_now += res_employee_ids.ids
        return working_now

    def _get_calendar_periods(self, start, stop):
        """
        :param datetime start: the start of the period
        :param datetime stop: the stop of the period
        This method can be overridden in other modules where it's possible to have different resource calendars for an
        employee depending on the date.
        """
        calendar_periods_by_employee = {}
        for employee in self:
            calendar = employee.resource_calendar_id or employee.company_id.resource_calendar_id
            calendar_periods_by_employee[employee] = [(start, stop, calendar)]
        return calendar_periods_by_employee

    def get_avatar_card_data(self, fields):
        return self._read_format(fields)
