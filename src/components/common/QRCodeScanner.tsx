import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { X, ScanLine } from 'lucide-react';
import { createPortal } from 'react-dom';

interface QRCodeScannerProps {
    onScan: (data: string) => void;
    onCancel: () => void;
}

export default function QRCodeScanner({ onScan, onCancel }: QRCodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string>('');
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const startScanner = async () => {
            try {
                scannerRef.current = new Html5Qrcode("reader");
                
                await scannerRef.current.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING && isMounted) {
                            setIsScanning(false);
                            scannerRef.current.pause();
                            // Optional vibration on success
                            if (navigator.vibrate) navigator.vibrate(200);
                            onScan(decodedText);
                        }
                    },
                    () => {
                        // Ignore periodic scan errors
                    }
                );
            } catch (err) {
                console.error("Error starting scanner:", err);
                if (isMounted) setError("Não foi possível iniciar a câmara. Verifique as permissões de acesso.");
            }
        };

        // Delay to allow DOM render of the #reader element
        const timeoutId = setTimeout(() => {
            startScanner();
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (scannerRef.current) {
                if (scannerRef.current.getState() !== Html5QrcodeScannerState.NOT_STARTED) {
                    scannerRef.current.stop().catch(console.error);
                }
            }
        };
    }, [onScan]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 pb-safe">
            <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-md pt-safe z-10 absolute top-0 w-full">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-blue-400" /> 
                    Ler QR Code da Fatura
                </h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center relative w-full bg-black">
                {error ? (
                    <div className="text-red-400 text-center p-6 bg-slate-900 rounded-xl m-4 w-11/12 max-w-sm">
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        <div id="reader" className="w-full max-w-lg mx-auto bg-black overflow-hidden h-full"></div>
                        
                        {/* Overlay text */}
                        <div className="absolute bottom-10 left-0 right-0 pointer-events-none flex justify-center pb-safe">
                            <p className="text-white text-center max-w-xs px-6 py-3 bg-black/60 rounded-full backdrop-blur-md font-medium shadow-lg border border-white/10">
                                {isScanning ? "Aponte a câmara para o QR Code (ATCUD)" : "Código lido com sucesso!"}
                            </p>
                        </div>
                        
                        {/* CSS to make html5-qrcode look better */}
                        <style>{`
                            #reader { border: none !important; }
                            #reader video { object-fit: cover; }
                            #reader img { display: none !important; }
                            #qr-shaded-region { border-color: rgba(0,0,0,0.7) !important; }
                            #qr-shaded-region div { border-color: #3b82f6 !important; border-width: 3px !important; }
                        `}</style>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
