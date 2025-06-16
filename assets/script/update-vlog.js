// Ce script utilise l'API GitHub pour récupérer les derniers déploiements
// et les stocke dans un fichier vlog.json
// À exécuter avec Node.js (nécessite node-fetch)

import fs from 'fs';
import fetch from 'node-fetch';

const OWNER = 'FrWA14';
const REPO = 'Site_FrWeb';
const TOKEN = process.env.GH_TOKEN; // à définir comme variable d'environnement

const HEADERS = {
  'Authorization': `token ${TOKEN}`,
  'Accept': 'application/vnd.github.v3+json'
};

async function getDeployments() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/deployments`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return await response.json();
}

async function buildVlogJson() {
  try {
    const deployments = await getDeployments();
    const latest = deployments.slice(0, 5).map(dep => ({
      date: dep.created_at,
      title: dep.description || `Déploiement ${dep.id}`,
      sha: dep.sha,
      url: dep.url
    }));

    fs.writeFileSync('vlog.json', JSON.stringify(latest, null, 2));
    console.log('✅ vlog.json mis à jour.');
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour de vlog.json:', err.message);
  }
}

buildVlogJson();
