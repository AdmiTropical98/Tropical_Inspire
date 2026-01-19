import { useEffect } from "react";
import "./introVideo.css";

type IntroVideoProps = {
  onFinish: () => void;
};

export default function IntroVideo({ onFinish }: IntroVideoProps) {
  useEffect(() => {
    // tempo fixo da intro (ex: 10 segundos)
    const timer = setTimeout(() => {
      onFinish();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="intro-container">
      <video
        src="/intro.mp4"
        muted
        playsInline
        autoPlay
        loop
      />
    </div>
  );
}
