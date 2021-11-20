module.exports = function ({
  api,
  config,
  __GLOBAL,
  User,
  Thread
}) {
  function getText(...args) {
    const langText = __GLOBAL.language.event;
    const getKey = args[0];
    if (!langText.hasOwnProperty(getKey)) throw `${__filename} - Not found key language: ${getKey}`;
    let text = langText[getKey];
    for (let i = args.length; i > 0; i--) {
      let regEx = RegExp(`%${i}`, 'g');
      text = text.replace(regEx, args[i]);
    }
    return text;
  }

  return async function ({
    event
  }) {
  	const fs = require('fs-extra');
    let threadInfo = await api.getThreadInfo(event.threadID);
    let threadName = threadInfo.threadName;
    switch (event.logMessageType) {
      case "log:subscribe":
        let setPre = JSON.parse(fs.readFileSync(__dirname + '/src/prefix.json'));
        var mentions = [],
          nameArray = [],
          memLength = [];
        for (var i = 0; i < event.logMessageData.addedParticipants.length; i++) {
          let id = event.logMessageData.addedParticipants[i].userFbId;
          if (id == api.getCurrentUserID()) {
            await Thread.createThread(event.threadID);
            api.changeNickname(`[ ${(event.threadID in setPre) ? setPre[event.threadID] : config.prefix} ] ` + config.botName, event.threadID, api.getCurrentUserID());
            api.sendMessage(getText('connectSuccess', (event.threadID in setPre) ? setPre[event.threadID] : config.prefix), event.threadID);
          } else {
            let userName = event.logMessageData.addedParticipants[i].fullName;
            await User.createUser(id);
            nameArray.push(userName);
            mentions.push({
              tag: userName,
              id
            });
            memLength.push(threadInfo.participantIDs.length - i);
          }
        }
        if (memLength.length != 0 || nameArray.length != 0) {
          memLength.sort((a, b) => a - b);
          var body = getText('welcome', nameArray.join(', '), threadName, memLength.join(', '));
          api.sendMessage({
            body,
            mentions
          }, event.threadID);
        }
        break;
      case "log:unsubscribe":
        if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;
        if (event.author == event.logMessageData.leftParticipantFbId) {
          let db = fs.readFileSync(__dirname + '/src/antiout.json');
          db = JSON.parse(db);
          if (db.includes(parseInt(event.threadID))) {
          	let { threadID } = event;
            let userInfo = await User.getInfo(event.logMessageData.leftParticipantFbId);
            let name = userInfo.name;
            let getGender = userInfo.gender;
            var gender = (getGender == 2) ? "Anh" : "Chị";
            api.addUserToGroup(event.logMessageData.leftParticipantFbId, threadID, (error, info) => {
              if (error) {
                api.sendMessage(`Không thể thêm lại thành viên ${name} vào nhóm ! `, threadID)
              } else api.sendMessage(`[ANTIOUT]\n${gender} ${name} đã cố gắng trốn khỏi nhóm nhưng không thành! `, threadID);
            });
          }
          else api.sendMessage(getText('left', event.logMessageBody.split(' đã rời khỏi nhóm.' || ' left the group.')[0]), event.threadID)
        }
        else api.sendMessage(getText('kicked', (/đã xóa (.*?) khỏi nhóm/ || /removed (.*?) from the group./).exec(event.logMessageBody)[1]), event.threadID);
        break;
      case "log:thread-icon":
        break;
      case "log:user-nickname":
        break;
      case "log:thread-color":
        break;
      case "log:thread-name":
        await Thread.updateName(event.threadID, threadName);
        break;
    }
  }
}
