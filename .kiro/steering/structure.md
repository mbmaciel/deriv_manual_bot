# Project Structure

## Overview
The project follows a modular structure with clear separation of concerns:

```
/
├── .env                  # Environment variables (API tokens)
├── index.js              # Main entry point
├── iron.xml              # XML strategy configuration file
├── deriv/                # Deriv API integration
│   └── client.js         # WebSocket client for Deriv API
├── parser/               # Strategy parsing
│   └── xmlToStrategy.js  # XML to strategy object parser
└── strategy/             # Strategy execution
    └── executor.js       # Strategy execution logic
```

## Module Responsibilities

### Entry Point (index.js)
- Loads environment variables
- Validates configuration
- Orchestrates the application flow
- Connects components together

### Deriv API Client (deriv/client.js)
- Manages WebSocket connection to Deriv API
- Handles authentication
- Provides account switching (real/virtual)
- Implements error handling and reconnection logic

### Strategy Parser (parser/xmlToStrategy.js)
- Parses XML strategy files into JavaScript objects
- Extracts trading parameters from XML structure
- Provides default values for missing parameters

### Strategy Executor (strategy/executor.js)
- Executes trading strategies
- Manages active contracts
- Implements martingale logic
- Handles profit/loss tracking
- Enforces take profit and stop loss limits

## Code Conventions
- Portuguese language is used for console messages
- English is used for variable names and comments
- CommonJS module system is used throughout the project
- Error handling follows a centralized approach with descriptive messages