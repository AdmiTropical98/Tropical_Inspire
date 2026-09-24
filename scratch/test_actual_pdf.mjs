import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
const pdfPath = 'C:/Users/mglma/.gemini/antigravity/brain/6525f70e-92c4-49f5-873e-d57f4c7b3af8/.user_uploaded/media__1785845046862.pdf';

async function run() {
    global.DOMMatrix = class DOMMatrix {};
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    
    let compact = '';
    const lines = [];

    const Y_BUCKET = 1;
    
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        
        const buckets = new Map();
        for (const raw of textContent.items) {
            const text = raw.str?.trim();
            if (!text) continue;
            
            compact += text + ' ';
            const x = raw.transform[4];
            const y = Math.round(raw.transform[5] / Y_BUCKET) * Y_BUCKET;
            
            if (!buckets.has(y)) buckets.set(y, []);
            buckets.get(y).push({ x, text });
        }
        
        const sortedYs = [...buckets.keys()].sort((a, b) => b - a);
        for (const y of sortedYs) {
            const tokens = buckets.get(y).sort((a, b) => a.x - b.x).map(i => i.text).filter(t => t.length > 0);
            if (tokens.length > 0) lines.push(tokens);
        }
    }
    
    fs.writeFileSync('scratch/pdf_dump_compact.txt', compact);
    fs.writeFileSync('scratch/pdf_dump_lines.json', JSON.stringify(lines, null, 2));
    console.log('Dump completed');
}

run().catch(console.error);
