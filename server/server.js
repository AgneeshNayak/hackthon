// server.js - Backend API Server
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const exifParser = require('exif-parser');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

// Simple token storage (in production, use Redis or database)
const activeTokens = new Map();
const ADMIN_SECURITY_KEY = process.env.ADMIN_SECURITY_KEY || 'DISASTER_ALERT_2024_SECURE_KEY';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDwGN_avdk8SzUE_me8qZDDt280KoiCKWU';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || GOOGLE_MAPS_API_KEY; // Can use same key or separate

// Initialize Gemini AI
let geminiAI = null;
if (GEMINI_API_KEY) {
  try {
    geminiAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized successfully');
  } catch (err) {
    console.warn('⚠️ Gemini AI initialization failed:', err.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Create uploads directory
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Initialize database
const dbPath = path.join(process.cwd(), "disasteralert.db");
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    status TEXT DEFAULT 'Reported',
    image_url TEXT,
    user_id TEXT,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating incidents table:', err);
    } else {
      // Add new columns if they don't exist (for existing databases)
      const newColumns = [
        { name: 'place_name', type: 'TEXT' },
        { name: 'full_address', type: 'TEXT' },
        { name: 'nearest_landmark', type: 'TEXT' },
        { name: 'area', type: 'TEXT' },
        { name: 'city', type: 'TEXT' },
        { name: 'taluk', type: 'TEXT' },
        { name: 'district', type: 'TEXT' },
        { name: 'state', type: 'TEXT' },
        { name: 'pincode', type: 'TEXT' },
        { name: 'country', type: 'TEXT' },
        { name: 'google_maps_link', type: 'TEXT' },
        { name: 'photo_analysis', type: 'TEXT' }
      ];

      newColumns.forEach(col => {
        db.run(`ALTER TABLE incidents ADD COLUMN ${col.name} ${col.type}`, (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column')) {
            console.error(`Error adding column ${col.name}:`, err.message);
          }
        });
      });
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Drop and recreate users table to add password_hash column
  db.run(`DROP TABLE IF EXISTS users`);
  
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    department_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      // Insert default departments
      db.run(`INSERT OR IGNORE INTO departments (name) VALUES ('Police'), ('Fire'), ('Disaster Management'), ('Electricity')`);
      
      // Create default admin user (username: admin, password: admin123)
      const adminPasswordHash = hashPassword('admin123');
      db.run(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`, [adminPasswordHash], (err) => {
        if (err) {
          console.error('Error creating admin user:', err);
        } else {
          console.log('Default admin user created: admin / admin123');
        }
      });
    }
  });
});

// Password hashing functions
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Get current IST datetime in DD-MM-YYYY HH:MM:SS format
function getISTDateTime() {
  const now = new Date();
  // IST is UTC+5:30, so we need to add 5 hours and 30 minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
  
  const day = String(istTime.getDate()).padStart(2, '0');
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const year = istTime.getFullYear();
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

// Convert database datetime to IST format
function formatISTDateTime(dbDateTime) {
  if (!dbDateTime) return getISTDateTime();
  
  const date = new Date(dbDateTime);
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
  
  const day = String(istTime.getDate()).padStart(2, '0');
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const year = istTime.getFullYear();
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

// Extract GPS coordinates from image EXIF data
function extractGPSFromImage(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const parser = exifParser.create(imageBuffer);
    const result = parser.parse();
    
    if (result.tags && result.tags.GPSLatitude && result.tags.GPSLongitude) {
      return {
        latitude: result.tags.GPSLatitude,
        longitude: result.tags.GPSLongitude
      };
    }
    return null;
  } catch (err) {
    console.error('Error extracting GPS from image:', err);
    return null;
  }
}

// Gemini API - Convert coordinates to address using AI
async function reverseGeocodeWithGemini(latitude, longitude) {
  if (!geminiAI) {
    console.warn('Gemini AI not initialized, falling back to Google Geocoding');
    return null;
  }

  try {
    const model = geminiAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `You are a location intelligence system. Convert the following GPS coordinates into a detailed address.

Coordinates:
- Latitude: ${latitude}
- Longitude: ${longitude}

Provide a JSON response with the following structure (use empty strings if information is not available):
{
  "place_name": "Main place name or landmark",
  "full_address": "Complete formatted address",
  "nearest_landmark": "Nearest point of interest, building, or landmark",
  "area": "Area, neighborhood, or locality name",
  "city": "City name",
  "taluk": "Taluk or subdistrict name (if in India)",
  "district": "District name",
  "state": "State or province name",
  "pincode": "Postal/ZIP code",
  "country": "Country name"
}

IMPORTANT: 
- Return ONLY valid JSON, no additional text
- Use Indian administrative divisions if coordinates are in India
- Identify the nearest landmark (hospital, school, park, building, etc.)
- Be specific and accurate with location details`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const locationData = JSON.parse(jsonText);
    
    console.log('✅ Gemini API reverse geocoding successful');
    return {
      place_name: locationData.place_name || '',
      full_address: locationData.full_address || '',
      nearest_landmark: locationData.nearest_landmark || '',
      area: locationData.area || '',
      city: locationData.city || '',
      taluk: locationData.taluk || '',
      district: locationData.district || '',
      state: locationData.state || '',
      pincode: locationData.pincode || '',
      country: locationData.country || ''
    };
  } catch (err) {
    console.error('❌ Gemini API reverse geocoding error:', err.message);
    return null;
  }
}

// Reverse geocoding - Convert coordinates to address using Gemini API (with fallback to Google Geocoding)
async function reverseGeocode(latitude, longitude) {
  // Try Gemini API first
  if (geminiAI) {
    const geminiResult = await reverseGeocodeWithGemini(latitude, longitude);
    if (geminiResult && geminiResult.full_address) {
      return geminiResult;
    }
    console.log('Gemini API result incomplete, falling back to Google Geocoding');
  }

  // Fallback to Google Geocoding API
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${latitude},${longitude}`,
        key: GOOGLE_MAPS_API_KEY,
        result_type: 'street_address|route|premise|point_of_interest'
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const addressComponents = result.address_components || [];
      
      // Extract address components
      const getComponent = (types, defaultValue = '') => {
        const component = addressComponents.find(comp => 
          types.some(type => comp.types.includes(type))
        );
        return component ? component.long_name : defaultValue;
      };

      // Find nearest landmark (point of interest, establishment, etc.)
      const landmark = addressComponents.find(comp => 
        comp.types.includes('point_of_interest') || 
        comp.types.includes('establishment') ||
        comp.types.includes('premise')
      );

      // Extract taluk (subdistrict) - in India, this is often administrative_area_level_3 or sublocality_level_2
      const taluk = getComponent(['administrative_area_level_3', 'sublocality_level_2', 'sublocality_level_1'], '');
      // District is usually administrative_area_level_2
      const district = getComponent(['administrative_area_level_2'], '');

      return {
        place_name: result.formatted_address || result.address_components[0]?.long_name || '',
        full_address: result.formatted_address || '',
        nearest_landmark: landmark ? landmark.long_name : getComponent(['premise', 'establishment'], ''),
        area: getComponent(['sublocality', 'sublocality_level_1', 'neighborhood'], ''),
        city: getComponent(['locality'], ''),
        taluk: taluk || getComponent(['sublocality'], ''), // Fallback to sublocality if taluk not found
        district: district || getComponent(['administrative_area_level_2'], ''),
        state: getComponent(['administrative_area_level_1'], ''),
        pincode: getComponent(['postal_code'], ''),
        country: getComponent(['country'], '')
      };
    } else {
      // Fallback to OpenStreetMap if Google API fails
      return await fallbackReverseGeocode(latitude, longitude);
    }
  } catch (err) {
    console.error('Google reverse geocoding error:', err);
    // Fallback to OpenStreetMap
    return await fallbackReverseGeocode(latitude, longitude);
  }
}

