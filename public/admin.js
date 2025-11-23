// admin.js — Enhanced Admin Dashboard

const adminApp = document.getElementById('admin-app');
const state = { view: 'dashboard', department: null };
let INCIDENTS = [];
let DEPARTMENTS = [];
let ANALYTICS = null;
let currentUser = null;
let authToken = null;

// Check authentication
async function checkAdminAuth() {
  // Get token from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  authToken = urlParams.get('token') || localStorage.getItem('token');
  
  if (!authToken) {
    window.location.href = 'login.html?error=Please login as admin';
    return false;
  }

  try {
    const response = await fetch('/api/auth/me', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      window.location.href = 'login.html?error=Invalid or expired session';
      return false;
    }

    const data = await response.json();
    currentUser = data.user;

    if (currentUser.role !== 'admin') {
      window.location.href = 'login.html?error=Admin access required';
      return false;
    }

    // Initialize settings state with current user data
    if (currentUser) {
      settingsState.profile.name = currentUser.username || 'Admin';
      settingsState.profile.email = currentUser.email || 'admin@disasteralert.com';
    }

    return true;
  } catch (err) {
    window.location.href = 'login.html?error=Authentication failed';
    return false;
  }
}

// Helper function to add auth header
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

function el(tag, cls='', inner=''){ 
  const e = document.createElement(tag); 
  if(cls) e.className = cls; 
  if(inner) e.innerHTML = inner; 
  return e; 
}

// API calls
async function fetchIncidents() {
  try {
    // Build query based on selected filters
    let url = '/api/incidents';

    const params = [];

    // Filter by department only if selected
    if (state.department && state.department !== "All") {
      params.push(`department=${state.department}`);
    }

    // Filter by category (Fire, Accident, Flood, etc.)
    if (state.category && state.category !== "All") {
      params.push(`category=${encodeURIComponent(state.category)}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await fetch(url);
    INCIDENTS = await response.json();
    render();
  } catch (err) {
    console.error('Failed to fetch incidents:', err);
  }
}



async function fetchDepartments() {
  try {
    // Departments endpoint is public, no auth needed
    const response = await fetch('/api/departments');
    DEPARTMENTS = await response.json();
    render();
  } catch (err) {
    console.error('Failed to fetch departments:', err);
  }
}

async function fetchAnalytics() {
  try {
    const response = await fetch('/api/analytics', {
      headers: getAuthHeaders()
    });
    ANALYTICS = await response.json();
    render();
  } catch (err) {
    console.error('Failed to fetch analytics:', err);
  }
}

async function updateStatus(id, status, department) {
  try {
    const response = await fetch(`/api/incidents/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, department })
    });
    if (response.ok) {
      await fetchIncidents();
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

function sidebar(){
  const s = el('div','sidebar');
  s.appendChild(el('div','brand','DisasterAlert — Admin'));
  
  const items = [
    { id:'dashboard', label:'Dashboard' },
    { id:'incidents', label:'Incidents' },
    { id:'analytics', label:'Analytics' },
    { id:'settings', label:'Settings' }
  ];
  
  items.forEach(it=>{
    const ni = el('div','nav-item ' + (state.view===it.id?'active':''), it.label);
    ni.onclick = ()=> { state.view = it.id; render(); };
    s.appendChild(ni);
  });

  // Category Filter
const categoryFilter = el('div','dept-filter');
categoryFilter.innerHTML = '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1)"><strong>Filter by Category</strong></div>';

const categories = ['All','Fire','Flood','Accident','Electricity'];

categories.forEach(cat => {
  const btn = el(
    'button',
    'dept-btn ' + (state.category === cat ? 'active' : ''),
    cat
  );

  btn.onclick = () => {
    state.category = cat;
    fetchIncidents();
  };

  categoryFilter.appendChild(btn);
});

s.appendChild(categoryFilter);


  // Department filter
  const deptFilter = el('div','dept-filter');
  deptFilter.innerHTML = '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1)"><strong>Department Filter</strong></div>';
  const allBtn = el('button','dept-btn ' + (!state.department ? 'active' : ''), 'All');
  allBtn.onclick = () => { state.department = null; fetchIncidents(); };
  deptFilter.appendChild(allBtn);
  
  DEPARTMENTS.forEach(dept => {
    const btn = el('button','dept-btn ' + (state.department===dept.name ? 'active' : ''), dept.name);
    btn.onclick = () => { state.department = dept.name; fetchIncidents(); };
    deptFilter.appendChild(btn);
  });
  s.appendChild(deptFilter);

  s.appendChild(el('div','small',`Logged in as: ${currentUser?.username || 'admin'}`));
  
  // Logout button
  const logoutBtn = el('button','dept-btn');
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.marginTop = '20px';
  logoutBtn.onclick = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {}
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  };
  s.appendChild(logoutBtn);
  
  return s;
}

