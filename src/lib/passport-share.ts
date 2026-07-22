export type PassportTrailShareData = {
  id: string;
  title: string;
  date: string;
  distance_km: number | null;
  difficulty: string | null;
};

export type PassportShareData = {
  participant: {
    fullName: string;
    experience: number;
    passportNumber: string;
  };
  summary: {
    completedCount: number;
    totalDistanceKm: number;
    level: string;
  };
  completed: PassportTrailShareData[];
};

export type TrailStampIdentity = {
  ink: string;
  softInk: string;
  paper: string;
  rotation: number;
  serial: string;
  motto: string;
  motif: "peak" | "forest" | "compass" | "river" | "sun" | "footprints";
  ringStyle: "solid" | "dashed" | "double";
};

const STAMP_PALETTES = [
  { ink: "#8F302B", softInk: "#C87A6D", paper: "#FFF1DD" },
  { ink: "#174E67", softInk: "#6E9CAD", paper: "#EDF6F4" },
  { ink: "#2F6245", softInk: "#7DA58B", paper: "#F0F5E8" },
  { ink: "#6B3D72", softInk: "#A886AF", paper: "#F7EFF7" },
  { ink: "#9A571F", softInk: "#D29B65", paper: "#FFF3DF" },
  { ink: "#29446F", softInk: "#7E93B5", paper: "#EEF1F8" },
] as const;

const MOTIFS: TrailStampIdentity["motif"][] = ["peak", "forest", "compass", "river", "sun", "footprints"];
const MOTTOS = [
  "CUME CONQUISTADO",
  "TRAVESSIA OFICIAL",
  "ROTA SELVAGEM",
  "MEMÓRIA DE EXPEDIÇÃO",
  "PASSO FIRME",
  "NATUREZA VIVIDA",
] as const;
const RING_STYLES: TrailStampIdentity["ringStyle"][] = ["solid", "dashed", "double"];

export function getTrailStampIdentity(trail: Pick<PassportTrailShareData, "id" | "title" | "date">): TrailStampIdentity {
  const hash = hashText(`${trail.id}|${trail.title}|${trail.date}`);
  const palette = STAMP_PALETTES[hash % STAMP_PALETTES.length];
  return {
    ...palette,
    rotation: (hash % 13) - 6,
    serial: `MT-${hash.toString(36).toUpperCase().padStart(7, "0").slice(-7)}`,
    motto: MOTTOS[(hash >>> 3) % MOTTOS.length],
    motif: MOTIFS[(hash >>> 5) % MOTIFS.length],
    ringStyle: RING_STYLES[(hash >>> 7) % RING_STYLES.length],
  };
}

export async function createPassportShareImage(data: PassportShareData) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = getContext(canvas);

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#061526");
  background.addColorStop(0.58, "#0B2946");
  background.addColorStop(1, "#07121F");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1350);
  drawNoise(context, 1080, 1350, "rgba(255,255,255,.025)");

  roundedRect(context, 54, 54, 972, 1242, 46);
  context.strokeStyle = "rgba(225,190,118,.72)";
  context.lineWidth = 4;
  context.stroke();
  roundedRect(context, 72, 72, 936, 1206, 36);
  context.strokeStyle = "rgba(225,190,118,.22)";
  context.lineWidth = 2;
  context.stroke();

  context.textAlign = "center";
  context.fillStyle = "#E7C77F";
  context.font = "800 24px Arial";
  context.fillText("MAIS TRILHA MENOS ESTRESSE", 540, 122);
  context.font = "900 64px Georgia";
  context.fillText("PASSAPORTE DE TRILHAS", 540, 198);
  context.font = "700 18px Arial";
  context.fillStyle = "rgba(231,199,127,.72)";
  context.fillText("DOCUMENTO DIGITAL DE EXPEDIÇÕES", 540, 234);

  drawMountainEmblem(context, 540, 344, 108, "#E7C77F");

  context.fillStyle = "#FFFFFF";
  context.font = "900 42px Arial";
  drawFittedText(context, data.participant.fullName.toUpperCase(), 540, 500, 820, 42);
  context.fillStyle = "#E7C77F";
  context.font = "700 21px monospace";
  context.fillText(data.participant.passportNumber, 540, 540);

  drawMetric(context, 214, 625, String(data.summary.completedCount), "VISTOS");
  drawMetric(context, 540, 625, `${formatNumber(data.summary.totalDistanceKm, 1)} KM`, "JORNADA");
  drawMetric(context, 866, 625, formatNumber(data.participant.experience, 0), "XP");

  context.textAlign = "left";
  context.fillStyle = "#E7C77F";
  context.font = "900 22px Arial";
  context.fillText("VISTOS CONQUISTADOS", 112, 742);
  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,.62)";
  context.font = "700 18px Arial";
  context.fillText(data.summary.level.toUpperCase(), 968, 742);

  const trails = data.completed.slice(0, 6);
  if (trails.length === 0) {
    context.textAlign = "center";
    context.fillStyle = "rgba(255,255,255,.5)";
    context.font = "600 24px Arial";
    context.fillText("O primeiro carimbo está a caminho.", 540, 930);
  } else {
    trails.forEach((trail, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      drawTrailStamp(context, trail, 218 + column * 322, 890 + row * 250, 178);
    });
  }

  const remaining = Math.max(0, data.completed.length - trails.length);
  if (remaining > 0) {
    context.textAlign = "center";
    context.fillStyle = "rgba(231,199,127,.8)";
    context.font = "800 17px Arial";
    context.fillText(`+ ${remaining} VISTOS NO PASSAPORTE DIGITAL`, 540, 1195);
  }

  context.textAlign = "center";
  context.fillStyle = "rgba(255,255,255,.52)";
  context.font = "700 17px Arial";
  context.fillText("MAISTRILHASMENOSESTRESSE.COM", 540, 1252);

  return canvasToFile(canvas, `passaporte-${slugify(data.participant.fullName)}.png`);
}

