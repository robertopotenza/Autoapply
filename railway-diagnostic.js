#!/usr/bin/env node

/**
 * Railway Routing Diagnostic Tool
 * Minimal server to test Railway routing specifically
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Port configuration for Railway
const PORT = parseInt(process.env.PORT) || 8080;

console.log('🚀 Railway Diagnostic Server Starting...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`🏷️ Railway Project: ${process.env.RAILWAY_PROJECT_ID || 'unknown'}`);
console.log(`🎯 Railway Service: ${process.env.RAILWAY_SERVICE_ID || 'unknown'}`);

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`📥 ${req.method} ${pathname} from ${req.socket.remoteAddress}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Route handlers
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'operational',
            timestamp: new Date().toISOString(),
            port: PORT,
            method: 'Railway Diagnostic Server',
            environment: process.env.NODE_ENV || 'development',
            railway: {
                project: process.env.RAILWAY_PROJECT_ID || 'unknown',
                service: process.env.RAILWAY_SERVICE_ID || 'unknown',
                environment: process.env.RAILWAY_ENVIRONMENT || 'unknown'
            }
        }, null, 2));
        
    } else if (pathname === '/test-deployment') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'RAILWAY ROUTING DIAGNOSTIC - SUCCESS',
            timestamp: new Date().toISOString(),
            server: 'Railway Diagnostic Server',
            port: PORT,
            host: '0.0.0.0',
            deployment_id: 'RAILWAY-DIAGNOSTIC-' + Date.now(),
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers
            }
        }, null, 2));
        
    } else if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Railway Routing Diagnostic</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { color: #28a745; }
        .info { color: #17a2b8; }
        .test-link { display: block; margin: 10px 0; padding: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; text-align: center; }
        .test-link:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="success">✅ Railway Routing Test - SUCCESS!</h1>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Server:</strong> Railway Diagnostic Server</p>
        <p><strong>Port:</strong> ${PORT}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        
        <h2>Test Endpoints:</h2>
        <a href="/health" class="test-link">🏥 Health Check</a>
        <a href="/test-deployment" class="test-link">🧪 Deployment Test</a>
        
        <h2 class="info">Railway Environment:</h2>
        <ul>
            <li><strong>Project ID:</strong> ${process.env.RAILWAY_PROJECT_ID || 'unknown'}</li>
            <li><strong>Service ID:</strong> ${process.env.RAILWAY_SERVICE_ID || 'unknown'}</li>
            <li><strong>Environment:</strong> ${process.env.RAILWAY_ENVIRONMENT || 'unknown'}</li>
        </ul>
        
        <p><strong>Status:</strong> <span class="success">Railway routing is working correctly!</span></p>
    </div>
</body>
</html>
        `);
        
    } else {
        // 404 handler
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Not Found',
            message: 'Railway Diagnostic Server - Route not found',
            path: pathname,
            timestamp: new Date().toISOString(),
            available_routes: [
                '/',
                '/health',
                '/test-deployment'
            ]
        }, null, 2));
    }
});

// Start server
server.listen(PORT, '0.0.0.0', (error) => {
    if (error) {
        console.error('❌ Failed to start Railway diagnostic server:', error);
        process.exit(1);
    }
    
    console.log('🎯 Railway Diagnostic Server running successfully!');
    console.log(`🌐 Listening on: http://0.0.0.0:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/test-deployment`);
    console.log('📊 Ready to test Railway routing...');
});

// Error handling
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

console.log('🎯 Railway diagnostic server initialization complete');