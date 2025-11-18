const express = require('express');
const path = require('path');
const twilio = require('twilio');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting - Anti-spam protection
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 SMS requests per windowMs
  message: {
    error: 'Too many SMS requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to SMS API
app.use('/api/sms', smsLimiter);

// Store cooldown timers (in production, use Redis instead)
const cooldown = new Map();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Philippine phone number validation function
function isValidPhilippinePhone(phone) {
  const cleanPhone = phone.replace(/[\s\-]/g, '');
  const phRegex = /^(\+639|09)\d{9}$/;
  return phRegex.test(cleanPhone);
}

// SMS API endpoint with real Twilio integration
app.get('/api/sms', async (req, res) => {
  let { phone, sender, text } = req.query;

  // Validation
  if (!phone || !sender || !text) {
    return res.status(400).json({ 
      error: 'Missing required parameters: phone, sender, text' 
    });
  }

  // Validate Philippine phone number
  if (!isValidPhilippinePhone(phone)) {
    return res.status(400).json({ 
      error: 'Invalid Philippine phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX' 
    });
  }

  // Ensure phone is in +63 format for API
  phone = phone.replace(/^09/, '+639');

  // Validate message length
  if (text.length > 160) {
    return res.status(400).json({ 
      error: 'Message too long (max 160 characters)' 
    });
  }

  // Validate sender name length
  if (sender.length > 11) {
    return res.status(400).json({ 
      error: 'Sender name too long (max 11 characters)' 
    });
  }

  // Check cooldown for this phone number
  const now = Date.now();
  const lastSent = cooldown.get(phone);
  if (lastSent && (now - lastSent) < 10000) { // 10 second cooldown
    const remainingTime = Math.ceil((10000 - (now - lastSent)) / 1000);
    return res.status(429).json({ 
      error: `Please wait ${remainingTime} seconds before sending another message to this number` 
    });
  }

  try {
    // Set cooldown for this phone number
    cooldown.set(phone, now);

    // Send real SMS using Twilio
    const message = await twilioClient.messages.create({
      body: text,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: phone
    });

    // Log the successful request
    console.log('SMS Sent Successfully:', {
      phone,
      sender,
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      messageId: message.sid,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'SMS sent successfully!',
      messageId: message.sid,
      recipient: phone,
      sender: sender,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Twilio SMS sending error:', error);
    
    // Remove cooldown on error
    cooldown.delete(phone);
    
    let errorMessage = 'Failed to send SMS';
    
    // Specific error handling for Twilio
    if (error.code === 21211) {
      errorMessage = 'Invalid phone number format';
    } else if (error.code === 21408) {
      errorMessage = 'SMS is not available for this number/region';
    } else if (error.code === 21610) {
      errorMessage = 'Phone number is blacklisted';
    } else if (error.code === 21614) {
      errorMessage = 'Phone number is not SMS capable';
    } else if (error.message.includes('Authentication Error')) {
      errorMessage = 'SMS service configuration error';
    }
    
    res.status(500).json({ 
      error: errorMessage 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    country: 'Philippines',
    timestamp: new Date().toISOString(),
    smsService: 'Twilio'
  });
});

// Clean up cooldown map periodically (remove entries older than 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [phone, timestamp] of cooldown.entries()) {
    if (now - timestamp > 3600000) { // 1 hour
      cooldown.delete(phone);
    }
  }
}, 600000); // Run every 10 minutes

// Start server
app.listen(PORT, () => {
  console.log(`🇵🇭 Philippine SMS Sender running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
  console.log('SMS Provider: Twilio');
});

module.exports = app;