// Fallback reverse geocoding using OpenStreetMap
async function fallbackReverseGeocode(latitude, longitude) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
        zoom: 18
      },
      headers: {
        'User-Agent': 'DisasterAlert/1.0'
      }
    });

    const data = response.data;
    const address = data.address || {};

    return {
      place_name: data.display_name || '',
      full_address: data.display_name || '',
      nearest_landmark: address.amenity || address.building || address.leisure || address.tourism || '',
      area: address.suburb || address.neighbourhood || address.quarter || '',
      city: address.city || address.town || address.village || address.municipality || '',
      taluk: address.county || address.district || '', // OpenStreetMap uses county for taluk
      district: address.district || address.county || '',
      state: address.state || address.region || '',
      pincode: address.postcode || '',
      country: address.country || ''
    };
  } catch (err) {
    console.error('Fallback reverse geocoding error:', err);
    return {
      place_name: '',
      full_address: `${latitude}, ${longitude}`,
      nearest_landmark: '',
      area: '',
      city: '',
      taluk: '',
      district: '',
      state: '',
      pincode: '',
      country: ''
    };
  }
}

// Analyze photo based on category and description
// Analyze photo using Gemini AI (with image support)
async function analyzePhotoWithGemini(imagePath, category, description) {
  if (!geminiAI) {
    return analyzePhoto(category, description);
  }

  try {
    // For Gemini Pro Vision, we need to convert image to base64
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Get file extension to determine MIME type
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Use Gemini Pro Vision for image analysis
    const model = geminiAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    
    const prompt = `Analyze this emergency incident photo. Category: ${category || 'Unknown'}. 
Description: ${description || 'No description provided'}.

Provide a brief, factual description of what you see in the image (e.g., accident/fire/flood/electrical issue). 
Keep it short (1-2 sentences) and focus on visible evidence.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const analysis = response.text().trim();
    
    console.log('✅ Gemini photo analysis successful');
    return analysis || analyzePhoto(category, description);
  } catch (err) {
    console.error('❌ Gemini photo analysis error:', err.message);
    // Fallback to basic analysis
    return analyzePhoto(category, description);
  }
}

// Basic photo analysis (fallback)
function analyzePhoto(category, description) {
  const categoryAnalysis = {
    'Fire': 'Fire incident detected. Visible flames, smoke, or fire-related damage observed.',
    'Flood': 'Flooding situation visible. Water accumulation, submerged areas, or water damage present.',
    'Accident': 'Traffic or vehicular accident scene. Vehicles involved, debris, or emergency response visible.',
    'Electricity': 'Electrical issue detected. Power lines, electrical equipment, or power-related problem visible.'
  };

  let analysis = categoryAnalysis[category] || 'Emergency incident reported. Visual evidence captured.';
  
  if (description) {
    analysis += ` Additional context: ${description.substring(0, 100)}.`;
  }

  return analysis;
}

// Authentication middleware
function authenticateToken(req, res, next) {
  // Try multiple ways to get token
  let token = null;
  
  // From Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }
  
  // From query parameter
  if (!token && req.query.token) {
    token = req.query.token.trim();
  }
  
  // From body (for some requests)
  if (!token && req.body && req.body.token) {
    token = req.body.token.trim();
  }
  
  if (!token || token.length === 0) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const userData = activeTokens.get(token);
  if (!userData) {
    console.warn('Invalid token attempt:', token.substring(0, 10) + '...');
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }

  req.user = userData;
  next();
}

// Admin-only middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// API Routes

// Authentication Routes
app.post('/api/auth/signup', (req, res) => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Validate username
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const passwordHash = hashPassword(password);

  // Check if username already exists (case-insensitive)
  db.get('SELECT * FROM users WHERE LOWER(TRIM(username)) = ?', 
    [trimmedUsername.toLowerCase()], 
    (err, existingUser) => {
      if (err) {
        console.error('Signup check error:', err);
        return res.status(500).json({ error: 'Database error. Please try again.' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Insert new user
      db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', 
        [trimmedUsername, passwordHash, role], 
        function(err) {
          if (err) {
            console.error('Signup insert error:', err);
            if (err.message.includes('UNIQUE')) {
              return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: 'Failed to create account. Please try again.' });
          }

          const token = generateToken();
          const user = { id: this.lastID, username: trimmedUsername, role };
          activeTokens.set(token, user);

          console.log(`New user ${trimmedUsername} signed up successfully`);

          res.json({ 
            token, 
            user: { id: user.id, username: user.username, role: user.role }
          });
        }
      );
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Trim and normalize username (case-insensitive)
  const normalizedUsername = username.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  // Try to find user (case-insensitive username match)
  db.get('SELECT * FROM users WHERE LOWER(TRIM(username)) = ?', 
    [normalizedUsername], 
    (err, user) => {
      if (err) {
        console.error('Login database error:', err);
        return res.status(500).json({ error: 'Database error. Please try again.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      if (user.password_hash !== passwordHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check role if specified (but allow login even if role doesn't match exactly)
      if (role && user.role !== role && role !== 'user') {
        // Only enforce role check if it's not a generic 'user' request
        console.warn(`Role mismatch: user role is ${user.role}, requested ${role}`);
      }

      // Generate token and store user data
      const token = generateToken();
      const userData = { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      };
      activeTokens.set(token, userData);

      console.log(`User ${user.username} logged in successfully`);

      res.json({ 
        token, 
        user: { 
          id: userData.id, 
          username: userData.username, 
          role: userData.role 
        }
      });
    }
  );
});

app.post('/api/auth/admin-login', (req, res) => {
  const { username, password, securityKey } = req.body;

  if (!username || !password || !securityKey) {
    return res.status(400).json({ error: 'Username, password, and security key required' });
  }

  // Verify security key (trim and compare)
  const trimmedKey = securityKey.trim();
  if (trimmedKey !== ADMIN_SECURITY_KEY) {
    return res.status(401).json({ error: 'Invalid security key' });
  }

  // Normalize username (case-insensitive)
  const normalizedUsername = username.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  db.get('SELECT * FROM users WHERE LOWER(TRIM(username)) = ? AND role = ?', 
    [normalizedUsername, 'admin'], 
    (err, user) => {
      if (err) {
        console.error('Admin login database error:', err);
        return res.status(500).json({ error: 'Database error. Please try again.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      if (user.password_hash !== passwordHash) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      const token = generateToken();
      const userData = { id: user.id, username: user.username, role: user.role };
      activeTokens.set(token, userData);

      console.log(`Admin ${user.username} logged in successfully`);

      res.json({ 
        token, 
        user: { id: userData.id, username: userData.username, role: userData.role }
      });
    }
  );
});


app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  activeTokens.delete(token);
  res.json({ message: 'Logged out successfully' });
});

// Get all incidents
app.get('/api/incidents', (req, res) => {
  const { category, status, department, userId } = req.query;
  let query = 'SELECT * FROM incidents WHERE 1=1';
  const params = [];

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }

  if(userId){
    query += ' AND user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Add IST datetime to each incident
    const incidentsWithIST = rows.map(row => ({
      ...row,
      reported_datetime: formatISTDateTime(row.created_at)
    }));
    res.json(incidentsWithIST);
  });
});

// Get single incident
app.get('/api/incidents/:id', (req, res) => {
  db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    // Add IST datetime
    const incidentWithIST = {
      ...row,
      reported_datetime: formatISTDateTime(row.created_at)
    };
    res.json(incidentWithIST);
  });
});

// Get incident location details in specified JSON format
app.get('/api/incidents/:id/location', (req, res) => {
  db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ 
        status: "error", 
        message: "Incident not found" 
      });
    }

    res.json({
      status: "success",
      place_name: row.place_name || '',
      full_address: row.full_address || row.location || '',
      nearest_landmark: row.nearest_landmark || '',
      area: row.area || '',
      city: row.city || '',
      state: row.state || '',
      pincode: row.pincode || '',
      country: row.country || '',
      google_maps_link: row.google_maps_link || (row.latitude && row.longitude ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}&key=${GOOGLE_MAPS_API_KEY}` : ''),
      photo_analysis: row.photo_analysis || '',
      user_description: row.description || ''
    });
  });
});

