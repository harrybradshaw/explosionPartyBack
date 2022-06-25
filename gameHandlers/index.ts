import GameState from "../models/gameState";
import {WebSocketServer, WebSocket} from "ws";
import gameSenders from "../gameSenders";
import GameSettings from "../models/gameSettings";

const getUniqueID = () => {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

export default (websocketServer: WebSocketServer) => {
    let counter = 0;
    let timeout: NodeJS.Timeout;
    let gameState = new GameState();
    const senders = gameSenders(websocketServer);

    const handleGuess = (websocketConnection: WebSocket, guess: string) => {
        const sanitisedGuess = guess.toLowerCase();
        const isCorrect = checkCorrect(sanitisedGuess);
        const response = {
            wasCorrect: isCorrect,
        };
        !gameState.gameIsRunning && gameState.setGameIsRunning(true);
        websocketConnection.send(JSON.stringify(response));
        if (isCorrect){
            clearTimeout(timeout);
            gameState.addAnswer(guess);
            gameState.givenAnswers.size === gameState.selectedPrompt?.answers.length
                ? handleGameOver(GameOverReason.OutOfPossibleAnswers)
                : updateGuesser();
        }
    }

    const handleStartGame = () => {
        console.log('Staring game');
        gameState.setGameIsRunning(true);
        updateGuesser();
    }

    const handlePlayerReady = (id: string) => {
        const playerIndex = gameState.players.findIndex(player => player.id === id);
        if (playerIndex >= 0) {
            gameState.players[playerIndex].isReady = true;
        }
        gameState.players.every(player => player.isReady) && handleStartGame();
        senders.sendGameStateToAll(gameState);
    }

    const handleJoin = (ws: WebSocket) => {
        console.log('client connected');
        // @ts-ignore
        ws.id = getUniqueID();
        // @ts-ignore
        gameState.addPlayer(ws.id);
        // @ts-ignore
        ws.send(JSON.stringify({id: ws.id}));
        senders.sendGameSettingsToClient(ws, gameState);
        senders.sendGameStateToAll(gameState);
        senders.sendPromptOptions(ws, gameState);
        senders.sendPrompt(ws, gameState);
    }

    const handleClose = (webSocket: WebSocket) => {
        // @ts-ignore
        console.log(`client ${webSocket.id} closed the connection`);
        // @ts-ignore
        gameState.players = gameState.players.filter(player => player.id !== webSocket.id);
        if (websocketServer.clients.size){
            counter = counter % websocketServer.clients.size;
        }
        if (websocketServer.clients.size === 0){
            handleHardReset();
        } else if (gameState.players.every(player => player.isReady) && websocketServer.clients.size > 1){
            handleStartGame();
        }
        senders.sendGameStateToAll(gameState);
    }

    const setUsername = (id: string, username: string) => {
        const index = gameState.players.map(player => player.id).indexOf(id);
        if (index > -1) {
            gameState.players[index].friendlyName = username ? username : undefined;
        }
        senders.sendGameStateToAll(gameState);
    }


    const handleUserInput = (id: string, value: string) => {
        const playerId = gameState.players.findIndex(player => player.id === id);
        if (playerId >= 0) {
            gameState.players[playerId].lastTyped = value;
            senders.sendGameStateToAll(gameState);
        }
    }

    const checkCorrect = (guess: string) => {
        return gameState.selectedPrompt?.answers.includes(guess) && !gameState.givenAnswers.has(guess);
    }

    const updateGuesser = () => {
        const total = websocketServer.clients.size;
        counter = (counter + 1) % total;
        while (gameState.players[counter].lives <= 0){
            counter = (counter + 1) % total;
        }
        const guesserId = gameState.players[counter].id;
        timeout = setTimeout(() => handleTimerExpired(guesserId), gameState.settings.defaultTimeout * 1000);
        senders.sendGameStateToAll(gameState);
        websocketServer.clients.forEach(client => {
            senders.sendGameStateToClient(client, gameState);
            senders.sendCurrentGuesser(client, gameState, counter);
        })
    }

    const handleTimerExpired = (guesserId: string) => {
        const index = gameState.players.findIndex(player => player.id === guesserId)
        if (index >= 0) {
            gameState.players[index].lives -= 1;
        }
        const filteredPlayers = gameState.players.filter(player => player.lives > 0);
        senders.sendExplosionToAll();
        if (filteredPlayers.length > 1) {
            updateGuesser();
        } else {
            handleGameOver(GameOverReason.OnePlayerLeft);
            handleSoftReset();
            senders.sendCurrentGuesserToAll(gameState, counter);
            senders.sendGameStateToAll(gameState);
        }
    }

    const handleGameOver = (reason: GameOverReason) => {
        senders.sendGameOverToAll(
            reason,
            gameState.players.filter(player => player.lives > 0).map(player => player.id)
        );
    }

    const handleHardReset = () => {
        gameState = new GameState();
    }

    const handleSoftReset = () => {
        gameState.givenAnswers = new Set;
        gameState.players.forEach(player => {
            player.lives = gameState.settings.startingLives;
            player.isReady = false;
            player.lastTyped = '';
        });
        gameState.setGameIsRunning(false);
    }

    const handleUpdatePrompt = (newPrompt: string) => {
        gameState.selectedPrompt = gameState.promptOptions.find(prompt => prompt.prompt === newPrompt);
        gameState.selectedPrompt && websocketServer.clients.forEach(client => {
            client.send(JSON.stringify({
                word: gameState.selectedPrompt?.prompt,
                status: 'OK',
            }));
        });
    };

    const handleSettingsUpdate = (newSettings: GameSettings) => {
        gameState.settings = newSettings;
        gameState.players.forEach(player => player.lives = newSettings.startingLives);
        senders.sendSettingsToAll(gameState);
        senders.sendGameStateToAll(gameState);
    }

    return {
        handleGuess,
        handleStartGame,
        handleSoftReset,
        handleJoin,
        handleHardReset,
        handlePlayerReady,
        handleUserInput,
        setUsername,
        updateGuesser,
        handleUpdatePrompt,
        handleClose,
        handleSettingsUpdate,
    }
}
