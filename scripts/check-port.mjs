import net from 'node:net';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
  console.error(`Usage: node scripts/check-port.mjs <port>`);
  process.exit(2);
}

const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is in use. Run \`npm run dev:kill\` to free it, or use \`npm run dev:fresh\`.`);
    process.exit(1);
  }
  console.error('Port check failed:', err);
  process.exit(1);
});

server.once('listening', () => {
  server.close(() => process.exit(0));
});

server.listen(port, '0.0.0.0');
