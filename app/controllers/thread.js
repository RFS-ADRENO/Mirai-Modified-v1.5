const logger = require("../modules/log.js");
module.exports = function ({ models, api, __GLOBAL }) {
	const Thread = models.use('thread');

	function getText(...args) {
		const langText = __GLOBAL.language.thread;
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey].replace(/\\n/gi, '\n');
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

	async function createThread(threadID) {
		if (!await Thread.findOne({ where: { threadID } })) {
			let threadInfo = await getInfo(threadID);
			let name = threadInfo.name;
			let [thread, created] = await Thread.findOrCreate({ where: { threadID }, defaults: { name } });
			if (created) return logger(threadID, getText('newThread'));
		}
		else return;
	}

	async function getInfo(threadID) {
		return await api.getThreadInfo(threadID);
	}

	async function setThread(threadID, options = {}) {
		try {
			(await Thread.findOne({ where: { threadID } })).update(options);
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function delThread(threadID) {
		return (await Thread.findOne({ where: { threadID } })).destroy();
	}

	async function getThreads(...data) {
		var where, attributes;
		for (let i of data) {
			if (typeof i != 'object') throw getText('needAorO');
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await Thread.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		}
		catch (err) {
			logger(err, 2);
			return [];
		}
	}

	async function getName(threadID) {
		return (await Thread.findOne({ where: { threadID } })).get({ plain: true }).name;
	}

	async function updateName(threadID, name) {
		return (await Thread.findOne({ where: { threadID } })).update({ name });
	}

	async function unban(threadID, block = false) {
		try {
			await createThread(threadID);
			(await Thread.findOne({ where: { threadID } })).update({ block });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function ban(threadID) {
		return await unban(threadID, true);
	}

	async function blockLevelUp(threadID, blocklevelup = true) {
		try {
			await createThread(threadID);
			(await Thread.findOne({ where: { threadID } })).update({ blocklevelup });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function unblockLevelUp(threadID) {
		return await blockLevelUp(threadID, false);
	}

	async function blockResend(threadID, blockResend = true) {
		try {
			(await Thread.findOne({ where: { threadID } })).update({ blockResend });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function unblockResend(threadID) {
		return await blockResend(threadID, false);
	}

	async function blockNSFW(threadID, blockNSFW = true) {
		try {
			(await Thread.findOne({ where: { threadID } })).update({ blockNSFW });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function unblockNSFW(threadID) {
		return await blockNSFW(threadID, false);
	}

	return {
		createThread,
		getInfo,
		setThread,
		delThread,
		getName,
		getThreads,
		updateName,
		ban,
		unban,
		blockLevelUp,
		unblockLevelUp,
		blockResend,
		unblockResend,
		blockNSFW,
		unblockNSFW
	}
}
