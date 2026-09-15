export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-navy p-2 sm:p-4 md:p-6 overflow-y-auto lg:overflow-hidden">
      {children}
    </div>
  );
}
