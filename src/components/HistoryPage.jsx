import React, { useState, useEffect } from 'react';
import './HistoryPage.css';
import api from '../api.js';
import { alertAndLogErr, formatDay, formatTimestamp, getTimezone } from '../utils.js';

const HistoryPage = ({ user, onBack }) => {
  const [selectedDay, setSelectedDay] = useState(formatDay(new Date()));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [audios, setAudios] = useState({});

  const timezone = getTimezone();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const history = await api.getHistory(token, selectedDay, timezone);
      setHistory(history);
      setExpanded({});
    } catch (err) {
      alertAndLogErr(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (entry) => {
    const id = entry.id;
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    if (expanded[id]) return;
    if (audios[id]) return;
    try {
      const token = await user.getIdToken();
      const filename = entry.filename.split('/').pop();
      const audioURL = await api.fetchAudio(token, filename);
      setAudios((prev) => ({
        ...prev,
        [id]: audioURL,
      }));
    } catch (err) {
      alertAndLogErr(err);
    }
  };

  const handleCopyResult = async (entry) => {
    const text = entry.result?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied text:', text);
      alert('Copied text to clipboard');
    } catch (err) {
      alertAndLogErr(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedDay]);

  return <>
    <button onClick={onBack} className='back-button'>Back</button>
    <div className='history-list'>
      <input type='date' value={selectedDay}
        onChange={(e) => setSelectedDay(e.target.value)} />
      {loading && <p>Loading...</p>}
      {!loading && history.length === 0 && <p>No history</p>}
      {!loading && history.length > 0 && <ul>{history.map((entry) => <li key={entry.id}>
        <a href='#' onClick={() => toggleExpand(entry)}>
          <span>{expanded[entry.id] ? '📖' : '📕'}</span>{' '}
          <span>{formatTimestamp(entry.createdAt)}</span>
        </a>
        {expanded[entry.id] && <div className='history-entry'>
          {!audios[entry.id] && <p>Loading...</p>}
          {audios[entry.id] && <audio controls src={audios[entry.id]}>Audio not supported</audio>}
          {!entry.result && <p>No result</p>}
          {entry.result && <div className='result-container' onClick={() => handleCopyResult(entry)}>
            <pre>{entry.result.text}</pre>
          </div>}
        </div>}
      </li>)}</ul>}
      {!loading && <button onClick={fetchHistory}>Reload</button>}
    </div>
  </>;
};

export default HistoryPage;