// Create incident with image processing and location details
app.post('/api/incidents', upload.single('image'), async (req, res) => {
  const { title, description, category, location, latitude, longitude, user_id } = req.body;
  
  // STEP 1: Check if camera image is provided (REQUIRED)
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "Camera image is required. Report cannot be accepted."
    });
  }

  const image_url = `/uploads/${req.file.filename}`;
  const imagePath = path.join(uploadsDir, req.file.filename);

  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required' });
  }

  try {
    // STEP 2: Extract GPS coordinates from image EXIF or use provided coordinates
    let finalLat = latitude ? parseFloat(latitude) : null;
    let finalLng = longitude ? parseFloat(longitude) : null;

    // Try to extract GPS from image EXIF data
    const gpsFromImage = extractGPSFromImage(imagePath);
    if (gpsFromImage) {
      finalLat = gpsFromImage.latitude;
      finalLng = gpsFromImage.longitude;
    }

    // If still no coordinates, use provided location or default
    if (!finalLat || !finalLng) {
      // Try to parse from location string if provided
      if (location && location.includes(',')) {
        const coords = location.split(',').map(c => parseFloat(c.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          finalLat = coords[0];
          finalLng = coords[1];
        }
      }
    }

    // STEP 3: Reverse geocode to get full address details
    let locationDetails = {
      place_name: location || '',
      full_address: location || '',
      nearest_landmark: '',
      area: '',
      city: '',
      state: '',
      pincode: '',
      country: '',
      google_maps_link: '',
      photo_analysis: ''
    };

    if (finalLat && finalLng) {
      // Reverse geocode to get address
      locationDetails = await reverseGeocode(finalLat, finalLng);
      locationDetails.google_maps_link = `https://www.google.com/maps?q=${finalLat},${finalLng}&key=${GOOGLE_MAPS_API_KEY}`;
    } else {
      // If no coordinates, create a basic Google Maps link from location string
      locationDetails.google_maps_link = `https://www.google.com/maps/search/${encodeURIComponent(location || '')}`;
    }

        // STEP 4: Analyze photo using Gemini AI (if available)
    if (geminiAI && req.file) {
      try {
        locationDetails.photo_analysis = await analyzePhotoWithGemini(imagePath, category, description);
      } catch (err) {
        console.warn('Gemini photo analysis failed, using fallback:', err.message);
        locationDetails.photo_analysis = analyzePhoto(category, description);
      }
    } else {
      locationDetails.photo_analysis = analyzePhoto(category, description);
    }

    // STEP 5: Insert into database with all location details
    const query = `INSERT INTO incidents (
      title, description, category, location, latitude, longitude, 
      image_url, user_id, status, place_name, full_address, 
      nearest_landmark, area, city, taluk, district, state, pincode, country, 
      google_maps_link, photo_analysis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Reported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [
      title, 
      description || '', 
      category, 
      location || locationDetails.full_address, 
      finalLat, 
      finalLng, 
      image_url, 
      user_id || 'anonymous',
      locationDetails.place_name,
      locationDetails.full_address,
      locationDetails.nearest_landmark,
      locationDetails.area,
      locationDetails.city,
      locationDetails.taluk || '',
      locationDetails.district || '',
      locationDetails.state,
      locationDetails.pincode,
      locationDetails.country,
      locationDetails.google_maps_link,
      locationDetails.photo_analysis
    ], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }

      // Get the created incident
      db.get('SELECT * FROM incidents WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // STEP 6: Return success response in STRICT JSON format (no extra keys)
        const reportedDateTime = getISTDateTime();
        
        res.status(201).json({
          status: "success",
          place_name: locationDetails.place_name || '',
          full_address: locationDetails.full_address || '',
          nearest_landmark: locationDetails.nearest_landmark || '',
          area: locationDetails.area || '',
          city: locationDetails.city || '',
          state: locationDetails.state || '',
          pincode: locationDetails.pincode || '',
          country: locationDetails.country || '',
          google_maps_link: locationDetails.google_maps_link || `https://www.google.com/maps?q=${finalLat || ''},${finalLng || ''}`,
          photo_analysis: locationDetails.photo_analysis || '',
          user_description: description || '',
          reported_datetime: reportedDateTime
        });
      });
    });
  } catch (error) {
    console.error('Error processing incident:', error);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to process incident. Please try again." 
    });
  }
});

