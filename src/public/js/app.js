const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");


let myStream;
let muted = false;
let cameraOff = false;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            camerasSelect.appendChild(option);
        })
    } catch (e) {
        console.log(e)
    }
}

async function getMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        myFace.srcObject = myStream;
        await getCameras();
    } catch (e) {
        console.log(e);
    }
}

getMedia();

function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
        muteBtn.innerText = "음소거 　풀기"
        muted = true;
    } else {
        muteBtn.innerText = "마이크 음소거"
        muted = false;
    }
}
function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
        cameraBtn.innerText = "카메라 켜기"
        cameraOff = false;
    } else {
        cameraBtn.innerText = "카메라 끄기"
        cameraOff = true;
    }
}

muteBtn.addEventListener("click", handleMuteClick); // 음소거
cameraBtn.addEventListener("click", handleCameraClick); // 카메라