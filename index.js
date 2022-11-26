require("dotenv").config();

const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const mongoose = require("mongoose");
const roomModel = require("./Models/roomModel");
const roomRoutes = require("./Routes/roomRoutes");
const tictactoeRoutes = require("./Routes/tictactoeRoutes");
const psychRoutes = require("./Routes/psychRoutes");
const shazamRoutes = require("./Routes/shazamRoutes");
const wxyzRoutes = require("./Routes/wxyzRoutes");
const path = require("path");
const joinGame = require("./Sockets/LobbySockets/joinGame");
const leaveRoom = require("./Sockets/LobbySockets/leaveRoom");
const handleTTTMove = require("./Sockets/GameSockets/TTT/handleTTTMove");
const disconnectTTT = require("./Sockets/GameSockets/TTT/disconnectTTT");
const disconnectWXYZ = require("./Sockets/GameSockets/WXYZ/disconnectWXYZ");
const turnWXYZ = require("./Sockets/GameSockets/WXYZ/turnWXYZ");
const changeLivesWXYZ = require("./Sockets/GameSockets/WXYZ/changeLivesWXYZ");
const psychRoundStart = require("./Sockets/GameSockets/Psych/psychRoundStart");
const psychRoundGuess = require("./Sockets/GameSockets/Psych/psychRoundGuess");
const psychRoundVote = require("./Sockets/GameSockets/Psych/psychRoundVote");
const handleDisconnect = require("./Sockets/GameSockets/Psych/handleDisconnect");
const disconnectShazam = require("./Sockets/GameSockets/shazam/disconnectShazam");

//DB Connection
mongoose.connect(
  process.env.DBURI,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  },
  () => {
    console.log("Connected to Pandemic DB!");
  }
);

//Server Setup
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  pingTimeout: 500,
  pingInterval: 1000,
});
const PORT = process.env.PORT || 8000;

//Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS,PUT,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");

  next();
});

