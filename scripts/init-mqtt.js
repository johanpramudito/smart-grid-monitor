#!/usr/bin/env node

/**
 * Initialize MQTT Listener via API
 *
 * This script sends a POST request to /api/mqtt/init to manually
 * start the MQTT listener when instrumentation.ts doesn't run
 * (e.g., during npm run dev in Next.js 15)
 */

const http = require('http');

const HOST = process.env.APP_HOST || 'localhost';
const PORT = process.env.APP_PORT || 3000;

const options = {
  hostname: HOST,
  port: PORT,
  path: '/api/mqtt/init',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

console.log(`Initializing MQTT listener at http://${HOST}:${PORT}...`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (res.statusCode === 200) {
        console.log('✓ Success:', response.message);
        console.log('  Active:', response.active);

        if (response.alreadyRunning) {
          console.log('\nMQTT listener was already running.');
        } else {
          console.log('\nMQTT listener started. Check status at:');
          console.log(`  http://${HOST}:${PORT}/api/mqtt/status`);
        }
        process.exit(0);
      } else {
        console.error('✗ Failed:', response.message);
        console.error('  Error:', response.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('✗ Failed to parse response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('✗ Request failed:', error.message);
  console.error('\nMake sure the Next.js server is running:');
  console.error('  npm run dev');
  process.exit(1);
});

req.end();
