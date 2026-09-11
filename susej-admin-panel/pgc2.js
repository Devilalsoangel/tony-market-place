const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:5432/susej'});
c.connect().then(()=>c.query('select count(*)::text as cnt from "User"')).then(r=>{console.log('PG OK',JSON.stringify(r.rows));return c.end()}).catch(e=>{console.log('PG ERR',e.code,(e.message||'').slice(0,1200));});
