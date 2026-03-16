const Student = require('../models/studentModel');

// POST /api/students
async function registerStudent(req, res) {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/students
async function getAllStudents(req, res) {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/students/:studentId
async function getStudent(req, res) {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { registerStudent, getAllStudents, getStudent };
