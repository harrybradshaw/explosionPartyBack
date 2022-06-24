module.exports = class Prompt {
    prompt;
    answers;

    constructor(question, answers) {
        this.prompt = question;
        this.answers = answers.map(answer => answer.toLowerCase());
    }
}
