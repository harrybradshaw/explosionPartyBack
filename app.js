const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const GameState = require('./models/gameState');

const app = express();
const expressWs = require('express-ws')(app);
const wss = expressWs.getWss()

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    indentedSyntax: true, // true = .sass and false = .scss
    sourceMap: true
}));


app.use(function (req, res, next) {
    req.testing = 'testing';
    return next();
});

app.get('/', function(req, res, next){
    res.end();
});

app.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
        console.log(msg);
        ws.send(JSON.stringify(wss.clients))
    });
});

let counter = 0;

let timeout;

let gameState = new GameState();

const handleUpdatePrompt = (newPrompt) => {
    gameState.selectedPrompt = gameState.promptOptions.find(prompt => prompt.prompt === newPrompt);
    wss.clients.forEach(client => {
        client.send(JSON.stringify({
            word: gameState.selectedPrompt.prompt,
            status: 'OK',
        }));
    });
};

const handleHardReset = () => {
    gameState = new GameState();
}

const handleSoftReset = () => {
    gameState.givenAnswers = new Set;
    gameState.players.forEach(player => {
        player.lives = 3;
        player.isReady = false;
        player.lastTyped = '';
    });
    gameState.setGameIsRunning(false);
}

const handleTimerExpired = (guesserId) => {
    const index = gameState.players.findIndex(player => player.id === guesserId)
    if (index >= 0) {
        gameState.players[index].lives -= 1;
    }
    const filteredPlayers = gameState.players.filter(player => player.lives > 0);
    if (filteredPlayers.length > 1) {
        sendExplosionToAll();
        updateGuesser();
    } else {
        sendExplosionToAll();
        handleSoftReset();
        sendCurrentGuesserToAll();
        sendGameStateToAll();
    }
}

const updateGuesser = () => {
    const total = wss.clients.size;
    counter = (counter + 1) % total;
    const guesserId = gameState.players[counter].id;
    timeout = setTimeout(() => handleTimerExpired(guesserId), 5000);
    sendGameStateToAll();
    wss.clients.forEach(client => {
        sendGameStateToClient(client);
        sendCurrentGuesser(client);
    })
}

const sendCurrentGuesserToAll = () => {
    wss.clients.forEach(client => sendCurrentGuesser(client))
}

const sendCurrentGuesser = (client) => {
    const guesserId = gameState.gameIsRunning
        ? gameState.players[counter].id
        : undefined;
    client.send(JSON.stringify({currentGuesser: guesserId ?? ''}));
}

const checkCorrect = (guess) => {
    return gameState.selectedPrompt.answers.includes(guess) && !gameState.givenAnswers.has(guess);
}

const lookupClientId = (id) => {
    const index = gameState.players.map(client => client.id).indexOf(id);
    if (index > -1) {
        const name = gameState.players[index].friendlyName;
        return name ?? id;
    }
    return id;
}

const setUsername = (id, username) => {
    const index = gameState.players.map(player => player.id).indexOf(id);
    if (index > -1) {
        gameState.players[index].friendlyName = username ? username : undefined;
    }
    sendGameStateToAll();
}

wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

const sendGameStateToAll = () => {
    const {selectedPrompt, promptOptions, ...publicGameState} = gameState;
    wss.clients.forEach(client => {
        client.send(JSON.stringify({
            ...publicGameState,
            message: 'OK',
        }));
    })
}

const sendGameStateToClient = (client) => {
    const {selectedPrompt, promptOptions, ...publicGameState} = gameState;
    client.send(JSON.stringify(publicGameState));
}

const sendExplosionToAll = () => {
    wss.clients.forEach(client => {
        client.send(JSON.stringify({explosion: 'explosion'}));
    })
}

const sendPrompt = (ws) => {
    ws.send(JSON.stringify({word: gameState.selectedPrompt?.prompt}));
}

const sendPromptOptions = (ws) => {
    const prompts = gameState.promptOptions.map(prompt => prompt.prompt)
    ws.send(JSON.stringify({promptOptions: prompts}))
}

const handleUserInput = (id, value) => {
    const playerId = gameState.players.findIndex(player => player.id === id);
    if (playerId >= 0) {
        gameState.players[playerId].lastTyped = value;
        sendGameStateToAll();
    }
}

const handleJoin = (ws) => {
    console.log('client connected');
    ws.id = wss.getUniqueID();
    gameState.addPlayer(ws.id);
    ws.send(JSON.stringify({id: ws.id}));
    sendGameStateToAll();
    sendPromptOptions(ws);
    sendPrompt(ws);
}

wss.on('connection', ws => {
    handleJoin(ws);
    ws.on('close', () => {
        console.log('client closed the connection');
        gameState.players = gameState.players.filter(player => player.id !== ws.id);
        if (wss.clients.size){
            counter = counter % wss.clients.size;
        }
        if (wss.clients.size === 0){
            handleHardReset();
        } else if (gameState.players.every(player => player.isReady) && wss.clients.size > 1){
            handleStartGame();
        }
        sendGameStateToAll();
    })
});

const handlePlayerReady = (id) => {
    const playerIndex = gameState.players.findIndex(player => player.id === id);
    if (playerIndex >= 0) {
        gameState.players[playerIndex].isReady = true;
    }

    if (gameState.players.every(player => player.isReady)){
        handleStartGame();
    }
    sendGameStateToAll();
}

const handleStartGame = () => {
    console.log('Staring game');
    gameState.setGameIsRunning(true);
    updateGuesser();
}

const handleGuess = (ws, guess) => {
    const sanitisedGuess = guess.toLowerCase();
    const isCorrect = checkCorrect(sanitisedGuess);
    const response = {
        wasCorrect: isCorrect,
    };
    if(!gameState.gameIsRunning){
        gameState.setGameIsRunning(true);
    }

    ws.send(JSON.stringify(response));
    if (isCorrect){
        clearTimeout(timeout);
        gameState.addAnswer(guess);
        updateGuesser();
    }
}

app.ws('/lobby', (ws, req) => {
    ws.on('message', (msg) => {
        const parsed = JSON.parse(msg);
        if (parsed['event']) {
            console.log(msg);
            switch (parsed['event']){
                default:
                case 'join':
                    break;
                case 'guess':
                    handleGuess(ws, parsed['guess']);
                    break;
                case 'typing':
                    handleUserInput(ws.id, parsed['value']);
                    break;
                case 'usernameUpdate':
                    setUsername(ws.id, parsed['value']);
                    break;
                case 'playerReady':
                    handlePlayerReady(ws.id);
                    break;
                case 'promptSelected':
                    handleUpdatePrompt(parsed['value']);
                    break;
            }
        }
    });
});

const port = process.env.PORT || 3000;
app.listen(port);
