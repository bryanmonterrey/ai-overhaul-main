import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { ButtonHTMLAttributes } from 'react';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  className?: string;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({ 
  isLoading, 
  type = "submit", 
  className = "",
  ...props 
}) => {
  return (
    <motion.button
      type={type}
      className={`ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-azul dark:bg-azul ${className}`}
      disabled={isLoading}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <LoaderCircle className="h-5 w-5 text-white dark:text-white" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ArrowUp className="h-6 w-6 text-white dark:text-white" strokeWidth={2.5} />
        </motion.div>
      )}
    </motion.button>
  );
};

export default SubmitButton;