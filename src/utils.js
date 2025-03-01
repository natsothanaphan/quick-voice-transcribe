const alertAndLogErr = (err) => {
  console.error(err);
  alert(err.message || 'An error occurred');
};

export {
  alertAndLogErr,
};
