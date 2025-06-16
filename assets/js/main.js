// Charger le dernier message du vlog
fetch('vlog.json')
  .then(response => response.json())
  .then(data => {
    const container = document.getElementById('vlog-container');
    if (data.length > 0) {
      const last = data[0];
      container.innerHTML = `
        <strong>${last.date}</strong><br>
        <em>${last.titre}</em><br>
        <p>${last.message}</p>
      `;
    } else {
      container.textContent = "Aucune mise à jour disponible.";
    }
  })
  .catch(() => {
    document.getElementById('vlog-container').textContent = "Erreur lors du chargement.";
  });
