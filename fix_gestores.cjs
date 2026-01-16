const fs = require('fs');
const path = 'src/components/gestores/index.tsx';
try {
    const content = fs.readFileSync(path, 'utf8');
    // Detect line ending
    const isCRLF = content.includes('\r\n');
    const separator = isCRLF ? '\r\n' : '\n';
    
    const lines = content.split(separator);
    
    // We want to delete lines 142 to 181 (1-based)
    // Indices (0-based): 141 to 180
    
    const newLines = lines.filter((_, index) => index < 141 || index > 180);
    
    fs.writeFileSync(path, newLines.join(separator));
    console.log(`Successfully removed lines 142-181. New line count: ${newLines.length}`);
} catch (error) {
    console.error('Error fixing file:', error);
    process.exit(1);
}
