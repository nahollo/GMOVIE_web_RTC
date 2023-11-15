"use strict";

var socket = io();
var myFace = document.getElementById("myFace");
var muteBtn = document.getElementById("mute");
var cameraBtn = document.getElementById("camera");
var camerasSelect = document.getElementById("cameras");
var streamDiv = document.querySelector("#myStream");
var otherStreamDiv = document.querySelector("#otherStream");
var endRoomBtn = document.getElementById("endRoom");
var boomBtn = document.getElementById("boom");
var joinRoomBtn = document.getElementById("joinRoom");
var createRoomBtn = document.getElementById("createRoom");
var welcomeForm = document.querySelector("#welcome");
var footerDiv = document.querySelector("#footer-wrapper");
var roomNameDiv = document.getElementById("roomName");
var startShareBtn = document.getElementById("startShareBtn");
var stopShareBtn = document.getElementById("stopShareBtn");
var myStream;
var isMuted = false; // 마이크 미소거 상태 초기화

var isCameraOn = false;
var roomName;
var audioStream; // 추가: 오디오 스트림 변수
// 서버에서 넘겨주는 Downlink를 처리하기 위한 Map
// Map<socketId, PeerConnection>

var recvPeerMap = new Map(); // 서버에 미디어 정보를 넘기기 위한 Peer

var sendPeer;
var nickname;
var mediaRecorder; // 수정: 미디어 레코더 초기화

var audioChunks = [];
var isScreenSharing = false; // mediaRecorder 설정을 초기화합니다.

var initializeMediaRecorder = function initializeMediaRecorder() {
  mediaRecorder = new MediaRecorder(audioStream);

  mediaRecorder.ondataavailable = function (event) {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = function () {
    var audioData = new Blob(audioChunks, {
      type: "audio/wav"
    });
    var reader = new FileReader();

    reader.onload = function () {
      var audioArrayBuffer = reader.result;
      socket.emit("audioData", audioArrayBuffer);
    };

    reader.readAsArrayBuffer(audioData);
    audioChunks.length = 0;
  };
};

function getCameras() {
  var devices, cameras, currentCamera;
  return regeneratorRuntime.async(function getCameras$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(navigator.mediaDevices.enumerateDevices());

        case 3:
          devices = _context.sent;
          cameras = devices.filter(function (device) {
            return device.kind === "videoinput";
          });
          currentCamera = myStream.getVideoTracks()[0];
          cameras.forEach(function (camera) {
            var option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;

            if (currentCamera.label === camera.label) {
              option.selected = true;
            }

            camerasSelect.appendChild(option);
          });
          console.log(cameras);
          _context.next = 13;
          break;

        case 10:
          _context.prev = 10;
          _context.t0 = _context["catch"](0);
          console.log(_context.t0);

        case 13:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 10]]);
}

function getMedia(deviceId) {
  var initialConstraint, cameraConstraints;
  return regeneratorRuntime.async(function getMedia$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          initialConstraint = {
            audio: true,
            video: {
              facingMode: "user"
            }
          };
          cameraConstraints = {
            audio: true,
            video: {
              deviceId: {
                exact: deviceId
              }
            }
          };
          _context2.next = 4;
          return regeneratorRuntime.awrap(navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstraint));

        case 4:
          myStream = _context2.sent;
          myFace.srcObject = myStream;

          if (deviceId) {
            _context2.next = 9;
            break;
          }

          _context2.next = 9;
          return regeneratorRuntime.awrap(getCameras());

        case 9:
        case "end":
          return _context2.stop();
      }
    }
  });
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach(function (track) {
    track.enabled = !track.enabled;
  });

  if (isMuted) {
    muteBtn.innerHTML = '<img src="img/micOn.png" width="40" height="40">';
    muteBtn.style.backgroundColor = "#D6D6D6";
    isMuted = false;
  } else {
    muteBtn.innerHTML = '<img src="img/micOff.png" width="40" height="40">';
    muteBtn.style.backgroundColor = "#909090";
    isMuted = true;
  }
}

