"""Données des circuits de la série CD4000 (brochages, textes, simulations).

Conventions des noms de broches : "~X" = signal actif à l'état bas (surligné),
"U/~D" = U actif haut, D actif bas.
"""

# ---------------------------------------------------------------------------
# Brochages communs
# ---------------------------------------------------------------------------
G4_2 = ["1A", "1B", "1Y", "2Y", "2A", "2B", "VSS", "3A", "3B", "3Y", "4Y", "4A", "4B", "VDD"]
G3_3 = ["1A", "1B", "2A", "2B", "2C", "2Y", "VSS", "1C", "1Y", "3Y", "3C", "3B", "3A", "VDD"]
G2_4 = ["1Y", "1A", "1B", "1C", "1D", "NC", "VSS", "NC", "2A", "2B", "2C", "2D", "2Y", "VDD"]
HEX6 = ["1A", "1Y", "2A", "2Y", "3A", "3Y", "VSS", "4Y", "4A", "5Y", "5A", "6Y", "6A", "VDD"]
BUF6 = ["VDD", "1Y", "1A", "2Y", "2A", "3Y", "3A", "VSS", "4A", "4Y", "5A", "5Y", "NC", "6A", "6Y", "NC"]
SW4 = ["1E/S", "1S/E", "2S/E", "2E/S", "2CTL", "3CTL", "VSS", "3E/S", "3S/E", "4S/E", "4E/S", "4CTL", "1CTL", "VDD"]
PISO = ["P8", "Q6", "Q8", "P4", "P3", "P2", "P1", "VSS", "P/~S", "CLK", "SER", "Q7", "P5", "P6", "P7", "VDD"]
DUAL4 = ["CLKA", "ENA", "Q1A", "Q2A", "Q3A", "Q4A", "RSTA", "VSS", "CLKB", "ENB", "Q1B", "Q2B", "Q3B", "Q4B", "RSTB", "VDD"]

GATE_WORD = {
    "nand": "NAND", "nor": "NOR", "and": "AND", "or": "OR", "xor": "XOR", "xnor": "XNOR",
    "not": "inverseur", "buf": "buffer",
}

# Portes : (réf, type, nb entrées, brochage, disposition interne, entrées porte 1, sortie porte 1)
GATE_SIM = {
    2: (["1A", "1B"], "1Y", [1, 2, 3]),
    3: (["1A", "1B", "1C"], "1Y", [1, 2, 8, 9]),
    4: (["1A", "1B", "1C", "1D"], "1Y", [2, 3, 4, 5, 1]),
    1: (["1A"], "1Y", [1, 2]),
}


def gate(ref, gtype, nin, intro, how_extra="", schmitt=False):
    layout = {2: "G4_2", 3: "G3_3", 4: "G2_4", 1: "HEX6"}[nin]
    pins = {2: G4_2, 3: G3_3, 4: G2_4, 1: HEX6}[nin]
    count = {2: 4, 3: 3, 4: 2, 1: 6}[nin]
    ins, out, spins = GATE_SIM[nin]
    word = GATE_WORD[gtype]
    if gtype == "not":
        title = "6 inverseurs" + (" à trigger de Schmitt" if schmitt else "")
    else:
        title = f"{count} portes {word} à {nin} entrées" + (" à trigger de Schmitt" if schmitt else "")
    return dict(
        ref=ref, cat="Schmitt / buffers" if schmitt else "Portes", title=title, pins=pins,
        draw=("gates", layout, gtype, schmitt), intro=intro, how=how_extra, gate=(gtype, nin),
        sim=dict(name="gate", opts=dict(type=gtype, inputs=ins, output=out, pins=spins, schmitt=schmitt),
                 title="table de vérité de la porte 1",
                 text="Basculez les entrées de la porte 1 (ou laissez le défilement automatique parcourir "
                      "toutes les combinaisons) : la LED suit la sortie et la ligne active de la table de "
                      "vérité est surlignée."),
    )


