// Arte do ícone (sem fonte, só formas): três barras subindo = progresso ajustado.
export function IconArt({ size, rounded = true }: { size: number; rounded?: boolean }) {
  const pad = size * 0.2;
  const w = size - pad * 2;
  const bar = w / 4.2;
  const gap = (w - bar * 3) / 2;
  const heights = [0.42, 0.68, 0.95];
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "#101411",
        borderRadius: rounded ? size * 0.22 : 0,
        paddingBottom: pad,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: bar,
            height: w * h,
            marginLeft: i === 0 ? 0 : gap,
            background: i === 2 ? "#b5ef3b" : i === 1 ? "#8fc22a" : "#5f8420",
            borderRadius: bar / 2,
          }}
        />
      ))}
    </div>
  );
}
