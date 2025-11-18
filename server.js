const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SMS API endpoint
app.get('/api/sms', async (req, res) => {
    const { phone, sender, text } = req.query;

    // Validation
    if (!phone || !sender || !text) {
        return res.status(400).json({ 
            error: 'Missing required parameters: phone, sender, text' 
        });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ 
            error: 'Invalid phone number format' 
        });
    }

    // Validate message length
    if (text.length > 160) {
        return res.status(400).json({ 
            error: 'Message too long (max 160 characters)' 
        });
    }

    try {
        // Here you would integrate with your actual SMS provider
        // For now, we'll simulate a successful response
        
        // Example integration with Twilio (uncomment and configure if you have Twilio)
        /*
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = require('twilio')(accountSid, authToken);

        const message = await client.messages.create({
            body: text,
            from: sender,
            to: phone
        });
        */

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Log the request (in production, you might want to store this in a database)
        console.log('SMS Request:', {
            phone,
            sender,
            text,
            timestamp: new Date().toISOString()
        });

        // Simulate successful response
        res.json({
            success: true,
            message: 'SMS sent successfully',
            messageId: 'msg_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('SMS sending error:', error);
        res.status(500).json({ 
            error: 'Failed to send SMS: ' + error.message 
        });
    }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString() 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
});

module.exports = app;
