const logger = require("../modules/log.js");
module.exports = function ({ models, api, __GLOBAL }) {
	const User = models.use('user');

	function getText(...args) {
		const langText = __GLOBAL.language.user;
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey].replace(/\\n/gi, '\n');
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

	async function createUser(uid) {
		if (!await User.findOne({ where: { uid } })) {
			let name = (await getInfo(uid)).name;
			var inventory = { "fish1": 0, "fish2": 0, "trashes": 0, "crabs": 0, "crocodiles": 0, "whales": 0, "dolphins": 0, "blowfishes": 0, "squids": 0, "sharks": 0, "exp": 0, "rod": 0, "durability": 0 };
			var stats = { "casts": 0, ...inventory };
			var [user, created] = await User.findOrCreate({ where: { uid }, defaults: { name, inventory, stats, reasonafk: '' } });
			if (created) {
				logger(`${name} - ${uid}`, getText('newUser'));
				return true;
			}
			else return false;
		}
		else return;
	}

	async function getInfo(id) {
		return (await api.getUserInfo(id))[id];
	}

	async function setUser(uid, options = {}) {
		try {
			(await User.findOne({ where: { uid } })).update(options);
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function delUser(uid) {
		return (await User.findOne({ where: { uid } })).destroy();
	}

	async function getUsers(...data) {
		var where, attributes;
		for (let i of data) {
			if (typeof i != 'object') throw getText('needAorO');
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await User.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		}
		catch (err) {
			logger(err, 2);
			return [];
		}
	}

	async function getName(uid) {
		return (await User.findOne({ where: { uid } })).get({ plain: true }).name;
	}

	async function getGender(uid) {
		return (await getInfo(uid)).gender;
	}

	async function unban(uid, block = false) {
		try {
			await createUser(uid);
			(await User.findOne({ where: { uid } })).update({ block });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function ban(uid) {
		return await unban(uid, true);
	}

	async function nonafk(uid, afk = false) {
		try {
			(await User.findOne({ where: { uid } })).update({ afk });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function afk(uid) {
		return await nonafk(uid, true);
	}

	async function getReason(uid) {
		return (await User.findOne({ where: { uid } })).get({ plain: true }).reasonafk;
	}

	async function updateReason(uid, reasonafk) {
		try {
			(await User.findOne({ where: { uid } })).update({ reasonafk });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		createUser,
		getInfo,
		setUser,
		delUser,
		getUsers,
		getName,
		getGender,
		unban,
		ban,
		afk,
		nonafk,
		getReason,
		updateReason
	}
}