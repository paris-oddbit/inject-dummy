const fs = require("fs");

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

function createInsertQuery(numRecords) {
  const baseQuery =
    "INSERT INTO t_dr (NM, DSCR, DEL, DRGRUID, OPDRTSS, LSTMOD, LSTMODDT) VALUES ";
  let valuesList = [];

  for (let i = 1; i <= numRecords; i++) {
    const name = `Test Door ${i}`;
    const description = `Door generated from script ${i}`;
    const delFlag = "N";
    const drgruid = 1;
    const opdrtss = 3;
    const lstmod = 0;
    valuesList.push(
      `('${name}', '${description}', '${delFlag}', ${drgruid}, ${opdrtss}, ${lstmod}, NOW())`
    );
  }

  const fullQuery = baseQuery + valuesList.join(", ") + ";";
  return fullQuery;
}

// Generate SQL query for 1000 records
const sqlQuery = createInsertQuery(1000);

// Write the generated SQL to a file
fs.writeFile("add_t_dr.sql", sqlQuery, (err) => {
  if (err) {
    console.error("Error writing to file:", err);
  } else {
    console.log("Successfully wrote SQL to file add_t_dr.sql");
  }
});
