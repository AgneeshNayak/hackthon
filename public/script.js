// script.js — Enhanced User SPA with all features (fixed: geolocation + map re-init + time element)

let INCIDENTS = [];
let currentUser = null;
let currentUserId = null;
let userLocation = null;
let isFetchingLocation = false;   // guard to avoid duplicate geolocation requests
let mapInstance = null;

const app = document.getElementById('app');
const cameraInput = document.getElementById('cameraInput');
let state = { view: 'home', filter: 'All' };

// Check authentication
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    window.location.href = 'login.html';
    return false;
  }

  try {
    // Try multiple token formats
    const response = await fetch('/api/auth/me', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Auth check failed, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return false;
    }

    const data = await response.json();
    if (data.user) {
      currentUser = data.user;
      currentUserId = currentUser.id;
      return true;
    } else {
      // If user data exists in localStorage but not from server, use it temporarily
      const storedUser = JSON.parse(userStr);
      if (storedUser) {
        currentUser = storedUser;
        currentUserId = storedUser.id;
        return true;
      }
      window.location.href = 'login.html';
      return false;
    }
  } catch (err) {
    console.error('Auth check error:', err);
    // If network error, try to use stored user data
    const storedUser = JSON.parse(userStr);
    if (storedUser) {
      currentUser = storedUser;
      currentUserId = storedUser.id;
      return true;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
    return false;
  }
}

// Helper functions
function el(tag, cls='', inner=''){ 
  const e = document.createElement(tag); 
  if(cls) e.className = cls; 
  if(inner!=='') e.innerHTML = inner; 
  return e; 
}

function statusClass(s){
  if(s==='Reported') return 's-reported';
  if(s==='Verified') return 's-verified';
  if(s==='In Progress') return 's-progress';
  if(s==='Resolved') return 's-resolved';
  return '';
}

function iconFor(c){ 
  const icons = { 'Fire': '🔥', 'Flood': '💧', 'Accident': '🚗', 'Electricity': '⚡' };
  return icons[c] || '⚠️';
}

// API calls
async function fetchIncidents() {
  try {
    const response = await fetch('/api/incidents');
    INCIDENTS = await response.json();
    renderMain();
  } catch (err) {
    console.error('Failed to fetch incidents:', err);
  }
}

async function fetchNearbyAlerts() {
  if (!userLocation) return [];
  try {
    const response = await fetch(`/api/incidents/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=5000`);
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch nearby alerts:', err);
    return [];
  }
}

// Enhanced GPS location fetching with real-time updates
let locationWatchId = null;

function getLocation() {
  // If geolocation unsupported, try saved location and return
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported by this browser');
    const saved = localStorage.getItem('userLocation');
    if (saved) {
      try {
        userLocation = JSON.parse(saved);
        console.log('Using saved location:', userLocation);
      } catch (e) {
        console.warn('Could not parse saved location');
      }
    }
    return;
  }

  // Guard against multiple concurrent getCurrentPosition calls
  if (isFetchingLocation) {
    console.log('Already fetching location — skipping duplicate getLocation call');
    return;
  }
  isFetchingLocation = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      isFetchingLocation = false;
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      userLocation = newLocation;
      localStorage.setItem('userLocation', JSON.stringify(newLocation));
      console.log('✅ Real-time GPS location obtained:', {
        lat: newLocation.lat.toFixed(6),
        lng: newLocation.lng.toFixed(6),
        accuracy: `${Math.round(newLocation.accuracy)}m`
      });

      // Refresh map if it's already rendered
      if (state.view === 'home') {
        setTimeout(() => initHeatmap(), 500);
      }
    },
    (err) => {
      isFetchingLocation = false;
      console.warn('❌ Geolocation error:', err.message);
      let errorMsg = 'Location access denied';
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMsg = 'Location permission denied. Please enable location access in browser settings.';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMsg = 'Location information unavailable.';
          break;
        case err.TIMEOUT:
          errorMsg = 'Location request timed out.';
          break;
      }
      console.warn(errorMsg);

      // Try to use saved location
      const saved = localStorage.getItem('userLocation');
      if (saved) {
        try {
          userLocation = JSON.parse(saved);
          console.log('Using saved location:', userLocation);
          if (state.view === 'home') setTimeout(() => initHeatmap(), 500);
        } catch (e) {
          console.warn('Could not parse saved location');
        }
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,   // give a little more time
      maximumAge: 0
    }
  );

  // Start watching position for real-time updates if not already started
  if (locationWatchId === null) {
    locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        // Only update if moved > 10 meters
        if (!userLocation ||
            !userLocation.lat ||
            !userLocation.lng ||
            getDistance(userLocation.lat, userLocation.lng, newLocation.lat, newLocation.lng) > 10) {
          userLocation = newLocation;
          localStorage.setItem('userLocation', JSON.stringify(newLocation));
          console.log('📍 Location updated:', {
            lat: newLocation.lat.toFixed(6),
            lng: newLocation.lng.toFixed(6)
          });
          if (state.view === 'home') setTimeout(() => initHeatmap(), 500);
        }
      },
      (err) => {
        console.warn('Location watch error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000
      }
    );
  }
}

