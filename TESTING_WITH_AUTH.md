# QLabs MCP Server - Testing Guide

## Quick Test with Your Credentials

### Step 1: Get Your API Token

#### Option A: Get API Key from Database
```bash
# Connect to PostgreSQL and get an API key
psql -h localhost -U postgres -d qlabs -c "SELECT * FROM \"Developer_Api\" LIMIT 1;"
```

#### Option B: Login and Get JWT Token
```bash
# First, ensure you have a verified user. Login:
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"YourPassword123"}'

# Copy the token from the response
```

### Step 2: Set Environment Variables
```bash
export QLABS_API_BASE_URL=http://localhost:3000

# Use one of these:
export QLABS_API_KEY=sk_your_api_key_here
# OR
export QLABS_JWT_TOKEN=your_jwt_token_here
```

### Step 3: Test the Server

#### Method 1: Quick Start Script
```bash
./quick-start.sh
```

#### Method 2: MCP Inspector (Recommended)
```bash
# Install Inspector
npm install -g @modelcontextprotocol/inspector

# Run with your credentials
QLABS_API_KEY=sk_your_key mcp-inspector node dist/index.js
```

#### Method 3: Manual Test
```bash
# Start the server
QLABS_API_KEY=sk_your_key node dist/index.js

# In another terminal, send a test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  QLABS_API_KEY=sk_your_key node dist/index.js
```

## Testing Individual Tools

### 1. Test Usage Statistics
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "qlabs_get_usage_stats",
    "arguments": {
      "response_format": "json"
    }
  }
}
```

### 2. List Voices
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "qlabs_list_voices",
    "arguments": {
      "limit": 5,
      "response_format": "json"
    }
  }
}
```

### 3. Get Subscription
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "qlabs_get_subscription",
    "arguments": {}
  }
}
```

### 4. List Workspaces
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "qlabs_list_workspaces",
    "arguments": {}
  }
}
```

## Automated Test Script

Create a file `test-with-auth.mjs`:

```javascript
import { spawn } from 'child_process';
import readline from 'readline';

async function test() {
  const server = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      QLABS_API_KEY: 'sk_your_actual_key_here',
      QLABS_API_BASE_URL: 'http://localhost:3000'
    },
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const rl = readline.createInterface({ input: server.stdout });

  await new Promise(r => setTimeout(r, 1000));

  // Test list tools
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }) + '\n');

  for await (const line of rl) {
    try {
      const response = JSON.parse(line);
      if (response.id === 1) {
        console.log('✅ Tools:', response.result.tools.length);
        break;
      }
    } catch {}
  }

  server.kill();
}

test().catch(console.error);
```

Run with: `node test-with-auth.mjs`

## Common Issues and Solutions

### Issue: "Authentication required"
**Solution**: Ensure QLABS_API_KEY or QLABS_JWT_TOKEN is set correctly

### Issue: "Token expired"
**Solution**: Get a fresh token by logging in again

### Issue: "Backend not running"
**Solution**: Start the backend first
```bash
cd /home/dev/EngneerMaster/YEAR2026/qlabs-api
npm start
```

### Issue: "Port 3000 already in use"
**Solution**: Either stop the conflicting service or change the port

## Manual Database Query for API Key

If you need to create an API key directly:

```sql
-- Check existing API keys
SELECT * FROM "Developer_Api" WHERE user_id = 64;

-- Or create a new one (if you have the hash function)
-- This should be done through the API ideally
```

## Verification Checklist

- [ ] Backend is running (`curl http://localhost:3000/health`)
- [ ] MCP server builds successfully (`npm run build`)
- [ ] Environment variables are set (`echo $QLABS_API_KEY`)
- [ ] MCP Inspector can connect (`mcp-inspector node dist/index.js`)
- [ ] Tools are listed in Inspector
- [ ] Can call at least one tool successfully
