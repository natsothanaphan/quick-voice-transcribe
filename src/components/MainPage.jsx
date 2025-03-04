import React, { useState, useRef, useEffect } from 'react';
import './MainPage.css';
import api from '../api.js';
import { alertAndLogErr } from '../utils.js';

const MainPage = ({ user, onGoToHistory }) => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        audioChunksRef.current = [];
        setAudioBlob(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setAudioBlob(null);
      setLoading(false);
      setResult(null);
    } catch (err) {
      alertAndLogErr(err);
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!(mediaRecorder && mediaRecorder.state !== 'inactive')) return;
    mediaRecorder.stop();
    setRecording(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audioBlob) {
      alertAndLogErr(new Error('No recording to submit'));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      const idToken = await user.getIdToken();
      const data = await api.speechToText(idToken, formData);
      setResult(data);
    } catch (err) {
      alertAndLogErr(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = async () => {
    const text = result?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied text:', text);
      alert('Copied text to clipboard');
    } catch (err) {
      alertAndLogErr(err);
    }
  };

  const handleReset = () => {
    setRecording(false);
    setAudioBlob(null);
    setLoading(false);
    setResult(null);
  };

  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  return <>
    <form className='submit-form' onSubmit={handleSubmit}>
      {!recording && <button type='button' onClick={startRecording} disabled={loading} title='Record'>🎤</button>}
      {recording && <button type='button' onClick={stopRecording} disabled={loading} title='Stop'>⏹️</button>}
      {' '}<button type='submit' disabled={loading || !audioBlob} title='Submit'>{loading ? 'Loading...' : '🚀'}</button>
    </form>
    {audioBlob && <div className='audio-player'>
      <audio controls src={audioUrl}>Audio not supported</audio>
    </div>}
    {!loading && result && <div className='result-container' onClick={handleCopyResult}>
      <pre>{result.text}</pre>
    </div>}
    <button onClick={handleReset} className='reset-button' disabled={loading} title='Clear'>❌</button>
    <button onClick={onGoToHistory} className='history-button'>History</button>
  </>;
};

export default MainPage;
