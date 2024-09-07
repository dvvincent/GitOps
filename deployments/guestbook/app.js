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

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: redisHost,
    port: redisPort
  }
});

redisClient.connect().catch(console.error);

// Endpoint to add a guestbook entry
app.post('/entry', async (req, res) => {
  const { name, message } = req.body;
  const query = 'INSERT INTO entries (name, message) VALUES (?, ?)';
  db.query(query, [name, message], (err, result) => {
    if (err) {
      res.status(500).send('Error saving entry');
      return;
    }
    redisClient.del('guestbook_entries'); // Invalidate cache
    res.status(201).send('Entry saved');
  });
});

// Endpoint to get all guestbook entries
app.get('/entries', async (req, res) => {
  const cachedEntries = await redisClient.get('guestbook_entries');
  if (cachedEntries) {
    res.json(JSON.parse(cachedEntries));
    return;
  }

  db.query('SELECT * FROM entries', (err, results) => {
    if (err) {
      res.status(500).send('Error retrieving entries');
      return;
    }
    redisClient.set('guestbook_entries', JSON.stringify(results), { EX: 60 }); // Cache for 60 seconds
    res.json(results);
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Guestbook app listening on port ${PORT}`);
});