function handleCameraClick() {
  myStream.getVideoTracks().forEach(function (track) {
    track.enabled = !track.enabled;
  });

  if (isCameraOn) {
    cameraBtn.innerHTML = '<img src="img/camOn.png" width="40" height="40">';
    cameraBtn.style.backgroundColor = "#D6D6D6";
    isCameraOn = false;
  } else {
    cameraBtn.innerHTML = '<img src="img/camOff.png" width="40" height="40">';
    cameraBtn.style.backgroundColor = "#909090";
    isCameraOn = true;
  }
}

function handleCameraChange() {
  var videoTrack, videoSender;
  return regeneratorRuntime.async(function handleCameraChange$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(getMedia(camerasSelect.value));

        case 2:
          if (sendPeer) {
            videoTrack = myStream.getVideoTracks()[0];
            videoSender = sendPeer.getSenders().find(function (sender) {
              return sender.track.kind === "video";
            });
            videoSender.replaceTrack(videoTrack);
          }

        case 3:
        case "end":
          return _context3.stop();
      }
    }
  });
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
startShareBtn.addEventListener("click", startScreenShare);
stopShareBtn.addEventListener("click", stopScreenShare); // Welcome Form (join a room)

var welcomeDiv = document.getElementById("welcome");
var callDiv = document.getElementById("call");
callDiv.hidden = true;
boomBtn.hidden = true;

function initCall() {
  return regeneratorRuntime.async(function initCall$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          callDiv.hidden = false;
          welcomeDiv.hidden = true;
          footerDiv.hidden = true;
          _context4.next = 5;
          return regeneratorRuntime.awrap(getMedia());

        case 5:
        case "end":
          return _context4.stop();
      }
    }
  });
}

function handleWelcome(event) {
  var input, myDate;
  return regeneratorRuntime.async(function handleWelcome$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          event.preventDefault();
          input = welcomeForm.querySelector("input");
          _context5.next = 4;
          return regeneratorRuntime.awrap(initCall());

        case 4:
          endRoomBtn.style.display = "inline-block";
          myDate = new Date();
          socket.emit("join_room", input.value, myDate.getTime());
          roomName = input.value;
          console.log("roomName:", roomName); // 로그로 값 확인

          input.value = "";
          _context5.next = 12;
          return regeneratorRuntime.awrap(navigator.mediaDevices.getUserMedia({
            audio: true
          }));

        case 12:
          audioStream = _context5.sent;
          initializeMediaRecorder(); // 레코더 초기화

          mediaRecorder.start();

        case 15:
        case "end":
          return _context5.stop();
      }
    }
  });
}

function handleCreateNewRoom(event) {
  var roomName, startDate;
  return regeneratorRuntime.async(function handleCreateNewRoom$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          event.preventDefault();
          roomName = "".concat(Math.floor(100 + Math.random() * 900), "-").concat(Math.floor(100 + Math.random() * 900), "-").concat(Math.floor(1000 + Math.random() * 9000));
          _context6.next = 4;
          return regeneratorRuntime.awrap(initCall());

        case 4:
          startDate = new Date();
          socket.emit("join_room", roomName, startDate.getTime());
          console.log("roomName:", roomName);
          roomNameDiv.innerText = "\uD68C\uC758 \uCF54\uB4DC : ".concat(roomName);
          callDiv.appendChild(roomNameDiv);
          boomBtn.style.display = "inline-block";
          _context6.next = 12;
          return regeneratorRuntime.awrap(navigator.mediaDevices.getUserMedia({
            audio: true
          }));

        case 12:
          audioStream = _context6.sent;
          initializeMediaRecorder();
          mediaRecorder.start();

        case 15:
        case "end":
          return _context6.stop();
      }
    }
  });
}

