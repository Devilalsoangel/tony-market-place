const {Client}=require('pg');
(async()=>{
  const c=new Client({host:'127.0.0.1',port:5432,database:'susej',user:'postgres',password:'postgres'});
  await c.connect();
  console.log('connected');
  const r=await c.query("select schemaname, tablename from pg_tables where schemaname='public' order by tablename");
  console.log(r.rows.map(x=>x.tablename).join(', '));
  console.log('count tables',r.rowCount);
  // try prisma model names
  for (const tbl of ['User','Admin','Product','Order','Seller']) {
    try {
      const rr=await c.query(`select count(*)::text as cnt from "${tbl}"`);
      console.log(tbl, rr.rows[0].cnt);
    } catch(e){ console.log(tbl,'ERR',e.message.slice(0,120)); }
  }
  // try lower
  for (const tbl of ['user','admin','product']) {
    try {
      const rr=await c.query(`select count(*)::text as cnt from "${tbl}"`);
      console.log('low',tbl, rr.rows[0].cnt);
    } catch(e){}
  }
  // try without quotes lower
  try {
    const rr=await c.query(`select count(*)::text as cnt from public."User"`);
    console.log('public.User',rr.rows[0].cnt);
  } catch(e){ console.log('public.User ERR',e.message.slice(0,120)); }
  await c.end();
})();
