#!/bin/bash
# Oakdene Original Asset Archiver
# Run this after saving any new high-res images from Gemini or other sources

SOURCE_DIRS=(
  "$HOME/Desktop/Oakdene House/Website Images/Photography/Oakdene tree"
  "$HOME/Desktop/Oakdene House/Website Images/Photography"
  "$HOME/Desktop"
)

DEST="$HOME/Developer/oakdene-website/assets-original"

for DIR in "${SOURCE_DIRS[@]}"; do
  if [ -d "$DIR" ]; then
    find "$DIR" -maxdepth 1 \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -exec cp -n {} "$DEST/" \;
  fi
done

echo "Archive complete. Files saved to $DEST"
ls "$DEST"
