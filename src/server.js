import http from "http";
import SocketIO from "socket.io";
import express from "express";
import wrtc from "wrtc";
import path from "path";

const app = express();

// app.set("view engine", "pug");
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "views", "home.html")));
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.use("/img", express.static(path.join(__dirname, "views", "img")));
app.use("/css", express.static(path.join(__dirname, "views", "css")));
app.use("/js", express.static(path.join(__dirname, "views", "js")));
app.get("/", (_, res) => res.render("home"));
app.get("/", (req, res) => {
  const userNo = req.query.userNo;
  // Oracle 데이터베이스 연결
  oracledb.getConnection(dbConfig, (err, connection) => {
    if (err) {
      console.error("Error connecting to Oracle database:", err);
      return res.status(500).json({ error: "Database connection error" });
    }
    // SQL 쿼리를 생성
    const query = "SELECT NAME FROM USER3 WHERE NO = :userNo"; // USER3 테이블과 필드 이름에 주의
    // SQL 바인딩 변수 설정
    const binds = [userNo];
    // SQL 쿼리 실행
    connection.execute(query, binds, (err, result) => {
      if (err) {
        console.error("Error executing SQL query:", err);
        connection.release();
        return res.status(500).json({ error: "Database query error" });
      }
      // 결과에서 사용자 이름 추출
      if (result.rows.length > 0) {
        const userName = result.rows[0][0];
        // 클라이언트로 사용자 이름 전송
        res.json({ userName: userName });
        socket.emit("userNo_Name", userName);
      } else {
        res.status(404).json({ error: "User not found" });
      }
      // 연결 해제
      connection.release();
    });
  });
});



app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

// Client의 recvPeerMap에 대응된다.
// Map<sendPeerId, Map<recvPeerId, PeerConnection>>();
let sendPeerMap = new Map();

// Client의 SendPeer에 대응된다.
// Map<peerId, PeerConnection>
let recvPeerMap = new Map();

// 특정 room의 user Stream을 처리하기 위한 Map
// Map<roomName, Map<socketId, Stream>>(); Stream = data.streams[0]
let streamMap = new Map();

const fs = require("fs");

let dateMap = new Map();

let userDateMap = new Map(); // 유저가 들어온 date

let distanceDate; // date 차이점


// 디렉토리 경로 설정
const audioDataDir = path.join(__dirname, 'audio');

// 디렉토리가 없는 경우 생성
if (!fs.existsSync(audioDataDir)) {
  fs.mkdirSync(audioDataDir);
}

function getUserRoomList(socket) {
  let rooms = socket.rooms;
  rooms.delete(socket.id);
  return [...rooms];
}



