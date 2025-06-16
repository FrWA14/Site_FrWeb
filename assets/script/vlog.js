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
fetch("vlog.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("Erreur lors du chargement de vlog.json");
    }
    return response.json();
  })
  .then(data => {
    const container = document.getElementById("vlog-list");
    container.innerHTML = ""; // Nettoyer le contenu par défaut

    data.forEach(entry => {
      const div = document.createElement("div");
      div.classList.add("vlog-entry");

      const date = document.createElement("p");
      date.classList.add("vlog-date");
      date.textContent = `📅 ${formatDateFR(entry.date)}`;

      const title = document.createElement("p");
      title.classList.add("vlog-title");
      title.textContent = `🔹 ${entry.title}`;

      div.appendChild(date);
      div.appendChild(title);
      container.appendChild(div);
    });
  })
  .catch(err => {
    document.getElementById("vlog-list").textContent =
      "❌ Impossible de charger les mises à jour.";
    console.error(err);
  });
