const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const streamDiv = document.querySelector("#myStream");
const otherStreamDiv = document.querySelector("#otherStream");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendMessageForm = document.getElementById("sendMessageForm");


let myStream;
let isMuted = false; // 마이크 미소거 상태 초기화
let isCameraOn = false;
let roomName;
let audioStream; // 추가: 오디오 스트림 변수

// 서버에서 넘겨주는 Downlink를 처리하기 위한 Map
// Map<socketId, PeerConnection>
let recvPeerMap = new Map();

// 서버에 미디어 정보를 넘기기 위한 Peer
let sendPeer;

var nickname;

let mediaRecorder; // 수정: 미디어 레코더 초기화
const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const audioChunks = [];

// mediaRecorder 설정을 초기화합니다.
const initializeMediaRecorder = () => {
  mediaRecorder = new MediaRecorder(audioStream);
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

    socket.emit("audioData", audioBlob);

    audioChunks.length = 0;
  };
};

startRecordingButton.addEventListener("click", async () => {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    initializeMediaRecorder(); // 레코더 초기화

    mediaRecorder.start();
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
  } catch (error) {
    console.error("오디오 스트림 가져오기 오류:", error);
  }
});

stopRecordingButton.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    startRecordingButton.disabled = false;
    stopRecordingButton.disabled = true;
  }
});

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");

    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });

    console.log(cameras);
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraint = {
    audio: true,
    video: { facingMode: "user" },
  };

  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraint
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });
  if (isMuted) {
    muteBtn.innerText = "UnMute";
    isMuted = false;
  } else {
    muteBtn.innerText = "Mute";
    isMuted = true;
  }
}

function handleCameraClick() {
  myStream.getVideoTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });

  if (isCameraOn) {
    cameraBtn.innerText = "Turn Camera Off";
    isCameraOn = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    isCameraOn = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (sendPeer) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = sendPeer
      .getSenders()
      .find((sender) => sender.track.kind === "video");

    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)
const welcomeDiv = document.getElementById("welcome");
const callDiv = document.getElementById("call");
const chatDiv = document.getElementById("chat");

callDiv.hidden = true;
chatDiv.hidden = true;

async function initCall() {
  callDiv.hidden = false;
  chatDiv.hidden = false;
  welcomeDiv.hidden = true;
  await getMedia();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  console.log("roomName:", roomName); // 로그로 값 확인
  input.value = "";


  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    initializeMediaRecorder(); // 레코더 초기화
    mediaRecorder.start();
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
  } catch (error) {
    console.error("오디오 스트림 가져오기 오류:", error);
  }


}

const welcomeForm = welcomeDiv.querySelector("form");
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket code
socket.on("user_list", (idList) => {
  console.log("user_list = " + idList.toString());

  // 아이디 정보를 바탕으로 recvPeer를 생성한다.
  idList.forEach((id) => {
    createRecvPeer(id);
    createRecvOffer(id);
  });

  // sendPeer를 생성한다.
  createSendPeer();
  createSendOffer();
});

socket.on("nickname", (data) => {
  nickname = data;
  console.log("nickname : " + nickname);
});

socket.on("recvCandidate", async (candidate, sendId) => {
  console.log("got recvCandidate from server");
  recvPeerMap.get(sendId).addIceCandidate(candidate);
});

socket.on("sendCandidate", async (candidate) => {
  console.log("got sendCandidate from server");
  sendPeer.addIceCandidate(candidate);
});

socket.on("newStream", (id) => {
  console.log(`newStream id=${id}`);
  createRecvPeer(id);
  createRecvOffer(id);
});

socket.on("chatMessage", (message, sendId, ) => {
  const li = document.createElement("li");
  li.textContent = `${sendId} : ${message}`;
  chatMessages.appendChild(li);
});



sendMessageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatDiv.querySelector("#messageInput"); // "#messageInput"으로 변경해야 합니다.
  const value = input.value;
  socket.emit("new_message", value, roomName, () => {
    addMessage(`You : ${value}`);
  });
  input.value = "";
});



async function createSendOffer() {
  console.log(`createSendOffer`);
  const offer = await sendPeer.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: true,
  });

  sendPeer.setLocalDescription(offer);
  socket.emit("sendOffer", offer);
}

function createSendPeer() {
  sendPeer = new RTCPeerConnection({
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
    console.log(`sent sendCandidate to server`);
    socket.emit("sendCandidate", data.candidate);
  });

  if (myStream) {
    myStream.getTracks().forEach((track) => {
      sendPeer.addTrack(track, myStream);
    });

    console.log("add local stream");
  } else {
    console.log("no local stream");
  }
}

function createRecvPeer(sendId) {
  recvPeerMap.set(
    sendId,
    new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:global.stun.twilio.com:3478' }, // STUN 서버
        {
          urls: 'turn:global.turn.twilio.com:3478', // TURN 서버
          username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
          credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0',
        },
      ],
    })
  );

  recvPeerMap.get(sendId).addEventListener("icecandidate", (data) => {
    socket.emit("recvCandidate", data.candidate, sendId);
  });

  recvPeerMap.get(sendId).addEventListener("track", (data) => {
    data.streams[0].getAudioTracks().forEach((audioTrack) => {
      // 여기서 audioTrack은 각 사용자의 오디오 트랙입니다.
      // 필요에 따라 audioTrack을 처리하세요.
    });
  });



  // 카메라랑 마이크가 잘 가져와졌는지
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      devices.forEach(device => {
        console.log(device.kind + ": " + device.label +
          " id = " + device.deviceId);
      });
    })
    .catch(err => {
      console.log(err.name + ": " + err.message);
    });
}

async function createRecvOffer(sendId) {
  console.log(`createRecvOffer sendId = ${sendId}`);
  const offer = await recvPeerMap.get(sendId).createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: true,
  });

  recvPeerMap.get(sendId).setLocalDescription(offer);

  console.log(`send recvOffer to server`);
  socket.emit("recvOffer", offer, sendId);
}

socket.on("sendAnswer", async (answer) => {
  console.log("got sendAnswer from server");
  sendPeer.setRemoteDescription(answer);
});

socket.on("recvAnswer", async (answer, sendId) => {
  console.log("got recvAnswer from server");
  recvPeerMap.get(sendId).setRemoteDescription(answer);
});

socket.on("bye", (fromId) => {
  // 나간 유저의 정보를 없앤다.
  console.log("bye " + fromId);
  recvPeerMap.get(fromId).close();
  recvPeerMap.delete(fromId);

  let video = document.getElementById(`${fromId}`);
  otherStreamDiv.removeChild(video);

});

window.addEventListener('beforeunload', (event) => {
  // 녹음 중인 경우 녹음을 중지합니다.
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    startRecordingButton.disabled = false;
    stopRecordingButton.disabled = true;
  }
});


// RTC code
function handleTrack(data, sendId) {
  let video = document.getElementById(`${sendId}`);
  if (!video) {
    video = document.createElement("video");
    video.id = sendId;
    video.width = 300;
    video.height = 300;
    video.autoplay = true;
    video.playsInline = true;

    otherStreamDiv.appendChild(video);
  }

  console.log(`handleTrack from ${sendId}`);
  video.srcObject = data.streams[0];

  // 내 비디오의 볼륨 0
  if (video.id === "myFace") {
    video.volume = 0;
  }
}


function addMessage(message){
  const ul = chatDiv.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
}