joinRoomBtn.addEventListener("click", handleWelcome);
createRoomBtn.addEventListener("click", handleCreateNewRoom);
socket.on("user_list", function (idList) {
  console.log("user_list = " + idList.toString()); // 아이디 정보를 바탕으로 recvPeer를 생성한다.

  idList.forEach(function (id) {
    createRecvPeer(id);
    createRecvOffer(id);
  }); // sendPeer를 생성한다.

  createSendPeer();
  createSendOffer();
});
socket.on("nickname", function (data) {
  nickname = data;
  console.log("nickname : " + nickname);
});
socket.on("recvCandidate", function _callee(candidate, sendId) {
  return regeneratorRuntime.async(function _callee$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          console.log("got recvCandidate from server");
          recvPeerMap.get(sendId).addIceCandidate(candidate);

        case 2:
        case "end":
          return _context7.stop();
      }
    }
  });
});
socket.on("sendCandidate", function _callee2(candidate) {
  return regeneratorRuntime.async(function _callee2$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          console.log("got sendCandidate from server");
          sendPeer.addIceCandidate(candidate);

        case 2:
        case "end":
          return _context8.stop();
      }
    }
  });
});
socket.on("newStream", function (id) {
  console.log("newStream id=".concat(id));
  createRecvPeer(id);
  createRecvOffer(id);
}); // DB에서 가져온 userName

socket.on("userNo_Name", function (userName) {
  console.log('서버로부터 받은 사용자 이름 : ' + userName);
});
endRoomBtn.addEventListener("click", function () {
  endRoomBtn.style.display = "none";
  boomBtn.style.display = "none"; // 1. 녹음 중지

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } // 2. 서버에 회의방 퇴장 이벤트 보내기


  socket.emit("leaveRoom", roomName); // roomName은 현재 회의방 이름입니다.
  // 3. 카메라와 비디오 끄기

  myStream.getTracks().forEach(function (track) {
    track.stop(); // 각 트랙을 정지합니다.
  });
  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.
  // 4. (옵션) UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화

  callDiv.hidden = true;
  welcomeDiv.hidden = false;
  footerDiv.hidden = false;
});

function createSendOffer() {
  var offer;
  return regeneratorRuntime.async(function createSendOffer$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          console.log("createSendOffer");
          _context9.next = 3;
          return regeneratorRuntime.awrap(sendPeer.createOffer({
            offerToReceiveVideo: false,
            offerToReceiveAudio: false
          }));

        case 3:
          offer = _context9.sent;
          sendPeer.setLocalDescription(offer);
          socket.emit("sendOffer", offer);

        case 6:
        case "end":
          return _context9.stop();
      }
    }
  });
}

function createSendPeer() {
  sendPeer = new RTCPeerConnection({
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
    console.log("sent sendCandidate to server");
    socket.emit("sendCandidate", data.candidate);
  });

  if (myStream) {
    myStream.getTracks().forEach(function (track) {
      sendPeer.addTrack(track, myStream);
    });
    console.log("add local stream");
  } else {
    console.log("no local stream");
  }
}

function createRecvPeer(sendId) {
  recvPeerMap.set(sendId, new RTCPeerConnection({
    iceServers: [{
      urls: 'stun:global.stun.twilio.com:3478'
    }, // STUN 서버
    {
      urls: 'turn:global.turn.twilio.com:3478',
      // TURN 서버
      username: 'SKdbaf9b2bdc6c41f2fee12f5adf6bd89c',
      credential: 'kwYx7NoafMW2pulCyFAaWJ43AGzLMGM0'
    }]
  }));
  console.log("hi hello");
  recvPeerMap.get(sendId).addEventListener("icecandidate", function (data) {
    socket.emit("recvCandidate", data.candidate, sendId);
  });
  recvPeerMap.get(sendId).addEventListener("track", function (data) {
    handleTrack(data, sendId);
  });
}

