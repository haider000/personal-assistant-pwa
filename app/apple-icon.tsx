import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

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
          background: "linear-gradient(180deg, #f8fafc 0%, #efe7d8 100%)",
        }}
      >
        <div
          style={{
            width: 126,
            height: 126,
            borderRadius: 36,
            background: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1,
            letterSpacing: "-0.08em",
            }}
          >
            P
          </div>
        </div>
      </div>
    ),
    size
  );
}
