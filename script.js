import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyCvhOcbA-KlP49VdwgTCIbBtHRw-KKTHi0",
    authDomain: "chessgame-5ad44.firebaseapp.com",
    projectId: "chessgame-5ad44",
    storageBucket: "chessgame-5ad44.firebasestorage.app",
    messagingSenderId: "689216454121",
    appId: "1:689216454121:web:b716b93859d944938f9f78",
    measurementId: "G-2M09G38TSB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   HTML
========================================================= */

const boardElement = document.getElementById("board");
const movesElement = document.getElementById("moves");

const modeElement = document.getElementById("gameMode");
const roomControls = document.getElementById("roomControls");
const roomIdElement = document.getElementById("roomId");
const roomStatus = document.getElementById("roomStatus");

const whiteClock = document.getElementById("whiteClock");
const blackClock = document.getElementById("blackClock");

const whiteStatus = document.getElementById("whiteStatus");
const blackStatus = document.getElementById("blackStatus");

const timeControl = document.getElementById("timeControl");
const difficulty = document.getElementById("difficulty");

const gameOverModal = document.getElementById("gameOver");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverText = document.getElementById("gameOverText");

const newGameButton = document.getElementById("newGame");
const newGameButton2 = document.getElementById("newGame2");
const undoButton = document.getElementById("undo");

const createRoomButton = document.getElementById("createRoom");
const joinRoomButton = document.getElementById("joinRoom");


/* =========================================================
   PIECES
========================================================= */

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


/* =========================================================
   GAME STATE
========================================================= */

let board = [];
let turn = "w";

let selected = null;
let history = [];

let gameOver = false;

let clocks = {
    w: 600,
    b: 600
};

let timer = null;

let lastMove = null;


/* =========================================================
   MULTIPLAYER STATE
========================================================= */

let currentUser = null;

let currentRoom = null;

let myColor = "w";

let roomUnsubscribe = null;


/*
 * ID of the last move sent by this browser.
 *
 * This prevents our own Firestore snapshot
 * from making the piece move twice.
 */

let lastLocalMoveId = null;

let lastReceivedMoveId = null;


/*
 * Prevent remote snapshot from being
 * applied while our local animation is running.
 */

let animationInProgress = false;


/* =========================================================
   CREATE INITIAL BOARD
========================================================= */

