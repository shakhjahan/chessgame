import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    firebaseConfig
} from "./firebase-config.js";


/* =========================================
   FIREBASE
========================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================
   HTML
========================================= */

const boardElement =
    document.getElementById("board");

const movesElement =
    document.getElementById("moves");

const modeElement =
    document.getElementById("gameMode");

const roomControls =
    document.getElementById("roomControls");

const roomIdElement =
    document.getElementById("roomId");

const roomStatus =
    document.getElementById("roomStatus");

const whiteClock =
    document.getElementById("whiteClock");

const blackClock =
    document.getElementById("blackClock");

const whiteStatus =
    document.getElementById("whiteStatus");

const blackStatus =
    document.getElementById("blackStatus");

const timeControl =
    document.getElementById("timeControl");

const difficulty =
    document.getElementById("difficulty");


/* =========================================
   PIECES
========================================= */

const pieces = {

    w: {
        K: "♔",
        Q: "♕",
        R: "♖",
        B: "♗",
        N: "♘",
        P: "♙"
    },

    b: {
        K: "♚",
        Q: "♛",
        R: "♜",
        B: "♝",
        N: "♞",
        P: "♟"
    }

};


const files = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h"
];


/* =========================================
   GAME VARIABLES
========================================= */

let board;

let turn = "w";

let selected = null;

let history = [];

let gameOver = false;

let clocks = {
    w: 600,
    b: 600
};

let timer = null;


/* =========================================
   MULTIPLAYER
========================================= */

let currentUser = null;

let currentRoom = null;

let myColor = "w";

let roomUnsubscribe = null;


/* =========================================
   INITIAL BOARD
========================================= */

function createInitialBoard() {

    const newBoard =
        Array
            .from(
                { length: 8 },
                () =>
                    Array(8).fill(null)
            );


    const backRank = [
        "R",
        "N",
        "B",
        "Q",
        "K",
        "B",
        "N",
        "R"
    ];


    for (let c = 0; c < 8; c++) {

        newBoard[0][c] = {
            type: backRank[c],
            color: "b"
        };

        newBoard[1][c] = {
            type: "P",
            color: "b"
        };

        newBoard[6][c] = {
            type: "P",
            color: "w"
        };

        newBoard[7][c] = {
            type: backRank[c],
            color: "w"
        };

    }


    return newBoard;
}


/* =========================================
   COPY BOARD
========================================= */

function copyBoard(source) {

    return source.map(row =>
        row.map(piece =>
            piece
                ? { ...piece }
                : null
        )
    );

}


/* =========================================
   BOARD HELPERS
========================================= */

function inside(row, col) {

    return (
        row >= 0 &&
        row < 8 &&
        col >= 0 &&
        col < 8
    );

}


function pathClear(
    boardState,
    r1,
    c1,
    r2,
    c2
) {

    const dr =
        Math.sign(r2 - r1);

    const dc =
        Math.sign(c2 - c1);

    let r = r1 + dr;

    let c = c1 + dc;


    while (
        r !== r2 ||
        c !== c2
    ) {

        if (boardState[r][c]) {

            return false;

        }

        r += dr;

        c += dc;

    }


    return true;
}


/* =========================================
   BASIC MOVE
========================================= */

function canMove(
    boardState,
    r1,
    c1,
    r2,
    c2
) {

    const piece =
        boardState[r1][c1];

    if (!piece) {

        return false;

    }


    const target =
        boardState[r2][c2];


    if (
        target &&
        target.color === piece.color
    ) {

        return false;

    }


    const dr = r2 - r1;

    const dc = c2 - c1;

    const absR = Math.abs(dr);

    const absC = Math.abs(dc);


    /* PAWN */

    if (piece.type === "P") {

        const direction =
            piece.color === "w"
                ? -1
                : 1;

        const startRow =
            piece.color === "w"
                ? 6
                : 1;


        if (
            dc === 0 &&
            !target &&
            dr === direction
        ) {

            return true;

        }


        if (
            dc === 0 &&
            !target &&
            r1 === startRow &&
            dr === direction * 2 &&
            !boardState[
                r1 + direction
            ][c1]
        ) {

            return true;

        }


        if (
            absC === 1 &&
            dr === direction &&
            target
        ) {

            return true;

        }


        return false;

    }


    /* KNIGHT */

    if (piece.type === "N") {

        return (
            absR * absC === 2
        );

    }


    /* KING */

    if (piece.type === "K") {

        return (
            absR <= 1 &&
            absC <= 1
        );

    }


    /* ROOK */

    if (piece.type === "R") {

        return (
            (
                dr === 0 ||
                dc === 0
            ) &&
            pathClear(
                boardState,
                r1,
                c1,
                r2,
                c2
            )
        );

    }


    /* BISHOP */

    if (piece.type === "B") {

        return (
            absR === absC &&
            pathClear(
                boardState,
                r1,
                c1,
                r2,
                c2
            )
        );

    }


    /* QUEEN */

    if (piece.type === "Q") {

        return (
            (
                absR === absC ||
                dr === 0 ||
                dc === 0
            ) &&
            pathClear(
                boardState,
                r1,
                c1,
                r2,
                c2
            )
        );

    }


    return false;

}


