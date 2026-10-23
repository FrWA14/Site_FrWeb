#!/bin/bash
#
# generate-navigation.sh
#
# Genere automatiquement le fichier navigation.json a partir de l'arborescence
# du dossier pages/. Equivalent bash de generate-navigation.ps1.
#
# Usage:
#   ./generate-navigation.sh
#
# Notes:
#   - Les dossiers/fichiers "assets", "images", "img", "css", "js", "template"
#     et tout ce qui commence par "_" ou "." sont ignores
#   - Seuls les fichiers .html / .htm sont references
#   - Tri: index.html en premier, puis les autres fichiers, puis les dossiers
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES_DIR="$SCRIPT_DIR/pages"
OUTPUT_FILE="$SCRIPT_DIR/navigation.json"

# Motifs a exclure (noms de fichiers/dossiers)
EXCLUDE_PATTERNS=("assets" "images" "img" "css" "js" "template" "_*" ".*")


# Couleurs
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  FrWA - Generateur de Navigation${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ ! -d "$PAGES_DIR" ]; then
    echo -e "${RED}[ERREUR] Le dossier 'pages/' n'existe pas!${NC}"
    echo -e "${YELLOW}Creez le dossier et ajoutez vos pages HTML.${NC}"
    exit 1
fi

echo -e "${GRAY}[INFO] Scan du dossier: $PAGES_DIR${NC}"

# ----------------------------------------------------------------------------
# Verifie si un nom doit etre exclu (motifs avec * supportes via case)
# ----------------------------------------------------------------------------
should_exclude() {
    local name="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        case "$name" in
            $pattern) return 0 ;;
        esac
    done
    return 1
}

# ----------------------------------------------------------------------------
# Convertit un nom de fichier/dossier en libelle affichable
# ex: "ne555_astable" -> "Ne555 Astable"
#     "NE555_astable.html" -> "NE555 Astable" (reference en majuscules conservee)
#     "Plantation_autonome.html" -> "Plantation Autonome"
# ----------------------------------------------------------------------------
to_display_name() {
    local name="$1"
    # Retire l'extension
    name="${name%.*}"
    # Remplace - et _ par des espaces
    name="${name//[-_]/ }"

    local result=""
    for word in $name; do
        if [ -n "$word" ]; then
            # Reference de composant deja en majuscules (NE555, LM311) : gardee telle quelle
            if [[ "$word" =~ ^[A-Z0-9]+$ && "$word" =~ [A-Z] && "$word" =~ [0-9] ]]; then
                result="${result:+$result }$word"
                continue
            fi
            local first="${word:0:1}"
            local rest="${word:1}"
            first="$(echo "$first" | tr '[:lower:]' '[:upper:]')"
            rest="$(echo "$rest" | tr '[:upper:]' '[:lower:]')"
            if [ -n "$result" ]; then
                result="$result $first$rest"
            else
                result="$first$rest"
            fi
        fi
    done

    echo "$result"
}

# ----------------------------------------------------------------------------
# Echappe une chaine pour l'inclure dans du JSON
# ----------------------------------------------------------------------------
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    echo "$s"
}

