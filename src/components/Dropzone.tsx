import React, { useState, useRef, useEffect } from 'react';
import { Upload, ImageIcon, FileUp, Clipboard, ShieldCheck } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function Dropzone({ onFilesSelected }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste event handler for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            // Give pasted file a descriptive name
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const renamedFile = new File([file], `Pasted-Image-${timestamp}.png`, {
              type: file.type,
            });
            imageFiles.push(renamedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onFilesSelected]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        files.push(e.target.files[i]);
      }
      onFilesSelected(files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  /**
   * Generates a high-quality synthetic canvas image dynamically for testing,
   * completely offline-first, avoiding slow or unreliable external URLs.
   */
  const handleLoadSample = (type: 'passport' | 'scenic' | 'logo') => {
    const canvas = document.createElement('canvas');
    let filename = '';
    let fileType = 'image/jpeg';

    if (type === 'passport') {
      // 600x600 biometric passport style image
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d')!;
      
      // Light grey uniform background (biometric passport standard)
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 600, 600);
      
      // Draw grid lines to simulate biometric scanning bounds (educational)
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 50; i < 600; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 600);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(600, i);
        ctx.stroke();
      }

      // Draw standard 2x2 passport visual guidelines
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(300, 270, 110, 0, Math.PI * 2); // head area
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw simplified biometric portrait outline
      // Hair/Head
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(300, 270, 100, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.arc(300, 285, 80, 0, Math.PI * 2);
      ctx.fill();

      // Shoulder body
      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.ellipse(300, 480, 140, 110, 0, 0, Math.PI, true);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(270, 275, 8, 0, Math.PI * 2);
      ctx.arc(330, 275, 8, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(300, 315, 20, 0.1, Math.PI - 0.1);
      ctx.stroke();

      // Educational biometric stamps
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('BIOMETRIC COMPLIANT', 30, 50);
      ctx.fillText('STANDARD: 2" x 2" (600x600px)', 30, 70);

      // Passport watermark stamp
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.1)';
      ctx.font = '900 64px sans-serif';
      ctx.strokeText('PASSPORT', 130, 320);

      filename = 'biometric-passport-photo.jpg';
      fileType = 'image/jpeg';
    } 
    else if (type === 'scenic') {
      // 4000x3000 ultra scenic photo (heavy 12 Megapixel photo to test large-file compression)
      canvas.width = 4000;
      canvas.height = 3000;
      const ctx = canvas.getContext('2d')!;

      // Beautiful sky-to-lake gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 2000);
      skyGrad.addColorStop(0, '#0f172a'); // night slate
      skyGrad.addColorStop(0.3, '#312e81'); // deep royal
      skyGrad.addColorStop(0.6, '#4f46e5'); // indigo
      skyGrad.addColorStop(0.8, '#ffedd5'); // peach horizon
      skyGrad.addColorStop(1, '#fda4af'); // rose sunrise
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 4000, 3000);

      // Draw a glowing sun
      const sunGrad = ctx.createRadialGradient(2000, 1900, 20, 2000, 1900, 300);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.3, '#fef08a');
      sunGrad.addColorStop(0.8, 'rgba(251, 146, 60, 0.4)');
      sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(2000, 1900, 300, 0, Math.PI * 2);
      ctx.fill();

      // Mountains silhouette
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(0, 2200);
      ctx.lineTo(800, 1300);
      ctx.lineTo(1500, 1800);
      ctx.lineTo(2400, 1100);
      ctx.lineTo(3200, 1700);
      ctx.lineTo(4000, 2100);
      ctx.lineTo(4000, 3000);
      ctx.lineTo(0, 3000);
      ctx.closePath();
      ctx.fill();

      // Mountain snow caps
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(800, 1300);
      ctx.lineTo(650, 1470);
      ctx.lineTo(950, 1470);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(2400, 1100);
      ctx.lineTo(2200, 1350);
      ctx.lineTo(2600, 1350);
      ctx.closePath();
      ctx.fill();

      // Adding some high-frequency scenery textures (grass, trees)
      ctx.fillStyle = '#0f172a';
      for (let i = 0; i < 4000; i += 120) {
        ctx.beginPath();
        ctx.moveTo(i, 3000);
        ctx.lineTo(i + 40, 2600);
        ctx.lineTo(i + 80, 3000);
        ctx.fill();
      }

      // Title overlay to see text resolution
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 120px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUNRISE IN THE ALPS (4K ULTRA)', 2000, 500);
      ctx.font = '50px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Ideal for testing high-resolution lossy JPEG compression', 2000, 620);

      filename = 'alps-4k-scenic.jpg';
      fileType = 'image/jpeg';
    } 
    else if (type === 'logo') {
      // 1200x800 modern transparent vector chart diagram (to test lossless PNG transparency and text sharpness)
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d')!;

      // Notice we do NOT fillRect with background, making it TRANSPARENT!
      // Draw grid lines to visually indicate transparency checkers
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 40; i < 1200; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 800);
        ctx.stroke();
      }
      for (let i = 40; i < 800; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(1200, i);
        ctx.stroke();
      }

      // Draw beautiful neon translucent circular diagrams
      const ringGrad1 = ctx.createRadialGradient(400, 400, 50, 400, 400, 250);
      ringGrad1.addColorStop(0, 'rgba(16, 185, 129, 0.6)'); // emerald transparent
      ringGrad1.addColorStop(0.5, 'rgba(16, 185, 129, 0.2)');
      ringGrad1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = ringGrad1;
      ctx.beginPath();
      ctx.arc(400, 400, 250, 0, Math.PI * 2);
      ctx.fill();

      const ringGrad2 = ctx.createRadialGradient(800, 400, 50, 800, 400, 250);
      ringGrad2.addColorStop(0, 'rgba(79, 70, 229, 0.6)'); // indigo transparent
      ringGrad2.addColorStop(0.5, 'rgba(79, 70, 229, 0.2)');
      ringGrad2.addColorStop(1, 'rgba(79, 70, 229, 0)');
      ctx.fillStyle = ringGrad2;
      ctx.beginPath();
      ctx.arc(800, 400, 250, 0, Math.PI * 2);
      ctx.fill();

      // Draw crisp vector-like connector shapes (bezier curves)
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(200, 400);
      ctx.bezierCurveTo(400, 150, 800, 650, 1000, 400);
      ctx.stroke();

      // Text elements (extremely crisp borders to test compression artifact sharpness)
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INFOGRAPHIC TEMPLATE', 600, 180);

      ctx.fillStyle = '#475569';
      ctx.font = '24px monospace';
      ctx.fillText('Format test: Transparent PNG (Lossless Vector Quality)', 600, 240);

      // Node circles
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(400, 310, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.arc(800, 490, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      filename = 'transparent-infographic-diagram.png';
      fileType = 'image/png';
    }

    // Convert canvas back to a native Javascript File object
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], filename, { type: fileType });
        onFilesSelected([file]);
      }
    }, fileType);
  };

  return (
    <div id="dropzone-uploader-container" className="space-y-4">
      <div
        id="dropzone-wrapper"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative group border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer overflow-hidden ${
          isDragActive
            ? 'border-teal-500 bg-teal-50/50 shadow-md scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/10 hover:shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleChange}
        />

        <div className="relative flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl group-hover:scale-110 group-hover:bg-teal-100 transition-all duration-300">
            <Upload className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <p className="font-bold text-slate-800 text-base tracking-tight">
              Drag & drop photo here, or <span className="text-teal-600 underline decoration-teal-200 group-hover:text-teal-700">browse folders</span>
            </p>
            <p className="text-sm text-slate-400">
              Supports JPG, JPEG, and PNG images. Max size up to 25MB.
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100/60 border border-slate-150 rounded-lg text-xs font-medium text-slate-500 shadow-sm">
            <Clipboard className="h-4 w-4 text-slate-400" />
            <span>Protip: Press <kbd className="font-mono bg-white px-1.5 border border-slate-200 rounded">Ctrl+V</kbd> / <kbd className="font-mono bg-white px-1.5 border border-slate-200 rounded">Cmd+V</kbd> to paste directly!</span>
          </div>
        </div>
      </div>


    </div>
  );
}
