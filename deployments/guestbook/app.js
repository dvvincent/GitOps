const express = require('express');
const mysql = require('mysql');
const redis = require('redis');

// Environment variables
const mariadbHost = process.env.MARIADB_HOST || '192.168.1.64';
const mariadbPort = process.env.MARIADB_PORT || '3306';
const mariadbUser = process.env.MARIADB_USER || 'your-username';
const mariadbPassword = process.env.MARIADB_PASSWORD || 'your-password';
const redisHost = process.env.REDIS_HOST || '192.168.1.66';
const redisPort = process.env.REDIS_PORT || '6379';

const app = express();
app.use(express.json());

// MariaDB connection
const db = mysql.createConnection({
  host: mariadbHost,
  port: mariadbPort,
  user: mariadbUser,
  password: mariadbPassword,
  database: 'guestbook'
});

// Connect to MariaDB and handle errors
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MariaDB:', err);
    process.exit(1);
  } else {
    console.log('Connected to MariaDB');
  }
});

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: redisHost,
    port: redisPort
  }
});

// Connect to Redis and handle errors
redisClient.connect().catch((err) => {
  console.error('Redis client error:', err);
});

// Root route to handle requests to the root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Guestbook! Use /entry to add an entry and /entries to view all entries.');
});

// Endpoint to add a guestbook entry
app.post('/entry', async (req, res) => {
  const { name, message } = req.body;
  const query = 'INSERT INTO entries (name, message) VALUES (?, ?)';
  db.query(query, [name, message], (err, result) => {
    if (err) {
      console.error('Error saving entry:', err);
      res.status(500).send('Error saving entry');
      return;
    }
    redisClient.del('guestbook_entries'); // Invalidate cache
    res.status(201).send('Entry saved');
  });
});

// Endpoint to get all guestbook entries
app.get('/entries', async (req, res) => {
  try {
    const cachedEntries = await redisClient.get('guestbook_entries');
    if (cachedEntries) {
      res.json(JSON.parse(cachedEntries));
      return;
    }

    db.query('SELECT * FROM entries', (err, results) => {
      if (err) {
        console.error('Error retrieving entries:', err);
        res.status(500).send('Error retrieving entries');
        return;
      }
      redisClient.set('guestbook_entries', JSON.stringify(results), { EX: 60 }); // Cache for 60 seconds
      res.json(results);
    });
  } catch (err) {
    console.error('Error accessing Redis:', err);
    res.status(500).send('Error accessing Redis');
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Guestbook app listening on port ${PORT}`);
});
