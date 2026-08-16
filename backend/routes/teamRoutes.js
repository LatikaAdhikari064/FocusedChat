const express = require('express');
const router = express.Router();
const { createTeam, joinTeam } = require('../controllers/teamController');

router.post('/create', createTeam);
router.post('/join', joinTeam);

module.exports = router;