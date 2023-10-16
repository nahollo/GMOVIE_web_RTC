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
app.get("/", function (req, res) {
  var userNo = req.query.userNo; // Oracle 데이터베이스 연결

  oracledb.getConnection(dbConfig, function (err, connection) {
    if (err) {
      console.error("Error connecting to Oracle database:", err);
      return res.status(500).json({
        error: "Database connection error"
      });
    } // SQL 쿼리를 생성


    var query = "SELECT NAME FROM USER3 WHERE NO = :userNo"; // USER3 테이블과 필드 이름에 주의
    // SQL 바인딩 변수 설정

    var binds = [userNo]; // SQL 쿼리 실행

    connection.execute(query, binds, function (err, result) {
      if (err) {
        console.error("Error executing SQL query:", err);
        connection.release();
        return res.status(500).json({
          error: "Database query error"
        });
      } // 결과에서 사용자 이름 추출


      if (result.rows.length > 0) {
        var userName = result.rows[0][0]; // 클라이언트로 사용자 이름 전송

        res.json({
          userName: userName
        });
        socket.emit("userNo_Name", userName);
      } else {
        res.status(404).json({
          error: "User not found"
        });
      } // 연결 해제


      connection.release();
    });
  });
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
  socket.on("join_room", function (roomName, date) {
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
  socket.on("audioData", function (audioData) {
    var roomDir = _path["default"].join(audioDataDir, socket.roomName); // 방 디렉토리가 없는 경우 생성


    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir);
    } // 고유한 파일 이름 생성


    var uniqueFileName = "".concat(Date.now(), ".wav");

    var audioFilePath = _path["default"].join(roomDir, uniqueFileName); // silence 데이터 생성 (패딩)


    var silenceDuration = userDateMap.get(socket.id); // 패딩으로 사용할 시간 (milliseconds)

    console.log(uniqueFileName + "는 " + silenceDuration + "만큼 패딩");
    var silenceSampleRate = 44100; // 오디오 샘플 속도 (예: 44100 Hz)

    var silenceData = Buffer.alloc(silenceDuration * silenceSampleRate * 2); // 2는 16 비트 모노 오디오 데이터를 의미합니다
    // silence 데이터를 파일에 추가

    fs.writeFileSync(audioFilePath, silenceData);
    fs.appendFileSync(audioFilePath, audioData, "binary", function (err) {
      if (err) {
        console.error("오디오 파일 저장 중 오류 발생:", err);
        return;
      }

      console.log("오디오 파일 저장 완료:", uniqueFileName);
    });
  }); // 클라이언트에서 메시지를 보낼 때 받는 이벤트를 수정

  socket.on("new_message", function (msg, room, done) {
    // room에 연결된 모든 클라이언트에게 메시지를 전달
    socket.to(room).emit("chatMessage", msg); // 클라이언트에게 완료 신호를 보내기 위해 done() 호출

    done();
  });
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
    return regeneratorRuntime.async(function createRecvAnswer$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            recvPeer = recvPeerMap.get(socket.id);
            recvPeer.setRemoteDescription(offer);
            _context4.next = 4;
            return regeneratorRuntime.awrap(recvPeer.createAnswer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true
            }));

          case 4:
            answer = _context4.sent;
            recvPeer.setLocalDescription(answer);
            console.log("sent the sendAnswer to ".concat(socket.id));
            socket.emit("sendAnswer", answer);

          case 8:
          case "end":
            return _context4.stop();
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
    return regeneratorRuntime.async(function createSendAnswer$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            sendPeer = sendPeerMap.get(sendId).get(socket.id);
            sendPeer.setRemoteDescription(offer);
            _context5.next = 4;
            return regeneratorRuntime.awrap(sendPeer.createAnswer({
              offerToReceiveVideo: false,
              offerToReceiveAudio: false
            }));

          case 4:
            answer = _context5.sent;
            sendPeer.setLocalDescription(answer);
            console.log("sent the recvAnswer to ".concat(socket.id));
            socket.emit("recvAnswer", answer, sendId);

          case 8:
          case "end":
            return _context5.stop();
        }
      }
    });
  }
});
var connection;

var oracledb = require('oracledb');

(function _callee4() {
  return regeneratorRuntime.async(function _callee4$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _context6.next = 3;
          return regeneratorRuntime.awrap(oracledb.getConnection({
            user: 'system',
            password: '3575',
            connectionString: 'localhost:1521/xe'
          }));

        case 3:
          connection = _context6.sent;
          console.log("Successfully connected to Oracle!");
          _context6.next = 10;
          break;

        case 7:
          _context6.prev = 7;
          _context6.t0 = _context6["catch"](0);
          console.log("Error: ", _context6.t0);

        case 10:
          _context6.prev = 10;

          if (!connection) {
            _context6.next = 20;
            break;
          }

          _context6.prev = 12;
          _context6.next = 15;
          return regeneratorRuntime.awrap(connection.close());

        case 15:
          _context6.next = 20;
          break;

        case 17:
          _context6.prev = 17;
          _context6.t1 = _context6["catch"](12);
          console.log("Error when closing the database connection: ", _context6.t1);

        case 20:
          return _context6.finish(10);

        case 21:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 7, 10, 21], [12, 17]]);
})();

var handleListen = function handleListen() {
  return console.log("Listening on http://localhost:3000");
};

httpServer.listen(3000, handleListen);