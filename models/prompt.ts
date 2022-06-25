export default class Prompt {
    prompt: string;
    answers: string[];

    constructor(question: string, answers: string[]) {
        this.prompt = question;
        this.answers = answers.map(answer => answer.toLowerCase());
    }
}
