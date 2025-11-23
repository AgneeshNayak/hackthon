// login.js - Login and Signup functionality

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const userLoginForm = document.getElementById('userLoginForm');
  const userSignupForm = document.getElementById('userSignupForm');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const userSignupLink = document.getElementById('userSignupLink');
  const userLoginLink = document.getElementById('userLoginLink');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');

  // Check for error message in URL
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  if (error) {
    showError(error);
    // Switch to admin tab if it's an admin error
    if (error.includes('admin') || error.includes('Admin')) {
      document.querySelector('[data-tab="admin"]').click();
    }
  }

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      // Update active tab
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide forms
      if (tab === 'user') {
        userLoginForm.style.display = 'block';
        userLoginForm.classList.add('active');
        userSignupForm.style.display = 'none';
        adminLoginForm.style.display = 'none';
      } else {
        userLoginForm.style.display = 'none';
        userLoginForm.classList.remove('active');
        userSignupForm.style.display = 'none';
        adminLoginForm.style.display = 'block';
        adminLoginForm.classList.add('active');
      }
      
      hideMessages();
    });
  });

  // Toggle between login and signup
  userSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    userLoginForm.style.display = 'none';
    userSignupForm.style.display = 'block';
    userSignupForm.classList.add('active');
    hideMessages();
  });

  userLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    userSignupForm.style.display = 'none';
    userLoginForm.style.display = 'block';
    userLoginForm.classList.add('active');
    hideMessages();
  });

  // User Login
  userLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;

    if (!username || !password) {
      showError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'user' })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response:', e);
        showError('Server error. Please try again.');
        return;
      }

      if (response.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('Login successful, redirecting...');
        window.location.href = 'user.html';
      } else {
        const errorMsg = data.error || data.message || 'Login failed. Please check your credentials.';
        console.error('Login failed:', errorMsg);
        showError(errorMsg);
      }
    } catch (err) {
      console.error('Login error:', err);
      showError('Network error. Please check if the server is running.');
    }
  });

  // User Signup
  userSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!username || !password || !confirmPassword) {
      showError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'user' })
      });

      const data = await response.json();

      if (response.ok) {
        // Auto-login after signup
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showSuccess('Account created! Redirecting...');
        setTimeout(() => {
          window.location.href = 'user.html';
        }, 1000);
      } else {
        showError(data.error || 'Signup failed');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    }
  });

  // Admin Login
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const securityKey = document.getElementById('adminSecurityKey').value;

    if (!username || !password || !securityKey) {
      showError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityKey })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response:', e);
        showError('Server error. Please try again.');
        return;
      }

      if (response.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('Admin login successful, redirecting...');
        // Add token to URL for admin page
        window.location.href = `admin.html?token=${data.token}`;
      } else {
        const errorMsg = data.error || data.message || 'Admin login failed. Please check your credentials and security key.';
        console.error('Admin login failed:', errorMsg);
        showError(errorMsg);
      }
    } catch (err) {
      console.error('Admin login error:', err);
      showError('Network error. Please check if the server is running.');
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
  }

  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
  }

  function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
  }
});

