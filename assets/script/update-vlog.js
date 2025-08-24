import fs from 'fs';
import fetch from 'node-fetch';

const OWNER = 'FrWA14';
const REPO = 'Site_FrWeb';
const TOKEN = process.env.GH_TOKEN;

const HEADERS = {
  'Authorization': `token ${TOKEN}`,
  'Accept': 'application/vnd.github.v3+json'
};

// Récupère les messages de commit à partir d’un SHA
async function getCommitMessage(sha) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits/${sha}`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) return null;

  const data = await response.json();
  return data.commit?.message || null;
}

async function getDeployments() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/deployments`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  return await response.json();
}

async function buildVlogJson() {
  try {
    const deployments = await getDeployments();
    const latest = await Promise.all(deployments.slice(0, 5).map(async (dep) => {
      const commitMessage = await getCommitMessage(dep.sha);
      return {
        date: dep.created_at,
        title: dep.description || `Déploiement ${dep.id}`,
        message: commitMessage,
        sha: dep.sha,
        url: dep.url
      };
    }));

    fs.writeFileSync('assets/json/vlog.json', JSON.stringify(latest, null, 2));
    console.log('✅ vlog.json mis à jour avec les messages de commit.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

buildVlogJson();
