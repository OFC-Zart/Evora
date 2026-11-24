// Gera todos os ícones do app a partir do logo original (data/brand/).
// Uso: npm run icons
//
// O original tem uma borda preta (12–22 px) em volta do quadrado arredondado e
// cantos pretos. Aqui recortamos o quadrado por dentro (sem a borda nem o
// contorno cinza), aplicamos cantos arredondados transparentes e montamos as
// versões de cada plataforma:
//   - icon-192/512.png      cantos transparentes (Chrome, instalação, favicon)
//   - maskable-512.png      fundo cheio com respiro de 20% (Android recorta)
//   - app/apple-icon.png    fundo cheio, sem transparência (o iOS arredonda)
//   - badge-96.png          silhueta branca das montanhas (barra de notificação)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = new URL("../data/brand/evora-logo-original.webp", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = (p) => new URL(`../${p}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BG = { r: 6, g: 6, b: 6, alpha: 1 }; // fundo do logo (#060606)
const INSET = 10; // px a mais para fora o contorno cinza do original
const RAIO = 0.225; // raio dos cantos, como ícone de app

mkdirSync(OUT("public/icons"), { recursive: true });

// 1) acha o quadrado arredondado (o que não é preto puro)
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const lum = (x, y) => {
  const i = (y * W + x) * C;
  return data[i] + data[i + 1] + data[i + 2];
};
const conta = (fn, n) => {
  let c = 0;
  for (let i = 0; i < n; i++) if (fn(i) > 9) c++;
  return c;
};
let x0 = 0;
while (conta((y) => lum(x0, y), H) < 200) x0++;
let x1 = W - 1;
while (conta((y) => lum(x1, y), H) < 200) x1--;
let y0 = 0;
while (conta((x) => lum(x, y0), W) < 200) y0++;
let y1 = H - 1;
while (conta((x) => lum(x, y1), W) < 200) y1--;

const lado = Math.min(x1 - x0 + 1, y1 - y0 + 1) - INSET * 2;
const left = Math.round((x0 + x1) / 2 - lado / 2);
const top = Math.round((y0 + y1) / 2 - lado / 2);
console.log(`quadrado do logo: x ${x0}–${x1}, y ${y0}–${y1} → recorte ${lado}px em (${left}, ${top})`);

const quadrado = await sharp(SRC).extract({ left, top, width: lado, height: lado }).png().toBuffer();

const mascara = (s, r) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${Math.round(s * r)}" ry="${Math.round(s * r)}" fill="#fff"/></svg>`);

// 2) versão com cantos transparentes
const arredondado = await sharp(quadrado)
  .ensureAlpha()
  .composite([{ input: mascara(lado, RAIO), blend: "dest-in" }])
  .png()
  .toBuffer();

// 3) versão de fundo cheio (sem a borda preta pura nos cantos)
const cheio = await sharp({ create: { width: lado, height: lado, channels: 4, background: BG } })
  .composite([{ input: arredondado }])
  .png()
  .toBuffer();

const salvar = async (buf, size, path, opts = {}) => {
  let img = sharp(buf).resize(size, size, { kernel: "lanczos3" });
  if (opts.flatten) img = img.flatten({ background: BG });
  await img.png({ compressionLevel: 9 }).toFile(OUT(path));
  console.log("✓", path);
};

await salvar(arredondado, 512, "public/icons/icon-512.png");
await salvar(arredondado, 192, "public/icons/icon-192.png");
await salvar(arredondado, 64, "app/icon.png");
await salvar(cheio, 180, "app/apple-icon.png", { flatten: true });

// maskable: conteúdo em 88% do quadro (o texto fica dentro do círculo de 80%,
// a zona segura do Android) e borda esfumada para a textura sumir no fundo
const lm = 450;
const esfumado = await sharp(mascara(lm, RAIO)).blur(10).png().toBuffer();
const interno = await sharp(cheio)
  .resize(lm, lm, { kernel: "lanczos3" })
  .ensureAlpha()
  .composite([{ input: esfumado, blend: "dest-in" }])
  .png()
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: interno, left: (512 - lm) / 2, top: (512 - lm) / 2 }])
  .flatten({ background: BG })
  .png({ compressionLevel: 9 })
  .toFile(OUT("public/icons/maskable-512.png"));
console.log("✓ public/icons/maskable-512.png");

// badge: só as montanhas (partes claras) como silhueta branca com alfa
const regiao = { left: Math.round(W * 0.14), top: Math.round(H * 0.28), width: Math.round(W * 0.72), height: Math.round(H * 0.3) };
const alfa = await sharp(SRC).extract(regiao).greyscale().linear(2.2, -120).raw().toBuffer({ resolveWithObject: true });
const branco = await sharp({ create: { width: alfa.info.width, height: alfa.info.height, channels: 3, background: "#ffffff" } })
  .joinChannel(alfa.data, { raw: { width: alfa.info.width, height: alfa.info.height, channels: 1 } })
  .png()
  .toBuffer();
await sharp(branco)
  .resize(84, 84, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT("public/icons/badge-96.png"));
console.log("✓ public/icons/badge-96.png");
