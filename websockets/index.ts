import WebSocket from 'ws';
import * as http from 'http';
import gameHandlers from "../gameHandlers";
import GameSettings from "../models/gameSettings";

export default (expressServer: http.Server) => {
    const websocketServer = new WebSocket.Server({
        noServer: true,
        path: "/lobby",
    });

    const handlers = gameHandlers(websocketServer);

    expressServer.on("upgrade", (request, socket, head) => {
        websocketServer.handleUpgrade(request, socket, head, (websocket) => {
            websocketServer.emit("connection", websocket, request);
        });
    });

    setInterval(() => {
        console.log('keep')
        websocketServer.clients.forEach(client => {
            client.send(JSON.stringify('keepAlive'))
        })
    }, 5000)


    websocketServer.on(
        "connection",
        function connection(websocketConnection) {
            handlers.handleJoin(websocketConnection)
            websocketConnection.on("close", handlers.handleClose)
            websocketConnection.on("message", (message) => {
                // @ts-ignore
                const parsedMessage = JSON.parse(message);
                console.log(parsedMessage);
                if (parsedMessage['event']) {
                    switch (parsedMessage['event']){
                        default:
                        case 'join':
                            break;
                        case 'guess':
                            handlers.handleGuess(websocketConnection, parsedMessage['guess']);
                            break;
                        case 'typing':
                            // @ts-ignore
                            handlers.handleUserInput(websocketConnection.id, parsedMessage['value']);
                            break;
                        case 'usernameUpdate':
                            // @ts-ignore
                            handlers.setUsername(websocketConnection.id, parsedMessage['value']);
                            break;
                        case 'playerReady':
                            // @ts-ignore
                            handlers.handlePlayerReady(websocketConnection.id);
                            break;
                        case 'promptSelected':
                            handlers.handleUpdatePrompt(parsedMessage['value']);
                            break;
                        case 'settingsUpdate':
                            handlers.handleSettingsUpdate(parsedMessage['value'] as GameSettings);
                            break;
                    }
                }
            });
        }
    );

    return websocketServer;
};
