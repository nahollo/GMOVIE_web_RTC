import http from "http";
// import WebSocket from "ws";
import express from "express";
import { Server } from "socket.io";
import { Socket } from "dgram";
import { instrument } from "@socket.io/admin-ui"
const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app); // http 서버 작동 // socket IO 는 websocket의 부가기능이 아니다.
const wsServer = new Server(httpServer);

wsServer.on("connection", socket => {
    socket.on("join_room", (roomName, done) => {
        socket.join(roomName);
        done();
        socket.to(roomName).emit("welcome");
    });
});

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);