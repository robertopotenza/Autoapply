#!/bin/bash

# Start script for Railway deployment
# Enhanced Auto-Apply Platform

echo "🚀 Starting Apply Autonomously Enhanced Platform..."
echo "📍 Environment: $NODE_ENV"
echo "🌐 Port: $PORT"

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
    echo "🏭 Production mode detected"
    echo "🔗 Database: Connected to Railway PostgreSQL"
else
    echo "🛠️  Development mode"
fi

# Start the Node.js server
echo "🎯 Starting Node.js server..."
exec node src/server.js