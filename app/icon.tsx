import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

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
          background:
            "radial-gradient(circle at 25% 20%, rgba(245, 158, 11, 0.25), transparent 30%), linear-gradient(180deg, #fcfbf7 0%, #efe7d8 100%)",
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 100,
            background: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 24px 80px rgba(15, 23, 42, 0.2)",
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: "#f8fafc",
              lineHeight: 1,
              letterSpacing: "-0.08em",
              marginTop: -8,
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
