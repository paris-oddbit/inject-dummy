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

const executeSqlFile = async (filePath, dbType) => {
  try {
    const sql = await fs.promises.readFile(filePath, { encoding: "utf-8" });

    if (dbType === "mssql") {
      const request = new mssql.Request();
      const result = await request.query(sql);
      console.log(`Executed ${filePath} successfully:`, result);
    } else {
      // mariadb
      return new Promise((resolve, reject) => {
        connection.query(sql, (err, results) => {
          if (err) {
            console.error("Error executing SQL:", err);
            reject(err);
          } else {
            console.log(`Executed ${filePath} successfully:`, results);
            resolve(results); // Only use resolve within the Promise constructor
          }
        });
      });
    }
  } catch (error) {
    console.error("Error reading SQL file:", error);
  }
};

const runScript = async (scriptName, dbType) => {
  try {
    // Await the completion of the script execution
    const { stdout, stderr } = await execPromise(`node ${scriptName}`);
    console.log(`Output from ${scriptName}:`, stdout);

    if (stderr) {
      console.error(`Error in script ${scriptName}:`, stderr);
      return;
    }

    // Build the correct SQL file name based on the scriptName
    const sqlFilename = `add_${scriptName
      .replace("gen_", "t_")
      .replace(".js", "")}.sql`;
    console.log(`Attempting to execute SQL file: ${sqlFilename}`);
    await executeSqlFile(sqlFilename, dbType);
  } catch (error) {
    console.error(`Error executing script ${scriptName}:`, error);
  }
};

rl.question(
  "Choose DB Configuration:\n1 -> MariaDB\n2 -> MS SQL\nYour choice: ",
  async (dbChoice) => {
    let dbType = dbChoice.trim() === "1" ? "mariadb" : "mssql";
    let dbConfig = dbConfigs[dbType];

    try {
      if (dbType === "mssql") {
        // Connect using MS SQL
        await mssql.connect(dbConfig);
        console.log("Connected to MS SQL Server");
      } else {
        // Connect using MariaDB/MySQL
        connection = mysql.createConnection(dbConfig);
        connection.connect();
        console.log("Connected to MariaDB/MySQL");
      }

      rl.question(
        "Choose an option:\n1 -> Generate and Add Access Group\n2 -> Generate and Add Door\n3 -> Generate and Add Zone\n4 -> Generate and Add All\nYour choice: ",
        async (answer) => {
          switch (answer.trim()) {
            case "1":
              await runScript("gen_acsgr.js", dbType);
              break;
            case "2":
              await runScript("gen_dr.js", dbType);
              break;
            case "3":
              await runScript("gen_zn.js", dbType);
              break;
            case "4":
              await runScript("gen_acsgr.js", dbType);
              await runScript("gen_dr.js", dbType);
              await runScript("gen_zn.js", dbType);
              break;
            default:
              console.log("Invalid choice!");
              break;
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

rl.on("close", () => {
  if (connection) {
    connection.end();
  }
  if (mssql.connected) {
    mssql.close();
  }
});
