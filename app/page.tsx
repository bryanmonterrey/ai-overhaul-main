// src/app/page.tsx

"use client"

import { Button } from "@/components/ui/button";
import { Link } from "next-view-transitions";
import React from "react";
import { Magnetic } from "./components/common/MagButton";
import { ArrowRight, Icon, LucideIcon, MessageCircleMore, MessagesSquare } from 'lucide-react';
import { AnimatePresence, motion } from "framer-motion";
import Float from "@/components/float";
import Image from "next/image";

interface AnimatedLinkProps {
  href: string;
  icon: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
  text: string;
}

export default function Home({ href, icon: Icon, text }: AnimatedLinkProps): JSX.Element {
  const springOptions = { bounce: 0.1 };
  const [isChatHovered, setChatHovered] = React.useState(false);
  const [isConversationsHovered, setConversationsHovered] = React.useState(false);

  return (
    <div className="items-center justify-center flex w-full h-full font-ia">  
    <div className="inline-block gap-4 space-y-4">
                {/* Spending Card - Full Width */}
                <Magnetic
  intensity={0.2}
  springOptions={springOptions}
  actionArea='global'
  range={200}
  
>
  <div 
    className="border-zinc-900 w-[300px] h-[200px] font-medium hover:cursor-pointer border-2 bg-[#0D0E15] hover:border-[#00FFA2] transition-colors ease-in-out duration-300 rounded-3xl p-12 text-white relative"
    onMouseEnter={() => setChatHovered(true)}
    onMouseLeave={() => setChatHovered(false)}
  >
    <Link href="/chat">         
      <motion.div 
        className="w-full h-full"
        animate={isChatHovered ? { scale: 0.95, y: -2, x: -24 } : { scale: 1.3, y: 0, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative space-y-6 left-1">
          <MessageCircleMore 
            className="w-8 h-8 text-[#DDDDDD] absolute -top-1" 
            strokeWidth={2}
          />
          <span className="text-[24px] font-geist absolute top-4">
            chat
          </span>
        </div>
      </motion.div>

      {isChatHovered && (
        <motion.div
          className="absolute bottom-5 right-5 inline-flex items-center gap-2"
          initial={{ x: 30, y: 30, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ x: 30, y: 30, opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          enter <ArrowRight className="w-8 h-8 text-[#DDDDDD]" strokeWidth={2} />
        </motion.div>
      )}
    </Link>
  </div>
</Magnetic>
                

                {/* Card 1 */}
                <Magnetic
  intensity={0.2}
  springOptions={springOptions}
  actionArea='global'
  range={200}
>
  <div 
    className="border-zinc-900 w-[300px] h-[200px] font-medium hover:cursor-pointer border-2 bg-[#0D0E15] hover:border-[#00FFA2] transition-colors ease-in-out duration-300 rounded-3xl p-12 text-white relative"
    onMouseEnter={() => setConversationsHovered(true)}
    onMouseLeave={() => setConversationsHovered(false)}
  >
    <Link href="/conversations">         
      <motion.div 
        className="w-full h-full"
        animate={isConversationsHovered ? { scale: 0.95, y: -2, x: -24 } : { scale: 1.3, y: 0, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative space-y-6 left-1">
          <MessagesSquare 
            className="w-8 h-8 text-[#DDDDDD] absolute -top-1" 
            strokeWidth={2}
          />
          <span className="text-[24px] font-geist absolute top-4">
            conversations
          </span>
        </div>
      </motion.div>

      {isConversationsHovered && (
        <motion.div
          className="absolute bottom-5 right-5 inline-flex items-center gap-2"
          initial={{ x: 30, y: 30, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ x: 30, y: 30, opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          enter <ArrowRight className="w-8 h-8 text-[#DDDDDD]" strokeWidth={2} />
        </motion.div>
      )}
    </Link>
  </div>
</Magnetic>

                
</div>

    </div>
  );
}
