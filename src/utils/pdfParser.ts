import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - essential for Vite
// Note: This relies on the bundler to handle the worker file. 
// If this fails in production, we might need to copy the worker to public/ or use a CDN.
// For now, we try the standard ESM import way.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface CartrackTrip {
    matricula: string;
    date: string; // YYYY/MM/DD
    weekday: string;
    startTime: string; // HH:MM:SS
    endTime: string; // HH:MM:SS
    duration: string;
}

export const parseCartrackD103 = async (file: File): Promise<CartrackTrip[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const trips: CartrackTrip[] = [];

    // Regex to match the trip line
    // Example: 62-ZZ-82 2026/01/02 Sexta-Feira 06:11:45 06:12:52
    // Parts:
    // 1. Plate: XX-XX-XX
    // 2. Date: YYYY/MM/DD
    // 3. Weekday: Words (Sexta-Feira, Sábado, etc)
    // 4. Start: HH:MM:SS
    // 5. End: HH:MM:SS

    const tripLineRegex = /(\d{2}-[A-Z0-9]{2}-\d{2})\s+(\d{4}\/\d{2}\/\d{2})\s+([a-zA-ZçãáàéêíóôúÇÃÁÀÉÊÍÓÔÚ-]+)\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2})/;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Simple extraction: join all items with space
        // Note: Sometimes items are separate, sometimes grouped. Space joining is usually safe for this layout.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        // Split by likely newlines if the join merged them, OR just scan the whole text? 
        // PDF text extraction often loses newlines purely. 
        // Cartrack reports are usually table rows.
        // Let's try splitting by Plate pattern look-ahead if possible or just extracting all matches.

        // We can just iterate matches in the specific string.
        // But let's use a global regex match
        const globalRegex = new RegExp(tripLineRegex, 'g');

        const matches = [...pageText.matchAll(globalRegex)];

        for (const m of matches) {
            trips.push({
                matricula: m[1],
                date: m[2],
                weekday: m[3],
                startTime: m[4],
                endTime: m[5],
                duration: 'Calculated Later' // We can calc diff if needed, but PDF has a col too
            });
        }
    }

    console.log(`Parsed ${trips.length} trips from PDF`);
    return trips;
};
