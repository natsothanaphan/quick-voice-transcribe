require('dotenv').config({ path: ['.env', '.env.default'] });
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onRequest } = require('firebase-functions/v2/https');
const { ElevenLabsClient } = require('elevenlabs');
const fs = require('fs');
const { randomUUID } = require('crypto');
const logger = require('firebase-functions/logger');
const express = require('express');
const Busboy = require('busboy');

setGlobalOptions({ region: 'asia-southeast1' });
initializeApp();
const db = getFirestore();
const storage = getStorage();

const app = express();
app.use(express.json());

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
app.use(authenticate);

app.get('/api/ping', (req, res) => {
  res.send('pong');
});

const busboyMiddleware = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
  let fileProcessed = false;
  bb.on('file', (fieldname, file, info) => {
    fileProcessed = true;
    const { filename: originalName, encoding, mimeType } = info;
    const storedFilename = randomUUID() + '.wav';
    const filePath = '/tmp/' + storedFilename;
    req.file = {
      fieldname, originalName, encoding, mimeType,
      filename: storedFilename, filePath,
    };
    console.log('req.file', req.file);
    const writeStream = fs.createWriteStream(filePath);
    file.pipe(writeStream);
    writeStream.on('error', (err) => next(err));
  });
  bb.on('error', (err) => next(err));
  bb.on('finish', () => {
    if (!fileProcessed) return res.status(400).json({ error: 'No file processed' });
    next();
  });
  bb.end(req.rawBody);
};
app.use(busboyMiddleware);

const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const uploadToStorageAndFirestore = async (uid, filename, filePath) => {
  const storagePath = `${uid}/audio/${filename}`;
  const bucket = storage.bucket();
  await bucket.upload(filePath, {
    destination: storagePath,
  });
  logger.info(`File uploaded to Firebase Storage at ${storagePath}`);
  const requestDoc = { 
    filename: storagePath, 
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
  const docRef = await db
    .collection('users').doc(uid)
    .collection('requests').add(requestDoc);
  logger.info(`Firestore document created for request: ${docRef.id}`);
  return docRef.id;
};

const updateFirestore = async (uid, docId, result) => {
  const docRef = db
    .collection('users').doc(uid)
    .collection('requests').doc(docId);
  await docRef.update({
    result,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info(`Firestore document updated for request: ${docId}`);
};

app.post('/api/speech-to-text', busboyMiddleware, async (req, res) => {
  let filePath;
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = file.filename;
    filePath = file.filePath;
    const backgroundUploadTask = uploadToStorageAndFirestore(req.uid, filename, filePath);
    const result = await elevenLabsClient.speechToText.convert({
      file: fs.createReadStream(filePath),
      model_id: 'scribe_v1',
    });
    logger.info('ElevenLabs response received', result);
    const docId = await backgroundUploadTask;
    await updateFirestore(req.uid, docId, result);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in speech-to-text:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (!filePath) return;
    try {
      await fs.promises.unlink(filePath);
      logger.info(`Temporary file ${filePath} removed`);
    } catch (error) {
      logger.warn(`Failed to remove temporary file ${filePath}: ${error.message}`);
    }
  }
});

const docToData = (doc) => {
  const data = doc.data();
  return { id: doc.id, ...data,
    createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() };
};

app.get('/api/history', async (req, res) => {
  try {
    const { day, timezone } = req.query;
    if (!day) return res.status(400).json({ error: 'Query parameter `day` is required in yyyy-mm-dd format' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Invalid day format. Use yyyy-mm-dd.' });
    const targetDate = new Date(day);
    if (isNaN(targetDate)) return res.status(400).json({ error: 'Invalid day format. Use yyyy-mm-dd.' });
    if (!timezone) return res.status(400).json({ error: 'Query parameter `timezone` is required' });
    const timezoneOffset = parseInt(timezone, 10);
    if (isNaN(timezoneOffset)) return res.status(400).json({ error: 'Invalid timezone format. Use integer representing UTC offset in minutes.' });
    const startTime = new Date(targetDate);
    startTime.setMinutes(startTime.getMinutes() - timezoneOffset);
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + 1);
    logger.info(`startTime: ${startTime.toISOString()}, endTime: ${endTime.toISOString()}`);
    
    const requestsRef = db.collection('users').doc(req.uid).collection('requests'); 
    const snapshot = await requestsRef.orderBy('createdAt', 'desc')
      .where('createdAt', '>=', startTime).where('createdAt', '<', endTime).get();
    const data = snapshot.docs.map(docToData);
    res.status(200).json(data);
  } catch (error) {
    logger.error('Error in /api/history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audio/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const storagePath = `${req.uid}/audio/${filename}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    file.createReadStream().on('error', (error) => {
      logger.error(`Error reading file ${storagePath}:`, error);
      res.status(500).send(error.message);
    }).pipe(res);
  } catch (error) {
    logger.error('Error in /api/audio/:filename:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.app = onRequest(app);
