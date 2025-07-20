# Deriv Trading Bot

This project is a trading bot for the Deriv platform that executes automated trading strategies based on XML configurations. The bot connects to Deriv's WebSocket API, authenticates with a user token, and executes trading operations according to predefined strategies.

## Key Features

- Automated trading on Deriv's platform
- XML-based strategy configuration
- Support for martingale betting strategies
- Configurable take profit and stop loss limits
- Real and virtual account support
- Automatic reconnection and error handling

## Purpose

The bot is designed to execute binary options trading strategies on Deriv's platform, specifically focusing on "DIGITUNDER" contract types. It implements a martingale strategy where stake sizes can be automatically adjusted based on previous trade outcomes.