/* =========================================
   KING
========================================= */

function findKing(
    boardState,
    color
) {

    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            const piece =
                boardState[r][c];

            if (
                piece &&
                piece.color === color &&
                piece.type === "K"
            ) {

                return [
                    r,
                    c
                ];

            }

        }

    }


    return null;

}


/* =========================================
   CHECK
========================================= */

function isCheck(
    boardState,
    color
) {

    const king =
        findKing(
            boardState,
            color
        );


    if (!king) {

        return true;

    }


    const opponent =
        color === "w"
            ? "b"
            : "w";


    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            const piece =
                boardState[r][c];

            if (
                piece &&
                piece.color === opponent
            ) {

                if (
                    canMove(
                        boardState,
                        r,
                        c,
                        king[0],
                        king[1]
                    )
                ) {

                    return true;

                }

            }

        }

    }


    return false;

}


/* =========================================
   LEGAL MOVES
========================================= */

function legalMoves(
    row,
    col
) {

    const result = [];


    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            if (
                !canMove(
                    board,
                    row,
                    col,
                    r,
                    c
                )
            ) {

                continue;

            }


            const testBoard =
                copyBoard(board);


            testBoard[r][c] =
                testBoard[row][col];

            testBoard[row][col] =
                null;


            if (
                !isCheck(
                    testBoard,
                    turn
                )
            ) {

                result.push([
                    r,
                    c
                ]);

            }

        }

    }


    return result;

}


/* =========================================
   DRAW BOARD
========================================= */

function renderBoard() {

    boardElement.innerHTML = "";


    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            const square =
                document.createElement("div");


            square.className =
                "square " +
                (
                    (row + col) % 2
                        ? "dark"
                        : "light"
                );


            if (
                selected &&
                selected[0] === row &&
                selected[1] === col
            ) {

                square.classList.add(
                    "selected"
                );

            }


            if (selected) {

                const moves =
                    legalMoves(
                        selected[0],
                        selected[1]
                    );


                if (
                    moves.some(
                        move =>
                            move[0] === row &&
                            move[1] === col
                    )
                ) {

                    if (board[row][col]) {

                        square.classList.add(
                            "capture"
                        );

                    } else {

                        square.classList.add(
                            "legal"
                        );

                    }

                }

            }


            const piece =
                board[row][col];


            if (piece) {

                const element =
                    document.createElement(
                        "span"
                    );


                element.className =
                    "piece " +
                    (
                        piece.color === "w"
                            ? "white-piece"
                            : "black-piece"
                    );


                element.textContent =
                    pieces[
                        piece.color
                    ][
                        piece.type
                    ];


                square.appendChild(
                    element
                );

            }


            square.onclick =
                () =>
                    squareClick(
                        row,
                        col
                    );


            boardElement.appendChild(
                square
            );

        }

    }


    updateStatus();

    updateClocks();

}


/* =========================================
   CLICK
========================================= */

function squareClick(
    row,
    col
) {

    if (gameOver) {

        return;

    }


    if (
        modeElement.value ===
            "multiplayer" &&
        turn !== myColor
    ) {

        return;

    }


    const piece =
        board[row][col];


    if (selected) {

        const moves =
            legalMoves(
                selected[0],
                selected[1]
            );


        const valid =
            moves.some(
                move =>
                    move[0] === row &&
                    move[1] === col
            );


        if (valid) {

            makeMove(
                selected[0],
                selected[1],
                row,
                col
            );

            return;

        }

    }


    if (
        piece &&
        piece.color === turn
    ) {

        selected = [
            row,
            col
        ];

    } else {

        selected = null;

    }


    renderBoard();

}


/* =========================================
   MAKE MOVE
========================================= */

async function makeMove(
    r1,
    c1,
    r2,
    c2,
    promotion = "Q",
    remote = false
) {

    const piece =
        board[r1][c1];


    if (!piece) {

        return;

    }


    history.push({
        board:
            copyBoard(board),

        turn
    });


    board[r2][c2] = {
        ...piece
    };


    board[r1][c1] = null;


    /* PROMOTION */

    if (
        piece.type === "P" &&
        (
            r2 === 0 ||
            r2 === 7
        )
    ) {

        board[r2][c2].type =
            promotion;

    }


    const notation =
        (
            piece.type === "P"
                ? ""
                : piece.type
        ) +
        files[c1] +
        (8 - r1) +
        "-" +
        files[c2] +
        (8 - r2);


    addMove(notation);


    selected = null;


    turn =
        turn === "w"
            ? "b"
            : "w";


    checkGameEnd();


    renderBoard();


    if (
        !remote &&
        modeElement.value ===
            "multiplayer" &&
        currentRoom
    ) {

        await syncRoom();

    }


    /* AI */

    if (
        !remote &&
        modeElement.value ===
            "ai" &&
        turn === "b" &&
        !gameOver
    ) {

        setTimeout(
            computerMove,
            450
        );

    }

}


