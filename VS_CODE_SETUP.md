# How to Run DisasterAlert in VS Code

## Quick Start Guide

### Step 1: Open Project in VS Code

1. **Open VS Code**
2. **File → Open Folder** (or `Ctrl+K Ctrl+O`)
3. Navigate to your project folder: `d:\hack2`
4. Click **Select Folder**

---

### Step 2: Install Dependencies

1. **Open Terminal in VS Code:**
   - Press `` Ctrl+` `` (backtick) OR
   - Go to **Terminal → New Terminal**

2. **Install Node.js packages:**
   ```bash
   npm install
   ```
   
   This will install all required dependencies:
   - Express.js
   - SQLite3
   - Multer
   - CORS
   - And others...

---

### Step 3: Run the Server

#### Option A: Using Terminal (Recommended)

1. **In the VS Code terminal, run:**
   ```bash
   npm start
   ```

2. **You should see:**
   ```
   Server running on http://localhost:3000
   Login Page: http://localhost:3000/login.html
   User Dashboard: http://localhost:3000/user.html
   Admin Dashboard: http://localhost:3000/admin.html
   ```

#### Option B: Using Nodemon (Auto-reload on changes)

1. **For development with auto-reload:**
   ```bash
   npm run dev
   ```
   
   *(Requires nodemon - install with: `npm install -g nodemon`)*

---

### Step 4: Access the Application

Open your browser and navigate to:

- **Landing Page:** http://localhost:3000
- **Login Page:** http://localhost:3000/login.html
- **User Dashboard:** http://localhost:3000/user.html
- **Admin Dashboard:** http://localhost:3000/admin.html

---

## VS Code Configuration (Optional)

### Create Launch Configuration

1. **Create `.vscode` folder** in project root (if it doesn't exist)

2. **Create `.vscode/launch.json`:**
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Launch DisasterAlert Server",
         "program": "${workspaceFolder}/server/server.js",
         "cwd": "${workspaceFolder}",
         "console": "integratedTerminal",
         "restart": true,
         "runtimeExecutable": "node"
       }
     ]
   }
   ```

3. **Now you can:**
   - Press `F5` to start debugging
   - Or go to **Run → Start Debugging**

---

### Create Tasks Configuration

1. **Create `.vscode/tasks.json`:**
   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "Start Server",
         "type": "shell",
         "command": "npm start",
         "problemMatcher": [],
         "isBackground": true,
         "presentation": {
           "reveal": "always",
           "panel": "new"
         }
       },
       {
         "label": "Start Dev Server",
         "type": "shell",
         "command": "npm run dev",
         "problemMatcher": [],
         "isBackground": true,
         "presentation": {
           "reveal": "always",
           "panel": "new"
         }
       }
     ]
   }
   ```

2. **To run tasks:**
   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select "Start Server" or "Start Dev Server"

---

## Troubleshooting

### Port 3000 Already in Use

If you see `Error: listen EADDRINUSE: address already in use :::3000`:

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Or change port in `server/server.js`:**
```javascript
const PORT = 3001; // Change to different port
```

---

### Dependencies Not Installing

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

2. **Delete node_modules and package-lock.json:**
   ```bash
   rm -rf node_modules package-lock.json
   ```

3. **Reinstall:**
   ```bash
   npm install
   ```

---

### Database Issues

If you see database errors:

1. **Delete existing database:**
   - Delete `server/disasteralert.db`
   - Restart server (it will create a new database)

2. **Check database permissions:**
   - Ensure VS Code has write permissions to the `server` folder

---

## Recommended VS Code Extensions

Install these extensions for better development experience:

1. **ES6 String HTML** - Syntax highlighting
2. **JavaScript (ES6) code snippets** - Code completion
3. **Prettier** - Code formatting
4. **Live Server** - Alternative to running Node server (for frontend only)
5. **SQLite Viewer** - View database files

---

## Project Structure in VS Code

```
📁 hack2/
├── 📁 .vscode/          (VS Code config - optional)
├── 📁 node_modules/     (Dependencies)
├── 📁 public/           (Frontend files)
│   ├── index.html
│   ├── login.html
│   ├── user.html
│   ├── admin.html
│   ├── script.js
│   ├── admin.js
│   └── ...
├── 📁 server/           (Backend files)
│   ├── server.js
│   └── disasteralert.db
├── package.json
└── README.md
```

---

## Quick Commands Reference

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Start server | `npm start` |
| Start dev server (auto-reload) | `npm run dev` |
| Stop server | `Ctrl+C` in terminal |

---

## Default Credentials

**Admin Login:**
- Username: `admin`
- Password: `admin123`
- Security Key: `DISASTER_ALERT_2024_SECURE_KEY`

---

## Next Steps

1. ✅ Open project in VS Code
2. ✅ Install dependencies (`npm install`)
3. ✅ Start server (`npm start`)
4. ✅ Open http://localhost:3000 in browser
5. ✅ Test the application!

---

## Need Help?

- Check the terminal for error messages
- Verify Node.js is installed: `node --version`
- Verify npm is installed: `npm --version`
- Check if port 3000 is available
- Review `server/server.js` for any configuration issues

