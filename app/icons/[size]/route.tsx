import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/ui/icon-art";

const SIZES = new Set(["192", "512", "maskable-512"]);

export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const px = size.endsWith("512") ? 512 : 192;
  // maskable: sem cantos arredondados (o sistema recorta)
  return new ImageResponse(<IconArt size={px} rounded={!size.startsWith("maskable")} />, { width: px, height: px });
}
