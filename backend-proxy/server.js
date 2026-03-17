require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4005;

// Enable CORS so the React frontend can call this proxy
app.use(cors());
app.use(express.json());

// The exact Cartrack API endpoint. 
// Note: Some modern Cartrack Bearer endpoints are on 'https://live.cartrack.com/rest' or specific paths.
// Update this if you have the exact API documentation URL.
const CARTRACK_API_URL = process.env.CARTRACK_API_URL || 'https://fleetapi-pt.cartrack.com/rest';

app.get('/api/vehicles', async (req, res) => {
    try {
        const token = process.env.CARTRACK_BEARER_TOKEN;
        
        if (!token) {
            return res.status(500).json({ error: 'Cartrack Bearer Token is not configured in the proxy.' });
        }

        console.log(`[Proxy] Fetching vehicles from ${CARTRACK_API_URL}...`);
        
        // Example: some Cartrack APIs use '/vehicles', others use '/fleet/vehicles', depending on the API variant.
        const response = await axios.get(`${CARTRACK_API_URL}/vehicles`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Forward the exact response to the frontend
        res.json(response.data);
    } catch (error) {
        console.error('[Proxy] Error fetching from Cartrack:', error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Failed to communicate with Cartrack API' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`✅ Cartrack Proxy Server is running on http://localhost:${PORT}`);
    console.log(`🔑 Using Bearer Token: ${process.env.CARTRACK_BEARER_TOKEN ? 'YES (Configured)' : 'NO (Missing!)'}`);
});
