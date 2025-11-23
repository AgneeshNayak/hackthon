# Quick Start Guide - DisasterAlert

## 🚀 Fastest Way to Start

### Option 1: Use the Batch File (Windows)
Double-click: **`start-server.bat`**

This will:
- ✅ Automatically kill any process using port 3000
- ✅ Start the server
- ✅ Show you the server status

---

### Option 2: Manual Start

1. **Open Terminal in VS Code:**
   - Press `` Ctrl+` `` (backtick)

2. **Kill existing process (if needed):**
   ```bash
   # Windows PowerShell
   netstat -ano | findstr ":3000"
   taskkill /PID <PID> /F
   
   # Or use the helper script
   .\kill-port-3000.bat
   ```

3. **Start server:**
   ```bash
   npm start
   ```

---

## 🔧 Troubleshooting Port 3000 Error

### Error: `EADDRINUSE: address already in use :::3000`

**Quick Fix:**
```bash
# Find the process
netstat -ano | findstr ":3000"

# Kill it (replace <PID> with actual number)
taskkill /PID <PID> /F
```

**Or use the helper script:**
```bash
.\kill-port-3000.bat
```

---

## 📝 Alternative: Change Port

If you want to use a different port:

1. **Edit `server/server.js`:**
   ```javascript
   const PORT = 3001; // Change from 3000 to 3001
   ```

2. **Access at:**
   - http://localhost:3001

---

## ✅ Verify Server is Running

After starting, you should see:
```
✅ Gemini AI initialized successfully
Server running on http://localhost:3000
Login Page: http://localhost:3000/login.html
User Dashboard: http://localhost:3000/user.html
Admin Dashboard: http://localhost:3000/admin.html
```

---

## 🌐 Access the Application

- **Landing Page:** http://localhost:3000
- **Login Page:** http://localhost:3000/login.html
- **User Dashboard:** http://localhost:3000/user.html
- **Admin Dashboard:** http://localhost:3000/admin.html

---

## 🔑 Default Admin Credentials

- **Username:** `admin`
- **Password:** `admin123`
- **Security Key:** `DISASTER_ALERT_2024_SECURE_KEY`

---

## 💡 Pro Tips

1. **Use `start-server.bat`** - It handles everything automatically
2. **Keep terminal open** - Server runs in the terminal
3. **Press `Ctrl+C`** to stop the server
4. **Check port status** - Use `netstat -ano | findstr ":3000"` anytime

---

## 🆘 Still Having Issues?

1. **Check Node.js is installed:**
   ```bash
   node --version
   ```

2. **Check npm is installed:**
   ```bash
   npm --version
   ```

3. **Reinstall dependencies:**
   ```bash
   npm install
   ```

4. **Check for multiple Node processes:**
   ```bash
   tasklist | findstr node
   ```

