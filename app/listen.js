const logger = require("./modules/log.js");
const config = require("../config/index.js");
module.exports = function ({ api, models, __GLOBAL }) {
	function getText(...args) {
		const langText = __GLOBAL.language.listen;
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey];
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

	const User = require("./controllers/user")({ models, api, __GLOBAL });
	const Thread = require("./controllers/thread")({ models, api, __GLOBAL });
	const Rank = require("./controllers/rank")({ models, api });
	const Economy = require("./controllers/economy")({ models, api });
	const Fishing = require("./controllers/fishing")({ models, api });
	const Nsfw = require("./controllers/nsfw")({ models, Economy, __GLOBAL });
	const Image = require("./modules/image");

	(async () => {
		logger(getText('startEnv'));
		__GLOBAL.userBlocked = (await User.getUsers({ block: true })).map(e => e.uid);
		__GLOBAL.afkUser = (await User.getUsers({ afk: true })).map(e => e.uid);
		__GLOBAL.blockLevelUp = (await Thread.getThreads({ blocklevelup: true })).map(e => e.threadID);
		__GLOBAL.threadBlocked = (await Thread.getThreads({ block: true })).map(e => e.threadID);
		__GLOBAL.resendBlocked = (await Thread.getThreads({ blockResend: true })).map(e => e.threadID);
		__GLOBAL.NSFWBlocked = (await Thread.getThreads({ blockNSFW: true })).map(e => e.threadID);
		logger(getText('successEnv'));
	})();

	const handleMessage = require("./handle/message")({ api, config, __GLOBAL, User, Thread, Rank, Economy, Fishing, Nsfw, Image });
	const handleEvent = require("./handle/event")({ api, config, __GLOBAL, User, Thread });
	const handleReply = require("./handle/message_reply")({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw });
	const handleReaction = require("./handle/message_reaction")({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw });
	const handleUnsend = require("./handle/unsend")({ api, __GLOBAL, User });
	const handleCustom = require("./handle/custom_message")({ api, config, __GLOBAL, User, Thread, Rank, Economy, Fishing, Nsfw, Image });


	logger(`${api.getCurrentUserID()} - ${config.botName}`, "[ UID ]");
	logger(config.prefix || "[none]", "[ PREFIX ]");
	logger(getText('startListen'));

	return function (error, event) {
		if (error) return logger(error, 2);
			switch (event.type) {
				case "message":
				case "message_reply":
					handleMessage({ event });
					handleReply({ event });
					handleCustom({ event });
					break;
				case "message_unsend":
					handleUnsend({ event });
					break;
				case "event":
					handleEvent({ event });
					break;
				case "message_reaction":
					handleReaction({ event });
					break;
				default:
					return;
			}
	};
};
