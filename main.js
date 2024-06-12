const readline = require("readline");
const mysql = require("mysql");
const mssql = require("mssql");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
require("dotenv").config();

const fs = require("fs");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Database credentials and configurations for both MySQL/MariaDB and MS SQL
const dbConfigs = {
  mariadb: {
    host: process.env.MARIADB_HOST || "root",
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    port: process.env.MARIADB_PORT || "3306", // Default MariaDB port is 3306
  },
  mssql: {
    user: process.env.MSSQL_USER || "root",
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    port: process.env.MSSQL_PORT || "1433", // Default MSSQL port is 1433
    // options: {
    //   encrypt: true, // For Azure SQL Database
    //   enableArithAbort: true,
    // },
  },
};

let connection; // This will store the database connection

/**
 * Executes an SQL script from a given file path on a specified database type.
 *
 * @param {string} filePath - The path to the SQL script file.
 * @param {string} dbType - The type of database where the SQL will be executed ('mssql' or 'mariadb').
 * @returns {Promise<Object|void>} A promise that resolves with the execution results for 'mariadb', or void for 'mssql'.
 */
const executeSqlFile = async (filePath, dbType) => {
  try {
    const sql = await fs.promises.readFile(filePath, "utf-8");

    let result;
    switch (dbType) {
      case "mssql":
        const mssqlRequest = new mssql.Request();
        result = await mssqlRequest.query(sql);
        break;
      case "mariadb":
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
const runScript = async (scriptName, dbType) => {
  try {
    const { stdout, stderr } = await execPromise(`node ${scriptName}`);
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
  // Transform the script name to match the SQL naming convention
  return `add_${scriptName.replace("gen_", "t_").replace(".js", "")}.sql`;
};

/**
 * Initializes the command-line interface to prompt the user for database configuration and script execution options.
 */
rl.question(
  "Choose DB Configuration:\n\n1 -> MariaDB\n2 -> MS SQL\n\nYour choice: ",
  async (dbChoice) => {
    const dbType = dbChoice.trim() === "1" ? "mariadb" : "mssql";
    const dbConfig = dbConfigs[dbType];

    try {
      // Establish a connection to the chosen database
      await connectToDatabase(dbType, dbConfig);
      console.log(`Connected to ${dbType.toUpperCase()} server.`);

      // Prompt the user for the desired operation
      rl.question(
        "\nChoose an option:\n1 -> Generate and Add Access Group\n2 -> Generate and Add Door\n3 -> Generate and Add Zone\n4 -> Generate and Add All\nYour choice: ",
        async (option) => {
          const scriptMap = {
            1: "gen_acsgr.js",
            2: "gen_dr.js",
            3: "gen_zn.js",
          };

          const selectedScript = scriptMap[option.trim()] || null;

          if (selectedScript) {
            await runScript(selectedScript, dbType);
          } else if (option.trim() === "4") {
            await runScript("gen_acsgr.js", dbType);
            await runScript("gen_dr.js", dbType);
            await runScript("gen_zn.js", dbType);
          } else {
            console.log("Invalid choice!");
          }

          rl.close();
        }
      );
    } catch (err) {
      console.error("Error connecting to the database:", err);
      rl.close();
    }
  }
);

/**
 * Connects to the specified database using the provided configuration.
 *
 * @param {string} dbType - The type of database to connect to ('mariadb' or 'mssql').
 * @param {Object} dbConfig - The configuration object for the database connection.
 * @returns {Promise<void>} A promise that resolves once the connection is established.
 */
const connectToDatabase = async (dbType, dbConfig) => {
  if (dbType === "mssql") {
    // Connect using MS SQL
    await mssql.connect(dbConfig);
  } else {
    // Connect using MariaDB/MySQL
    connection = mysql.createConnection(dbConfig);
    connection.connect();
  }
};
rl.on("close", () => {
  if (connection) {
    connection.end();
  }
  if (mssql.connected) {
    mssql.close();
  }
});
