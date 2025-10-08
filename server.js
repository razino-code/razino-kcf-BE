import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
const PORT = 8080;

app.set("view engine", "ejs");

// CORS 설정
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.listen(PORT, () => {
  console.log(`${PORT}포트로 대기중...`);
});

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
  res.render("raspberrypi_index.ejs", dataTime);
});

app.get("/mobile", (req, res) => {
  console.log(`모바일 접근 ${req.ip}`);
  res.render("mobile_index.ejs");
});
