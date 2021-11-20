const Sequelize = require("sequelize");
const { database } = require("../config/index.js");
let getConfig = JSON.parse(require("fs").readFileSync(__dirname + '/../config.json'));
const dialect = 'sqlite';
module.exports = {
	sequelize: new Sequelize({
		dialect,
		...database[dialect],
		pool: {
			max: 10,
			min: 0,
			acquire: 30000,
			idle: 10000
		},
		retry: {
			match: [
				/SQLITE_BUSY/,
			],
			name: 'query',
			max: 10
		},
		logging: getConfig.NODE_ENV == 'development' ? console.log : false,
		transactionType: 'IMMEDIATE',
		define: {
			underscored: false,
			freezeTableName: true,
			charset: 'utf8',
			dialectOptions: {
				collate: 'utf8_general_ci'
			},
			timestamps: true
		},
		sync: {
			force: getConfig.NODE_ENV == 'build'
		},
	}),
	Sequelize,
	Op: Sequelize.Op
}