// Global helper used by the report screen (accepts optional UI elements to update)
async function getLiveLocation({ button = null, statusEl = null } = {}) {
  if (!navigator.geolocation) {
    if (button) {
      button.textContent = '📍 Get Current Location';
      button.disabled = false;
    }
    if (statusEl) {
      statusEl.textContent = 'Geolocation not supported';
      statusEl.style.color = '#ef4444';
    }
    throw new Error('Geolocation not supported');
  }

  if (isFetchingLocation) {
    if (statusEl) {
      statusEl.textContent = '⏳ Already fetching location...';
    }
    return userLocation || null;
  }

  isFetchingLocation = true;
  if (button) { button.textContent = '⏳ Fetching location...'; button.disabled = true; }
  if (statusEl) { statusEl.textContent = '📍 Requesting GPS access...'; statusEl.style.color = 'var(--accent)'; }

  const tryGet = (opts) => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });

  try {
    const pos = await tryGet({ enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
    const location = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: new Date().toISOString()
    };

    userLocation = location;
    localStorage.setItem('userLocation', JSON.stringify(location));

    const coords = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    if (button) { button.textContent = `✓ Location Captured`; button.disabled = false; }
    if (statusEl) { statusEl.textContent = `✅ GPS coordinates: ${coords} (Accuracy: ${Math.round(location.accuracy)}m)`; statusEl.style.color = '#22c55e'; }

    console.log('✅ GPS coordinates captured:', coords);
    if (state.view === 'home') setTimeout(() => initHeatmap(), 500);

    isFetchingLocation = false;
    return location;
  } catch (err) {
    // If high-accuracy timed out, attempt a low-accuracy fallback once
    console.warn('Geolocation primary error:', err);
    if (err && err.code === err.TIMEOUT) {
      try {
        const fallbackPos = await tryGet({ enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 });
        const location = {
          lat: fallbackPos.coords.latitude,
          lng: fallbackPos.coords.longitude,
          accuracy: fallbackPos.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        userLocation = location;
        localStorage.setItem('userLocation', JSON.stringify(location));

        const coords = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
        if (button) { button.textContent = `✓ Location Captured`; button.disabled = false; }
        if (statusEl) { statusEl.textContent = `✅ GPS coordinates (low acc): ${coords} (Accuracy: ${Math.round(location.accuracy)}m)`; statusEl.style.color = '#22c55e'; }

        console.log('✅ Fallback GPS coordinates captured:', coords);
        isFetchingLocation = false;
        if (state.view === 'home') setTimeout(() => initHeatmap(), 500);
        return location;
      } catch (fallbackErr) {
        console.warn('Fallback geolocation failed:', fallbackErr);
        // continue to final error handling
      }
    }

    // Final error handling
    if (button) {
      button.textContent = '📍 Get Current Location';
      button.disabled = false;
    }
    if (statusEl) {
      let statusMsg = '❌ Location access denied';
      if (err && err.code === err.PERMISSION_DENIED) statusMsg = '❌ Location permission denied. Please enable location access.';
      else if (err && err.code === err.POSITION_UNAVAILABLE) statusMsg = '❌ GPS unavailable. Please check device settings.';
      else if (err && err.code === err.TIMEOUT) statusMsg = '❌ Request timed out. Please try again.';
      statusEl.textContent = statusMsg;
      statusEl.style.color = '#ef4444';
    }

    isFetchingLocation = false;
    throw new Error('Could not get location: ' + (err && err.message ? err.message : 'unknown'));
  }
}

// Calculate distance between two coordinates (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Stop watching location (call when needed)
function stopLocationWatch() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    console.log('Location watching stopped');
  }
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

