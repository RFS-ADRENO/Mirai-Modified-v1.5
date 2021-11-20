const login = require("fca-unofficial");
module.exports = (op, getText) => new Promise(function(resolve, reject) {
	login(op, (err, api) => {
		if (err) return reject(require("./error")({ error: err }, getText));
		require("./option")({ api })
		resolve(api)
	})
})