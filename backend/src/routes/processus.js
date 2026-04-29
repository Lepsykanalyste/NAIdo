const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
router.get('/', auth, async (req, res) => { res.json([]); });
module.exports = router;
