# Getting Started

To get started with this project, follow these steps:

## Step 1: Install Dependencies

Run the following command in your terminal:

```bash
npm install
```

This will install all the required dependencies for the project.

## Step 2: Set up Environment Variables

Before you can run the project, you need to set up the environment variables. Copy the contents of .env.example to a new file named .env in the root directory of the project.

Open the .env file and update the following variables with your own values:

### MariaDB Configuration

- MARIADB_HOST : The host for your MariaDB database.
- MARIADB_USER : The username for your MariaDB database.
- MARIADB_PASSWORD : The password for your MariaDB database.
- MARIADB_DATABASE : The name of your MariaDB database.
- MARIADB_PORT : The port for your MariaDB database.

### MSSQL Configuration

- MSSQL_USER : The username for your MSSQL database.
- MSSQL_PASSWORD : The password for your MSSQL database.
- MSSQL_SERVER : The server for your MSSQL database.
- MSSQL_DATABASE : The name of your MSSQL database.
- MSSQL_PORT : The port for your MSSQL database.
- WINDOWS_AUTH : Auth using windows auth (currently set to false as not supported yet).

### BioStar 2 Config

- BASE_URL : The base URL for the BioStar 2 API.
- LOGIN_ENDPOINT : The login endpoint for the BioStar 2 API.
- CARD_GENERATE_ENDPOINT : The card generation endpoint for the BioStar 2 API.
- USERS_ENDPOINT : API for users.
- GET_NEXT_USER_ID_ENDPOINT : API for getting next available user id.
- CARD_BLACKLIST_ENDPOINT : API for blacklist card, only support one card at a time.

### Login Credentials

- LOGIN_ID : The login ID for the BioStar 2 API.
- PASSWORD : The password for the BioStar 2 API.

Make sure to save the .env file before proceeding.

## Step 3: Generate Access Group, Door, Zone or All

To generate Access Group, Door, Zone or all, run the following command:

```bash
node main.js
```

This will use the database inject to generate the required data.
**\*NOTE:** You can update the required data on [Access Group](gen_acsgr.js), [Door](gen_dr.js), and [Zone](geb_zn.js).

## Step 4: Generate Cards for BioStar 2

To generate assigned and/or blacklist cards for BioStar 2, run the following command:

```bash
node generateCards.js true
```

This will use the BioStar 2 API to generate the assigned cards and blacklist certain number of cards.

**\*NOTE:** You can update the number of blacklisted on [Generate Card Data](generateCards.js)

To generate unassigned cards for BioStar 2, run the following command:

```bash
node generateCards.js false
```

This will use the BioStar 2 API to generate the unassigned cards.

**\*NOTE:** You can update the required data on [Generate Card Data](generateCards.js)

That's it! You're now ready to get started with this project.