function createRecvOffer(sendId) {
  var offer;
  return regeneratorRuntime.async(function createRecvOffer$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          console.log("createRecvOffer sendId = ".concat(sendId));
          _context10.next = 3;
          return regeneratorRuntime.awrap(recvPeerMap.get(sendId).createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true
          }));

        case 3:
          offer = _context10.sent;
          recvPeerMap.get(sendId).setLocalDescription(offer);
          console.log("send recvOffer to server");
          socket.emit("recvOffer", offer, sendId);

        case 7:
        case "end":
          return _context10.stop();
      }
    }
  });
}

function startScreenShare() {
  var screenStream, shareInfo, videoTrack, myVideo, webcamTrack, screenSender;
  return regeneratorRuntime.async(function startScreenShare$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          _context11.prev = 0;
          _context11.next = 3;
          return regeneratorRuntime.awrap(navigator.mediaDevices.getDisplayMedia());

        case 3:
          screenStream = _context11.sent;
          shareInfo = {
            roomName: roomName,
            screenStream: screenStream
          };
          socket.emit("startScreenShare", shareInfo);
          videoTrack = screenStream.getVideoTracks()[0];
          screenStream.addTrack(videoTrack);
          myVideo = document.getElementById("myFace");
          myVideo.srcObject = screenStream;
          webcamTrack = myStream.getVideoTracks()[0];
          myStream.removeTrack(webcamTrack);
          myStream.addTrack(videoTrack);
          screenSender = sendPeer.getSenders().find(function (sender) {
            return sender.track.kind === "video";
          });
          screenSender.replaceTrack(videoTrack); // Update the screen sharing status

          isScreenSharing = true; // Show/hide buttons based on the screen sharing status

          startShareBtn.style.display = "none";
          stopShareBtn.style.display = "inline-block";
          _context11.next = 23;
          break;

        case 20:
          _context11.prev = 20;
          _context11.t0 = _context11["catch"](0);
          console.error("Error starting screen share:", _context11.t0);

        case 23:
        case "end":
          return _context11.stop();
      }
    }
  }, null, null, [[0, 20]]);
}

function stopScreenShare() {
  var deviceId, initialConstraint, cameraConstraints, screenTrack, videoTrack, videoSender;
  return regeneratorRuntime.async(function stopScreenShare$(_context12) {
    while (1) {
      switch (_context12.prev = _context12.next) {
        case 0:
          _context12.prev = 0;
          socket.emit("stopScreenShare", roomName);
          deviceId = camerasSelect.value;
          initialConstraint = {
            audio: true,
            video: {
              facingMode: "user"
            }
          };
          cameraConstraints = {
            audio: true,
            video: {
              deviceId: {
                exact: deviceId
              }
            }
          }; // 화면 공유 중인 비디오 트랙 제거

          screenTrack = myStream.getVideoTracks()[0];
          screenTrack.stop();
          myStream.removeTrack(screenTrack); // 웹캠 비디오 트랙 다시 얻어오기

          _context12.next = 10;
          return regeneratorRuntime.awrap(navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstraint));

        case 10:
          myStream = _context12.sent;
          myFace.srcObject = myStream; // 웹캠 비디오 트랙을 PeerConnection에 추가

          videoTrack = myStream.getVideoTracks()[0];
          videoSender = sendPeer.getSenders().find(function (sender) {
            return sender.track.kind === "video";
          });
          videoSender.replaceTrack(videoTrack); // Update the screen sharing status

          isScreenSharing = false; // Show/hide buttons based on the screen sharing status

          startShareBtn.style.display = "inline-block";
          stopShareBtn.style.display = "none";
          _context12.next = 23;
          break;

        case 20:
          _context12.prev = 20;
          _context12.t0 = _context12["catch"](0);
          console.error("Error in stopScreenShare:", _context12.t0);

        case 23:
        case "end":
          return _context12.stop();
      }
    }
  }, null, null, [[0, 20]]);
}

