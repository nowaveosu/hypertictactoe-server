const io = require("socket.io")(3000, {
    cors: {
        origin: ["https://hyper-tictactoe.com", "https://www.hyper-tictactoe.com"],
        methods: ["GET", "POST"],
    },
});

let rooms = {}; 

io.on("connection", (socket) => {

    socket.on("getRoomCounts", () => {
        const roomCounts = {};
        for (const roomName in rooms) {
            roomCounts[roomName] = rooms[roomName].players.length;
        }
        socket.emit("roomCounts", roomCounts);
    });

    socket.on("joinRoom", (roomName) => {    
        console.log("joining room: " + roomName);
        socket.join(roomName);       
        if (!rooms[roomName]) {      
            rooms[roomName] = {
                players: [],
                board: Array(25).fill(null), 
                turn: 0,
                rps: [], 
                rpsResult: null, 
                playerSymbolQueues: {  
                    X: [],
                    O: []
                },
            };
        }
        rooms[roomName].players.push(socket.id);  
        io.to(roomName).emit("gameState", rooms[roomName]);  
    });


    socket.on("message", (message, roomName) => {
        console.log("sending message", message, roomName);
        if (roomName.length) {
            io.to(roomName).emit("message", message);
        } else {
            io.emit("message", message);
        }
    });
    

    socket.on("makeMove", (index, roomName) => {
        let room = rooms[roomName];
        if (room && room.players[room.turn % 2] === socket.id && room.board[index] === null && room.rpsResult) {
            const playerSymbol = room.turn % 2 === 0 ? "X" : "O";
            const symbolQueue = room.playerSymbolQueues[playerSymbol];
            let oldestIndex = null; 
            if (symbolQueue.length >= 4) {
                oldestIndex = symbolQueue.shift();
                room.board[oldestIndex] = null;
            }

            room.board[index] = playerSymbol;
            symbolQueue.push(index); 
            room.turn++;
            io.to(roomName).emit("gameState", { ...room, oldestIndex });
    
            const winningPatterns = [
                [0, 1, 2, 3], [1, 2, 3, 4], [5, 6, 7, 8], [6, 7, 8, 9], [10, 11, 12, 13], [11, 12, 13, 14], [15, 16, 17, 18], [16, 17, 18, 19], [20, 21, 22, 23], [21, 22, 23, 24], // 가로
                [0, 5, 10, 15], [1, 6, 11, 16], [2, 7, 12, 17], [3, 8, 13, 18], [4, 9, 14, 19], [5, 10, 15, 20], [6, 11, 16, 21], [7, 12, 17, 22], [8, 13, 18, 23], [9, 14, 19, 24], // 세로
                [0, 6, 12, 18], [1, 7, 13, 19], [5, 11, 17, 23], [6, 12, 18, 24], [3, 7, 11, 15], [4, 8, 12, 16], [9, 13, 17, 21], [10, 14, 18, 22] // 대각선
            ];
    
            for (const pattern of winningPatterns) {
                const [a, b, c, d] = pattern;
                if (room.board[a] && room.board[a] === room.board[b] && room.board[a] === room.board[c] && room.board[a] === room.board[d]) {
                    const winner = room.players[(room.turn + 1) % 2];
                    const loser = room.players[room.turn % 2];
                    
                    io.to(winner).emit("message", "** You win! **");
                    io.to(loser).emit("message", "** You lose! **");
                    break;
                }
            }
        }
    });
    

    socket.on("playRPS", (choice, roomName) => { 
        let room = rooms[roomName];
        if (room) {
            room.rps.push({ player: socket.id, choice });
            if (room.rps.length === 2) {
                let [p1, p2] = room.rps;
                if (p1.choice === p2.choice) {
                    room.rpsResult = "Draw";
                } else if (
                    (p1.choice === "rock" && p2.choice === "scissors") ||
                    (p1.choice === "scissors" && p2.choice === "paper") ||
                    (p1.choice === "paper" && p2.choice === "rock")
                ) {
                    room.rpsResult = p1.player;
                    room.players = [p1.player, p2.player]; 
                } else {
                    room.rpsResult = p2.player;
                    room.players = [p2.player, p1.player]; 
                }
                room.rps = [];
                io.to(roomName).emit("gameState", room);
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("user disconnected.");
        for (let roomName in rooms) {
            let room = rooms[roomName];
            let playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomName];
                } else {
                    io.to(roomName).emit("gameState", room);
                }
            }
        }
    });
});