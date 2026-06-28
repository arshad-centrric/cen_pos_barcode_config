app_name = "cen_pos_barcode_config"
app_title = "Cen Pos Barcode Config"
app_publisher = "Centrric Innovations"
app_description = "Automates dynamic barcode scanning in POS with custom UI configurations for parsing item codes, weights, and units."
app_email = "support@centrric.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "cen_pos_barcode_config",
# 		"logo": "/assets/cen_pos_barcode_config/logo.png",
# 		"title": "Cen Pos Barcode Config",
# 		"route": "/cen_pos_barcode_config",
# 		"has_permission": "cen_pos_barcode_config.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/cen_pos_barcode_config/css/cen_pos_barcode_config.css"
# app_include_js = "/assets/cen_pos_barcode_config/js/cen_pos_barcode_config.js"

# include js, css files in header of web template
# web_include_css = "/assets/cen_pos_barcode_config/css/cen_pos_barcode_config.css"
# web_include_js = "/assets/cen_pos_barcode_config/js/cen_pos_barcode_config.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "cen_pos_barcode_config/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "cen_pos_barcode_config/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "cen_pos_barcode_config.utils.jinja_methods",
# 	"filters": "cen_pos_barcode_config.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "cen_pos_barcode_config.install.before_install"
# after_install = "cen_pos_barcode_config.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "cen_pos_barcode_config.uninstall.before_uninstall"
# after_uninstall = "cen_pos_barcode_config.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "cen_pos_barcode_config.utils.before_app_install"
# after_app_install = "cen_pos_barcode_config.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "cen_pos_barcode_config.utils.before_app_uninstall"
# after_app_uninstall = "cen_pos_barcode_config.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "cen_pos_barcode_config.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "cen_pos_barcode_config.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"cen_pos_barcode_config.tasks.all"
# 	],
# 	"daily": [
# 		"cen_pos_barcode_config.tasks.daily"
# 	],
# 	"hourly": [
# 		"cen_pos_barcode_config.tasks.hourly"
# 	],
# 	"weekly": [
# 		"cen_pos_barcode_config.tasks.weekly"
# 	],
# 	"monthly": [
# 		"cen_pos_barcode_config.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "cen_pos_barcode_config.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "cen_pos_barcode_config.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "cen_pos_barcode_config.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "cen_pos_barcode_config.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["cen_pos_barcode_config.utils.before_request"]
# after_request = ["cen_pos_barcode_config.utils.after_request"]

# Job Events
# ----------
# before_job = ["cen_pos_barcode_config.utils.before_job"]
# after_job = ["cen_pos_barcode_config.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"cen_pos_barcode_config.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

