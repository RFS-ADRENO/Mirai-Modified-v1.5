module.exports = function ({ api, config, __GLOBAL, User, Thread, Rank, Economy, Fishing, Nsfw, Image }) {
	/* ================ Config ==================== */
	let { googleSearch, wolfarm, openweather, tenor, saucenao, admins, nsfwGodMode } = config;
	const fs = require("fs-extra");
	const moment = require("moment-timezone");
	const request = require("request");
	const ms = require("parse-ms");
	const stringSimilarity = require('string-similarity');
	const axios = require('axios');
	const logger = require("../modules/log.js");
	var resetNSFW = false;

	function getText(...args) {
		const langText = { ...__GLOBAL.language.message, ...__GLOBAL.language.fishing, ...__GLOBAL.language.thread, ...__GLOBAL.language.user };
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey];
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

	setInterval(() => {
		var timer = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm");
		if (timer == "00:00") {
			if (resetNSFW == false) {
				resetNSFW = true;
				Nsfw.resetNSFW();
			}
		}
	}, 1000);

	if (!fs.existsSync(__dirname + "/src/shortcut.json")) {
		var template = [];
		fs.writeFileSync(__dirname + "/src/shortcut.json", JSON.stringify(template));
		logger('Tạo file shortcut mới thành công!');
	}

	return async function ({ event }) {
		
		//checkPrefix
		let prefixFile = JSON.parse(fs.readFileSync(__dirname + '/src/prefix.json'));
		config.threadPrefix = prefixFile;
		const prefix = (event.threadID in config.threadPrefix) ? config.threadPrefix[event.threadID] : config.prefix;

		let { body: contentMessage, senderID, threadID, messageID } = event;
		senderID = parseInt(senderID);
		threadID = parseInt(threadID);

		if (__GLOBAL.userBlocked.includes(senderID) && !admins.includes(senderID) || __GLOBAL.threadBlocked.includes(threadID) && !admins.includes(senderID)) return;

		if(event.type != "message_unsend") __GLOBAL.message.push({
        msgID:messageID,
        msg:event.body,
        attachment:event.attachments
      })

		await User.createUser(senderID);
		await Thread.createThread(threadID);
		await Rank.updatePoint(senderID, 1);

		if (event.mentions) {
			var mentions = Object.keys(event.mentions);
			mentions.forEach(async mention => {
				if (__GLOBAL.afkUser.includes(parseInt(mention))) {
					var reason = await User.getReason(mention);
					var name = await User.getName(mention);
					reason == "none" ? api.sendMessage(getText('busy', name), threadID, messageID) : api.sendMessage(getText('busyWithReason', name, reason), threadID, messageID);
					return;
				}
			});
		}

		if (__GLOBAL.afkUser.includes(parseInt(senderID))) {
			await User.nonafk(senderID);
			await User.updateReason(senderID, "");
			__GLOBAL.afkUser.splice(__GLOBAL.afkUser.indexOf(senderID), 1);
			var name = await User.getName(senderID);
			return api.sendMessage(getText('welcomeBack', name), threadID);
		}

		/* ================ Staff Commands ==================== */
		//lấy shortcut
		if (contentMessage.length !== -1) {
			let shortcut = JSON.parse(fs.readFileSync(__dirname + "/src/shortcut.json"));
			if (shortcut.some(item => item.id == threadID)) {
				let getThread = shortcut.find(item => item.id == threadID).shorts;
				if (getThread.some(item => item.in == contentMessage)) {
					let shortOut = getThread.find(item => item.in == contentMessage).out;
					if (shortOut.indexOf(" | ") !== -1) {
						var arrayOut = shortOut.split(" | ");
						return api.sendMessage(`${arrayOut[Math.floor(Math.random() * arrayOut.length)]}`, threadID);
					}
					else return api.sendMessage(`${shortOut}`, threadID);
				}
			}
		}

		//sim on/off
		if (__GLOBAL.simOn.includes(threadID) && senderID != api.getCurrentUserID()) axios(`http://www.api-adreno.tk/nino/get/${encodeURIComponent(contentMessage)}`).then(res => {
            if (res.data.reply == "null" || res.data.reply == "ủa nói j hong hiểu :<") {
                api.sendMessage("nino ko hiểu, dạy nino đi :<",threadID,messageID)
            } else {
                return api.sendMessage(res.data.reply, threadID, messageID);
            }
    })

		//Get cmds.json
		var nocmdData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));

		//create new object contains banned cmds+threads
		if (!nocmdData.banned.some(item => item.id == threadID)) {
			let addThread = {
				id: threadID,
				cmds: []
			};
			nocmdData.banned.push(addThread);
			fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(nocmdData));
		}

		//get banned cmds
		var cmds = nocmdData.banned.find(item => item.id == threadID).cmds;
		for (const item of cmds) if (contentMessage.indexOf(prefix + item) == 0) return api.sendMessage(getText('bannedCommand'), threadID, messageID);

		//report
		if (contentMessage.indexOf(`${prefix}report`) == 0) {
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (!content) return api.sendMessage(getText('noErrorInfo'), threadID, messageID);
			var userName = await User.getName(senderID);
			var threadName = await Thread.getName(threadID);
			api.sendMessage(getText('reportInfo', userName, threadName, content, moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss")), admins[0]);
			return api.sendMessage(getText('reportSent'), threadID, messageID);
		}

		//nsfw
		if (contentMessage.indexOf(`${prefix}nsfw`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content == 'off') {
				if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('alreadyOffNSFW'), threadID, messageID);
				Thread.blockNSFW(threadID).then((success) => {
					if (!success) return api.sendMessage(getText('cantOffNSFW'), threadID, messageID);
					api.sendMessage(getText('disabledNSFW'), threadID, messageID);
					__GLOBAL.NSFWBlocked.push(threadID);
				})
			}
			else if (content == 'on') {
				if (!__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('alreadyOnNSFW'), threadID, messageID);
				Thread.unblockNSFW(threadID).then(success => {
					if (!success) return api.sendMessage(getText('cantOnNSFW'), threadID, messageID);
					api.sendMessage(getText('enabledNSFW'), threadID, messageID);
					__GLOBAL.NSFWBlocked.splice(__GLOBAL.NSFWBlocked.indexOf(threadID), 1);
				});
			}
			return;
		}

		//admin command
		if (contentMessage.indexOf(`${prefix}admin`) == 0 && admins.includes(senderID)) {
			var contentSplit = contentMessage.split(" ");
			var content = contentSplit[1];
			var arg = contentSplit[2];
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listAC.json"));
			if (!content || content.indexOf("settings") == 0) {
				return api.sendMessage(getText('adminSetting1') + getText('adminSetting2'), threadID, (err, info) => {
						if (err) throw err;
						__GLOBAL.reply.push({
							type: "admin_settings",
							messageID: info.messageID,
							target: parseInt(threadID),
							author: senderID
						});
					}
				);
			}
			else if (content.indexOf("help") == 0) {
				if (helpList.some(item => item.name == arg)) return api.sendMessage(getText('adminHelpCmd', helpList.find(item => item.name == arg).name, helpList.find(item => item.name == arg).desc, prefix + helpList.find(item => item.name == arg).usage, prefix + helpList.find(item => item.name == arg).example), threadID, messageID);
				else return api.sendMessage(getText('adminHelpInvalid', prefix), threadID, messageID);
			}
			else if (content.indexOf("all") == 0) {
				var commandAdmin = [];
				helpList.forEach(help => (!commandAdmin.some(item => item.name == help.name)) ? commandAdmin.push(help.name) : commandAdmin.find(item => item.name == help.name).push(help.name));
				return api.sendMessage(commandAdmin.join(', '), threadID, messageID);
			}
			else if (content.indexOf("banUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions.length == 0) {
					return User.ban(parseInt(arg)).then(success => {
						User.getName(parseInt(arg)).then(name => {
							__GLOBAL.userBlocked.push(parseInt(arg));
							logger(arg, 'Ban User');
							if (__GLOBAL.userBlocked.includes(arg)) return api.sendMessage(getText('alreadyBannedUser', name, arg), threadID);
							if (!success) return api.sendMessage(getText('cantBanUser'), threadID, messageID);
							api.sendMessage(getText('bannedUser', name, arg), threadID, messageID);
						});
						logger(`${name} - ${arg}`, getText('banUser'));
					});
				}
				else {
					return mentions.forEach(id => {
						id = parseInt(id);
						let name = event.mentions[id].replace('@', '');
						if (__GLOBAL.userBlocked.includes(id)) return api.sendMessage(getText('alreadyBannedUser', name, id), threadID, messageID);
						User.ban(id).then((success) => {
							if (!success) return api.sendMessage(getText('cantBanUser'), threadID, messageID);
							api.sendMessage({
								body: getText('bannedUser', name, id),
								mentions: [{ tag: name, id }]
							}, threadID, messageID);
							__GLOBAL.userBlocked.push(id);
							logger(`${name} - ${id}`, getText('banUser'));
						});
					});
				};
			}
			else if (content.indexOf("unbanUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions == 0) {
					return User.unban(parseInt(arg)).then(success => {
						User.getName(parseInt(arg)).then(name => {
							const indexOfUser = __GLOBAL.userBlocked.indexOf(parseInt(arg));
							if (indexOfUser == -1) return api.sendMessage(getText('notBannedUser', name, arg), threadID, messageID);
							if (!success) return api.sendMessage(getText('cantUnbanUser'), threadID, messageID);
							api.sendMessage(getText('unbannedUser', name, arg), threadID, messageID);
							__GLOBAL.userBlocked.splice(indexOfUser, 1);
							logger(`${name} - ${arg}`, getText('unbanUser'));
						});
					});
				}
				else {
					return mentions.forEach(id => {
						id = parseInt(id);
						let name = event.mentions[id].replace('@', '');
						const indexOfUser = __GLOBAL.userBlocked.indexOf(id);
						if (indexOfUser == -1)
							return api.sendMessage({
								body: getText('notBannedUser', name, id),
								mentions: [{ tag: name, id }]
							}, threadID, messageID);
						User.unban(id).then(success => {
							if (!success) return api.sendMessage(getText('cantUnban'), threadID, messageID);
							api.sendMessage({
								body: getText('unbannedUser', name, id),
								mentions: [{ tag: name, id }]
							}, threadID, messageID);
							__GLOBAL.userBlocked.splice(indexOfUser, 1);
							logger(`${name} - ${id}`, getText('unbanUser'));
						});
					});
				}
			}
			else if (content.indexOf("banThread") == 0) {
				if (arg) return Thread.ban(parseInt(arg)).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(parseInt(arg));
					if (indexOfThread != -1) return api.sendMessage(getText('alreadyBannedThread'), threadID, messageID);
					if (!success) return api.sendMessage(getText('cantBanThread'), threadID, messageID);
					api.sendMessage(getText('bannedThread'), threadID, messageID);
					__GLOBAL.threadBlocked.push(parseInt(arg));
					logger(arg, getText('banThread'));
				});
				else return Thread.ban(threadID).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(threadID);
					if (indexOfThread != -1) return api.sendMessage(getText('alreadyBannedThread'), threadID, messageID);
					if (!success) return api.sendMessage(getText('cantBanThread'), threadID, messageID);
					api.sendMessage(getText('bannedThread'), threadID, messageID);
					__GLOBAL.threadBlocked.push(threadID);
					logger(threadID, getText('banThread'));
				});
			}
			else if (content.indexOf("unbanThread") == 0) {
				if (arg) return Thread.unban(parseInt(arg)).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(parseInt(arg));
					if (indexOfThread == -1) return api.sendMessage(getText('notBannedThread'), threadID, messageID);
					if (!success) return api.sendMessage(getText('cantUnbanThread'), threadID, messageID);
					api.sendMessage(getText('unbannedThread'), threadID, messageID);
					__GLOBAL.threadBlocked.splice(indexOfThread, 1);
					logger(arg, getText('unbanThread'));
				});
				return Thread.unban(threadID).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(threadID);
					if (indexOfThread == -1) return api.sendMessage(getText('notBannedThread'), threadID, messageID);
					if (!success) return api.sendMessage(getText('cantUnbanThread'), threadID, messageID);
					api.sendMessage(getText('unbannedThread'), threadID, messageID);
					__GLOBAL.threadBlocked.splice(indexOfThread, 1);
					logger(threadID, getText('unbanThread'));
				});
			}
			else if (content.indexOf("banCmd") == 0) {
				if (!arg) return api.sendMessage(getText('enterBanCmd'), threadID, messageID);
				var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
				if (arg == "list") return api.sendMessage(getText('listBannedCmd', nocmdData.banned.find(item => item.id == threadID).cmds), threadID, messageID);
				if (!jsonData.cmds.includes(arg)) return api.sendMessage(getText('cantFindCmd', arg), threadID, messageID);
				else {
					if (jsonData.banned.some(item => item.id == threadID)) {
						let getThread = jsonData.banned.find(item => item.id == threadID);
						getThread.cmds.push(arg);
					}
					else {
						let addThread = {
							id: threadID,
							cmds: []
						};
						addThread.cmds.push(arg);
						jsonData.banned.push(addThread);
					}
					api.sendMessage(getText('bannedCmd'), threadID, messageID);
				}
				return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
			}
			else if (content.indexOf("unbanCmd") == 0) {
				if (!arg) return api.sendMessage(getText('enterUnbanCmd'), threadID, messageID);
				var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
				var getCMDS = jsonData.banned.find(item => item.id == threadID).cmds;
				if (!getCMDS.includes(arg)) return api.sendMessage(getText('notBannedCmd'), threadID, messageID);
				else {
					let getIndex = getCMDS.indexOf(arg);
					getCMDS.splice(getIndex, 1);
					api.sendMessage(getText('unbannedCmd'), threadID, messageID);
				}
				return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
			}
			else if (content.indexOf("resend") == 0) {
				if (arg == 'off') {
					if (__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage(getText('alreadyOffResend'), threadID, messageID);
					return Thread.blockResend(threadID).then((success) => {
						if (!success) return api.sendMessage(getText('cantOffResend'), threadID, messageID);
						api.sendMessage(getText('disabledResend'), threadID, messageID);
						__GLOBAL.resendBlocked.push(threadID);
					})
				}
				else if (arg == 'on') {
					if (!__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage(getText('alreadyOnResend'), threadID, messageID);
					return Thread.unblockResend(threadID).then(success => {
						if (!success) return api.sendMessage(getText('cantOnResend'), threadID, messageID);
						api.sendMessage(getText('enabledResend'), threadID, messageID);
						__GLOBAL.resendBlocked.splice(__GLOBAL.resendBlocked.indexOf(threadID), 1);
					});
				}
			}
			else if (content.indexOf("createUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions.length == 0) {
					if (isNaN(arg)) return api.sendMessage(getText('notUserID'), threadID, messageID);
					let success = await User.createUser(arg);
					let name = await User.getName(arg);
					(success) ? api.sendMessage(getText('addedUser', name), threadID, messageID) : api.sendMessage(getText('alreadyInDB', name), threadID, messageID);
				}
				else {
					for (let i of mentions) {
						let success = await User.createUser(i);
						let name = await User.getName(i);
						(success) ? api.sendMessage(getText('addedUser', name), threadID, messageID) : api.sendMessage(getText('alreadyInDB', name), threadID, messageID);
					}
				}
				return;
			}
			else if (content.indexOf("addUser") == 0) return api.addUserToGroup(arg, threadID);
			else if (content.indexOf("restart") == 0) return api.sendMessage(getText('restart'), threadID, () => require("node-cmd").run("pm2 restart 0"), messageID);
			else return api.sendMessage(getText('adminHelpInvalid', prefix), threadID, messageID);
		}

		if (contentMessage.indexOf(`${prefix}levelup`) == 0) {
			var arg = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (arg == 'off') {
				if (__GLOBAL.blockLevelUp.includes(threadID)) return api.sendMessage(getText('alreadyOffLUN'), threadID, messageID);
				return Thread.blockLevelUp(threadID).then((success) => {
					if (!success) return api.sendMessage(getText('cantOffLUN'), threadID, messageID);
					api.sendMessage(getText('disabledLUN'), threadID, messageID);
					__GLOBAL.blockLevelUp.push(threadID);
				})
			}
			else if (arg == 'on') {
				if (!__GLOBAL.blockLevelUp.includes(threadID)) return api.sendMessage(getText('alreadyOnLUN'), threadID, messageID);
				return Thread.unblockLevelUp(threadID).then(success => {
					if (!success) return api.sendMessage(getText('cantOnLUN'), threadID, messageID);
					api.sendMessage(getText('enabledLUN'), threadID, messageID);
					__GLOBAL.blockLevelUp.splice(__GLOBAL.blockLevelUp.indexOf(threadID), 1);
				});
			}
		}

		/* ==================== Help Commands ================*/

		//help
		if (contentMessage.indexOf(`${prefix}help`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listCommands.json"));
			if (content.length == 0) {
				var helpGroup = [];
				var helpMsg = "";
				helpList.forEach(help => (!helpGroup.some(item => item.group == help.group)) ? helpGroup.push({ group: help.group, cmds: [help.name] }) : helpGroup.find(item => item.group == help.group).cmds.push(help.name));
				helpGroup.forEach(help => helpMsg += `===== ${help.group.charAt(0).toUpperCase() + help.group.slice(1)} =====\n${help.cmds.join(', ')}\n\n`);
				return api.sendMessage(getText('helpMsg', helpList.length, helpMsg), threadID, messageID);
			}
			else {
				if (helpList.some(item => item.name == content))
					return api.sendMessage(getText('helpInfo', helpList.find(item => item.name == content).name, helpList.find(item => item.name == content).desc, prefix + helpList.find(item => item.name == content).usage, prefix + helpList.find(item => item.name == content).example), threadID, messageID);
				else return api.sendMessage(getText('generalHelpInvalid', prefix), threadID, messageID);
			}
		}

		//yêu cầu công việc cho bot
		if (contentMessage.indexOf(`${prefix}request`) == 0) {
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (!fs.existsSync(__dirname + "/src/requestList.json")) {
				let requestList = [];
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(requestList));
			}
			if (content.indexOf("add") == 0) {
				var addnew = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				getData.push(addnew);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage(getText('requestAdd1', addnew), threadID, () => api.sendMessage(getText('requestAdd2', senderID, addnew), admins[0]), messageID);
			}
			else if (content.indexOf("del") == 0 && admins.includes(senderID)) {
				var deletethisthing = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage(getText('requestNotFound', deletethisthing), threadID, messageID);
				var itemIndex = getData.indexOf(deletethisthing);
				getData.splice(itemIndex, 1);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage(getText('requestDelete', deletethisthing), threadID, messageID);
			}
			else if (content.indexOf("list") == 0) {
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage(getText('noRequest'), threadID, messageID);
				let allWorks = "";
				getData.map(item => allWorks = allWorks + `\n- ` + item);
				return api.sendMessage(getText('allRequests', allWorks), threadID, messageID);
			}
		}

		/* ==================== Cipher Commands ================*/

		//morse
		if (contentMessage.indexOf(`${prefix}morse`) == 0) {
			const morsify = require('morsify');
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(event.messageReply.body), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'morse'), threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'morse'), threadID, messageID);
		}

		//caesar
		if (contentMessage.indexOf(`${prefix}caesar`) == 0) {
			if (process.env.CAESAR == '' || process.env.CAESAR == null) return api.sendMessage(getText('pwdNotFound', 'CAESAR'), threadID, messageID);
			const Caesar = require('caesar-salad').Caesar;
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'caesar'), threadID, messageID);
			else (content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'caesar'), threadID, messageID);
		}

		//vigenere
		if (contentMessage.indexOf(`${prefix}vigenere`) == 0) {
			if (process.env.VIGENERE == '' || process.env.VIGENERE == null) return api.sendMessage(getText('pwdNotFound', 'VIGENERE'), threadID, messageID);
			const Vigenere = require('caesar-salad').Vigenere;
			var content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'vigenere'), threadID, messageID)
			else (content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(getText('incorrectSyntax', prefix, 'vigenere'), threadID, messageID);
		}

		//rot47
		if (contentMessage.indexOf(`${prefix}rot47`) == 0) {
			const ROT47 = require('caesar-salad').ROT47;
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
		}

		/* ==================== Media Commands ==================== */

		//youtube music
		if (contentMessage.indexOf(`${prefix}audio`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
			var ytdl = require("ytdl-core");
			if (!googleSearch) return api.sendMessage(getText('noAPIKey', 'Google Search'), threadID, messageID);
			if (content.indexOf("http") == -1) {
				return request(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&key=${googleSearch}&q=${encodeURIComponent(content)}`, function (err, response, body) {
					var retrieve = JSON.parse(body), msg = '', num = 0, link = [];
					if (!retrieve) return api.sendMessage(getText('dieAPI'), threadID);
					if (retrieve.items.length < 1) return api.sendMessage(getText('noVA'), threadID, messageID);
					for (var i = 0; i < 5; i++) {
						if (typeof retrieve.items[i].id.videoId != 'undefined') {
							link.push(retrieve.items[i].id.videoId);
							msg += `${num += 1}. ${decodeURIComponent(retrieve.items[i].snippet.title)} [https://youtu.be/${retrieve.items[i].id.videoId}]\n\n`;
						}
					}
					api.sendMessage(getText('foundVA', link.length, msg), threadID, (err, info) => __GLOBAL.reply.push({ type: "media_audio", messageID: info.messageID, target: parseInt(threadID), author: senderID, url: link }));
				});
			}
			return ytdl.getInfo(content).then(res => {
				if (res.videoDetails.lengthSeconds > 600) return api.sendMessage(getText('exceededLength', 'Audio'), threadID, messageID);
				else {
					let id = res.videoDetails.videoId;
					ytdl(content, { filter: format => format.itag == '140' }).pipe(fs.createWriteStream(__dirname + `/media/${id}.m4a`)).on('close', () => {
						if (fs.statSync(__dirname + `/media/${id}.m4a`).size > 26214400) return api.sendMessage('Không thể gửi file vì dung lượng lớn hơn 25MB.', threadID, messageID);
						else api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/${id}.m4a`) }, threadID, () => fs.unlinkSync(__dirname + `/media/${id}.m4a`), messageID);
					});
				}
			});
		}

		//youtube video
		if (contentMessage.indexOf(`${prefix}video`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
			var ytdl = require("ytdl-core");
			if (!googleSearch) return api.sendMessage(getText('noAPIKey', 'Google Search'), threadID, messageID);
			if (content.indexOf("http") == -1) {
				return request(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&key=${googleSearch}&q=${encodeURIComponent(content)}`, function (err, response, body) {
					var retrieve = JSON.parse(body), msg = '', num = 0, link = [];
					if (!retrieve) return api.sendMessage(getText('dieAPI'), threadID);
					if (retrieve.items < 1) return api.sendMessage(getText('noVA'), threadID, messageID);
					for (var i = 0; i < 5; i++) {
						if (typeof retrieve.items[i].id.videoId != 'undefined') {
							link.push(retrieve.items[i].id.videoId);
							msg += `${num += 1}. ${decodeURIComponent(retrieve.items[i].snippet.title)} [https://youtu.be/${retrieve.items[i].id.videoId}]\n\n`;
						}
					}
					api.sendMessage(getText('foundVA', link.length, msg), threadID, (err, info) => __GLOBAL.reply.push({ type: "media_video", messageID: info.messageID, target: parseInt(threadID), author: senderID, url: link }));
				});
			}
			return ytdl.getInfo(content).then(res => {
				if (res.videoDetails.lengthSeconds > 600) return api.sendMessage(getText('exceededLength', 'Video'), threadID, messageID);
				else {
					let id = res.videoDetails.videoId;
					ytdl(content).pipe(fs.createWriteStream(__dirname + `/media/${id}.mp4`)).on('close', () => {
						if (fs.statSync(__dirname + `/media/${id}.mp4`).size > 26214400) return api.sendMessage('Không thể gửi file vì dung lượng lớn hơn 25MB.', threadID, messageID);
						else api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/${id}.mp4`) }, threadID, () => fs.unlinkSync(__dirname + `/media/${id}.mp4`), messageID);
					});
				}
			});
		}

		//anime
		if (contentMessage.indexOf(`${prefix}anime`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
			var data = JSON.parse(jsonData).sfw;
			if (!content || !data.hasOwnProperty(content)) {
				let sfwList = [];
				Object.keys(data).forEach(endpoint => sfwList.push(endpoint));
				let sfwTags = sfwList.join(', ');
				return api.sendMessage(getText('allTags', 'Anime', sfwTags), threadID, messageID);
			}
			return request(data[content], (error, response, body) => {
				let picData = JSON.parse(body);
				let getURL = "";
				(!picData.data) ? getURL = picData.url : getURL = picData.data.response.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				request(getURL).pipe(fs.createWriteStream(__dirname + `/media/anime.${ext}`)).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/anime.${ext}`) }, threadID, () => fs.unlinkSync(__dirname + `/media/anime.${ext}`), messageID));
			});
		}

		//meme
		if (contentMessage == `${prefix}meme`)
			return request("https://meme-api.herokuapp.com/gimme/memes", (err, response, body) => {
				if (err) throw err;
				var content = JSON.parse(body);
				let title = content.title;
				var baseurl = content.url;
				let callback = function () {
					api.sendMessage({
						body: `${title}`,
						attachment: fs.createReadStream(__dirname + "/src/meme.jpg")
					}, threadID, () => fs.unlinkSync(__dirname + "/src/meme.jpg"), messageID);
				};
				request(baseurl).pipe(fs.createWriteStream(__dirname + `/src/meme.jpg`)).on("close", callback);
			});

		//gif
		if (contentMessage.indexOf(`${prefix}gif`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content.length == -1) return api.sendMessage(getText('incorrectSyntax', prefix, 'gif'), threadID, messageID);
			if (content.indexOf(`cat`) !== -1) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=cat&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + `/media/randompic.gif`)).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + "/media/randompic.gif") }, threadID, () => fs.unlinkSync(__dirname + "/media/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`dog`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=dog&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/media/randompic.gif")).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + "/media/randompic.gif") }, threadID, () => fs.unlinkSync(__dirname + "/media/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`capoo`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=capoo&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/media/randompic.gif")).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + "/media/randompic.gif") }, threadID, () => fs.unlinkSync(__dirname + "/media/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`mixi`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=mixigaming&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/media/randompic.gif")).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + "/media/randompic.gif") }, threadID, () => fs.unlinkSync(__dirname + "/media/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`bomman`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=bommanrage&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/media/randompic.gif")).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + "/media/randompic.gif") }, threadID, () => fs.unlinkSync(__dirname + "/media/randompic.gif"), messageID));
				});
			}
			else return api.sendMessage(getText('incorrectSyntax', prefix, 'gif'), threadID, messageID);
		}

		//hug
		if (contentMessage.indexOf(`${prefix}hug`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/hug', (err, response, body) => {
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function () {
					api.sendMessage({
						body: tag + ", I wanna hug you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//kiss
		if (contentMessage.indexOf(`${prefix}kiss`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/kiss', (err, response, body) => {
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 6, contentMessage.length).replace("@", "");
				let callback = function () {
					api.sendMessage({
						body: tag + ", I wanna kiss you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//tát
		if (contentMessage.indexOf(`${prefix}slap`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/slap', (err, response, body) => {
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function () {
					api.sendMessage({
						body: tag + ", take this slap 😈",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//meow https://cataas.com/c/gif/s/Hello?fi=sepia&c=orange&s=40&t=or
		if (contentMessage.indexOf(`${prefix}meow`) == 0)
			{
        if (contentMessage.length <= 6) return api.sendMessage('======meow======\n\n>>get\n>>gettext\n>>gif\n>>giftext',threadID,messageID);
        let url = "";
        let ext = "";
        let arg = contentMessage;
        if(arg.slice(6, arg.length)=="get") { url = "https://cataas.com/cat", ext = "jpg" } else if(arg.slice(6, 13)=="gettext") {
          if(arg.length < 15) {
            return api.sendMessage('Missing text',threadID,messageID);
          } else { url = `https://cataas.com/cat/says/${arg.slice(14, arg.length)}`, ext = "jpg" }
        } else if(arg.slice(6, arg.length)=='gif') { url = "https://cataas.com/cat/gif", ext = "gif" } else if(arg.slice(6, 13)=="giftext") {
          if(arg.length < 15) {
            return api.sendMessage('Missing text',threadID,messageID);
          } else { url = `https://cataas.com/cat/gif/says/${arg.slice(14, arg.length)}`, ext = "gif" }
        } else return api.sendMessage("Sai cú pháp", threadID, messageID);
        let callback = function () {
					api.sendMessage({
						body: `meow`,
						attachment: fs.createReadStream(__dirname + `/src/meow.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/meow.${ext}`), messageID);
				};
        return request(encodeURI(url)).pipe(fs.createWriteStream(__dirname + `/src/meow.${ext}`)).on("close", callback);
      }

		//sauce
		if (contentMessage == `${prefix}sauce`) {
			const sagiri = require('sagiri'), search = sagiri(saucenao);
			if (event.type != "message_reply") return api.sendMessage(getText('replyPic'), threadID, messageID);
			if (event.messageReply.attachments.length > 1) return api.sendMessage(getText('onePicOnly'), threadID, messageID);
			if (event.messageReply.attachments[0].type == 'photo') {
				if (saucenao == '' || typeof saucenao == 'undefined') return api.sendMessage(getText('noAPIKey', 'Saucenao'), threadID, messageID);
				return search(event.messageReply.attachments[0].url).then(response => {
					let data = response[0];
					let results = {
						similarity: data.similarity,
						material: data.raw.data.material || 'None',
						characters: data.raw.data.characters || 'Original',
						creator: data.raw.data.creator || 'None',
						site: data.site,
						url: data.url
					};
					const minSimilarity = 50;
					if (minSimilarity <= ~~results.similarity) {
						api.sendMessage(getText('sauceResult', results.similarity, results.material, results.characters, results.creator, results.url), threadID, messageID);
					}
					else api.sendMessage(getText('noSauce'), threadID, messageID);
				});
			}
		}

		//change-my-mind
		if (contentMessage.indexOf(`${prefix}change-mind`) == 0) {
			var content = contentMessage.slice(prefix.length + 12, contentMessage.length);
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/change-my-mind.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.drawImage(base, 0, 0);
			ctx.rotate(-6 * (Math.PI / 180));
			ctx.font = '28px Noto';
			let fontSize = 28;
			while (ctx.measureText(content).width > 309) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const lines = await Image.wrapText(ctx, content, 206);
			ctx.fillText(lines.join('\n'), 184, 253, 206);
			ctx.rotate(6 * (Math.PI / 180));
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

		//two-buttons
		if (contentMessage.indexOf(`${prefix}buttons`) == 0) {
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var split = content.split(" | ");
			var first = split[0];
			var second = split[1];
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/two-buttons.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.drawImage(base, 0, 0);
			ctx.rotate(-12 * (Math.PI / 180));
			ctx.font = '34px Noto';
			let fontSize = 34;
			while (ctx.measureText(first).width > 366) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const firstLines = await Image.wrapText(ctx, first, 183);
			let lineOffset = 0;
			for (let i = 0; i < firstLines.length; i++) {
				ctx.fillText(firstLines[i], 25 + lineOffset, 116 + (fontSize * i) + (10 * i), 183);
				lineOffset += 5;
			}
			ctx.font = '34px Noto';
			fontSize = 34;
			while (ctx.measureText(second).width > 244) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const secondLines = await Image.wrapText(ctx, second, 118);
			lineOffset = 0;
			for (let i = 0; i < secondLines.length; i++) {
				ctx.fillText(secondLines[i], 254 + lineOffset, 130 + (fontSize * i) + (10 * i), 118);
				lineOffset += 5;
			}
			ctx.rotate(12 * (Math.PI / 180));
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

		//new-password
		if (contentMessage.indexOf(`${prefix}new-pwd`) == 0) {
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var split = content.split(" | ");
			var weak = split[0];
			var strong = split[1];
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/new-password.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(base, 0, 0);
			ctx.font = '25px Noto';
			ctx.fillText(Image.shortenText(ctx, weak, 390), 40, 113);
			ctx.fillText(Image.shortenText(ctx, strong, 390), 40, 351);
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

		/* ==================== General Commands ================*/

		//shortcut
		if (contentMessage.indexOf(`${prefix}short`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (!content) return api.sendMessage(getText('incorrectSyntax', prefix, 'short'), threadID, messageID);
			if (content.indexOf(`del`) == 0) {
				let delThis = contentMessage.slice(prefix.length + 10, contentMessage.length);
				if (!delThis) return api.sendMessage(getText('didntEnterShort'), threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					var getThread = oldData.find(item => item.id == threadID).shorts;
					if (!getThread.some(item => item.in == delThis)) return api.sendMessage(getText('notExistsShort'), threadID, messageID);
					getThread.splice(getThread.findIndex(item => item.in === delThis), 1);
					fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage(getText('deletedShort'), threadID, messageID));
				});
			}
			else if (content.indexOf(`all`) == 0)
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					let allData = JSON.parse(data);
					let msg = '';
					if (!allData.some(item => item.id == threadID)) return api.sendMessage(getText('noShort'), threadID, messageID);
					if (allData.some(item => item.id == threadID)) {
						let getThread = allData.find(item => item.id == threadID).shorts;
						getThread.forEach(item => msg = '\n' + msg + item.in + ' -> ' + item.out);
					}
					if (!msg) return api.sendMessage(getText('noShort'), threadID, messageID);
					api.sendMessage(getText('allShorts', msg), threadID, messageID);
				});
			else {
				let narrow = content.indexOf(" => ");
				if (narrow == -1) return api.sendMessage(getText('incorrectSyntax', prefix, 'short'), threadID, messageID);
				let shortin = content.slice(0, narrow);
				let shortout = content.slice(narrow + 4, content.length);
				if (shortin == shortout) return api.sendMessage(getText('sameIO'), threadID, messageID);
				if (!shortin) return api.sendMessage(getText('noIO', 'Input'), threadID, messageID);
				if (!shortout) return api.sendMessage(getText('noIO', 'Output'), threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					if (!oldData.some(item => item.id == threadID)) {
						let addThis = {
							id: threadID,
							shorts: []
						}
						addThis.shorts.push({ in: shortin, out: shortout });
						oldData.push(addThis);
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage(getText('createdShort'), threadID, messageID));
					}
					else {
						let getShort = oldData.find(item => item.id == threadID);
						if (getShort.shorts.some(item => item.in == shortin)) {
							let index = getShort.shorts.indexOf(getShort.shorts.find(item => item.in == shortin));
							let output = getShort.shorts.find(item => item.in == shortin).out;
							getShort.shorts[index].out = output + " | " + shortout;
							api.sendMessage(getText('dupShort'), threadID, messageID);
							return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8");
						}
						getShort.shorts.push({ in: shortin, out: shortout });
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage(getText('createdShort'), threadID, messageID));
					}
				});
			}
		}

		//wake time calculator
		if (contentMessage.indexOf(`${prefix}sleep`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var wakeTime = [];
			if (!content) {
				for (var i = 1; i < 7; i++) wakeTime.push(moment().utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage(getText('sleepNow', wakeTime.join(', ')), threadID, messageID);
			}
			else {
				if (content.indexOf(":") == -1) return api.sendMessage(getText('incorrectSyntax', prefix, 'sleep'), threadID, messageID);
				var contentHour = content.split(":")[0];
				var contentMinute = content.split(":")[1];
				if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2) return api.sendMessage(getText('incorrectSyntax', prefix, 'sleep'), threadID, messageID); var getTime = moment().utcOffset("+07:00").format();
				var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
				var sleepTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
				for (var i = 1; i < 7; i++) wakeTime.push(moment(sleepTime).utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage(getText('sleep', content, wakeTime.join(', ')), threadID, messageID);
			}
		}

		//sleep time calculator
		if (contentMessage.indexOf(`${prefix}wake`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var sleepTime = [];
			var contentHour = content.split(":")[0];
			var contentMinute = content.split(":")[1];
			if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2) return api.sendMessage(getText('incorrectSyntax', prefix, 'wake'), threadID, messageID);
			var getTime = moment().utcOffset("+07:00").format();
			var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
			var wakeTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
			for (var i = 6; i > 0; i--) sleepTime.push(moment(wakeTime).utcOffset("+07:00").subtract(90 * i + 15, 'm').format("HH:mm"));
			return api.sendMessage(getText('wake', content, sleepTime.join(', ')), threadID, messageID);
		}

		//prefix
		if (contentMessage == 'prefix') return api.sendMessage(getText('prefix', prefix), threadID, messageID);

		//credits
		if (contentMessage == "credits") return api.sendMessage(getText('credit'), threadID, messageID);

		//random name
		if (contentMessage.indexOf(`${prefix}rname`) == 0) return request(`https://uzby.com/api.php?min=4&max=12`, (err, response, body) => api.changeNickname(`${body}`, threadID, senderID));

		//sim on
		if (contentMessage == `${prefix}nino on`) {
			__GLOBAL.simOn.push(threadID);
			return api.sendMessage('Bật ninoreply thành công!', threadID);
		}

		//sim off
		if (contentMessage == `${prefix}nino off`) {
			__GLOBAL.simOn.splice(__GLOBAL.simOn.indexOf(threadID), 1);
			return api.sendMessage('Đã tắt ninoreply!', threadID);
		}
    //ninoteach
    if (contentMessage.indexOf(`${prefix}ninoteach`) == 0) {
      let fw = contentMessage.indexOf(" => ");
          if (fw == -1) {
             return api.sendMessage('sai format rồi nha :<',threadID,messageID)} else {
             let ask = contentMessage.slice(11, fw);
             let answer = contentMessage.slice(fw + 4, contentMessage.length);
             if (ask=="") {return api.sendMessage('Vui lòng đặt câu hỏi ;-;',threadID,messageID)} else {
                if (ask == answer) {return api.sendMessage('Trùng câu hỏi câu trả lời kìa ;-;',threadID,messageID)} {
                  let fullcontent = encodeURIComponent(`${ask}&&${answer}`);
                    axios.get(`https://www.api-adreno.tk/nino/add/${fullcontent}`).then(res => {
                        if (res.data.reply == "Key với value có hết cmnr, thêm cái cc"){
                            return api.sendMessage('Bạn ơi, câu hỏi và câu trả lời đã có sẵn rồi nhá ;-;',threadID,messageID)} else {
                                if (res.data.reply == "Bị lỗi cc gì đó éo biết") {return api.sendMessage('Lỗi không xác dịnh ;-;',threadID,messageID)} else {
                                    return api.sendMessage('Dạy thành công!',threadID,messageID);
                                }
                            }
                    })
                }
             }
             }
    }

		//nino
		if (contentMessage.indexOf(`${prefix}nino`) == 0 && contentMessage.indexOf(`${prefix}ninoteach`) != 0) return axios.get(`http://www.api-adreno.tk/nino/get/${encodeURIComponent(contentMessage.slice(prefix.length + 5, contentMessage.length))}`).then(res => {
            if (res.data.reply == "null" || res.data.reply == "ủa nói j hong hiểu :<") {
                api.sendMessage("nino ko hiểu, dạy nino đi :<",threadID,messageID)
            } else {
                return api.sendMessage(res.data.reply, threadID, messageID);
            }
    })

		//mit
		if (contentMessage.indexOf(`${prefix}mit`) == 0) return request(`https://kakko.pandorabots.com/pandora/talk-xml?input=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&botid=9fa364f2fe345a10&custid=${senderID}`, (err, response, body) => api.sendMessage((/<that>(.*?)<\/that>/.exec(body)[1]), threadID, messageID));

		//penis
		if (contentMessage.indexOf(`${prefix}penis`) == 0) return api.sendMessage(`8${'='.repeat(Math.floor(Math.random() * 10))}D`, threadID, messageID);

		//reminder
		if (contentMessage.indexOf(`${prefix}reminder`) == 0) {
			const time = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (isNaN(time)) return api.sendMessage(getText('isNaN'), threadID, messageID);
			const display = time > 59 ? getText('timeMin', time / 60) : getText('timeSec', time);
			api.sendMessage(getText('remindAfter', display), threadID, messageID);
			await new Promise(resolve => setTimeout(resolve, time * 1000));
			api.sendMessage({
				body: getText('remindUser') + getText('remind'),
				mentions: [{
					tag: getText('remindUser'),
					id: senderID
				}]
			}, threadID, messageID);
		}

		//random màu cho theme chat
		if (contentMessage == `${prefix}randomcolor`) {
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			return api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID, (err) => (err) ? api.sendMessage(getText('error'), threadID, messageID) : '');
		}

		//poll
		if (contentMessage.indexOf(`${prefix}poll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var title = content.slice(0, content.indexOf(" -> "));
			var options = content.substring(content.indexOf(" -> ") + 4)
			var option = options.split(" | ");
			var object = {};
			if (option.length == 1 && option[0].includes(' |')) option[0] = option[0].replace(' |', '');
			for (var i = 0; i < option.length; i++) object[option[i]] = false;
			return api.createPoll(title, threadID, object, (err) => (err) ? api.sendMessage(getText('error'), threadID, messageID) : '');
		}

		//rainbow
		if (contentMessage.indexOf(`${prefix}rainbow`) == 0) {
			var value = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (isNaN(value)) return api.sendMessage(getText('isNaN'), threadID, messageID);
			if (!value) return api.sendMessage("Sai format", threadID, messageID);
			if (value > 10000) return api.sendMessage(getText('lessThan', '10000'), threadID, messageID);
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			for (var i = 0; i < value; i++) {
				api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID)
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			return;
		}

		//giveaway
		if (contentMessage.indexOf(`${prefix}ga`) == 0 && contentMessage.slice(3,4) == ' ') {
			var content = contentMessage.slice(prefix.length + 3, contentMessage.length);
			api.getThreadInfo(threadID, async function (err, info) {
				if (err) return api.sendMessage(getText('error'), threadID, messageID);
				let winner = info.participantIDs[Math.floor(Math.random() * info.participantIDs.length)];
				let userInfo = await User.getInfo(winner);
				var name = userInfo.name;
				api.sendMessage({
					body: getText('ga', name, content),
					mentions: [{
						tag: name,
						id: winner
					}]
				}, threadID, messageID);
			});
			return;
		}

		//thời tiết
		if (contentMessage.indexOf(`${prefix}weather`) == 0) {
			var city = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (city.length == 0) return api.sendMessage(getText('incorrectSyntax', prefix, 'weather'), threadID, messageID);
			request(encodeURI("https://api.openweathermap.org/data/2.5/weather?q=" + city + "&appid=" + openweather + "&units=metric&lang=" + process.env.LANGUAGE), (err, response, body) => {
				if (err) throw err;
				var weatherData = JSON.parse(body);
				if (weatherData.cod !== 200) return api.sendMessage(getText('locatNotFound', city), threadID, messageID);
				var sunrise_date = moment.unix(weatherData.sys.sunrise).tz("Asia/Ho_Chi_Minh");
				var sunset_date = moment.unix(weatherData.sys.sunset).tz("Asia/Ho_Chi_Minh");
				api.sendMessage({
					body: getText('locatData', weatherData.main.temp, weatherData.main.feels_like, weatherData.weather[0].description, weatherData.main.humidity, weatherData.wind.speed, sunrise_date.format('HH:mm:ss'), sunset_date.format('HH:mm:ss')),
					location: {
						latitude: weatherData.coord.lat,
						longitude: weatherData.coord.lon,
						current: true
					},
				}, threadID, messageID);
			});
			return;
		}

		//say
		if (contentMessage.indexOf(`${prefix}say`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 4, contentMessage.length);
			var languageToSay = (["ru", "en", "ko", "ja"].some(item => content.indexOf(item) == 0)) ? content.slice(0, content.indexOf(" ")) : 'vi';
			var msg = (languageToSay != 'vi') ? content.slice(3, contentMessage.length) : content;
			var callback = () => api.sendMessage({ body: "", attachment: fs.createReadStream(__dirname + "/src/say.mp3") }, threadID, () => fs.unlinkSync(__dirname + "/src/say.mp3"));
			return request(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(msg)}&tl=${languageToSay}&client=tw-ob`).pipe(fs.createWriteStream(__dirname + '/src/say.mp3')).on('close', () => callback());
		}

		//cập nhật tình hình dịch
		if (contentMessage.indexOf(`${prefix}covid`) == 0) {
		    let input = contentMessage.slice(prefix.length + 6);
		    if (!input) input = "Việt Nam";
		    axios.get(encodeURI(`https://CoronaAPI.noname234.repl.co/corona/${input}`)).then(res => {
		      if (res.status == 429) return api.sendMessage("Spam ít thôi", threadID, messageID);
		      if (res.data.data == null) return api.sendMessage("Không tìm thấy quốc gia bạn nhập", threadID, messageID);
		      let data = res.data.data;
		      input = Object.keys(data)[1];
		      let msg = `======COVID-19======\n- Thế giới:\n❯ Nhiễm: ${data.world.cases}\n❯ Tử vong: ${data.world.deaths}\n❯ Hồi phục: ${data.world.recovered}\n- ${input.toUpperCase()}:\n❯ Nhiễm: ${data[input].cases}\n❯ Tử vong: ${data[input].deaths}\n❯ Hồi phục: ${data[input].recovered}`;
		      return api.sendMessage(msg, threadID, messageID);
		    })
		}

		//chọn
		if (contentMessage.indexOf(`${prefix}choose`) == 0) {
			var input = contentMessage.slice(prefix.length + 7, contentMessage.length).trim();
			if (!input) return api.sendMessage(getText('incorrectSyntax', prefix, 'choose'), threadID, messageID);
			var array = input.split(" | ");
			return api.sendMessage(getText('choose', array[Math.floor(Math.random() * array.length)]), threadID, messageID);
		}

		//waifu
		if (contentMessage == `${prefix}waifu`) {
			var route = Math.round(Math.random() * 10);
			if (route == 1 || route == 0 || route == 3) return api.sendMessage(getText('waifu1'), threadID, messageID);
			else if (route == 2 || route > 4) return api.sendMessage(getText('waifu2'), threadID, messageID);
		}

		//ramdom con số
		if (contentMessage.indexOf(`${prefix}roll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage(getText('roll', Math.floor(Math.random() * 99)), threadID, messageID);
			var splitContent = content.split(" ");
			if (splitContent.length != 2) return api.sendMessage(getText('incorrectSyntax', prefix, 'roll'), threadID, messageID)
			var min = parseInt(splitContent[0]);
			var max = parseInt(splitContent[1]);
			if (isNaN(min) || isNaN(max)) return api.sendMessage(getText('isNaN'), threadID, messageID);
			if (min >= max) return api.sendMessage(getText('minGTEmax'), threadID, messageID);
			return api.sendMessage(getText('roll', Math.floor(Math.random() * (max - min + 1) + min)), threadID, messageID);
		}

		//Khiến bot nhái lại tin nhắn bạn
		if (contentMessage.indexOf(`${prefix}echo`) == 0) return api.sendMessage(contentMessage.slice(prefix.length + 5, contentMessage.length), threadID);

		//rank
		if (contentMessage.indexOf(`${prefix}rank`) == 0) {
			const createCard = require("../controllers/rank_card.js");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			let all = await User.getUsers(['uid', 'point']);
			all.sort((a, b) => {
				if (a.point > b.point) return -1;
				if (a.point < b.point) return 1;
				if (a.uid > b.uid) return 1;
				if (a.uid < b.uid) return -1;
			});
			if (!content) {
				let rank = all.findIndex(item => item.uid == senderID) + 1;
				let name = await User.getName(senderID);
				if (rank == 0) api.sendMessage(getText('cantGetRank1'), threadID, messageID);
				else Rank.getInfo(senderID).then(point => createCard({ id: senderID, name, rank, ...point })).then(path => api.sendMessage({ attachment: fs.createReadStream(path) }, threadID, () => fs.unlinkSync(path), messageID));
			}
			else {
				let mentions = Object.keys(event.mentions);
				mentions.forEach(i => {
					let name = event.mentions[i].replace('@', '');
					let rank = all.findIndex(item => item.uid == i) + 1;
					if (rank == 0) api.sendMessage(getText('cantGetRank2', name), threadID, messageID);
					else Rank.getInfo(i).then(point => createCard({ id: parseInt(i), name, rank, ...point })).then(path => api.sendMessage({ attachment: fs.createReadStream(path) }, threadID, () => fs.unlinkSync(path), messageID));
				});
			}
			return;
		}

		//dịch ngôn ngữ
		if (contentMessage.indexOf(`${prefix}trans`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (content.length == 0 && event.type != "message_reply") return api.sendMessage(getText('incorrectSyntax', prefix, 'trans'), threadID, messageID);
			var translateThis = content.slice(0, content.indexOf(" ->"));
			var lang = content.substring(content.indexOf(" -> ") + 4);
			if (event.type == "message_reply") {
				translateThis = event.messageReply.body
				if (content.indexOf(" -> ") != -1) lang = content.substring(content.indexOf(" -> ") + 4);
				else lang = 'vi';
			}
			else if (content.indexOf(" -> ") == -1) {
				translateThis = content.slice(0, content.length)
				lang = 'vi';
			}
			return request(encodeURI(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${translateThis}`), (err, response, body) => {
				if (err) return api.sendMessage(getText('error'), threadID, messageID)
				var retrieve = JSON.parse(body);
				var fromLang = retrieve[0][0][8][0][0][1].split("_")[0];
				api.sendMessage(getText('translate', retrieve[0][0][0], fromLang, lang), threadID, messageID);
			});
		}

		//uptime
		if (contentMessage == `${prefix}uptime`) {
			var time = process.uptime();
			var hours = Math.floor(time / (60 * 60));
			var minutes = Math.floor((time % (60 * 60)) / 60);
			var seconds = Math.floor(time % 60);
			return api.sendMessage(getText('uptime', hours, minutes, seconds), threadID, messageID);
		}

		//unsend message
		if (contentMessage.indexOf(`${prefix}gỡ`) == 0) {
			if (event.messageReply.senderID != api.getCurrentUserID()) return api.sendMessage(getText('unsendErr1'), threadID, messageID);
			if (event.type != "message_reply") return api.sendMessage(getText('unsendErr2'), threadID, messageID);
			return api.unsendMessage(event.messageReply.messageID, err => (err) ? api.sendMessage(getText('error'), threadID, messageID) : '');
		}

		//get uid
		if (contentMessage.indexOf(`${prefix}uid`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (!content) return api.sendMessage(`${senderID}`, threadID, messageID);
			else if (content.indexOf("@") !== -1) {
				for (var i = 0; i < Object.keys(event.mentions).length; i++) api.sendMessage(`${Object.keys(event.mentions)[i]}`, threadID, messageID);
				return;
			}
		}

		//wiki
		if (contentMessage.indexOf(`${prefix}wiki`) == 0) {
			const wiki = require("wikijs").default;
			var url = 'https://vi.wikipedia.org/w/api.php';
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (contentMessage.indexOf("-en") == 6) {
				url = 'https://en.wikipedia.org/w/api.php';
				content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			}
			if (!content) return api.sendMessage(getText('wikiErr1'), threadID, messageID);
			return wiki({ apiUrl: url }).page(content).catch(() => api.sendMessage(getText('wikiErr2', content), threadID, messageID)).then(page => (typeof page != 'undefined') ? Promise.resolve(page.summary()).then(val => api.sendMessage(val, threadID, messageID)) : '');
		}

		//ping
		if (contentMessage.indexOf(`${prefix}ping`) == 0)
			return api.getThreadInfo(threadID, (err, info) => {
				if (err) return api.sendMessage(getText('error'), threadID, messageID);
				var ids = info.participantIDs;
				ids.splice(ids.indexOf(api.getCurrentUserID()), 1);
				var body = '@everyone', mentions = [];
				for (let i = 0; i < ids.length; i++) {
					if (i == body.length) body += 'e';
					mentions.push({
						tag: body[i],
						id: ids[i],
						fromIndex: i
					});
				}
				api.sendMessage({ body, mentions }, threadID, messageID);
			});

		//look earth
		if (contentMessage == `${prefix}earth`)
			return request(`https://api.nasa.gov/EPIC/api/natural/images?api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				var randomNumber = Math.floor(Math.random() * ((jsonData.length - 1) + 1));
				var image_name = jsonData[randomNumber].image
				var date = jsonData[randomNumber].date;
				var date_split = date.split("-")
				var year = date_split[0];
				var month = date_split[1];
				var day_and_time = date_split[2];
				var sliced_date = day_and_time.slice(0, 2);
				var image_link = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${sliced_date}/png/` + image_name + ".png";
				let callback = function () {
					api.sendMessage({
						body: `${jsonData[randomNumber].caption} on ${date}`,
						attachment: fs.createReadStream(__dirname + `/src/randompic.png`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/randompic.png`), messageID);
				};
				request(image_link).pipe(fs.createWriteStream(__dirname + `/src/randompic.png`)).on("close", callback);
			});

		//localtion iss
		if (contentMessage == `${prefix}iss`) {
			return request(`http://api.open-notify.org/iss-now.json`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(getText('iss', jsonData.iss_position.latitude, jsonData.iss_position.longitude), threadID, messageID);
			});
		}

		//near-earth obj
		if (contentMessage == `${prefix}neo`) {
			return request(`https://api.nasa.gov/neo/rest/v1/feed/today?detailed=true&api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(getText('neo', jsonData.element_count), threadID, messageID);
			});
		}

		/*spacex
		if (contentMessage == `${prefix}spacex`) {
			return request(`https://api.spacexdata.com/v4/launches/latest`, (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(getText('spacex', data.mission_name, data.launch_year, data.launch_date_local, data.rocket.rocket_name, data.links.video_link), threadID, messageID);
			});
		}*/

		//afk
		if (contentMessage.indexOf(`${prefix}afk`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content) {
				await User.updateReason(senderID, content);
				api.sendMessage('🛠 | ' + getText('afkWithReason', content), threadID, messageID);
			}
			else {
				await User.updateReason(senderID, 'none');
				api.sendMessage('🛠 | ' + getText('afk'), threadID, messageID);
			}
			await User.afk(senderID);
			__GLOBAL.afkUser.push(parseInt(senderID));
			return;
		}

		/* ==================== Game Commands ==================== */

		//osu!
		// if (contentMessage.indexOf(`/osu!`) == 0 || contentMessage.indexOf(`osu!`) == 0) {
		// 	let body_osu = contentMessage.split(" ");
		// 	if (!body_osu[1]) return api.sendMessage(getText('osuErr'), threadID, messageID);
		// 	return request(`http://lemmmy.pw/osusig/sig.php?colour=hex8866ee&uname=${body_osu[1]}&pp=1&countryrank&rankedscore&onlineindicator=undefined&xpbar&xpbarhex`).pipe(fs.createWriteStream(__dirname + `/src/osu!.png`)).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + `/src/osu!.png`) }, threadID, () => fs.unlinkSync(__dirname + `/src/osu!.png`), messageID))
		// }

		/* ==================== Study Commands ==================== */

		//toán học
		if (contentMessage.indexOf(`${prefix}math`) == 0) {
			const wolfram = "http://api.wolframalpha.com/v2/result?appid=" + wolfarm + "&i=";
			var m = contentMessage.slice(prefix.length + 5, contentMessage.length);
			request(wolfram + encodeURIComponent(m), function (err, response, body) {
				if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage(getText('didntUnderstand'), threadID, messageID);
				else if (body.toString() === "My name is Wolfram Alpha.") return api.sendMessage(getText('mirai'), threadID, messageID);
				else if (body.toString() === "I was created by Stephen Wolfram and his team.") return api.sendMessage(getText('created'), threadID, messageID);
				else if (body.toString() === "StringJoin(CalculateParse`Content`Calculate`InternetData(Automatic, Name))") return api.sendMessage(getText('noAnswer'), threadID, messageID);
				else return api.sendMessage(body, threadID, messageID);
			});
		}

		//cân bằng phương trình hóa học
		if (contentMessage.indexOf(`${prefix}chemeb`) == 0) {
			console.log = () => { };
			const chemeb = require('chem-eb');
			if (event.type == "message_reply") {
				var msg = event.messageReply.body;
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage(getText('notSupportXYz'), threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
			else {
				var msg = contentMessage.slice(prefix.length + 7, contentMessage.length);
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage(getText('notSupportXYz'), threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
		}

		//do math
		if (contentMessage.indexOf(`${prefix}domath`) == 0) {
			const content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			let difficulty, answer, value1, value2;
			const difficulties = ['baby', 'easy', 'medium', 'hard', 'extreme', 'impossible'];
			(difficulties.some(item => content == item)) ? difficulty = content : difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
			const operations = ['+', '-', '*'];
			const maxValues = { baby: 10, easy: 50, medium: 100, hard: 500, extreme: 1000, impossible: Number.MAX_SAFE_INTEGER };
			const operation = operations[Math.floor(Math.random() * operations.length)];
			value1 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
			value2 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
			switch (operation) {
				case '+':
					answer = value1 + value2;
					break;
				case '-':
					answer = value1 - value2;
					break;
				case '*':
					answer = value1 * value2;
					break;
			}
			return api.sendMessage(getText('15secs', `${value1} ${operation} ${value2} = ?`), threadID, (err, info) => __GLOBAL.reply.push({ type: "domath", messageID: info.messageID, target: parseInt(threadID), author: senderID, answer }), messageID);
		}

		/* ==================== NSFW Commands ==================== */

		//nhentai search
		if (contentMessage.indexOf(`${prefix}nhentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			let id = contentMessage.slice(prefix.length + 8, contentMessage.length).trim();
			if (!id) return api.sendMessage(getText('idealCode', Math.floor(Math.random() * 99999)), threadID, messageID);
			return request(`https://nhentai.net/api/gallery/${id}`, (error, response, body) => {
				var codeData = JSON.parse(body);
				if (codeData.error == true) return api.sendMessage(getText('cantFindHentai'), threadID, messageID);
				let title = codeData.title.pretty;
				let tagList = [];
				let artistList = [];
				let characterList = [];
				codeData.tags.forEach(item => (item.type == "tag") ? tagList.push(item.name) : (item.type == "artist") ? artistList.push(item.name) : (item.type == "character") ? characterList.push(item.name) : '');
				var tags = tagList.join(', ');
				var artists = artistList.join(', ');
				var characters = characterList.join(', ');
				if (characters == '') characters = 'Original';
				api.sendMessage(getText('codeInfo', title, artists, characters, tags, 'https://nhentai.net/g/' + id), threadID, messageID);
			});
		}

		//hentaivn
		if (contentMessage.indexOf(`${prefix}hentaivn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			const cheerio = require('cheerio');
			var id = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (!id) return api.sendMessage(getText('idealCode', Math.floor(Math.random() * 21553)), threadID, messageID);
			axios.get(`https://hentaivn.net/id${id}`).then((response) => {
				if (response.status == 200) {
					const html = response.data;
					const $ = cheerio.load(html);
					var getContainer = $('div.container');
					var getURL = getContainer.find('form').attr('action');
					if (getURL == `https://hentaivn.net/${id}-doc-truyen-.html`) return api.sendMessage(getText('cantFindHentai'), threadID, messageID);
					axios.get(getURL).then((response) => {
						if (response.status == 200) {
							const html = response.data;
							const $ = cheerio.load(html);
							var getInfo = $('div.container div.main div.page-info');
							var getName = getInfo.find('h1').find('a').text();
							var getTags = getInfo.find('a.tag').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getArtist = getInfo.find('a[href^="/tacgia="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getChar = getInfo.find('a[href^="/char="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							if (getChar == '') getChar = 'Original';
							return api.sendMessage(getText('codeInfo', getName.substring(1), getArtist, getChar, getTags, getURL.slice(0, 17) + " " + getURL.slice(17)), threadID, messageID);
						}
					}, (error) => console.log(error));
				}
			}, (error) => console.log(error));
			return;
		}

		//porn pics
		if (contentMessage.indexOf(`${prefix}porn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			return Nsfw.pornUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(getText('exceededNSFW', prefix, 'porn'), threadID, messageID);
				const cheerio = require('cheerio');
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				var album = {
					'asian': "9057591",
					'ass': "2830292",
					'bdsm': "17510771",
					'bj': "3478991",
					'boobs': "15467902",
					'cum': "1036491",
					'feet': "852341",
					'gay': "19446301",
					'pornstar': "20404671",
					'pussy': "1940602",
					'sex': "2132332",
					'teen': "17887331"
				};
				if (!content || !album.hasOwnProperty(content)) {
					let allTags = [];
					Object.keys(album).forEach((item) => allTags.push(item));
					var pornTags = allTags.join(', ');
					return api.sendMessage(getText('allTags', 'Porn', pornTags), threadID, messageID);
				}
				axios.get(`https://www.pornhub.com/album/${album[content]}`).then((response) => {
					if (useLeft != -1) Nsfw.subtractPorn(senderID);
					if (response.status == 200) {
						const html = response.data;
						const $ = cheerio.load(html);
						var result = [];
						let list = $('ul.photosAlbumsListing li.photoAlbumListContainer div.photoAlbumListBlock');
						list.map(index => {
							let item = list.eq(index);
							if (!item.length) return;
							let photo = `${item.find('a').attr('href')}`;
							result.push(photo);
						});
						let getURL = "https://www.pornhub.com" + result[Math.floor(Math.random() * result.length)];
						axios.get(getURL).then((response) => {
							if (response.status == 200) {
								const html = response.data;
								const $ = cheerio.load(html);
								if (content == 'sex') {
									let video = $('video.centerImageVid');
									let mp4URL = video.find('source').attr('src');
									let ext = mp4URL.substring(mp4URL.lastIndexOf('.') + 1);
									request(mp4URL).pipe(fs.createWriteStream(__dirname + `/media/porn.${ext}`)).on('close', () => {
										return api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/porn.${ext}`) }, threadID, () => fs.unlinkSync(__dirname + `/media/porn.${ext}`), messageID);
									});
								}
								else {
									let image = $('div#photoWrapper');
									let imgURL = image.find('img').attr('src');
									let ext = imgURL.substring(imgURL.lastIndexOf('.') + 1);
									return request(imgURL).pipe(fs.createWriteStream(__dirname + `/media/porn.${ext}`)).on('close', () => api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/porn.${ext}`) }, threadID, () => fs.unlinkSync(__dirname + `/media/porn.${ext}`), messageID));
								}
							}
						}, (error) => console.log(error));
					}
					else return api.sendMessage(getText('error'), threadID, messageID);
				}, (error) => console.log(error));
			});
		}

		//hentai
		if (contentMessage.indexOf(`${prefix}hentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			return Nsfw.hentaiUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(getText('exceededNSFW', prefix, 'hentai'), threadID, messageID);
				var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
				var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
				var data = JSON.parse(jsonData).nsfw;
				if (!content || !data.hasOwnProperty(content)) {
					let nsfwList = [];
					Object.keys(data).forEach(endpoint => nsfwList.push(endpoint));
					let nsfwTags = nsfwList.join(', ');
					return api.sendMessage(getText('allTags', 'Hentai', nsfwTags), threadID, messageID);
				}
				request(data[content], (error, response, body) => {
					if (useLeft != -1) Nsfw.subtractHentai(senderID);
					let picData = JSON.parse(body);
					let getURL = "";
					(!picData.data) ? getURL = picData.url : getURL = picData.data.response.url;
					let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
					request(getURL).pipe(fs.createWriteStream(__dirname + `/media/hentai.${ext}`)).on("close", () => api.sendMessage({ attachment: fs.createReadStream(__dirname + `/media/hentai.${ext}`) }, threadID, () => fs.unlinkSync(__dirname + `/media/hentai.${ext}`), messageID));
				});
			});
		}

		//get nsfw tier
		if (contentMessage == `${prefix}mynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			let { porn, hentai, tier } = await Nsfw.getNSFW(senderID);
			if (tier == -1) api.sendMessage(getText('godmodeNSFW'), threadID, messageID);
			else api.sendMessage(getText('myNSFW', tier, prefix, porn, hentai), threadID, messageID);
			return;
		}

		//buy nsfw tier
		if (contentMessage == `${prefix}buynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			let { tier } = await Nsfw.getNSFW(senderID);
			if (tier == -1) api.sendMessage(getText('cantBuyNSFW'), threadID, messageID);
			else {
				let buy = await Nsfw.buyNSFW(senderID);
				if (buy == false) api.sendMessage(getText('error'), threadID, messageID);
				else api.sendMessage(buy.toString(), threadID, messageID);
			}
			return;
		}

		//set nsfw tier
		if (contentMessage.indexOf(`${prefix}setnsfw`) == 0 && admins.includes(senderID)) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage(getText('offNSFW'), threadID, messageID);
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var tierSet = content.substring(content.lastIndexOf(" ") + 1);
			if (isNaN(tierSet)) return api.sendMessage(getText('isNaN'), threadID, messageID);
			if (tierSet > 5 || tierSet < -1) return api.sendMessage(getText('nsfwTierLimit'), threadID, messageID);
			if (tierSet == -1 && nsfwGodMode == false) return api.sendMessage(getText('gmConfig'), threadID, messageID);
			if (!mention && sender == 'me' && tierSet != -1) return api.sendMessage(getText('setNSFWMe', tierSet), threadID, () => Nsfw.setNSFW(senderID, parseInt(tierSet)), messageID);
			if (!mention && sender == 'me' && tierSet == -1) return api.sendMessage(getText('godmodeNSFW'), threadID, () => Nsfw.setNSFW(senderID, parseInt(tierSet)), messageID);
			if (sender != 'me' && tierSet != -1)
				api.sendMessage({
					body: getText('setNSFWUser', event.mentions[mention].replace("@", ""), tierSet),
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
			if (senderID != 'me' && tierSet == -1)
				api.sendMessage({
					body: getText('setNSFWgm', event.mentions[mention].replace("@", "")),
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
			return;
		}

		/* ==================== Economy and Minigame Commands ==================== */

		//coinflip
		if (contentMessage.indexOf(`${prefix}coinflip`) == 0) return (Math.random() > 0.5) ? api.sendMessage(getText('coinTail'), threadID, messageID) : api.sendMessage(getText('coinHead'), threadID, messageID);

		//money
		if (contentMessage.indexOf(`${prefix}money`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var mention = Object.keys(event.mentions)[0];
			if (!content) return Economy.getMoney(senderID).then((moneydb) => api.sendMessage(getText('moneyMe', moneydb), threadID, messageID));
			else if (content.indexOf("@") !== -1)
				return Economy.getMoney(mention).then((moneydb) => {
					api.sendMessage({
						body: getText('moneyUser', event.mentions[mention].replace("@", ""), moneydb),
						mentions: [{
							tag: event.mentions[mention].replace("@", ""),
							id: mention
						}]
					}, threadID, messageID);
				});
		}

		//daily gift
		if (contentMessage == `${prefix}daily`) {
			let cooldown = 8.64e7;
			return Economy.getDailyTime(senderID).then((lastDaily) => {
				if (lastDaily !== null && cooldown - (Date.now() - lastDaily) > 0) {
					let time = ms(cooldown - (Date.now() - lastDaily));
					api.sendMessage(getText('receivedDaily', time.hours, time.minutes, time.seconds), threadID, messageID);
				}
				else
					api.sendMessage(getText('daily'), threadID, () => {
						Economy.addMoney(senderID, 300);
						Economy.updateDailyTime(senderID, Date.now());
					}, messageID);
			});
		}

		//work
		if (contentMessage == `${prefix}work`) {
			return Economy.getWorkTime(senderID).then((lastWork) => {
				let cooldown = 1200000;
				if (lastWork !== null && cooldown - (Date.now() - lastWork) > 0) {
					let time = ms(cooldown - (Date.now() - lastWork));
					api.sendMessage(getText('worked', time.minutes, time.seconds), threadID, messageID);
				}
				else {
					let job = [
						getText('job1'),
						getText('job2'),
						getText('job3'),
						getText('job4'),
						getText('job5'),
						getText('job6'),
						getText('job7'),
						getText('job8'),
						getText('job9'),
						getText('job10'),
						getText('job11'),
						getText('job12'),
						getText('job13'),
						getText('job14'),
						getText('job15'),
            "làm chó 24h",
            "Bạn bị Đức Bo địt và đéo nhận được đồng nào."
					];
					let amount = Math.floor(Math.random() * 400);
          let job0 = job[Math.floor(Math.random() * job.length)];
          if (job0 == "Bạn bị Đức Bo địt và đéo nhận được đồng nào.") {
            return api.sendMessage("Bạn bị Đức Bo địt và đéo nhận được đồng nào.",threadID,messageID);
          } else
					api.sendMessage(getText('work', job0, amount), threadID, () => {
						Economy.addMoney(senderID, parseInt(amount));
						Economy.updateWorkTime(senderID, Date.now());
					}, messageID);
				}
			});
		}

		//roulette
		if (contentMessage.indexOf(`${prefix}roul`) == 0) {
			return Economy.getMoney(senderID).then(function (moneydb) {
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				if (!content) return api.sendMessage(getText('incorrectSyntax', prefix, 'roul'), threadID, messageID);
				var color = content.split(" ")[0];
				var money = content.split(" ")[1];
				if (isNaN(money) || money.indexOf("-") !== -1) return api.sendMessage(getText('isNaN'), threadID, messageID);
				if (!money || !color) return api.sendMessage(getText('incorrectSyntax', prefix, 'roul'), threadID, messageID);
				if (money > moneydb) return api.sendMessage(getText('notEnoughMoney'), threadID, messageID);
				if (money < 50) return api.sendMessage(getText('betToLow'), threadID, messageID);
				var check = (num) => (num == 0) ? '💙' : (num % 2 == 0 && num % 6 != 0 && num % 10 != 0) ? '♥️' : (num % 3 == 0 && num % 6 != 0) ? '💚' : (num % 5 == 0 && num % 10 != 0) ? '💛' : (num % 10 == 0) ? '💜' : '🖤️';
				let random = Math.floor(Math.random() * 50);

				if (color == "e" || color == "blue") color = 0;
				else if (color == "r" || color == "red") color = 1;
				else if (color == "g" || color == "green") color = 2;
				else if (color == "y" || color == "yellow") color = 3;
				else if (color == "v" || color == "violet") color = 4;
				else if (color == "b" || color == "black") color = 5;
				else return api.sendMessage(getText('incorrectSyntax', prefix, 'roul'), threadID, messageID);

				if (color == 0 && check(random) == '💙') api.sendMessage(getText('roulWon', '💙', '2', money * 2), threadID, () => Economy.addMoney(senderID, parseInt(money * 2)), messageID);
				else if (color == 1 && check(random) == '♥️') api.sendMessage(getText('roulWon', '♥️', '1.75', money * 1.75), threadID, () => Economy.addMoney(senderID, parseInt(money * 1.75)), messageID);
				else if (color == 2 && check(random) == '💚') api.sendMessage(getText('roulWon', '💚', '1.5', money * 1.5), threadID, () => Economy.addMoney(senderID, parseInt(money * 1.5)), messageID);
				else if (color == 3 && check(random) == '💛') api.sendMessage(getText('roulWon', '💛', '1.25', money * 1.25), threadID, () => Economy.addMoney(senderID, parseInt(money * 1.25)), messageID);
				else if (color == 4 && check(random) == '💜') api.sendMessage(getText('roulWon', '💜', '1', money * 1), threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID);
				else if (color == 5 && check(random) == '🖤️') api.sendMessage(getText('roulWon', '🖤️', '0.5', money * 0.5), threadID, () => Economy.addMoney(senderID, parseInt(money * 0.5)), messageID);
				else api.sendMessage(getText('roulLose', check(random)), threadID, () => Economy.subtractMoney(senderID, money), messageID)
			});
		}

		//slot
		if (contentMessage.indexOf(`${prefix}sl`) == 0) {
			const slotItems = ["🍇", "🍉", "🍊", "🍏", "7⃣", "🍓", "🍒", "🍌", "🥝", "🥑", "🌽"];
			return Economy.getMoney(senderID).then((moneydb) => {
				var money = contentMessage.slice(prefix.length + 3, contentMessage.length);
				if (!money) return api.sendMessage(getText('incorrectSyntax', prefix, 'sl'), threadID, messageID);
				let win = false;
				if (isNaN(money) || money.indexOf("-") !== -1) return api.sendMessage(getText('isNaN'), threadID, messageID);
				if (money > moneydb) return api.sendMessage(getText('notEnoughMoney'), threadID, messageID);
				if (money < 50) return api.sendMessage(getText('betToLow'), threadID, messageID);
				let number = [];
				for (i = 0; i < 3; i++) number[i] = Math.floor(Math.random() * slotItems.length);
				if (number[0] == number[1] && number[1] == number[2]) {
					money *= 9;
					win = true;
				}
				else if (number[0] == number[1] || number[0] == number[2] || number[1] == number[2]) {
					money *= 2;
					win = true;
				}
				(win) ? api.sendMessage(getText('slotWon', slotItems[number[0]], slotItems[number[1]], slotItems[number[2]], money), threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID) : api.sendMessage(getText('slotLose', slotItems[number[0]], slotItems[number[1]], slotItems[number[2]], money), threadID, () => Economy.subtractMoney(senderID, parseInt(money)), messageID);
			});
		}

		//pay
		if (contentMessage.indexOf(`${prefix}pay`) == 0) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			var moneyPay = content.substring(content.lastIndexOf(" ") + 1);
			Economy.getMoney(senderID).then((moneydb) => {
				if (!moneyPay) return api.sendMessage(getText('incorrectSyntax', prefix, 'pay'), threadID, messageID);
				if (isNaN(moneyPay) || moneyPay.indexOf("-") !== -1) return api.sendMessage(getText('isNaN'), threadID, messageID);
				if (moneyPay > moneydb) return api.sendMessage(getText('notEnoughMoney'), threadID, messageID);
				if (moneyPay < 50) return api.sendMessage(getText('payToLow'), threadID, messageID);
				return api.sendMessage({
					body: getText('pay', moneyPay, event.mentions[mention].replace("@", "")),
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => {
					Economy.addMoney(mention, parseInt(moneyPay));
					Economy.subtractMoney(senderID, parseInt(moneyPay));
				}, messageID);
			});
		}

		//setmoney
		if (contentMessage.indexOf(`${prefix}setmoney`) == 0 && admins.includes(senderID)) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var moneySet = content.substring(content.lastIndexOf(" ") + 1);
			if (isNaN(moneySet)) return api.sendMessage(getText('isNaN'), threadID, messageID);
			if (!mention && sender == 'me') return api.sendMessage(getText('setMeMoney', moneySet), threadID, () => Economy.setMoney(senderID, parseInt(moneySet)), messageID);
			return api.sendMessage({
				body: getText('setUserMoney', event.mentions[mention].replace("@", ""), moneySet),
				mentions: [{
					tag: event.mentions[mention].replace("@", ""),
					id: mention
				}]
			}, threadID, () => Economy.setMoney(mention, parseInt(moneySet)), messageID);
		}

		// steal
		if (contentMessage == `${prefix}steal`) {
			let cooldown = 1800000;
			Economy.getStealTime(senderID).then(async function (lastSteal) {
				if (lastSteal !== null && cooldown - (Date.now() - lastSteal) > 0) {
					let time = ms(cooldown - (Date.now() - lastSteal));
					api.sendMessage(getText('stealCooldown', time.minutes, time.seconds), threadID, messageID);
				}
				else {
					Economy.updateStealTime(senderID, Date.now());
					let all = await User.getUsers(['uid']);
					let victim = all[Math.floor(Math.random() * all.length)].uid;
					let nameVictim = await User.getName(victim);
					if (victim == api.getCurrentUserID() && senderID == victim) return api.sendMessage(getText('stealFailed1'), threadID, messageID);
					var route = Math.floor(Math.random() * 5);
					if (route > 1 || route == 0) {
						let moneydb = await Economy.getMoney(victim);
						var money = Math.floor(Math.random() * 200) + 1;
						if (moneydb <= 0 || moneydb == undefined) return api.sendMessage(getText('stealPoorUser'), threadID, messageID);
						else if (moneydb >= money) return api.sendMessage(getText('steal1', money), threadID, () => {
							Economy.subtractMoney(victim, money);
							Economy.addMoney(senderID, parseInt(money));
						}, messageID);
						else if (moneydb < money) return api.sendMessage(getText('steal2', moneydb), threadID, () => {
							Economy.subtractMoney(victim, parseInt(moneydb));
							Economy.addMoney(senderID, parseInt(moneydb));
						}, messageID);
					}
					else if (route == 1) {
						Economy.getMoney(senderID).then(moneydb => {
							if (moneydb <= 0) return api.sendMessage(getText('needMoney'), threadID, messageID);
							else if (moneydb > 0) return api.sendMessage(getText('stealFailed2', moneydb), threadID, () => api.sendMessage({ body: getText('congratHero', nameVictim, name, Math.floor(moneydb / 2)), mentions: [{ tag: nameVictim, id: victim }, { tag: name, id: senderID }] }, threadID, () => {
								Economy.subtractMoney(senderID, moneydb);
								Economy.addMoney(victim, parseInt(Math.floor(moneydb / 2)));
							}), messageID);
						});
					}
				}
			});
		}

		//fishing
		if (contentMessage.indexOf(`${prefix}fishing`) == 0) {
			let inventory = await Fishing.getInventory(senderID);
			let timeout = ['30000', '25000', '20000', '15000', '5000'];
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var rodLevel = inventory.rod - 1;
			if (!content) {
				if (inventory.rod == 0) return api.sendMessage(getText('noRod'), threadID, messageID);
				let lastTimeFishing = await Fishing.lastTimeFishing(senderID);
				if (new Date() - new Date(lastTimeFishing) <= timeout[rodLevel]) return api.sendMessage(getText('limitFishTime', timeout[rodLevel] / 1000), threadID, messageID);
				if (inventory.durability <= 0) return api.sendMessage(getText('brokenRod'), threadID);
				let stats = await Fishing.getStats(senderID);
				var roll = Math.floor(Math.random() * 1008);
				inventory.exp += Math.floor(Math.random() * 500);
				inventory.durability -= Math.floor(Math.random() * 9) + 1;
				stats.exp += Math.floor(Math.random() * 500);
				stats.casts += 1;
				if (Math.floor(Math.random() * 51) == 51) {
					let difficulty, answer, value1, value2;
					var difficulties = ['baby', 'easy', 'medium', 'hard', 'extreme'];
					difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
					var operations = ['+', '-', '*'];
					var maxValues = { baby: 10, easy: 50, medium: 100, hard: 500, extreme: 1000 };
					var operation = operations[Math.floor(Math.random() * operations.length)];
					value1 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
					value2 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
					switch (operation) {
						case '+':
							answer = value1 + value2;
							break;
						case '-':
							answer = value1 - value2;
							break;
						case '*':
							answer = value1 * value2;
							break;
					}
					await Fishing.updateLastTimeFishing(senderID, new Date());
					return api.sendMessage(getText('defeatMonster', difficulty, `${value1} ${operation} ${value2} = ?`), threadID, (err, info) => __GLOBAL.reply.push({ type: "fishing_domath", messageID: info.messageID, target: parseInt(threadID), author: senderID, answer }), messageID)
				}
				if (roll <= 400) {
					var arrayTrash = ["🏐", "💾", "📎", "💩", "🦴", "🥾", "🥾", "🌂"];
					inventory.trash += 1;
					stats.trash += 1;
					api.sendMessage(arrayTrash[Math.floor(Math.random() * arrayTrash.length)] + getText('caught', getText('trashes')), threadID, messageID);
				}
				else if (roll > 400 && roll <= 700) {
					inventory.fish1 += 1;
					stats.fish1 += 1;
					api.sendMessage('🐟 | ' + getText('caught', getText('fish1')), threadID, messageID);
				}
				else if (roll > 700 && roll <= 900) {
					inventory.fish2 += 1;
					stats.fish2 += 1;
					api.sendMessage('🐠 | ' + getText('caught', getText('fish2')), threadID, messageID);
				}
				else if (roll > 900 && roll <= 960) {
					inventory.crabs += 1;
					stats.crabs += 1;
					api.sendMessage('🦀 | ' + getText('caught', getText('crabs')), threadID, messageID);
				}
				else if (roll > 960 && roll <= 1001) {
					inventory.blowfishes += 1;
					stats.blowfishes += 1;
					api.sendMessage('🐡 | ' + getText('caught', getText('blowfishes')), threadID, messageID);
				}
				else if (roll == 1002) {
					inventory.crocodiles += 1;
					stats.crocodiles += 1;
					api.sendMessage('🐊 | ' + getText('caught', getText('crocodiles')), threadID, messageID);
				}
				else if (roll == 1003) {
					inventory.whales += 1;
					stats.whales += 1;
					api.sendMessage('🐋 | ' + getText('caught', getText('whales')), threadID, messageID);
				}
				else if (roll == 1004) {
					inventory.dolphins += 1;
					stats.dolphins += 1;
					api.sendMessage('🐬 | ' + getText('caught', getText('dolphins')), threadID, messageID);
				}
				else if (roll == 1006) {
					inventory.squids += 1;
					stats.squids += 1;
					api.sendMessage('🦑 | ' + getText('caught', getText('squids')), threadID, messageID);
				}
				else if (roll == 1007) {
					inventory.sharks += 1;
					stats.sharks += 1;
					api.sendMessage('🦈 | ' + getText('caught', getText('sharks')), threadID, messageID);
				}
				await Fishing.updateLastTimeFishing(senderID, new Date());
				await Fishing.updateInventory(senderID, inventory);
				await Fishing.updateStats(senderID, stats);
			}
			else if (content.indexOf('bag') == 0) {
				if (inventory.rod == 0) return api.sendMessage(getText('noRod'), threadID, messageID);
				let durability = ['50', '70', '100', '130', '200', '400'];
				let expToLevelup = ['1000','2000','4000','6000','8000'];
				var total = inventory.trashes + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfishes * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squids * 1000 + inventory.sharks * 1000;
				api.sendMessage(getText('inv1', inventory.rod, inventory.durability, durability[rodLevel], inventory.exp, expToLevelup[inventory.rod - 1]) + getText('inv2', inventory.trashes, inventory.fish1, inventory.fish2, inventory.crabs, inventory.blowfishes, inventory.crocodiles, inventory.whales, inventory.dolphins, inventory.squids, inventory.sharks) + getText('inv3', total), threadID, messageID);
			}
			else if (content.indexOf('sell') == 0) {
				var choose = content.split(' ')[1];
				if (!choose) return api.sendMessage(getText('noSellItem'), threadID, messageID);
				else if (choose == 'trash' || choose == '1') {
					var y = inventory.trasesh;
					inventory.trashes = 0;
					var money = parseInt(1 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('trashes'), money), threadID, messageID);
				}
				else if (choose == 'common' || choose == '2') {
					var y = inventory.fish1;
					inventory.fish1 = 0;
					var money = parseInt(30 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('fish1'), money), threadID, messageID);
				}
				else if (choose == 'rare' || choose == '3') {
					var y = inventory.fish2;
					inventory.fish2 = 0;
					var money = parseInt(100 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('fish2'), money), threadID, messageID);
				}
				else if (choose == 'crabs' || choose == '4') {
					var y = inventory.crabs;
					inventory.crabs = 0;
					var money = parseInt(250 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('crabs'), money), threadID, messageID);
				}
				else if (choose == 'blowfish' || choose == '8') {
					var y = inventory.blowfishes;
					inventory.blowfishes = 0;
					var money = parseInt(300 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('blowfishes'), money), threadID, messageID);
				}
				else if (choose == 'crocodiles' || choose == '5') {
					var y = inventory.crocodiles;
					inventory.crocodiles = 0;
					var money = parseInt(500 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('crocodiles'), money), threadID, messageID);
				}
				else if (choose == 'whales' || choose == '6') {
					var y = inventory.whales;
					inventory.whales = 0;
					var money = parseInt(750 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('whales'), money), threadID, messageID);
				}
				else if (choose == 'dolphins' || choose == '7') {
					var y = inventory.dolphins;
					inventory.dolphins = 0;
					var money = parseInt(750 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('dolphins'), money), threadID, messageID);
				}
				else if (choose == 'squid' || choose == '9') {
					var y = inventory.squids;
					inventory.squids = 0;
					var money = parseInt(1000 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('squids'), money), threadID, messageID);
				}
				else if (choose == 'sharks' || choose == '10') {
					var y = inventory.sharks;
					inventory.sharks = 0;
					var money = parseInt(1000 * y);
					api.sendMessage('🎣 | ' + getText('sellItem', y, getText('sharks'), money), threadID, messageID);
				}
				else if (choose == 'all') {
					var money = parseInt(inventory.trashes + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfishes * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squids * 1000 + inventory.sharks * 1000);
					return api.sendMessage('🎣 | ' + getText('sellAllItems', money), threadID, (err, info) => {
						if (err) throw err;
						__GLOBAL.confirm.push({
							type: "fishing_sellAll",
							messageID: info.messageID,
							target: parseInt(threadID),
							author: senderID
						});
					}, messageID);
				}
				await Fishing.updateInventory(senderID, inventory);
				await Economy.addMoney(senderID, money);
			}
			else if (content.indexOf("list") == 0) return api.sendMessage(getText('itemList'), threadID, messageID);
			else if (content.indexOf("steal") == 0) {
				let cooldown = 1800000;
				Fishing.getStealFishingTime(senderID).then(async function (lastStealFishing) {
					if (lastStealFishing !== null && cooldown - (Date.now() - lastStealFishing) > 0) {
						let time = ms(cooldown - (Date.now() - lastStealFishing));
						return api.sendMessage(getText('stealFishCooldown', time.minutes, time.seconds), threadID, messageID);
					}
					else {
						let all = await User.getUsers(['uid']);
						let victim = all[Math.floor(Math.random() * all.length)].uid;
						let inventoryStealer = await Fishing.getInventory(senderID);
						let inventoryVictim = await Fishing.getInventory(victim);
						let route = Math.floor(Math.random() * 3000);
						let swap = Math.floor(Math.random() * 51);
						if (victim == api.getCurrentUserID() || senderID == victim) return api.sendMessage(getText('stealFishFailed1'), threadID, messageID);
						else if (senderID != victim && victim != api.getCurrentUserID()) {
							if (swap >= 0 && swap <= 50) {
								if (route == 3000) {
									let shark = getText('sharks').replace(/\(e?s\)/, '');
									if (inventoryVictim.sharks == 0) return api.sendMessage(getText('intendSteal', shark), threadID, messageID);
									else {
										inventoryVictim.sharks -= 1;
										inventoryStealer.sharks += 1;
										api.sendMessage(getText('stealFish', shark), threadID, messageID);
									}
								}
								else if (route == 2999) {
									let squid = getText('squids').replace(/\(e?s\)/, '');
									if (inventoryVictim.squid == 0) return api.sendMessage(getText('intendSteal', squid), threadID, messageID);
									else {
										inventoryVictim.squid -= 1;
										inventoryStealer.squid += 1;
										api.sendMessage(getText('stealFish', squid), threadID, messageID);
									}
								}
								else if (route == 2998) {
									let dolphin = getText('dolphins').replace(/\(e?s\)/, '');
									if (inventoryVictim.dolphins == 0) return api.sendMessage(getText('intendSteal', dolphin), threadID, messageID);
									else {
										inventoryVictim.dolphins -= 1;
										inventoryStealer.dolphins += 1;
										api.sendMessage(getText('stealFish', dolphin), threadID, messageID);
									}
								}
								else if (route == 2997) {
									let whale = getText('whales').replace(/\(e?s\)/, '');
									if (inventoryVictim.whales == 0) return api.sendMessage(getText('intendSteal', whale), threadID, messageID);
									else {
										inventoryVictim.whales -= 1;
										inventoryStealer.whales += 1;
										api.sendMessage(getText('stealFish', whale), threadID, messageID);
									}
								}
								else if (route == 2996) {
									let crocodile = getText('crocodiles').replace(/\(e?s\)/, '');
									if (inventoryVictim.crocodiles == 0) return api.sendMessage(getText('intendSteal', crocodile), threadID, messageID);
									else {
										inventoryVictim.crocodiles -= 1;
										inventoryStealer.crocodiles += 1;
										api.sendMessage(getText('stealFish', crocodile), threadID, messageID);
									}
								}
								else if (route == 2995) {
									let blowfish = getText('blowfishes').replace(/\(e?s\)/, '');
									if (inventoryVictim.blowfish == 0) return api.sendMessage(getText('intendSteal', blowfish), threadID, messageID);
									else {
										inventoryVictim.blowfish -= 1;
										inventoryStealer.blowfish += 1;
										api.sendMessage(getText('stealFish', blowfish), threadID, messageID);
									}
								}
								else if (route == 2994) {
									let crab = getText('crabs').replace(/\(e?s\)/, '');
									if (inventoryVictim.crabs == 0) return api.sendMessage(getText('intendSteal', crab), threadID, messageID);
									else {
										inventoryVictim.crabs -= 1;
										inventoryStealer.crabs += 1;
										api.sendMessage(getText('stealFish', crab), threadID, messageID);
									}
								}
								else if (route >= 2000 && route < 2994) {
									let fish2 = getText('fish2').replace(/\(e?s\)/, '');
									if (inventoryVictim.fish2 == 0) return api.sendMessage(getText('intendSteal', fish2), threadID, messageID);
									else {
										inventoryVictim.fish2 -= 1;
										inventoryStealer.fish2 += 1;
										api.sendMessage(getText('stealFish', fish2), threadID, messageID);
									}
								}
								else if (route >= 1000 && route < 2000) {
									let fish1 = getText('fish1').replace(/\(e?s\)/, '');
									if (inventoryVictim.fish1 == 0) return api.sendMessage(getText('intendSteal', fish1), threadID, messageID);
									else {
										inventoryVictim.fish1 -= 1;
										inventoryStealer.fish1 += 1;
										api.sendMessage(getText('stealFish', fish1), threadID, messageID);
									}
								}
								else if (route >= 0 && route < 1000) {
									let trash = getText('trashes').replace(/\(e?s\)/, '');
									if (inventoryVictim.trash == 0) return api.sendMessage(getText('intendSteal', trash + ' (?)'), threadID, messageID);
									else {
										inventoryVictim.trash -= 1;
										inventoryStealer.trash += 1;
										api.sendMessage(getText('stealFish', getText('trashes')), threadID, messageID);
									}
								}
								await Fishing.updateInventory(victim, inventoryVictim);
								await Fishing.updateInventory(senderID, inventoryStealer);
							}
							else if (swap > 50) {
								inventoryStealer.trash = 0;
								inventoryStealer.fish1 = 0;
								inventoryStealer.fish2 = 0;
								inventoryStealer.crabs = 0;
								inventoryStealer.crocodiles = 0;
								inventoryStealer.whales = 0;
								inventoryStealer.dolphins = 0;
								inventoryStealer.blowfish = 0;
								inventoryStealer.squid = 0;
								inventoryStealer.sharks = 0;
								api.sendMessage(getText('stealFishFailed2'), threadID, messageID);
								await Fishing.updateInventory(senderID, inventoryStealer);
							}
						}
					}
					await Fishing.updateStealFishingTime(senderID, Date.now());
				});
			}
			else if (content.indexOf('shop') == 0) return api.sendMessage(getText('fishingShop'), threadID, (err, info) => __GLOBAL.reply.push({ type: "fishing_shop", messageID: info.messageID, target: parseInt(threadID), author: senderID }));
		}


		/* ==================== System Check ==================== */

		//Check if command is correct
		if (contentMessage.indexOf(prefix) == 0) {
			var checkCmd, findSpace = contentMessage.indexOf(' ');
			if (findSpace == -1) {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, contentMessage.length), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, contentMessage.length)) return;
			}
			else {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, findSpace), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, findSpace)) return;
			}
			if (checkCmd.bestMatch.rating >= 0.3) return api.sendMessage(getText('cmdNotFound', `${prefix + checkCmd.bestMatch.target}`), threadID, messageID);
		}

		//Level up notification
		if (contentMessage && !__GLOBAL.blockLevelUp.includes(threadID)) {
			let point = await Rank.getPoint(senderID);
			var curLevel = Math.floor((Math.sqrt(1 + (4 * point) / 3) + 1) / 2);
			var level = Math.floor((Math.sqrt(1 + (4 * (point + 1)) / 3) + 1) / 2);
			/*if (level > curLevel) {
				let name = await User.getName(senderID);
				return api.sendMessage({
					body: name + getText('keyboardHero', level),
					attachment: fs.createReadStream(__dirname + "/src/levelup.GIF"),
					mentions: [{
						tag: name,
						id: senderID,
					}],
				}, threadID)
			}*/
		}
	}
}
/* This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord) with love <3, pls dont delete this credits! THANKS */
