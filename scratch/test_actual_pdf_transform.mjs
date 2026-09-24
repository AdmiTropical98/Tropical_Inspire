import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
const pdfPath = 'C:/Users/mglma/.gemini/antigravity/brain/6525f70e-92c4-49f5-873e-d57f4c7b3af8/.user_uploaded/media__1785845046862.pdf';
async function run() {
    global.DOMMatrix = class DOMMatrix {};
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    for (let i = 0; i < 20; i++) {
        console.log(textContent.items[i].str, textContent.items[i].transform);
    }
}
run().catch(console.error);
