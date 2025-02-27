require('dotenv').config();

const config = {
    databases: {
        mariadb: {
            host: process.env.MARIADB_HOST,
            user: process.env.MARIADB_USER,
            password: process.env.MARIADB_PASSWORD,
            database: process.env.MARIADB_DATABASE,
            port: process.env.MARIADB_PORT || 3306,
        },
        mssql: {
            server: process.env.MSSQL_SERVER,
            database: process.env.MSSQL_DATABASE,
            driver: 'mssql',
            options: {
                port: parseInt(process.env.MSSQL_PORT, 10) || 1433,
                trustedConnection: true,
                enableArithAbort: true,
                trustServerCertificate: true,
            },
            authentication: process.env.WINDOWS_AUTH === 'true' ?
                {
                    type: 'ntlm',
                    options: {
                        userName: process.env.USERNAME || '',
                        password: '',
                        domain: process.env.USERDOMAIN || '',
                        useWindowsAuthentication: true,
                    },
                } :
                {
                    type: 'default',
                    options: {
                        userName: process.env.MSSQL_USER || 'root',
                        password: process.env.MSSQL_PASSWORD,
                    },
                },
        },
    },
    scriptMap: {
        1: 'gen_acsgr.js',
        2: 'gen_dr.js',
        3: 'gen_zn.js',
        4: ['gen_acsgr.js', 'gen_dr.js', 'gen_zn.js'],
    },
};

module.exports = config;