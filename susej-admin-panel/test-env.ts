import "dotenv/config";
console.log("URL", process.env.DATABASE_URL?.slice(0,80));
console.log("starts postgres?", process.env.DATABASE_URL?.startsWith("postgres"));
console.log("first char code", process.env.DATABASE_URL?.charCodeAt(0));
