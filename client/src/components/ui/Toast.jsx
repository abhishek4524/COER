import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({
  message,
  type = 'info',
  isVisible,
  onClose,
}) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#8FB8A8]" />,
    friction: <AlertCircle className="w-5 h-5 text-[#F08A7E]" />,
    info: <Info className="w-5 h-5 text-[#6C63FF]" />,
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] rounded-2xl shadow-xl"
        >
          {icons[type]}
          <span className="text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">{message}</span>
          {onClose && (
            <button onClick={onClose} className="text-[#6B6B70] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] ml-2">
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
