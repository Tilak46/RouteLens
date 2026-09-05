import { motion, MotionValue, useTransform } from "framer-motion";

interface GhostEyeProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  ghostX: number;
  ghostY: number;
  eyeOffsetX: number;
  eyeOffsetY: number;
}

const GhostEye = ({
  mouseX,
  mouseY,
  ghostX,
  ghostY,
  eyeOffsetX,
  eyeOffsetY,
}: GhostEyeProps) => {
  const pupilX = useTransform([mouseX, mouseY], ([x, y]) => {
    const numX = typeof x === "number" && Number.isFinite(x) ? x : 0;
    const numY = typeof y === "number" && Number.isFinite(y) ? y : 0;
    const gX = typeof ghostX === "number" && Number.isFinite(ghostX) ? ghostX : 0;
    const gY = typeof ghostY === "number" && Number.isFinite(ghostY) ? ghostY : 0;
    const dx = numX - gX;
    const dy = numY - gY;
    const angle = Math.atan2(dy, dx);
    const offset = Number.isFinite(angle) ? Math.cos(angle) * 2.5 : 0;
    return eyeOffsetX + offset;
  });

  const pupilY = useTransform([mouseX, mouseY], ([x, y]) => {
    const numX = typeof x === "number" && Number.isFinite(x) ? x : 0;
    const numY = typeof y === "number" && Number.isFinite(y) ? y : 0;
    const gX = typeof ghostX === "number" && Number.isFinite(ghostX) ? ghostX : 0;
    const gY = typeof ghostY === "number" && Number.isFinite(ghostY) ? ghostY : 0;
    const dx = numX - gX;
    const dy = numY - gY;
    const angle = Math.atan2(dy, dx);
    const offset = Number.isFinite(angle) ? Math.sin(angle) * 2.5 : 0;
    return eyeOffsetY + offset;
  });

  return (
    <>
      <circle cx={eyeOffsetX} cy={eyeOffsetY} r="3" fill="white" />
      <motion.circle cx={pupilX} cy={pupilY} r="1.5" fill="black" />
    </>
  );
};

export default GhostEye;
