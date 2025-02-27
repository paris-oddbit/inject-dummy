const mysql = require('mysql');
const mssql = require('mssql');

let mariadbConnection = null;
let mssqlConnection = null;

const closeConnections = async() => {
    try {
        if (mariadbConnection) {
            await new Promise((resolve, reject) => {
                mariadbConnection.end((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('MariaDB connection closed');
        }
        if (mssqlConnection) {
            await mssqlConnection.close();
            console.log('MSSQL connection closed');
        }
    } catch (error) {
        console.error('Error closing database connections:', error);
        throw error;
    }
};

// Update main.js to use this
process.on('SIGINT', async() => {
    console.log('\nClosing database connections...');
    await closeConnections();
    process.exit(0);
});