//Global Socket Routes
io.on("connection", (socket) => {
  socket.on("userJoined", ({ users, roomID, username }) => {
    socket.join(roomID);
    console.log(`${socket.id} Joined Lobby`);
    socket.to(roomID).emit("userJoined", { users, username });
    socket.on("chatMessage", (payload) =>
      io.in(roomID).emit("chatMessage", payload)
    );
    socket.on("changeSelectedGame", async ({ gameCode }) => {
      await roomModel.updateOne({ roomID: roomID }, { selectedGame: gameCode });
      io.in(roomID).emit("changeSelectedGame", { gameCode });
    });
    socket.on("startGame", async ({ gameCode, room }) => {
      await roomModel.deleteOne({ roomID });
      joinGame(io, gameCode, roomID, room);
    });
    socket.on("disconnect", () => leaveRoom(socket, username, roomID));
  });

  socket.on("userJoinedPsych", ({ users, roomID, username }) => {
    socket.join(roomID);
    console.log(`${socket.id} Joined Psych`);
    socket.to(roomID).emit("userJoinedPsych", { users, username });
    socket.on("chatMessage", (payload) =>
      io.in(roomID).emit("chatMessage", payload)
    );
    socket.on("gameInitialized", () => io.in(roomID).emit("gameInitialized"));
    socket.on("roundStart", () => {
      psychRoundStart(io, roomID);
    });
    socket.on("roundGuess", (payload) => {
      psychRoundGuess(
        io,
        payload.gameState,
        payload.username,
        payload.value,
        roomID
      );
    });
    socket.on("psychRoundvote", (payload) => {
      psychRoundVote(io, payload, roomID);
    });
    socket.on("disconnect", () => {
      handleDisconnect(io, socket, roomID, username);
    });
  });

  socket.on("userJoinedShazam", ({ users, roomID, username }) => {
    socket.join(roomID);
    console.log(`${socket.id} Joined Shazam`);
    socket.to(roomID).emit("userJoinedShazam", { users, username });
    socket.on("ShazamChatMessage", (payload) => {
      io.in(roomID).emit("ShazamChatMessage", payload);
    });
    socket.on("ShazamChatMessageAfterGuess", (payload) => {
      io.in(roomID).emit("ShazamChatMessageAfterGuess", payload);
    });
    socket.on("shazamScoreUpdate", (payload) => {
      io.in(roomID).emit("scoreUpdate", payload);
    });
    socket.on("ShazamStart", (songListLength) => {
      let number = Math.floor(Math.random() * songListLength);
      console.log(number);
      io.in(roomID).emit("ShazamStart", number);
    });
    socket.on("ShazamSongParty", () => io.in(roomID).emit("ShazamSongParty"));
    socket.on("ShazamOver", () => io.in(roomID).emit("ShazamOver"));
    socket.on("shazamReset", () => io.in(roomID).emit("shazamReset"));
    ///leaveRoom
    socket.on("returnToRoomFromleaveShazam", () =>
      io.in(roomID).emit("returnToRoomFromleaveShazam")
    );
    socket.on("disconnect", () => {
      console.log(username);
      disconnectShazam(username, roomID, socket, io);
    });
  });

  socket.on("userJoinedTTT", ({ users, roomID, username }) => {
    socket.join(roomID);
    console.log(`${socket.id} Joined TTT`);
    socket.to(roomID).emit("userJoinedTTT", { users, username });
    socket.on("chatMessage", (payload) =>
      io.in(roomID).emit("chatMessage", payload)
    );

    socket.on(
      "TTTMove",
      ({ gameState, myWeightArray, opponentWeightArray }) => {
        handleTTTMove(
          socket,
          io,
          gameState,
          myWeightArray,
          roomID,
          opponentWeightArray
        );
      }
    );

    socket.on("TTTReset", () => io.in(roomID).emit("TTTReset"));
    socket.on("disconnect", () => {
      disconnectTTT(username, roomID, socket);
    });
    socket.on("returnToRoomFromTTT", () =>
      io.in(roomID).emit("returnToRoomFromTTT")
    );
  });

  socket.on("userJoinedWXYZ", ({ users, roomID, username }) => {
    console.log(users);
    socket.join(roomID);
    console.log(`${socket.id} Joined WXYZ`);
    socket.to(roomID).emit("userJoinedWXYZ", { users, username });
    socket.on("chatMessage", (payload) =>
      io.in(roomID).emit("chatMessage", payload)
    );
    socket.on("returnToRoomFromWXYZ", () =>
      io.in(roomID).emit("returnToRoomFromWXYZ")
    );
    socket.on("startWXYZ", () => {
      turnWXYZ(io, { position: 0 }, username, roomID);
    });
    socket.on("WXYZTurn", (res) => {
      turnWXYZ(io, res, username, roomID);
    });
    socket.on("WXYZstr", (res) => {
      io.in(roomID).emit("WXYZstr", { str: res });
    });
    socket.on("WXYZReduceLives", (res) => {
      changeLivesWXYZ(io, res, username, roomID);
    });
    socket.on("WXYZcorrectAnswerRotate", (res) => {
      io.in(roomID).emit("WXYZcorrectAnswerRotate", { liveChecker: res });
    });
    socket.on("WXYZwrongAnswerRotate", (res) => {
      io.in(roomID).emit("WXYZcorrectAnswerRotate", { liveChecker: res });
    });
    socket.on("WXYZwinner", (res) => {
      io.in(roomID).emit("WXYZwinner", res);
    });
    socket.on("returnToRoomFromleaveWXYZ", () =>
      io.in(roomID).emit("returnToRoomFromleaveWXYZ")
    );
    socket.on("disconnect", () => {
      disconnectWXYZ(io, username, roomID, socket);
    });
  });
});

//@ Reponse Object JSON Format
//@ Every Object must have:
//@ {code:Number, errCode: Number || null, message:String}
//@ Additional Params: any || null
//Test Route
app.get("/test", (req, res) => {
  res.json({
    code: 200,
    errCode: null,
    message: `Server Running on Port: ${PORT}`,
  });
});
app.use("/", roomRoutes);
app.use("/", tictactoeRoutes);
app.use("/", psychRoutes);
app.use("/", shazamRoutes);
app.use("/", wxyzRoutes);

app.use(express.static(path.join(__dirname, "frontend", "bui));ld")));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "frontend", "build", "index.html"));
});

server.listen(PORT, () => {
  console.log(`PORT: ${PORT}`);
});
