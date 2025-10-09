const localStreamElement = document.querySelector("#localStream");
const remoteStreamElement = document.querySelector("#remoteStream");
const statusElement = document.querySelector("#status");

const startCamBtn = document.querySelector("#startCamBtn");
const callBtn = document.querySelector("#callBtn");
const waitBtn = document.querySelector("#waitBtn");
const hangUpBtn = document.querySelector("#hangUpBtn");

let localStream = undefined;
let pc = undefined;
let pollInterval; // Polling을 중지하기 위한 interval ID

const startCam = async () => {
  if (navigator.mediaDevices !== undefined) {
    hangUpBtn.disabled = true;
    statusElement.innerText = "Starting camera...";
    await navigator.mediaDevices
      .getUserMedia({ audio: false, video: true }) // 오디오는 비활성화
      .then(async (stream) => {
        console.log("Stream found");
        localStream = stream;
        localStreamElement.srcObject = localStream;

        // 버튼 활성화
        startCamBtn.disabled = true;
        if (callBtn) callBtn.disabled = false;
        if (waitBtn) waitBtn.disabled = false;
        statusElement.innerText = "Camera started. Ready to call or wait.";
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error);
        statusElement.innerText = `Error: ${error.message}`;
      });
  }
};
const createPeerConnection = () => {
  // 이전 연결이 있다면 정리
  if (pc) {
    pc.close();
  }
  const newPc = new RTCPeerConnection();
  try {
    newPc.addEventListener("icecandidate", onIceCandidate);
    newPc.addEventListener("track", onTrack);
    if (localStream !== undefined) {
      localStream.getTracks().forEach((track) => {
        newPc.addTrack(track, localStream);
      });
    }
    console.log("PeerConnection created");
  } catch (error) {
    console.error("PeerConnection failed: ", error);
  }
  return newPc;
};

const onIceCandidate = async (event) => {
  if (event.candidate) {
    console.log("ICE candidate generated. Add this to remote peer.");
    // Trickle ICE가 아닌, 모든 Candidate가 수집된 후 SDP에 포함하여 한번에 보내는 방식
  }
};

const onTrack = (event) => {
  console.log("Track received");
  statusElement.innerText = "Connected!";
  if (hangUpBtn) hangUpBtn.disabled = false;
  remoteStreamElement.srcObject = event.streams[0];
  clearInterval(pollInterval); // 연결 성공 시 Polling 중지
};

// --- Mobile (Caller) Logic ---
const startCall = async () => {
  console.log("Starting call...");
  statusElement.innerText = "Creating Offer...";
  if (callBtn) callBtn.disabled = true;
  if (waitBtn) waitBtn.disabled = true;
  if (hangUpBtn) hangUpBtn.disabled = false;

  // 1. Reset server state
  await fetch("/reset", { method: "POST" });

  // 2. Create PeerConnection and Offer
  pc = createPeerConnection();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 3. Wait for ICE gathering to complete
  await new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
    } else {
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        }
      });
    }
  });

  // 4. Send offer to server
  console.log("Sending offer...");
  statusElement.innerText = "Sending Offer...";
  await fetch("/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pc.localDescription),
  });

  // 5. Poll for answer
  console.log("Waiting for answer...");
  statusElement.innerText = "Waiting for Answer...";
  pollInterval = setInterval(async () => {
    const response = await fetch("/answer");
    const answer = await response.json();
    if (answer) {
      clearInterval(pollInterval);
      console.log("Answer received.");
      statusElement.innerText = "Answer received, connecting...";
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, 2000); // 2초마다 확인
};

// --- Raspberry Pi (Receiver) Logic ---
const waitForCall = () => {
  console.log("Waiting for call...");
  statusElement.innerText = "Waiting for Offer...";
  if (callBtn) callBtn.disabled = true;
  if (waitBtn) waitBtn.disabled = true;
  if (hangUpBtn) hangUpBtn.disabled = false;

  // 1. Poll for offer
  pollInterval = setInterval(async () => {
    const response = await fetch("/offer");
    const offer = await response.json();
    if (offer) {
      clearInterval(pollInterval);
      console.log("Offer received.");
      statusElement.innerText = "Offer received, creating Answer...";
      if (hangUpBtn) hangUpBtn.disabled = false;

      // 2. Create PeerConnection and Answer
      pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 3. Wait for ICE gathering to complete
      await new Promise((resolve) => {
        if (pc.iceGatheringState === "complete") resolve();
        else
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") resolve();
          });
      });

      // 4. Send answer to server
      console.log("Sending answer...");
      statusElement.innerText = "Sending Answer...";
      await fetch("/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pc.localDescription),
      });
    }
  }, 2000); // 2초마다 확인
};

// --- Hang Up Logic ---
const hangUp = async () => {
  console.log("Hanging up...");
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  // Reset server state
  await fetch("/reset", { method: "POST" });
  console.log("Call ended and resources released.");

  // Redirect to the initial page
  if (window.location.pathname.includes("mobile")) {
    window.location.href = "/mobile";
  } else if (window.location.pathname.includes("raspberry")) {
    window.location.href = "/raspberry";
  }
};

// Event Listeners
startCamBtn.addEventListener("click", startCam);
if (callBtn) callBtn.addEventListener("click", startCall);
if (waitBtn) waitBtn.addEventListener("click", waitForCall);
if (hangUpBtn) hangUpBtn.addEventListener("click", hangUp);
