import {WebSocket, WebSocketServer} from "ws";
import GameState from "../models/gameState";

export default  (websocketServer: WebSocketServer) => {
    const sendExplosionToAll = () => {
        websocketServer.clients.forEach(client => {
            client.send(JSON.stringify({explosion: 'explosion'}));
        })
    }

    const sendSettingsToAll = (gameState: GameState) => {
        websocketServer.clients.forEach(client => sendGameSettingsToClient(client, gameState));
    };

    const sendGameSettingsToClient = (websocket: WebSocket, gameState: GameState) => {
        websocket.send(JSON.stringify({'settings': gameState.settings}));
    }

    const sendGameOverToAll = (reason: GameOverReason, winners: string[]) => {
        websocketServer.clients.forEach(client => {
            client.send(JSON.stringify({
                gameOver: reason,
                winners: winners,
            }));
        })
    }

    const sendPrompt = (ws: WebSocket, gameState: GameState) => {
        ws.send(JSON.stringify({word: gameState.selectedPrompt?.prompt}));
    }

    const sendPromptOptions = (ws: WebSocket, gameState: GameState) => {
        const prompts = gameState.promptOptions.map(prompt => prompt.prompt)
        ws.send(JSON.stringify({promptOptions: prompts}))
    }

    const sendGameStateToClient = (client: WebSocket, gameState: GameState) => {
        const {selectedPrompt, promptOptions, settings, ...publicGameState} = gameState;
        client.send(JSON.stringify(publicGameState));
    }

    const sendGameStateToAll = (gameState: GameState) => {
        const {selectedPrompt, promptOptions, settings, ...publicGameState} = gameState;
        websocketServer.clients.forEach(client => {
            client.send(JSON.stringify({
                ...publicGameState,
                message: 'OK',
            }));
        })
    }

    const sendCurrentGuesserToAll = (gameState: GameState, counter: number) => {
        websocketServer.clients.forEach(client => sendCurrentGuesser(client, gameState, counter))
    }

    const sendCurrentGuesser = (client: WebSocket, gameState: GameState, counter: number) => {
        const guesserId = gameState.gameIsRunning
            ? gameState.players[counter].id
            : undefined;
        client.send(JSON.stringify({currentGuesser: guesserId ?? ''}));
    }

    return {
        sendCurrentGuesser,
        sendCurrentGuesserToAll,
        sendExplosionToAll,
        sendGameStateToAll,
        sendGameStateToClient,
        sendPrompt,
        sendPromptOptions,
        sendGameOverToAll,
        sendSettingsToAll,
        sendGameSettingsToClient,
    }
}
