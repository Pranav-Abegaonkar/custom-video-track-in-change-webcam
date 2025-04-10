// --- DOM Elements ---
const joinButton = document.getElementById("joinBtn");
const leaveButton = document.getElementById("leaveBtn");
const toggleMicButton = document.getElementById("toggleMicBtn");
const toggleWebCamButton = document.getElementById("toggleWebCamBtn");
const createButton = document.getElementById("createMeetingBtn");
const videoContainer = document.getElementById("videoContainer");
const textDiv = document.getElementById("textDiv");

// Device selection dropdowns (assumed to be present in the HTML)
const cameraSelect = document.getElementById("cameraSelect");
const micSelect = document.getElementById("micSelect");

// --- Variables ---
let meeting = null;
let meetingId = "";
let isMicOn = false;
let isWebCamOn = false;
// let TOKEN = "YOUR_TOKEN_HERE"; // Token defined in config.js

// --- Meeting Initialization Function ---
function initializeMeeting() {
  window.VideoSDK.config(TOKEN);

  meeting = window.VideoSDK.initMeeting({
    meetingId: meetingId, // required
    name: "Thomas Edison", // required
    micEnabled: true, // optional, default: true
    webcamEnabled: true, // optional, default: true
    // Optionally, you can pass a custom track during meeting initialization.
    // customCameraVideoTrack: customTrack,
  });

  meeting.join();

  // Create local participant display
  createLocalParticipant();

  // Set local participant stream on stream-enabled event
  meeting.localParticipant.on("stream-enabled", (stream) => {
    setTrack(stream, null, meeting.localParticipant, true);
  });

  // When meeting is joined, update the UI and populate device lists.
  meeting.on("meeting-joined", () => {
    textDiv.style.display = "none";
    document.getElementById("grid-screen").style.display = "block";
    document.getElementById("meetingIdHeading").textContent = `Meeting Id: ${meetingId}`;
    
    // Populate available devices once in the meeting
    populateDeviceList();
  });

  // When meeting is left, clear video container.
  meeting.on("meeting-left", () => {
    videoContainer.innerHTML = "";
  });

  // Remote participant joined
  meeting.on("participant-joined", (participant) => {
    let videoElement = createVideoElement(participant.id, participant.displayName);
    let audioElement = createAudioElement(participant.id);
    // Set remote stream when available
    participant.on("stream-enabled", (stream) => {
      setTrack(stream, audioElement, participant, false);
    });
    videoContainer.appendChild(videoElement);
    videoContainer.appendChild(audioElement);
  });

  // Remote participant left
  meeting.on("participant-left", (participant) => {
    let vElement = document.getElementById(`f-${participant.id}`);
    if (vElement) vElement.remove();

    let aElement = document.getElementById(`a-${participant.id}`);
    if (aElement) aElement.remove();
  });
}

// --- Utility Functions ---

// Create video element for a participant
function createVideoElement(pId, name) {
  let videoFrame = document.createElement("div");
  videoFrame.setAttribute("id", `f-${pId}`);

  // Create video element
  let videoElement = document.createElement("video");
  videoElement.classList.add("video-frame");
  videoElement.setAttribute("id", `v-${pId}`);
  videoElement.setAttribute("playsinline", true);
  videoElement.setAttribute("width", "300");
  videoFrame.appendChild(videoElement);

  let displayName = document.createElement("div");
  displayName.innerHTML = `Name: ${name}`;
  videoFrame.appendChild(displayName);

  return videoFrame;
}

// Create audio element for a participant
function createAudioElement(pId) {
  let audioElement = document.createElement("audio");
  audioElement.setAttribute("autoPlay", "false");
  audioElement.setAttribute("playsInline", "true");
  audioElement.setAttribute("controls", "false");
  audioElement.setAttribute("id", `a-${pId}`);
  audioElement.style.display = "none";
  return audioElement;
}

// Create local participant element
function createLocalParticipant() {
  let localParticipant = createVideoElement(
    meeting.localParticipant.id,
    meeting.localParticipant.displayName
  );
  videoContainer.appendChild(localParticipant);
}

// Set media track for video or audio stream
function setTrack(stream, audioElement, participant, isLocal) {
  if (stream.kind === "video") {
    isWebCamOn = true;
    const mediaStream = new MediaStream();
    mediaStream.addTrack(stream.track);
    let videoElm = document.getElementById(`v-${participant.id}`);
    videoElm.srcObject = mediaStream;
    videoElm.play().catch((error) =>
      console.error("videoElem.play() failed", error)
    );
  }
  if (stream.kind === "audio") {
    if (isLocal) {
      isMicOn = true;
    } else {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(stream.track);
      audioElement.srcObject = mediaStream;
      audioElement.play().catch((error) =>
        console.error("audioElem.play() failed", error)
      );
    }
  }
}

