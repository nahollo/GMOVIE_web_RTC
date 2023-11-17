"use strict";

var _http = _interopRequireDefault(require("http"));

var _socket = _interopRequireDefault(require("socket.io"));

var _express = _interopRequireDefault(require("express"));

var _wrtc = _interopRequireDefault(require("wrtc"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var ffmpeg = require('fluent-ffmpeg');

var app = (0, _express["default"])(); // app.set("view engine", "pug");

app.get("/", function (_, res) {
  return res.sendFile(_path["default"].join(__dirname, "views", "home.html"));
});
app.set("views", __dirname + "/views");
app.use("/public", _express["default"]["static"](__dirname + "/public"));
app.use("/img", _express["default"]["static"](_path["default"].join(__dirname, "views", "img")));
app.use("/css", _express["default"]["static"](_path["default"].join(__dirname, "views", "css")));
app.use("/js", _express["default"]["static"](_path["default"].join(__dirname, "views", "js")));
app.get("/", function (_, res) {
  return res.render("home");
});
app.get("/*", function (_, res) {
  return res.redirect("/");
});

var httpServer = _http["default"].createServer(app);

var wsServer = (0, _socket["default"])(httpServer); // Client의 recvPeerMap에 대응된다.
// Map<sendPeerId, Map<recvPeerId, PeerConnection>>();

var sendPeerMap = new Map(); // Client의 SendPeer에 대응된다.
// Map<peerId, PeerConnection>

var recvPeerMap = new Map(); // 특정 room의 user Stream을 처리하기 위한 Map
// Map<roomName, Map<socketId, Stream>>(); Stream = data.streams[0]

var streamMap = new Map();
var roomList = [];

var fs = require("fs");

var dateMap = new Map();
var userDateMap = new Map(); // 유저가 들어온 date

var distanceDate; // date 차이점
// 디렉토리 경로 설정

var audioDataDir = _path["default"].join(__dirname, 'audio'); // 디렉토리가 없는 경우 생성


if (!fs.existsSync(audioDataDir)) {
  fs.mkdirSync(audioDataDir);
}

function getUserRoomList(socket) {
  var rooms = socket.rooms;
  rooms["delete"](socket.id);
  return _toConsumableArray(rooms);
}

wsServer.on("connection", function (socket) {
  var nickname = socket.id;
  socket.on("join_room", function (roomName, date, check) {
    if (check === 1) {
      roomList.push(roomName);
      var room = wsServer.sockets.adapter.rooms.get(roomName);
      var idList = room ? _toConsumableArray(room) : [];

      if (dateMap.has(roomName)) {
        distanceDate = date - dateMap.get(roomName);
        userDateMap.set(socket.id, distanceDate);
      } else {
        dateMap.set(roomName, date);
        userDateMap.set(socket.id, 0);
      }

      console.log(idList);
      socket.emit("user_list", idList);
      socket.emit("nickname", nickname);
      console.log("join_room id = " + socket.id);
      socket.join(roomName);
      socket.roomName = roomName;
    } else if (check === 0) {
      console.log("join roomList : ", roomList);

      if (roomList.includes(roomName)) {
        var _room = wsServer.sockets.adapter.rooms.get(roomName);

        var _idList = _room ? _toConsumableArray(_room) : [];

        if (dateMap.has(roomName)) {
          distanceDate = date - dateMap.get(roomName);
          userDateMap.set(socket.id, distanceDate);
        } else {
          dateMap.set(roomName, date);
          userDateMap.set(socket.id, 0);
        }

        console.log(_idList);
        socket.emit("user_list", _idList);
        socket.emit("nickname", nickname);
        console.log("join_room id = " + socket.id);
        socket.join(roomName);
        socket.roomName = roomName;
      } else {
        console.log("Room ".concat(roomName, " does not exist. Cannot join."));
      }
    }
  });
  socket.on("check_room_existence", function (roomName) {
    var room = wsServer.sockets.adapter.rooms.get(roomName);
    var roomExists = roomList.includes(roomName);
    socket.emit("room_existence_response", roomExists);
  });
  socket.on("recvOffer", function _callee(offer, sendId) {
    return regeneratorRuntime.async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            console.log("got recvOffer from ".concat(socket.id)); // recvPeer에 대응하여 sendPeer를 생성한다.

            createSendPeer(sendId);
            createSendAnswer(offer, sendId);

          case 3:
          case "end":
            return _context.stop();
        }
      }
    });
  });
  socket.on("recvCandidate", function _callee2(candidate, sendId) {
    return regeneratorRuntime.async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (candidate) {
              sendPeerMap.get(sendId).get(socket.id).addIceCandidate(candidate);
            }

          case 1:
          case "end":
            return _context2.stop();
        }
      }
    });
  });
  socket.on("sendOffer", function (offer) {
    console.log("got sendOffer from ".concat(socket.id));
    createRecvPeer();
    createRecvAnswer(offer);
  });
  socket.on("sendCandidate", function _callee3(candidate) {
    return regeneratorRuntime.async(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (candidate) {
              recvPeerMap.get(socket.id).addIceCandidate(candidate);
            }

          case 1:
          case "end":
            return _context3.stop();
        }
      }
    });
  });
  socket.on("disconnecting", function () {
    var rooms = getUserRoomList(socket);
    var id = socket.id;
    console.log("".concat(id, " left room"));
    console.log(rooms);

    if (sendPeerMap.has(id)) {
      sendPeerMap.get(id).forEach(function (value, key) {
        value.close();
      });
      sendPeerMap["delete"](id);
    }

    if (recvPeerMap.has(id)) {
      recvPeerMap.get(id).close();
      recvPeerMap["delete"](id);
    }

    rooms.forEach(function (room) {
      socket.to(room).emit("bye", id);

      if (streamMap.has(room)) {
        streamMap.get(room)["delete"](id);
      }
    });
  });
  socket.on("startScreenShare", function (shareInfo) {
    socket.to(shareInfo.roomName).emit("startScreenShare", shareInfo);
  });
  socket.on("stopScreenShare", function (roomName) {
    socket.to(roomName).emit("stopScreenShare");
  });

  var createSilenceAudio = function createSilenceAudio(silenceAudioFile, silenceDuration) {
    return new Promise(function (resolve, reject) {
      var silenceAudio = ffmpeg().input('anullsrc=r=48000:cl=mono').inputFormat('lavfi').audioChannels(1).audioCodec('pcm_s16le').audioFilters("atrim=0:".concat(silenceDuration)).output(silenceAudioFile);
      silenceAudio.on('end', function () {
        console.log("\uBB34\uC74C\uC744 ".concat(silenceDuration, "\uCD08\uB9CC\uD07C \uBB34\uC74C \uD30C\uC77C\uC5D0 \uCD94\uAC00\uD558\uC600\uC2B5\uB2C8\uB2E4."));
        resolve();
      });
      silenceAudio.on('error', function (err) {
        console.error('무음 데이터 생성 중 오류 발생:', err);
        reject(err);
      });
      silenceAudio.run();
    });
  };

  socket.on("audioData", function _callee4(audioDataArrayBuffer) {
    var roomDir, date, dateDir, audioFilePath, silenceDuration, outputFilePath, silenceAudioFile, audioDataFile;
    return regeneratorRuntime.async(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            roomDir = _path["default"].join(audioDataDir, socket.roomName);
            date = Date.now();
            dateDir = _path["default"].join(roomDir, date.toString());
            audioFilePath = _path["default"].join(roomDir, "".concat(date, ".wav"));
            silenceDuration = userDateMap.get(socket.id) / 1000; // 무음으로 사용할 시간 (milliseconds)

            outputFilePath = _path["default"].join(dateDir, 'merge.wav');

            if (!fs.existsSync(roomDir)) {
              fs.mkdirSync(roomDir);
            }

            if (!fs.existsSync(dateDir)) {
              fs.mkdirSync(dateDir);
            }

            silenceAudioFile = _path["default"].join(dateDir, "".concat(date, "_silence.wav"));
            audioDataFile = _path["default"].join(dateDir, "".concat(date, ".wav"));

            if (!(silenceDuration > 0)) {
              _context4.next = 23;
              break;
            }

            _context4.prev = 11;
            _context4.next = 14;
            return regeneratorRuntime.awrap(createSilenceAudio(silenceAudioFile, silenceDuration));

          case 14:
            fs.writeFileSync(audioDataFile, Buffer.from(audioDataArrayBuffer));
            setTimeout(function () {
              var combinedAudio = ffmpeg().input(silenceAudioFile).input(audioDataFile).complexFilter(['[0:a][1:a]concat=n=2:v=0:a=1[out]'], ['out']).output(audioFilePath).on('end', function () {
                console.log('오디오 파일에 무음 데이터를 추가하고 저장했습니다.');
              }).on('error', function (err) {
                console.error('오디오 파일 처리 중 오류 발생:', err);
              });
              combinedAudio.run();
              setTimeout(function () {
                mixAudioFiles(roomDir);
              }, 20000);
            }, 10000);
            _context4.next = 21;
            break;

          case 18:
            _context4.prev = 18;
            _context4.t0 = _context4["catch"](11);
            console.error('무음 데이터 생성 중 오류 발생:', _context4.t0);

          case 21:
            _context4.next = 25;
            break;

          case 23:
            fs.writeFileSync(audioFilePath, Buffer.from(audioDataArrayBuffer));
            console.log("오디오 파일 저장 완료:", "".concat(date, ".wav"));

          case 25:
          case "end":
            return _context4.stop();
        }
      }
    }, null, null, [[11, 18]]);
  });

  var mixAudioFiles = function mixAudioFiles(dateDir) {
    var outputFilePath = _path["default"].join(dateDir, 'merge.wav');

    var inputFiles = fs.readdirSync(dateDir).filter(function (file) {
      return file.endsWith('.wav') && file !== 'merge.wav';
    });

    if (inputFiles.length < 2) {
      console.log('믹스할 충분한 WAV 파일이 없습니다.');
      return;
    }

    if (fs.existsSync(outputFilePath)) {
      console.log('기존 merge.wav 파일 삭제');
      fs.unlinkSync(outputFilePath);
    }

    var ffmpegCommand = ffmpeg();
    inputFiles.forEach(function (inputFile) {
      var inputPath = _path["default"].join(dateDir, inputFile);

      ffmpegCommand.input(inputPath);
    });
    ffmpegCommand.complexFilter("amix=inputs=".concat(inputFiles.length, ":dropout_transition=2[out]"), ['out']).audioCodec('pcm_s16le').output(outputFilePath).on('end', function () {
      console.log('오디오 파일을 믹스하여 merge.wav 파일을 생성했습니다.');
    }).on('error', function (err) {
      console.error('오디오 파일 믹스 중 오류 발생:', err);
    });
    ffmpegCommand.run();
  };

  socket.on("leaveRoom", function () {
    if (socket.roomName) {
      var roomName = socket.roomName;
      var userId = socket.id;
      socket.leave(roomName);
      socket.to(roomName).emit("bye", userId);
    }
  });
  socket.on("boom", function () {
    var roomName = socket.roomName; // 방의 모든 사용자에게 나가라는 신호를 보냅니다.

    wsServer.to(roomName).emit("exit_all"); // 모든 사용자를 방에서 나가게 만듭니다.

    wsServer["in"](roomName).fetchSockets().then(function (sockets) {
      sockets.forEach(function (userSocket) {
        userSocket.leave(roomName);
      });
    });
  });

  function createRecvPeer() {
    var recvPeer = new _wrtc["default"].RTCPeerConnection({
      iceServers: [{
        urls: 'stun:global.stun.twilio.com:3478'
      }, // STUN 서버
      {
        urls: 'turn:global.turn.twilio.com:3478',
        // TURN 서버
        username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
        credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0'
      }]
    });
    recvPeer.addEventListener("icecandidate", function (data) {
      console.log("sent sendCandidate to client ".concat(socket.id));
      socket.emit("sendCandidate", data.candidate);
    });
    recvPeer.addEventListener("track", function (data) {
      console.log("recvPeer track");
      var rooms = getUserRoomList(socket);
      console.log(rooms);

      if (!streamMap.has(rooms[0])) {
        streamMap.set(rooms[0], new Map());
      }

      if (streamMap.get(rooms[0]).has(socket.id)) {
        return;
      } // Stream 정보를 추가하고 다른 클라에게 알린다.


      streamMap.get(rooms[0]).set(socket.id, data.streams[0]);
      socket.to(rooms[0]).emit("newStream", socket.id);
    });
    recvPeerMap.set(socket.id, recvPeer);
  }

  function createRecvAnswer(offer) {
    var recvPeer, answer;
    return regeneratorRuntime.async(function createRecvAnswer$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            recvPeer = recvPeerMap.get(socket.id);
            recvPeer.setRemoteDescription(offer);
            _context5.next = 4;
            return regeneratorRuntime.awrap(recvPeer.createAnswer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true
            }));

          case 4:
            answer = _context5.sent;
            recvPeer.setLocalDescription(answer);
            console.log("sent the sendAnswer to ".concat(socket.id));
            socket.emit("sendAnswer", answer);

          case 8:
          case "end":
            return _context5.stop();
        }
      }
    });
  }

  function createSendPeer(sendId) {
    var sendPeer = new _wrtc["default"].RTCPeerConnection({
      iceServers: [{
        urls: 'stun:global.stun.twilio.com:3478'
      }, // STUN 서버
      {
        urls: 'turn:global.turn.twilio.com:3478',
        // TURN 서버
        username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
        credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0'
      }]
    });
    sendPeer.addEventListener("icecandidate", function (data) {
      console.log("sent recvCandidate to client ".concat(socket.id));
      socket.emit("recvCandidate", data.candidate, sendId);
    });
    var rooms = getUserRoomList(socket);
    var stream = streamMap.get(rooms[0]).get(sendId);
    stream.getTracks().forEach(function (track) {
      sendPeer.addTrack(track, stream);
    });

    if (!sendPeerMap.has(sendId)) {
      sendPeerMap.set(sendId, new Map());
    }

    sendPeerMap.get(sendId).set(socket.id, sendPeer);
  }

  function createSendAnswer(offer, sendId) {
    var sendPeer, answer;
    return regeneratorRuntime.async(function createSendAnswer$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            sendPeer = sendPeerMap.get(sendId).get(socket.id);
            sendPeer.setRemoteDescription(offer);
            _context6.next = 4;
            return regeneratorRuntime.awrap(sendPeer.createAnswer({
              offerToReceiveVideo: false,
              offerToReceiveAudio: false
            }));

          case 4:
            answer = _context6.sent;
            sendPeer.setLocalDescription(answer);
            console.log("sent the recvAnswer to ".concat(socket.id));
            socket.emit("recvAnswer", answer, sendId);

          case 8:
          case "end":
            return _context6.stop();
        }
      }
    });
  }
});

var handleListen = function handleListen() {
  return console.log("Listening on http://localhost:3000");
};

httpServer.listen(3000, handleListen);