// Header
function renderHeader(title){
  const top = el('div','top');
  const left = el('div','brand');
  const brandContent = el('div');
  // add an id for the time element so updating it is reliable
  brandContent.innerHTML = '<span style="font-weight:600">'+ (title || 'DisasterAlert') +'</span><div id="current-time" style="font-size:11px;color:var(--muted);margin-top:2px">Current Time: ' + getCurrentISTDateTime() + ' IST</div>';
  left.appendChild(brandContent);
  const right = el('div','icons');
  const menu = el('div','icon-btn','☰'); 
  menu.onclick = ()=> alert('Menu — Demo only');
  
  // Only show settings icon if user is admin
  if (currentUser && currentUser.role === 'admin') {
    const gear = el('div','icon-btn','⚙'); 
    const token = localStorage.getItem('token');
    gear.onclick = ()=> window.location.href = `admin.html?token=${token}`;
    right.appendChild(gear);
  }
  
  // Logout button
  const logout = el('div','icon-btn','🚪');
  logout.onclick = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  };
  right.appendChild(logout);
  
  right.appendChild(menu);
  top.appendChild(left); 
  top.appendChild(right);
  return top;
}

// Bottom nav
function renderNav(active){
  const nav = el('div','nav');
  const names = ['home','history','alerts','profile'];
  const labels = ['Home','History','Alerts','Profile'];
  names.forEach((n,i)=>{
    const btn = el('button', (active===n? 'active':''), labels[i]);
    btn.onclick = ()=> {
      if(n==='profile') alert('Profile - demo');
      else { state.view = n; renderMain(); }
    };
    nav.appendChild(btn);
  });
  return nav;
}

