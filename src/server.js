import http from "http";
import SocketIO from "socket.io";
import express from "express";
import wrtc from "wrtc";
import path from "path";
const ffmpeg = require('fluent-ffmpeg');
const app = express();

// app.set("view engine", "pug");
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "views", "home.html")));
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.use("/img", express.static(path.join(__dirname, "views", "img")));
app.use("/css", express.static(path.join(__dirname, "views", "css")));
app.use("/js", express.static(path.join(__dirname, "views", "js")));
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


  const createSilenceAudio = (silenceAudioFile, silenceDuration) => {
    return new Promise((resolve, reject) => {
      const silenceAudio = ffmpeg()
        .input('anullsrc=r=48000:cl=mono')
        .inputFormat('lavfi')
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .audioFilters(`atrim=0:${silenceDuration}`)
        .output(silenceAudioFile);

      silenceAudio.on('end', () => {
        console.log(`무음을 ${silenceDuration}초만큼 무음 파일에 추가하였습니다.`);
        resolve();
      });

      silenceAudio.on('error', (err) => {
        console.error('무음 데이터 생성 중 오류 발생:', err);
        reject(err);
      });

      silenceAudio.run();
    });
  }

  socket.on("audioData", async (audioDataArrayBuffer) => {
    const roomDir = path.join(audioDataDir, socket.roomName);
    const date = Date.now();
    const dateDir = path.join(roomDir, date.toString());
    const audioFilePath = path.join(roomDir, `${date}.wav`);
    const silenceDuration = userDateMap.get(socket.id) / 1000; // 무음으로 사용할 시간 (milliseconds)
    const outputFilePath = path.join(dateDir, 'merge.wav');

    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir);
    }

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir);
    }

    const silenceAudioFile = path.join(dateDir, `${date}_silence.wav`);
    const audioDataFile = path.join(dateDir, `${date}.wav`);

    if (silenceDuration > 0) {
      try {
        await createSilenceAudio(silenceAudioFile, silenceDuration);

        fs.writeFileSync(audioDataFile, Buffer.from(audioDataArrayBuffer));

        setTimeout(() => {
          const combinedAudio = ffmpeg()
            .input(silenceAudioFile)
            .input(audioDataFile)
            .complexFilter([
              '[0:a][1:a]concat=n=2:v=0:a=1[out]'
            ], ['out'])
            .output(audioFilePath)
            .on('end', () => {
              console.log('오디오 파일에 무음 데이터를 추가하고 저장했습니다.');
            })
            .on('error', (err) => {
              console.error('오디오 파일 처리 중 오류 발생:', err);
            });

          combinedAudio.run();
          setTimeout(() => {
            mixAudioFiles(roomDir);
          }, 20000);
        }, 10000);

      } catch (err) {
        console.error('무음 데이터 생성 중 오류 발생:', err);
      }
    } else {
      fs.writeFileSync(audioFilePath, Buffer.from(audioDataArrayBuffer));
      console.log("오디오 파일 저장 완료:", `${date}.wav`);
    }
  });


  const mixAudioFiles = (dateDir) => {
    const outputFilePath = path.join(dateDir, 'merge.wav');
    const inputFiles = fs.readdirSync(dateDir)
      .filter(file => file.endsWith('.wav') && file !== 'merge.wav');
  
    if (inputFiles.length < 2) {
      console.log('믹스할 충분한 WAV 파일이 없습니다.');
      return;
    }
  
    if (fs.existsSync(outputFilePath)) {
      console.log('기존 merge.wav 파일 삭제');
      fs.unlinkSync(outputFilePath);
    }
  
    const ffmpegCommand = ffmpeg();
  
    inputFiles.forEach(inputFile => {
      const inputPath = path.join(dateDir, inputFile);
      ffmpegCommand.input(inputPath);
    });
  
    ffmpegCommand
      .complexFilter(`amix=inputs=${inputFiles.length}:dropout_transition=2[out]`, ['out'])
      .audioCodec('pcm_s16le')
      .output(outputFilePath)
      .on('end', () => {
        console.log('오디오 파일을 믹스하여 merge.wav 파일을 생성했습니다.');
      })
      .on('error', (err) => {
        console.error('오디오 파일 믹스 중 오류 발생:', err);
      });
  
    ffmpegCommand.run();
  };


  



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

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
