const { spawn } = require('child_process');

class MCPSTDIOClient {
    constructor(pythonPath, serverPath) {
        this.pythonPath = pythonPath;
        this.serverPath = serverPath;
        this.process = null;
        this.requestId = 0;
    }

    async start() {
        // MCP server'ı child process olarak başlat
        this.process = spawn(this.pythonPath, [this.serverPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stderr.on('data', (data) => {
            console.error('Server stderr:', data.toString());
        });

        return new Promise((resolve) => {
            // Server başlayana kadar bekle
            setTimeout(resolve, 2000);
        });
    }

    async sendRequest(method, params = {}) {
        const request = {
            jsonrpc: "2.0",
            id: ++this.requestId,
            method: method,
            params: params
        };

        return new Promise((resolve, reject) => {
            let response = '';
            
            const handleData = (data) => {
                response += data.toString();
                try {
                    const parsed = JSON.parse(response);
                    if (parsed.id === request.id) {
                        this.process.stdout.removeListener('data', handleData);
                        if (parsed.error) {
                            reject(parsed.error);
                        } else {
                            resolve(parsed.result);
                        }
                    }
                } catch (e) {
                    // Henüz tam JSON gelmemiş, bekle
                }
            };

            this.process.stdout.on('data', handleData);
            
            // Request'i gönder (debug: log raw JSON)
            const raw = JSON.stringify(request);
            console.log('Sending request:', raw);
            this.process.stdin.write(raw + '\n');
        });
    }

    // Send a JSON-RPC notification (no id) over stdio
    sendNotification(method, params = {}) {
        const msg = { jsonrpc: '2.0', method, params };
        const raw = JSON.stringify(msg);
        console.log('Sending notification:', raw);
        this.process.stdin.write(raw + '\n');
    }

    async executeSparqlQuery(query) {
        return await this.sendRequest('execute_sparql', { query });
    }

    // Initialization handshake required by FastMCP before other requests
    async initialize() {
        const params = {
            protocolVersion: '1.0',
            clientInfo: { name: 'node-mcp-client', version: '0.1.0' },
            capabilities: {}
        };
        return await this.sendRequest('initialize', params);
    }

    async getSchemaHelp() {
        return await this.sendRequest('tools/list');
    }

    stop() {
        if (this.process) {
            this.process.kill();
        }
    }
}

// Kullanım:
async function main() {
    const client = new MCPSTDIOClient(
        'C:\\Users\\eayav\\Desktop\\Repository\\spendcast-mcp\\.venv\\Scripts\\python.exe',
        'C:\\Users\\eayav\\Desktop\\Repository\\spendcast-mcp\\src\\spendcast_mcp\\server.py'
    );

    try {
    await client.start();

    // Send initialize handshake first
        const initResp = await client.initialize();
    console.log('Initialize response:', JSON.stringify(initResp, null, 2));

    // Notify server that client initialization is complete (use expected notification name)
    client.sendNotification('notifications/initialized', {});

    // Small delay to ensure server completes internal init steps
    await new Promise((resolve) => setTimeout(resolve, 300));

        // Retry tools/list a few times in case server isn't fully ready yet
        let schema;
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                schema = await client.getSchemaHelp();
                break;
            } catch (err) {
                console.warn(`Attempt ${attempt} failed: ${err && err.message ? err.message : err}`);
                if (attempt === maxAttempts) throw err;
                await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
            }
        }
        console.log('Schema:', JSON.stringify(schema, null, 2));
        
        const query = `
            PREFIX exs: <https://static.rwpz.net/spendcast/schema#>
            SELECT ?person ?name WHERE {
                ?person a exs:Person .
                ?person exs:hasName ?name .
            } LIMIT 5
        `;
        
        const result = await client.executeSparqlQuery(query);
        console.log('Query result:', result);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.stop();
    }
}

main();