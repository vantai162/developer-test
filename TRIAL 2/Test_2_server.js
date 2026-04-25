// ============================================================
// Launchmen Task API
// Developer Candidate Test — Trial 2
// ============================================================
// Instructions:
//   Run with: npm install && node server.js
//   Server starts on: http://localhost:3000
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Serve a predictable CSP instead of relying on tool-injected defaults.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:3000 ws://localhost:3000"
  );
  next();
});

app.use(express.json());

const DB_FILE = path.join(__dirname, 'Test_2_tasks.json');
const UI_FILE = path.join(__dirname, 'Test2_Task_UI.html');

function loadTasks() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveTasks(tasks) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
}

// GET /
// Health/info endpoint so localhost:3000 does not return 404.
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Launchmen Task API',
    endpoints: ['GET /tasks', 'POST /tasks', 'PATCH /tasks/:id', 'DELETE /tasks/:id'],
  });
});

// GET /.well-known/appspecific/com.chrome.devtools.json
// Return an empty payload for browser devtools probes.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// GET /ui
// Serves a minimal frontend that consumes this API.
app.get('/ui', (req, res) => {
  res.sendFile(UI_FILE);
});

// GET /tasks
// Returns all tasks. Supports optional status filter.
app.get('/tasks', (req, res) => {
  const tasks = loadTasks();
  const { status } = req.query;

  // Decision: if a status filter is provided but blank (or duplicated as an array), treat it as invalid input.
  // This avoids silently returning confusing results when clients send malformed query strings.
  if (status !== undefined) {
    if (Array.isArray(status)) {
      return res.status(400).json({ success: false, message: 'status must be provided once' });
    }

    const normalizedStatus = status.trim().toLowerCase();
    if (!normalizedStatus) {
      return res.status(400).json({ success: false, message: 'status cannot be empty' });
    }

    const filtered = tasks.filter(
      t => typeof t.status === 'string' && t.status.toLowerCase() === normalizedStatus
    );
    return res.json({ success: true, tasks: filtered });
  }

  res.json({ success: true, tasks });
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title, status } = req.body;

  // title is required; empty strings are treated as missing input.
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }

  // If status is omitted, default to pending.
  const taskStatus = status === undefined ? 'pending' : status;

  const tasks = loadTasks();
  const newTask = {
    id: Date.now(),
    title: title.trim(),
    status: taskStatus,
  };
  tasks.push(newTask);
  saveTasks(tasks);
  res.status(201).json({ success: true, task: newTask });
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const taskId = parseInt(req.params.id, 10);
  const { status } = req.body;
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  task.status = status;
  saveTasks(tasks);
  res.json({ success: true, task });
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const taskId = parseInt(req.params.id, 10);
  const index = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  tasks.splice(index, 1);
  saveTasks(tasks);
  res.json({ success: true, message: 'Task deleted' });
});

app.listen(3000, () => {
  console.log('Launchmen Task API running on http://localhost:3000');
});


/*
SQL Code — N+1 Query Problem
1. The issue
The loop runs 1 query to get 50 posts, then 50 more queries — one per post — to fetch each author. 
That's 51 round-trips to the database, which is the classic N+1 problem. It gets slower as volume grows, and it's also a SQL injection risk since ${post.author_id} is interpolated directly into the query string.
2. The fix — use a JOIN
sqlSELECT
  p.id, p.title, p.created_at,
  a.id   AS author_id,
  a.name AS author_name,
  a.email AS author_email
FROM posts p
JOIN authors a ON a.id = p.author_id
ORDER BY p.created_at DESC
LIMIT 50;
This is 1 query total instead of 51. */