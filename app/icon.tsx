import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "112px",
          border: "24px solid #18e28b"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 210,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: "-18px",
            color: "#18e28b",
            paddingRight: "18px"
          }}
        >
          HL
        </div>
      </div>
    ),
    size
  );
}
