(() => {
  const key = 'ajf_criteria';
  if (localStorage.getItem(key)) return;
  const defaults = {
    minSalary: '80000',
    location: 'NYC / Long Island / Remote',
    tracks: ['A','B','C']
  };
  localStorage.setItem(key, JSON.stringify(defaults));
  if (typeof criteria !== 'undefined') criteria = defaults;
  if (typeof applyCriteriaToUI === 'function') applyCriteriaToUI();
  if (typeof renderAll === 'function') renderAll();
})();
