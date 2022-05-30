require("dotenv").config();

const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const mongoose = require("mongoose");
const roomModel = require("./Models/roomModel");
const roomRoutes = require("./Routes/roomRoutes");
const tictactoeRoutes = require("./Routes/tictactoeRoutes");
const wxyzRoutes = require("./Routes/wxyzRoutes");
const path = require("path");
const joinGame = require("./Sockets/LobbySockets/joinGame");
const leaveRoom = require("./Sockets/LobbySockets/leaveRoom");
const handleTTTMove = require("./Sockets/GameSockets/TTT/handleTTTMove");
const disconnectTTT = require("./Sockets/GameSockets/TTT/disconnectTTT");
const disconnectWXYZ = require("./Sockets/GameSockets/WXYZ/disconnectWXYZ");
const turnWXYZ= require("./Sockets/GameSockets/WXYZ/turnWXYZ");
const changeLivesWXYZ = require("./Sockets/GameSockets/WXYZ/changeLivesWXYZ");

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
const io = socketio(server,{
  pingTimeout:500,
  pingInterval:1000
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

  socket.on("userJoinedWXYZ",({ users, roomID, username }) => {
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
    socket.on("startWXYZ", () =>{
      turnWXYZ(io,{position:0},username,roomID);
    });
    socket.on("WXYZTurn",(res) => {
      turnWXYZ(io,res,username,roomID);
    });
    socket.on("WXYZstr", (res) => {
      io.in(roomID).emit("WXYZstr", { str: res });
    });
    socket.on("WXYZReduceLives",(res) => {
      changeLivesWXYZ(io,res,username,roomID);
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
      disconnectWXYZ(io,username, roomID, socket);
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
app.use("/", wxyzRoutes);

// app.use(express.static(path.join(__dirname, "frontend", "build")));

// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "frontend", "build", "index.html"));
// });

server.listen(PORT, () => {
  console.log(`PORT: ${PORT}`);
});
