module.exports = function ({ sequelize, Sequelize }) {
	let Thread = sequelize.define('thread', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: Sequelize.STRING
		},
		threadID: {
			type: Sequelize.BIGINT,
			unique: true
		},
		block: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		blockNSFW: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		blockResend: {
			type: Sequelize.BOOLEAN,
			defaultValue: true
		},
		blocklevelup: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		}
	});
	return Thread;
}