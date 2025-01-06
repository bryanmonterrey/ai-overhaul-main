'use client';

import { Drawer } from 'vaul';
import { Link } from 'next-view-transitions'
import { Button } from '../components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';


interface MobileNavProps {
  trigger: React.ReactNode;
}

export function MobileNav({ trigger }: MobileNavProps) {
  return (
    <Drawer.Root direction="bottom">
      <Drawer.Trigger asChild className="text-sm px-5 py-2">
        {trigger}
      </Drawer.Trigger>
      <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-[#11111A] flex flex-col rounded-t-[10px] h-fit mt-24 fixed bottom-0 left-0 right-0">
          <div className="p-4 bg-[#11111A] rounded-t-[10px] flex-1">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mb-8" />
            <div className="max-w-md mx-auto">

            <VisuallyHidden>
            <Drawer.Title className="font-bold mb-4 text-[#DDDDDD]">
                Menu
              </Drawer.Title>
            </VisuallyHidden>
              <nav className="flex flex-col space-y-4">
                <Link href="/chat" className="font-ia text-[#DDDDDD] px-4 py-2 rounded-md">
                <Button variant="ghost" className="w-full !flex !justify-center font-semibold text-lg hover:!cursor-pointer hover:!text-[#DDDDDD]/90 hover:!bg-transparent">
                  chat
                  </Button>
                </Link>
                <Link href="/conversations" className="font-ia text-[#DDDDDD] px-4 py-2 rounded-md">
                <Button variant="ghost" className="w-full !flex !justify-center font-semibold text-lg hover:!cursor-pointer hover:!text-[#DDDDDD]/90 hover:!bg-transparent">
                  conversations
                </Button>
                </Link>
                <Link href="/twitter" className="font-ia text-[#DDDDDD] px-4 py-2 rounded-md">
                <Button variant="ghost" className="w-full !flex !justify-center font-semibold text-lg hover:!cursor-pointer hover:!text-[#DDDDDD]/90 hover:!bg-transparent">
                  twitter
                </Button>
                </Link>
                <Link href="/telegram" className="font-ia text-[#DDDDDD] px-4 py-2 rounded-md">
                <Button variant="ghost" className="w-full !flex !justify-center font-semibold text-lg hover:!cursor-pointer hover:!text-[#DDDDDD]/90 hover:!bg-transparent">
                  telegram
                </Button>
                </Link>
                <Link href="/admin" className="font-ia text-[#DDDDDD] px-4 py-2 rounded-md">
                <Button variant="ghost" className="w-full !flex !justify-center font-semibold text-lg hover:!cursor-pointer hover:!text-[#DDDDDD]/90 hover:!bg-transparent">
                  admin
                </Button>
                </Link>
              </nav>
            </div>
          </div>
        </Drawer.Content>
        
      </Drawer.Portal>
    </Drawer.Root>
  );
}