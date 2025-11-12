import { useRef, useEffect, useState } from "react";
import AltitudeRollingGraph, { AltitudeRollingGraphRef } from "./AltitudeRollingGraph";
import DepthRollingGraph, { DepthRollingGraphRef } from "./DepthRollingGraph";
import HeadingCompass from "./HeadingCompass";
import ROVHeadingCompass from "./HeadingCompass";

export default function ROVInformation() {
  const altRef = useRef<AltitudeRollingGraphRef>(null);
  const depthRef = useRef<DepthRollingGraphRef>(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    // Demo stream: altitude, depth & heading
    let t0 = Date.now();
    let alt = 0;
    let depth = 2.0;

    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - t0) / 1000;
      t0 = now;

      // Altitude naik/turun perlahan
      alt += Math.sin(now / 2000) * 0.3 * dt;

      // Depth drift kecil
      depth += Math.sin(now / 2500) * 0.1 * dt + Math.sin(now / 8000) * 0.02 * dt;

      // Heading pusing 360° setiap ±12 saat
      const simHeading = ((now / 12000) * 360) % 360;

      altRef.current?.push({ alt, ts: now });
      depthRef.current?.push({ depth, ts: now });
      setHeading(simHeading);
    }, 100);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center">
      <ROVHeadingCompass
        heading={heading}
        size={182}
      />
      <AltitudeRollingGraph
        ref={altRef}
        windowSeconds={60}
        color="#22c55e"
        units="m"
        fill
      />
      <DepthRollingGraph
        ref={depthRef}
        windowSeconds={60}
        color="#38bdf8"
        units="m"
        fill
        reverseYAxis
      />
    </div>
  );
}
