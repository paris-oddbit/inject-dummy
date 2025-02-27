const readline = require('readline');
const mysql = require('mysql');
const mssql = require('mssql');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();
const config = require('./config');
const logger = require('./utils/logger');
const { promptForValidChoice } = require('./utils/validation');
const ProgressTracker = require('./utils/progress');
const { validateEnv } = require('./utils/envValidator');
const { closeConnections } = require('./db');

const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let connection; // This will store the database connection

/**
 * Executes an SQL script from a given file path on a specified database type.
 *
 * @param {string} filePath - The path to the SQL script file.
 * @param {string} dbType - The type of database where the SQL will be executed ('mssql' or 'mariadb').
 * @returns {Promise<Object|void>} A promise that resolves with the execution results for 'mariadb', or void for 'mssql'.
 */
const executeSqlFile = async(filePath, dbType) => {
    try {
        const sql = await fs.promises.readFile(filePath, 'utf-8');
        const connectionString =
            'server=localhost;Database=test;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}';

        let result;
        switch (dbType) {
            case 'mssql':
                const mssqlRequest = new mssql.Request();
                result = await mssqlRequest.query(sql);
                break;
            case 'mariadb':
                result = await new Promise((resolve, reject) => {
                    connection.query(sql, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
                break;
            default:
                throw new Error(`Database type ${dbType} is not supported`);
        }

        console.log(`Executed ${filePath} successfully:`, result);
    } catch (error) {
        console.error(`Failed to execute SQL file ${filePath}:`, error);
    }
};

/**
 * Executes a JavaScript migration script and subsequently runs the associated SQL script on the specified database.
 *
 * @param {string} scriptName - The name of the JavaScript migration script.
 * @param {string} dbType - The target database type for SQL execution ('mssql' or 'mariadb').
 * @returns {Promise<void>} A promise that resolves upon successful execution of both scripts.
 */
const runScript = async(scriptName, dbType) => {
    try {
        const { stdout, stderr } = await execPromise(
            `node ${scriptName} ${dbType}`
        );
        console.log(`Script output:`, stdout);

        if (stderr) {
            console.error(`Script error:`, stderr);
            return;
        }

        // Build the SQL filename from the JavaScript script name
        const sqlFilename = buildSqlFilename(scriptName);
        console.log(`Executing SQL file: ${sqlFilename}`);

        await executeSqlFile(sqlFilename, dbType);
    } catch (error) {
        console.error(`Execution error:`, error);
    }
};

/**
 * Generates the SQL filename corresponding to the given JavaScript script name.
 *
 * @param {string} scriptName - The name of the JavaScript migration script.
 * @returns {string} The built SQL filename.
 */
const buildSqlFilename = (scriptName) => {
    return `add_${scriptName.replace('gen_', 't_').replace('.js', '')}.sql`;
};

/**
 * Initializes the command-line interface to prompt the user for database configuration and script execution options.
 */
const initializeInterface = async() => {
    try {
        // Get database choice from user
        const dbChoice = await promptForValidChoice(
            rl,
            'Choose DB Configuration:\n\n1 -> MariaDB\n2 -> MS SQL\n\nYour choice: ',
            2
        );

        const dbType = dbChoice.trim() === '1' ? 'mariadb' : 'mssql';

        // Validate environment variables
        validateEnv(dbType);

        const dbConfig = config.databases[dbType];
        logger.info(`Selected database configuration: ${dbType}`);
        logger.debug('DB Config:', dbConfig);

        // Establish database connection
        await connectToDatabase(dbType, dbConfig);
        logger.info(`Connected to ${dbType.toUpperCase()} server.`);

        // Get operation choice from user
        const option = await promptForValidChoice(
            rl,
            '\nChoose an option:\n1 -> Generate and Add Access Group\n2 -> Generate and Add Door\n3 -> Generate and Add Zone\n4 -> Generate and Add All\nYour choice: ',
            4
        );

        const selectedScripts = config.scriptMap[option.trim()];

        if (!selectedScripts) {
            logger.error('Invalid choice! Please select options 1-4.');
            process.exit(1);
        } else if (Array.isArray(selectedScripts)) {
            try {
                logger.info('Starting execution of all scripts...');
                for (const script of selectedScripts) {
                    logger.info(`Executing ${script}...`);
                    await runScript(script, dbType);
                }
                logger.info('All scripts executed successfully!');
            } catch (error) {
                logger.error(
                    `Error executing multiple scripts: ${error.message}`,
                    error
                );
                process.exit(1);
            }
        } else {
            try {
                logger.info(`Executing ${selectedScripts}...`);
                await runScript(selectedScripts, dbType);
                logger.info('Script executed successfully!');
            } catch (error) {
                logger.error(
                    `Error executing script ${selectedScripts}: ${error.message}`,
                    error
                );
                process.exit(1);
            }
        }
    } catch (error) {
        logger.error('Application error:', error);
        process.exit(1);
    } finally {
        await closeConnections();
        rl.close();
    }
};

// Add process handlers for cleanup
process.on('SIGINT', async() => {
    logger.info('\nClosing database connections...');
    await closeConnections();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Promise Rejection:', error);
    process.exit(1);
});

// Start the application
initializeInterface().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});

/**
 * Connects to the specified database using the provided configuration.
 *
 * @param {string} dbType - The type of database to connect to ('mariadb' or 'mssql').
 * @param {Object} dbConfig - The configuration object for the database connection.
 * @returns {Promise<void>} A promise that resolves once the connection is established.
 */
const connectToDatabase = async(dbType, dbConfig) => {
    if (dbType === 'mssql') {
        // Connect using MS SQL
        await mssql.connect(dbConfig);
    } else {
        // Connect using MariaDB/MySQL
        connection = mysql.createConnection(dbConfig);
        connection.connect();
    }
};
rl.on('close', () => {
    if (connection && connection.end) {
        connection.end();
    }
    if (mssql && mssql.close) {
        mssql.close();
    }
});