// Screens
function renderHome(){
  const container = el('div','col');
  container.appendChild(renderHeader('DisasterAlert'));

  const hero = el('div','hero'); 
  hero.innerHTML = `<h2>Need Help?</h2><p>Report an emergency instantly to alert nearby responders.</p>`;
  const repBtn = el('button','btn-report','REPORT EMERGENCY'); 
  repBtn.onclick = ()=> { state.view='report'; renderMain(); };
  hero.appendChild(repBtn); 
  container.appendChild(hero);

  // Category filters
  const chips = el('div','chips');
  ['All','Flood','Fire','Accident','Electricity'].forEach(c=>{
    const chip = el('div','chip ' + (state.filter===c ? 'active' : ''), c);
    chip.onclick = ()=> { 
      state.filter = c;
      renderMain(); 
    };
    chips.appendChild(chip);
  });
  container.appendChild(chips);

  // Incident list
  const list = el('div','inc-list');
  const filtered = INCIDENTS.filter(i => state.filter==='All' ? true : i.category===state.filter);
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No incidents found</div>';
  } else {
    filtered.forEach(item=>{
      const card = el('div','inc-card');
      const icon = el('div','inc-icon', iconFor(item.category));
      const body = el('div','inc-body');
      body.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
                          <div class="inc-title">${item.title}</div>
                          <div class="status ${statusClass(item.status)}">${item.status}</div>
                        </div>
                        <div class="inc-meta">📍 ${getExactLocation(item)}</div>
                        <div class="inc-meta" style="margin-top:4px;color:var(--accent)">🕐 ${formatTime(item)}</div>
                        ${item.image_url ? `<img src="${item.image_url}" style="width:100%;margin-top:8px;border-radius:8px" alt="incident">` : ''}`;
      card.appendChild(icon); 
      card.appendChild(body); 
      list.appendChild(card);
    });
  }
  container.appendChild(list);

  // Heatmap preview
  const mini = el('div','admin-mini'); 
  mini.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Incident Heatmap</div>
                    <div id="heatmap-container" style="width:100%;height:200px;border-radius:8px;background:#f0f0f0"></div>`;
  container.appendChild(mini);
  
  // Initialize map after DOM is ready
  setTimeout(() => initHeatmap(), 100);

  container.appendChild(renderNav('home'));
  return container;
}

// Initialize heatmap
function initHeatmap() {
  const container = document.getElementById('heatmap-container');
  if (!container || !window.L) return;

  const incidentsWithCoords = INCIDENTS.filter(i => i.latitude && i.longitude);

  // Use user's current location as default, or fallback to a default location
  let defaultLat = 20.5937; // Default to India center
  let defaultLng = 78.9629;
  let defaultZoom = 5;

  if (userLocation && userLocation.lat && userLocation.lng) {
    defaultLat = userLocation.lat;
    defaultLng = userLocation.lng;
    defaultZoom = 13;
  } else {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const loc = JSON.parse(savedLocation);
        if (loc.lat && loc.lng) {
          defaultLat = loc.lat;
          defaultLng = loc.lng;
          defaultZoom = 13;
        }
      } catch (e) {
        console.warn('Could not parse saved location');
      }
    }
  }

  // If a previous map exists, remove it before creating a new one
  try {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  } catch (e) {
    console.warn('Error removing previous map instance', e);
  }

  // Initialize map and store in global mapInstance
  mapInstance = L.map(container).setView([defaultLat, defaultLng], defaultZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapInstance);

  // Add user location marker if available
  if (userLocation && userLocation.lat && userLocation.lng) {
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(mapInstance);
    userMarker.bindPopup('<b>Your Location</b>');
  }

  // Add markers for incidents with coordinates
  incidentsWithCoords.forEach(incident => {
    const marker = L.marker([incident.latitude, incident.longitude]).addTo(mapInstance);
    marker.bindPopup(`<b>${incident.title}</b><br>${incident.category}<br>${incident.status}`);
  });

  // Fit bounds to show both user location and incidents
  if (incidentsWithCoords.length > 0) {
    const bounds = [];

    if (userLocation && userLocation.lat && userLocation.lng) {
      bounds.push([userLocation.lat, userLocation.lng]);
    }

    incidentsWithCoords.forEach(i => {
      bounds.push([i.latitude, i.longitude]);
    });

    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [20, 20] });
    }
  } else if (userLocation && userLocation.lat && userLocation.lng) {
    mapInstance.setView([userLocation.lat, userLocation.lng], 13);
  }
}

