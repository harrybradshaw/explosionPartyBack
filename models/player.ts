export default class Player {
    id: string;
    isReady: boolean;
    friendlyName: string | undefined;
    lives: number;
    lastTyped: string;

    constructor(id: string, startingLives: number) {
        this.id = id;
        this.lives = startingLives;
        this.isReady = false;
        this.friendlyName = undefined;
        this.lastTyped = '';
    }

    assignName(name: string) {
        this.friendlyName = name;
    }

    setIsReady(state: boolean) {
        this.isReady = state;
    }

    setLastTyped(text: string) {
        this.lastTyped = text;
    }
}
