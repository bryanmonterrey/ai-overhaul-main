// app/trading/layout.tsx
export default function TradingLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <div className="min-h-screen bg-[#11111A] text-white">
        {children} 
      </div>
    );
  }