/* =========================================
   MOVES TEXT
========================================= */

function addMove(text) {

    if (
        movesElement.textContent ===
        "No moves yet"
    ) {

        movesElement.textContent =
            text;

    } else {

        movesElement.textContent +=
            "   " +
            text;

    }

}


/* =========================================
   GAME END
========================================= */

function checkGameEnd() {

    let moves = [];


    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            if (
                board[r][c] &&
                board[r][c].color === turn
            ) {

                moves.push(
                    ...legalMoves(r, c)
                );

            }

        }

    }


    if (moves.length === 0) {

        gameOver = true;

        clearInterval(timer);


        const title =
            isCheck(board, turn)
                ? (
                    turn === "w"
                        ? "Computer Wins"
                        : "You Win"
                )
                : "Draw";


        document.getElementById(
            "gameOverTitle"
        ).textContent = title;


        document.getElementById(
            "gameOverText"
        ).textContent =
            isCheck(board, turn)
                ? "Checkmate!"
                : "Stalemate.";


        document
            .getElementById("gameOver")
            .classList.remove(
                "hidden"
            );

    }

}


/* =========================================
   AI
========================================= */

function computerMove() {

    const all = [];


    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            const piece =
                board[r][c];


            if (
                piece &&
                piece.color === "b"
            ) {

                const moves =
                    legalMovesForColor(
                        r,
                        c,
                        "b"
                    );


                for (const move of moves) {

                    all.push([
                        r,
                        c,
                        move[0],
                        move[1]
                    ]);

                }

            }

        }

    }


    if (!all.length) {

        return;

    }


    let selectedMove =
        all[
            Math.floor(
                Math.random() *
                all.length
            )
        ];


    const level =
        Number(
            difficulty.value
        );


    if (level >= 2) {

        const captures =
            all.filter(
                move =>
                    board[
                        move[2]
                    ][
                        move[3]
                    ]
            );


        if (captures.length) {

            selectedMove =
                captures[
                    Math.floor(
                        Math.random() *
                        captures.length
                    )
                ];

        }

    }


    makeMove(
        ...selectedMove
    );

}


/* =========================================
   LEGAL MOVES FOR COLOR
========================================= */

function legalMovesForColor(
    row,
    col,
    color
) {

    const oldTurn = turn;

    turn = color;

    const moves =
        legalMoves(
            row,
            col
        );

    turn = oldTurn;

    return moves;

}


/* =========================================
   CLOCK
========================================= */

function updateClocks() {

    whiteClock.textContent =
        formatTime(
            clocks.w
        );

    blackClock.textContent =
        formatTime(
            clocks.b
        );

}


function formatTime(seconds) {

    const minutes =
        Math.floor(
            seconds / 60
        );

    const secs =
        seconds % 60;


    return (
        String(minutes)
            .padStart(2, "0")
        +
        ":" +
        String(secs)
            .padStart(2, "0")
    );

}


function startClock() {

    clearInterval(timer);


    timer =
        setInterval(
            () => {

                if (gameOver) {

                    return;

                }


                clocks[turn]--;


                if (
                    clocks[turn] <= 0
                ) {

                    clocks[turn] = 0;

                    gameOver = true;

                    clearInterval(
                        timer
                    );


                    alert(
                        turn === "w"
                            ? "Computer wins on time!"
                            : "You win on time!"
                    );

                }


                updateClocks();

            },
            1000
        );

}


/* =========================================
   STATUS
========================================= */

function updateStatus() {

    if (
        modeElement.value ===
        "multiplayer"
    ) {

        whiteStatus.textContent =
            turn === "w"
                ? (
                    myColor === "w"
                        ? "Your turn"
                        : "Opponent turn"
                )
                : "Waiting";

        blackStatus.textContent =
            turn === "b"
                ? (
                    myColor === "b"
                        ? "Your turn"
                        : "Opponent turn"
                )
                : "Waiting";

    } else {

        whiteStatus.textContent =
            turn === "w"
                ? "Your turn"
                : "Waiting";


        blackStatus.textContent =
            turn === "b"
                ? "Computer thinking"
                : "Computer";

    }

}


/* =========================================
   NEW GAME
========================================= */

