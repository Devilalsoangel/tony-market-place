const net = require('net');
const {Client} = require('pg');
function testNet() {
  return new Promise((resolve)=>{
    const s = net.createConnection({host:'127.0.0.1',port:5432}, ()=>{
      console.log('NET TCP OK');
      s.end();
      resolve(true);
    });
    s.on('error', (e)=>{ console.log('NET ERR',e.code); resolve(false); });
    setTimeout(()=>{ console.log('NET TIMEOUT'); resolve(false); s.destroy(); },3000);
  });
}
async function testPg() {
  const c = new Client({host:'127.0.0.1',port:5432,database:'susej',user:'postgres',password:'postgres'});
  try {
    await c.connect();
    console.log('PG CONNECT OK');
    const r = await c.query('select count(*)::text as cnt from "User"');
    console.log('PG QUERY',r.rows);
    await c.end();
    return true;
  } catch(e) {
    console.log('PG ERR',e.code, (e.message||'').slice(0,800));
    console.log(e.stack?.slice(0,1200));
    return false;
  }
}
(async()=>{
  await testNet();
  await testPg();
  // also try via wsl ip
  const wslIp = '172.28.92.244';
  console.log('TRY WSL IP',wslIp);
  const c2 = new Client({host:wslIp,port:5432,database:'susej',user:'postgres',password:'postgres', connectionTimeoutMillis:3000});
  try {
    await c2.connect();
    console.log('PG WSLIP OK');
    const r = await c2.query('select count(*)::text as cnt from "User"');
    console.log(r.rows);
    await c2.end();
  } catch(e){ console.log('PG WSLIP ERR',e.code, (e.message||'').slice(0,600)); }
})();
