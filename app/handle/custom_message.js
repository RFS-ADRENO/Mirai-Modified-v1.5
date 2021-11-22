module.exports = function({
    api,
    config,
    __GLOBAL,
    User,
    Thread,
    Rank,
    Economy,
    Fishing,
    Nsfw,
    Image
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


    const FormData = require('form-data');
    const fs = require('fs');
    const path = require('path');
    const eval = require("eval");
    const axios = require('axios');
    const imgbbUploader = require("imgbb-uploader");

    const request = require('request');

    return async function({
        event
    }) {
        let {
            threadID,
            messageID,
            senderID,
            body
        } = event;
        const admins = config.admins;

        senderID = parseInt(senderID);
        threadID = parseInt(threadID);
        if (__GLOBAL.userBlocked.includes(senderID) && !admins.includes(senderID) || __GLOBAL.threadBlocked.includes(threadID) && !admins.includes(senderID)) return;

        //checkPrefix
        let prefixFile = JSON.parse(fs.readFileSync(__dirname + '/src/prefix.json'));
        config.threadPrefix = prefixFile;
        const pf = (threadID in config.threadPrefix) ? config.threadPrefix[threadID] : config.prefix;

        //setPrefix
        if (body.indexOf(`${pf}setPrefix`) == 0) {
            let threadInfo = await api.getThreadInfo(threadID);
            let find = threadInfo.adminIDs.find(el => el.id == senderID);
            if (!find) return api.sendMessage("Bạn không phải quản trị viên", threadID);
            let bodyPrefix = body.split(" ")[1];
            if (!bodyPrefix) return api.sendMessage("Thiếu input!", threadID, messageID);
            prefixFile[threadID] = bodyPrefix;
            fs.writeFileSync(__dirname + '/src/prefix.json', JSON.stringify(prefixFile, null, 4));
            return api.sendMessage(`Prefix mới của bot ở nhóm này là: ${config.threadPrefix[threadID]}`, threadID, () => {
                api.changeNickname(`[ ${config.threadPrefix[threadID]} ] ${config.botName}`, threadID, api.getCurrentUserID());
            });
        }

        //Do code here
        if (!fs.existsSync(__dirname + '/src/antiout.json')) fs.writeFileSync(__dirname + '/src/antiout.json', JSON.stringify([]));
        if (body.indexOf(`${pf}antiout`) == 0) {
            let threadInfo = await api.getThreadInfo(threadID);
            let find = threadInfo.adminIDs.find(el => el.id == senderID);
            if (!find) return api.sendMessage("Bạn không phải quản trị viên", threadID);
            let antiout = fs.readFileSync(__dirname + '/src/antiout.json');
            antiout = JSON.parse(antiout);
            if (body.slice(9) == "on") {
                if (antiout.includes(parseInt(threadID))) return api.sendMessage("Đã bật antiout từ trước", threadID);
                antiout.push(parseInt(threadID));
                api.sendMessage("Đã bật antiout!", threadID);
            } else if (body.slice(9) == "off") {
                if (!antiout.includes(parseInt(threadID))) return api.sendMessage("Đã tắt antiout từ trước", threadID);
                antiout.splice(antiout.indexOf(parseInt(threadID)), 1);
                api.sendMessage("Đã tắt antiout!", threadID);
            } else {
                if (antiout.includes(parseInt(threadID))) {
                    antiout.splice(antiout.indexOf(parseInt(threadID)), 1);
                    api.sendMessage("Đã tắt antiout!", threadID);
                } else {
                    antiout.push(parseInt(threadID));
                    api.sendMessage("Đã bật antiout!", threadID);
                }
            }
            return fs.writeFileSync(__dirname + '/src/antiout.json', JSON.stringify(antiout));
        }

        if (!fs.existsSync(__dirname + '/src/checktt.json')) fs.writeFileSync(__dirname + '/src/checktt.json', JSON.stringify({}));
        const checkttdata = JSON.parse(fs.readFileSync(__dirname + '/src/checktt.json'));
        if (!checkttdata[threadID]) checkttdata[threadID] = {};
        if (!checkttdata[threadID][senderID]) checkttdata[threadID][senderID] = 0;
        checkttdata[threadID][senderID] += 1;
        fs.writeFileSync(__dirname + '/src/checktt.json', JSON.stringify(checkttdata));

        // if (body.indexOf(`${pf}gang`) == 0) {
        //     let content = body.split(' ');
        //     var storage = [];
        //     var rankdata = JSON.parse(fs.readFileSync(__dirname + '/src/checktt.json'));
        //     for (i of Object.keys(rankdata)) {
        //         let total = 0;
        //         for (e of Object.keys(rankdata[i])) {
        //             total += rankdata[i][e];
        //         }
        //         storage.push({
        //             id: i,
        //             score: total
        //         });
        //         storage.sort((a, b) => {
        //             if (a.score > b.score) return -1;
        //             if (a.score < b.score) return 1;
        //             if (a.id > b.id) return 1;
        //             if (a.id < b.id) return -1;
        //         });
        //     }
        //     if (!content[1]) {
        //         let msg = '=======GANG=======';
        //         let gangInfo = await api.getThreadInfo(threadID);
        //         let name = '\nName: ' + gangInfo.name;
        //         let mem = '\nMembers: ' + gangInfo.participantIDs.length;
        //         const rank = storage.findIndex(info => parseInt(info.id) == parseInt(threadID)) + 1;
        //         const gangdata = storage[rank - 1];
        //         msg += name + mem + '\nScore: ' + gangdata.score + '\nRank: ' + rank;
        //         api.sendMessage(msg, threadID);
        //     } else if (content[1] == 'all') {
        //         let msg = '=======GANGS=======\n',
        //             number = 0;
        //         await api.getThreadList(100, null, ["INBOX"], (err, list) => {
        //             list.forEach(async(item) => {
        //                 if (item.isGroup == true) {
        //                     let name = (await api.getThreadInfo(item.threadID)).name;
        //                     number += 1;
        //                     let score = storage.find(e => e.id == item.threadID);
        //                     if (score) score = score.score;
        //                     else score = 0;
        //                     msg += number + '. ' + name + ' với ' + score + ' điểm.\n';
        //                 }
        //             })
        //         })
        //         api.sendMessage(msg, threadID);
        //     } else api.sendMessage('Sai format', threadID);
        // }

        if (body.indexOf(`${pf}checktt`) == 0 || body.indexOf(`${pf}check`) == 0) {
            let content = body.split(' ');
            let data = JSON.parse(fs.readFileSync(__dirname + '/src/checktt.json'));
            let getInfo = await api.getThreadInfo(threadID);
            var uinfo = getInfo.userInfo;
            var storage = [];
            for (i of uinfo) {
                if (!data[threadID][i.id]) data[threadID][i.id] = 0;
                storage.push({
                    id: i.id,
                    name: i.name,
                    count: data[threadID][i.id]
                });
            }
            storage.sort((a, b) => {
                if (a.count > b.count) return -1;
                if (a.count < b.count) return 1;
                if (a.id > b.id) return 1;
                if (a.id < b.id) return -1;
            });
            if (!content[1]) {
                const rank = storage.findIndex(info => parseInt(info.id) == parseInt(senderID)) + 1;
                const infoUser = storage[rank - 1];
                api.sendMessage(`Bạn đứng hạng ${rank} với ${infoUser.count} tin nhắn`, threadID, messageID);
            } else if (content[1] == 'all') {
                var number = 0,
                    msg = "";
                for (const lastData of storage) {
                    number++;
                    msg += `${number}. ${lastData.name} với ${lastData.count} tin nhắn \n`;
                }
                api.sendMessage(msg, threadID);
            } else {
                let mention = Object.keys(event.mentions);
                if (mention[0]) {
                    const rank = storage.findIndex(info => parseInt(info.id) == parseInt(mention[0])) + 1;
                    const infoUser = storage[rank - 1];
                    api.sendMessage(`${infoUser.name} đứng hạng ${rank} với ${infoUser.count} tin nhắn`, threadID, messageID);
                } else return api.sendMessage('Sai cú pháp :b', threadID)
            }
            return;
        }

        if (body == `${pf}`) {
            let dny = ["Bạn đã biết.", "Dũng là một thằng ấu dâm.", "Đùi là chân lý.", "Gái gú chỉ là phù du, loli mới là bất diệt.", "DũngUwU là một thằng nghiện loli.", "Bạn đang thở.", "Tú rất dâm.", "Trái đất hình vuông.", "Kẹo sữa Milkita được làm từ sữa.", "Chim cánh cụt có thể bay.", "Trong quá trình hình thành phôi, tế bào tim đầu tiên bắt đầu đập từ tuần thứ 4.", "Hãy thử bóp một quả bóng tennis, nó giống với công việc trái tim phải làm mỗi ngày để bơm máu đi khắp cơ thể.", "Cho đến 6 - 7 tháng tuổi, một đứa trẻ có thể thở và nuốt cùng lúc. Tuy nhiên, người lớn thì không có khả năng này.", "Nếu bạn sống đến 70 tuổi, bạn sẽ trải qua 10 năm của những ngày thứ Hai.", "Năm 1962, một bệnh dịch tiếng cười nổ ra ở Tanzania. Nó nắm quyền kiểm soát hơn 1.000 người và diễn ra trong vòng 18 tháng.", "Độ phân giải của đôi mắt chúng ta lên đến khoảng 576 triệu điểm ảnh", "Vào buổi sáng sau khi thức dậy, chiều cao của chúng ta sẽ nhỉnh hơn so với ban tối vào khoảng 1cm.", "Một khối vuông xương có thể chịu được sức nặng đến hơn 8 tấn, và độ cứng thì hơn cả sắt.", "Nhịp tim của chúng ta có thể tự đồng bộ hóa với bài hát đang nghe.", "Apple được thành lập vào đúng ngày cá tháng tư.", "Ngôn ngữ lập trình JavaScript được ra đời từ năm 1995 bởi nhà khoa học máy tính Brendan Eich, có biệt hiệu Mocha.", "Định dạng file nén ZIP được Phillip Katz phát minh lần đầu tiên vào năm 1986.", "Chiếc điện thoại kèm màn hình cảm ứng đầu tiên trên thế giới được ra mắt vào năm 1992, với tên gọi IBM Simon.", "Chuẩn kết nối Bluetooth được đặt theo tên một vị vua người Đan Mạch.", "Tin nhắn SMS đầu tiên được gửi thông qua mạng viễn thông GSM Vodafrone của Anh vào ngày 3/12/1992.", "Emoticons (các biểu tượng cảm xúc) lần đầu tiên được Scott Fahlman, một nhà khoa học máy tính tại Đại học Carnegie Mellon, sử dụng vào ngày 19/9/1982.", "Chuột máy tính đầu tiên làm bằng gỗ.", "Năm 1910, chiếc tai nghe đầu tiên trên thế giới được Nathaniel Baldwin phát minh ra trong nhà bếp của mình ở bang Utah (Mỹ).", 'Lỗi máy tính hay còn được gọi với cái tên "Bug" được đặt tên theo nghĩa đen của lỗi máy tính đầu tiên.', "Wi-Fi là một từ không có nghĩa."];
            api.sendMessage('[Bạn có biết?]:' + dny[Math.floor(Math.random() * dny.length)], threadID, messageID);
        }

        if (body == `${pf}rest`) {
            if (config.admins.includes(parseInt(senderID))) {
                return api.sendMessage("Bot sẽ khởi động lại ngay lập tức!", threadID, () => {
                            console.log('>> APPLICATION RESTARTED <<');
                            eval("module.exports = process.exit(1)", true)
                    }, messageID);
            } else return api.sendMessage('bạn không phải admin bot :)', threadID, messageID);
        }


        if (body.indexOf(`${pf}box`) == 0) {
            let a = body.slice(0, 4);
            if (a.length == body.length) return api.sendMessage(`Bạn có thể dùng:\n${pf}box emoji [icon]\n\n${pf}box name [tên box cần đổi]\n\n${pf}box image [rep một ảnh bất kì cần đặt thành ảnh box]\n\n${pf}box admin [tag] => nó sẽ đưa qtv cho người được tag\n\n${pf}box info => Toàn bộ thông tin của nhóm ! 
      `, threadID, messageID);

            if (body.slice(5, 9) == "name") {
                var content = body.slice(10, body.length);
                var c = content.slice(0, 99) || event.messageReply.body;
                api.setTitle(`${c } `, threadID);
            }

            if (body.slice(5, 10) == "emoji") {
                a = body.split(" ");
                const name = a[2] || event.messageReply.body;
                api.sendMessage(a[2], threadID, () =>
                    api.changeThreadEmoji(name, threadID))
            }

            if (body.slice(5, 7) == "me") {
                if (body.slice(8, 13) == "admin") {
                    let threadInfo = await api.getThreadInfo(threadID)
                    let find = threadInfo.adminIDs.find(el => el.id == api.getCurrentUserID());
                    if (!find) api.sendMessage("Bot cần quyền quản trị để thực thi lệnh này!", threadID, messageID)
                    else if (!config.admins.includes(senderID)) api.sendMessage("Bạn không đủ quyền!", threadID, messageID)
                    else api.changeAdminStatus(threadID, senderID, true);
                }
            }

            if (body.slice(5, 10) == "admin") {
                if (body.slice(5, body.length).join().indexOf('@') !== -1) {
                    namee = Object.keys(event.mentions)
                } else return api.sendMessage('Vui lòng tag ai đó!', threadID, messageID);
                if (event.messageReply) {
                    namee = event.messageReply.senderID
                }

                const threadInfo = await api.getThreadInfo(threadID)
                const findd = threadInfo.adminIDs.find(el => el.id == namee);
                const find = threadInfo.adminIDs.find(el => el.id == api.getCurrentUserID());
                const finddd = threadInfo.adminIDs.find(el => el.id == senderID);

                if (!finddd) return api.sendMessage("Bạn không phải quản trị viên box", threadID, messageID);
                if (!find) {
                    api.sendMessage("Bot cần quyền quản trị để thực thi lệnh này!", threadID, messageID)
                }
                if (!findd) {
                    api.changeAdminStatus(threadID, namee, true);
                } else api.changeAdminStatus(threadID, namee, false)
            }

            if (body.slice(5, 10) == "image") {
                if (event.type !== "message_reply") return api.sendMessage("❌ Bạn phải reply một audio, video, ảnh nào đó", threadID, messageID);
                if (!event.messageReply.attachments || event.messageReply.attachments.length == 0) return api.sendMessage("❌ Bạn phải reply một audio, video, ảnh nào đó", threadID, messageID);
                if (event.messageReply.attachments.length > 1) return api.sendMessage(`Vui lòng reply chỉ một audio, video, ảnh!`, threadID, messageID);
                var callback = () => api.changeGroupImage(fs.createReadStream(__dirname + "/src/boximg.png"), threadID, () => fs.unlinkSync(__dirname + "/src/boximg.png"));
                return request(encodeURI(event.messageReply.attachments[0].url)).pipe(fs.createWriteStream(__dirname + '/src/boximg.png')).on('close', () => callback());
            };
            if (body.slice(5, 9) == "info") {
                var threadInfo = await api.getThreadInfo(threadID);
                let threadMem = threadInfo.participantIDs.length;
                var gendernam = [];
                var gendernu = [];
                var nope = [];
                for (let z in threadInfo.userInfo) {
                    var gioitinhone = threadInfo.userInfo[z].gender;
                    var nName = threadInfo.userInfo[z].name;

                    if (gioitinhone == 'MALE') {
                        gendernam.push(z + gioitinhone);
                    } else if (gioitinhone == 'FEMALE') {
                        gendernu.push(gioitinhone);
                    } else {
                        nope.push(nName);
                    }
                }
                var nam = gendernam.length;
                var nu = gendernu.length;
                let qtv = threadInfo.adminIDs.length;
                let sl = threadInfo.messageCount;
                let icon = threadInfo.emoji;
                let threadName = threadInfo.threadName;
                let id = threadInfo.threadID;
                var listad = '';
                var qtv2 = threadInfo.adminIDs;
                for (let i = 0; i < qtv2.length; i++) {
                    const infu = (await api.getUserInfo(qtv2[i].id));
                    const name = infu[qtv2[i].id].name;
                    listad += '•' + name + '\n';
                }
                let sex = threadInfo.approvalMode;
                var pd = sex == false ? 'tắt' : sex == true ? 'bật' : 'Kh';
                var pdd = sex == false ? '❎' : sex == true ? '✅' : '⭕';
                var callback = () =>
                    api.sendMessage({
                            body: `Tên box: ${threadName}\nID Box: ${id}\n${pdd} Phê duyệt: ${pd}\nEmoji: ${icon}\n-Thông tin:\nTổng ${threadMem} thành viên\n👨‍🦰Nam: ${nam} thành viên \n👩‍🦰Nữ: ${nu} thành viên\n\n🕵️‍♂️Với ${qtv} quản trị viên gồm:\n${listad}\nTổng số tin nhắn: ${sl} tin.`,
                            attachment: fs.createReadStream(__dirname + '/src/1.png')
                        },
                        threadID, () => fs.unlinkSync(__dirname + '/src/1.png'),
                        messageID
                    );
                if (!threadInfo.imageSrc)
                    return api.sendMessage(`Tên box: ${threadName}\nID Box: ${id}\n${pdd} Phê duyệt: ${pd}\nEmoji: ${icon}\n-Thông tin:\nTổng ${threadMem} thành viên\n👨‍🦰Nam: ${nam} thành viên \n👩‍🦰Nữ: ${nu} thành viên\n\n🕵️‍♂️Với ${qtv} quản trị viên gồm:\n${listad}\nTổng số tin nhắn: ${sl} tin.`,
                        threadID, messageID
                    );
                else return request(encodeURI(`${threadInfo.imageSrc}`))
                    .pipe(fs.createWriteStream(__dirname + '/src/1.png'))
                    .on('close', () => callback());
            }
        }
        if (body.indexOf(`${pf}speedtest`) == 0) {
            try {
                const fast = require("fast-speedtest-api");
                const speedTest = new fast({
                    token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm",
                    verbose: false,
                    timeout: 10000,
                    https: true,
                    urlCount: 5,
                    bufferSize: 8,
                    unit: fast.UNITS.Mbps
                });
                const resault = await speedTest.getSpeed();
                return api.sendMessage(
                    "=== Result ===" +
                    "\n- Speed: " + Math.floor(resault) + " Mbps",
                    threadID, messageID
                );
            } catch {
                return api.sendMessage("Không thể speedtest ngay lúc này, hãy thử lại sau!", threadID, messageID);
            }
        }

        if (body.indexOf(`${pf}ghep`) == 0) {
            Economy.getMoney(senderID).then(async(money) => {
                if (money < 500) return api.sendMessage("Bạn cần 500 đô!", threadID, messageID);
                else {
                    var tle = Math.floor(Math.random() * 101);
                    var name = await User.getName(senderID) || "Bạn";
                    let threadInfo = await api.getThreadInfo(threadID);
                    var all = threadInfo.participantIDs.filter(ID => ID != senderID);;
                    var id = all[Math.floor(Math.random() * all.length)];
                    var namee = await User.getName(id) || "Người ấy";
                    var arraytag = [];
                    arraytag.push({
                        id: senderID,
                        tag: name
                    });
                    arraytag.push({
                        id: id,
                        tag: namee
                    })

                    let Avatar = (await axios.get(`https://graph.facebook.com/${id}/picture?height=720&width=720&access_token=170440784240186|bc82258eaaf93ee5b9f577a8d401bfc9`, {
                        responseType: "arraybuffer"
                    })).data;
                    fs.writeFileSync(__dirname + "/media/avt.png", Buffer.from(Avatar, "utf-8"));
                    let Avatar2 = (await axios.get(`https://graph.facebook.com/${senderID}/picture?height=720&width=720&access_token=170440784240186|bc82258eaaf93ee5b9f577a8d401bfc9`, {
                        responseType: "arraybuffer"
                    })).data;
                    fs.writeFileSync(__dirname + "/media/avt2.png", Buffer.from(Avatar2, "utf-8"));
                    var imglove = [];
                    imglove.push(fs.createReadStream(__dirname + "/media/avt.png"));
                    imglove.push(fs.createReadStream(__dirname + "/media/avt2.png"));
                    var msg = {
                        body: `🐳Ghép đôi thành công!\n💞Tỉ lệ hợp đôi: ${tle}%\n${name} 💓 ${namee}`,
                        mentions: arraytag,
                        attachment: imglove
                    }
                    Economy.subtractMoney(senderID, 500);
                    return api.sendMessage(msg, threadID, messageID)
                }
            });
        }


        if (body.indexOf(`${pf}resend`) == 0) {
            let arg = body.substring(8, body.length);
            let threadInfo = await api.getThreadInfo(threadID);
            let find = threadInfo.adminIDs.find(el => el.id == senderID);
            if (!find) return api.sendMessage("Bạn không phải quản trị viên", threadID);
            if (arg == 'off') {
                if (__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt Resend trước đây.", threadID, messageID);
                return Thread.blockResend(threadID).then((success) => {
                    if (!success) return api.sendMessage("Oops, không thể tắt Resend trong nhóm này.", threadID, messageID);
                    api.sendMessage("Đã tắt Resend thành công!", threadID, messageID);
                    __GLOBAL.resendBlocked.push(threadID);
                })
            } else if (arg == 'on') {
                if (!__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này chưa bị tắt Resend trước đây.", threadID, messageID);
                return Thread.unblockResend(threadID).then(success => {
                    if (!success) return api.sendMessage("Oops, không thể bật Resend trong nhóm này.", threadID, messageID);
                    api.sendMessage("Đã bật Resend thành công!", threadID, messageID);
                    __GLOBAL.resendBlocked.splice(__GLOBAL.resendBlocked.indexOf(threadID), 1);
                });
            } else {
                if (!__GLOBAL.resendBlocked.includes(threadID)) {
                    return Thread.blockResend(threadID).then((success) => {
                        if (!success) return api.sendMessage("Oops, không thể tắt Resend trong nhóm này.", threadID, messageID);
                        api.sendMessage("Đã tắt Resend thành công!", threadID, messageID);
                        __GLOBAL.resendBlocked.push(threadID);
                    })
                } else {
                    return Thread.unblockResend(threadID).then(success => {
                        if (!success) return api.sendMessage("Oops, không thể bật Resend trong nhóm này.", threadID, messageID);
                        api.sendMessage("Đã bật Resend thành công!", threadID, messageID);
                        __GLOBAL.resendBlocked.splice(__GLOBAL.resendBlocked.indexOf(threadID), 1);
                    });
                }
            }
        }

        if (body == `${pf}tid`) {
            return api.sendMessage(threadID.toString(), threadID, messageID);
        }

        //Lệnh cho riêng từng box
        let araryIDs = [];

        //chuisml
        if (body.indexOf(`${pf}chuisml`) == 0) {
            let threadInfo = await api.getThreadInfo(threadID);
            let find = threadInfo.adminIDs.find(el => el.id == senderID);
            if (!find) return api.sendMessage("Bạn không phải quản trị viên", threadID, messageID);
            let mention = Object.keys(event.mentions);
            if (!mention[0]) return api.sendMessage("Bạn cần tag người cần chửi!", threadID, messageID);
            let chuismlName = await User.getName(mention[0]);
            let chuisml = ["Con chó {name} mày ra đây tao bảo", "Thứ súc vật {name}", "Con đỉ mẹ mày {name}", "Đỉ chó mất nết {name}", "Đầu óc {name} ngu si, chỉ có tứ chi phát triển",
                "Đụ con đĩ mẹ {name} nhá, chết mẹ mày đi", "{name} là thứ rác thải đéo phân hủy", "Con đỉ {name} rất ngu mà còn hay sủa",
                "Đéo có trí tuệ như {name} thì chỉ xứng làm đĩ", "Địt cả họ nhà mày {name}", "Súc sinh vật học {name}",
                "{name} ngu hơn con chó", "Nhà tao có con chó tên {name}", "Dòng thứ nứng lồn {name}", "Con chó đẻ {name}",
                "Đụ đĩ mẹ mày {name}", "Thứ đéo có ăn học {name}", "Loại như {name} chỉ có ăn cức thay cơm", "Địt bà mày con chó {name}"
            ];
            let chuismlNum = 0;
            chuisml.forEach(e => {
                chuismlNum += 1;
                setTimeout(() => {
                    api.sendMessage({
                        body: e.replace("{name}", chuismlName),
                        mentions: [{
                            tag: chuismlName,
                            id: mention[0]
                        }]
                    }, threadID);
                }, chuismlNum * 1000);
            })
        }
    }
}
