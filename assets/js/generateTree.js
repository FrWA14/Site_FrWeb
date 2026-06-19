// Mise à jour de tree.json : sudo node assets/json/generateTree.js
const fs = require('fs');
const path = require('path');

// Chemin de base à retirer (chemin absolu vers la racine web)
const basePathToRemove = path.join(__dirname, '../../');

function generateTree(directoryPath) {
    const stats = fs.statSync(directoryPath);

    if (!stats.isDirectory()) return null;

    const tree = {
        name: path.basename(directoryPath),
        type: 'folder',
        children: [],
    };

    const files = fs.readdirSync(directoryPath);

    // Séparer fichiers HTML et dossiers
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    const subFolders = files.filter(file => !file.endsWith('.html'));

    // Ajouter les fichiers HTML
    htmlFiles.forEach(file => {
        const absPath = path.join(directoryPath, file);
        const relUrl = path.relative(basePathToRemove, absPath).replace(/\\/g, '/'); // ? URL relative web
        tree.children.push({
            name: file,
            type: 'file',
            url: relUrl
        });
    });

    // Ajouter les sous-dossiers contenant des fichiers .html
    subFolders.forEach(file => {
        const absPath = path.join(directoryPath, file);
        if (fs.statSync(absPath).isDirectory()) {
            const child = generateTree(absPath);
            if (child && child.children.length > 0) {
                tree.children.push(child);
            }
        }
    });

    return tree.children.length > 0 ? tree : null;
}

function saveTreeToFile(directoryPath, outputFile) {
    const tree = generateTree(directoryPath);
    if (tree) {
        fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2));
        console.log(`? Arborescence générée et sauvegardée dans ${outputFile}`);
    } else {
        console.log('?? Aucun contenu .html détecté.');
    }
}

const contenuDirectory = path.join(__dirname, '../../contenu');
const outputFile = path.join(__dirname, '../json/tree.json');

if (!fs.existsSync(contenuDirectory)) {
    console.error(`? Le dossier spécifié n'existe pas : ${contenuDirectory}`);
    process.exit(1);
}

saveTreeToFile(contenuDirectory, outputFile);
