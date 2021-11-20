const logger = require("../modules/log.js");
module.exports = function ({ models }) {
	const Fishing = models.use("user");

	/* ==================== Last Time Fishing ==================== */

	async function lastTimeFishing(uid) {
		return (await Fishing.findOne({ where: { uid } })).get({ plain: true }).lastTimeFishing;
	}

	async function updateLastTimeFishing(uid, lastTimeFishing) {
		try {
			(await Fishing.findOne({ where: { uid } })).update({ lastTimeFishing });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* ==================== Inventory ==================== */

	async function getInventory(uid) {
		return (await Fishing.findOne({ where: { uid } })).get({ plain: true }).inventory;
	}

	async function updateInventory(uid, inventory) {
		try {
			(await Fishing.findOne({ where: { uid } })).update({ inventory });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* ==================== Stats ==================== */

	async function getStats(uid) {
		return (await Fishing.findOne({ where: { uid } })).get({ plain: true }).stats;
	}

	async function updateStats(uid, stats) {
		try {
			(await Fishing.findOne({ where: { uid } })).update({ stats });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	/* =================== Steal fishing ==================== */

	async function getStealFishingTime(uid) {
		return (await Fishing.findOne({ where: { uid } })).get({ plain: true }).stealfishtime;
	}

	async function updateStealFishingTime(uid, stealfishtime) {
		try {
			(await Fishing.findOne({ where: { uid } })).update({ stealfishtime });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		lastTimeFishing,
		updateLastTimeFishing,
		getInventory,
		updateInventory,
		getStats,
		updateStats,
		getStealFishingTime,
		updateStealFishingTime
	};
};