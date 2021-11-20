module.exports = function({ error }, getText) {
	if (!error.error) return error.toString();
	switch (error.error) {
		case "login-approval":
			return getText('err2FA');
		case "Wrong username/password.":
			return getText('wrongAorP');
		default:
			return getText('cantLogin');
	}
}