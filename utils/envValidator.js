const requiredEnvVars = {
    mariadb: [
        'MARIADB_HOST',
        'MARIADB_USER',
        'MARIADB_PASSWORD',
        'MARIADB_DATABASE',
        'MARIADB_PORT',
    ],
    mssql: [
        'MSSQL_USER',
        'MSSQL_PASSWORD',
        'MSSQL_SERVER',
        'MSSQL_DATABASE',
        'MSSQL_PORT',
    ],
};

const validateEnv = (dbType) => {
    const varsToCheck = requiredEnvVars[dbType];
    const missing = varsToCheck.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables for ${dbType}:\n` +
            missing.map((varName) => `  - ${varName}`).join('\n')
        );
    }

    return true;
};

module.exports = { validateEnv };