const io = require("socket.io")(3000, {
    cors: {
        origin: ["https://hyper-tictactoe.com", "https://www.hyper-tictactoe.com"],
        methods: ["GET", "POST"],
    },
});

let rooms = {}; 

io.on("connection", (socket) => {
    console.log("A user connected.");

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
                board: Array(16).fill(null), 
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

        rooms[roomName].timeout = setTimeout(() => {
            let room = rooms[roomName];
            if (room && room.players.length === 2) { 
                const playerSymbol = room.turn % 2 === 0 ? "X" : "O";
                const symbolQueue = room.playerSymbolQueues[playerSymbol];
                if (symbolQueue.length > 0) { 
                    const oldestIndex = symbolQueue.shift();
                    room.board[oldestIndex] = null;
                    room.turn++;
    
                    io.to(roomName).emit("gameState", { ...room, oldestIndex });
                    io.to(roomName).emit("message", `Player ${room.turn % 2 + 1} timed out!`);
                }
            }
        }, 4000);
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
            clearTimeout(room.timeout); 
            room.board[index] = playerSymbol;
            symbolQueue.push(index); 
            room.turn++;
            io.to(roomName).emit("gameState", { ...room, oldestIndex });
    
            const winningPatterns = [
                [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
                [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
                [0, 5, 10, 15], [3, 6, 9, 12]
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
