"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, QrCode, Loader2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

interface QRCodeDisplayProps {
  data: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  title: string;
  open: boolean;
}

export function QRCodeDisplay({ data, title, open, onClose }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data) {
      setError(null);
      setIsGenerating(false);
      return;
    }

    const generateQR = async () => {
      if (!canvasRef.current) return;

      try {
        console.log('[QRCodeDisplay] Starting QR generation for data length:', data.length);
        setIsGenerating(true);
        setError(null);

        await QRCode.toCanvas(canvasRef.current, data, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });

        console.log('[QRCodeDisplay] QR code generated successfully');

      } catch (err: any) {
        console.error('[QRCodeDisplay] Failed to generate QR code:', err);
        setError(`Failed to generate QR code: ${err.message}`);
      } finally {
        setIsGenerating(false);
      }
    };

    const timer = setTimeout(generateQR, 100);
    return () => clearTimeout(timer);
  }, [data, open]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setIsGenerating(false);
    }
  }, [open]);

  const handleRetry = () => {
    setError(null);
    setIsGenerating(true);

    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      }).then(() => {
        console.log('[QRCodeDisplay] QR code regenerated successfully');
        setIsGenerating(false);
      }).catch((err) => {
        console.error('[QRCodeDisplay] Failed to regenerate QR code:', err);
        setError(`Failed to generate QR code: ${err.message}`);
        setIsGenerating(false);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-[300px] w-[300px] border-2 border-dashed border-gray-300 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-fuchsia-600 mb-2" />
              <p className="text-sm text-gray-600">Generating QR code...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[300px] w-[300px] border-2 border-dashed border-red-300 rounded-lg">
              <AlertCircle className="h-7 w-7 text-red-600 mb-2" />
              <p className="text-sm text-red-600 text-center px-4">{error}</p>
              <Button
                onClick={handleRetry}
                className="mt-2"
                size="sm"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <canvas ref={canvasRef} className="max-w-48 max-h-52" />
            </div>
          )}

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Show this QR code to the other device
            </p>
            <p className="text-xs text-gray-500">
              Keep this dialog open until the other device scans the code
            </p>
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QRCodeScanner({ onScan, onClose, title, open }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      requestCameraPermission();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open]);

  const requestCameraPermission = async () => {
    try {
      setError(null);
      setPermissionGranted(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setPermissionGranted(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsScanning(true);

        videoRef.current.onloadedmetadata = () => {
          startScanning();
        };
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setPermissionGranted(false);

      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application.');
      } else {
        setError('Failed to access camera. Please try again.');
      }
    }
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            console.log('QR Code detected:', code.data);
            stopScanning();
            onScan(code.data);
            return;
          }
        } catch (err) {
          console.error('QR scanning error:', err);
        }
      }
    };

    scanIntervalRef.current = setInterval(scan, 300);
  };

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    setIsScanning(false);
    setPermissionGranted(null);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  const handleRetry = () => {
    setError(null);
    requestCameraPermission();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          {permissionGranted === false || error ? (
            <div className="flex flex-col items-center justify-center h-[300px] w-full border-2 border-dashed border-red-300 rounded-lg">
              <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
              <p className="text-sm text-red-600 text-center px-4">{error}</p>
              <Button
                onClick={handleRetry}
                className="mt-4"
                size="sm"
              >
                <Camera className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : permissionGranted === null ? (
            <div className="flex flex-col items-center justify-center h-[300px] w-full border-2 border-dashed border-gray-300 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm text-gray-600">Requesting camera access...</p>
            </div>
          ) : (
            <div className="relative w-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-w-sm rounded-lg mx-auto"
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />

              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-48 h-48 border-2 border-blue-500 rounded-lg">
                    
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-blue-500 rounded-tl"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-blue-500 rounded-tr"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-blue-500 rounded-bl"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-blue-500 rounded-br"></div>
                  </div>
                </div>
              </div>

              {isScanning && (
                <div className="absolute bottom-4 left-0 right-0">
                  <div className="bg-black bg-opacity-75 text-white text-xs px-3 py-2 rounded mx-auto w-fit">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Scanning for QR code...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Point your camera at the QR code to scan
            </p>
            <p className="text-xs text-gray-500">
              Make sure the QR code is clearly visible and well-lit
            </p>
          </div>

          <Button onClick={handleClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}