export async function createTrailStampShareImage(trail: PassportTrailShareData, participantName: string) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = getContext(canvas);
  const identity = getTrailStampIdentity(trail);

  context.fillStyle = identity.paper;
  context.fillRect(0, 0, 1080, 1080);
  drawNoise(context, 1080, 1080, `${identity.ink}0A`);
  context.strokeStyle = identity.softInk;
  context.lineWidth = 4;
  roundedRect(context, 52, 52, 976, 976, 42);
  context.stroke();

  context.textAlign = "center";
  context.fillStyle = identity.ink;
  context.font = "900 22px Arial";
  context.fillText("MAIS TRILHA · VISTO OFICIAL", 540, 110);
  drawTrailStamp(context, trail, 540, 480, 540);

  context.fillStyle = "#132B43";
  context.font = "900 46px Georgia";
  wrapCenteredText(context, trail.title.toUpperCase(), 540, 820, 850, 54, 2);
  context.fillStyle = identity.ink;
  context.font = "800 20px Arial";
  context.fillText(`${identity.serial} · ${formatDateShort(trail.date)}`, 540, 930);
  context.fillStyle = "#66583F";
  context.font = "700 18px Arial";
  drawFittedText(context, `CONQUISTADO POR ${participantName.toUpperCase()}`, 540, 982, 850, 18);

  return canvasToFile(canvas, `carimbo-${slugify(trail.title)}.png`);
}

export async function shareOrDownloadImage(file: File, title: string, text: string) {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text, files: [file] });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  return "downloaded" as const;
}

function drawTrailStamp(
  context: CanvasRenderingContext2D,
  trail: PassportTrailShareData,
  x: number,
  y: number,
  size: number,
) {
  const identity = getTrailStampIdentity(trail);
  context.save();
  context.translate(x, y);
  context.rotate((identity.rotation * Math.PI) / 180);
  context.strokeStyle = identity.ink;
  context.fillStyle = identity.ink;
  context.lineWidth = Math.max(3, size * 0.018);
  context.globalAlpha = 0.93;

  context.beginPath();
  context.arc(0, 0, size / 2, 0, Math.PI * 2);
  if (identity.ringStyle === "dashed") context.setLineDash([size * 0.05, size * 0.025]);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(0, 0, size * 0.41, 0, Math.PI * 2);
  context.lineWidth = Math.max(2, size * 0.009);
  context.stroke();
  if (identity.ringStyle === "double") {
    context.beginPath();
    context.arc(0, 0, size * 0.36, 0, Math.PI * 2);
    context.stroke();
  }

  drawMotif(context, identity.motif, 0, -size * 0.03, size * 0.2, identity.ink);
  context.textAlign = "center";
  context.font = `900 ${Math.max(10, size * 0.065)}px Arial`;
  context.fillText(identity.motto, 0, -size * 0.31, size * 0.72);
  context.font = `800 ${Math.max(9, size * 0.057)}px monospace`;
  context.fillText(formatDateShort(trail.date), 0, size * 0.25, size * 0.68);
  context.font = `800 ${Math.max(8, size * 0.046)}px monospace`;
  context.fillText(identity.serial, 0, size * 0.34, size * 0.65);
  context.restore();
}