// Update incident status (Admin only)
app.patch('/api/incidents/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const { status, department } = req.body;
  const validStatuses = ['Reported', 'Verified', 'In Progress', 'Resolved'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const query = `UPDATE incidents SET status = ?, department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(query, [status, department || null, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    });
  });
});

// Get user's incident history
app.get('/api/users/:userId/incidents', (req, res) => {
  db.all('SELECT * FROM incidents WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get nearby incidents (for notifications)
app.get('/api/incidents/nearby', (req, res) => {
  const { latitude, longitude, radius = 5000 } = req.query; // radius in meters

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }

  // Simple distance calculation (Haversine formula approximation)
  const query = `SELECT *, 
    (6371000 * acos(cos(radians(?)) * cos(radians(latitude)) * 
    cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
    sin(radians(latitude)))) AS distance
    FROM incidents 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
    AND status != 'Resolved'
    HAVING distance < ?
    ORDER BY distance ASC
    LIMIT 10`;

  db.all(query, [parseFloat(latitude), parseFloat(longitude), parseFloat(latitude), parseFloat(radius)], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Role-based incident retrieval endpoint
app.get('/api/incidents/role-based', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { selected_state, selected_taluk } = req.query;

  if (role === 'user') {
    // User role: Only show their own reports
    db.all('SELECT * FROM incidents WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return res.json({
          status: "empty",
          message: "No issues reported yet.",
          role: "user",
          user_visible_reports: []
        });
      }

      // Format user's reports
      const userReports = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        location_details: {
          place_name: row.place_name || '',
          full_address: row.full_address || row.location || '',
          nearest_landmark: row.nearest_landmark || '',
          area: row.area || '',
          taluk: row.taluk || '',
          district: row.district || '',
          state: row.state || '',
          pincode: row.pincode || '',
          country: row.country || '',
          google_maps_link: row.google_maps_link || (row.latitude && row.longitude ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}` : '')
        },
        issue_details: {
          user_id: row.user_id,
          description: row.description || '',
          photo_analysis: row.photo_analysis || ''
        },
        image_url: row.image_url,
        created_at: row.created_at
      }));

      res.json({
        status: "success",
        role: "user",
        user_visible_reports: userReports
      });
    });
  } else if (role === 'admin') {
    // Admin role: Filter by state and taluk if provided
    let query = 'SELECT * FROM incidents WHERE 1=1';
    const params = [];
    let passesFilter = true;

    if (selected_state) {
      query += ' AND state = ?';
      params.push(selected_state);
    }

    if (selected_taluk) {
      query += ' AND taluk = ?';
      params.push(selected_taluk);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Generate heatmap data (coordinates only)
      const heatmapData = rows
        .filter(row => row.latitude && row.longitude)
        .map(row => ({
          lat: row.latitude,
          lng: row.longitude
        }));

      // Format admin reports with IST datetime
      const adminReports = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        location_details: {
          place_name: row.place_name || '',
          full_address: row.full_address || row.location || '',
          nearest_landmark: row.nearest_landmark || '',
          area: row.area || '',
          taluk: row.taluk || '',
          district: row.district || '',
          state: row.state || '',
          pincode: row.pincode || '',
          country: row.country || '',
          google_maps_link: row.google_maps_link || (row.latitude && row.longitude ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}` : '')
        },
        issue_details: {
          user_id: row.user_id,
          description: row.description || '',
          photo_analysis: row.photo_analysis || ''
        },
        reported_datetime: formatISTDateTime(row.created_at),
        image_url: row.image_url,
        created_at: row.created_at
      }));

      // Check if filters are applied and if results match
      if (selected_state || selected_taluk) {
        passesFilter = rows.length > 0;
      }

      res.json({
        status: "success",
        role: "admin",
        admin_filters: {
          selected_state: selected_state || '',
          selected_taluk: selected_taluk || '',
          passes_filter: passesFilter
        },
        admin_heatmap_data: heatmapData,
        reports: adminReports,
        total_count: rows.length
      });
    });
  } else {
    res.status(403).json({ error: 'Invalid role' });
  }
});

// Gemini API endpoint for location conversion (standalone)
app.post('/api/gemini/convert-location', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      status: 'error',
      message: 'Latitude and longitude are required'
    });
  }

  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid coordinates'
      });
    }

    // Use Gemini API for location conversion
    const locationDetails = await reverseGeocodeWithGemini(lat, lng);
    
    if (locationDetails && locationDetails.full_address) {
      // Generate Google Maps link
      locationDetails.google_maps_link = `https://www.google.com/maps?q=${lat},${lng}`;
      
      return res.json({
        status: 'success',
        ...locationDetails,
        google_maps_link: locationDetails.google_maps_link
      });
    } else {
      // Fallback to standard reverse geocoding
      const fallbackDetails = await reverseGeocode(lat, lng);
      fallbackDetails.google_maps_link = `https://www.google.com/maps?q=${lat},${lng}`;
      
      return res.json({
        status: 'success',
        ...fallbackDetails,
        google_maps_link: fallbackDetails.google_maps_link
      });
    }
  } catch (err) {
    console.error('Location conversion error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to convert location: ' + err.message
    });
  }
});

