# Technical Stack

## Core Technologies
- **Runtime**: Node.js
- **Language**: JavaScript (CommonJS modules)
- **API Communication**: WebSocket (ws library)

## Dependencies
- **dotenv** (v17.2.0): Environment variable management
- **fast-xml-parser** (v5.2.5): XML parsing for strategy files
- **ws** (v8.18.3): WebSocket client for Deriv API communication

## Project Configuration
- Environment variables are stored in `.env` file
- Trading strategies are defined in XML format (e.g., `iron.xml`)

## Common Commands

### Setup
```bash
# Install dependencies
npm install

# Create .env file with your Deriv API token
echo "DERIV_TOKEN=your_token_here" > .env
```

### Running the Bot
```bash
# Start the trading bot
node index.js
```

### Development
The project doesn't have defined test scripts or build processes. Development is primarily done through direct modification of JavaScript files.

## API Integration
The bot integrates with Deriv's WebSocket API (wss://ws.derivws.com/websockets/v3) using app_id 31661.