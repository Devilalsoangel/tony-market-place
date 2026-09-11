const { Client } = require('pg');
const host = process.argv[2] || '127.0.0.1';
const c = new Client({ host, port: 5432, user: 'susej', password: 'postgres', database: 'susej', connectionTimeoutMillis: 8000 });
c.connect()
  .then(() => c.query('SELECT version()'))
  .then((r) => { console.log('PG_OK host=' + host + ' :: ' + r.rows[0].version.slice(0, 40)); return c.end(); })
  .catch((e) => { console.log('PG_ERR host=' + host + ' :: ' + e.message); process.exit(1); });
