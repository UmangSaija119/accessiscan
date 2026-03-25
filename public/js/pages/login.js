// ===================================================
// AccessiScan — Login/Register Page
// ===================================================

function renderLoginPage() {
    const container = document.getElementById('auth-form-container');
    container.innerHTML = `
    <form id="login-form">
      <div class="form-group">
        <label for="login-email">Email</label>
        <div class="form-input-icon">
          <i class="fas fa-envelope"></i>
          <input type="email" id="login-email" class="form-input" placeholder="you@example.com" required autocomplete="email">
        </div>
      </div>
      <div class="form-group">
        <label for="login-password">Password</label>
        <div class="form-input-icon">
          <i class="fas fa-lock"></i>
          <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
        </div>
      </div>
      <button type="submit" id="login-submit" class="btn btn-primary btn-full btn-lg">
        <span>Sign In</span>
      </button>
      <div class="auth-toggle">
        Don't have an account? <a href="#" id="show-register">Sign Up</a>
      </div>
    </form>
  `;

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        renderRegisterPage();
    });
}

function renderRegisterPage() {
    const container = document.getElementById('auth-form-container');
    container.innerHTML = `
    <form id="register-form">
      <div class="form-group">
        <label for="reg-name">Full Name</label>
        <div class="form-input-icon">
          <i class="fas fa-user"></i>
          <input type="text" id="reg-name" class="form-input" placeholder="John Doe" autocomplete="name">
        </div>
      </div>
      <div class="form-group">
        <label for="reg-email">Email</label>
        <div class="form-input-icon">
          <i class="fas fa-envelope"></i>
          <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" required autocomplete="email">
        </div>
      </div>
      <div class="form-group">
        <label for="reg-password">Password</label>
        <div class="form-input-icon">
          <i class="fas fa-lock"></i>
          <input type="password" id="reg-password" class="form-input" placeholder="Min 8 characters" required autocomplete="new-password" minlength="8">
        </div>
      </div>
      <div class="form-group">
        <label for="reg-confirm">Confirm Password</label>
        <div class="form-input-icon">
          <i class="fas fa-lock"></i>
          <input type="password" id="reg-confirm" class="form-input" placeholder="Repeat password" required autocomplete="new-password">
        </div>
      </div>
      <button type="submit" id="register-submit" class="btn btn-primary btn-full btn-lg">
        <span>Create Account</span>
      </button>
      <div class="auth-toggle">
        Already have an account? <a href="#" id="show-login">Sign In</a>
      </div>
    </form>
  `;

    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        renderLoginPage();
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Signing in...';

    try {
        await API.login(email, password);
        showToast('Welcome back!', 'success');
        initApp();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Creating account...';

    try {
        await API.register(email, password, name);
        showToast('Account created! Welcome to AccessiScan.', 'success');
        initApp();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span>';
    }
}
