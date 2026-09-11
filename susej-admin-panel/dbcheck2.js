const {Client}=require("pg");
(async()=>{
 const c=new Client({host:"127.0.0.1",port:5432,user:"postgres",password:"postgres",database:"susej"});
 await c.connect();
 const q=async(sql)=> (await c.query(sql)).rows;
 const users=await q("select username,name,phone,\"isSeller\",verification from \"User\" order by \"createdAt\"");
 console.log("USERS",JSON.stringify(users,null,2));
 const sellers=await q("select id,username,\"businessName\",category,\"kycStatus\",city from \"Seller\"");
 console.log("SELLERS",JSON.stringify(sellers,null,2));
 const posts=await q("select id,title,category,\"authorUsername\" from \"Post\" limit 5");
 console.log("POSTS",JSON.stringify(posts,null,2));
 await c.end();
})().catch(e=>{ console.error(e); });
