#!/bin/bash

# QLabs MCP Server - Quick Start Script
# This script helps you get started with the QLabs MCP server

set -e

echo "=================================="
echo "QLabs MCP Server - Quick Start"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "🔨 Building the project..."
npm run build
echo ""

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed - dist/index.js not found"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Check for API credentials
if [ -z "$QLABS_API_KEY" ] && [ -z "$QLABS_JWT_TOKEN" ]; then
    echo "⚠️  No API credentials found in environment variables"
    echo ""
    echo "Please set one of the following:"
    echo "  export QLABS_API_KEY=sk_your_api_key_here"
    echo "  export QLABS_JWT_TOKEN=your_jwt_token_here"
    echo ""
    echo "Optional: Set API base URL (default: http://localhost:3000)"
    echo "  export QLABS_API_BASE_URL=https://api.qlabs.com"
    echo ""
    echo "Then run this script again, or start the server manually:"
    echo "  npm start"
    echo ""
    exit 1
fi

echo "✅ API credentials found"
echo ""

# Show configuration
echo "Configuration:"
echo "  API URL: ${QLABS_API_BASE_URL:-http://localhost:3000}"
echo "  Auth: ${QLABS_API_KEY:+API Key configured} ${QLABS_JWT_TOKEN:+JWT Token configured}"
echo ""

# Ask what to do next
echo "What would you like to do?"
echo "  1) Start the server (stdio mode)"
echo "  2) Run MCP Inspector for testing"
echo "  3) View available tools"
echo "  4) Exit"
echo ""
read -p "Enter your choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "Starting QLabs MCP Server..."
        echo "Press Ctrl+C to stop"
        echo ""
        exec node dist/index.js
        ;;
    2)
        echo ""
        if ! command -v mcp-inspector &> /dev/null; then
            echo "Installing MCP Inspector..."
            npm install -g @modelcontextprotocol/inspector
        fi
        echo "Starting MCP Inspector..."
        echo ""
        exec mcp-inspector node dist/index.js
        ;;
    3)
        echo ""
        echo "Available Tools:"
        echo "================"
        echo ""
        echo "Voice Management:"
        echo "  - qlabs_list_voices"
        echo "  - qlabs_get_voice"
        echo "  - qlabs_create_voice"
        echo ""
        echo "Text-to-Speech:"
        echo "  - qlabs_tts_synthesize"
        echo "  - qlabs_tts_logs"
        echo "  - qlabs_tts_get"
        echo ""
        echo "Speech-to-Text:"
        echo "  - qlabs_stt_transcribe"
        echo "  - qlabs_stt_logs"
        echo "  - qlabs_stt_get"
        echo ""
        echo "Workspace Management:"
        echo "  - qlabs_list_workspaces"
        echo "  - qlabs_get_workspace"
        echo "  - qlabs_create_workspace"
        echo "  - qlabs_get_workspace_members"
        echo ""
        echo "60DB Tools:"
        echo "  - qlabs_60db_list_dictionary"
        echo "  - qlabs_60db_add_dictionary"
        echo "  - qlabs_60db_list_snippets"
        echo "  - qlabs_60db_add_snippet"
        echo "  - qlabs_60db_list_notes"
        echo "  - qlabs_60db_add_note"
        echo "  - qlabs_60db_get_note"
        echo ""
        echo "Meeting Management:"
        echo "  - qlabs_list_meetings"
        echo "  - qlabs_get_meeting"
        echo "  - qlabs_create_meeting"
        echo ""
        echo "Analytics:"
        echo "  - qlabs_get_usage_stats"
        echo ""
        echo "Billing:"
        echo "  - qlabs_list_plans"
        echo "  - qlabs_get_subscription"
        echo "  - qlabs_list_invoices"
        echo "  - qlabs_get_invoice"
        echo ""
        echo "For more information, see README.md and TESTING.md"
        ;;
    4)
        echo ""
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo ""
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
