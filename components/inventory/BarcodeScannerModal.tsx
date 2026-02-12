import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { X } from 'lucide-react';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ open, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserMultiFormatReader();
    let active = true;
    let controls: IScannerControls | null = null;

    const startScanner = async () => {
      try {
        const devices: MediaDeviceInfo[] = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!active) return;
        const deviceId = devices?.[0]?.deviceId;
        if (!videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (result?.getText()) {
            onDetected(result.getText());
            if (navigator.vibrate) navigator.vibrate(100);
          }
          if (err && err.name !== 'NotFoundException') {
            setError('Não foi possível ler o código.');
          }
        });
      } catch {
        setError('Câmera indisponível.');
      }
    };

    startScanner();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [open, onDetected]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Modo Scanner</h3>
            <p className="text-sm text-gray-500">Aproxime o código de barras da câmera ou use o scanner USB.</p>
          </div>
          <button className="rounded-full p-2 hover:bg-gray-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="rounded-xl bg-gray-900 p-2">
            <video ref={videoRef} className="h-60 w-full rounded-lg object-cover" />
            {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
          </div>
          <div className="space-y-3">
            <label className="text-xs font-medium text-gray-600">Scanner USB (keyboard wedge)</label>
            <input
              ref={inputRef}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              placeholder="Aponte o leitor e pressione Enter"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && manualCode.trim()) {
                  onDetected(manualCode.trim());
                  setManualCode('');
                }
              }}
            />
            <p className="text-xs text-gray-500">
              Dica: mantenha este campo focado para leitura rápida com leitores USB/Bluetooth.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
