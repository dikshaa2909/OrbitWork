import { Logo } from "@/components/logo";
import { UserButton } from "@/features/auth/components/user-button";
import { PreviewRoleBanner } from "@/components/preview-role-banner";

interface StandloneLayoutProps {
  children: React.ReactNode;
};

const StandloneLayout = ({ children }: StandloneLayoutProps) => {
  return ( 
    <main className="bg-neutral-100 min-h-screen">
      <PreviewRoleBanner />
      <div className="mx-auto max-w-screen-2xl p-4">
        <nav className="flex justify-between items-center h-[73px]">
          <Logo size="lg" href="/" />
          <UserButton />
        </nav>
        <div className="flex flex-col items-center justify-center py-4">
          {children}
        </div>
      </div>
    </main>
  );
}
 
export default StandloneLayout;