function createInitialBoard() {

    const newBoard =
        Array.from(
            { length: 8 },
            () => Array(8).fill(null)
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


/* =========================================================
   COPY BOARD
========================================================= */

function copyBoard(source) {

    return source.map(row =>
        row.map(piece =>
            piece
                ? { ...piece }
                : null
        )
    );

}


/* =========================================================
   INSIDE BOARD
========================================================= */

function inside(row, col) {

    return (
        row >= 0 &&
        row < 8 &&
        col >= 0 &&
        col < 8
    );

}


/* =========================================================
   PATH CLEAR
========================================================= */

function pathClear(
    boardState,
    r1,
    c1,
    r2,
    c2
) {

    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);

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


/* =========================================================
   BASIC MOVE VALIDATION
========================================================= */

function canMove(
    boardState,
    r1,
    c1,
    r2,
    c2
) {

    if (
        !inside(r1, c1) ||
        !inside(r2, c2)
    ) {
        return false;
    }

    const piece = boardState[r1][c1];

    if (!piece) {
        return false;
    }

    const target = boardState[r2][c2];

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

        return absR * absC === 2;

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


/* =========================================================
   FIND KING
========================================================= */

function findKing(
    boardState,
    color
) {

    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            const piece = boardState[r][c];

            if (
                piece &&
                piece.color === color &&
                piece.type === "K"
            ) {

                return [r, c];

            }
        }
    }

    return null;
}


/* =========================================================
   CHECK
========================================================= */

function isCheck(
    boardState,
    color
) {

    const king = findKing(
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

            const piece = boardState[r][c];

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


/* =========================================================
   LEGAL MOVES
========================================================= */

function legalMoves(
    row,
    col
) {

    const result = [];

    const piece = board[row][col];

    if (!piece) {
        return result;
    }

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
                    piece.color
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


/* =========================================================
   RENDER BOARD
========================================================= */

function renderBoard() {

    boardElement.innerHTML = "";

    const fragment =
        document.createDocumentFragment();

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


            /* SELECTED */

            if (
                selected &&
                selected[0] === row &&
                selected[1] === col
            ) {

                square.classList.add(
                    "selected"
                );

            }


            /* LAST MOVE */

            if (lastMove) {

                const isFrom =
                    lastMove.from[0] === row &&
                    lastMove.from[1] === col;

                const isTo =
                    lastMove.to[0] === row &&
                    lastMove.to[1] === col;

                if (isFrom || isTo) {

                    square.classList.add(
                        "last-move"
                    );

                }
            }


            /* LEGAL MOVES */

            if (selected) {

                const moves =
                    legalMoves(
                        selected[0],
                        selected[1]
                    );

                const legal =
                    moves.some(
                        move =>
                            move[0] === row &&
                            move[1] === col
                    );

                if (legal) {

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


            /* PIECE */

            const piece =
                board[row][col];

            if (piece) {

                const pieceElement =
                    document.createElement("span");

                pieceElement.className =
                    "piece " +
                    (
                        piece.color === "w"
                            ? "white-piece"
                            : "black-piece"
                    );

                pieceElement.textContent =
                    pieces[
                        piece.color
                    ][
                        piece.type
                    ];

                square.appendChild(
                    pieceElement
                );
            }


            square.addEventListener(
                "click",
                () =>
                    handleSquareClick(
                        row,
                        col
                    )
            );

            fragment.appendChild(square);
        }
    }

    boardElement.appendChild(fragment);

    updateStatus();
    updateClocks();
}


/* =========================================================
   CLICK
========================================================= */

function handleSquareClick(
    row,
    col
) {

    if (
        gameOver ||
        animationInProgress
    ) {
        return;
    }


    /* Multiplayer */

    if (
        modeElement.value === "multiplayer" &&
        (
            !currentRoom ||
            turn !== myColor
        )
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


/* =========================================================
   MOVE ANIMATION
   EXACTLY 1 SECOND
========================================================= */

async function animatePieceMove(
    r1,
    c1,
    r2,
    c2
) {

    const squares =
        boardElement.querySelectorAll(
            ".square"
        );

    const fromSquare =
        squares[r1 * 8 + c1];

    const toSquare =
        squares[r2 * 8 + c2];

    if (
        !fromSquare ||
        !toSquare
    ) {
        return;
    }

    const originalPiece =
        fromSquare.querySelector(
            ".piece"
        );

    if (!originalPiece) {
        return;
    }

    const fromRect =
        fromSquare.getBoundingClientRect();

    const toRect =
        toSquare.getBoundingClientRect();

    const boardRect =
        boardElement.getBoundingClientRect();

    const animatedPiece =
        originalPiece.cloneNode(true);

    animatedPiece.classList.add(
        "piece-animation"
    );

    animatedPiece.style.position =
        "absolute";

    animatedPiece.style.left =
        (
            fromRect.left -
            boardRect.left +
            fromRect.width / 2
        ) + "px";

    animatedPiece.style.top =
        (
            fromRect.top -
            boardRect.top +
            fromRect.height / 2
        ) + "px";

    animatedPiece.style.width =
        (
            fromRect.width * 0.88
        ) + "px";

    animatedPiece.style.height =
        (
            fromRect.height * 0.88
        ) + "px";

    animatedPiece.style.transform =
        "translate(-50%, -50%)";

    animatedPiece.style.zIndex =
        "1000";

    animatedPiece.style.pointerEvents =
        "none";

    animatedPiece.style.transition =
        "transform 1s cubic-bezier(.2,.8,.2,1)";

    boardElement.appendChild(
        animatedPiece
    );

    originalPiece.style.opacity =
        "0";

    const dx =
        toRect.left -
        fromRect.left;

    const dy =
        toRect.top -
        fromRect.top;


    await new Promise(resolve => {

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                animatedPiece.style.transform =
                    `translate(
                        calc(-50% + ${dx}px),
                        calc(-50% + ${dy}px)
                    )`;

            });

        });


        setTimeout(
            resolve,
            400
        );

    });


    animatedPiece.remove();
}


/* =========================================================
   MAKE MOVE
========================================================= */

async function makeMove(
    r1,
    c1,
    r2,
    c2,
    promotion = "Q",
    remote = false
) {

    if (animationInProgress) {
        return;
    }

    const piece =
        board[r1][c1];

    if (!piece) {
        return;
    }


    /*
     * Multiplayer validation
     */

    if (
        !remote &&
        modeElement.value === "multiplayer"
    ) {

        if (!currentRoom) {
            return;
        }

        if (piece.color !== myColor) {
            return;
        }

        if (turn !== myColor) {
            return;
        }
    }


    animationInProgress = true;


    /*
     * Save Undo
     */

    history.push({
        board: copyBoard(board),
        turn: turn,
        clocks: {
            ...clocks
        }
    });


    const captured =
        board[r2][c2] !== null;


    /*
     * Animate BEFORE board changes.
     */

    await animatePieceMove(
        r1,
        c1,
        r2,
        c2
    );


    /*
     * Move
     */

    board[r2][c2] = {
        ...piece
    };

    board[r1][c1] = null;


    /*
     * Promotion
     */

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


    /*
     * Notation
     */

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


    lastMove = {

        from: [
            r1,
            c1
        ],

        to: [
            r2,
            c2
        ]

    };


    selected = null;


    /*
     * Generate unique move ID.
     */

    const moveId =
        `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}`;

    lastLocalMoveId = moveId;


    /*
     * Change turn
     */

    turn =
        turn === "w"
            ? "b"
            : "w";


    renderBoard();


    /*
     * Capture animation
     */

    if (captured) {

        const targetSquare =
            boardElement.querySelectorAll(
                ".square"
            )[r2 * 8 + c2];

        if (targetSquare) {

            targetSquare.classList.add(
                "capture-animation"
            );

            setTimeout(() => {

                targetSquare.classList.remove(
                    "capture-animation"
                );

            }, 300);
        }
    }


    checkGameEnd();


    /*
     * Multiplayer sync
     */

    if (
        !remote &&
        modeElement.value === "multiplayer" &&
        currentRoom
    ) {

        await syncRoom(moveId);
    }


    animationInProgress = false;


    /*
     * AI
     */

    if (
        !remote &&
        modeElement.value === "ai" &&
        turn === "b" &&
        !gameOver
    ) {

        setTimeout(
            computerMove,
            350
        );
    }
}


/* =========================================================
   ADD MOVE
========================================================= */

function addMove(text) {

    if (
        movesElement.textContent ===
        "No moves yet"
    ) {

        movesElement.textContent =
            text;

    } else {

        movesElement.textContent +=
            "   " + text;
    }
}


/* =========================================================
   GAME END
========================================================= */

function checkGameEnd() {

    const possibleMoves = [];

    for (let r = 0; r < 8; r++) {

        for (let c = 0; c < 8; c++) {

            const piece =
                board[r][c];

            if (
                piece &&
                piece.color === turn
            ) {

                possibleMoves.push(
                    ...legalMoves(
                        r,
                        c
                    )
                );
            }
        }
    }


    if (
        possibleMoves.length === 0
    ) {

        gameOver = true;

        clearInterval(timer);


        if (
            isCheck(
                board,
                turn
            )
        ) {

            if (turn === "w") {

                gameOverTitle.textContent =
                    "Black Wins";

                gameOverText.textContent =
                    "Checkmate!";

            } else {

                gameOverTitle.textContent =
                    "White Wins";

                gameOverText.textContent =
                    "Checkmate!";
            }

        } else {

            gameOverTitle.textContent =
                "Draw";

            gameOverText.textContent =
                "Stalemate.";
        }


        gameOverModal.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   AI
========================================================= */

function computerMove() {

    if (
        gameOver ||
        animationInProgress ||
        turn !== "b"
    ) {
        return;
    }


    const allMoves = [];


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

                    allMoves.push([
                        r,
                        c,
                        move[0],
                        move[1]
                    ]);
                }
            }
        }
    }


    if (!allMoves.length) {
        return;
    }


    let chosenMove =
        allMoves[
            Math.floor(
                Math.random() *
                allMoves.length
            )
        ];


    const level =
        Number(
            difficulty.value
        );


    if (level >= 2) {

        const captures =
            allMoves.filter(
                move =>
                    board[
                        move[2]
                    ][
                        move[3]
                    ]
            );

        if (captures.length) {

            chosenMove =
                captures[
                    Math.floor(
                        Math.random() *
                        captures.length
                    )
                ];
        }
    }


    makeMove(
        chosenMove[0],
        chosenMove[1],
        chosenMove[2],
        chosenMove[3]
    );
}