startShareBtn.style.display = isScreenSharing ? "none" : "inline-block";
stopShareBtn.style.display = isScreenSharing ? "inline-block" : "none";
socket.on("sendAnswer", function _callee3(answer) {
  return regeneratorRuntime.async(function _callee3$(_context13) {
    while (1) {
      switch (_context13.prev = _context13.next) {
        case 0:
          console.log("got sendAnswer from server");
          sendPeer.setRemoteDescription(answer);

        case 2:
        case "end":
          return _context13.stop();
      }
    }
  });
});
socket.on("recvAnswer", function _callee4(answer, sendId) {
  return regeneratorRuntime.async(function _callee4$(_context14) {
    while (1) {
      switch (_context14.prev = _context14.next) {
        case 0:
          console.log("got recvAnswer from server");
          recvPeerMap.get(sendId).setRemoteDescription(answer);

        case 2:
        case "end":
          return _context14.stop();
      }
    }
  });
});
socket.on("bye", function (fromId) {
  // 나간 유저의 정보를 없앤다.
  console.log("bye " + fromId);
  recvPeerMap.get(fromId).close();
  recvPeerMap["delete"](fromId);
  var video = document.getElementById("".concat(fromId));
  otherStreamDiv.removeChild(video);
});
boomBtn.addEventListener("click", function () {
  endRoomBtn.style.display = "none";
  boomBtn.style.display = "none"; // 1. 녹음 중지

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } // 2. 서버에 회의방 퇴장 이벤트 보내기


  socket.emit("leaveRoom", roomName); // roomName은 현재 회의방 이름입니다.

  callDiv.removeChild(roomNameDiv);
  recvPeerMap.forEach(function (recvPeer, sendId) {
    var videoElement = document.getElementById(sendId);

    if (videoElement) {
      otherStreamDiv.removeChild(videoElement);
    }
  }); // 3. 카메라와 비디오 끄기

  myStream.getTracks().forEach(function (track) {
    track.stop(); // 각 트랙을 정지합니다.
  });
  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.
  // 4. (옵션) UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화

  callDiv.hidden = true;
  welcomeDiv.hidden = false;
  footerDiv.hidden = false; // 5. 서버에 병합 이벤트 보내기

  socket.emit("boom");
});
socket.on("exit_all", function () {
  // 1. 녹음 중지
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  roomName = "";
  alert("회의가 종료됐습니다."); // 모든 비디오 엘리먼트 제거

  recvPeerMap.forEach(function (recvPeer, sendId) {
    var videoElement = document.getElementById(sendId);

    if (videoElement) {
      otherStreamDiv.removeChild(videoElement);
    }

    recvPeer.close(); // 해당 PeerConnection도 닫아줍니다.
  });
  recvPeerMap.clear(); // Map을 비워줍니다.
  // 카메라와 비디오 끄기

  myStream.getTracks().forEach(function (track) {
    track.stop(); // 각 트랙을 정지합니다.
  });
  myFace.srcObject = null; // 화면에서 비디오 스트림을 제거합니다.
  // UI에서 회의방 관련 엘리먼트를 숨김 또는 초기화

  callDiv.hidden = true;
  welcomeDiv.hidden = false;
  footerDiv.hidden = false;
});
window.addEventListener('beforeunload', function (event) {
  // 녹음 중인 경우 녹음을 중지합니다.
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});
var inputField = welcomeForm.querySelector("input");
inputField.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    var inputValue = inputField.value.replace(/ /g, ''); // 모든 공백 문자를 제거하여 확인합니다.

    if (inputValue) {
      joinRoomBtn.click();
    }
  }
});

function handleTrack(data, sendId) {
  var video = document.getElementById("".concat(sendId));

  if (!video) {
    video = document.createElement("video");
    video.id = sendId;
    video.width = 250;
    video.height = 188;
    video.autoplay = true;
    video.playsInline = true;
    video.style.border = "1px solid #000";
    otherStreamDiv.appendChild(video);
  }

  console.log("handleTrack from ".concat(sendId));
  video.srcObject = data.streams[0];

  if (video.id === "myFace") {
    video.volume = 0;
  }
}