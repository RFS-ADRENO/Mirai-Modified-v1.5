const path = require("path");
const getConfig = JSON.parse(require("fs").readFileSync(__dirname + '/../config.json'));
module.exports = {
	development: false,
	prefix: getConfig.PREFIX,
	threadPrefix: {},
	selfListen: getConfig.SELFLISTEN,
	language: getConfig.LANGUAGE,
	botName: getConfig.BOT_NAME,
	googleSearch: getConfig.GOOGLE_SEARCH,
	wolfarm: getConfig.WOLFARM,
	tenor: getConfig.TENOR,
	openweather: getConfig.OPENWEATHER,
	saucenao: getConfig.SAUCENAO,
	waketime: getConfig.WAKETIME,
	sleeptime: getConfig.SLEEPTIME,
	otpkey: getConfig.OTPKEY,
	autorestart: getConfig.REFRESHING,
	admins: (getConfig.ADMINS || []).map(e => parseInt(e)),
	nsfwGodMode: false,
	database: {
		postgres: {
			database: 'postgres',
			username: 'postgres',
			password: 'root',
			host: 'localhost',
		},
		sqlite: {
			storage: path.resolve(__dirname, "./data.sqlite"),
		},
	},
	appStateFile: path.resolve(__dirname, '../appstate.json')
}