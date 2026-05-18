import { useEffect, useState } from "react";

const stops = [
  "Aeroporto Faro",
  "Hotel Vilamoura",
  "Albufeira Centro",
  "Portimão Arena",
  "Lagos Marina"
];

const vehiclesMock = [
  {
    id: 1,
    registration: "12-AB-34",
    startTime: "15:00",
    endTime: "15:40"
  },
  {
    id: 2,
    registration: "34-CD-56",
    startTime: "15:05",
    endTime: "15:45"
  },
  {
    id: 3,
    registration: "78-EF-90",
    startTime: "15:10",
    endTime: "15:50"
  }
];

function getProgress(start: string, end: string) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const startDate = new Date(`${today}T${start}`);
  const endDate = new Date(`${today}T${end}`);

  const total = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();

  return Math.min(Math.max(elapsed / total, 0), 1);
}

export default function LinhaAnimada() {
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    let animationFrame: number;

    const animate = () => {
      const updated = vehiclesMock.map((v) => {
        const progress = getProgress(v.startTime, v.endTime);
        const position = progress * (stops.length - 1);

        return {
          ...v,
          position,
          progress
        };
      });

      setVehicles(updated);
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <div style={{ position: "relative" }}>
        {/* Linha */}
        <div
          style={{
            height: 4,
            background: "#3b82f6",
            position: "absolute",
            top: 30,
            left: 0,
            right: 0
          }}
        />

        {/* POIs */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {stops.map((stop, index) => (
            <div key={index} style={{ textAlign: "center", width: "100%" }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#60a5fa",
                  margin: "0 auto"
                }}
              />
              <div style={{ marginTop: 10, fontSize: 12 }}>{stop}</div>
            </div>
          ))}
        </div>

        {/* VIATURAS */}
        {vehicles.map((v) => {
          const left = `${(v.position / (stops.length - 1)) * 100}%`;

          return (
            <div
              key={v.id}
              style={{
                position: "absolute",
                top: 0,
                left,
                transform: "translateX(-50%)",
                transition: "left 0.1s linear",
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: 20 }}>🚐</div>
              <div style={{ fontSize: 10 }}>{v.registration}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
