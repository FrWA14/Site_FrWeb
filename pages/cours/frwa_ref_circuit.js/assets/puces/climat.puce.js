// Capteurs analogiques qui lisent le « monde » (température et humidité à leur position) :
//  - LM35 (TI SNIS159) : 10 mV/°C, alimentation 4 à 30 V, précision 0,5 °C à 25 °C (montage de base : 2 à 150 °C),
//  - HIH-4030 (Honeywell) : VOUT = VS × (0,0062 × HR_capteur + 0,16) à 25 °C, avec HR_vraie = HR_capteur / (1,0546 − 0,00216 T).
// Glisser une « Source de chaleur / humidité » près d'eux pour voir leur tension changer.

(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'lm35', tags: ['capteur', 'analogique', 'arduino', 'monde'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VS', 'GND'], sortie: ['VOUT'] },
  variables: [{ cle: 'T', nom: 'Température lue', unite: '°C' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'LM35',
  prefixe: 'U',
  categorie: 'Capteurs',
  description: 'Capteur de température analogique : VOUT = 10 mV × T(°C). Lit la température du monde à sa position (ambiante + sources de chaleur).',
  broches: [{ nom: 'VS', etiquette: '+VS' }, 'VOUT', 'GND'],
  cotes: { gauche: ['VS'], droite: ['VOUT'], bas: ['GND'] },
  modele: {
    elements: [{ t: 'O', a: 'VOUT', ref: 'GND', V: 0, R: 1, nom: 'sortie' }, { t: 'R', a: 'VS', b: 'GND', R: 80e3 }],
    etat: () => ({ T: 20 }),
    pas(c) {
      const vs = c.v('VS') - c.v('GND');
      c.s.T = c.monde.temperature(c.ici.x, c.ici.y);
      c.regler('sortie', vs < 4 ? 0 : Math.max(0, Math.min(vs - 1.5, 0.01 * c.s.T)));
    },
  },
  affichage: s => `${(s.T ?? 0).toFixed(1).replace('.', ',')} °C`,
});

FrWA.puce({
  id: 'hih4030', tags: ['capteur', 'analogique', 'monde'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VS', 'GND'], sortie: ['VOUT'] },
  variables: [{ cle: 'HR', nom: 'Humidité lue', unite: '%' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'HIH-4030',
  prefixe: 'U',
  categorie: 'Capteurs',
  description: 'Capteur d\'humidité analogique ratiométrique (Honeywell HIH-4030, 4 à 5,8 V) : VOUT = VS × (0,0062 × HR + 0,16) à 25 °C. Lit l\'humidité et la température du monde. (Composant aujourd\'hui obsolète, modèle pédagogique.)',
  broches: ['VS', 'VOUT', 'GND'],
  cotes: { gauche: ['VS'], droite: ['VOUT'], bas: ['GND'] },
  modele: {
    elements: [{ t: 'O', a: 'VOUT', ref: 'GND', V: 0, R: 50, nom: 'sortie' }, { t: 'R', a: 'VS', b: 'GND', R: 25e3 }],
    etat: () => ({ HR: 50 }),
    pas(c) {
      const vs = c.v('VS') - c.v('GND'), T = c.monde.temperature(c.ici.x, c.ici.y);
      c.s.HR = c.monde.humidite(c.ici.x, c.ici.y);
      const hrCapteur = c.s.HR * (1.0546 - 0.00216 * T);
      c.regler('sortie', vs < 3 ? 0 : Math.max(0, Math.min(vs, vs * (0.0062 * hrCapteur + 0.16))));
    },
  },
  affichage: s => `${Math.round(s.HR ?? 0)} % HR`,
});
})();
