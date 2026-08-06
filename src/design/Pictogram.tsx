import { PICTOGRAMS, type PictogramName } from "@/assets/icons";

// 내려받은 Phosphor duotone SVG 를 그대로 심는다.
// 마크업이 우리 코드에 문자열로 들어있는 정적 자산이므로 사용자 입력이 섞일 여지가 없다.
// fill 이 currentColor 라서 color 만 넘기면 두 겹(옅은 면 + 실선)이 같이 물든다.
export function Pictogram({
  name, size = 24, color = "currentColor", style,
}: {
  name: PictogramName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      data-pictogram
      aria-hidden="true"
      style={{
        width: size, height: size, color,
        display: "inline-flex", flexShrink: 0,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: PICTOGRAMS[name] }}
    />
  );
}
