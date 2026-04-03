const express = require('express');
const router = express.Router();
const {
  createSession, getSession, findByCode, getResults, getMySessions,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

// Public — participant join lookup
router.get('/join/:code', findByCode);

// Protected — presenter routes
router.use(protect);
router.get('/', getMySessions);
router.post('/', createSession);
router.get('/:id', getSession);
router.get('/:id/results', getResults);

module.exports = router;
