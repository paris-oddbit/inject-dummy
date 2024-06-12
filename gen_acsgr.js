const fs = require("fs");

// Helper function to generate random dates within a range
const randomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

// Helper function to create an insert SQL query
function createInsertQuery(numRecords) {
  const baseQuery =
    "INSERT INTO t_acsgr (NM, DSCR, DEL, DELDT, LSTMOD, LSTMODDT) VALUES ";
  let valuesList = [];

  for (let i = 1; i <= numRecords; i++) {
    const name = `Test Access Group ${i}`;
    const description = `Access Group from script ${i}`;
    const del = "N";
    const delDate =
      del === "Y"
        ? `'${randomDate(new Date(2020, 0, 1), new Date())
            .toISOString()
            .slice(0, 19)
            .replace("T", " ")}'`
        : "NULL";
    const lastMod = 1;
    const lastModDate = `'${randomDate(new Date(2020, 0, 1), new Date())
      .toISOString()
      .slice(0, 19)
      .replace("T", " ")}'`;

    valuesList.push(
      `('${name}', '${description}', '${del}', ${delDate}, ${lastMod}, ${lastModDate})`
    );
  }

  const fullQuery = baseQuery + valuesList.join(", ") + ";";
  return fullQuery;
}

// Generate SQL query for 1000 records
const sqlQuery = createInsertQuery(1000);

// Write the generated SQL to a file
fs.writeFile("add_t_acsgr.sql", sqlQuery, (err) => {
  if (err) {
    console.error("Error writing to file:", err);
  } else {
    console.log("Successfully wrote SQL to file add_t_acsgr.sql");
  }
});
