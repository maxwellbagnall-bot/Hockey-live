import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06111b",
          borderRadius: "38px",
          border: "9px solid #18e28b"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 74,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: "-6px",
            color: "#18e28b",
            paddingRight: "6px"
          }}
        >
          HL
        </div>
      </div>
    ),
    size
  );
}
