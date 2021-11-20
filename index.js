const login = require("fca-xuyen-get");
const { Sequelize, sequelize, Op } = require("./database");
const logger = require("./app/modules/log.js");
const fs = require("fs-extra");
const express = require("express");
const app = express();
const cmd = require('node-cmd');
const __GLOBAL = new Object({
	threadBlocked: new Array(),
	userBlocked: new Array(),
	message: new Array(),
	resendBlocked: new Array(),
	NSFWBlocked: new Array(),
	afkUser: new Array(),
	confirm: new Array(),
	reply: new Array(),
	simOn: new Array(),
	blockLevelUp: new Array(),
	language: new Object({
		index: new Object(),
		listen: new Object(),
		event: new Object(),
		message: new Object(),
		reply: new Object(),
		unsend: new Object(),
		reaction: new Object(),
		login: new Object(),
		update: new Object(),
		fishing: new Object(),
		thread: new Object(),
		user: new Object(),
		nsfw: new Object(),
		custom: new Object()
	})
});

//checkConfig
if (!fs.existsSync('config.json')) return logger('Không tìm thấy file config!', 1);

const getConfig = JSON.parse(fs.readFileSync('config.json'));
logger("Load thành công file config", 0);

//auto-clean && check
var ytPath = './app/handle/media/';
if (!fs.existsSync(ytPath)) fs.mkdirSync(ytPath, { recursive: true });
fs.readdir(ytPath, (err, files) => {for (const file of files) {fs.unlinkSync(ytPath + file);}});

var pfPath = './app/handle/src/prefix.json';
if (!fs.existsSync(pfPath)) fs.writeFileSync(pfPath, JSON.stringify({}));


//Pick the language
var langFile = (fs.readFileSync(`./app/handle/src/langs/${getConfig.LANGUAGE}.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
var langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (let item of langData) {
	let getSeparator = item.indexOf('=');
	let itemKey = item.slice(0, getSeparator);
	let itemValue = item.slice(getSeparator + 1, item.length);
	let head = itemKey.slice(0, itemKey.indexOf('.'));
	let key = itemKey.replace(head + '.', '');
	let value = itemValue.replace(/\\n/gi, '\n');
	__GLOBAL.language[head][key] = value;
}

function getText(...args) {
	const langText = __GLOBAL.language.index;
	const getKey = args[0];
	if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
	let text = langText[getKey];
	for (let i = args.length; i > 0; i--) {
		let regEx = RegExp(`%${i}`, 'g');
		text = text.replace(regEx, args[i]);
	}
	return text;
}

app.get("/", (request, response) => response.sendFile(__dirname + "/config/dbviewer/index.html"));
app.use(express.static(__dirname + '/config'));
app.use(express.static(__dirname + '/config/dbviewer'));
const listener = app.listen(8080, () => logger("Đã mở tại port: " + listener.address().port), 0);

if (getConfig.REFRESHING == 'on') setTimeout(() => {
	console.log(">> AUTO RESTART AFTER AN HOUR <<");
	require("eval")("module.exports = process.exit(1)", true);
}, 120000*30);

require('npmlog').pause();
async function facebook({ Op, models }) {
  	if (!fs.existsSync('appstate.json')) return logger("Không tìm thấy file appstate!", 1);
	await login({appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))}, (err, api) => {
		if (err) return logger(err, 2);
        api.setOptions({
        	listenEvents: true,
        	forceLogin: true,
        	selfListen: getConfig.SELFLISTEN,
        	userAgent:
          		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15"
      	});
		setInterval(() => { fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState(), null, "\t")) }, 100000*60);
		api.listenMqtt(require("./app/listen")({ api, Op, models, __GLOBAL }));
	});
}

sequelize.authenticate().then(
	() => logger(getText('connectSuccess'), 0),
	() => logger(getText('connectFailed'), 2)
).then(() => {
	let models = require("./database/model")({ Sequelize, sequelize });
	let allCmd = JSON.parse(fs.readFileSync('./app/handle/src/help/listCommands.json'));
	logger(`Tải thành công info của ${allCmd.length} lệnh`, 0);
	facebook({ Op, models });
}).catch(e => logger(`${e}`, "[ WELL, SOME SHIT HAPPENED ]"));
// Made by CatalizCS and SpermLord