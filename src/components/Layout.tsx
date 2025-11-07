import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  return (
    <div className="min-h-screen bg-surface-alt">
      {showSidebar && <Sidebar />}
      
      <main 
        className={showSidebar ? "md:ml-60 transition-[margin] duration-200 ease-linear" : ""}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
};
