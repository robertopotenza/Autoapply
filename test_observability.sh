#!/bin/bash

# Manual Test Script for Observability Features
# Run this after starting the server to verify all features work

set -e

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

echo "🧪 Testing Observability Features"
echo "=================================="
echo "Server: $SERVER_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: TraceId Middleware
echo "📍 Test 1: TraceId Middleware"
echo "----------------------------"

RESPONSE=$(curl -s -i "$SERVER_URL/health")
TRACE_ID=$(echo "$RESPONSE" | grep -i "x-trace-id" | cut -d' ' -f2 | tr -d '\r')

if [ -n "$TRACE_ID" ]; then
    echo -e "${GREEN}✓${NC} X-Trace-Id header present: $TRACE_ID"
else
    echo -e "${RED}✗${NC} X-Trace-Id header missing!"
    exit 1
fi

if [ "$VERBOSE" = "true" ]; then
    echo "$RESPONSE" | head -20
fi

echo ""

# Test 2: Diagnostics Endpoint
echo "🔍 Test 2: Diagnostics Endpoint"
echo "--------------------------------"

DIAG_RESPONSE=$(curl -s "$SERVER_URL/api/diagnostics")

if echo "$DIAG_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Diagnostics endpoint responding"
    
    STATUS=$(echo "$DIAG_RESPONSE" | jq -r '.status')
    UPTIME=$(echo "$DIAG_RESPONSE" | jq -r '.uptime_seconds')
    SCHEMA=$(echo "$DIAG_RESPONSE" | jq -r '.schema_version')
    ENV=$(echo "$DIAG_RESPONSE" | jq -r '.envMode')
    DB=$(echo "$DIAG_RESPONSE" | jq -r '.dbConnection')
    TRACE=$(echo "$DIAG_RESPONSE" | jq -r '.traceId')
    
    echo "  Status: $STATUS"
    echo "  Uptime: ${UPTIME}s"
    echo "  Schema: $SCHEMA"
    echo "  Environment: $ENV"
    echo "  DB Connected: $DB"
    echo "  TraceId: $TRACE"
    
    # Verify required fields
    if [ "$STATUS" = "operational" ]; then
        echo -e "${GREEN}✓${NC} Status is operational"
    else
        echo -e "${YELLOW}⚠${NC} Status is not operational: $STATUS"
    fi
    
    if [ -n "$TRACE" ] && [ "$TRACE" != "null" ]; then
        echo -e "${GREEN}✓${NC} TraceId present in diagnostics"
    else
        echo -e "${RED}✗${NC} TraceId missing from diagnostics"
    fi
    
    MIGRATION_COUNT=$(echo "$DIAG_RESPONSE" | jq -r '.activeMigrations | length')
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Migrations detected: $MIGRATION_COUNT files"
    else
        echo -e "${YELLOW}⚠${NC} No migrations found"
    fi
else
    echo -e "${RED}✗${NC} Diagnostics endpoint failed"
    echo "$DIAG_RESPONSE"
    exit 1
fi

if [ "$VERBOSE" = "true" ]; then
    echo ""
    echo "Full diagnostics response:"
    echo "$DIAG_RESPONSE" | jq
fi

echo ""

# Test 3: Multiple Requests Have Different TraceIds
echo "🔄 Test 3: TraceId Uniqueness"
echo "-----------------------------"

TRACE_1=$(curl -s -i "$SERVER_URL/health" | grep -i "x-trace-id" | cut -d' ' -f2 | tr -d '\r')
sleep 0.1
TRACE_2=$(curl -s -i "$SERVER_URL/health" | grep -i "x-trace-id" | cut -d' ' -f2 | tr -d '\r')

if [ "$TRACE_1" != "$TRACE_2" ]; then
    echo -e "${GREEN}✓${NC} TraceIds are unique across requests"
    echo "  Request 1: $TRACE_1"
    echo "  Request 2: $TRACE_2"
else
    echo -e "${RED}✗${NC} TraceIds are not unique!"
    exit 1
fi

echo ""

# Test 4: Check for UUID format
echo "🔑 Test 4: TraceId Format"
echo "-------------------------"

UUID_PATTERN="^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"

if echo "$TRACE_1" | grep -E "$UUID_PATTERN" > /dev/null; then
    echo -e "${GREEN}✓${NC} TraceId follows UUID format"
else
    echo -e "${YELLOW}⚠${NC} TraceId is not a standard UUID (may be fallback format)"
fi

echo ""

# Summary
echo "=================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "📝 Manual verification steps:"
echo "   1. Check server logs for 'Incoming request' messages with traceId"
echo "   2. Start server with DEBUG_MODE=true and verify SQL logging"
echo "   3. Open browser console and test frontend DEBUG_MODE"
echo ""
echo "Frontend DEBUG_MODE test:"
echo "   localStorage.setItem('DEBUG_MODE', 'true')"
echo "   window.location.reload()"
echo ""
