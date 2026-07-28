"use client";

const CANVAS_SIZE = 1080;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureFontsReady() {
  try {
    await Promise.all([
      document.fonts.load("700 64px 'Space Grotesk'"),
      document.fonts.load("500 40px 'IBM Plex Mono'"),
    ]);
    await document.fonts.ready;
  } catch {
    // fall back to default fonts if webfont load fails
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number
) {
  const imgRatio = img.width / img.height;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;

  if (imgRatio > 1) {
    sw = img.height;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
}

export async function generateProductCard({
  file,
  name,
  price,
}: {
  file: File;
  name: string;
  price: string;
}): Promise<Blob> {
  const [photo, mark] = await Promise.all([
    loadImage(URL.createObjectURL(file)),
    loadImage("/etronic-mark.png"),
  ]);
  await ensureFontsReady();

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // base photo, cropped to fill the square
  drawCover(ctx, photo, CANVAS_SIZE);

  // bottom gradient for text legibility
  const gradient = ctx.createLinearGradient(0, CANVAS_SIZE * 0.45, 0, CANVAS_SIZE);
  gradient.addColorStop(0, "rgba(10,10,10,0)");
  gradient.addColorStop(1, "rgba(10,10,10,0.92)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // watermark logo, top-right
  const markW = 150;
  const markH = markW * (mark.height / mark.width);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(mark, CANVAS_SIZE - markW - 40, 40, markW, markH);
  ctx.globalAlpha = 1;

  // corner brackets, echoing the site's signature motif
  ctx.strokeStyle = "#C6793D";
  ctx.lineWidth = 6;
  const b = 40;
  const bl = 60;
  ctx.beginPath();
  ctx.moveTo(b, b + bl);
  ctx.lineTo(b, b);
  ctx.lineTo(b + bl, b);
  ctx.moveTo(CANVAS_SIZE - b - bl, CANVAS_SIZE - b);
  ctx.lineTo(CANVAS_SIZE - b, CANVAS_SIZE - b);
  ctx.lineTo(CANVAS_SIZE - b, CANVAS_SIZE - b - bl);
  ctx.stroke();

  // product name
  ctx.fillStyle = "#F5F3EE";
  ctx.font = "600 56px 'Space Grotesk', sans-serif";
  ctx.textBaseline = "alphabetic";
  wrapText(ctx, name, 64, CANVAS_SIZE - 150, CANVAS_SIZE - 128, 62);

  // price
  ctx.fillStyle = "#E8A85C";
  ctx.font = "500 46px 'IBM Plex Mono', monospace";
  ctx.fillText(`MVR ${Number(price || 0).toFixed(2)}`, 64, CANVAS_SIZE - 64);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.92
    );
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  maxWidth: number,
  bottomY: number,
  lineHeight: number
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const capped = lines.slice(0, 2);
  const startY = bottomY - (capped.length - 1) * lineHeight;
  capped.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineHeight);
  });
}
