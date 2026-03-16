const express = require('express');
const router = express.Router();
const { registerStudent, getAllStudents, getStudent } = require('../controllers/studentController');

router.post('/', registerStudent);
router.get('/', getAllStudents);
router.get('/:studentId', getStudent);

module.exports = router;
