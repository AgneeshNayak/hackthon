# Real-Time GPS Location & Gemini API Integration

## Overview
This document describes the complete implementation of real-time GPS location fetching and Gemini API integration for address conversion in the DisasterAlert application.

## Architecture

### Flow Diagram
```
Device GPS → Frontend (navigator.geolocation) → Backend API → Gemini AI → Formatted JSON
```

## 1. Frontend GPS Location Fetching

### Implementation
**File:** `public/script.js`

The frontend uses the browser's native `navigator.geolocation` API to fetch real-time GPS coordinates.

#### Key Features:
- **High Accuracy GPS**: Uses `enableHighAccuracy: true` for precise location
- **Real-time Updates**: Implements `watchPosition` for continuous location tracking
- **Error Handling**: Comprehensive error messages for different failure scenarios
- **Fallback Support**: Uses cached location if GPS fails
- **Distance Filtering**: Only updates location if moved more than 10 meters

#### Code Example:
```javascript
// Get current position with high accuracy
navigator.geolocation.getCurrentPosition(
  (position) => {
    const newLocation = { 
      lat: position.coords.latitude, 
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date().toISOString()
    };
    // Store and use location
  },
  (err) => {
    // Handle errors (permission denied, timeout, etc.)
  },
  {
    enableHighAccuracy: true,  // Use GPS if available
    timeout: 15000,            // 15 second timeout
    maximumAge: 0              // Don't use cached location
  }
);
```

#### Error Handling:
- **PERMISSION_DENIED**: User denied location access
- **POSITION_UNAVAILABLE**: Location information unavailable
- **TIMEOUT**: Location request timed out

## 2. Backend Gemini API Integration

### Implementation
**File:** `server/server.js`

### Dependencies
```bash
npm install @google/generative-ai
```

### Configuration
The Gemini API key can be set via environment variable:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

Or it will use the Google Maps API key as fallback.

### Functions

#### 1. `reverseGeocodeWithGemini(latitude, longitude)`
Converts GPS coordinates to detailed address using Gemini AI.

**Input:**
- `latitude`: Number (e.g., 12.9716)
- `longitude`: Number (e.g., 77.5946)

**Output:**
```json
{
  "place_name": "Bangalore",
  "full_address": "Bangalore, Karnataka, India",
  "nearest_landmark": "Cubbon Park",
  "area": "Cubbon Park",
  "city": "Bangalore",
  "taluk": "Bangalore North",
  "district": "Bangalore Urban",
  "state": "Karnataka",
  "pincode": "560001",
  "country": "India"
}
```

#### 2. `reverseGeocode(latitude, longitude)`
Main reverse geocoding function that:
1. First tries Gemini API
2. Falls back to Google Geocoding API
3. Falls back to OpenStreetMap Nominatim

#### 3. `analyzePhotoWithGemini(imagePath, category, description)`
Analyzes uploaded photos using Gemini Pro Vision to identify emergency types.

**Features:**
- Image analysis using Gemini Pro Vision
- Automatic fallback to basic analysis if Gemini fails
- Supports JPEG, PNG, GIF, WebP formats

## 3. API Endpoints

### POST `/api/gemini/convert-location`
Standalone endpoint for testing location conversion.

**Request:**
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

**Response:**
```json
{
  "status": "success",
  "place_name": "Bangalore",
  "full_address": "Bangalore, Karnataka, India",
  "nearest_landmark": "Cubbon Park",
  "area": "Cubbon Park",
  "city": "Bangalore",
  "taluk": "Bangalore North",
  "district": "Bangalore Urban",
  "state": "Karnataka",
  "pincode": "560001",
  "country": "India",
  "google_maps_link": "https://www.google.com/maps?q=12.9716,77.5946"
}
```

### POST `/api/incidents`
Main incident reporting endpoint that:
1. Validates camera image (required)
2. Extracts GPS from image EXIF or uses provided coordinates
3. Converts coordinates to address using Gemini API
4. Analyzes photo using Gemini Pro Vision
5. Stores all data in database

**Request:** `multipart/form-data`
- `image`: File (required)
- `title`: String
- `category`: String
- `description`: String
- `latitude`: Number
- `longitude`: Number

**Response:**
```json
{
  "status": "success",
  "place_name": "...",
  "full_address": "...",
  "nearest_landmark": "...",
  "area": "...",
  "city": "...",
  "state": "...",
  "pincode": "...",
  "country": "...",
  "google_maps_link": "https://www.google.com/maps?q=lat,lng",
  "photo_analysis": "...",
  "user_description": "...",
  "reported_datetime": "25-01-2024 14:30:45"
}
```

## 4. Testing

### Test GPS Location Fetching
1. Open browser console
2. Navigate to user dashboard
3. Check console for location logs:
   ```
   ✅ Real-time GPS location obtained: {lat: 12.9716, lng: 77.5946, accuracy: 15m}
   ```

### Test Gemini API Endpoint
```bash
curl -X POST http://localhost:3000/api/gemini/convert-location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.9716, "longitude": 77.5946}'
```

### Test Complete Flow
1. Open user dashboard
2. Click "Report an Issue"
3. Click "Get Current Location" button
4. Take a photo with camera
5. Fill in details and submit
6. Check response for formatted address from Gemini

## 5. Error Handling

### Frontend Errors
- **Geolocation not supported**: Browser doesn't support GPS
- **Permission denied**: User denied location access
- **Timeout**: Location request took too long
- **Position unavailable**: GPS signal not available

### Backend Errors
- **Gemini API failure**: Falls back to Google Geocoding
- **Google Geocoding failure**: Falls back to OpenStreetMap
- **All APIs fail**: Returns basic location data

## 6. Security Considerations

1. **API Keys**: Store in environment variables, never commit to git
2. **Location Privacy**: Only send coordinates when user explicitly reports incident
3. **Rate Limiting**: Consider implementing rate limits for Gemini API calls
4. **Input Validation**: All coordinates are validated before processing

## 7. Performance Optimization

1. **Caching**: Location is cached in localStorage
2. **Distance Filtering**: Only updates if moved > 10 meters
3. **Timeout Settings**: 15-second timeout for GPS requests
4. **Fallback Chain**: Multiple fallback options ensure reliability

## 8. Browser Compatibility

- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Full support)
- ✅ Safari (Full support)
- ✅ Mobile browsers (Full support with permissions)

## 9. Mobile Support

The implementation works on mobile devices:
- **Android**: Uses device GPS via browser
- **iOS**: Uses CoreLocation via browser
- **Permissions**: Requires location permission on first use

## 10. Troubleshooting

### GPS Not Working
1. Check browser permissions (Settings → Privacy → Location)
2. Ensure HTTPS (required for geolocation on some browsers)
3. Check device GPS is enabled
4. Try different browser

### Gemini API Errors
1. Check API key is valid
2. Verify internet connection
3. Check API quota/limits
4. Review server logs for detailed errors

## Summary

✅ **Real-time GPS**: Implemented using `navigator.geolocation`
✅ **Gemini Integration**: AI-powered address conversion
✅ **Photo Analysis**: Gemini Pro Vision for image analysis
✅ **Error Handling**: Comprehensive fallback chain
✅ **Production Ready**: Robust error handling and validation

The system now correctly:
1. Fetches live GPS coordinates from device
2. Sends coordinates to Gemini API
3. Receives formatted JSON with address details
4. Analyzes photos using AI
5. Returns clean, structured data

