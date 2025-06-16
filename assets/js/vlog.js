fetch('vlog.json')
  .then(response => response.json())
  .then(data => {
    const container = document.getElementById('vlog-list');
    container.innerHTML = ''; // Clear loading text

    data.slice(0, 5).forEach(entry => {
      const item = document.createElement('div');
      item.classList.add('vlog-entry');
      item.innerHTML = `
        <p><strong>${entry.date} – ${entry.title}</strong><br>${entry.message}</p>
        <hr>
      `;
      container.appendChild(item);
    });
  })
  .catch(error => {
    document.getElementById('vlog-list').textContent = "Erreur de chargement des mises à jour.";
    console.error("Erreur lors du chargement du vlog:", error);
  });
