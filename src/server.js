import http from "http";
// import WebSocket from "ws";
import express from "express";
import SocketIO from "socket.io";
import { Socket } from "dgram";
const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname+"/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*",(req,res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

const httpServer = http.createServer(app); // http 서버 작동
const wsServer = SocketIO(httpServer); // socket IO 는 websocket의 부가기능이 아니다.


wsServer.on("connection", (socket) => {
    socket["nickname"] = "Anon";
    socket.onAny((event)=>{
        console.log(`Socket Event : ${event}`);
    });
    socket.on("enter_room", (roomName, done)=> {
        socket.join(roomName);
        done();
        socket.to(roomName).emit("welcome", socket.nickname);
    });
    socket.on("disconnecting", ()=>{
        socket.rooms.forEach(room=> socket.to(room).emit("bye", socket.nickname));
    })

    socket.on("new_message", (msg, room, done)=>{
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    })
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
});



// (http서버랑 webSocket 서버는 따로 만들어도 됨)
// const wss = new WebSocket.Server({server}); // webSocket 서버 작동

// function handleConnection(socket){
//     console.log(socket);
//     // server.js의 socket은 연결된 브라우저
// }

// const sockets = []; // 서로 다른 브라우저를 확인해주기 위해

// wss.on("connection", (socket) =>{
//     sockets.push(socket);
//     socket["nickname"] = "Anon"; // 접속됐을 때 Anon이 닉네임의 기본 값
//     console.log("Connected to Browser");
//     socket.on("close",() => console.log("Disconnected from Browser")); // 서버가 연결된 페이지가 닫혔을 때
//     socket.on("message", (msg) => {
//         const message = JSON.parse(msg);
//         switch(message.type){
//             case "new_message":
//                 sockets.forEach(aSocket =>aSocket.send(`${socket.nickname}: ${message.payload}`)); // 이 코드로 다른 브라우저에서 메세지를 보내도 모든 브라우저에서 확인 가능
//             case "nickname":
//                 socket["nickname"] = message.payload;

//         }
//     });
// });

httpServer.listen(3000, handleListen);