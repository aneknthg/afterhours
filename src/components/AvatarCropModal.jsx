import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_DISPLAY = 264;
const OUTPUT      = 400;

// The crop circle has to fit inside the card (max-w-xs + p-6) on the narrowest
// phones we support, so size it off the viewport once, at mount.
function initialDisplay() {
  if (typeof window === 'undefined') return MAX_DISPLAY;
  return Math.max(200, Math.min(MAX_DISPLAY, window.innerWidth - 96));
}

export default function AvatarCropModal({ src, onSave, onCancel }) {
  const [DISPLAY] = useState(initialDisplay);
  const [offset,   setOffset]   = useState({ x: 0, y: 0 });
  const [zoom,     setZoom]     = useState(1);
  const [minZoom,  setMinZoom]  = useState(1);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const drag      = useRef(null);
  const pinch     = useRef(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const mz = Math.max(DISPLAY / img.naturalWidth, DISPLAY / img.naturalHeight);
      setMinZoom(mz);
      setZoom(mz);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src, DISPLAY]);

  const clamp = useCallback((ox, oy, z) => {
    const img = imgRef.current;
    if (!img) return { x: ox, y: oy };
    const hw = Math.max(0, img.naturalWidth  * z / 2 - DISPLAY / 2);
    const hh = Math.max(0, img.naturalHeight * z / 2 - DISPLAY / 2);
    return { x: Math.max(-hw, Math.min(hw, ox)), y: Math.max(-hh, Math.min(hh, oy)) };
  }, [DISPLAY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    canvas.width  = DISPLAY;
    canvas.height = DISPLAY;
    const ctx = canvas.getContext('2d');
    const dw  = img.naturalWidth  * zoom;
    const dh  = img.naturalHeight * zoom;
    ctx.clearRect(0, 0, DISPLAY, DISPLAY);
    ctx.drawImage(img, DISPLAY / 2 - dw / 2 + offset.x, DISPLAY / 2 - dh / 2 + offset.y, dw, dh);
  }, [offset, zoom, DISPLAY]);

  function handleMouseDown(e) {
    e.preventDefault();
    setDragging(true);
    drag.current = { sx: e.clientX - offset.x, sy: e.clientY - offset.y };
  }
  function handleMouseMove(e) {
    if (!drag.current) return;
    setOffset(clamp(e.clientX - drag.current.sx, e.clientY - drag.current.sy, zoom));
  }
  function handleMouseUp() { setDragging(false); drag.current = null; }

  function handleWheel(e) {
    e.preventDefault();
    const nz = Math.max(minZoom, Math.min(minZoom * 4, zoom * (1 - e.deltaY * 0.001)));
    setZoom(nz);
    setOffset(o => clamp(o.x, o.y, nz));
  }

  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      drag.current  = { sx: e.touches[0].clientX - offset.x, sy: e.touches[0].clientY - offset.y };
      pinch.current = null;
    } else if (e.touches.length === 2) {
      pinch.current = {
        dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
        zoom,
      };
      drag.current = null;
    }
  }
  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current) {
      setOffset(clamp(e.touches[0].clientX - drag.current.sx, e.touches[0].clientY - drag.current.sy, zoom));
    } else if (e.touches.length === 2 && pinch.current) {
      const d  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const nz = Math.max(minZoom, Math.min(minZoom * 4, pinch.current.zoom * (d / pinch.current.dist)));
      setZoom(nz);
      setOffset(o => clamp(o.x, o.y, nz));
    }
  }
  function handleTouchEnd() { drag.current = null; pinch.current = null; }

  function handleSlider(e) {
    const nz = parseFloat(e.target.value);
    setZoom(nz);
    setOffset(o => clamp(o.x, o.y, nz));
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width  = OUTPUT;
    out.height = OUTPUT;
    const ctx = out.getContext('2d');
    const s   = OUTPUT / DISPLAY;
    const dw  = img.naturalWidth  * zoom * s;
    const dh  = img.naturalHeight * zoom * s;
    ctx.drawImage(img, OUTPUT / 2 - dw / 2 + offset.x * s, OUTPUT / 2 - dh / 2 + offset.y * s, dw, dh);
    out.toBlob(b => b && onSave(b), 'image/jpeg', 0.92);
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-2xl p-6 flex flex-col items-center gap-5 w-full max-w-xs shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="font-headline text-lg font-bold text-on-surface">Adjust photo</h2>
          <p className="text-xs text-on-surface-variant mt-1">Drag to reposition · Scroll or pinch to zoom</p>
        </div>

        {/* Crop circle preview */}
        <div className="relative" style={{ width: DISPLAY, height: DISPLAY }}>
          <canvas
            ref={canvasRef}
            className="rounded-full block"
            style={{
              width: DISPLAY, height: DISPLAY,
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <div className="absolute inset-0 rounded-full ring-2 ring-white/50 pointer-events-none" />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2 w-full px-1">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>zoom_out</span>
          <input
            type="range"
            min={minZoom}
            max={minZoom * 3}
            step={0.001}
            value={zoom}
            onChange={handleSlider}
            className="flex-1 accent-primary"
            style={{ height: 4 }}
          />
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>zoom_in</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-outline text-on-surface text-sm font-medium hover:bg-surface-variant transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
