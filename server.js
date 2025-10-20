import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

const app = express();
const PORT = 8080;

// SDP Offer와 Answer를 임시 저장할 인메모리 객체
let sdpStore = {
  offer: null,
  answer: null,
};

// 통화 상태를 관리하는 객체 ('idle', 'calling', 'ringing')
let callState = { status: "idle", caller: null, callee: null };

app.set("view engine", "ejs");
app.use(express.static("views")); // peerConfig.js 같은 정적 파일을 제공하기 위해 추가
app.use(express.json()); // JSON 요청 본문을 파싱하기 위해 추가

// CORS 설정
app.use(cors({ origin: "*", credentials: true }));

const server = app.listen(PORT, () => {
  console.log(
    `[서버 시작] ${PORT}번 포트에서 영상통화 시그널링 서버가 시작되었습니다.`
  );
});

// --- 웹소켓 서버 설정 ---
const wss = new WebSocketServer({ server });
const clients = new Map(); // 연결된 클라이언트를 관리

wss.on("connection", (ws, req) => {
  // URL에서 클라이언트 ID (mobile 또는 raspberry)를 추출
  const clientId = req.url.substring(1);
  if (clientId) {
    clients.set(clientId, ws);
    console.log(`[웹소켓] ${clientId} 클라이언트가 연결되었습니다.`);
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    console.log(`[웹소켓] 메시지 수신 from ${data.from}:`, data.type);

    const targetClient = clients.get(data.to);
    if (targetClient && targetClient.readyState === WebSocket.OPEN) {
      // 메시지를 목표 클라이언트에게 그대로 전달 (중계)
      targetClient.send(JSON.stringify(data));
      console.log(`  -> ${data.to}에게 메시지 전달 완료.`);
    } else {
      console.log(
        `  -> ${data.to} 클라이언트를 찾을 수 없거나 연결이 끊겼습니다.`
      );
    }
  });

  ws.on("close", () => {
    // 연결이 끊긴 클라이언트 제거
    for (const [id, clientWs] of clients.entries()) {
      if (clientWs === ws) {
        clients.delete(id);
        console.log(`[웹소켓] ${id} 클라이언트 연결이 끊겼습니다.`);
        break;
      }
    }
  });
});

// --- 페이지 렌더링 ---

// 기본 랜딩 페이지 (기기 선택)
app.get("/", (req, res) => {
  console.log(`[페이지 요청] 기기 선택 페이지(/)로 접근했습니다.`);
  res.render("index.ejs");
});

// 라즈베리파이 페이지
app.get("/raspberry", (req, res) => {
  console.log(`[페이지 요청] 라즈베리파이 페이지(/raspberry)로 접근했습니다.`);
  // 이제 웹소켓으로 상태를 전달하므로, 항상 인덱스 페이지를 렌더링합니다.
  // 통화 수신 시 클라이언트 측에서 페이지를 전환합니다.
  res.render("raspberrypi_index.ejs", { now: new Date() });
});

// 모바일 페이지
app.get("/mobile", (req, res) => {
  console.log(`[페이지 요청] 모바일 페이지(/mobile)로 접근했습니다.`);
  // 모바일로 전화가 오고 있는 경우, 수신 페이지로 이동
  if (callState.status === "ringing" && callState.callee === "mobile") {
    // 이 로직은 유지하여 새로고침 시에도 수신 화면을 보여줄 수 있습니다.
    res.render("mobile_receive.ejs");
  } else {
    res.render("mobile_index.ejs");
  }
});

// 모바일 통화 화면
app.get("/mobileCall", (req, res) => {
  console.log(`[페이지 요청] 모바일 통화 화면(/mobileCall)으로 진입합니다.`);
  res.render("mobile.ejs");
});

// 라즈베리파이 통화 화면
app.get("/raspberryCall", (req, res) => {
  console.log(
    `[페이지 요청] 라즈베리파이 통화 화면(/raspberryCall)으로 진입합니다.`
  );
  res.render("raspberry.ejs");
});

// 웹소켓을 사용하므로 기존의 SDP 교환 및 상태 관리 API는 더 이상 필요하지 않습니다.
// /reset API는 클라이언트의 hangUp 로직에서 여전히 사용될 수 있으므로 남겨둡니다.
app.post("/reset", (req, res) => {
  console.log(
    "[API] /reset (POST): 클라이언트의 요청으로 통화 상태를 초기화합니다."
  );
  // 필요한 경우 여기에 추가적인 상태 초기화 로직을 넣을 수 있습니다.
  res.status(200).send("Reset acknowledged");
});
