module.exports = function ({ api, __GLOBAL, Economy, Fishing }) {
	function getText(...args) {
		const langText = __GLOBAL.language.reaction;
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey];
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

	return async function ({ event }) {
		const { confirm } = __GLOBAL;
		if (__GLOBAL.threadBlocked.indexOf(event.threadID) != -1) return;
		const { userID, threadID, reaction, messageID } = event;
		if (confirm.length != 0) {
			const indexOfConfirm = confirm.findIndex(e => e.messageID == messageID && e.author == userID);
			if (indexOfConfirm < 0) return;
			const confirmMessage = confirm[indexOfConfirm];
			switch (confirmMessage.type) {
				case 'fishing_sellAll': {
					if (reaction == '👍') {
						let inventory = await Fishing.getInventory(confirmMessage.author);
						var money = parseInt(inventory.trashes + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfishes * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squids * 1000 + inventory.sharks * 1000);
						inventory.trashes = 0;
						inventory.fish1 = 0;
						inventory.fish2 = 0;
						inventory.crabs = 0;
						inventory.crocodiles = 0;
						inventory.whales = 0;
						inventory.dolphins = 0;
						inventory.blowfishes = 0;
						inventory.squids = 0;
						inventory.sharks = 0;
						api.sendMessage('🎣 | ' + getText('soldAll', money), threadID, messageID);
						await Fishing.updateInventory(confirmMessage.author, inventory);
						await Economy.addMoney(confirmMessage.author, money);
					}
					else api.sendMessage('🎣 | ' + getText('canceledSP'), threadID, messageID)
					break;
				}
				case "fishing_upgradeRod": {
					if (reaction !== '👍') return api.sendMessage('🎣 | ' + getText('canceledUpgrade'), threadID);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					if (moneydb - confirmMessage.money <= 0) return api.sendMessage('🎣 | ' + getText('notEnoughMoney', confirmMessage.money - moneydb), threadID);
					if (inventory.exp - confirmMessage.exp <= 0) return api.sendMessage('🎣 | ' + getText('notEnoughExp', confirmMessage.exp - inventory.exp), threadID);
					if (inventory.rod <= 0) return api.sendMessage('🎣 | ' + getText('dontHaveRodToUpgrade'), threadID);
					if (inventory.rod == 5) return api.sendMessage('🎣 | ' + getText('alreadyMax'), threadID);
					inventory.rod += 1;
					inventory.exp -= confirmMessage.exp;
					inventory.durability = confirmMessage.durability;
					api.sendMessage('🎣 | ' + getText('upgradeSuccess'), threadID);
					await Economy.subtractMoney(confirmMessage.author, confirmMessage.money);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
				case "fishing_fixRod": {
					if (reaction !== '👍') return api.sendMessage('🎣 | ' + getText('canceledRepair'), threadID);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					if (moneydb - confirmMessage.moneyToFix <= 0) return api.sendMessage('🎣 | ' + getText('notEnoughMoney', confirmMessage.moneyToFix - moneydb), threadID);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					inventory.durability = confirmMessage.durability;
					api.sendMessage('🎣 | ' + getText('repairSuccess'), threadID);
					await Economy.subtractMoney(confirmMessage.author, confirmMessage.moneyToFix);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
				case "fishing_buyRod": {
					if (reaction !== '👍') return api.sendMessage('🎣 | ' + getText('canceledSP'), threadID);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					if (inventory.rod >= 1) return api.sendMessage('🎣 | ' + getText('alreadyHave'), threadID);
					if (moneydb - 1000 < 0) return api.sendMessage('🎣 | ' + getText('notEnoughMoney', 1000 - moneydb), threadID);
					inventory.durability = 50;
					inventory.rod = 1;
					api.sendMessage('🎣 | ' + getText('buyFirstRod'), threadID);
					await Economy.subtractMoney(confirmMessage.author, 1000);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
			}
			__GLOBAL.confirm.splice(indexOfConfirm, 1);
			return;
		}
	}
}