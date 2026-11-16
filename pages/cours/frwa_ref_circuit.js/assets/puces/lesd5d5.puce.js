// LESD5D5.0 — même contenu que lesd5d5.puce.json, enveloppé dans FrWA.puce(...) pour pouvoir être chargé
// aussi quand la page est ouverte depuis le disque (file://). Le .json reste l'exemple de puce « sans code »
// à importer depuis la page (bouton ＋ → « Importer une puce »).
FrWA.puce({
  "id": "lesd5d5.0", "tags": ["protection", "semi-conducteur"],
  "version": "1.0.0",
  "regles": 1,
  "typesBroches": { "passif": ["K", "A"] },
  "variables": [],
  "modele3d": null,
  "nom": "LESD5D5.0",
  "categorie": "Protection",
  "description": "Diode TVS de protection ESD 5 V unidirectionnelle (30 fois dans tes schémas). Fichier JSON pur : aucun code, uniquement un sous-circuit et un paramètre.",
  "broches": [
    {
      "nom": "K",
      "etiquette": "K"
    },
    {
      "nom": "A",
      "etiquette": "A"
    }
  ],
  "cotes": {
    "gauche": [
      "K"
    ],
    "droite": [
      "A"
    ]
  },
  "parametres": [
    {
      "cle": "vz",
      "nom": "Claquage (hors chute de diode)",
      "unite": "V",
      "defaut": 5.6,
      "min": 2,
      "max": 40,
      "echelle": "lin",
      "pas": 0.1
    }
  ],
  "modele": {
    "elements": [
      {
        "t": "D",
        "a": "A",
        "b": "K",
        "Is": 1e-12
      },
      {
        "t": "D",
        "a": "K",
        "b": "z",
        "Is": 1e-12
      },
      {
        "t": "V",
        "a": "z",
        "b": "A",
        "V": "$vz"
      }
    ]
  }
});
