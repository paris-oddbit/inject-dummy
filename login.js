// login.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');

// Create an https agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Disable SSL certificate validation
});

// Function to log in and get the session ID
async function loginAndGetSessionId() {
  const loginUrl = `${process.env.BASE_URL}${process.env.LOGIN_ENDPOINT}`;

  const loginData = {
    User: {
      login_id: `${process.env.LOGIN_ID}`,
      password: `${process.env.PASSWORD}`,
    },
  };

  try {
    const response = await axios.post(loginUrl, loginData, {
      headers: { 'Content-Type': 'application/json' },
      httpsAgent, // Attach the custom https agent to bypass SSL validation
    });
    const sessionId = response.headers['bs-session-id'];
    if (!sessionId) {
      throw new Error('bs-session-id not found in login response headers');
    }
    console.log('Login successful, session ID:', sessionId);
    return sessionId;
  } catch (error) {
    console.error('Error during login:', error.message);
    throw error;
  }
}

module.exports = { loginAndGetSessionId };
