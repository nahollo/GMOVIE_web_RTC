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
app.get("/", (_, res) => res.render("home"));
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
  socket.on("join_room", (roomName) => {
    let room = wsServer.sockets.adapter.rooms.get(roomName);
    let idList = room ? [...room] : [];

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

    // 오디오 데이터를 파일로 저장
    fs.writeFile(audioFilePath, audioData, "binary", (err) => {
      if (err) {
        console.error("오디오 파일 저장 중 오류 발생:", err);
        return;
      }
      console.log("오디오 파일 저장 완료:", uniqueFileName);

      // 파일 저장이 완료되면 클라이언트에 응답 전송 또는 다른 작업 수행
      // 예를 들어, 저장된 파일 경로 등을 클라이언트로 전달할 수 있음
    });
  });

  // 클라이언트에서 메시지를 보낼 때 받는 이벤트를 수정
  socket.on("new_message", (msg, room, done) => {
    console.log("cex");
    // room에 연결된 모든 클라이언트에게 메시지를 전달
    socket.to(room).emit("chatMessage", msg, nickname);
    // 클라이언트에게 완료 신호를 보내기 위해 done() 호출
    done();
    
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

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);