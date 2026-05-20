# Para usar apple-touch-icon.png como ícone do instalador e do executável:
# 1. Converter PNG para ICO (Windows exige .ico para executáveis)
# 2. Substituir exeicon.ico pelo novo ícone
# 3. Rodar o script set-exe-icon.cjs após build

# Exemplo de comando PowerShell para converter:
# (Requer ImageMagick instalado)
# magick convert apple-touch-icon.png -resize 256x256 -define icon:auto-resize=64,48,32,16 exeicon.ico

# Após gerar exeicon.ico, copie para:
# - build/exeicon.ico
# - build/installer/exeicon.ico

# Depois, execute:
# node scripts/set-exe-icon.cjs

# Isso garantirá que o instalador e o executável usem o novo ícone.