function drawMotif(context: CanvasRenderingContext2D, motif: TrailStampIdentity["motif"], x: number, y: number, size: number, color: string) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(3, size * 0.09);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (motif === "peak") {
    context.moveTo(-size, size * 0.7); context.lineTo(-size * 0.25, -size * 0.7); context.lineTo(size * 0.05, -size * 0.2); context.lineTo(size * 0.4, -size); context.lineTo(size, size * 0.7);
  } else if (motif === "forest") {
    [-0.55, 0, 0.55].forEach((offset, index) => { const height = index === 1 ? 1 : 0.78; context.moveTo(size * offset, size * 0.75); context.lineTo(size * offset, -size * height); context.moveTo(size * (offset - 0.35), size * 0.05); context.lineTo(size * offset, -size * height); context.lineTo(size * (offset + 0.35), size * 0.05); });
  } else if (motif === "compass") {
    context.arc(0, 0, size * 0.82, 0, Math.PI * 2); context.moveTo(0, -size); context.lineTo(size * 0.24, size * 0.18); context.lineTo(0, size); context.lineTo(-size * 0.24, -size * 0.18); context.closePath();
  } else if (motif === "river") {
    context.moveTo(-size, -size * 0.45); context.bezierCurveTo(-size * 0.35, -size, size * 0.35, 0, size, -size * 0.45); context.moveTo(-size, size * 0.35); context.bezierCurveTo(-size * 0.35, -size * 0.2, size * 0.35, size * 0.8, size, size * 0.35);
  } else if (motif === "sun") {
    context.arc(0, 0, size * 0.5, 0, Math.PI * 2); for (let index = 0; index < 8; index += 1) { const angle = (index * Math.PI) / 4; context.moveTo(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7); context.lineTo(Math.cos(angle) * size, Math.sin(angle) * size); }
  } else {
    context.ellipse(-size * 0.3, -size * 0.2, size * 0.28, size * 0.5, -0.35, 0, Math.PI * 2); context.ellipse(size * 0.35, size * 0.35, size * 0.28, size * 0.5, -0.35, 0, Math.PI * 2);
  }
  context.stroke();
  context.restore();
}

function drawMountainEmblem(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.arc(0, 0, size, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(-size * 0.72, size * 0.38);
  context.lineTo(-size * 0.15, -size * 0.5);
  context.lineTo(size * 0.12, -size * 0.08);
  context.lineTo(size * 0.42, -size * 0.62);
  context.lineTo(size * 0.78, size * 0.38);
  context.stroke();
  context.restore();
}

function drawMetric(context: CanvasRenderingContext2D, x: number, y: number, value: string, label: string) {
  context.textAlign = "center";
  context.fillStyle = "#FFFFFF";
  context.font = "900 35px Arial";
  context.fillText(value, x, y);
  context.fillStyle = "rgba(231,199,127,.72)";
  context.font = "800 14px Arial";
  context.fillText(label, x, y + 28);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawNoise(context: CanvasRenderingContext2D, width: number, height: number, color: string) {
  context.fillStyle = color;
  for (let index = 0; index < 1_100; index += 1) {
    const x = (index * 73) % width;
    const y = (index * 137) % height;
    context.fillRect(x, y, 2, 2);
  }
}

function wrapCenteredText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => context.fillText(value, x, y + index * lineHeight, maxWidth));
}

function drawFittedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, startingSize: number) {
  let size = startingSize;
  const family = context.font.includes("Georgia") ? "Georgia" : "Arial";
  while (size > 15 && context.measureText(text).width > maxWidth) {
    size -= 1;
    context.font = `900 ${size}px ${family}`;
  }
  context.textAlign = "center";
  context.fillText(text, x, y, maxWidth);
}

function getContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem do Passaporte.");
  return context;
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Não foi possível gerar a imagem."));
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png", 0.96);
  });
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "mais-trilha";
}

function formatDateShort(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatNumber(value: number, digits: number) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}