CHIPS = [
    gate("4001", "nor", 2,
         "Le CD4001 contient quatre portes NOR (OU-NON) indépendantes à deux entrées. La sortie "
         "est à 1 uniquement quand les deux entrées sont à 0. Comme la NAND, la NOR est une porte "
         "« universelle » : deux NOR croisées forment une bascule RS, idéale pour un bouton "
         "marche / arrêt."),
    gate("4002", "nor", 4,
         "Le CD4002 contient deux portes NOR à quatre entrées. La sortie est à 1 seulement si les "
         "quatre entrées sont à 0 : pratique pour détecter qu'aucun capteur n'est actif."),
    gate("4011", "nand", 2,
         "Le CD4011 contient quatre portes NAND (ET-NON) indépendantes à deux entrées. La sortie "
         "passe à 0 uniquement quand les deux entrées sont à 1. C'est la porte « universelle » "
         "par excellence : avec des NAND on construit toutes les autres fonctions, des bascules RS "
         "et des oscillateurs."),
    gate("4012", "nand", 4,
         "Le CD4012 contient deux portes NAND à quatre entrées. La sortie passe à 0 seulement "
         "quand les quatre entrées sont à 1, par exemple pour détecter une combinaison précise "
         "sur un compteur."),
    gate("4023", "nand", 3,
         "Le CD4023 contient trois portes NAND à trois entrées. La sortie passe à 0 uniquement "
         "quand les trois entrées sont à 1. Attention au brochage : la troisième entrée de la "
         "porte 1 (broche 8) et sa sortie (broche 9) sont de l'autre côté du boîtier."),
    gate("4025", "nor", 3,
         "Le CD4025 contient trois portes NOR à trois entrées. La sortie est à 1 seulement quand "
         "les trois entrées sont à 0. Même brochage que le CD4023."),
    gate("4030", "xor", 2,
         "Le CD4030 contient quatre portes OU exclusif (XOR) à deux entrées : la sortie est à 1 "
         "quand les entrées sont différentes. C'est l'ancienne version, remplacée par le CD4070 "
         "(même brochage), plus rapide."),
    gate("4069", "not", 1,
         "Le CD4069 contient six inverseurs : la sortie est l'inverse de l'entrée. La version "
         "<strong>4069UB</strong> (non bufferisée) est la référence pour les oscillateurs à quartz "
         "ou RC, car ses inverseurs se comportent comme de petits amplificateurs."),
    gate("4070", "xor", 2,
         "Le CD4070 contient quatre portes OU exclusif (XOR) à deux entrées : la sortie est à 1 "
         "quand les deux entrées sont différentes. Utile pour comparer deux bits, faire un "
         "inverseur commandé ou un détecteur de fronts."),
    gate("4071", "or", 2,
         "Le CD4071 contient quatre portes OU (OR) à deux entrées : la sortie est à 1 dès qu'au "
         "moins une entrée est à 1."),
    gate("4072", "or", 4,
         "Le CD4072 contient deux portes OU à quatre entrées : la sortie est à 1 dès qu'au moins "
         "une des quatre entrées est à 1, par exemple pour regrouper plusieurs alarmes."),
    gate("4073", "and", 3,
         "Le CD4073 contient trois portes ET (AND) à trois entrées : la sortie est à 1 seulement "
         "quand les trois entrées sont à 1. Même brochage que le CD4023."),
    gate("4075", "or", 3,
         "Le CD4075 contient trois portes OU à trois entrées : la sortie est à 1 dès qu'une des "
         "trois entrées est à 1. Même brochage que le CD4023."),
    gate("4077", "xnor", 2,
         "Le CD4077 contient quatre portes NON-OU exclusif (XNOR) à deux entrées : la sortie est "
         "à 1 quand les deux entrées sont identiques. C'est un comparateur d'égalité d'un bit."),
    gate("4081", "and", 2,
         "Le CD4081 contient quatre portes ET (AND) à deux entrées : la sortie est à 1 seulement "
         "quand les deux entrées sont à 1."),
    gate("4082", "and", 4,
         "Le CD4082 contient deux portes ET à quatre entrées : la sortie est à 1 seulement quand "
         "les quatre entrées sont à 1."),
    dict(gate("4093", "nand", 2,
              "Le CD4093 contient quatre portes NAND à deux entrées dont les entrées sont à "
              "<strong>trigger de Schmitt</strong> : le seuil de basculement n'est pas le même à la "
              "montée et à la descente (hystérésis). Il nettoie les signaux lents ou bruités "
              "(boutons, capteurs) et permet de faire un oscillateur avec une seule porte, une "
              "résistance et un condensateur.", schmitt=True),
         extra_sims=[dict(name="schmittOsc", opts=dict(kind="nand", enPin=1, outPin=3, vtp=2.9, vtn=1.9),
                  title="oscillateur RC à une porte",
                  text="La résistance R relie la sortie (broche 3) à l'entrée B (broche 2), le "
                       "condensateur C relie la broche 2 à la masse. Le condensateur se charge "
                       "jusqu'au seuil haut V+, la sortie bascule à 0 et le décharge jusqu'au seuil "
                       "bas V−, et ainsi de suite. L'entrée A (broche 1) démarre ou arrête "
                       "l'oscillateur. Alimentation simulée : 5 V.")]),
    dict(gate("40106", "not", 1,
              "Le CD40106 contient six inverseurs à <strong>trigger de Schmitt</strong>. Grâce à "
              "l'hystérésis, il transforme un signal lent ou bruité en créneaux propres et forme un "
              "oscillateur avec une seule résistance et un condensateur. C'est le cousin CMOS du "
              "74HC14.", schmitt=True),
         extra_sims=[dict(name="schmittOsc", opts=dict(kind="inv", outPin=2, vtp=2.9, vtn=1.9),
                  title="oscillateur RC à un inverseur",
                  text="La résistance R relie la sortie 1Y (broche 2) à l'entrée 1A (broche 1), le "
                       "condensateur C relie la broche 1 à la masse. Le condensateur oscille entre "
                       "les deux seuils V+ et V− : la sortie produit des créneaux. Alimentation "
                       "simulée : 5 V.")]),
    dict(ref="4049", cat="Schmitt / buffers", title="6 buffers inverseurs, convertisseurs de niveau",
         pins=BUF6, draw=("gates", "BUF6", "not", False), gate=("not", 1),
         intro="Le CD4049 contient six inverseurs à forte sortance. Ses entrées acceptent une "
               "tension <strong>supérieure à VDD</strong> (jusqu'à 18 V) : alimenté en 5 V, il "
               "convertit des signaux 12 ou 15 V en niveaux 5 V. Attention, l'alimentation est sur la "
               "broche 1 et la broche 16 n'est pas connectée, contrairement à presque tous les autres "
               "circuits.",
         how="Chaque sortie vaut l'inverse de son entrée. Le niveau haut de la sortie est égal à "
             "VDD, quel que soit le niveau de l'entrée.",
         sim=dict(name="gate", opts=dict(type="not", inputs=["1A"], output="1Y", pins=[3, 2]),
                  title="table de vérité du buffer inverseur 1",
                  text="Basculez l'entrée 1A (ou laissez le défilement automatique) : la LED suit la sortie 1Y."),
         extra_sims=[dict(name="levelShift", opts=dict(invert=True), title="conversion 12 V → 5 V",
                  text="Le circuit est alimenté en 5 V et reçoit un signal 0 / 12 V sur l'entrée 1A. "
                       "La sortie 1Y est inversée et ne dépasse jamais 5 V : on peut la relier sans "
                       "risque à un microcontrôleur.")]),
    dict(ref="4050", cat="Schmitt / buffers", title="6 buffers non inverseurs, convertisseurs de niveau",
         pins=BUF6, draw=("gates", "BUF6", "buf", False), gate=("buf", 1),
         intro="Le CD4050 contient six buffers non inverseurs. Ses entrées acceptent une tension "
               "<strong>supérieure à VDD</strong> (jusqu'à 18 V) : c'est le convertisseur de niveau "
               "classique pour passer de 12 V ou 5 V vers 3,3 V. Comme le 4049, l'alimentation est "
               "sur la broche 1 et la broche 16 n'est pas connectée.",
         how="Chaque sortie recopie son entrée. Le niveau haut de la sortie est égal à VDD, quel que "
             "soit le niveau de l'entrée.",
         sim=dict(name="gate", opts=dict(type="buf", inputs=["1A"], output="1Y", pins=[3, 2]),
                  title="table de vérité du buffer 1",
                  text="Basculez l'entrée 1A (ou laissez le défilement automatique) : la LED suit la sortie 1Y."),
         extra_sims=[dict(name="levelShift", opts=dict(invert=False), title="conversion 12 V → 5 V",
                  text="Le circuit est alimenté en 5 V et reçoit un signal 0 / 12 V sur l'entrée 1A. "
                       "La sortie 1Y recopie le signal mais ne dépasse jamais 5 V.")]),
    dict(ref="4013", cat="Bascules", title="2 bascules D avec Set / Reset",
         pins=["1Q", "~1Q", "1CLK", "1R", "1D", "1S", "VSS", "2S", "2D", "2R", "2CLK", "~2Q", "2Q", "VDD"],
         draw=("ff", "4013"),
         intro="Le CD4013 contient deux bascules D. À chaque front montant de l'horloge, la sortie Q "
               "recopie l'entrée D et la garde en mémoire. Les entrées S (Set) et R (Reset) forcent "
               "la sortie à 1 ou à 0 sans attendre l'horloge. En reliant D à Q̄, chaque bascule "
               "devient un diviseur de fréquence par 2 ou un télérupteur (un appui = marche, un "
               "appui = arrêt).",
         how="<table class=\"data-table\"><thead><tr><th>S</th><th>R</th><th>CLK</th><th>D</th><th>Q</th><th>Q̄</th></tr></thead><tbody>"
             "<tr><td>1</td><td>0</td><td>x</td><td>x</td><td>1</td><td>0</td></tr>"
             "<tr><td>0</td><td>1</td><td>x</td><td>x</td><td>0</td><td>1</td></tr>"
             "<tr><td>1</td><td>1</td><td>x</td><td>x</td><td>1</td><td>1</td></tr>"
             "<tr><td>0</td><td>0</td><td>↑</td><td>0</td><td>0</td><td>1</td></tr>"
             "<tr><td>0</td><td>0</td><td>↑</td><td>1</td><td>1</td><td>0</td></tr>"
             "<tr><td>0</td><td>0</td><td>↓ ou stable</td><td>x</td><td colspan=\"2\">inchangées</td></tr>"
             "</tbody></table>",
         pd={"1Q": "Sortie Q de la bascule 1", "~1Q": "Sortie complémentée Q̄ de la bascule 1",
             "1CLK": "Horloge de la bascule 1 (front montant)", "1R": "Reset de la bascule 1 (actif haut, asynchrone)",
             "1D": "Entrée de donnée de la bascule 1", "1S": "Set de la bascule 1 (actif haut, asynchrone)",
             "2Q": "Sortie Q de la bascule 2", "~2Q": "Sortie complémentée Q̄ de la bascule 2",
             "2CLK": "Horloge de la bascule 2 (front montant)", "2R": "Reset de la bascule 2 (actif haut, asynchrone)",
             "2D": "Entrée de donnée de la bascule 2", "2S": "Set de la bascule 2 (actif haut, asynchrone)"},
         sim=dict(name="dff", opts={}, title="diviseur par 2 (D relié à Q̄)",
                  text="Par défaut, D est relié à Q̄ : la sortie change d'état à chaque front montant, "
                       "sa fréquence est la moitié de celle de l'horloge. Passez D sur l'interrupteur "
                       "pour voir la mémorisation simple, et testez S et R.")),
    dict(ref="4027", cat="Bascules", title="2 bascules JK avec Set / Reset",
         pins=["2Q", "~2Q", "2CLK", "2R", "2K", "2J", "2S", "VSS", "1S", "1J", "1K", "1R", "1CLK", "~1Q", "1Q", "VDD"],
         draw=("ff", "4027"),
         intro="Le CD4027 contient deux bascules JK. À chaque front montant de l'horloge, la sortie "
               "est mise à 1 (J = 1), à 0 (K = 1), conservée (J = K = 0) ou inversée (J = K = 1). "
               "Les entrées S et R agissent directement, sans horloge. Avec J = K = 1, on obtient un "
               "diviseur par 2, la brique de base des compteurs.",
         how="<table class=\"data-table\"><thead><tr><th>J</th><th>K</th><th>Q après le front ↑</th></tr></thead><tbody>"
             "<tr><td>0</td><td>0</td><td>inchangée</td></tr><tr><td>1</td><td>0</td><td>1</td></tr>"
             "<tr><td>0</td><td>1</td><td>0</td></tr><tr><td>1</td><td>1</td><td>inversée</td></tr>"
             "</tbody></table><p>S = 1 force Q à 1, R = 1 force Q à 0, sans attendre l'horloge.</p>",
         pd={"1Q": "Sortie Q de la bascule 1", "~1Q": "Sortie Q̄ de la bascule 1", "1CLK": "Horloge de la bascule 1 (front montant)",
             "1R": "Reset de la bascule 1 (actif haut)", "1K": "Entrée K de la bascule 1", "1J": "Entrée J de la bascule 1",
             "1S": "Set de la bascule 1 (actif haut)",
             "2Q": "Sortie Q de la bascule 2", "~2Q": "Sortie Q̄ de la bascule 2", "2CLK": "Horloge de la bascule 2 (front montant)",
             "2R": "Reset de la bascule 2 (actif haut)", "2K": "Entrée K de la bascule 2", "2J": "Entrée J de la bascule 2",
             "2S": "Set de la bascule 2 (actif haut)"},
         sim=dict(name="jkff", opts={}, title="bascule JK de la bascule 1",
                  text="Avec J = K = 1, la sortie s'inverse à chaque front montant (diviseur par 2). "
                       "Changez J et K pour tester les quatre cas de la table.")),
    dict(ref="4017", cat="Compteurs", title="Compteur décimal Johnson, 10 sorties décodées",
         pins=["Q5", "Q1", "Q0", "Q2", "Q6", "Q7", "Q3", "VSS", "Q8", "Q4", "Q9", "CO", "~EN", "CLK", "RST", "VDD"],
         draw=("block", "COMPTEUR|JOHNSON|÷ 10"),
         intro="Le CD4017 est un compteur décimal à dix sorties décodées : une seule sortie est à 1 à "
               "la fois, et elle avance d'un cran à chaque front montant de l'horloge (Q0, Q1… Q9 puis "
               "retour à Q0). C'est le circuit des <strong>chenillards</strong>, des séquenceurs et des "
               "diviseurs par N, souvent piloté par un NE555.",
         how="<p>Le compteur avance sur le front montant de CLK quand l'entrée d'inhibition (broche 13) "
             "est à 0. RST à 1 ramène le compteur sur Q0. La sortie CO (broche 12) est à 1 pendant les "
             "états 0 à 4 et à 0 pendant les états 5 à 9 : elle sert à cascader plusieurs 4017.</p>"
             "<p>Pour compter jusqu'à N < 10, il suffit de relier la sortie QN à RST : le compteur "
             "revient à zéro dès qu'il l'atteint.</p>",
         pd={"CO": "Sortie de retenue (1 pendant les états 0 à 4)", "~EN": "Inhibition de l'horloge (1 = comptage bloqué)",
             "CLK": "Horloge (front montant)", "RST": "Remise à zéro (active haut, retour sur Q0)",
             "Q*": "Sortie décodée {n} (à 1 quand le compteur vaut {n})"},
         sim=dict(name="johnson10", opts={}, title="chenillard 10 LED",
                  text="Dix LED sur les sorties Q0 à Q9 : chaque front d'horloge allume la LED suivante. "
                       "Réglez la vitesse, bloquez le comptage avec l'inhibition, ou reliez RST à une "
                       "sortie pour raccourcir le cycle.")),
    dict(ref="4020", cat="Compteurs", title="Compteur binaire asynchrone 14 étages",
         pins=["Q12", "Q13", "Q14", "Q6", "Q5", "Q7", "Q4", "VSS", "Q1", "~CLK", "RST", "Q9", "Q8", "Q10", "Q11", "VDD"],
         draw=("block", "COMPTEUR|BINAIRE|14 ÉTAGES"),
         intro="Le CD4020 est un compteur binaire à 14 étages (de 0 à 16 383). Chaque étage divise la "
               "fréquence par 2 : la sortie Qn vaut la fréquence d'horloge divisée par 2ⁿ. Les sorties "
               "Q2 et Q3 ne sont pas accessibles. On l'utilise comme diviseur de fréquence ou "
               "temporisateur longue durée.",
         how="<p>Le compteur avance sur le <strong>front descendant</strong> de l'horloge. RST à 1 "
             "remet toutes les sorties à 0. Les étages basculent l'un après l'autre (compteur "
             "« asynchrone » ou « à propagation ») : pendant quelques dizaines de nanosecondes, les "
             "sorties peuvent présenter des valeurs intermédiaires.</p>",
         pd={"~CLK": "Horloge (front descendant)", "RST": "Remise à zéro (active haut)",
             "Q*": "Sortie de l'étage {n} (f ÷ 2^{n})"},
         sim=dict(name="ripple", opts=dict(stages=14, outputs=[1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                                           pins={1: 9, 4: 7, 5: 5, 6: 4, 7: 6, 8: 13, 9: 12, 10: 14, 11: 15, 12: 1, 13: 2, 14: 3},
                                           clkPin=10, rstPin=11),
                  title="compteur binaire sur LED",
                  text="Chaque LED représente un étage : Q1 change à chaque impulsion, Q4 toutes les 8, "
                       "etc. Augmentez la fréquence pour voir les étages lents avancer.")),
    dict(ref="4024", cat="Compteurs", title="Compteur binaire asynchrone 7 étages",
         pins=["~CLK", "RST", "Q7", "Q6", "Q5", "Q4", "VSS", "NC", "Q3", "NC", "Q2", "Q1", "NC", "VDD"],
         draw=("block", "COMPTEUR|BINAIRE|7 ÉTAGES"),
         intro="Le CD4024 est un compteur binaire à 7 étages (de 0 à 127) en boîtier 14 broches. "
               "Toutes les sorties Q1 à Q7 sont accessibles, ce qui en fait un diviseur de fréquence "
               "par 2, 4, 8… jusqu'à 128.",
         how="<p>Le compteur avance sur le <strong>front descendant</strong> de l'horloge ; RST à 1 "
             "remet tout à 0. En combinant des sorties avec une porte ET reliée à RST, on obtient un "
             "diviseur par N quelconque.</p>",
         pd={"~CLK": "Horloge (front descendant)", "RST": "Remise à zéro (active haut)",
             "Q*": "Sortie de l'étage {n} (f ÷ 2^{n})"},
         sim=dict(name="ripple", opts=dict(stages=7, outputs=[1, 2, 3, 4, 5, 6, 7],
                                           pins={1: 12, 2: 11, 3: 9, 4: 6, 5: 5, 6: 4, 7: 3}, clkPin=1, rstPin=2),
                  title="compteur binaire 7 bits sur LED",
                  text="Les sept LED affichent le nombre d'impulsions reçues en binaire.")),
    dict(ref="4040", cat="Compteurs", title="Compteur binaire asynchrone 12 étages",
         pins=["Q12", "Q6", "Q5", "Q7", "Q4", "Q3", "Q2", "VSS", "Q1", "~CLK", "RST", "Q9", "Q8", "Q10", "Q11", "VDD"],
         draw=("block", "COMPTEUR|BINAIRE|12 ÉTAGES"),
         intro="Le CD4040 est un compteur binaire à 12 étages (de 0 à 4 095) dont les douze sorties "
               "sont accessibles. C'est un diviseur de fréquence polyvalent (÷2 à ÷4096) et un "
               "générateur d'adresses pour les mémoires.",
         how="<p>Le compteur avance sur le <strong>front descendant</strong> de l'horloge ; RST à 1 "
             "remet tout à 0. La sortie Qn a une fréquence égale à f ÷ 2ⁿ.</p>",
         pd={"~CLK": "Horloge (front descendant)", "RST": "Remise à zéro (active haut)",
             "Q*": "Sortie de l'étage {n} (f ÷ 2^{n})"},
         sim=dict(name="ripple", opts=dict(stages=12, outputs=list(range(1, 13)),
                                           pins={1: 9, 2: 7, 3: 6, 4: 5, 5: 3, 6: 2, 7: 4, 8: 13, 9: 12, 10: 14, 11: 15, 12: 1},
                                           clkPin=10, rstPin=11),
                  title="compteur binaire 12 bits sur LED",
                  text="Les douze LED affichent le compte en binaire ; l'oscilloscope montre l'horloge "
                       "et les six premiers étages, chacun deux fois plus lent que le précédent.")),
    dict(ref="4060", cat="Compteurs", title="Compteur binaire 14 étages avec oscillateur intégré",
         pins=["Q12", "Q13", "Q14", "Q6", "Q5", "Q7", "Q4", "VSS", "φO", "~φO", "φI", "RST", "Q9", "Q8", "Q10", "VDD"],
         draw=("block", "OSCILLATEUR|+ COMPTEUR|14 ÉTAGES"),
         intro="Le CD4060 réunit un oscillateur et un compteur binaire à 14 étages. Avec un quartz "
               "horloger de 32,768 kHz, la sortie Q14 donne exactement 2 Hz : c'est la base de "
               "nombreuses horloges et temporisateurs. Il fonctionne aussi avec un simple réseau RC.",
         how="<p>L'oscillateur utilise les broches 9, 10 et 11 : quartz entre φI (11) et φ̄O (10) avec "
             "une résistance de 10 MΩ en parallèle et deux petits condensateurs à la masse, ou bien "
             "R et C pour un oscillateur RC (f ≈ 1 / 2,3·R·C). Chaque étage divise ensuite la "
             "fréquence par 2 : Qn = f ÷ 2ⁿ. Les sorties Q1 à Q3 et Q11 ne sont pas accessibles. "
             "RST à 1 arrête l'oscillateur et remet le compteur à zéro.</p>",
         pd={"φO": "Sortie de l'oscillateur (vers C en mode RC)", "~φO": "Sortie inversée de l'oscillateur (vers le quartz ou R)",
             "φI": "Entrée de l'oscillateur / horloge externe (front descendant)", "RST": "Remise à zéro, arrête l'oscillateur (active haut)",
             "Q*": "Sortie de l'étage {n} (f ÷ 2^{n})"},
         extra_specs=[("Oscillateur", "quartz ou RC, jusqu'à quelques MHz à 10 V")],
         sim=dict(name="osc4060", opts={}, title="quartz 32,768 kHz et choix de la sortie",
                  text="Le quartz fait osciller le circuit à 32 768 Hz. Choisissez la broche de sortie : "
                       "la fréquence est divisée par 2 à chaque étage, jusqu'à 2 Hz sur Q14. "
                       "L'oscilloscope affiche la sortie choisie (en jaune) et les étages voisins.")),
    dict(ref="4026", cat="Compteurs", title="Compteur décimal avec sorties 7 segments",
         pins=["CLK", "INH", "DEI", "DEO", "CO", "f", "g", "VSS", "d", "a", "e", "b", "c", "c'", "RST", "VDD"],
         draw=("block", "COMPTEUR|÷ 10|→ 7 SEGMENTS"),
         intro="Le CD4026 compte de 0 à 9 et commande directement un afficheur 7 segments à cathode "
               "commune. Sa sortie de retenue permet de cascader plusieurs circuits pour compter "
               "jusqu'à 99, 999…",
         how="<p>Le compteur avance sur le front montant de CLK quand INH est à 0. RST à 1 remet à 0. "
             "DEI (Display Enable In) à 0 éteint l'afficheur sans perdre le compte. CO passe de 0 à 1 "
             "au passage de 9 à 0 : on le relie à CLK du chiffre suivant. Prévoir une résistance "
             "par segment.</p>",
         pd={"CLK": "Horloge (front montant)", "INH": "Inhibition de l'horloge (1 = comptage bloqué)",
             "DEI": "Validation de l'affichage (1 = segments actifs)", "DEO": "Recopie de DEI (pour les circuits suivants)",
             "CO": "Retenue ÷10 (vers CLK du chiffre suivant)", "c'": "Segment c non bloqué par DEI",
             "RST": "Remise à zéro (active haut)", "SEG": "Sortie du segment {s}"},
         sim=dict(name="count7seg", opts={}, title="compteur 0-9 sur afficheur",
                  text="Chaque front d'horloge incrémente l'afficheur. L'oscilloscope montre l'horloge, "
                       "la retenue et chacune des sept sorties de segments.")),
    dict(ref="4029", cat="Compteurs", title="Compteur haut / bas préréglable, binaire ou BCD",
         pins=["PE", "Q4", "P4", "P1", "~CI", "Q1", "~CO", "VSS", "B/~D", "U/~D", "Q2", "P2", "P3", "Q3", "CLK", "VDD"],
         draw=("block", "COMPTEUR|HAUT / BAS|BIN / BCD"),
         intro="Le CD4029 est un compteur 4 bits synchrone qui compte ou décompte, en binaire (0-15) "
               "ou en décimal (0-9), et peut être préchargé avec une valeur. Idéal pour un compte à "
               "rebours ou un réglage par boutons + / −.",
         how="<p>Toutes les sorties changent en même temps au front montant de CLK (compteur "
             "synchrone). U/D̄ choisit le sens, B/D̄ le mode binaire ou décimal. PE à 1 charge "
             "immédiatement P1-P4 dans le compteur. C̄I à 0 autorise le comptage ; C̄O passe à 0 en fin "
             "de cycle (15 ou 9 en comptant, 0 en décomptant) pour piloter C̄I du circuit suivant.</p>",
         pd={"PE": "Chargement des entrées P (actif haut, asynchrone)", "~CI": "Retenue d'entrée (0 = comptage autorisé)",
             "~CO": "Retenue de sortie (0 en fin de cycle)", "B/~D": "Mode : 1 = binaire, 0 = décimal (BCD)",
             "U/~D": "Sens : 1 = comptage, 0 = décomptage", "CLK": "Horloge (front montant)",
             "P*": "Entrée de préréglage {n}", "Q*": "Sortie {n} (poids 2^{m})"},
         sim=dict(name="updown", opts=dict(binSel=True), title="compteur / décompteur",
                  text="Changez le sens avec U/D̄, le mode avec B/D̄, ou chargez une valeur avec PE. "
                       "C̄O s'active en fin de cycle.")),
    dict(ref="4510", cat="Compteurs", title="Compteur BCD haut / bas préréglable",
         pins=["PE", "Q4", "P4", "P1", "~CI", "Q1", "~CO", "VSS", "RST", "U/~D", "Q2", "P2", "P3", "Q3", "CLK", "VDD"],
         draw=("block", "COMPTEUR|BCD|HAUT / BAS"),
         intro="Le CD4510 est un compteur décimal (BCD, 0-9) synchrone qui compte ou décompte et peut "
               "être préchargé. Il a le même brochage que le 4029, la broche 9 servant ici de remise à "
               "zéro. Associé à un 4511, il forme un chiffre d'afficheur réglable.",
         how="<p>Les sorties changent ensemble au front montant de CLK. U/D̄ choisit le sens, PE charge "
             "P1-P4, RST remet à 0. C̄I à 0 autorise le comptage ; C̄O passe à 0 à 9 (comptage) ou à 0 "
             "(décomptage) pour cascader les décades.</p>",
         pd={"PE": "Chargement des entrées P (actif haut, asynchrone)", "~CI": "Retenue d'entrée (0 = comptage autorisé)",
             "~CO": "Retenue de sortie (0 en fin de cycle)", "RST": "Remise à zéro (active haut)",
             "U/~D": "Sens : 1 = comptage, 0 = décomptage", "CLK": "Horloge (front montant)",
             "P*": "Entrée de préréglage {n}", "Q*": "Sortie {n} (poids 2^{m})"},
         sim=dict(name="updown", opts=dict(reset=True), title="compteur / décompteur BCD",
                  text="Changez le sens avec U/D̄, chargez une valeur avec PE ou remettez à zéro.")),
    dict(ref="4518", cat="Compteurs", title="2 compteurs BCD synchrones", pins=DUAL4,
         draw=("block2", "COMPTEUR|BCD A", "COMPTEUR|BCD B"),
         intro="Le CD4518 contient deux compteurs décimaux (BCD, 0-9) indépendants. En reliant la "
               "sortie Q4 du premier à l'entrée EN du second, on obtient un compteur de 00 à 99, "
               "à associer à deux 4511 pour l'affichage.",
         how="<p>Chaque compteur avance sur le front montant de CLK quand EN est à 1, ou sur le front "
             "descendant de EN quand CLK est à 0 : c'est ce second mode qui sert à cascader. RST à 1 "
             "remet le compteur à 0.</p>",
         pd={"CLKA": "Horloge du compteur A (front montant)", "ENA": "Validation du compteur A (ou horloge sur front descendant)",
             "RSTA": "Remise à zéro du compteur A (active haut)",
             "CLKB": "Horloge du compteur B (front montant)", "ENB": "Validation du compteur B (ou horloge sur front descendant)",
             "RSTB": "Remise à zéro du compteur B (active haut)", "QAB": "Sortie {n} du compteur {x} (poids 2^{m})"},
         sim=dict(name="dualCount", opts=dict(mode="bcd"), title="compteur 00-99",
                  text="Les deux compteurs sont cascadés : Q4A pilote EN B. Les unités tournent de 0 à 9, "
                       "puis les dizaines avancent.")),
    dict(ref="4520", cat="Compteurs", title="2 compteurs binaires 4 bits synchrones", pins=DUAL4,
         draw=("block2", "COMPTEUR|BIN. A", "COMPTEUR|BIN. B"),
         intro="Le CD4520 contient deux compteurs binaires 4 bits (0-15) indépendants, avec le même "
               "brochage que le 4518. Cascadés, ils forment un compteur 8 bits (0-255).",
         how="<p>Chaque compteur avance sur le front montant de CLK quand EN est à 1, ou sur le front "
             "descendant de EN quand CLK est à 0. RST à 1 remet le compteur à 0.</p>",
         pd={"CLKA": "Horloge du compteur A (front montant)", "ENA": "Validation du compteur A (ou horloge sur front descendant)",
             "RSTA": "Remise à zéro du compteur A (active haut)",
             "CLKB": "Horloge du compteur B (front montant)", "ENB": "Validation du compteur B (ou horloge sur front descendant)",
             "RSTB": "Remise à zéro du compteur B (active haut)", "QAB": "Sortie {n} du compteur {x} (poids 2^{m})"},
         sim=dict(name="dualCount", opts=dict(mode="bin"), title="compteur 8 bits",
                  text="Les deux compteurs sont cascadés (Q4A → EN B) : les huit LED comptent de 0 à 255.")),
    dict(ref="4014", cat="Registres", title="Registre à décalage 8 bits, chargement parallèle synchrone", pins=PISO,
         draw=("block", "REGISTRE|8 BITS|PARALLÈLE|→ SÉRIE"),
         intro="Le CD4014 est un registre à décalage de 8 bits à chargement parallèle. Il lit d'un coup "
               "huit entrées (boutons, interrupteurs) puis les envoie une par une sur une seule sortie : "
               "idéal pour <strong>ajouter des entrées à un microcontrôleur</strong> avec trois fils.",
         how="<p>P/S̄ à 1 : les entrées P1-P8 sont chargées au front montant de l'horloge (chargement "
             "synchrone). P/S̄ à 0 : à chaque front montant, le contenu se décale d'un cran vers Q8 et "
             "l'entrée SER entre dans le premier étage. Seuls les étages Q6, Q7 et Q8 sont accessibles.</p>",
         pd={"P/~S": "Mode : 1 = chargement parallèle, 0 = décalage série", "CLK": "Horloge (front montant)",
             "SER": "Entrée série (vers le premier étage)", "P*": "Entrée parallèle {n}", "Q*": "Sortie de l'étage {n}"},
         sim=dict(name="piso", opts=dict(sync=True), title="lecture de 8 interrupteurs",
                  text="Réglez les huit entrées P, laissez P/S̄ à 1 le temps d'un front d'horloge pour les "
                       "charger, puis passez-le à 0 : les bits sortent un par un sur Q8.")),
    dict(ref="4015", cat="Registres", title="2 registres à décalage 4 bits, entrée série",
         pins=["CLKB", "Q4B", "Q3A", "Q2A", "Q1A", "RSTA", "DA", "VSS", "CLKA", "Q4A", "Q3B", "Q2B", "Q1B", "RSTB", "DB", "VDD"],
         draw=("block", "2 × REGISTRE|4 BITS|SÉRIE|→ PARALLÈLE"),
         intro="Le CD4015 contient deux registres à décalage de 4 bits à entrée série et sorties "
               "parallèles. Cascadés, ils forment un registre 8 bits, par exemple pour piloter des LED "
               "avec peu de fils ou retarder un signal de quelques coups d'horloge.",
         how="<p>À chaque front montant de CLK, la donnée D entre dans Q1 et chaque étage passe au "
             "suivant (Q1 → Q2 → Q3 → Q4). RST à 1 remet les quatre étages à 0.</p>",
         pd={"CLKA": "Horloge du registre A (front montant)", "CLKB": "Horloge du registre B (front montant)",
             "DA": "Entrée série du registre A", "DB": "Entrée série du registre B",
             "RSTA": "Remise à zéro du registre A (active haut)", "RSTB": "Remise à zéro du registre B (active haut)",
             "QAB": "Sortie de l'étage {n} du registre {x}"},
         sim=dict(name="sipo4", opts={}, title="décalage série → parallèle",
                  text="Un motif de bits entre sur DA ; à chaque front d'horloge il avance d'une LED.")),
    dict(ref="4021", cat="Registres", title="Registre à décalage 8 bits, chargement parallèle asynchrone", pins=PISO,
         draw=("block", "REGISTRE|8 BITS|PARALLÈLE|→ SÉRIE"),
         intro="Le CD4021 est un registre à décalage de 8 bits à chargement parallèle, au brochage "
               "identique au 4014. Son chargement est <strong>asynchrone</strong> : les entrées sont "
               "copiées dès que P/S̄ passe à 1, sans attendre l'horloge. C'est le circuit des manettes "
               "de console rétro.",
         how="<p>P/S̄ à 1 : les entrées P1-P8 sont recopiées immédiatement. P/S̄ à 0 : à chaque front "
             "montant de l'horloge, le contenu se décale vers Q8 et SER entre dans le premier étage. "
             "Seuls Q6, Q7 et Q8 sont accessibles.</p>",
         pd={"P/~S": "Mode : 1 = chargement parallèle (immédiat), 0 = décalage", "CLK": "Horloge (front montant)",
             "SER": "Entrée série (vers le premier étage)", "P*": "Entrée parallèle {n}", "Q*": "Sortie de l'étage {n}"},
         sim=dict(name="piso", opts=dict(sync=False), title="lecture de 8 interrupteurs",
                  text="Tant que P/S̄ vaut 1, le registre recopie les entrées P. Passez-le à 0 : les bits "
                       "sortent un par un sur Q8 à chaque front d'horloge.")),
    dict(ref="4094", cat="Registres", title="Registre à décalage 8 bits avec verrou et sorties 3 états",
         pins=["STR", "D", "CLK", "Q1", "Q2", "Q3", "Q4", "VSS", "QS", "Q'S", "Q8", "Q7", "Q6", "Q5", "OE", "VDD"],
         draw=("block", "REGISTRE|8 BITS|+ VERROU"),
         intro="Le CD4094 est un registre à décalage série → parallèle de 8 bits suivi d'un verrou : on "
               "envoie les données bit par bit, puis on les fait apparaître toutes ensemble sur les "
               "sorties. C'est l'équivalent CMOS du 74HC595, très utilisé pour piloter des LED ou des "
               "afficheurs avec trois fils.",
         how="<p>À chaque front montant de CLK, la donnée D entre dans le registre interne. Les sorties "
             "Q1-Q8 recopient le registre tant que STR (strobe) est à 1, et gardent leur valeur quand "
             "STR repasse à 0. OE à 0 met les sorties en haute impédance. QS et Q'S servent à cascader "
             "plusieurs 4094.</p>",
         pd={"STR": "Strobe : 1 = sorties transparentes, 0 = sorties mémorisées", "D": "Entrée série",
             "CLK": "Horloge (front montant)", "QS": "Sortie série (front montant, vers D du circuit suivant)",
             "Q'S": "Sortie série décalée d'un demi-cycle (front descendant)", "OE": "Validation des sorties (0 = haute impédance)",
             "Q*": "Sortie parallèle {n} (3 états)"},
         sim=dict(name="sr4094", opts={}, title="envoi de 8 bits vers des LED",
                  text="Un motif entre bit par bit dans le registre interne. Laissez STR à 0 et appuyez "
                       "sur « Impulsion STR » pour transférer d'un coup le registre sur les LED, ou "
                       "mettez STR à 1 pour voir les LED suivre le décalage.")),
    dict(ref="4016", cat="Analogique", title="4 interrupteurs analogiques bidirectionnels", pins=SW4,
         draw=("switches",),
         intro="Le CD4016 contient quatre interrupteurs électroniques commandés par un niveau "
               "logique. Chaque interrupteur laisse passer un signal analogique ou numérique dans les "
               "deux sens, à condition de rester entre VSS et VDD. Il a été remplacé par le 4066, au "
               "même brochage et à la résistance plus faible.",
         how="<p>CTL à 1 ferme l'interrupteur, CTL à 0 l'ouvre. Fermé, il présente une résistance Ron "
             "qui forme un diviseur de tension avec la charge : prévoir une charge d'au moins 10 kΩ.</p>",
         pd={"SW": "Borne de l'interrupteur {n} (entrée ou sortie)", "CTL": "Commande de l'interrupteur {n} (1 = fermé)"},
         extra_specs=[("Résistance à l'état fermé (Ron)", "≈ 1 kΩ à 5 V, quelques centaines d'Ω à 15 V (typ.)")],
         sim=dict(name="aswitch", opts=dict(ron=1000), title="commutation d'un signal analogique",
                  text="Un signal sinusoïdal entre sur la broche 1. CTL ferme ou ouvre l'interrupteur ; "
                       "avec Ron ≈ 1 kΩ, le signal transmis est un peu atténué selon la charge.")),
    dict(ref="4066", cat="Analogique", title="4 interrupteurs analogiques bidirectionnels (Ron faible)", pins=SW4,
         draw=("switches",),
         intro="Le CD4066 contient quatre interrupteurs analogiques bidirectionnels commandés par un "
               "niveau logique. Il remplace le 4016 avec une résistance à l'état fermé bien plus "
               "faible. On l'utilise pour aiguiller des signaux audio, simuler un appui sur un bouton "
               "ou multiplexer des capteurs.",
         how="<p>CTL à 1 ferme l'interrupteur, CTL à 0 l'ouvre. Le signal doit rester entre VSS et VDD ; "
             "il peut circuler dans les deux sens.</p>",
         pd={"SW": "Borne de l'interrupteur {n} (entrée ou sortie)", "CTL": "Commande de l'interrupteur {n} (1 = fermé)"},
         extra_specs=[("Résistance à l'état fermé (Ron)", "≈ 470 Ω à 5 V, 180 Ω à 10 V, 125 Ω à 15 V (typ.)")],
         sim=dict(name="aswitch", opts=dict(ron=470), title="commutation d'un signal analogique",
                  text="Un signal sinusoïdal entre sur la broche 1. CTL ferme ou ouvre l'interrupteur ; "
                       "la charge et Ron forment un diviseur de tension.")),
    dict(ref="4051", cat="Analogique", title="Multiplexeur / démultiplexeur analogique 8 voies",
         pins=["CH4", "CH6", "COM", "CH7", "CH5", "INH", "VEE", "VSS", "C", "B", "A", "CH3", "CH0", "CH1", "CH2", "VDD"],
         draw=("block", "MULTIPLEXEUR|ANALOGIQUE|8 → 1"),
         intro="Le CD4051 est un aiguillage analogique à 8 voies : selon l'adresse binaire C-B-A, une "
               "des huit entrées CH0-CH7 est reliée à la borne commune COM. Il permet de lire "
               "<strong>huit capteurs avec une seule entrée analogique</strong> d'un microcontrôleur, "
               "et fonctionne dans les deux sens.",
         how="<p>L'adresse CBA (0 à 7) choisit la voie reliée à COM. INH à 1 ouvre toutes les voies. "
             "VEE permet de commuter des signaux négatifs (alimentation symétrique) ; en simple "
             "alimentation on le relie à VSS.</p>",
         pd={"COM": "Borne commune (entrée ou sortie)", "INH": "Inhibition (1 = toutes les voies ouvertes)",
             "A": "Adresse, bit de poids 1", "B": "Adresse, bit de poids 2", "C": "Adresse, bit de poids 4",
             "CH*": "Voie {n} (reliée à COM quand CBA = {n})"},
         extra_specs=[("Résistance à l'état fermé (Ron)", "≈ 470 Ω à 5 V, 125 Ω à 15 V (typ.)")],
         sim=dict(name="amux", opts=dict(
             select=[["A", 11], ["B", 10], ["C", 9]],
             outputs=[dict(name="COM", pin=3, channels=[
                 dict(name="CH0", desc="sinus", sig="sine"), dict(name="CH1", desc="triangle", sig="tri"),
                 dict(name="CH2", desc="carré", sig="square"), dict(name="CH3", desc="scie", sig="saw"),
                 dict(name="CH4", desc="1 V", sig=1), dict(name="CH5", desc="2 V", sig=2),
                 dict(name="CH6", desc="3 V", sig=3), dict(name="CH7", desc="4 V", sig=4)])]),
             title="lecture de 8 signaux sur une seule sortie",
             text="Chaque voie reçoit un signal différent. L'adresse C-B-A (balayée automatiquement ou "
                  "réglée à la main) choisit celui qui apparaît sur COM.")),
    dict(ref="4052", cat="Analogique", title="2 multiplexeurs / démultiplexeurs analogiques 4 voies",
         pins=["Y0", "Y2", "YCOM", "Y3", "Y1", "INH", "VEE", "VSS", "B", "A", "X3", "X0", "XCOM", "X1", "X2", "VDD"],
         draw=("block", "MULTIPLEXEUR|ANALOGIQUE|2 × 4 → 1"),
         intro="Le CD4052 contient deux aiguillages analogiques à 4 voies (X et Y) commandés par la "
               "même adresse B-A. Il sert typiquement à choisir une source audio stéréo parmi quatre, "
               "ou à lire des paires de signaux.",
         how="<p>L'adresse BA (0 à 3) relie X0-X3 à XCOM et, en même temps, Y0-Y3 à YCOM. INH à 1 ouvre "
             "toutes les voies. VEE à VSS en simple alimentation.</p>",
         pd={"XCOM": "Borne commune X", "YCOM": "Borne commune Y", "INH": "Inhibition (1 = toutes les voies ouvertes)",
             "A": "Adresse, bit de poids 1", "B": "Adresse, bit de poids 2", "XY": "Voie {x}{n} (reliée à {x}COM quand BA = {n})"},
         extra_specs=[("Résistance à l'état fermé (Ron)", "≈ 470 Ω à 5 V, 125 Ω à 15 V (typ.)")],
         sim=dict(name="amux", opts=dict(
             select=[["A", 10], ["B", 9]],
             outputs=[dict(name="X COM", pin=13, channels=[
                 dict(name="X0", desc="sinus", sig="sine"), dict(name="X1", desc="triangle", sig="tri"),
                 dict(name="X2", desc="carré", sig="square"), dict(name="X3", desc="scie", sig="saw")]),
                 dict(name="Y COM", pin=3, channels=[
                     dict(name="Y0", desc="1 V", sig=1), dict(name="Y1", desc="2 V", sig=2),
                     dict(name="Y2", desc="3 V", sig=3), dict(name="Y3", desc="4 V", sig=4)])]),
             title="double aiguillage 4 voies",
             text="L'adresse B-A choisit à la fois une voie X (formes d'onde) et une voie Y (tensions "
                  "continues) : les deux sorties changent ensemble.")),
    dict(ref="4053", cat="Analogique", title="3 multiplexeurs / démultiplexeurs analogiques 2 voies",
         pins=["BY", "BX", "CY", "CCOM", "CX", "INH", "VEE", "VSS", "C", "B", "A", "AX", "AY", "ACOM", "BCOM", "VDD"],
         draw=("block", "3 × INVERSEUR|ANALOGIQUE|2 → 1"),
         intro="Le CD4053 contient trois inverseurs analogiques (commutateurs à deux positions) "
               "commandés séparément par A, B et C. C'est l'équivalent électronique de trois "
               "inverseurs mécaniques, pratique pour basculer un signal entre deux sources.",
         how="<p>A à 0 relie AX à ACOM, A à 1 relie AY à ACOM ; de même pour B et C. INH à 1 ouvre "
             "tout. VEE à VSS en simple alimentation.</p>",
         pd={"ACOM": "Borne commune du commutateur A", "BCOM": "Borne commune du commutateur B",
             "CCOM": "Borne commune du commutateur C", "INH": "Inhibition (1 = toutes les voies ouvertes)",
             "A": "Commande du commutateur A (0 = AX, 1 = AY)", "B": "Commande du commutateur B (0 = BX, 1 = BY)",
             "C": "Commande du commutateur C (0 = CX, 1 = CY)", "XYC": "Voie {y} du commutateur {x}"},
         extra_specs=[("Résistance à l'état fermé (Ron)", "≈ 470 Ω à 5 V, 125 Ω à 15 V (typ.)")],
         sim=dict(name="amux", opts=dict(
             select=[["A", 11], ["B", 10], ["C", 9]],
             outputs=[dict(name="A COM", pin=14, bit=0, channels=[
                 dict(name="AX", desc="sinus", sig="sine"), dict(name="AY", desc="carré", sig="square")]),
                 dict(name="B COM", pin=15, bit=1, channels=[
                     dict(name="BX", desc="triangle", sig="tri"), dict(name="BY", desc="1 V", sig=1)]),
                 dict(name="C COM", pin=4, bit=2, channels=[
                     dict(name="CX", desc="scie", sig="saw"), dict(name="CY", desc="4 V", sig=4)])]),
             title="trois commutateurs à deux positions",
             text="Chaque commande A, B, C bascule sa sortie commune entre deux signaux.")),
    dict(ref="4028", cat="Décodeurs", title="Décodeur BCD → décimal (1 parmi 10)",
         pins=["Q4", "Q2", "Q0", "Q7", "Q9", "Q5", "Q6", "VSS", "Q8", "A", "D", "C", "B", "Q1", "Q3", "VDD"],
         draw=("block", "DÉCODEUR|BCD|→ 1 PARMI 10"),
         intro="Le CD4028 transforme un nombre binaire de 4 bits (0 à 9) en dix sorties : seule la "
               "sortie correspondant au nombre passe à 1. Il sert à sélectionner un élément parmi dix "
               "à partir de quatre fils (LED, relais, afficheurs multiplexés).",
         how="<p>Les entrées D-C-B-A forment le nombre (A = poids 1, D = poids 8). Pour les codes 10 à "
             "15, aucune sortie n'est active. Utilisé en 3 bits (D = 0), il devient un décodeur 1 parmi 8.</p>",
         pd={"A": "Entrée BCD, poids 1", "B": "Entrée BCD, poids 2", "C": "Entrée BCD, poids 4", "D": "Entrée BCD, poids 8",
             "Q*": "Sortie {n} (à 1 quand DCBA = {n})"},
         sim=dict(name="bcd10", opts={}, title="sélection d'une LED parmi 10",
                  text="Les quatre interrupteurs forment le code BCD ; la LED du chiffre correspondant "
                       "s'allume. Au-delà de 9, tout s'éteint.")),
    dict(ref="4511", cat="Décodeurs", title="Décodeur BCD → 7 segments avec verrou",
         pins=["B", "C", "~LT", "~BL", "LE", "D", "A", "VSS", "e", "d", "c", "b", "a", "g", "f", "VDD"],
         draw=("block", "DÉCODEUR|BCD|→ 7 SEGMENTS"),
         intro="Le CD4511 convertit un chiffre BCD (4 bits) en commandes pour un afficheur 7 segments "
               "à <strong>cathode commune</strong>, avec un verrou qui mémorise l'affichage. Ses "
               "sorties fournissent jusqu'à 25 mA : une simple résistance par segment suffit.",
         how="<p><span class='over'>LT</span> à 0 allume tous les segments (test). <span class='over'>BL</span> à 0 éteint l'afficheur. LE à 0 : "
             "l'affichage suit les entrées ; LE à 1 : il garde le dernier chiffre. Les codes 10 à 15 "
             "éteignent l'afficheur. Le 6 et le 9 s'affichent sans barre de queue.</p>",
         pd={"A": "Entrée BCD, poids 1", "B": "Entrée BCD, poids 2", "C": "Entrée BCD, poids 4", "D": "Entrée BCD, poids 8",
             "~LT": "Test des segments (0 = tous allumés)", "~BL": "Extinction (0 = afficheur éteint)",
             "LE": "Verrou (1 = affichage mémorisé)", "SEG": "Sortie du segment {s}"},
         extra_specs=[("Courant de sortie", "jusqu'à 25 mA par segment en source (afficheur à cathode commune)")],
         sim=dict(name="bcd7", opts={}, title="afficheur 7 segments et 4 interrupteurs",
                  text="Les quatre interrupteurs A-B-C-D donnent le chiffre en binaire. Testez aussi <span class='over'>LT</span>, "
                       "<span class='over'>BL</span> et le verrou LE.")),
    dict(ref="4008", cat="Arithmétique", title="Additionneur complet 4 bits",
         pins=["A4", "B3", "A3", "B2", "A2", "B1", "A1", "VSS", "CI", "S1", "S2", "S3", "S4", "CO", "B4", "VDD"],
         draw=("block", "ADDITIONNEUR|4 BITS|Σ"),
         intro="Le CD4008 additionne deux nombres de 4 bits (A et B) et une retenue d'entrée : il "
               "donne une somme sur 4 bits et une retenue de sortie. En cascadant plusieurs 4008 "
               "(CO vers CI), on additionne des nombres de 8, 12, 16 bits…",
         how="<p>S = A + B + CI. Si le résultat dépasse 15, la retenue CO passe à 1. Le circuit dispose "
             "d'une retenue anticipée (fast carry) qui accélère la cascade.</p>",
         pd={"CI": "Retenue d'entrée", "CO": "Retenue de sortie", "A*": "Bit {n} du nombre A (poids 2^{m})",
             "B*": "Bit {n} du nombre B (poids 2^{m})", "S*": "Bit {n} de la somme (poids 2^{m})"},
         sim=dict(name="adder", opts={}, title="addition de deux nombres 4 bits",
                  text="Réglez A et B avec les interrupteurs : la somme apparaît sur les LED et en "
                       "décimal.")),
    dict(ref="4046", cat="Temporisation", title="Boucle à verrouillage de phase (PLL) avec VCO",
         pins=["PP", "PC1", "CIN", "VCO", "INH", "C1A", "C1B", "VSS", "VCOIN", "SF", "R1", "R2", "PC2", "SIN", "Z", "VDD"],
         draw=("block", "PLL|COMPARATEURS|DE PHASE|+ VCO"),
         intro="Le CD4046 est une boucle à verrouillage de phase : un oscillateur commandé en tension "
               "(VCO) et deux comparateurs de phase. Il « accroche » la fréquence d'un signal d'entrée "
               "et la recopie, ce qui permet la synthèse de fréquence, la démodulation FM ou la "
               "détection de tonalité. Son VCO seul est aussi un bon générateur de fréquence "
               "réglable.",
         how="<p>Le comparateur de phase compare SIGIN au retour COMPIN (souvent la sortie du VCO, "
             "éventuellement divisée). Sa sortie, filtrée par un réseau RC, donne la tension VCOIN qui "
             "règle la fréquence du VCO. R1, R2 et C1 fixent la plage du VCO. PC2 verrouille sans "
             "erreur de phase ; PP (broche 1) indique le verrouillage.</p>",
         pd={"PP": "Impulsions du comparateur 2 (indicateur de verrouillage)", "PC1": "Sortie du comparateur de phase 1 (OU exclusif)",
             "CIN": "Entrée du comparateur (retour du VCO)", "VCO": "Sortie du VCO", "INH": "Inhibition (1 = VCO arrêté)",
             "C1A": "Condensateur C1 du VCO", "C1B": "Condensateur C1 du VCO", "VCOIN": "Entrée de commande du VCO",
             "SF": "Sortie du suiveur (démodulateur)", "R1": "Résistance R1 (fréquence max du VCO)",
             "R2": "Résistance R2 (fréquence min du VCO)", "PC2": "Sortie du comparateur de phase 2 (3 états)",
             "SIN": "Entrée du signal", "Z": "Diode Zener interne (référence 5,2 V)"},
         extra_specs=[("Fréquence max du VCO", "≈ 1 MHz à 10 V (typ.)")],
         sim=dict(name="pll", opts={}, title="accrochage sur un signal d'entrée",
                  text="Faites varier la fréquence d'entrée : tant qu'elle reste dans la plage du VCO, la "
                       "boucle la suit et les deux signaux restent en phase. Hors plage, le VCO bute en "
                       "butée et les signaux glissent l'un par rapport à l'autre.")),
    dict(ref="4047", cat="Temporisation", title="Multivibrateur monostable / astable",
         pins=["C", "R", "RC", "~AST", "AST", "-TR", "VSS", "+TR", "RST", "Q", "~Q", "RTR", "OSC", "VDD"],
         draw=("block", "MULTI-|VIBRATEUR|ASTABLE /|MONOSTABLE"),
         intro="Le CD4047 est un multivibrateur qui fonctionne en <strong>astable</strong> (oscillateur "
               "à rapport cyclique 50 %, sorties Q et Q̄ complémentaires) ou en <strong>monostable</strong> "
               "(impulsion de durée fixe). Ses deux sorties en opposition en font un pilote idéal pour "
               "un petit convertisseur push-pull.",
         how="<p>Une résistance R entre les broches 2 et 3 et un condensateur C entre les broches 1 et 3 "
             "fixent le temps. En astable (broche 5 à 1, broche 4 à 0), Q et Q̄ oscillent à "
             "f = 1 / (4,4·R·C) et la broche 13 sort le double de cette fréquence. En monostable, un "
             "front sur +TR ou −TR produit une impulsion de durée ≈ 2,48·R·C.</p>",
         pd={"C": "Condensateur de temporisation", "R": "Résistance de temporisation", "RC": "Point commun R-C",
             "~AST": "Astable, entrée active basse", "AST": "Astable, entrée active haute", "-TR": "Déclenchement sur front descendant",
             "+TR": "Déclenchement sur front montant", "RST": "Remise à zéro externe (active haut)",
             "Q": "Sortie Q", "~Q": "Sortie Q̄", "RTR": "Redéclenchement", "OSC": "Sortie de l'oscillateur (2·f)"},
         sim=dict(name="astable4047", opts={}, title="oscillateur astable",
                  text="Choisissez R et C : la fréquence de Q vaut 1 / (4,4·R·C). Q et Q̄ sont en "
                       "opposition, la sortie OSC oscille deux fois plus vite.")),
    dict(ref="4538", cat="Temporisation", title="2 monostables de précision redéclenchables",
         pins=["CX1", "RC1", "~R1", "+T1", "-T1", "Q1", "~Q1", "VSS", "~Q2", "Q2", "-T2", "+T2", "~R2", "RC2", "CX2", "VDD"],
         draw=("block2", "MONO-|STABLE 1", "MONO-|STABLE 2"),
         intro="Le CD4538 contient deux monostables de précision : un front sur l'entrée de "
               "déclenchement produit une impulsion de durée T = Rx·Cx, stable en tension et en "
               "température. Redéclenchable, il sert de minuterie, de détecteur d'absence "
               "d'impulsions ou d'anti-rebond.",
         how="<p>Rx relie RC à VDD, Cx est placé entre CX et RC. Un front montant sur +TR (avec −TR à 1) "
             "ou un front descendant sur −TR (avec +TR à 0) déclenche l'impulsion. Un nouveau front "
             "pendant l'impulsion la relance. R̄ à 0 l'interrompt.</p>",
         pd={"CX1": "Condensateur Cx du monostable 1 (relié à VSS)", "RC1": "Point commun Rx-Cx du monostable 1",
             "~R1": "Remise à zéro du monostable 1 (active basse)", "+T1": "Déclenchement du monostable 1 (front montant)",
             "-T1": "Déclenchement du monostable 1 (front descendant)", "Q1": "Sortie Q du monostable 1", "~Q1": "Sortie Q̄ du monostable 1",
             "CX2": "Condensateur Cx du monostable 2 (relié à VSS)", "RC2": "Point commun Rx-Cx du monostable 2",
             "~R2": "Remise à zéro du monostable 2 (active basse)", "+T2": "Déclenchement du monostable 2 (front montant)",
             "-T2": "Déclenchement du monostable 2 (front descendant)", "Q2": "Sortie Q du monostable 2", "~Q2": "Sortie Q̄ du monostable 2"},
         extra_specs=[("Durée de l'impulsion", "T = Rx·Cx (de quelques µs à plusieurs secondes)")],
         sim=dict(name="mono4538", opts={}, title="minuterie redéclenchable",
                  text="Appuyez sur le bouton de déclenchement : la sortie Q reste à 1 pendant T = Rx·Cx. "
                       "Un nouvel appui pendant l'impulsion la prolonge.")),
]

# Équivalents 74HC au même brochage (familles HC rapides, alimentation 2 à 6 V)
HC_EQUIV = {"4002", "4017", "4020", "4024", "4040", "4046", "4049", "4050", "4051", "4052", "4053",
            "4060", "4066", "4016", "4075", "4094", "4511", "4518", "4520", "4538"}
