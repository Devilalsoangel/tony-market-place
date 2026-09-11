const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/susej' });
  await c.connect();
  const r = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log("Tables:", r.rows.map(x=>x.tablename).join(', '));
  
  // Check if Admin table exists
  const adminCheck = await c.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='Admin')");
  console.log("Admin exists:", adminCheck.rows[0].exists);
  
  // Check count of key tables
  for (const t of ['User', 'Seller', 'Product', 'Order', 'Review', 'Post', 'Admin']) {
    try {
      const cnt = await c.query(`SELECT count(*) as c FROM "${t}"`);
      console.log(`${t}: ${cnt.rows[0].c} rows`);
    } catch(e) {
      console.log(`${t}: ERROR - ${e.message.split('\n')[0]}`);
    }
  }
  await c.end();
}
main();
