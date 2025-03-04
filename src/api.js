const ping = async (token) => {
  console.log('api ping start', {});
  const resp = await fetch(`/api/ping`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errData = await resp.json();
    console.log('api ping error', { errData });
    throw new Error(errData.error || 'Failed api ping');
  }
  const data = await resp.text();
  console.log('api ping done', { data });
  return data;
};

const speechToText = async (token, formData) => {
  console.log('api speechToText start', { formData: [...formData.entries()] });
  const resp = await fetch(`/api/speech-to-text`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  if (!resp.ok) {
    const errData = await resp.json();
    console.log('api speechToText error', { errData });
    throw new Error(errData.error || 'Failed api speechToText');
  }
  const data = await resp.json();
  console.log('api speechToText done', { data });
  return data;
};

const getHistory = async (token, day, timezone) => {
  console.log('api getHistory start', { day, timezone });
  const resp = await fetch(`/api/history?day=${encodeURIComponent(day)}&timezone=${encodeURIComponent(timezone)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errData = await resp.json();
    console.error('api getHistory error', { errData });
    throw new Error(errData.error || 'Failed api getHistory');
  }
  const data = await resp.json();
  console.log('api getHistory done', { data });
  return data;
};

const audioCache = new Map();

const fetchAudio = async (token, filename) => {
  console.log('api fetchAudio start', { filename });
  if (audioCache.has(filename)) {
    const audioURL = audioCache.get(filename);
    console.log('api fetchAudio cache hit', { audioURL });
    return audioURL;
  }
  const resp = await fetch(`/api/audio/${filename}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    console.error('api fetchAudio error');
    throw new Error('Failed to fetch audio');
  }
  const blob = await resp.blob();
  const audioURL = URL.createObjectURL(blob);
  console.log('api fetchAudio done', { audioURL });
  audioCache.set(filename, audioURL);
  return audioURL;
};

export default {
  ping,
  speechToText,
  getHistory,
  fetchAudio,
};
