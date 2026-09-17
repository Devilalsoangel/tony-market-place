// tools/pg-forward.mjs — Windows->WSL Postgres TCP forwarder (no admin needed)
// Usage: node tools/pg-forward.mjs [wslIp]   (default 172.28.86.216)
// WSL2 NAT localhost forwarding breaks after VM restarts; re-run after `wsl --shutdown`.
import net from "node:net";
const WIN_PORT = 5433;
const WSL_IP = process.argv[2] || "172.28.86.216";
const server = net.createServer((client) => {
  const upstream = net.connect(5432, WSL_IP);
  upstream.on("error", (e) => { console.error("upstream err:", e.message); client.destroy(); });
  client.on("error", () => upstream.destroy());
  client.pipe(upstream); upstream.pipe(client);
});
server.listen(WIN_PORT, "127.0.0.1", () => console.log(`pg-forward: 127.0.0.1:${WIN_PORT} -> ${WSL_IP}:5432`));
server.on("error", (e) => { console.error("forwarder error:", e.message); process.exit(1); });