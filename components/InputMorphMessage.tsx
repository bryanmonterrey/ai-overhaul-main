import { PlusIcon } from '@radix-ui/react-icons';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import SubmitButton from '../components/ui/SubmitButton';

interface InputMorphMessageProps {
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  messages?: {
    id: number;
    text: string;
    role: 'user' | 'assistant';
    data?: any;
  }[];
  handleTradeExecution?: (data: any) => void;
  handlePortfolioUpdate?: (data: any) => void;
}

const transitionDebug = {
  type: 'easeOut',
  duration: 0.2,
};

export default function InputMorphMessage({
  input,
  isLoading,
  onInputChange,
  onFormSubmit,
  messages = [],
  handleTradeExecution,
}: InputMorphMessageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
    
  return (
    <div className="flex h-full flex-col items-end justify-end pb-4">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-scroll h-auto w-full items-end justify-end">
        <AnimatePresence mode="wait">
          {messages.map((message, index) => (
            <div 
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full mt-2`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                    alt={message.role}
                  />
                  <AvatarFallback>{message.role === 'user' ? 'U' : 'AI'}</AvatarFallback>
                </Avatar>
                <motion.div
                  layout="position"
                  layoutId={`container-[${index}]`}
                  transition={transitionDebug}
                  className={` p-3 z-10 break-words ${
                    message.role === 'user'
                      ? 'bg-gray-200 rounded-b-3xl rounded-tl-3xl rounded-tr-lg text-gray-900 dark:bg-black dark:text-gray-100'
                      : 'bg-blue-200 rounded-b-3xl rounded-tl-lg rounded-tr-3xl text-gray-900 dark:bg-blue-800 dark:text-gray-100'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  {message.role === 'assistant' && message.data && (
                    <div className="mt-2 pt-2 border-t border-border">
                      {message.data.type === 'trade_execution' && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold">Trade Details:</p>
                          <div className="text-xs">
                            <p>Token: {message.data.token}</p>
                            <p>Side: {message.data.side}</p>
                            <p>Amount: {message.data.amount} SOL</p>
                            {message.data.price && <p>Price: {message.data.price} USDC</p>}
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleTradeExecution && handleTradeExecution(message.data)
                            }
                            className="mt-2"
                          >
                            Confirm Trade
                          </Button>
                        </div>
                      )}
                      {message.data.type === 'portfolio_update' && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold">Portfolio Update:</p>
                          <div className="text-xs">
                            <p>Total Value: {message.data.totalValue} SOL</p>
                            <p>Daily P&L: {message.data.dailyPnL} SOL</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <span className="text-xs opacity-50 mt-1 block">
                    {new Date().toLocaleTimeString()}
                  </span>
                </motion.div>
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>
      
      <div className="relative w-full">
        <form onSubmit={onFormSubmit} className="mt-4 flex w-full">
          <input
            type="text"
            value={input}
            onChange={onInputChange}
            className="relative h-9 w-[calc(100%-2rem)] flex-grow rounded-full border border-zinc-900 bg-[#1D1D2C] px-3 text-[15px] outline-none placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-zinc-900 focus-visible:ring-offset-1
            dark:border-black/60 dark:bg-black dark:text-gray-50 dark:placeholder-gray-500 dark:focus-visible:ring-zinc-900/20 dark:focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900"
            placeholder="Type your message"
            disabled={isLoading}
          />
          
          <motion.div
            key={input.length}
            layout="position"
            className="pointer-events-none absolute z-10 flex h-9 w-[calc(100%-2rem)] items-center overflow-hidden break-words rounded-full bg-gray-200 [word-break:break-word] dark:bg-black"
            layoutId={`container-[${messages.length}]`}
            transition={transitionDebug}
            initial={{ opacity: 0.6, zIndex: -1 }}
            animate={{ opacity: 0.6, zIndex: -1 }}
            exit={{ opacity: 1, zIndex: 1 }}
          >
            <div className="px-3 py-2 text-[15px] leading-[15px] text-gray-900 dark:text-gray-50">
              {input}
            </div>
        </motion.div>

        <SubmitButton isLoading={isLoading} onClick={() => console.log('clicked')} />
        </form>
      </div>
    </div>
  );
}