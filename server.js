const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    fs.readFile('index.html', 'utf8', (err, html) => {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(err ? 500 : 200);
        res.end(err ? '<h1>Missing Design File</h1><p>Please create index.html in this folder.</p>' : html);
    });
}).listen(3000, '0.0.0.0', () => {
    console.log('\n🚀 Barbershop System Operational!');
    console.log('👉 Open Workspace Link: http://127.0.0.1:3000\n');
});
