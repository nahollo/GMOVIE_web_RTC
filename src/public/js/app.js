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
const endRoomBtn = document.getElementById("endRoom");
const boomBtn = document.getElementById("boom");
const joinRoomBtn = document.getElementById("joinRoom");
const createRoomBtn = document.getElementById("createRoom");
const welcomeForm = document.querySelector("#welcome");


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
const audioChunks = [];
const roomNameDiv = document.createElement("div");

// mediaRecorder 설정을 초기화합니다.
const initializeMediaRecorder = () => {
  mediaRecorder = new MediaRecorder(audioStream);
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };
  mediaRecorder.onstop = () => {
    const audioData = new Blob(audioChunks, { type: "audio/wav" });

    const reader = new FileReader();
    reader.onload = () => {
        const audioArrayBuffer = reader.result;
        socket.emit("audioData", audioArrayBuffer);
    };

    reader.readAsArrayBuffer(audioData);

    audioChunks.length = 0;
};

};

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
  myStream = await navigator.mediaDevices.getUserMedia(
    deviceId ? cameraConstraints : initialConstraint
  );
  myFace.srcObject = myStream;
  if (!deviceId) {
    await getCameras();
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
boomBtn.hidden = true;

async function initCall() {
  callDiv.hidden = false;
  chatDiv.hidden = false;
  welcomeDiv.hidden = true;
  await getMedia();
}

async function handleWelcome(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  
  const myDate = new Date();
  socket.emit("join_room", input.value, myDate.getTime());
  roomName = input.value;
  console.log("roomName:", roomName); // 로그로 값 확인
  input.value = "";
  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  initializeMediaRecorder(); // 레코더 초기화
  mediaRecorder.start();
}

async function handleCreateNewRoom(event) {
  event.preventDefault();
  endRoomBtn.hidden = true;
  boomBtn.hidden = false;
  const roomName = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
  await initCall();
  const startDate = new Date();
  socket.emit("join_room", roomName, startDate.getTime());
  console.log("roomName:", roomName);
  roomNameDiv.textContent = `회의 코드 : ${roomName}`;
  callDiv.appendChild(roomNameDiv);

  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  initializeMediaRecorder();
  mediaRecorder.start();
}

joinRoomBtn.addEventListener("click", handleWelcome);
createRoomBtn.addEventListener("click", handleCreateNewRoom);

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

socket.on("chatMessage", (message, sendId,) => {
  const li = document.createElement("li");
  li.textContent = `${message}`;
  chatMessages.appendChild(li);
});

// DB에서 가져온 userName
socket.on("userNo_Name", (userName) => {
  console.log('서버로부터 받은 사용자 이름 : ' + userName);
});


sendMessageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatDiv.querySelector("#messageInput");
  const value = input.value;
  socket.emit("new_message", value, roomName, () => {
    addMessage(`You : ${value}`);
  });
  input.value = "";
});

endRoomBtn.addEventListener("click", () => {
  // 1. 녹음 중지
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  // 2. 서버에 회의방 퇴장 이벤트 보내기
  socket.emit("leaveRoom", roomName); // roomName은 현재 회의방 이름입니다.

  // 3. 카메라와 비디오 끄기
  myStream.getTracks().forEach((track) => {
    track.stop(); // 각 트랙을 정지합니다.
  });
  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.

  // 4. (옵션) UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화
  callDiv.hidden = true;
  chatDiv.hidden = true;
  welcomeDiv.hidden = false;
});

async function createSendOffer() {
  console.log(`createSendOffer`);
  const offer = await sendPeer.createOffer({
    offerToReceiveVideo: false,
    offerToReceiveAudio: false,
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
  console.log("hi hello");

  recvPeerMap.get(sendId).addEventListener("icecandidate", (data) => {
    socket.emit("recvCandidate", data.candidate, sendId);
  });
  recvPeerMap.get(sendId).addEventListener("track", (data) => {
    handleTrack(data, sendId);
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

boomBtn.addEventListener("click", () => {


  // 1. 녹음 중지
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  // 2. 서버에 회의방 퇴장 이벤트 보내기
  socket.emit("leaveRoom", roomName); // roomName은 현재 회의방 이름입니다.
  callDiv.removeChild(roomNameDiv);
  recvPeerMap.forEach((recvPeer, sendId) => {
    const videoElement = document.getElementById(sendId);
    if (videoElement) {
      otherStreamDiv.removeChild(videoElement);
    }
  });
  // 3. 카메라와 비디오 끄기
  myStream.getTracks().forEach((track) => {
    track.stop(); // 각 트랙을 정지합니다.
  });
  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.
  // 4. (옵션) UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화
  callDiv.hidden = true;
  chatDiv.hidden = true;
  welcomeDiv.hidden = false;
  // 5. 서버에 병합 이벤트 보내기
  socket.emit("boom");
});
socket.on("exit_all", () => {
  // 1. 녹음 중지
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  roomName = "";

  alert("회의가 종료됐습니다.");

  // 모든 비디오 엘리먼트 제거
  recvPeerMap.forEach((recvPeer, sendId) => {
    const videoElement = document.getElementById(sendId);
    if (videoElement) {
      otherStreamDiv.removeChild(videoElement);
    }
    recvPeer.close(); // 해당 PeerConnection도 닫아줍니다.
  });

  recvPeerMap.clear(); // Map을 비워줍니다.


  // 카메라와 비디오 끄기
  myStream.getTracks().forEach((track) => {
    track.stop(); // 각 트랙을 정지합니다.
  });

  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.


  // UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화
  callDiv.hidden = true;
  chatDiv.hidden = true;
  welcomeDiv.hidden = false;
});


window.addEventListener('beforeunload', (event) => {
  // 녹음 중인 경우 녹음을 중지합니다.
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

const inputField = welcomeForm.querySelector("input");

inputField.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const inputValue = inputField.value.replace(/ /g, ''); // 모든 공백 문자를 제거하여 확인합니다.
    if (inputValue) {
      joinRoomBtn.click();
    }
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

  if (video.id === "myFace") {
    video.volume = 0;
  }
}


function addMessage(message) {
  const ul = chatDiv.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
}