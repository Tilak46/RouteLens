// This is a test fixture to verify the API Explorer Scanner
// It simulates a backend API structure

const express = require('express');
const app = express();
const router = express.Router();

// Travel Agent API
app.get('/api/v1/travel-agent/e-visa/public/countries', (req, res) => {
    res.json({ countries: ['India', 'USA', 'UK'] });
});

app.get('/api/v1/travel-agent/e-visa/public/list', (req, res) => {
    res.json({ visas: [] });
});

app.post('/api/v1/travel-agent/e-visa/apply', (req, res) => {
    res.status(201).send('Applied');
});

// Hotels API using Router
router.post('/api/v1/hotels/search', (req, res) => {
    res.json({ hotels: [] });
});

router.get('/api/v1/hotels/:id', (req, res) => {
    res.json({ id: req.params.id });
});

// Auth
app.post('/api/v1/auth/login', (req, res) => {
    res.send('Logged in');
});
