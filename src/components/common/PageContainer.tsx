import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`w-full max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12 py-4 md:py-8 lg:py-12 animate-in fade-in duration-500 ${className}`}
    >
      {children}
    </div>
  );
};

export default PageContainer;
