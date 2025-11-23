/**
 * Test script for Gemini Location Conversion API
 * 
 * Usage: node test-location-api.js [latitude] [longitude]
 * Example: node test-location-api.js 12.9716 77.5946
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/gemini/convert-location';

// Default coordinates (Bangalore, India)
const defaultLat = 12.9716;
const defaultLng = 77.5946;

// Get coordinates from command line or use defaults
const latitude = process.argv[2] || defaultLat;
const longitude = process.argv[3] || defaultLng;

console.log('🧪 Testing Gemini Location Conversion API\n');
console.log(`📍 Coordinates: ${latitude}, ${longitude}\n`);

async function testLocationConversion() {
  try {
    console.log('📡 Sending request to Gemini API...\n');
    
    const response = await axios.post(API_URL, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    if (response.data.status === 'success') {
      console.log('✅ SUCCESS - Location converted successfully!\n');
      console.log('📋 Response Data:');
      console.log('─'.repeat(50));
      console.log(`📍 Place Name: ${response.data.place_name || 'N/A'}`);
      console.log(`🏠 Full Address: ${response.data.full_address || 'N/A'}`);
      console.log(`🏛️  Nearest Landmark: ${response.data.nearest_landmark || 'N/A'}`);
      console.log(`🏘️  Area: ${response.data.area || 'N/A'}`);
      console.log(`🏙️  City: ${response.data.city || 'N/A'}`);
      console.log(`🗺️  Taluk: ${response.data.taluk || 'N/A'}`);
      console.log(`📦 District: ${response.data.district || 'N/A'}`);
      console.log(`🌍 State: ${response.data.state || 'N/A'}`);
      console.log(`📮 Pincode: ${response.data.pincode || 'N/A'}`);
      console.log(`🌎 Country: ${response.data.country || 'N/A'}`);
      console.log(`🔗 Google Maps: ${response.data.google_maps_link || 'N/A'}`);
      console.log('─'.repeat(50));
      
      console.log('\n📄 Full JSON Response:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ ERROR:', response.data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ REQUEST FAILED\n');
    
    if (error.response) {
      // Server responded with error
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${error.response.data.message || error.response.data.error || 'Unknown error'}`);
      console.error('\nResponse:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server. Is the server running?');
      console.error('Make sure to start the server: npm start');
    } else {
      // Error setting up request
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

// Run test
testLocationConversion();