# ----------------------------------------------------------------------------
# Construit recursivement le JSON de l'arborescence d'un dossier
# Affiche un tableau JSON (ou tableau vide "[]") sur stdout
#
# Arguments:
#   $1 = chemin physique du dossier a scanner
#   $2 = chemin relatif (depuis pages/) pour construire "path"
#   $3 = indentation pour l'affichage console de l'arborescence
# ----------------------------------------------------------------------------
build_tree() {
    local dir="$1"
    local rel_path="$2"
    local console_indent="$3"

    # --- Tri : index.html, puis fichiers (alpha), puis dossiers (alpha) ---
    local index_entry=""
    local file_entries=()
    local folder_entries=()

    while IFS= read -r -d '' entry; do
        local name
        name="$(basename "$entry")"

        if should_exclude "$name"; then
            continue
        fi

        if [ -d "$entry" ]; then
            folder_entries+=("$name")
        else
            case "$name" in
                *.html|*.htm|*.HTML|*.HTM) ;;
                *) continue ;;
            esac

            if [ "$name" = "index.html" ]; then
                index_entry="$name"
            else
                file_entries+=("$name")
            fi
        fi
    done < <(find "$dir" -mindepth 1 -maxdepth 1 -print0 | sort -z)

    # Tri alphabetique des tableaux
    IFS=$'\n' file_entries=($(printf '%s\n' "${file_entries[@]:-}" | sort)); unset IFS
    IFS=$'\n' folder_entries=($(printf '%s\n' "${folder_entries[@]:-}" | sort)); unset IFS

    local ordered_names=()
    [ -n "$index_entry" ] && ordered_names+=("$index_entry")
    for f in "${file_entries[@]:-}"; do
        [ -n "$f" ] && ordered_names+=("$f")
    done
    for f in "${folder_entries[@]:-}"; do
        [ -n "$f" ] && ordered_names+=("$f")
    done

    local items_json=()

    for name in "${ordered_names[@]:-}"; do
        [ -z "$name" ] && continue

        local full_path="$dir/$name"
        local child_rel
        if [ -n "$rel_path" ]; then
            child_rel="$rel_path/$name"
        else
            child_rel="$name"
        fi
        local full_rel_path="pages/$child_rel"
        local display_name
        display_name="$(to_display_name "$name")"

        if [ -d "$full_path" ]; then
            local sub_json
            sub_json="$(build_tree "$full_path" "$child_rel" "  $console_indent")"

            # N'inclut le dossier que s'il contient au moins un element
            if [ "$sub_json" != "[]" ]; then
                echo -e "${console_indent}+ ${CYAN}${display_name}/${NC}" >&2

                local item
                item=$(cat <<EOF
{
  "name": "$(json_escape "$name")",
  "displayName": "$(json_escape "$display_name")",
  "path": "$(json_escape "$full_rel_path")",
  "type": "folder",
  "children": $sub_json
}
EOF
)
                items_json+=("$item")
            fi
        else
            echo -e "${console_indent}- ${WHITE}${display_name}${NC}" >&2

            local item
            item=$(cat <<EOF
{
  "name": "$(json_escape "$name")",
  "displayName": "$(json_escape "$display_name")",
  "path": "$(json_escape "$full_rel_path")",
  "type": "file"
}
EOF
)
            items_json+=("$item")
        fi
    done

    if [ "${#items_json[@]}" -eq 0 ]; then
        echo "[]"
    else
        local result="["
        local first=1
        for item in "${items_json[@]}"; do
            if [ $first -eq 1 ]; then
                first=0
            else
                result="$result,"
            fi
            result="$result
$item"
        done
        result="$result
]"
        echo "$result"
    fi
}

# === MAIN ===

echo -e "${YELLOW}Arborescence generee:${NC}" >&2
echo -e "${YELLOW}----------------------${NC}" >&2

TREE_JSON="$(build_tree "$PAGES_DIR" "" "")"

echo -e "${YELLOW}----------------------${NC}" >&2

GENERATED_DATE="$(date '+%Y-%m-%d %H:%M:%S')"

{
    echo "{"
    echo "  \"generated\": \"$GENERATED_DATE\","
    echo "  \"children\": $TREE_JSON"
    echo "}"
} > "$OUTPUT_FILE"

FILE_COUNT="$(grep -c '"type": "file"' "$OUTPUT_FILE" || true)"
FOLDER_COUNT="$(grep -c '"type": "folder"' "$OUTPUT_FILE" || true)"

echo ""
echo -e "${GRAY}[INFO] Trouve: $FILE_COUNT pages, $FOLDER_COUNT dossiers${NC}"
echo ""
echo -e "${GREEN}[OK] Fichier genere: $OUTPUT_FILE${NC}"
echo ""
echo -e "${GREEN}Termine! Rafraichissez votre navigateur.${NC}"
echo ""
