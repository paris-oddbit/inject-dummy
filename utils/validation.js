const validateChoice = (choice, max) => {
    const num = parseInt(choice.trim());
    return !isNaN(num) && num >= 1 && num <= max;
};

const promptForValidChoice = async(rl, question, maxChoice) => {
    while (true) {
        const answer = await new Promise((resolve) =>
            rl.question(question, resolve)
        );
        if (validateChoice(answer, maxChoice)) {
            return answer;
        }
        console.error(
            `Invalid choice. Please enter a number between 1 and ${maxChoice}`
        );
    }
};

module.exports = { validateChoice, promptForValidChoice };