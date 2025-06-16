// assets/js/vlog.js

// Fonction pour formater une date ISO en français
function formatDateFR(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// Charger et afficher les entrées depuis vlog.json
fetch('vlog.json')
  .then(response => {
    if (!response.ok) throw new Error('Erreur lors du chargement du fichier vlog.json');
    return response.json();
  })
  .then(data => {
    const container = document.getElementById('vlog-list');
    container.innerHTML = ''; // Vide le contenu "Chargement..."

    data.forEach(entry => {
      const section = document.createElement('div');
      section.classList.add('vlog-entry');

      const date = new Date(entry.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      section.innerHTML = `
        <p>📅 ${date}</p>
        <p>🔹 ${entry.title}</p>
        ${entry.message ? `<p>💬 ${entry.message}</p>` : ''}
      `;

      container.appendChild(section);
    });
  })
  .catch(err => {
    document.getElementById('vlog-list').innerHTML = '❌ Impossible de charger les mises à jour.';
    console.error(err);
  });
