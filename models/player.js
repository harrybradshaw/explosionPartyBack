module.exports = class Player {
    id;
    isReady;
    friendlyName;
    lives;
    lastTyped;

    constructor(id) {
        this.id = id;
        this.lives = 3;
        this.isReady = false;
    }

    assignName(name) {
        this.friendlyName = name;
    }

    setIsReady(state) {
        this.isReady = state;
    }

    setLastTyped(text) {
        this.lastTyped = text;
    }
}
