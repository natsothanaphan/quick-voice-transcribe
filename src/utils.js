const alertAndLogErr = (err) => {
  console.error(err);
  alert(err.message || 'An error occurred');
};

const formatDay = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimestamp = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getTimezone = () => -new Date().getTimezoneOffset();

export {
  alertAndLogErr,
  formatDay,
  formatTimestamp,
  getTimezone,
};
