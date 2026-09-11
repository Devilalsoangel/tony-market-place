const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/susej' });
  await c.connect();
  
  // Find tables with broken tablespace references
  const r = await c.query(`
    SELECT c.relname, c.relfilenode, c.reltablespace
    FROM pg_class c
    WHERE c.relkind = 'r'
    ORDER BY c.relfilenode
  `);
  
  // Check which filenode maps to OID 3501
  console.log("Looking for OID 3501...");
  for (const row of r.rows) {
    if (row.relfilenode == 3501) {
      console.log("FOUND:", row.relname, "filenode:", row.relfilenode, "tablespace:", row.reltablespace);
    }
  }
  
  // Also check all tables
  console.log("\nAll tables with filenodes:");
  for (const row of r.rows) {
    console.log(`  ${row.relname}: filenode=${row.relfilenode}, tablespace=${row.reltablespace || '0 (pg_default)'}`);
  }
  
  await c.end();
}
main();
