class ProgressTracker {
    constructor(total) {
        this.total = total;
        this.current = 0;
    }

    increment(scriptName) {
        this.current++;
        const percentage = ((this.current / this.total) * 100).toFixed(1);
        console.log(
            `[${this.current}/${this.total}] ${percentage}% - Completed ${scriptName}`
        );
    }
}

module.exports = ProgressTracker;