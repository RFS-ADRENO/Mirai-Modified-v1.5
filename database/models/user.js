module.exports = function ({ sequelize, Sequelize }) {
	let User = sequelize.define('user', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: Sequelize.STRING
		},
		uid: {
			type: Sequelize.BIGINT,
			unique: true
		},
		block: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		point: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		money: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		afk: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		reasonafk: {
			type: Sequelize.STRING
		},
		dailytime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		worktime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		stealtime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		nsfwTier: {
			type: Sequelize.INTEGER,
			defaultValue: 0
		},
		pornLeft: {
			type: Sequelize.INTEGER,
			defaultValue: 1
		},
		hentaiLeft: {
			type: Sequelize.INTEGER,
			defaultValue: 2
		},
		lastTimeFishing: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		stealfishtime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		inventory: {
			type: Sequelize.JSON
		},
		stats: {
			type: Sequelize.JSON
		}
	});
	return User;
}