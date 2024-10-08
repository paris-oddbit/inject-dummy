const fs = require('fs');

// Helper function to generate random integers
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// Helper function to generate random characters from specified options
const randomChar = (options) => options[randomInt(0, options.length - 1)];

function createInsertQuery(numRecords, dbType) {
  let genDate, lastUpdate;
  if (dbType === 'mariadb') {
    genDate = 'NOW()';
    lastUpdate = `FROM_UNIXTIME(${lastUpdate})`;
  } else {
    genDate = 'GETDATE()';
    lastUpdate = `DATEADD(SECOND, ${lastUpdate}, '1970-01-01')`;
  }

  const baseQuery =
    'INSERT INTO t_zn (NM, DSCR, TYP, ISGLB, LSTUDT, DEL, DELDT, STA, ENB) VALUES ';
  let valuesList = [];

  for (let i = 1; i <= numRecords; i++) {
    const name = `Test Zone ${i}`;
    const description = `Zone generated from script ${i}`;
    const type = randomInt(0, 5); // Random type between 0 and 11
    /* 
    ZONE_TYPE_APB             = 0x00,
    ZONE_TYPE_FIREALARM       = 0x01,
    ZONE_TYPE_FORCED_LOCK     = 0x02,
    ZONE_TYPE_FORCED_UNLOCK   = 0x03,
    ZONE_TYPE_TIMED_APB       = 0x04,
    ZONE_TYPE_RESERVE         = 0x05,
    ZONE_TYPE_INTRUSIONALARM  = 0x06,
    ZONE_TYPE_INTER_LOCK      = 0x07,
    ZONE_TYPE_MUSTER          = 0x08,
    ZONE_TYPE_LIFT_LOCK       = 0x09,
    ZONE_TYPE_LIFT_UNLOCK     = 0x0A,
    ZONE_TYPE_OCCUPANCY_LIMIT = 0x0B,
    ZONE_TYPE_MAX_COUNT
    */
    const isGlobal = 'Y';
    const lastUpdate = randomInt(1620000000, 1629999999); // Random Unix timestamp
    const deleted = 'N';
    const deleteDate = deleted === 'Y' ? genDate : 'NULL'; // Set delete date if deleted
    const status = 0;
    const enabled = 'Y';

    valuesList.push(
      `('${name}', '${description}', ${type}, '${isGlobal}', ${lastUpdate}, '${deleted}', ${deleteDate}, ${status}, '${enabled}')`
    );
  }

  const fullQuery = baseQuery + valuesList.join(', ') + ';';
  return fullQuery;
}

// Generate SQL query for 1000 records
const sqlQuery = createInsertQuery(1000, process.argv[2]);

// Write the generated SQL to a file
fs.writeFile('add_t_zn.sql', sqlQuery, (err) => {
  if (err) {
    console.error('Error writing to file:', err);
  } else {
    console.log('Successfully wrote SQL to file add_t_zn.sql');
  }
});
