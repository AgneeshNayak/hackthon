# DisasterAlert - Community Emergency Reporting & Response System

A comprehensive web application for reporting and managing emergency incidents in communities. This system allows citizens to quickly report emergencies while providing administrators with tools to track, manage, and analyze incidents.

## Features

### Level 1 (Minimum Requirements) ✅
- ✅ Users can report emergencies (title, description, location)
- ✅ Admin/responder dashboard to view reports
- ✅ Status updates: Reported → Verified → In Progress → Resolved
- ✅ List of active incidents

### Level 2 (Good to Have) ✅
- ✅ Category filters (Fire, Flood, Accident, Electricity, etc.)
- ✅ Image upload
- ✅ Real-time location tagging (Geolocation API)
- ✅ User's incident history

### Level 3 (Advanced Features) ✅
- ✅ Heatmap of incidents on a map (Leaflet.js)
- ✅ Notifications for nearby emergencies
- ✅ Multi-department admin (Police, Fire, Disaster Management, Electricity)
- ✅ Monthly incident analytics (frequent areas, problem types)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - User Interface: http://localhost:3000
   - Admin Dashboard: http://localhost:3000/admin.html

## Project Structure

```
disasteralert/
├── server/
│   └── server.js          # Backend API server
├── public/
│   ├── index.html         # User interface
│   ├── admin.html         # Admin dashboard
│   ├── script.js          # User frontend logic
│   ├── admin.js           # Admin frontend logic
│   ├── style.css          # User interface styles
│   ├── admin.css          # Admin dashboard styles
│   └── uploads/           # Uploaded images (created automatically)
├── package.json           # Node.js dependencies
└── README.md             # This file
```

## API Endpoints

### Incidents
- `GET /api/incidents` - Get all incidents (with optional filters: category, status, department)
- `GET /api/incidents/:id` - Get single incident
- `POST /api/incidents` - Create new incident (supports image upload)
- `PATCH /api/incidents/:id/status` - Update incident status and department
- `GET /api/incidents/nearby` - Get nearby incidents (requires latitude, longitude)

### Analytics
- `GET /api/analytics` - Get analytics data (by category, top areas, by status, monthly trends)

### Departments
- `GET /api/departments` - Get all departments

### User History
- `GET /api/users/:userId/incidents` - Get user's incident history

## Technologies Used

- **Backend:** Node.js, Express.js
- **Database:** SQLite3
- **File Upload:** Multer
- **Frontend:** Vanilla JavaScript (SPA)
- **Maps:** Leaflet.js (OpenStreetMap)
- **Styling:** CSS3

## Usage

### For Users:
1. Open the user interface
2. Click "REPORT EMERGENCY" to report a new incident
3. Fill in the form (category, title, description, location)
4. Optionally upload an image and use current location
5. Submit the report
6. View your report history in the "History" tab
7. Check "Alerts" for nearby emergencies

### For Administrators:
1. Open the admin dashboard
2. View dashboard statistics (Pending, Active, Total incidents)
3. Filter incidents by department
4. Update incident status and assign departments
5. View analytics (category breakdown, top problem areas, monthly trends)
6. Manage all incidents from the "Incidents" tab

## Database Schema

### Incidents Table
- id (INTEGER PRIMARY KEY)
- title (TEXT)
- description (TEXT)
- category (TEXT)
- location (TEXT)
- latitude (REAL)
- longitude (REAL)
- status (TEXT) - Reported, Verified, In Progress, Resolved
- image_url (TEXT)
- user_id (TEXT)
- department (TEXT)
- created_at (DATETIME)
- updated_at (DATETIME)

### Departments Table
- id (INTEGER PRIMARY KEY)
- name (TEXT UNIQUE)

### Users Table
- id (INTEGER PRIMARY KEY)
- username (TEXT UNIQUE)
- role (TEXT)
- department_id (INTEGER)

## Development

For development with auto-reload:
```bash
npm run dev
```

(Requires nodemon: `npm install -g nodemon`)

## License

ISC

