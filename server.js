require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());

// Render의 Health Check를 위한 응답 경로
app.get("/", (req, res) => {
  res.send("Chat server is running successfully!");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- 1. 데이터베이스 연결 ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB에 성공적으로 연결되었습니다."))
  .catch((err) => console.error("❌ MongoDB 연결 실패:", err));

// --- 2. 새로운 DB 스키마 및 모델 정의 ---

// Users 스키마
const userSchema = new mongoose.Schema({
  localId: { type: String, unique: true, required: true }, // 브라우저마다 고유한 ID
  nickname: String, // 더 이상 unique가 아님
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

// Nodes 스키마
const nodeSchema = new mongoose.Schema({
  roomKey: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastActivityAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  visitCount: { type: Number, default: 0 },
});
const Node = mongoose.model("Node", nodeSchema);

// Messages 스키마
const messageSchema = new mongoose.Schema({
  nodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: String,
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

// Transitions 스키마
const transitionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fromNodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Node",
    default: null,
  },
  toNodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Node",
    required: true,
  },
  transitionType: String,
  createdAt: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 },
});
const Transition = mongoose.model("Transition", transitionSchema);

// --- 3. Socket.IO 실시간 통신 로직 ---
io.on("connection", (socket) => {
  console.log(`[연결] 새로운 유저 접속: ${socket.id}`);

  // 사용자 정보 설정 (최초 연결 시)
  socket.on("userSetup", async ({ localId, nickname }) => {
    try {
      // 이제 localId를 기준으로 사용자를 찾습니다.
      const user = await User.findOneAndUpdate(
        { localId: localId },
        // 닉네임은 접속할 때마다 최신 값으로 업데이트합니다.
        {
          $set: { nickname: nickname, lastSeenAt: new Date() },
          $setOnInsert: { localId: localId },
        },
        { upsert: true, new: true }
      );
      socket.emit("sessionEstablished", {
        userId: user._id,
        nickname: user.nickname,
      });
    } catch (error) {
      console.error("[에러] 사용자 설정 실패:", error);
    }
  });

  // 노드 입장 및 전환 기록 (핵심 로직)
  socket.on("joinNodeAndLogTransition", async (data) => {
    const { userId, fromNodeKey, toNodeKey, duration, transitionType } = data;
    if (!userId || !toNodeKey) return;

    try {
      // fromNode와 toNode의 DB 문서를 찾거나, 없으면 새로 생성
      const fromNode = fromNodeKey
        ? await Node.findOneAndUpdate(
            { roomKey: fromNodeKey },
            { $setOnInsert: { roomKey: fromNodeKey } },
            { upsert: true, new: true }
          )
        : null;
      const toNode = await Node.findOneAndUpdate(
        { roomKey: toNodeKey },
        {
          $inc: { visitCount: 1 },
          $set: { lastActivityAt: new Date() },
          $setOnInsert: { roomKey: toNodeKey, creatorId: userId },
        },
        { upsert: true, new: true }
      );

      // Transition 로그 생성
      await Transition.create({
        userId,
        fromNodeId: fromNode ? fromNode._id : null,
        toNodeId: toNode._id,
        transitionType,
        duration,
      });

      // Socket.IO Room 변경
      if (fromNodeKey) socket.leave(fromNodeKey);
      socket.join(toNodeKey);

      // 입장한 방의 메시지 기록 전송
      const history = await Message.find({ nodeId: toNode._id })
        .sort({ createdAt: 1 })
        .limit(50)
        .populate("userId", "nickname"); // userId를 이용해 User 컬렉션에서 nickname을 가져옴

      const formattedHistory = history.map((msg) => ({
        text: msg.text,
        userId: msg.userId._id,
        senderNickname: msg.userId.nickname,
        createdAt: msg.createdAt,
      }));
      socket.emit("history", formattedHistory);
    } catch (error) {
      console.error("[에러] 노드 입장 및 전환 기록 실패:", error);
    }
  });

  // 메시지 전송
  socket.on("sendMessage", async ({ userId, nodeKey, text }) => {
    try {
      const node = await Node.findOne({ roomKey: nodeKey });
      if (!userId || !node) return;

      // 새 메시지를 DB에 저장
      const newMessage = await Message.create({
        nodeId: node._id,
        userId,
        text,
      });

      // Node 통계 업데이트
      await Node.updateOne(
        { _id: node._id },
        { $inc: { messageCount: 1 }, $set: { lastActivityAt: new Date() } }
      );

      const user = await User.findById(userId);

      // 방에 있는 모든 클라이언트에게 메시지 전송
      io.to(nodeKey).emit("receiveMessage", {
        text: newMessage.text,
        userId: user._id,
        senderNickname: user.nickname,
        createdAt: newMessage.createdAt,
      });
    } catch (error) {
      console.error("[에러] 메시지 전송 실패:", error);
    }
  });

  // 추천 노드 검색
  socket.on("getRecommendation", async ({ roomKey }) => {
    try {
      const recommendation = await Node.aggregate([
        { $match: { roomKey: { $ne: roomKey } } },
        { $sample: { size: 1 } },
      ]);
      if (recommendation.length > 0) {
        socket.emit("recommendationResult", {
          recommendedKey: recommendation[0].roomKey,
        });
      }
    } catch (error) {
      console.error("[에러] 추천 노드 검색 실패:", error);
    }
  });

  // 연결 종료
  socket.on("disconnect", () => {
    console.log(`[연결 종료] 유저 연결 끊김: ${socket.id}`);
  });
});

// --- 4. 서버 실행 ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
