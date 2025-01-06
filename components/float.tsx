import { motion } from "framer-motion";

interface FloatProps {
  children: React.ReactNode;
  speed?: number; // Controls the animation speed
  floatIntensity?: number; // Controls the vertical floating range
  rotationIntensity?: number; // Controls the rotation intensity
}

const Float: React.FC<FloatProps> = ({
  children,
  speed = 7,
  floatIntensity = 10,
  rotationIntensity = 2,
}) => {
  return (
    <motion.div
      animate={{
        y: [0, -floatIntensity, 0, floatIntensity, 0], // Symmetrical floating motion
        rotateX: [0, rotationIntensity, 0, -rotationIntensity, 0], // Symmetrical X-axis rotation
        rotateY: [0, rotationIntensity, 0, -rotationIntensity, 0], // Symmetrical Y-axis rotation
        rotateZ: [0, rotationIntensity, 0, -rotationIntensity, 0], // Symmetrical Z-axis rotation
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut", // Smooth back-and-forth easing
      }}
      style={{ display: "inline-block", perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
};

export default Float;