function renderReport(){
  const container = el('div','col'); 
  container.appendChild(renderHeader('New Report'));
  const form = el('div','form');
  form.innerHTML = `
    <div class="field"><label>Emergency Category</label>
      <select id="cat">
        <option value="">Select Category</option>
        <option>Fire</option>
        <option>Flood</option>
        <option>Accident</option>
        <option>Electricity</option>
      </select>
    </div>
    <div class="field"><label>Incident Title</label>
      <input id="title" type="text" placeholder="e.g. Fire at Downtown Mall">
    </div>
    <div class="field"><label>Description</label>
      <textarea id="desc" placeholder="Describe the situation..."></textarea>
    </div>
    <div class="field"><label>Location</label>
      <input id="loc" type="text" placeholder="123 Pine Street, NY">
      <button type="button" id="get-loc" style="margin-top:6px;padding:6px 12px;background:var(--accent);color:white;border:0;border-radius:6px;cursor:pointer">📍 Use Current Location</button>
    </div>
    <div class="field upload" id="u">📷 Tap to open camera (REQUIRED)</div>
    <img id="preview" class="preview-img" style="display:none" alt="preview">
    <div id="imageError" style="color:#ef4444;font-size:12px;margin-top:4px;display:none">⚠️ Camera image is required</div>
    <button class="btn-submit" id="submit">SUBMIT REPORT</button>
  `;
  container.appendChild(form);

  // Enhanced real-time GPS location capture with UI feedback
  const getLocBtn = form.querySelector('#get-loc');
  const locationStatus = el('div', 'location-status');
  locationStatus.style.cssText = 'margin-top:8px;font-size:12px;min-height:20px;';
  getLocBtn.parentElement.appendChild(locationStatus);

  getLocBtn.onclick = async () => {
    try {
      await getLiveLocation({ button: getLocBtn, statusEl: locationStatus });
      // populate the input field after success
      if (userLocation) {
        form.querySelector('#loc').value = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
      }
    } catch (error) {
      console.error('Location fetch failed:', error.message);
      // UI already updated in getLiveLocation
    }
  };

  const uploadArea = form.querySelector('#u');
  uploadArea.onclick = () => cameraInput && cameraInput.click();

  let lastFile = null;
  if (cameraInput) {
    cameraInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      lastFile = file;
      const preview = form.querySelector('#preview');
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    };
  }

  form.querySelector('#submit').onclick = async () => {
    const title = form.querySelector('#title').value.trim();
    const cat = form.querySelector('#cat').value;
    const desc = form.querySelector('#desc').value;
    const loc = form.querySelector('#loc').value;
    const imageError = form.querySelector('#imageError');
    
    // Hide previous errors
    imageError.style.display = 'none';
    
    if (!title || !cat) {
      return alert('Please enter title and choose category');
    }

    // Check if camera image is provided (REQUIRED)
    if (!lastFile) {
      imageError.style.display = 'block';
      return alert('Camera image is required. Please take a photo using the camera.');
    }

    const formData = new FormData();
    formData.append('image', lastFile); // Image is required
    formData.append('title', title);
    formData.append('category', cat);
    formData.append('description', desc);
    formData.append('location', loc);
    if (userLocation) {
      formData.append('latitude', userLocation.lat);
      formData.append('longitude', userLocation.lng);
    }
    formData.append('user_id', currentUserId || currentUser?.id || 'anonymous');

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        // Show success message with location details
        let message = '✅ Report submitted successfully!\n\n';
        message += `📍 Location: ${data.full_address || data.place_name || loc}\n`;
        if (data.city) message += `🏙️ City: ${data.city}\n`;
        if (data.state) message += `🗺️ State: ${data.state}\n`;
        if (data.google_maps_link) {
          message += `\n🔗 View on map: ${data.google_maps_link}`;
        }
        
        alert(message);
        await fetchIncidents();
        state.view = 'home';
        renderMain();
      } else {
        // Show error message from server
        const errorMsg = data.message || data.error || 'Failed to submit report';
        alert(`❌ ${errorMsg}`);
        if (data.status === 'error' && data.message && data.message.includes('Camera image')) {
          imageError.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('❌ Error submitting report. Please check your connection and try again.');
    }
  };

  container.appendChild(renderNav(''));
  return container;
}

