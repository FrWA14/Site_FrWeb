# Démodulation de tonalités à référence 6 kHz : actionneurs et moteurs pas à pas en CD4000 (version 2)

Nov 23, 2026 · @FrWA

## Résumé

**Votre principe moteur est confirmé et reste le cœur du montage :** le signe de l'écart entre la fréquence reçue et la référence donne le sens de rotation, sa valeur donne la vitesse. Tout est faisable en CD4000, avec quelques amplificateurs opérationnels et comparateurs (MC33079, LM358, LM339) pour la partie analogique.

Cette version 2 reprend l'étude avec vos corrections :

- **Fréquences** : référence 6 kHz, moteurs 3 kHz et 1,5 kHz, actionneurs 750 Hz et 375 Hz (voir la note sur 325 Hz dans les hypothèses).
- **Vitesse réglable** : la version 1 donnait une vitesse figée (4 pas par hertz d'écart). Ici, un convertisseur fréquence-tension suivi d'un VCO permet de régler par potentiomètre l'écart maximal (±0,2 à ±0,5 kHz) et la vitesse maximale (0,5 à 3 tr/s).
- **Sens** : il est maintenant tiré du comparateur de phase PC2 du CD4046B. La simulation a montré que la méthode en quadrature de la version 1 se trompait de sens à 1,5 kHz ± 0,3 kHz.
- **Entrée jack protégée** : un transformateur audio 1:1 isole complètement l'appareil source. Aucun courant continu ne peut remonter vers sa sortie audio, même en cas de panne de la carte.
- **Alimentation batterie au plomb** : un régulateur à faible chute fournit 9 V stables de 10 V à 14,7 V. Une surveillance coupe moteurs et actionneurs sous 10,8 V pour protéger la batterie.
- **Organisation** : la partie 1 (réception, filtres, actionneurs, alimentation) est à construire et régler en premier. La carte moteur est isolée en partie 2, en fin de document, avec ses calculs et ses réglages.

**Un point d'attention :** avec ce plan en octaves, l'actionneur à 750 Hz n'est qu'à 250 Hz du bas de la plage du moteur 2 quand l'écart atteint −0,5 kHz (1,0 kHz). Je recommande un écart maximal de ±0,3 kHz. À ±0,5 kHz le montage fonctionne encore en simulation, mais avec moins de marge.

Les schémas sont dessinés bloc par bloc, avec peu d'étiquettes de liaison. Les composants à remplacer par des potentiomètres sont en rouge.

## Hypothèses et plan de fréquences

| Voie | Fréquence | Plage | Rôle |
| --- | --- | --- | --- |
| Référence | 6 kHz | fixe | Verrouille la PLL ; sert de base aux références moteur ; présence générale |
| Moteur 1 | 3 kHz | 3 kHz ± Δfmax | Vitesse et sens du moteur 1 |
| Moteur 2 | 1,5 kHz | 1,5 kHz ± Δfmax | Vitesse et sens du moteur 2 |
| Actionneur 1 | 750 Hz | fixe | Relais K1 (tout ou rien) |
| Actionneur 2 | 375 Hz | fixe | Relais K2 (tout ou rien) |

- **375 Hz plutôt que 325 Hz.** Vous avez écrit 325 Hz, mais toutes les autres voies sont des divisions par 2 de 6 kHz, et 6 kHz ÷ 16 = 375 Hz. J'ai retenu 375 Hz. Si c'est bien 325 Hz, seul le filtre de cette voie change : multiplier ses trois résistances par 1,15 (12,4 kΩ, 48,7 kΩ et 511 Ω au lieu de 10,7 kΩ, 42,2 kΩ et 442 Ω).
- **Source** : sortie jack d'un appareil (téléphone, ordinateur), environ 1 V crête pour l'ensemble des tonalités, soit environ 0,2 V crête par tonalité quand les cinq sont présentes. L'entrée a un gain réglable de 1 à 11 pour s'adapter au volume.
- **Écart maximal Δfmax** : réglable de ±0,2 à ±0,5 kHz, le même pour les deux moteurs. À Δf = ±Δfmax, le moteur atteint sa vitesse maximale.
- **Vitesse maximale** : réglable de 0,5 à 3 tr/s. Les calculs supposent un moteur de 200 pas par tour (1,8°) en pas entier, soit 100 à 600 pas/s. Pour un autre moteur, remplacer 200 par son nombre de pas.
- **Vitesse proportionnelle à l'écart** : v = vmax · |Δf| / Δfmax. Le sens est donné par le signe de Δf. Pas de signal, pas de pilote ou batterie faible : moteurs et actionneurs coupés.
- **Zone morte** : sous environ 20 Hz d'écart, le moteur s'arrête (réglable). Cela évite qu'il tremble d'un pas à l'autre autour de l'arrêt.
- **Alimentation** : batterie au plomb 12 V, de 10,5 V (déchargée) à 14,4–14,7 V (en charge). Logique et analogique en +9 V régulé ; moteurs et relais directement sur la batterie.
- **Moteurs** : pas à pas unipolaires 12 V (5 ou 6 fils), pilotés par quatre MOSFET chacun. Pour un bipolaire, voir la variante en partie 2.

## État de l'existant

Votre idée combine des techniques bien documentées dans les livres et revues d'électronique des années 1960 à 1990.

| Technique | Ce qu'elle fait | Ce qu'on en reprend |
| --- | --- | --- |
| Télécommande à lames vibrantes (radiocommande, années 1950–1970) | Une tonalité par canal, chaque lame résonne sur sa fréquence et colle un relais | Le principe « une fréquence = un actionneur » (voies 750 et 375 Hz) |
| Télémesure FM/FM (IRIG 106, chap. 3) | Plusieurs sous-porteuses sur une même ligne, séparées par un banc de filtres | Le banc de filtres passe-bande |
| Décodeur stéréo FM à pilote 19 kHz | Une PLL se verrouille sur un pilote et régénère une référence exacte | La référence 6 kHz et la PLL CD4046B |
| Décodeur de tonalité LM567 | PLL + détecteur de présence intégrés | L'idée d'une validation par présence et verrouillage |
| Télécommande centralisée (ripple control, CEI 62054-21) | Ordres envoyés par fréquences sur une ligne bruitée, décodés avec temporisation | Le seuil + temporisation contre les parasites |
| Tachymètre à monostable (convertisseur fréquence-tension) | Une impulsion calibrée par période, moyennée : tension proportionnelle à la fréquence | La mesure de la valeur de l'écart, réglable par potentiomètre (carte moteur) |
| Commande de moteur pas à pas par VCO | La tension règle la fréquence de pas, un séquenceur génère les phases | Le VCO et le séquenceur réversible (carte moteur) |
| Détecteur de fréquence (Messerschmitt, 1979) | Mesure du signe et de la valeur d'un écart de fréquence | Base théorique du détecteur d'écart |

Je n'ai pas trouvé de montage publié qui commande exactement des moteurs pas à pas par l'écart à une référence transmise. Votre combinaison est originale, mais chaque brique est classique et éprouvée.

## Votre méthode et ce qui change

| Votre idée | Verdict | Mise en œuvre retenue |
| --- | --- | --- |
| Une fréquence de référence, les autres en sont des divisions | Correct | Référence 6 kHz ; la PLL du récepteur la régénère, la carte moteur la divise par 2 et par 4 |
| « Diplexeur » pour séparer les canaux | À corriger | Un diplexeur ne sépare que deux bandes. Il faut un banc de 5 filtres passe-bande, deux étages par voie |
| Préampli + comparateur après le filtre | Correct | Mise en forme carrée (LM339) et détecteur de crête à seuil avec temporisation |
| PLL de référence + comparateur pour confirmer la présence | Correct | PLL CD4046B verrouillée sur 6 kHz, détecteur de verrouillage ; chaque sortie exige pilote + verrouillage + voie |
| Sortie binaire vers relais ou bascule D | Correct | Actionneurs par MOSFET et relais, avec une variante à bascule |
| Diviser la référence pour obtenir les fréquences moteur | Correct | 6 kHz ÷ 2 = 3 kHz, ÷ 4 = 1,5 kHz : zéro de vitesse exact |
| Avance ou retard de fréquence → sens ; plus l'écart est grand, plus c'est rapide | Correct | Sens par le comparateur PC2 du CD4046B, valeur de l'écart par une bascule D, vitesse par conversion fréquence-tension + VCO |
| « PWM » plus ou moins rapide | À préciser | Un pas à pas ne se règle pas en vitesse par PWM mais par la cadence des pas. On génère donc une horloge de pas dont la fréquence suit l'écart |
| Inverser le sens en changeant la quadrature d'une bobine | Correct | Le séquenceur inverse l'ordre des phases de la bobine B quand le sens change |
| Pas de signal → 0, pas de déclenchement accidentel | Correct | Validation logique, tirages à la masse sur les grilles, mise sous tension sûre, coupure batterie faible |

**Pourquoi un convertisseur fréquence-tension et un VCO ?** Vous voulez régler l'écart maximal et la vitesse maximale indépendamment. Le battement entre la fréquence reçue et la référence a une fréquence égale à |Δf|. Un monostable de durée T le transforme en tension proportionnelle à |Δf|. T fixe l'écart qui donne la pleine échelle. Un potentiomètre dose ensuite cette tension avant le VCO : il fixe la vitesse maximale. Un troisième potentiomètre règle la zone morte autour de l'arrêt.

**Pourquoi le sens par PC2 ?** Le PC2 du CD4046B est un comparateur phase-fréquence : face à deux fréquences différentes, il ne produit que des impulsions dans un sens. Filtrée, sa sortie vaut environ 8 V ou 0,8 V selon le signe de Δf, sans ambiguïté de ±5 Hz à ±500 Hz en simulation.

## Architecture générale

Le montage est réparti sur deux cartes, à construire dans cet ordre.

**Partie 1, carte de réception** (alimentation +9 V régulée) :

- **A, entrée** : jack, transformateur d'isolement, ampli à gain réglable, tension de référence Vref = 4,5 V.
- **B, filtres** : cinq voies passe-bande, deux étages par voie.
- **C, comparateurs** : mise en forme carrée (référence et moteurs) et détecteur de présence (cinq voies).
- **D, PLL** : CD4046B verrouillé sur 6 kHz, détecteur de verrouillage.
- **E, validation et actionneurs** : portes ET, surveillance batterie, relais K1 et K2.
- **H, alimentation** : batterie, fusible, protection contre l'inversion, régulateur 9 V.

**Partie 2, carte moteur** (en fin de document) : références 3 et 1,5 kHz, détecteurs d'écart et de sens, conversion en vitesse, VCO, séquenceur et puissance.

Liaison entre les cartes (une nappe de 10 fils) : +BAT, +9 V, masse, F6 (référence 6 kHz verrouillée), SQ3 et SQ15 (tonalités moteur mises en carré), PRES3 et PRES15 (présence des voies moteur), G (pilote présent, PLL verrouillée et batterie suffisante).

La partie 1 se règle et se teste seule : les relais doivent réagir correctement et les signaux de liaison être propres avant de câbler la carte moteur.

*(schéma : Architecture des deux cartes, voir la page du site)*

## Partie 1 : carte de réception

Tout est alimenté en +9 V régulé (bloc H), avec Vref = 4,5 V. Résistances à 1 % (E96) sauf mention.

### Bloc A : entrée jack isolée, gain et Vref

C'est la protection de votre appareil. La pointe du jack (voie gauche) passe par C1 (4,7 µF film) et R1 (470 Ω), puis par le primaire du transformateur T1 ; le manchon rejoint l'autre bout du primaire.

- **Isolement** : T1 est un transformateur audio 1:1 (Triad TY-250P, 20 Hz à 20 kHz à ±1 dB, isolement 1500 V). Le côté appareil n'a aucune liaison électrique avec la carte ni avec la batterie. Seul le signal alternatif passe par le champ magnétique : aucun courant continu ne peut remonter vers la sortie audio, même si la carte est en panne, mal alimentée ou si la batterie est branchée à l'envers.
- **Courant demandé à l'appareil** : R1 et la charge renvoyée par T1 donnent environ 1,5 kΩ, une charge plus légère qu'un casque (16 à 300 Ω). C1 bloque un éventuel décalage continu de la sortie audio et empêche qu'il sature le transformateur.
- **Boucle de masse** : supprimée par T1. Vous pouvez laisser le téléphone en charge sur le secteur sans relier sa masse à la batterie.
- **Côté carte** : le secondaire est référencé à Vref. R2 (1 kΩ) et D1 (BAV99, deux diodes vers +9 V et la masse) écrêtent toute surtension avant l'ampli.
- **Gain** : U1A (MC33079) monté en inverseur. Gain = (R4 + RV1) / (R2 + R3) = (10 kΩ + 0 à 100 kΩ) / 10,1 kΩ, soit 1 à 11. **RV1 (100 kΩ) est un potentiomètre** : on le règle pour obtenir 2,4 V crête par tonalité en sortie des filtres. C2 (100 pF) coupe au-delà de 15 kHz environ au gain maximal.
- **Fiche** : pointe = gauche, bague = droite (non reliée), manchon = masse. Sur une prise 4 contacts de téléphone, la masse est sur la deuxième bague : utiliser un adaptateur 4 vers 3 contacts.
- **Vref** : pont R5, R6 (10 kΩ), C3 (10 µF), suiveur U1B, puis R7 (47 Ω), C4 (10 µF) et C5 (100 nF).

Sans transformateur (si vous ne pouvez pas vous en procurer) : garder C1, mettre 10 kΩ en série dans la pointe et relier le manchon à la masse par 100 Ω. Le courant de retour reste limité à moins de 1 mA, mais la boucle de masse avec un appareil en charge n'est plus supprimée.

*(schéma : Bloc A : entrée jack isolée, gain et Vref, voir la page du site)*

### Bloc B : banc de filtres

Chaque étage est un passe-bande à contre-réaction multiple de gain 2 ; deux étages identiques en cascade par voie donnent un gain de 4 et doublent la sélectivité. Formules (C1 = C2 = C) : R1 = Q / (G · ω0 · C), R2 = 2Q / (ω0 · C), R3 = Q / ((2Q² − G) · ω0 · C), avec R3 et l'entrée + reliées à Vref.

| Voie | Amplis | Q | R1 | R2 | R3 | C (×4 par voie) | Pic simulé | Références |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 kHz | U1C, U1D | 5 | 14,0 kΩ | 56,2 kΩ | 590 Ω | 4,7 nF | 5,99 kHz | R10–R15, C10–C13 |
| 3 kHz | U2A, U2B | 3 | 8,06 kΩ | 31,6 kΩ | 1,00 kΩ | 10 nF | 3,00 kHz | R16–R21, C14–C17 |
| 1,5 kHz | U2C, U2D | 2,5 | 6,04 kΩ | 24,3 kΩ | 1,15 kΩ | 22 nF | 1,49 kHz | R22–R27, C18–C21 |
| 750 Hz | U3A, U3B | 5 | 11,3 kΩ | 45,3 kΩ | 475 Ω | 47 nF | 745 Hz | R28–R33, C22–C25 |
| 375 Hz | U3C, U3D | 5 | 10,7 kΩ | 42,2 kΩ | 442 Ω | 100 nF | 376 Hz | R34–R39, C26–C29 |

- Les voies moteur ont un Q faible pour laisser passer f0 ± Δfmax. Bande à −6 dB : 2,54 à 3,54 kHz (voie 3 kHz) et 1,23 à 1,82 kHz (voie 1,5 kHz).
- Pour ±0,5 kHz sur la voie 1,5 kHz, la variante Q = 1,5 (3,65 kΩ, 14,3 kΩ, 2,87 kΩ) élargit la bande mais laisse passer davantage le 750 Hz. La version Q = 2,5 du tableau tient ±0,5 kHz en simulation avec un rapport signal/fuite de 3 ; elle est retenue.
- Ampli MC33079 (quadruple, 16 MHz) : à 6 kHz il faut un gain en boucle ouverte bien supérieur à 2Q² = 50, ce qu'un LM324 (1 MHz) n'offre pas.
- Condensateurs film polypropylène ou C0G à 5 % (f0 varie comme 1/C).

*(schéma : Bloc B : banc de filtres, voir la page du site)*

### Bloc C : mise en forme carrée et présence

Pour la référence et les deux voies moteur, un comparateur LM339 à hystérésis (R40 = 47 kΩ vers Vref, R41 = 4,7 MΩ, rappel R42 = 10 kΩ) produit les carrés SQ6, SQ3 et SQ15. Pour les cinq voies, un détecteur de crête (D2 BAT85, C30, R43 = 47 kΩ) attaque un second comparateur.

- **Seuil** : Vth − Vref = 4,5 V · (R45 + RV2) / (R44 + R45 + RV2), avec R44 = 47 kΩ, R45 = 5,6 kΩ et **RV2 = 5 kΩ ajustable** : 0,48 à 0,83 V. Régler 0,5 V sur les voies moteur (leur niveau baisse en bord de bande) et 0,8 V sur les voies fixes.
- **C30** (décharge R43 · C30) : 100 nF (4,7 ms) pour 6 kHz, 3 kHz et 1,5 kHz ; 220 nF (10 ms) pour 750 Hz ; 330 nF (15,5 ms) pour 375 Hz, soit au moins quatre périodes.
- **Temporisation** : R47 (220 kΩ) et C31 (100 nF) font apparaître PRES après environ 25 ms ; D3 (1N4148) et R48 (22 kΩ) le font retomber en environ 3 ms (plus le temps de décharge du détecteur). R46 (470 kΩ) donne environ ±70 mV d'hystérésis.
- **Boîtiers** : LM339 U4 (carrés 6, 3 et 1,5 kHz ; U4D sert au verrouillage), U5 (présences 6 kHz, 3 kHz, 1,5 kHz, 750 Hz), U6 (U6A présence 375 Hz, U6B batterie) ; CD40106B U7 (U7A à U7E).

*(schéma : Bloc C : carré et présence, voir la page du site)*

### Bloc D : PLL de référence 6 kHz

Le CD4046B U8 reçoit SQ6 sur SIG IN. Son VCO (R50 = 100 kΩ, C40 = 820 pF NP0) tourne vers 5,9 kHz et sa sortie est rebouclée sur COMP IN.

- Comparateur PC2 et filtre de boucle R51 (100 kΩ), R52 (15 kΩ), C41 (150 nF) : Kd = 9 V / 4π ≈ 0,72 V/rad, K0 ≈ 2π · 1,33 kHz/V, τ1 = 15 ms, τ2 = 2,25 ms, d'où fn ≈ 100 Hz et ζ ≈ 0,7.
- Verrouillage : la sortie XOR PC1 reste basse quand le VCO est en phase. R53 (100 kΩ) et C42 (100 nF) la moyennent ; U4D la compare à V2 = 9 V · R55 / (R54 + R55) = 2,27 V (R54 = 27 kΩ, R55 = 9,1 kΩ), avec R56 = 1 MΩ d'hystérésis et R57 = 10 kΩ de rappel. LOCK = 1 quand la PLL est verrouillée.
- F6, la sortie du VCO, est exactement à la fréquence du pilote une fois verrouillée ; elle part vers la carte moteur.

*(schéma : Bloc D : PLL 6 kHz, voir la page du site)*

### Bloc E : validation, batterie, actionneurs

- **Validation** (CD4081B U9) : G = PRES6 · LOCK · OKBAT ; ENA1 = G · PRES750 ; ENA2 = G · PRES375.
- **Batterie** : U6B compare +BAT, divisé par le pont R60 = 15 kΩ / R61 = 10 kΩ, à Vref = 4,5 V. R62 (150 kΩ) et le rappel R63 injectent un courant dans le point milieu, à prendre en compte dans le calcul : OKBAT tombe à 10,8 V et revient vers 11,7 V (0,9 V d'hystérésis côté batterie). Corrigé après simulation : avec R60 = 14 kΩ (première version), les seuils réels étaient 10,4 V et 11,2 V, car le courant de R62 dans le pont avait été négligé. C43 (10 µF) ignore les creux brefs dus aux moteurs. Sous 10,5 V, une batterie au plomb s'abîme ; cette coupure la protège.
- **Actionneurs** : BS170 (Q1 pour K1, Q2 pour K2), R64/R66 = 100 Ω en série de grille, R65/R67 = 100 kΩ vers la masse, diode de roue libre 1N4148 (D4, D5). Relais 12 V alimentés par +BAT ; vérifier que le modèle choisi accepte 14,4 V sur sa bobine. Les contacts commandent l'actionneur sans lien électrique avec la carte.

*(schéma : Bloc E : validation, batterie, actionneurs, voir la page du site)*

### Bloc H : alimentation par batterie au plomb

- **F1** : fusible lame 3 A, au plus près de la borne + : une batterie au plomb peut débiter des centaines d'ampères dans un court-circuit.
- **Q3** (IRF4905, canal P) : protection contre l'inversion de batterie avec une chute de quelques millivolts seulement. D7 (Zener 15 V) protège sa grille ; R70 (100 kΩ) la tire à la masse.
- **D8** (TVS SMBJ18A) : écrête les surtensions de coupure des moteurs ; tension de veille de 18 V, au-dessus des 14,7 V de charge. **C60** (1000 µF, 25 V) : réservoir pour les moteurs.
- **U10** (LM2940CT-9.0) : régulateur à faible chute (0,5 V typique, 1 V au maximum à 1 A), entrée 6 à 26 V, protégé contre l'inversion. Le +9 V reste stable de 10 V à 14,7 V. C61 = 470 nF en entrée, C62 = 47 µF en sortie (le fabricant exige au moins 22 µF), C63 = 100 nF.
- **Masse en étoile** au pied de C60 : retours moteurs d'un côté, masse logique de l'autre. La carte de réception consomme environ 30 mA hors relais.

*(schéma : Bloc H : alimentation par batterie, voir la page du site)*

## Émetteur

Puisque le signal sort d'un jack, le plus simple est de produire les tonalités par logiciel (fichier audio ou application) sur le téléphone ou l'ordinateur. C'est aussi le plus précis : toutes les fréquences viennent de la même horloge audio, donc à Δf = 0 le moteur est exactement à l'arrêt. Des sinus purs n'ont pas d'harmoniques : le 3 kHz ne pollue pas la voie 6 kHz, ni le 750 Hz la voie 1,5 kHz.

- Échantillonnage 48 kHz (6 kHz tombe sur 8 échantillons par période).
- Niveau : environ 0,2 V crête par tonalité avec les cinq présentes ; la somme ne doit pas dépasser le niveau maximal de la sortie audio. Garder le volume de l'appareil fixe une fois RV1 réglé.
- Rampe : faire varier Δf progressivement (par exemple de 0 à 300 Hz en 0,5 s) pour que le moteur ne décroche pas. La carte moteur ajoute déjà une rampe d'environ 90 ms.
- Arrêt d'un moteur : Δf = 0 (le moteur est maintenu en position) ou suppression de sa tonalité (bobines coupées).

Exemple de génération en Python : moteur 1 en avant avec rampe, moteur 2 en arrière, actionneur 1 actif.

```python
import numpy as np, wave
fs, T = 48000, 6.0
t = np.arange(int(fs*T)) / fs
def tone(f, a=0.2):          # f peut varier dans le temps : on intègre la phase
    f = np.broadcast_to(f, t.shape)
    return a * np.sin(2*np.pi*np.cumsum(f)/fs)
ramp = np.clip(t/0.5, 0, 1)   # 0 -> 1 en 0,5 s
x = (tone(6000)                       # référence
   + tone(3000 + 300*ramp)            # moteur 1 : +300 Hz
   + tone(1500 - 150*ramp)            # moteur 2 : -150 Hz (sens inverse, mi-vitesse)
   + tone(750))                       # actionneur 1
x = x / np.max(np.abs(x)) * 0.9       # pleine échelle numérique sans saturation
with wave.open('commande.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(fs)
    w.writeframes((x*32767).astype('<i2').tobytes())
```

Une variante matérielle tout CD4000 reste possible (quartz, CD4060B, diviseurs CD4013B, compteurs programmables CD4059B pour ±Δf, filtres RC et sommateur), mais elle produit des carrés dont les harmoniques tombent sur les voies voisines : il faudrait bien filtrer chaque tonalité.

*(schéma : Émetteur logiciel, voir la page du site)*

## Validation par simulation

Les valeurs ont été choisies puis vérifiées par simulation en Python (modèles de comportement, pas des modèles SPICE des circuits réels).

**Filtres** (analyse nodale, ampli à 15 MHz) : pics à 5,99 kHz, 3,00 kHz, 1,49 kHz, 745 Hz et 376 Hz, gain de 4 par voie.

**Chaîne de réception complète** : tonalités de 0,6 V crête après l'ampli d'entrée, bruit de 0,2 V efficace et ronflement 50 Hz de 0,3 V. Crête en sortie de chaque filtre (V) :

| Cas | 6 kHz | 3 kHz | 1,5 kHz | 750 Hz | 375 Hz |
| --- | --- | --- | --- | --- | --- |
| Toutes présentes, moteurs à l'arrêt | 2,72 | 2,70 | 2,84 | 2,50 | 2,43 |
| Toutes, moteurs à +0,3 kHz | 2,67 | 2,23 | 1,65 | 2,50 | 2,40 |
| Toutes, moteurs à −0,3 kHz | 2,66 | 1,97 | 1,49 | 2,58 | 2,41 |
| Toutes, moteurs à +0,5 kHz | 2,74 | 1,86 | 1,21 | 2,52 | 2,38 |
| Toutes, moteurs à −0,5 kHz | 2,69 | 1,34 | 1,03 | 2,73 | 2,43 |
| Référence seule | 2,63 | 0,32 | 0,20 | 0,08 | 0,05 |
| 750 Hz et 375 Hz seuls | 0,28 | 0,33 | 0,33 | 2,51 | 2,40 |
| Aucune tonalité (bruit) | 0,32 | 0,25 | 0,23 | 0,08 | 0,06 |

Avec un seuil de 0,75 V crête (0,5 V + 0,25 V de diode) sur les voies moteur et 1,05 V sur les voies fixes, une voie présente est toujours détectée et une voie absente ne l'est jamais. La marge la plus faible est celle du moteur 2 à −0,5 kHz (1,03 V contre 0,33 V de fuite) : d'où la recommandation de ±0,3 kHz.

**Carte moteur** (détecteur d'écart, conversion, VCO, comptage des pas) : dès que l'écart dépasse 50 Hz, la cadence mesurée suit la formule à 1 % près, par exemple 600 pas/s attendus à ±Δfmax pour 3 tr/s, 100 pas/s pour 0,5 tr/s, sur les deux voies et pour Δfmax de 200 à 500 Hz. Montée à 90 % en 85 à 90 ms ; ondulation de vitesse inférieure à 1 % au-delà de 50 Hz d'écart, mais 17 à 30 % vers 20 Hz : d'où la zone morte.

**Sens** : sortie filtrée du PC2 entre 7,9 et 8,4 V quand f est au-dessus de la référence, entre 0,6 et 1,1 V en dessous, pour tout écart de ±5 Hz à ±500 Hz, sur les deux voies. L'ancienne méthode en quadrature donnait un sens aléatoire à 1,5 kHz ± 0,5 kHz et erroné dans 28 % des cas à +0,3 kHz.

**Non simulé** : la PLL à 6 kHz (valeurs calculées par la même méthode que la version 1, où elle avait été simulée à 12 kHz), la loi exacte du VCO du CD4046B (seuil et pente à mesurer) et le comportement électromécanique des moteurs. Ces points se vérifient à l'oscilloscope pendant la mise au point.

## Sécurité, CEM et mise au point de la partie 1

**Protection de l'appareil source.** Le transformateur T1 est la barrière : rien ne relie électriquement la sortie audio à la carte. Ne jamais relier le manchon du jack à la masse de la carte, et ne pas brancher l'appareil tant que T1 n'est pas en place.

**Pourquoi les parasites ne déclenchent rien.** Quatre barrières s'enchaînent : le filtre ne laisse passer que sa bande, le seuil ignore ce qui reste sous 0,5 à 0,8 V, la temporisation écarte les salves de moins de 25 ms, et la porte ET exige en plus la référence, le verrouillage de la PLL et une batterie suffisante.

**État sûr.** À la mise sous tension, les présences valent 0 pendant 25 ms : relais et moteurs restent coupés. LOCK, lui, passe brièvement à 1 (C42 part de 0 V, sous le seuil de 2,27 V) ; si la PLL n'est pas verrouillée, la moyenne de PC1 dépasse ce seuil en moins de 10 ms et LOCK retombe avant l'arrivée de PRES6, donc G reste à 0 (vu en simulation). Chaque grille de MOSFET a un tirage à la masse. Une coupure du câble jack fait retomber G en quelques millisecondes.

**CEM.**

- Câble jack court ou blindé ; la ligne vers la carte passe loin des fils moteur.
- Masse en étoile au pied de C60 ; les retours des moteurs ne passent jamais sous les filtres.
- Découplage 100 nF céramique à moins de 10 mm de chaque boîtier ; aucune entrée CD4000 en l'air.
- Fils moteur torsadés par paire ; TVS D8 et diodes de roue libre au plus près.

**Mise au point, dans cet ordre** (appareil source débranché pour les étapes 1 et 2).

1. Alimentation : brancher la batterie à travers F1, mesurer +9 V et Vref = 4,5 V. Pour tester la protection contre l'inversion, utiliser une alimentation de laboratoire limitée à 100 mA, jamais la batterie : rien ne doit chauffer et le +9 V doit rester à 0.
2. Batterie faible : remplacer la batterie par une alimentation réglable, descendre sous 10,8 V : OKBAT doit passer à 0 ; remonter : retour vers 11,7 V.
3. Niveau : lire le fichier de test avec les cinq tonalités, volume de l'appareil au maximum utile puis figé. Régler RV1 pour 2,4 V crête en sortie de chaque filtre (oscilloscope, référence = Vref).
4. Filtres : avec une seule tonalité à la fois, vérifier que seule sa voie répond.
5. PLL : avec la référence seule, LOCK doit monter en moins de 50 ms et F6 valoir 6,000 kHz.
6. Seuils : régler RV2 sur chaque voie (0,5 V moteurs, 0,8 V fixes). Vérifier que PRES3 et PRES15 restent à 1 jusqu'à ±Δfmax.
7. Actionneurs : 750 Hz seul puis 375 Hz seul, avec et sans référence : K1 et K2 ne doivent coller qu'avec la référence.

La partie 1 est alors prête ; la carte moteur se câble ensuite sur la nappe de liaison.

## Nomenclature de la carte de réception

Résistances 1 % (E96), 0,25 W ; découplage 100 nF céramique X7R par boîtier (non listé). Les composants en gras sont à régler.

| Bloc | Références | Valeur ou modèle | Qté |
| --- | --- | --- | --- |
| A | J1 | Embase jack 3,5 mm stéréo | 1 |
| A | T1 | Transformateur audio 1:1, Triad TY-250P | 1 |
| A | C1 | 4,7 µF film (polyester, 63 V) | 1 |
| A | R1 ; R2 ; R3 ; R4 | 470 Ω ; 1 kΩ ; 9,1 kΩ ; 10 kΩ | 1 chacune |
| A | **RV1** | **Potentiomètre 100 kΩ linéaire (gain d'entrée)** | 1 |
| A | C2 | 100 pF C0G | 1 |
| A | D1 | BAV99 | 1 |
| A | R5, R6 ; R7 | 10 kΩ ; 47 Ω | 2 ; 1 |
| A | C3, C4 ; C5 | 10 µF ; 100 nF | 2 ; 1 |
| A, B | U1, U2, U3 | MC33079 (quadruple ampli op) | 3 |
| B | R10 à R39 | Valeurs du tableau du bloc B | 30 |
| B | C10–C13 ; C14–C17 ; C18–C21 ; C22–C25 ; C26–C29 | 4,7 nF ; 10 nF ; 22 nF ; 47 nF ; 100 nF, film PP ou C0G 5 % | 4 de chaque |
| C | U4, U5, U6 | LM339 | 3 |
| C | U7 | CD40106B | 1 |
| C | R40, R41, R42 | 47 kΩ ; 4,7 MΩ ; 10 kΩ | 3 de chaque (voies 6, 3, 1,5 kHz) |
| C | R43, R44, R45, R46, R47, R48 | 47 kΩ ; 47 kΩ ; 5,6 kΩ ; 470 kΩ ; 220 kΩ ; 22 kΩ | 5 de chaque |
| C | **RV2** | **Ajustable 5 kΩ multitour (seuil de présence)** | 5 |
| C | C30 | 100 nF (×3), 220 nF (×1), 330 nF (×1) | 5 |
| C | C31 | 100 nF | 5 |
| C | D2 ; D3 | BAT85 ; 1N4148 | 5 ; 5 |
| D | U8 | CD4046B | 1 |
| D | R50, R51, R53 ; R52 ; R54 ; R55 ; R56 ; R57 | 100 kΩ ; 15 kΩ ; 27 kΩ ; 9,1 kΩ ; 1 MΩ ; 10 kΩ | 3 ; 1 ; 1 ; 1 ; 1 ; 1 |
| D | C40 ; C41 ; C42 | 820 pF NP0 ; 150 nF film ; 100 nF | 1 chacun |
| E | U9 | CD4081B | 1 |
| E | R60 ; R61 ; R62 ; R63 | 15 kΩ ; 10 kΩ ; 150 kΩ ; 10 kΩ | 1 chacune |
| E | C43 | 10 µF | 1 |
| E | Q1, Q2 | BS170 | 2 |
| E | R64, R66 ; R65, R67 | 100 Ω ; 100 kΩ | 2 ; 2 |
| E | D4, D5 | 1N4148 | 2 |
| E | K1, K2 | Relais 12 V, bobine ≥ 300 Ω, admettant 14,4 V | 2 |
| H | F1 | Fusible lame 3 A + porte-fusible sur fil | 1 |
| H | S1 | Interrupteur général 5 A | 1 |
| H | Q3 | IRF4905 (MOSFET canal P) | 1 |
| H | D7 ; D8 | Zener 15 V 0,5 W ; TVS SMBJ18A | 1 ; 1 |
| H | R70 | 100 kΩ | 1 |
| H | U10 | LM2940CT-9.0 | 1 |
| H | C60 ; C61 ; C62 ; C63 | 1000 µF 25 V ; 470 nF ; 47 µF ; 100 nF | 1 chacun |

Le CD4046B, le CD4013B et le CD4081B se trouvent encore facilement ; le LM2940 existe en version 9 V chez plusieurs fournisseurs, à vérifier avant commande.

## Partie 2 : carte moteur

Cette partie est à étudier une fois la carte de réception réglée. Elle reçoit par la nappe F6, SQ3, SQ15, PRES3, PRES15, G, +9 V et +BAT. Les deux moteurs ont des chaînes identiques ; seul le moteur 1 est dessiné, avec les références du moteur 2 indiquées en note.

*(schéma : Chaîne d'un moteur, voir la page du site)*

### Principe et calcul de la vitesse

Pour chaque moteur, la chaîne comprend cinq étapes :

1. **Écart** : une bascule D échantillonne la tonalité reçue (SQ3) au rythme de la référence (F3). Sa sortie BATT1 est un carré à la fréquence |Δf| = |f − 3 kHz|.
2. **Sens** : le comparateur PC2 d'un CD4046B, filtré, donne DIR1 = signe de Δf.
3. **Conversion** : un monostable de durée T par période de battement, puis un filtre, donnent VFV = 9 V · T · |Δf|.
4. **Mise à l'échelle** : VCOIN = Voff + α · VFV, où α est réglé par potentiomètre et Voff fixe la zone morte.
5. **Horloge de pas** : le VCO d'un CD4046B donne fpas ≈ K · (VCOIN − Vt) ; un séquenceur réversible génère les quatre phases.

Avec Voff réglé égal au seuil Vt du VCO, tout se résume à :

**v (tr/s) = K · α · 9 V · T · |Δf| / N**, et le sens suit le signe de Δf.

**Réglage de l'écart maximal (RV101).** On choisit T = 0,5 / Δfmax, pour que VFV atteigne 4,5 V (la moitié de l'alimentation) à l'écart maximal. Avec C101 = 100 nF film, T = (R101 + RV101) · C101 :

| Δfmax | T | R101 + RV101 | Position de RV101 (22 kΩ) |
| --- | --- | --- | --- |
| ±0,2 kHz | 2,5 ms | 25 kΩ | 16,8 kΩ |
| ±0,3 kHz (recommandé) | 1,67 ms | 16,7 kΩ | 8,5 kΩ |
| ±0,4 kHz | 1,25 ms | 12,5 kΩ | 4,3 kΩ |
| ±0,5 kHz | 1,0 ms | 10 kΩ | 1,8 kΩ |

**Réglage de la vitesse maximale (RV102).** Pour un moteur de N = 200 pas par tour, fpas,max = 200 · vmax. Le gain du VCO vaut environ K ≈ 177 Hz/V (estimation : environ 1,4 kHz à 9 V avec R110 = 33 kΩ et C104 = 22 nF, seuil d'environ 1,2 V). Alors α = fpas,max / (K · 4,5 V) :

| Vitesse max | fpas,max | α estimé | Position de RV102 (α = (1,2 kΩ + x) / 11,2 kΩ) |
| --- | --- | --- | --- |
| 0,5 tr/s | 100 pas/s | 0,13 | x ≈ 0,3 kΩ |
| 1 tr/s | 200 pas/s | 0,25 | x ≈ 1,6 kΩ |
| 2 tr/s | 400 pas/s | 0,50 | x ≈ 4,4 kΩ |
| 3 tr/s | 600 pas/s | 0,75 | x ≈ 7,2 kΩ |

K et Vt varient d'un CD4046B à l'autre : ces positions sont des points de départ, et le réglage final se fait en mesurant la fréquence de CLK1 (voir la mise au point). Ces α supposent Voff juste au seuil Vt ; avec Voff un peu sous Vt (zone morte), il faut davantage. En simulation (K ≈ 153 Hz/V, Vt ≈ 1 V, Voff ≈ 0,75 V), 3 tr/s demande α ≈ 0,92, soit RV102 presque en butée (x ≈ 9,1 kΩ). Si CLK1 n'atteint pas fpas,max curseur au maximum, passer C104 de 22 nF à 18 nF (K × 1,22).

**Zone morte (RV103).** Voff réglé légèrement sous Vt : le VCO ne démarre que pour |Δf| supérieur à environ 20 Hz. Sans zone morte, la vitesse ondule fortement près de l'arrêt (17 à 30 % à 20 Hz en simulation).

**Même vitesse pour les deux moteurs.** Les deux voies utilisent le même Δfmax et le même vmax ; chaque moteur a ses propres RV101 à RV103 pour compenser la dispersion des CD4046B. Si un réglage plus fin est nécessaire, remplacer R110 par 22 kΩ + ajustable 22 kΩ.

**Composants à rendre réglables** (en rouge sur les schémas) :

- RV101 / RV111 : ajustable 22 kΩ multitour, écart maximal. Un condensateur variable n'est pas pratique ici (100 nF n'existe pas en variable) : on joue sur la résistance.
- RV102 / RV112 : potentiomètre 10 kΩ linéaire, vitesse maximale (en façade si vous voulez la changer en service).
- RV103 / RV113 : ajustable 10 kΩ, zone morte.
- Option : R110 / R150 en 22 kΩ + ajustable 22 kΩ, égalisation des deux VCO.

### M1 : références, écart et sens

U101 (CD4013B) divise F6 par 2 (F3 = 3 kHz) puis par 2 (F15 = 1,5 kHz). U102A (bascule D) sort BATT1. Le comparateur PC2 de U105 (CD4046B), filtré par R111 (100 kΩ) et C105 (1 µF), et ramené à 4,5 V au repos par R112 et R113 (2,2 MΩ), attaque le trigger de Schmitt U109A : DIR1. Le battement reste correct tant que |Δf| est inférieur à la moitié de la référence (750 Hz pour le moteur 2), donc largement pour ±0,5 kHz.

*(schéma : M1 : références, écart et sens, voir la page du site)*

### M2 : conversion, réglages et VCO

U103A (CD4538B) : déclenché sur front montant (+TR, broche 4), −TR et RESET au +9 V, CX (broche 1) à la masse, R101 + RV101 du +9 V vers RX/CX (broche 2), C101 entre les broches 2 et 1. Le CD4538B n'est plus recommandé par TI pour les nouvelles études ; le CD14538B, compatible broche à broche, le remplace. U104A (LM358) en Sallen-Key (R102, R103 = 100 kΩ, C102 = 470 nF, C103 = 220 nF) : fc ≈ 5 Hz, Q ≈ 0,7. U104B additionne α · VFV (curseur de RV102 avec R104 = 1,2 kΩ en pied) et Voff (R106 = 22 kΩ et RV103) par R105 et R107 (100 kΩ), avec un gain de 2 (R108, R109 = 100 kΩ). La partie VCO de U105 (R110 = 33 kΩ, C104 = 22 nF, R2 non câblée, INH = EN1̄) sort CLK1.

Le filtre impose une montée en vitesse d'environ 90 ms de 0 à 90 % : c'est une rampe d'accélération naturelle qui évite au moteur de décrocher.

*(schéma : M2 : conversion, réglages et VCO, voir la page du site)*

### M3 : séquenceur et validation

U106 (deux bascules D, horloge CLK1) et U107 (CD4070B) forment un compteur de Gray réversible : DA = QB ⊕ DIR1, DB = QA ⊕ DIR1 ⊕ 1. Dans un sens, (QA, QB) parcourt 00 → 10 → 11 → 01 ; dans l'autre, l'ordre inverse. Seule la phase de la bobine B change de sens par rapport à A : c'est exactement votre « changement de quadrature d'une bobine ». U108 (CD4081B) valide les quatre phases par EN1 = G · PRES3 (U110A) ; U109C fournit EN1̄ pour arrêter le VCO.

*(schéma : M3 : séquenceur et validation, voir la page du site)*

### M4 : puissance

Quatre IRLZ44N par moteur (Q101 à Q104), résistance de grille 100 Ω (R120 à R123), tirage 10 kΩ (R124 à R127), roue libre 1N5819 (D101 à D104). Les prises médianes vont à +BAT.

- Le courant par phase vaut +BAT / R\_bobine et varie d'environ ±16 % entre 10,5 et 14,4 V. Prendre un moteur 12 V, ou ajouter une résistance série par prise médiane pour ne pas dépasser le courant nominal à 14,4 V.
- À la coupure, chaque drain monte vers 2 × +BAT (environ 29 V) : les IRLZ44N tiennent 55 V.
- Dans la zone morte avec EN = 1, le moteur reste alimenté et tient sa position : surveiller l'échauffement.
- Jusqu'à 600 pas/s, un moteur unipolaire alimenté en tension perd du couple. Vérifiez sa courbe couple-vitesse pour 3 tr/s ; sinon, passez en demi-pas ou à un pilote à courant régulé.
- Variante bipolaire : remplacer M4 par un double pont en H piloté par M1A à M1BN ; vérifier que ses entrées acceptent 9 V (sinon un CD4050B alimenté en 5 V abaisse les niveaux).

*(schéma : M4 : puissance, voir la page du site)*

### Mise au point de la carte moteur

1. Moteurs débranchés. Avec la référence seule, mesurer F3 = 3,000 kHz et F15 = 1,500 kHz.
2. Envoyer 3 kHz + Δfmax (par exemple 3,3 kHz) : BATT1 doit valoir Δfmax (300 Hz). Régler RV101 pour VFV = 4,5 V.
3. Régler RV102 pour que CLK1 = fpas,max (par exemple 600 Hz pour 3 tr/s).
4. Envoyer 3,02 kHz : régler RV103 pour que CLK1 vienne juste de s'arrêter. Revenir à 3,3 kHz et retoucher RV102 si besoin.
5. Envoyer 2,7 kHz : DIR1 doit changer d'état et le code (M1A, M1B) parcourir l'ordre inverse.
6. Couper la tonalité 3 kHz : M1A à M1BN doivent tomber à 0.
7. Recommencer pour le moteur 2 (1,5 kHz), puis brancher les moteurs, de préférence avec une alimentation limitée en courant pour le premier essai.

### Nomenclature de la carte moteur (deux moteurs)

| Références | Valeur ou modèle | Qté |
| --- | --- | --- |
| U101, U102, U106, U116 | CD4013B | 4 |
| U103 | CD4538B (ou CD14538B) | 1 |
| U104, U114 | LM358 | 2 |
| U105, U115 | CD4046B | 2 |
| U107, U117 | CD4070B | 2 |
| U108, U118, U110 | CD4081B | 3 |
| U109 | CD40106B | 1 |
| R101 ; **RV101** | 8,2 kΩ ; **ajustable 22 kΩ** | 2 ; 2 |
| C101 | 100 nF film 5 % | 2 |
| R102, R103, R105, R107, R108, R109, R111 | 100 kΩ | 14 |
| C102 ; C103 | 470 nF film ; 220 nF film | 2 ; 2 |
| **RV102** ; R104 | **Potentiomètre 10 kΩ linéaire** ; 1,2 kΩ | 2 ; 2 |
| R106 ; **RV103** | 22 kΩ ; **ajustable 10 kΩ** | 2 ; 2 |
| R110 | 33 kΩ | 2 |
| C104 | 22 nF film ou C0G | 2 |
| R112, R113 | 2,2 MΩ | 4 |
| C105 | 1 µF film | 2 |
| Q101 à Q108 | IRLZ44N | 8 |
| R120 à R123, R128 à R131 | 100 Ω | 8 |
| R124 à R127, R132 à R135 | 10 kΩ | 8 |
| D101 à D108 | 1N5819 | 8 |
| C120 ; C121 | 470 µF 25 V ; 100 nF | 1 ; 1 |

Pour le moteur 2, les composants d'entrée (M1) portent R114 à R116 et C106, et ceux de M2 portent R141 à R150, RV111 à RV113 et C111 à C114 ; ils sont comptés dans les quantités ci-dessus.

## Sources

- [Triad Magnetics TY-250P, transformateur audio 1:1, 20 Hz–20 kHz ±1 dB, isolement 1500 V (Digi-Key)](https://www.digikey.com/en/products/detail/triad-magnetics/TY-250P/7318267)
- [Texas Instruments LM2940C / LM2940-N : régulateur 1 A à faible chute, protection contre l'inversion de batterie](https://www.ti.com/product/LM2940C)
- [Texas Instruments CD14538B : monostable de précision, remplace le CD4538B](https://www.ti.com/product/CD14538B)
- [Texas Instruments CD4049UB / CD4050B : brochage et conversion de niveaux](https://www.ti.com/lit/gpn/cd4050b)
- Texas Instruments, CD4046B, fiche technique et note SCHA002A (comparateurs PC1 et PC2, VCO, filtre de boucle)
- Messerschmitt, « Frequency detectors for PLL acquisition in timing and carrier recovery », IEEE Transactions on Communications, 1979
- IRIG 106, chapitre 3 (télémesure FM/FM par sous-porteuses) ; fiche du LM567 (décodeur de tonalité) ; CEI 62054-21 (télécommande centralisée)

Les calculs de filtres, de seuils, de PLL et de vitesse, ainsi que les simulations, ont été faits pour cette étude (voir Validation). Les références sans lien viennent de la version 1 et n'ont pas été revérifiées ici.