wsServer.on("connection", (socket) => {
  const nickname = socket.id;
  socket.on("join_room", (roomName, date) => {
    let room = wsServer.sockets.adapter.rooms.get(roomName);
    let idList = room ? [...room] : [];

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

  socket.on("recvOffer", async (offer, sendId) => {
    console.log(`got recvOffer from ${socket.id}`);

    // recvPeer에 대응하여 sendPeer를 생성한다.
    createSendPeer(sendId);
    createSendAnswer(offer, sendId);
  });

  socket.on("recvCandidate", async (candidate, sendId) => {
    if (candidate) {
      sendPeerMap.get(sendId).get(socket.id).addIceCandidate(candidate);
    }
  });

  socket.on("sendOffer", (offer) => {
    console.log(`got sendOffer from ${socket.id}`);

    createRecvPeer();
    createRecvAnswer(offer);
  });

  socket.on("sendCandidate", async (candidate) => {
    if (candidate) {
      recvPeerMap.get(socket.id).addIceCandidate(candidate);
    }
  });

  socket.on("disconnecting", () => {
    let rooms = getUserRoomList(socket);
    let id = socket.id;

    console.log(`${id} left room`);
    console.log(rooms);

    if (sendPeerMap.has(id)) {
      sendPeerMap.get(id).forEach((value, key) => {
        value.close();
      });

      sendPeerMap.delete(id);
    }

    if (recvPeerMap.has(id)) {
      recvPeerMap.get(id).close();
      recvPeerMap.delete(id);
    }

    rooms.forEach((room) => {
      socket.to(room).emit("bye", id);

      if (streamMap.has(room)) {
        streamMap.get(room).delete(id);
      }
    });
  });
  socket.on("audioData", (audioData) => {
    const roomDir = path.join(audioDataDir, socket.roomName);

    // 방 디렉토리가 없는 경우 생성
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir);
    }

    // 고유한 파일 이름 생성
    const uniqueFileName = `${Date.now()}.wav`;
    const audioFilePath = path.join(roomDir, uniqueFileName);

    // silence 데이터 생성 (패딩)
    const silenceDuration = userDateMap.get(socket.id); // 패딩으로 사용할 시간 (milliseconds)
    console.log(uniqueFileName + "는 " + silenceDuration + "만큼 패딩");
    const silenceSampleRate = 44100; // 오디오 샘플 속도 (예: 44100 Hz)
    const silenceData = Buffer.alloc(silenceDuration * silenceSampleRate * 2); // 2는 16 비트 모노 오디오 데이터를 의미합니다

    // silence 데이터를 파일에 추가
    fs.writeFileSync(audioFilePath, silenceData);
    fs.appendFileSync(audioFilePath, audioData, "binary", (err) => {
      if (err) {
        console.error("오디오 파일 저장 중 오류 발생:", err);
        return;
      }
      console.log("오디오 파일 저장 완료:", uniqueFileName);
    });
  });

  // 클라이언트에서 메시지를 보낼 때 받는 이벤트를 수정
  socket.on("new_message", (msg, room, done) => {
    // room에 연결된 모든 클라이언트에게 메시지를 전달
    socket.to(room).emit("chatMessage", msg);
    // 클라이언트에게 완료 신호를 보내기 위해 done() 호출
    done();
  });

  socket.on("leaveRoom", () => {
    if (socket.roomName) {
      const roomName = socket.roomName;
      const userId = socket.id;
      socket.leave(roomName);
      socket.to(roomName).emit("bye", userId);
    }
  });

  socket.on("boom", () => {
    const roomName = socket.roomName;

    // 방의 모든 사용자에게 나가라는 신호를 보냅니다.
    wsServer.to(roomName).emit("exit_all");

    // 모든 사용자를 방에서 나가게 만듭니다.
    wsServer.in(roomName).fetchSockets().then((sockets) => {
      sockets.forEach((userSocket) => {
        userSocket.leave(roomName);
      });
    });
  });

  function createRecvPeer() {
    let recvPeer = new wrtc.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:global.stun.twilio.com:3478' }, // STUN 서버
        {
          urls: 'turn:global.turn.twilio.com:3478', // TURN 서버
          username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
          credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0',
        },
      ],
    });

    recvPeer.addEventListener("icecandidate", (data) => {
      console.log(`sent sendCandidate to client ${socket.id}`);
      socket.emit("sendCandidate", data.candidate);
    });

    recvPeer.addEventListener("track", (data) => {
      console.log("recvPeer track");
      let rooms = getUserRoomList(socket);
      console.log(rooms);
      if (!streamMap.has(rooms[0])) {
        streamMap.set(rooms[0], new Map());
      }
      if (streamMap.get(rooms[0]).has(socket.id)) {
        return;
      }
      // Stream 정보를 추가하고 다른 클라에게 알린다.
      streamMap.get(rooms[0]).set(socket.id, data.streams[0]);
      socket.to(rooms[0]).emit("newStream", socket.id);
    });

    recvPeerMap.set(socket.id, recvPeer);
  }

  async function createRecvAnswer(offer) {
    let recvPeer = recvPeerMap.get(socket.id);

    recvPeer.setRemoteDescription(offer);
    const answer = await recvPeer.createAnswer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
    });
    recvPeer.setLocalDescription(answer);

    console.log(`sent the sendAnswer to ${socket.id}`);
    socket.emit("sendAnswer", answer);
  }

  function createSendPeer(sendId) {
    let sendPeer = new wrtc.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:global.stun.twilio.com:3478' }, // STUN 서버
        {
          urls: 'turn:global.turn.twilio.com:3478', // TURN 서버
          username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
          credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0',
        },
      ],
    });
    sendPeer.addEventListener("icecandidate", (data) => {
      console.log(`sent recvCandidate to client ${socket.id}`);
      socket.emit("recvCandidate", data.candidate, sendId);
    });

    let rooms = getUserRoomList(socket);
    let stream = streamMap.get(rooms[0]).get(sendId);

    stream.getTracks().forEach((track) => {
      sendPeer.addTrack(track, stream);
    });

    if (!sendPeerMap.has(sendId)) {
      sendPeerMap.set(sendId, new Map());
    }

    sendPeerMap.get(sendId).set(socket.id, sendPeer);
  }

  async function createSendAnswer(offer, sendId) {
    let sendPeer = sendPeerMap.get(sendId).get(socket.id);

    sendPeer.setRemoteDescription(offer);
    const answer = await sendPeer.createAnswer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false,
    });
    sendPeer.setLocalDescription(answer);

    console.log(`sent the recvAnswer to ${socket.id}`);
    socket.emit("recvAnswer", answer, sendId);
  }
});

let connection;
var oracledb= require('oracledb');

(async function(){
  try{
    connection = await oracledb.getConnection({
      user : 'system',
      password : '3575',
      connectionString : 'localhost:1521/xe'

    });
    console.log("Successfully connected to Oracle!")

  }catch(err){
    console.log("Error: ", err);
  }finally{
    if(connection){
      try{
        await connection.close();
      }catch(err){
        console.log("Error when closing the database connection: ", err);
      }
    }
  }
})()

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