function newGame() {

    board =
        createInitialBoard();

    turn = "w";

    selected = null;

    history = [];

    gameOver = false;


    const seconds =
        Number(
            timeControl.value
        );


    clocks = {
        w: seconds,
        b: seconds
    };


    movesElement.textContent =
        "No moves yet";


    document
        .getElementById(
            "gameOver"
        )
        .classList.add(
            "hidden"
        );


    renderBoard();

    startClock();

}


document
    .getElementById("newGame")
    .onclick =
        newGame;


document
    .getElementById("newGame2")
    .onclick =
        newGame;


document
    .getElementById("undo")
    .onclick =
        () => {

            if (
                history.length === 0 ||
                gameOver
            ) {

                return;

            }


            const previous =
                history.pop();


            board =
                previous.board;

            turn =
                previous.turn;


            renderBoard();

        };


timeControl.onchange =
    newGame;


/* =========================================
   MODE
========================================= */

modeElement.onchange =
    () => {

        roomControls.classList.toggle(
            "hidden",
            modeElement.value !==
                "multiplayer"
        );


        newGame();

    };


/* =========================================
   FIREBASE LOGIN
========================================= */

signInAnonymously(auth)
    .catch(error => {

        console.error(
            "Firebase Auth error:",
            error
        );

    });


onAuthStateChanged(
    auth,
    user => {

        currentUser = user || null;

    }
);


/* =========================================
   CREATE ROOM
========================================= */

document
    .getElementById("createRoom")
    .onclick =
    async () => {

        if (!currentUser) {

            roomStatus.textContent =
                "Connecting to Firebase...";

            return;

        }


        currentRoom =
            Math.random()
                .toString(36)
                .substring(
                    2,
                    8
                )
                .toUpperCase();


        roomIdElement.value =
            currentRoom;


        myColor = "w";


        const roomRef =
            doc(
                db,
                "rooms",
                currentRoom
            );


        await setDoc(
            roomRef,
            {

                hostUid:
                    currentUser.uid,

                guestUid:
                    null,

                board:
                    JSON.stringify(board),

                turn,

                clocks,

                status:
                    "waiting",

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()

            }
        );


        roomStatus.textContent =
            "Room created: " +
            currentRoom;


        listenRoom();

    };


/* =========================================
   JOIN ROOM
========================================= */

document
    .getElementById("joinRoom")
    .onclick =
    async () => {

        if (!currentUser) {

            roomStatus.textContent =
                "Connecting to Firebase...";

            return;

        }


        const id =
            roomIdElement.value
                .trim()
                .toUpperCase();


        if (!id) {

            roomStatus.textContent =
                "Enter Room ID.";

            return;

        }


        const roomRef =
            doc(
                db,
                "rooms",
                id
            );


        const snapshot =
            await getDoc(
                roomRef
            );


        if (!snapshot.exists()) {

            roomStatus.textContent =
                "Room not found.";

            return;

        }


        const data =
            snapshot.data();


        if (
            data.guestUid &&
            data.guestUid !==
                currentUser.uid
        ) {

            roomStatus.textContent =
                "Room is full.";

            return;

        }


        currentRoom = id;

        myColor = "b";


        await updateDoc(
            roomRef,
            {

                guestUid:
                    currentUser.uid,

                status:
                    "playing",

                updatedAt:
                    serverTimestamp()

            }
        );


        roomStatus.textContent =
            "Joined room as Black.";


        listenRoom();

    };


/* =========================================
   LISTEN ROOM
========================================= */

function listenRoom() {

    if (
        roomUnsubscribe
    ) {

        roomUnsubscribe();

    }


    if (!currentRoom) {

        return;

    }


    const roomRef =
        doc(
            db,
            "rooms",
            currentRoom
        );


    roomUnsubscribe =
        onSnapshot(
            roomRef,
            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    return;

                }


                const data =
                    snapshot.data();


                if (
                    data.hostUid ===
                    currentUser?.uid
                ) {

                    myColor = "w";

                }


                if (
                    data.guestUid ===
                    currentUser?.uid
                ) {

                    myColor = "b";

                }


                if (data.board) {

                    board =
                        JSON.parse(
                            data.board
                        );

                }


                if (data.turn) {

                    turn =
                        data.turn;

                }


                if (data.clocks) {

                    clocks =
                        data.clocks;

                }


                renderBoard();

            }
        );

}


/* =========================================
   SYNC ROOM
========================================= */

async function syncRoom() {

    if (
        !currentRoom ||
        !currentUser
    ) {

        return;

    }


    const roomRef =
        doc(
            db,
            "rooms",
            currentRoom
        );


    try {

        await updateDoc(
            roomRef,
            {

                board:
                    JSON.stringify(board),

                turn,

                clocks,

                updatedAt:
                    serverTimestamp()

            }
        );

    } catch (error) {

        console.error(
            "Sync error:",
            error
        );

        roomStatus.textContent =
            "Sync error.";

    }

}


/* =========================================
   START
========================================= */

newGame();