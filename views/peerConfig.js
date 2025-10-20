const callBtn = document.getElementById("callBtn");
const hangUpBtn = document.getElementById("hangUpBtn");
const localStreamElem = document.getElementById("localStream");
const remoteStreamElem = document.getElementById("remoteStream");

let localStream;
let pc; // PeerConnection

// 현재 페이지의 주소(origin)를 서버 URL로 사용합니다.
// 이렇게 하면 ngrok 주소가 바뀌어도 코드를 수정할 필요가 없습니다.
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/raspberry`);

// STUN 서버 설정 (Google 제공)
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let remotePeerId = "mobile"; // 기본 통화 상대
let iceCandidateQueue = []; // ICE Candidate를 임시 저장할 큐

// --- 발신자(Caller) 로직 ---
async function startCall() {
  console.log("통화 시작 (발신자)...");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamElem.srcObject = localStream;

    createPeerConnection();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log("Offer 생성 완료, 웹소켓으로 전송");
    ws.send(
      JSON.stringify({
        type: "offer",
        from: "raspberry",
        to: remotePeerId,
        sdp: offer,
      })
    );
  } catch (error) {
    console.error("통화 시작 중 오류:", error);
    alert("통화 연결에 실패했습니다: " + error.message);
    hangUpBtn.click();
  }
}

// --- 버튼 이벤트 핸들러 ---

callBtn.onclick = async () => {
  console.log("전화 받기 시작...");
  try {
    // 1. 로컬 미디어(카메라, 마이크) 가져오기
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamElem.srcObject = localStream;

    // 2. PeerConnection 생성 및 스트림 추가
    createPeerConnection();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // 이 함수는 수신자(Callee) 역할이므로, Offer를 받은 후에 호출됩니다.
    // 실제 Answer 생성 및 전송은 웹소켓 메시지 핸들러에서 처리합니다.
    // 여기서는 카메라를 켜고 대기 상태로 만드는 역할만 합니다.
    console.log("카메라 켜짐, 상대방의 Offer를 기다립니다.");

    console.log("연결 과정 완료.");
    callBtn.disabled = true;
    hangUpBtn.disabled = false;
  } catch (error) {
    console.error("전화 받기 과정 중 오류 발생:", error);
    alert("오류가 발생했습니다: " + error.message);
    hangUpBtn.click();
  }
};

// '끊기' 버튼 클릭 시
hangUpBtn.onclick = async () => {
  console.log("통화 종료 (라즈베리파이)");
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  localStreamElem.srcObject = null;
  remoteStreamElem.srcObject = null;

  // 상대방에게 통화 종료 알림
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({ type: "hangup", from: "raspberry", to: remotePeerId })
    );
  }

  // 페이지 새로고침하여 초기 상태로 돌아감
  window.location.href = "/raspberry";
};

// --- WebRTC 관련 함수 ---

function createPeerConnection() {
  pc = new RTCPeerConnection(configuration);

  pc.ontrack = (event) => {
    console.log("원격 스트림 수신");
    remoteStreamElem.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    console.log("연결 상태 변경:", pc.connectionState);
    if (
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "closed"
    ) {
      hangUpBtn.click();
    }
  };

  // ICE Candidate를 찾으면 상대방에게 즉시 전송 (Trickle ICE)
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(
        "라즈베리파이: ICE Candidate 발견, 전송합니다.",
        event.candidate
      );
      ws.send(
        JSON.stringify({
          type: "ice_candidate",
          from: "raspberry",
          to: remotePeerId,
          candidate: event.candidate,
        })
      );
    }
  };
}

// --- 웹소켓 메시지 핸들러 ---
ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  console.log("라즈베리파이 통화페이지: 메시지 수신", data.type);

  if (data.type === "offer") {
    if (!pc) {
      // '전화 받기'를 누르지 않았는데 Offer가 오면, 먼저 PeerConnection을 생성
      await callBtn.click();
    }
    remotePeerId = data.from;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(
      JSON.stringify({
        type: "answer",
        from: "raspberry",
        to: remotePeerId,
        sdp: answer,
      })
    );
    await processIceCandidateQueue(); // 대기열에 있던 ICE 처리
  } else if (data.type === "answer") {
    if (pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  } else if (data.type === "hangup") {
    hangUpBtn.click();
  } else if (data.type === "ice_candidate") {
    const candidate = new RTCIceCandidate(data.candidate);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      console.log("라즈베리파이: ICE Candidate 수신, 즉시 추가합니다.");
      await pc.addIceCandidate(candidate);
    } else {
      console.log(
        "라즈베리파이: 아직 RemoteDescription이 설정되지 않아 ICE Candidate를 대기열에 추가합니다."
      );
      iceCandidateQueue.push(candidate);
    }
  }
};

// --- 초기화 로직 ---
ws.onopen = () => {
  console.log("라즈베리파이 통화페이지: 웹소켓 연결됨.");
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("caller") === "true") {
    // 내가 발신자인 경우
    callBtn.style.display = "none"; // '전화 받기' 버튼 숨기기
    hangUpBtn.disabled = false;
    startCall(); // 발신 로직 시작
  } else {
    // 내가 수신자인 경우
    callBtn.disabled = false;
    hangUpBtn.disabled = true;
    // 사용자가 '전화 받기' 버튼을 누르거나, Offer 메시지를 받을 때까지 대기
  }
};

window.addEventListener("beforeunload", () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({ type: "hangup", from: "raspberry", to: remotePeerId })
    );
  }
  ws.close();
});

async function processIceCandidateQueue() {
  while (iceCandidateQueue.length > 0 && pc && pc.remoteDescription) {
    const candidate = iceCandidateQueue.shift();
    console.log("대기열에 있던 ICE Candidate를 추가합니다.", candidate);
    await pc.addIceCandidate(candidate);
  }
}
