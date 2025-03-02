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

export default {
  ping,
  speechToText,
};