/* =========================================================
   LEGAL MOVES FOR COLOR
========================================================= */

function legalMovesForColor(
    row,
    col,
    color
) {

    const oldTurn =
        turn;

    turn = color;

    const moves =
        legalMoves(
            row,
            col
        );

    turn =
        oldTurn;

    return moves;
}


/* =========================================================
   CLOCK
========================================================= */

function formatTime(seconds) {

    const safeSeconds =
        Math.max(
            0,
            Number(seconds) || 0
        );

    const minutes =
        Math.floor(
            safeSeconds / 60
        );

    const secs =
        safeSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


function updateClocks() {

    whiteClock.textContent =
        formatTime(clocks.w);

    blackClock.textContent =
        formatTime(clocks.b);
}


function startClock() {

    clearInterval(timer);

    timer =
        setInterval(() => {

            if (
                gameOver ||
                animationInProgress
            ) {
                return;
            }


            /*
             * In multiplayer don't run
             * the opponent's clock locally.
             */

            if (
                modeElement.value === "multiplayer" &&
                currentRoom &&
                turn !== myColor
            ) {
                return;
            }


            clocks[turn]--;

            if (
                clocks[turn] <= 0
            ) {

                clocks[turn] = 0;

                gameOver = true;

                clearInterval(timer);

                gameOverTitle.textContent =
                    turn === "w"
                        ? "Black Wins"
                        : "White Wins";

                gameOverText.textContent =
                    "Time has expired.";

                gameOverModal.classList.remove(
                    "hidden"
                );


                if (
                    modeElement.value ===
                    "multiplayer"
                ) {

                    syncRoom(
                        "timeout-" +
                        Date.now()
                    );
                }
            }


            updateClocks();

        }, 1000);
}


/* =========================================================
   STATUS
========================================================= */

function updateStatus() {

    if (
        modeElement.value === "multiplayer"
    ) {

        if (!currentRoom) {

            whiteStatus.textContent =
                "Waiting for room";

            blackStatus.textContent =
                "Waiting for room";

            return;
        }


        whiteStatus.textContent =
            turn === "w"
                ? (
                    myColor === "w"
                        ? "Your turn"
                        : "Opponent turn"
                )
                : (
                    myColor === "w"
                        ? "Opponent turn"
                        : "Your turn"
                );


        blackStatus.textContent =
            turn === "b"
                ? (
                    myColor === "b"
                        ? "Your turn"
                        : "Opponent turn"
                )
                : (
                    myColor === "b"
                        ? "Opponent turn"
                        : "Your turn"
                );

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


/* =========================================================
   NEW GAME
========================================================= */

function newGame() {

    board =
        createInitialBoard();

    turn = "w";

    selected = null;

    history = [];

    lastMove = null;

    gameOver = false;

    animationInProgress = false;

    lastLocalMoveId = null;
    lastReceivedMoveId = null;


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


    gameOverModal.classList.add(
        "hidden"
    );


    renderBoard();

    startClock();
}


/* =========================================================
   NEW GAME BUTTON
========================================================= */

newGameButton.addEventListener(
    "click",
    () => {

        /*
         * In multiplayer don't overwrite
         * an existing online room.
         */

        if (
            modeElement.value === "multiplayer" &&
            currentRoom
        ) {

            roomStatus.textContent =
                "Start a new room for a new multiplayer game.";

            return;
        }

        newGame();
    }
);


newGameButton2.addEventListener(
    "click",
    newGame
);


/* =========================================================
   UNDO
========================================================= */

undoButton.addEventListener(
    "click",
    () => {

        if (
            history.length === 0 ||
            animationInProgress
        ) {
            return;
        }


        /*
         * Disable normal Undo online.
         * Otherwise two clients can diverge.
         */

        if (
            modeElement.value === "multiplayer"
        ) {

            roomStatus.textContent =
                "Undo is disabled in Multiplayer.";

            return;
        }


        const previous =
            history.pop();


        board =
            previous.board;

        turn =
            previous.turn;


        if (previous.clocks) {

            clocks =
                previous.clocks;
        }


        selected = null;

        lastMove = null;

        renderBoard();
    }
);


/* =========================================================
   TIME CHANGE
========================================================= */

timeControl.addEventListener(
    "change",
    () => {

        if (
            modeElement.value === "multiplayer" &&
            currentRoom
        ) {

            roomStatus.textContent =
                "Time cannot be changed during an online game.";

            return;
        }

        newGame();
    }
);


/* =========================================================
   MODE CHANGE
========================================================= */

modeElement.addEventListener(
    "change",
    () => {

        if (roomUnsubscribe) {

            roomUnsubscribe();

            roomUnsubscribe = null;
        }


        currentRoom = null;
        lastLocalMoveId = null;
        lastReceivedMoveId = null;


        roomControls.classList.toggle(
            "hidden",
            modeElement.value !== "multiplayer"
        );


        if (
            modeElement.value === "multiplayer"
        ) {

            roomStatus.textContent =
                currentUser
                    ? "Firebase connected. Create or join a room."
                    : "Connecting to Firebase...";

        } else {

            roomStatus.textContent =
                "Not connected";
        }


        newGame();
    }
);


/* =========================================================
   FIREBASE AUTH
========================================================= */

signInAnonymously(auth)
    .then(() => {

        console.log(
            "Firebase anonymous authentication started."
        );

    })
    .catch(error => {

        console.error(
            "Firebase authentication error:",
            error
        );

        roomStatus.textContent =
            "Firebase Auth error: " +
            error.code;
    });


onAuthStateChanged(
    auth,
    user => {

        currentUser =
            user || null;


        if (currentUser) {

            console.log(
                "Firebase user:",
                currentUser.uid
            );


            if (
                modeElement.value === "multiplayer"
            ) {

                roomStatus.textContent =
                    "Firebase connected. Create or join a room.";
            }

        } else {

            roomStatus.textContent =
                "Firebase authentication required.";
        }
    }
);


/* =========================================================
   GENERATE ROOM ID
========================================================= */

function generateRoomId() {

    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}


/* =========================================================
   CREATE ROOM
========================================================= */

createRoomButton.addEventListener(
    "click",
    async () => {

        if (!currentUser) {

            roomStatus.textContent =
                "Connecting to Firebase...";

            return;
        }


        /*
         * Close old listener.
         */

        if (roomUnsubscribe) {

            roomUnsubscribe();

            roomUnsubscribe = null;
        }


        currentRoom =
            generateRoomId();

        myColor = "w";


        roomIdElement.value =
            currentRoom;


        /*
         * Always create a fresh board.
         */

        newGame();


        const roomRef =
            doc(
                db,
                "rooms",
                currentRoom
            );


        try {

            await setDoc(
                roomRef,
                {

                    hostUid:
                        currentUser.uid,

                    guestUid:
                        null,

                    board:
                        JSON.stringify(board),

                    turn:
                        "w",

                    clocks:
                        {
                            ...clocks
                        },

                    status:
                        "waiting",

                    lastMoveId:
                        null,

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                }
            );


            roomStatus.textContent =
                "Room created: " +
                currentRoom +
                ". Waiting for opponent...";


            listenRoom();

        } catch (error) {

            console.error(
                "Create room error:",
                error
            );

            roomStatus.textContent =
                "Create room error: " +
                error.code;
        }
    }
);


/* =========================================================
   JOIN ROOM
========================================================= */

joinRoomButton.addEventListener(
    "click",
    async () => {

        if (!currentUser) {

            roomStatus.textContent =
                "Connecting to Firebase...";

            return;
        }


        const roomId =
            roomIdElement.value
                .trim()
                .toUpperCase();


        if (!roomId) {

            roomStatus.textContent =
                "Enter Room ID.";

            return;
        }


        const roomRef =
            doc(
                db,
                "rooms",
                roomId
            );


        try {

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


            /*
             * Already another guest?
             */

            if (
                data.guestUid &&
                data.guestUid !== currentUser.uid
            ) {

                roomStatus.textContent =
                    "Room is full.";

                return;
            }


            /*
             * Don't allow host to join
             * his own room as Black.
             */

            if (
                data.hostUid === currentUser.uid
            ) {

                currentRoom =
                    roomId;

                myColor = "w";

                roomStatus.textContent =
                    "You are already the host of this room.";

                listenRoom();

                return;
            }


            currentRoom =
                roomId;

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
                "Joined room " +
                roomId +
                " as Black.";


            listenRoom();

        } catch (error) {

            console.error(
                "Join room error:",
                error
            );

            roomStatus.textContent =
                "Join room error: " +
                error.code;
        }
    }
);


/* =========================================================
   LISTEN ROOM
========================================================= */

function listenRoom() {

    if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe = null;
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

                if (!snapshot.exists()) {

                    roomStatus.textContent =
                        "Room was deleted.";

                    return;
                }


                const data =
                    snapshot.data();


                /*
                 * Determine color.
                 */

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


                /*
                 * Room status.
                 */

                if (
                    data.status === "waiting"
                ) {

                    roomStatus.textContent =
                        "Room " +
                        currentRoom +
                        " — waiting for opponent...";
                }

                if (
                    data.status === "playing"
                ) {

                    roomStatus.textContent =
                        "Room " +
                        currentRoom +
                        " — online";
                }


                /*
                 * Important:
                 *
                 * If this snapshot is our own move,
                 * don't redraw the board again.
                 */

                const snapshotMoveId =
                    data.lastMoveId || null;


                const isOurSnapshot =
                    snapshotMoveId &&
                    snapshotMoveId ===
                    lastLocalMoveId;


                /*
                 * Always update opponent joining.
                 */

                if (
                    data.guestUid &&
                    data.status === "playing"
                ) {

                    if (
                        myColor === "w"
                    ) {

                        blackStatus.textContent =
                            "Opponent connected";
                    } else {

                        whiteStatus.textContent =
                            "Opponent connected";
                    }
                }


                /*
                 * Apply remote state only
                 * when it wasn't created by us.
                 */

                if (
                    !isOurSnapshot &&
                    !animationInProgress &&
                    data.board
                ) {

                    board =
                        JSON.parse(
                            data.board
                        );


                    if (data.turn) {

                        turn =
                            data.turn;
                    }


                    if (data.clocks) {

                        clocks =
                            {
                                ...data.clocks
                            };
                    }


                    lastReceivedMoveId =
                        snapshotMoveId;


                    selected = null;


                    renderBoard();


                    checkGameEnd();
                }


                /*
                 * If no move has happened yet,
                 * synchronize initial state.
                 */

                if (
                    !data.lastMoveId &&
                    data.board &&
                    !animationInProgress
                ) {

                    board =
                        JSON.parse(
                            data.board
                        );

                    turn =
                        data.turn || "w";

                    if (data.clocks) {

                        clocks =
                            {
                                ...data.clocks
                            };
                    }

                    renderBoard();
                }

            },

            error => {

                console.error(
                    "Firestore listener error:",
                    error
                );

                roomStatus.textContent =
                    "Room connection error: " +
                    error.code;
            }
        );
}


/* =========================================================
   SYNC ROOM
========================================================= */

async function syncRoom(
    moveId = null
) {

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

                turn:
                    turn,

                clocks:
                    {
                        ...clocks
                    },

                lastMoveId:
                    moveId,

                updatedAt:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.error(
            "Firebase sync error:",
            error
        );

        roomStatus.textContent =
            "Sync error: " +
            error.code;
    }
}


/* =========================================================
   START
========================================================= */

roomControls.classList.add("hidden");

newGame();