// Get analytics (Admin only)
app.get('/api/analytics', authenticateToken, requireAdmin, (req, res) => {
  const { month, year } = req.query;
  const dateFilter = month && year ? `AND strftime('%m', created_at) = '${month.padStart(2, '0')}' AND strftime('%Y', created_at) = '${year}'` : '';

  Promise.all([
    new Promise((resolve, reject) => {
      db.all(`SELECT category, COUNT(*) as count FROM incidents WHERE 1=1 ${dateFilter} GROUP BY category`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(`SELECT location, COUNT(*) as count FROM incidents WHERE 1=1 ${dateFilter} GROUP BY location ORDER BY count DESC LIMIT 10`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(`SELECT status, COUNT(*) as count FROM incidents WHERE 1=1 ${dateFilter} GROUP BY status`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM incidents GROUP BY month ORDER BY month DESC LIMIT 12`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  ]).then(([byCategory, topAreas, byStatus, monthly]) => {
    res.json({ byCategory, topAreas, byStatus, monthly });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Get departments
app.get('/api/departments', (req, res) => {
  db.all('SELECT * FROM departments', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Serve landing page as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

// Serve admin.html (authentication checked on client side)
// The file will be served, but client-side JS will check auth

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIP = '127.0.0.1';

  for (const iface of Object.values(networkInterfaces)) {
    for (const details of iface) {
      if (details.family === 'IPv4' && !details.internal) {
        localIP = details.address;
      }
    }
  }

  console.log(`\n🚀 Server is running!`);
  console.log(`Local:    http://localhost:${PORT}`);
  console.log(`Network:  http://${localIP}:${PORT}\n`);

  console.log(`🔐 Login Page:      http://${localIP}:${PORT}/login.html`);
  console.log(`👤 User Dashboard:  http://${localIP}:${PORT}/user.html`);
  console.log(`🛠 Admin Panel:     http://${localIP}:${PORT}/admin.html`);

  console.log(`\n--- Default Admin Credentials ---`);
  console.log(`Username: admin`);
  console.log(`Password: admin123`);
  console.log(`Security Key: ${ADMIN_SECURITY_KEY}`);
});