// Get current IST datetime
// Universal time formatting function with AM/PM
function formatTimeWithAmPm(date) {
  if (!date) return 'Just now';
  
  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'object' && date.created_at) {
    dateObj = new Date(date.created_at);
  } else {
    return 'Just now';
  }
  
  if (isNaN(dateObj.getTime())) return 'Just now';
  
  // Convert to IST (UTC+5:30)
  const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
  
  const day = String(istTime.getDate()).padStart(2, '0');
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const year = istTime.getFullYear();
  
  // Format hours in 12-hour format with AM/PM
  let hours = istTime.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = String(hours).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;
}

function getCurrentISTDateTime() {
  return formatTimeWithAmPm(new Date());
}

// Initialize admin heatmap
function initAdminHeatmap() {
  const container = document.getElementById('admin-heatmap-container');
  if (!container || !window.L) return;

  const incidentsWithCoords = INCIDENTS.filter(i => i.latitude && i.longitude);
  
  if (incidentsWithCoords.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No incidents with location data</div>';
    return;
  }

  // Calculate center from incidents
  const avgLat = incidentsWithCoords.reduce((sum, i) => sum + i.latitude, 0) / incidentsWithCoords.length;
  const avgLng = incidentsWithCoords.reduce((sum, i) => sum + i.longitude, 0) / incidentsWithCoords.length;

  const map = L.map(container).setView([avgLat, avgLng], 12);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Add markers for incidents with different colors based on status
  incidentsWithCoords.forEach(incident => {
    let markerColor = '#3388ff'; // Default blue
    if (incident.status === 'Resolved') markerColor = '#22c55e'; // Green
    else if (incident.status === 'In Progress') markerColor = '#f59e0b'; // Orange
    else if (incident.status === 'Verified') markerColor = '#3b82f6'; // Blue
    else markerColor = '#ef4444'; // Red for Reported

    const marker = L.marker([incident.latitude, incident.longitude], {
      icon: L.divIcon({
        className: 'incident-marker',
        html: `<div style="background: ${markerColor}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map);
    
    const exactLocation = getExactLocation(incident);
    const timeDisplay = formatTime(incident);
    marker.bindPopup(`
      <b>${incident.title}</b><br>
      Category: ${incident.category}<br>
      Status: ${incident.status}<br>
      Location: ${exactLocation}<br>
      Reported: ${timeDisplay}
    `);
  });

  // Fit bounds to show all incidents
  if (incidentsWithCoords.length > 0) {
    const group = new L.featureGroup(incidentsWithCoords.map(i => 
      L.marker([i.latitude, i.longitude])
    ));
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function content(){
  const c = el('div','content');
  const hr = el('div','header-row');
  const headerLeft = el('div');
  headerLeft.innerHTML = `<strong>Admin Dashboard</strong><div class="small" style="margin-top:4px">Current Time: ${getCurrentISTDateTime()} IST</div>`;
  hr.appendChild(headerLeft);
  c.appendChild(hr);

  if(state.view === 'dashboard'){
    const pending = INCIDENTS.filter(i => i.status === 'Reported').length;
    const active = INCIDENTS.filter(i => i.status === 'Verified' || i.status === 'In Progress').length;
    const total = INCIDENTS.length;

    const cards = el('div','cards');
    cards.appendChild(el('div','card',`<h3>${pending}</h3><div class="small">Pending</div>`));
    cards.appendChild(el('div','card',`<h3>${active}</h3><div class="small">Active</div>`));
    cards.appendChild(el('div','card',`<h3>${total}</h3><div class="small">Total</div>`));
    c.appendChild(cards);

    const recent = el('div','list');
    recent.innerHTML = '<strong>Recent Incidents</strong>';
    INCIDENTS.slice(0, 5).forEach(it=>{
      const row = el('div','list-item');
      const exactLocation = getExactLocation(it);
      const timeDisplay = formatTime(it);
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>#${it.id}</strong> ${it.title}
            <div class="small">📍 ${exactLocation}</div>
            <div class="small" style="margin-top:4px;color:var(--accent)">🕐 Reported: ${timeDisplay}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <select class="status-select" data-id="${it.id}" onchange="handleStatusChange(${it.id}, this.value)">
              <option ${it.status==='Reported'?'selected':''}>Reported</option>
              <option ${it.status==='Verified'?'selected':''}>Verified</option>
              <option ${it.status==='In Progress'?'selected':''}>In Progress</option>
              <option ${it.status==='Resolved'?'selected':''}>Resolved</option>
            </select>
            <select class="dept-select" data-id="${it.id}" onchange="handleDeptChange(${it.id}, this.value)">
              <option value="">No Department</option>
              ${DEPARTMENTS.map(d => `<option ${it.department===d.name?'selected':''}>${d.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
      recent.appendChild(row);
    });
    c.appendChild(recent);

    // Add heatmap section
    const heatmapSection = el('div','list');
    heatmapSection.style.marginTop = '20px';
    heatmapSection.innerHTML = '<strong>Incident Heatmap</strong>';
    const heatmapContainer = el('div');
    heatmapContainer.id = 'admin-heatmap-container';
    heatmapContainer.style.width = '100%';
    heatmapContainer.style.height = '400px';
    heatmapContainer.style.marginTop = '12px';
    heatmapContainer.style.borderRadius = '8px';
    heatmapContainer.style.background = '#f0f0f0';
    heatmapSection.appendChild(heatmapContainer);
    c.appendChild(heatmapSection);
    
    // Initialize map after DOM is ready
    setTimeout(() => initAdminHeatmap(), 100);
    
  } else if(state.view === 'incidents'){
    const list = el('div','list');
    list.innerHTML = '<strong>All Incidents</strong>';
    if (INCIDENTS.length === 0) {
      list.innerHTML += '<div class="small" style="padding:20px">No incidents found</div>';
    } else {
      INCIDENTS.forEach(it=>{
        const r = el('div','list-item');
        const exactLocation = getExactLocation(it);
        const timeDisplay = formatTime(it);
        r.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>#${it.id}</strong> ${it.title}
              <div class="small">${it.category}</div>
              <div class="small" style="margin-top:4px">📍 ${exactLocation}</div>
              <div class="small" style="margin-top:4px;color:var(--accent)">🕐 Reported: ${timeDisplay}</div>
              ${it.image_url ? `<img src="${it.image_url}" style="width:200px;margin-top:8px;border-radius:4px" alt="incident">` : ''}
            </div>
            <div>
              <span class="status-badge ${it.status.toLowerCase().replace(' ','-')}">${it.status}</span>
              ${it.department ? `<div class="small">Dept: ${it.department}</div>` : ''}
            </div>
          </div>
        `;
        list.appendChild(r);
      });
    }
    c.appendChild(list);
    
  } else if(state.view === 'analytics'){
    if (ANALYTICS) {
      // By category
      const catCard = el('div','card');
      catCard.innerHTML = '<h3>By Category</h3>';
      ANALYTICS.byCategory.forEach(item => {
        catCard.innerHTML += `<div class="small">${item.category}: ${item.count}</div>`;
      });
      c.appendChild(catCard);

      // Top areas
      const areaCard = el('div','card');
      areaCard.innerHTML = '<h3>Top Problem Areas</h3>';
      ANALYTICS.topAreas.forEach(item => {
        areaCard.innerHTML += `<div class="small">${item.location}: ${item.count} incidents</div>`;
      });
      c.appendChild(areaCard);

      // By status
      const statusCard = el('div','card');
      statusCard.innerHTML = '<h3>By Status</h3>';
      ANALYTICS.byStatus.forEach(item => {
        statusCard.innerHTML += `<div class="small">${item.status}: ${item.count}</div>`;
      });
      c.appendChild(statusCard);

      // Monthly trend
      const monthlyCard = el('div','card');
      monthlyCard.innerHTML = '<h3>Monthly Trend</h3>';
      ANALYTICS.monthly.forEach(item => {
        monthlyCard.innerHTML += `<div class="small">${item.month}: ${item.count} incidents</div>`;
      });
      c.appendChild(monthlyCard);
    } else {
      c.appendChild(el('div','card','<h3>Loading analytics...</h3>'));
    }
    
  } else if(state.view === 'settings'){
    c.appendChild(renderSettings());
  }

  return c;
}

// Settings page state
const settingsState = {
  profile: {
    name: currentUser?.username || 'Admin',
    email: currentUser?.email || 'admin@disasteralert.com',
    role: 'Administrator'
  },
  preferences: {
    theme: 'dark', // dark or light
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    density: 'comfortable' // comfortable or compact
  },
  departments: {
    default: 'All',
    enabled: {
      'Police': true,
      'Fire': true,
      'Disaster Management': true,
      'Electricity': true
    }
  },
  security: {
    twoFactor: false,
    loginActivity: [
      { date: new Date().toISOString(), location: 'Mysuru, Karnataka', ip: '192.168.1.1', device: 'Chrome on Windows' },
      { date: new Date(Date.now() - 86400000).toISOString(), location: 'Mysuru, Karnataka', ip: '192.168.1.1', device: 'Chrome on Windows' }
    ]
  }
};

// Render Settings Page
function renderSettings() {
  const container = el('div', 'settings-container');
  
  // Page Header
  const header = el('div', 'settings-header');
  header.innerHTML = `
    <div>
      <h2 style="margin:0;font-size:24px;color:#fff;font-weight:800">Settings</h2>
      <div class="small" style="margin-top:4px">Manage your account preferences and system settings</div>
    </div>
  `;
  container.appendChild(header);

  // Profile Settings Section
  container.appendChild(createSettingsCard('Profile Settings', 'Manage your account information', renderProfileSettings()));

  // System Preferences Section
  container.appendChild(createSettingsCard('System Preferences', 'Customize your dashboard experience', renderSystemPreferences()));

  // Department Preferences Section
  container.appendChild(createSettingsCard('Department Preferences', 'Configure department views and filters', renderDepartmentPreferences()));

  // Security Settings Section
  container.appendChild(createSettingsCard('Security Settings', 'Manage security and authentication', renderSecuritySettings()));

  // Save Button
  const saveSection = el('div', 'settings-save-section');
  const saveBtn = el('button', 'btn-save', '💾 Save Changes');
  saveBtn.onclick = handleSaveSettings;
  saveSection.appendChild(saveBtn);
  container.appendChild(saveSection);

  return container;
}

// Create a settings card wrapper
function createSettingsCard(title, subtitle, content) {
  const card = el('div', 'settings-card');
  const cardHeader = el('div', 'settings-card-header');
  cardHeader.innerHTML = `
    <div>
      <h3 style="margin:0;font-size:18px;color:#fff;font-weight:700">${title}</h3>
      <div class="small" style="margin-top:4px">${subtitle}</div>
    </div>
  `;
  card.appendChild(cardHeader);
  
  const cardBody = el('div', 'settings-card-body');
  cardBody.appendChild(content);
  card.appendChild(cardBody);
  
  return card;
}

// Render Profile Settings
function renderProfileSettings() {
  const container = el('div', 'settings-form');
  
  // Name field
  const nameGroup = createFormGroup('Name', 'profile-name');
  const nameInput = el('input', 'settings-input');
  nameInput.type = 'text';
  nameInput.value = settingsState.profile.name;
  nameInput.id = 'profile-name';
  nameInput.oninput = (e) => { settingsState.profile.name = e.target.value; };
  nameGroup.appendChild(nameInput);
  container.appendChild(nameGroup);

  // Email field
  const emailGroup = createFormGroup('Email', 'profile-email');
  const emailInput = el('input', 'settings-input');
  emailInput.type = 'email';
  emailInput.value = settingsState.profile.email;
  emailInput.id = 'profile-email';
  emailInput.oninput = (e) => { settingsState.profile.email = e.target.value; };
  emailGroup.appendChild(emailInput);
  container.appendChild(emailGroup);

  // Role field (read-only)
  const roleGroup = createFormGroup('Role', 'profile-role');
  const roleInput = el('input', 'settings-input');
  roleInput.type = 'text';
  roleInput.value = settingsState.profile.role;
  roleInput.id = 'profile-role';
  roleInput.disabled = true;
  roleInput.style.opacity = '0.6';
  roleGroup.appendChild(roleInput);
  container.appendChild(roleGroup);

  // Change Password button
  const passwordGroup = el('div', 'settings-form-group');
  passwordGroup.innerHTML = '<label class="settings-label">Password</label>';
  const changePwdBtn = el('button', 'btn-secondary', '🔒 Change Password');
  changePwdBtn.onclick = () => {
    showToast('Password change feature coming soon!', 'info');
  };
  passwordGroup.appendChild(changePwdBtn);
  container.appendChild(passwordGroup);

  return container;
}

// Render System Preferences
function renderSystemPreferences() {
  const container = el('div', 'settings-form');
  
  // Theme Toggle
  const themeGroup = createToggleGroup('Dark Mode', 'pref-theme', settingsState.preferences.theme === 'dark', (checked) => {
    settingsState.preferences.theme = checked ? 'dark' : 'light';
    showToast(`Theme changed to ${checked ? 'Dark' : 'Light'} mode`, 'success');
  });
  container.appendChild(themeGroup);

  // Notification Settings
  container.appendChild(el('div', 'settings-section-divider'));
  container.appendChild(el('div', 'settings-section-title', 'Notification Preferences'));
  
  const emailNotif = createToggleGroup('Email Notifications', 'notif-email', settingsState.preferences.notifications.email, (checked) => {
    settingsState.preferences.notifications.email = checked;
  });
  container.appendChild(emailNotif);

  const smsNotif = createToggleGroup('SMS Notifications', 'notif-sms', settingsState.preferences.notifications.sms, (checked) => {
    settingsState.preferences.notifications.sms = checked;
  });
  container.appendChild(smsNotif);

  const pushNotif = createToggleGroup('Push Notifications', 'notif-push', settingsState.preferences.notifications.push, (checked) => {
    settingsState.preferences.notifications.push = checked;
  });
  container.appendChild(pushNotif);

  // Dashboard Density
  container.appendChild(el('div', 'settings-section-divider'));
  container.appendChild(el('div', 'settings-section-title', 'Dashboard Density'));
  
  const densityGroup = el('div', 'settings-form-group');
  densityGroup.innerHTML = '<label class="settings-label">View Density</label>';
  const densitySelect = el('select', 'settings-select');
  densitySelect.id = 'pref-density';
  densitySelect.innerHTML = `
    <option value="comfortable" ${settingsState.preferences.density === 'comfortable' ? 'selected' : ''}>Comfortable</option>
    <option value="compact" ${settingsState.preferences.density === 'compact' ? 'selected' : ''}>Compact</option>
  `;
  densitySelect.onchange = (e) => {
    settingsState.preferences.density = e.target.value;
  };
  densityGroup.appendChild(densitySelect);
  container.appendChild(densityGroup);

  return container;
}

// Render Department Preferences
function renderDepartmentPreferences() {
  const container = el('div', 'settings-form');
  
  // Default Department
  const defaultDeptGroup = el('div', 'settings-form-group');
  defaultDeptGroup.innerHTML = '<label class="settings-label">Default Department View</label>';
  const defaultDeptSelect = el('select', 'settings-select');
  defaultDeptSelect.id = 'dept-default';
  defaultDeptSelect.innerHTML = '<option value="All">All Departments</option>';
  DEPARTMENTS.forEach(dept => {
    const option = el('option');
    option.value = dept.name;
    option.textContent = dept.name;
    if (settingsState.departments.default === dept.name) option.selected = true;
    defaultDeptSelect.appendChild(option);
  });
  defaultDeptSelect.onchange = (e) => {
    settingsState.departments.default = e.target.value;
  };
  defaultDeptGroup.appendChild(defaultDeptSelect);
  container.appendChild(defaultDeptGroup);

  container.appendChild(el('div', 'settings-section-divider'));
  container.appendChild(el('div', 'settings-section-title', 'Enable/Disable Departments'));

  // Department toggles
  const deptNames = ['Police', 'Fire', 'Disaster Management','Flood', 'Electricity'];
  deptNames.forEach(deptName => {
    const deptToggle = createToggleGroup(
      deptName, 
      `dept-${deptName.toLowerCase().replace(' ', '-')}`,
      settingsState.departments.enabled[deptName] !== false,
      (checked) => {
        settingsState.departments.enabled[deptName] = checked;
      }
    );
    container.appendChild(deptToggle);
  });

  return container;
}

// Render Security Settings
function renderSecuritySettings() {
  const container = el('div', 'settings-form');
  
  // Two-Factor Authentication
  const twoFactorGroup = createToggleGroup('Two-Factor Authentication', 'security-2fa', settingsState.security.twoFactor, (checked) => {
    settingsState.security.twoFactor = checked;
    if (checked) {
      showToast('Two-factor authentication enabled. Setup instructions will be sent to your email.', 'info');
    } else {
      showToast('Two-factor authentication disabled.', 'warning');
    }
  });
  container.appendChild(twoFactorGroup);

  container.appendChild(el('div', 'settings-section-divider'));
  container.appendChild(el('div', 'settings-section-title', 'Login Activity'));

  // Login Activity List
  const activityList = el('div', 'settings-activity-list');
  settingsState.security.loginActivity.forEach((activity, index) => {
    const activityItem = el('div', 'settings-activity-item');
    const date = new Date(activity.date);
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    activityItem.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600;color:#fff;margin-bottom:4px">${dateStr} at ${timeStr}</div>
        <div class="small" style="margin-bottom:2px">📍 ${activity.location}</div>
        <div class="small">${activity.device} • IP: ${activity.ip}</div>
      </div>
    `;
    activityList.appendChild(activityItem);
  });
  container.appendChild(activityList);

  container.appendChild(el('div', 'settings-section-divider'));

  // Session Logout
  const sessionGroup = el('div', 'settings-form-group');
  const logoutBtn = el('button', 'btn-danger', '🚪 Logout All Sessions');
  logoutBtn.onclick = () => {
    if (confirm('Are you sure you want to logout from all devices? You will need to login again.')) {
      showToast('All sessions logged out successfully', 'success');
      // In real implementation, this would call an API
    }
  };
  sessionGroup.appendChild(logoutBtn);
  container.appendChild(sessionGroup);

  return container;
}

// Helper: Create form group
function createFormGroup(label, inputId) {
  const group = el('div', 'settings-form-group');
  const labelEl = el('label', 'settings-label', label);
  labelEl.setAttribute('for', inputId);
  group.appendChild(labelEl);
  return group;
}

// Helper: Create toggle group
function createToggleGroup(label, id, checked, onChange) {
  const group = el('div', 'settings-toggle-group');
  const labelEl = el('label', 'settings-toggle-label', label);
  labelEl.setAttribute('for', id);
  
  const toggleContainer = el('label', 'settings-toggle-container');
  const toggleInput = el('input', 'settings-toggle-input');
  toggleInput.type = 'checkbox';
  toggleInput.id = id;
  toggleInput.checked = checked;
  toggleInput.onchange = (e) => onChange(e.target.checked);
  
  const toggleSlider = el('span', 'settings-toggle-slider');
  toggleContainer.appendChild(toggleInput);
  toggleContainer.appendChild(toggleSlider);
  
  group.appendChild(labelEl);
  group.appendChild(toggleContainer);
  
  return group;
}

// Handle Save Settings
function handleSaveSettings() {
  // Show loading state
  const saveBtn = document.querySelector('.btn-save');
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '⏳ Saving...';

  // Simulate API call (replace with actual API call)
  setTimeout(() => {
    // In real implementation, send settingsState to backend
    console.log('Saving settings:', settingsState);
    
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    showToast('✅ Settings saved successfully!', 'success');
  }, 1000);
}

// Toast Notification System
function showToast(message, type = 'info') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());

  const toast = el('div', `toast toast-${type}`);
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('toast-show'), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format time - use reported_datetime if available, otherwise calculate IST from created_at
function formatTime(incident) {
  // Use the universal AM/PM formatting function
  if (incident.reported_datetime) {
    // Parse the reported_datetime string if it exists
    try {
      const date = new Date(incident.reported_datetime);
      if (!isNaN(date.getTime())) {
        return formatTimeWithAmPm(date);
      }
    } catch (e) {
      // If parsing fails, try to extract date from string
      const dateMatch = incident.reported_datetime.match(/(\d{2}-\d{2}-\d{4})/);
      if (dateMatch) {
        // Try to parse the date part
        const parts = dateMatch[1].split('-');
        const date = new Date(parts[2], parts[1] - 1, parts[0]);
        return formatTimeWithAmPm(date);
      }
    }
  }
  
  // Otherwise, use created_at
  return formatTimeWithAmPm(incident);
}

// Get exact location address
function getExactLocation(incident) {
  // Prefer full_address, then place_name, then location, then coordinates
  if (incident.full_address) {
    return incident.full_address;
  }
  if (incident.place_name) {
    return incident.place_name;
  }
  if (incident.location && !incident.location.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
    // If location is not just coordinates, use it
    return incident.location;
  }
  // If only coordinates available, show them
  if (incident.latitude && incident.longitude) {
    return `${incident.latitude}, ${incident.longitude}`;
  }
  return incident.location || 'Location not available';
}

// Global functions for inline handlers
window.handleStatusChange = async function(id, status) {
  const deptSelect = document.querySelector(`.dept-select[data-id="${id}"]`);
  const department = deptSelect ? deptSelect.value : null;
  await updateStatus(id, status, department);
};

window.handleDeptChange = async function(id, department) {
  const statusSelect = document.querySelector(`.status-select[data-id="${id}"]`);
  const status = statusSelect ? statusSelect.value : 'Reported';
  await updateStatus(id, status, department);
};

function render(){
  adminApp.innerHTML = '';
  const s = sidebar();
  const c = content();
  adminApp.appendChild(s);
  adminApp.appendChild(c);
}

// Initialize
(async () => {
  const authenticated = await checkAdminAuth();
  if (authenticated) {
    fetchIncidents();
    fetchDepartments();
    fetchAnalytics();
    setInterval(() => {
      fetchIncidents();
      if (state.view === 'analytics') fetchAnalytics();
    }, 30000);
    
    // Update time display every second
    setInterval(() => {
      const timeElement = document.querySelector('.header-row .small');
      if (timeElement && state.view === 'dashboard') {
        timeElement.textContent = `Current Time: ${getCurrentISTDateTime()} IST`;
      }
      
      // Update settings page time if visible
      const settingsTimeElement = document.querySelector('.settings-header .small');
      if (settingsTimeElement && state.view === 'settings') {
        // Settings page doesn't show time, but we can update if needed
      }
    }, 1000);
  }
})();
