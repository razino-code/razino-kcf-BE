import express from "express";
import cors from "cors";

const app = express();
const PORT = 8080;

// SDP Offer와 Answer를 임시 저장할 인메모리 객체
let sdpStore = {
  offer: null,
  answer: null,
};

let calling_mb = false;

app.set("view engine", "ejs");
app.use(express.static("views")); // peerConfig.js 같은 정적 파일을 제공하기 위해 추가
app.use(express.json()); // JSON 요청 본문을 파싱하기 위해 추가

// CORS 설정
app.use(cors({ origin: "*", credentials: true }));

app.listen(PORT, () => {
  console.log(`${PORT}포트로 대기중...`);
});

// 라즈베리파이(수신자) 페이지
app.get("/raspberry", (req, res) => {
  const dataTime = {
    now: new Date(),
  };
  console.log(
    `접근됨 ${dataTime.now.getHours()} : ${dataTime.now
      .getMinutes()
      .toString()
      .padStart(2, "")} ==> ${req.ip}`
  );
  if (calling_mb == false) {
    res.render("raspberrypi_index.ejs", dataTime);
  } else if (calling_mb == true) {
    res.redirect("/raspberryCall");
  }
});

app.get("/raspberryCall", (req, res) => {
  if (calling_mb == true) {
    res.render("raspberry.ejs");
  } else if (calling_mb == false) {
    res.redirect("/raspberry");
  }
});

app.get("/mobile", (req, res) => {
  console.log(`모바일 접근 ${req.ip}`);
  calling_mb = false;
  res.render("mobile_index.ejs");
});

app.get("/mobileCall", (req, res) => {
  calling_mb = true;
  res.render("mobile.ejs");
});

// --- SDP 교환을 위한 API 엔드포인트 ---

// 1. 모바일이 Offer를 서버에 POST
app.post("/offer", (req, res) => {
  sdpStore.offer = req.body;
  console.log("Offer received");
  res.status(200).send("Offer received");
});

// 2. 라즈베리파이가 Offer를 GET
app.get("/offer", (req, res) => {
  res.json(sdpStore.offer);
});

// 3. 라즈베리파이가 Answer를 서버에 POST
app.post("/answer", (req, res) => {
  sdpStore.answer = req.body;
  console.log("Answer received");
  res.status(200).send("Answer received");
});

// 4. 모바일이 Answer를 GET
app.get("/answer", (req, res) => {
  res.json(sdpStore.answer);
});

// 통화 종료/리셋 시 SDP 정보 초기화
app.post("/reset", (req, res) => {
  console.log("SDP store reset.");
  sdpStore = { offer: null, answer: null };
  res.status(200).send("Reset complete");
});
