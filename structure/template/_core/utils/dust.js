const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const appConf = require('@config/application');
const customDust = require('@app/utils/dust');
const fileHelper = require('@core/helpers/file');

// ----------- Helper DUST ----------- //
// Example:
// {@myHelper} for global helpers
// {#myHelper} for context helpers (such as authentication access)

module.exports = {
	locals: function(locals, req, language, access) {

		// Translate functions
		locals.__ = function(ch, con, bo, params) {
			if(!params.key || params.key == '' || typeof params.key !== 'string')
				return '';
			return ch.write(language.__(params.key).replace(/'/g, "&apos;"));
		}
		locals.M_ = function(ch, con, bo, params) {
			if(!params.key || params.key == '' || typeof params.key !== 'string')
				return '';
			return ch.write(language.M_(params.key).replace(/'/g, "&apos;"));
		}

		// When user is logged
		if (req.isAuthenticated() || global.auto_login) { // eslint-disable-line
			// Session
			locals.session = req.session;

			locals.haveGroup = function(chunk, context, bodies, params) {
				const userGroups = req.session.passport.user.r_group;
				const group = params.group;
				return access.haveGroup(userGroups, group);
			}
			// Access control
			locals.moduleAccess = function(chunk, context, bodies, params) {
				const userGroups = req.session.passport.user.r_group;
				const moduleName = params.module;
				return access.moduleAccess(userGroups, moduleName);
			};
			locals.entityAccess = function(chunk, context, bodies, params) {
				const userGroups = req.session.passport.user.r_group;
				const entityName = params.entity;
				return access.entityAccess(userGroups, entityName);
			}
			locals.actionAccess = function(chunk, context, bodies, params) {
				const userRoles = req.session.passport.user.r_role;
				const entityName = params.entity;
				const action = params.action;
				return access.actionAccess(userRoles, entityName, action);
			}
			locals.checkStatusPermission = function(chunk, context, bodies, params) {
				const status = params.status;
				const acceptedGroup = status.r_accepted_group || [];
				const currentUserGroupIds = [];

				for (let i = 0; i < req.session.passport.user.r_group.length; i++)
					currentUserGroupIds.push(req.session.passport.user.r_group[i].id);

				// If no role given in status, then accepted for everyone
				if (acceptedGroup.length == 0)
					return true;
				for (let j = 0; j < acceptedGroup.length; j++)
					if (currentUserGroupIds.indexOf(acceptedGroup[j].id) != -1)
						return true;

				return false;
			}
		}

		// Add custom locals
		locals = customDust.locals(locals, req, language, access);
	},
	helpers: function(dust) {
		dust.helpers.findValueInGivenContext = function(chunk, context, bodies, params) {
			const obj = dust.helpers.tap(params.ofContext, chunk, context);

			let idx = 0;
			for (let i = 0; i < obj.length; i++) {
				if (obj[i].id == params.idx)
					idx = i;
			}

			if (typeof params.entity !== "undefined") {
				if (typeof obj[idx][params.entity] !== "undefined" && obj[idx][params.entity] != null)
					return chunk.write(obj[idx][params.entity][params.key]);
				return chunk.write("-");
			} return chunk.write(obj[idx][params.key]);
		}
		dust.helpers.existInContextById = function(chunk, context, bodies, params) {
			const obj = dust.helpers.tap(params.ofContext, chunk, context);
			for (let i = 0; i < obj.length; i++) {
				if (obj[i].id == params.key)
					return true;
			}
			return false;
		}
		dust.helpers.ifTrue = function(chunk, context, bodies, params) {
			const value = params.key;

			if (value == true || value == "true" || value == 1) {
				return true;
			}
			return false;
		}
		dust.helpers.inArray = function(chunk, context, bodies, params) {
			const value = params.value;
			const field = params.field;
			const array = params.array;

			for (let i = 0; i < array.length; i++) {
				if (array[i][field] == value)
					return true
			}
			return false;
		}
		dust.helpers.in = function(chunk, context, bodies, params) {
			const value = params.value || params.key;
			let array = params.array || params.values;
			array = array.split(',');

			// Avoid indexOf for datatype mismatch due to dust
			if (array.filter(x => x == value).length != 0)
				return true;
			return false;
		}
		dust.helpers.notIn = function(chunk, context, bodies, params) {
			const value = params.value || params.key;
			let array = params.array || params.values;
			array = array.split(',');

			// Avoid indexOf for datatype mismatch due to dust
			if (array.filter(x => x == value).length == 0)
				return true;
			return false;
		}

		function buildContext(ctx){
			let newContext = {};
			for (const obj in ctx) {
				if(obj.startsWith('_')) // Ignore private keys
					continue;

				if(['req', 'res'].includes(obj)) // Ignore request, response for performance issue
					continue;

				switch (typeof ctx[obj]) {
					case 'object':
						if(obj == 'dataValues')
							newContext = {
								...newContext,
								...ctx[obj]
							}
						else
							newContext[obj] = buildContext(ctx[obj]);
						break;
					case 'string':
					case 'number':
					case 'boolean':
						newContext[obj] = ctx[obj];
						break;
					default:
						break;
				}
			}
			return newContext;
		}

		function diveContext(ctx, results = []) {
			let current;
			for (const obj in ctx) {
				current = ctx[obj];
				if (typeof current === 'object') {
					switch (obj) {
						case 'stack':
						case 'tail':
							diveContext(current, results);
							break;
						case 'head':
							results.push(buildContext(current));
							break;
						default:
							break;
					}
				}
			}
			return results;
		}

		dust.helpers.contextUpperDump = function(chunk, context) {
			const results = diveContext(context);
			chunk = chunk.write(JSON.stringify(results));
		}

		dust.helpers.getFromContext = function(chunk, context, bodies, params) {
			if(!context || !context.stack || !context.stack.head || !context.stack.head[params.key])
				return false;
			chunk.write(JSON.stringify(context.stack.head[params.key]));
		}

		// Default inline help helper return false, helpers override on route call in @core/render.js
		dust.helpers.inline_help = () => false;

		// Add custom helpers
		dust = customDust.helpers(dust);
	},
	filters: function(dust, lang) {
		// ----------- Filter DUST ----------- //
		// Example {myDate|convertToDateFormat}

		dust.filters.date = function(value) {
			if (!value || value == '')
				return value;

			if (lang == "fr-FR")
				return dayjs.utc(value).format("DD/MM/YYYY");

			return dayjs.utc(value).format("YYYY-MM-DD");
		};

		dust.filters.datetime = function(value) {
			if (!value || value == '')
				return value;

			if (lang == "fr-FR")
				return dayjs.utc(value).format("DD/MM/YYYY HH:mm");

			return dayjs.utc(value).format("YYYY-MM-DD HH:mm");
		};

		dust.filters.dateTZ = function(value) {
			if (!value || value == '')
				return value;

			if (lang == "fr-FR")
				return dayjs(value).tz(appConf.timezone).format("DD/MM/YYYY");

			return dayjs(value).tz(appConf.timezone).format("YYYY-MM-DD");
		};

		dust.filters.datetimeTZ = function(value) {
			if (!value || value == '')
				return value;

			if (lang == "fr-FR")
				return dayjs(value).tz(appConf.timezone).format("DD/MM/YYYY HH:mm");

			return dayjs(value).tz(appConf.timezone).format("YYYY-MM-DD HH:mm");
		};

		dust.filters.time = function(value) {
			if (value != "") {
				if (value.length == 8)
					return value.substring(0, value.length - 3);
			}
			return value;
		};

		dust.filters.filename = function(value) {
			return fileHelper.originalFilename(value);
		};

		// Fix for IE11, encode filename values for query value like "/download/{my_filename}"
		dust.filters.urlencode = function(value) {
			return encodeURIComponent(value);
		};

		dust.filters.htmlencode = str => str.replace(/[&<>'"]/g,
			tag => ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				"'": '&#39;',
				'"': '&quot;'
			}[tag]));

		// Add custom filters
		dust = customDust.filters(dust);
	}
};