module.exports = function ({ api, __GLOBAL, User }) {
	function getText(...args) {
		const langText = __GLOBAL.language.unsend;
		const getKey = args[0];
		if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
		let text = langText[getKey];
		for (let i = args.length; i > 0; i--) {
			let regEx = RegExp(`%${i}`, 'g');
			text = text.replace(regEx, args[i]);
		}
		return text;
	}

  const fs = require("fs");
  const axios = require("axios");

	return async function ({ event }) {
		if (__GLOBAL.resendBlocked.includes(parseInt(event.threadID))) return;
    let {messageID, senderID, threadID, body } = event;
    if(event.type == "message_unsend") {
      if(!__GLOBAL.message.some(item => item.msgID == messageID)) return;
      var getMsg = __GLOBAL.message.find(item => item.msgID == messageID);
      let name = await User.getName(senderID);
      if (!getMsg) return api.sendMessage(name + ' vừa gỡ 1 tin nhắn nào đó!',threadID);
      if(getMsg.attachment[0]) {
        console.log(getMsg.attachment);
        let msg = `Con lợn ${name} vừa gỡ ${getMsg.attachment.length} tệp đính kèm:\n`
        var atm = [];
        for (var i = 0; i < getMsg.attachment.length; i++) {
          let ext = getMsg.attachment[i].type;
          if (ext == "photo") {ext = "jpg"} else {if (ext == "video") {ext = "mp4"} else {if (ext == "audio") {ext = "mp3"}else ext = "gif"}}; 
          fs.writeFileSync(__dirname + `/media/${i}.${ext}`, Buffer.from(((await axios.get(getMsg.attachment[i].url, { responseType: 'arraybuffer' })).data), 'utf-8'));
          var att = __dirname + `/media/${i}.${ext}`;
          atm.push(fs.createReadStream(att));
        }
        if (getMsg.msg != "") msg += getMsg.msg;
        return api.sendMessage({body: msg,attachment: atm},threadID);
      } else if(getMsg.msg != "") return api.sendMessage(`Con lợn ${name} vừa gỡ một tin nhắn với nội dung:\n ${getMsg.msg}`,threadID);
      }
  }
}
