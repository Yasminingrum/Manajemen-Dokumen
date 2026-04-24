require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const userRoutes = require('./routes/users');
const delegationRoutes = require('./routes/delegation');
const { users, addLog } = require('./data/store');
const { generateToken } = require('./utils/jwt');

const app = express();

app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================================
// PASSPORT — Google OAuth 2.0 Strategy (REAL)
// ============================================================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/oauth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const name = profile.displayName;

  let user = users.find(u => u.email === email.toLowerCase());

  if (!user) {
    user = {
      id: `oauth_${uuidv4().slice(0, 8)}`,
      username: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: null,
      role: 'VIEWER',
      department: 'General',
      clearanceLevel: 'PUBLIC',
      isActive: true,
      authProvider: 'google',
      googleId: profile.id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    users.push(user);
    addLog(user.id, user.username, 'OAUTH_REGISTER', 'AUTH', 'ALLOWED', 'New user registered via Google OAuth 2.0');
  }

  addLog(user.id, user.username, 'OAUTH_LOGIN', 'AUTH', 'ALLOWED', 'Google OAuth 2.0 login successful');
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user || false);
});

// ============================================================
// GOOGLE OAUTH ROUTES
// ============================================================
app.get('/api/auth/oauth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

app.get('/api/auth/oauth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?oauth=failed' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/?token=${token}&oauth=success`);
  }
);

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/delegation', delegationRoutes);

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('\n📋 Test Accounts:');
  console.log('   admin@company.com        / admin123    (ADMIN,   IT,      TOP_SECRET)');
  console.log('   manager@company.com      / manager123  (MANAGER, Finance, SECRET)');
  console.log('   manager.it@company.com   / managerit123(MANAGER, IT,      SECRET)');
  console.log('   staff@company.com        / staff123    (STAFF,   HR,      CONFIDENTIAL)');
  console.log('   staff.it@company.com     / staffit123  (STAFF,   IT,      CONFIDENTIAL)');
  console.log('   viewer@company.com       / viewer123   (VIEWER,  General, PUBLIC)');
  console.log('\n🔐 Google OAuth:');
  console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ SET' : '✗ TIDAK ADA — cek .env'}`);
  console.log(`   Callback : http://localhost:${PORT}/api/auth/oauth/google/callback\n`);
});
