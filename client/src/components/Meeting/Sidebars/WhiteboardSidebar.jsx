import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Trash2, RotateCcw, Download } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

const COLORS = ['#ffffff', '#ea4335', '#34a853', '#fbbc04', '#8ab4f8', '#ff7043', '#ce93d8', '#80cbc4'];
const SIZES = [2, 4, 8, 16];

export default function WhiteboardSidebar() {
  const { setActivePanel, whiteboardStrokes, sendWhiteboardStroke, clearWhiteboard, undoWhiteboard } = useMeeting();
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef([]);

  // Redraw all strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    whiteboardStrokes.forEach((stroke) => drawStroke(ctx, stroke));
  }, [whiteboardStrokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function drawStroke(ctx, stroke) {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e) {
    setIsDrawing(true);
    const pos = getPos(e);
    currentStroke.current = [pos];
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    currentStroke.current.push(pos);
    // Draw current stroke live
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    redraw();
    drawStroke(ctx, { points: currentStroke.current, color, size });
  }

  function onPointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.current.length > 1) {
      const stroke = { points: currentStroke.current, color, size };
      sendWhiteboardStroke(stroke);
    }
    currentStroke.current = [];
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <div className="sidebar-panel w-96">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-meet-border flex-shrink-0">
        <h3 className="font-medium text-meet-text text-sm">Whiteboard</h3>
        <div className="flex items-center gap-1">
          <button onClick={undoWhiteboard} className="p-1.5 hover:bg-meet-surface rounded-full" title="Undo">
            <RotateCcw className="w-3.5 h-3.5 text-meet-textSoft" />
          </button>
          <button onClick={handleDownload} className="p-1.5 hover:bg-meet-surface rounded-full" title="Download">
            <Download className="w-3.5 h-3.5 text-meet-textSoft" />
          </button>
          <button onClick={clearWhiteboard} className="p-1.5 hover:bg-meet-surface rounded-full" title="Clear">
            <Trash2 className="w-3.5 h-3.5 text-meet-red" />
          </button>
          <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-meet-surface rounded-full ml-1">
            <X className="w-4 h-4 text-meet-textSoft" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-meet-border flex-shrink-0">
        {/* Colors */}
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-meet-blue ring-offset-2 ring-offset-meet-bg scale-110' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-meet-border" />
        {/* Brush sizes */}
        <div className="flex gap-2 items-center">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded-full transition-all ${size === s ? 'bg-meet-blue' : 'bg-meet-surface'}`}
              style={{ width: s + 8, height: s + 8 }}
            />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-[#1a1a1a] relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="whiteboard-canvas w-full h-full"
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>
    </div>
  );
}