// --- Device Management Functions ---

// Use VideoSDK methods to list devices.
// getCameras() returns a Promise resolved with an Array of CameraDeviceInfo objects.
// getMicrophones() returns a Promise resolved with an Array of MicrophoneDeviceInfo objects.
async function populateDeviceList() {
  try {
    // Retrieve available video and audio input devices.
    const cameras = await window.VideoSDK.getCameras();
    const mics = await window.VideoSDK.getMicrophones();

    // Clear existing options (except the default placeholder)
    cameraSelect.querySelectorAll("option:not([value=''])").forEach(option => option.remove());
    micSelect.querySelectorAll("option:not([value=''])").forEach(option => option.remove());

    // Populate camera dropdown using each device's deviceId and label
    cameras.forEach((cam, index) => {
      const option = document.createElement("option");
      option.value = cam.deviceId;
      option.text = cam.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    // Populate microphone dropdown using each device's deviceId and label
    mics.forEach((mic, index) => {
      const option = document.createElement("option");
      option.value = mic.deviceId;
      option.text = mic.label || `Microphone ${index + 1}`;
      micSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching device list:", error);
  }
}

// Change the active camera using VideoSDK's changeWebcam method.
// This function creates a custom video track (using the selected cameraId)
// and then passes that custom track to participant.changeWebcam.
async function changeCamera(cameraId) {
  try {
    // Create a custom video track with the provided cameraId and settings.
    const customTrack = await VideoSDK.createCameraVideoTrack({
      cameraId: cameraId,
      optimizationMode: "motion",
      encoderConfig: "h720p_w1280p",
      facingMode: "environment",
      // multiStream can be omitted if using the default value (true)
    });
    // Call changeWebcam on the participant to switch to the new custom video track.
    await meeting.changeWebcam(customTrack);
  } catch (error) {
    console.error("Error switching webcam:", error);
  }
}

// Change the active microphone using VideoSDK's changeMic method.
async function changeMic(micId) {
  try {
    await meeting.changeMic(micId);
  } catch (error) {
    console.error("Error switching microphone:", error);
  }
}

// --- Event Listeners for Device Dropdowns ---

cameraSelect.addEventListener("change", (event) => {
  const selectedCameraId = event.target.value;
  if (selectedCameraId && meeting) {
    changeCamera(selectedCameraId);
  }
});

micSelect.addEventListener("change", (event) => {
  const selectedMicId = event.target.value;
  if (selectedMicId && meeting) {
    changeMic(selectedMicId);
  }
});

// --- Meeting Control Event Listeners ---

// Join Meeting button event listener
joinButton.addEventListener("click", async () => {
  document.getElementById("join-screen").style.display = "none";
  textDiv.textContent = "Joining the meeting...";
  meetingId = document.getElementById("meetingIdTxt").value;
  initializeMeeting();
});

// Create Meeting button event listener
createButton.addEventListener("click", async () => {
  document.getElementById("join-screen").style.display = "none";
  textDiv.textContent = "Please wait, we are joining the meeting";
  
  // API call to create a meeting room
  const url = `https://api.videosdk.live/v2/rooms`;
  const options = {
    method: "POST",
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  };

  const { roomId } = await fetch(url, options)
    .then((response) => response.json())
    .catch((error) => {
      alert("Error creating meeting: " + error);
      console.error(error);
    });
  meetingId = roomId;

  initializeMeeting();
});

// Leave Meeting button event listener
leaveButton.addEventListener("click", async () => {
  meeting?.leave();
  document.getElementById("grid-screen").style.display = "none";
  document.getElementById("join-screen").style.display = "block";
});

// Toggle Mic button event listener
toggleMicButton.addEventListener("click", async () => {
  if (isMicOn) {
    meeting?.muteMic();
  } else {
    meeting?.unmuteMic();
  }
  isMicOn = !isMicOn;
});

// Toggle WebCam button event listener
toggleWebCamButton.addEventListener("click", async () => {
  if (isWebCamOn) {
    meeting?.disableWebcam();
    let vElement = document.getElementById(`f-${meeting.localParticipant.id}`);
    if (vElement) vElement.style.display = "none";
  } else {
    meeting?.enableWebcam();
    let vElement = document.getElementById(`f-${meeting.localParticipant.id}`);
    if (vElement) vElement.style.display = "inline";
  }
  isWebCamOn = !isWebCamOn;
});