function renderHistory(){
  const container = el('div','col'); 
  container.appendChild(renderHeader('Your Reports'));
  const wrapper = el('div'); 
  wrapper.innerHTML = `<h3 class="small">This Month</h3>`;
  const timeline = el('div','timeline');
  
  const userIncidents = INCIDENTS.filter(i => i.user_id === currentUserId);
  if (userIncidents.length === 0) {
    timeline.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No reports yet</div>';
  } else {
    userIncidents.forEach(it=>{
      const t = el('div','timeline-item');
      t.innerHTML = `<div class="timeline-title">${it.title} 
                       <span style="margin-left:8px" class="status ${statusClass(it.status)}">${it.status}</span>
                     </div>
                     <div class="small">📍 ${getExactLocation(it)}</div>
                     <div class="small" style="margin-top:4px;color:var(--accent)">🕐 ${formatTime(it)}</div>`;
      timeline.appendChild(t);
    });
  }
  wrapper.appendChild(timeline);
  container.appendChild(wrapper);
  container.appendChild(renderNav('history'));
  return container;
}

async function renderAlerts(){
  const container = el('div','col'); 
  container.appendChild(renderHeader('Alerts'));
  const list = el('div'); 
  list.innerHTML = '<h4 class="small">Nearby Emergencies</h4><div class="space"></div>';
  
  const alerts = await fetchNearbyAlerts();
  if (alerts.length === 0) {
    list.innerHTML += '<div style="text-align:center;padding:20px;color:var(--muted)">No nearby emergencies</div>';
  } else {
    alerts.forEach(a=>{
      const card = el('div','alert-card'); 
      const stripe = el('div','alert-type'); 
      stripe.style.background = '#ffebe9'; 
      stripe.style.width='6px'; 
      stripe.style.borderRadius='6px';
      const body = el('div','inc-body'); 
      const distance = a.distance ? `${Math.round(a.distance)}m away` : '';
      body.innerHTML = `<div style="display:flex;justify-content:space-between">
                          <div style="font-weight:600">${iconFor(a.category)} ${a.title}</div>
                          <div class="small">${distance}</div>
                        </div>
                        <div class="small">📍 ${getExactLocation(a)}</div>
                        <div class="small" style="margin-top:4px;color:var(--accent)">🕐 ${formatTime(a)}</div>`;
      card.appendChild(stripe); 
      card.appendChild(body); 
      list.appendChild(card);
    });
  }
  container.appendChild(list); 
  container.appendChild(renderNav('alerts')); 
  return container;
}

// Format time - use reported_datetime if available, otherwise calculate IST from created_at
function formatTime(incidentOrDateString) {
  // Use the universal AM/PM formatting function
  if (typeof incidentOrDateString === 'object' && incidentOrDateString !== null) {
    // If reported_datetime is available, try to parse it
    if (incidentOrDateString.reported_datetime) {
      try {
        const date = new Date(incidentOrDateString.reported_datetime);
        if (!isNaN(date.getTime())) {
          return formatTimeWithAmPm(date);
        }
      } catch (e) {
        // Fall through to use created_at
      }
    }
    // Use created_at
    return formatTimeWithAmPm(incidentOrDateString);
  } else {
    // It's a date string
    return formatTimeWithAmPm(incidentOrDateString);
  }
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

// Router
function renderMain(){
  app.innerHTML = '';
  let node;
  switch(state.view){
    case 'home': node = renderHome(); break;
    case 'report': node = renderReport(); break;
    case 'history': node = renderHistory(); break;
    case 'alerts': node = renderAlerts(); break;
    default: node = renderHome();
  }
  app.appendChild(node);
}

// Initialize
(async () => {
  const authenticated = await checkAuth();
  if (authenticated) {
    getLocation();
    fetchIncidents();
    setInterval(fetchIncidents, 30000); // Refresh every 30 seconds
    
    // Update time display every second
    setInterval(() => {
      const timeElement = document.getElementById('current-time');
      if (timeElement) {
        timeElement.textContent = 'Current Time: ' + getCurrentISTDateTime() + ' IST';
      }
    }, 1000);
  }
})();
