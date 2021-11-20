const logger = require("../modules/log.js");
module.exports = function ({ models }) {
	const Economy = models.use("user");

	/* ==================== Daily ==================== */

	async function getDailyTime(uid) {
		return (await Economy.findOne({ where: { uid } })).get({ plain: true }).dailytime;
	}

	async function updateDailyTime(uid, dailytime) {
		try {
			(await Economy.findOne({ where: { uid } })).update({ dailytime });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* ==================== Work ==================== */

	async function getWorkTime(uid) {
		return (await Economy.findOne({ where: { uid } })).get({ plain: true }).worktime;
	}

	async function updateWorkTime(uid, worktime) {
		try {
			(await Economy.findOne({ where: { uid } })).update({ worktime });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* ==================== Money ==================== */

	async function getMoney(uid) {
		return (await Economy.findOne({ where: { uid } })).get({ plain: true }).money;
	}

	async function addMoney(uid, moneyIncrement) {
		try {
			let money = (await getMoney(uid)) + moneyIncrement;
			(await Economy.findOne({ where: { uid } })).update({ money });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function subtractMoney(uid, moneyDecrement) {
		try {
			let money = (await getMoney(uid)) - moneyDecrement;
			(await Economy.findOne({ where: { uid } })).update({ money });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function setMoney(uid, money) {
		try {
			(await Economy.findOne({ where: { uid } })).update({ money });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* =================== Steal ==================== */

	async function getStealTime(uid) {
		return (await Economy.findOne({ where: { uid } })).get({ plain: true }).stealtime;
	}

	async function updateStealTime(uid, stealtime) {
		try {
			(await Economy.findOne({ where: { uid } })).update({ stealtime });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		getDailyTime,
		updateDailyTime,
		getWorkTime,
		updateWorkTime,
		getMoney,
		addMoney,
		subtractMoney,
		setMoney,
		getStealTime,
		updateStealTime
	};
};
